from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
import os
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory
from typing import Callable

from .layout import ManagedLayout, _deletion_path
from .lock import MaintenanceLock
from .release import (
    ReleaseAsset,
    ReleaseManifest,
    download_file,
    fetch_latest_release,
    read_expected_sha256,
    safe_extract_zip,
    validate_stable_manifest,
    verify_sha256,
)
from .state import STATE_BACKUP_NAME, InstallState, ManagedExtensionState, ReleaseRef, StateLoadError, load_state, load_state_backup, write_state
from .transaction import ManagedTransaction, PreparedRelease, TransactionError


@dataclass(frozen=True)
class MaintenanceResult:
    command: str
    changed: bool
    current_release: str | None
    previous_release: str | None = None
    profile: str = "max"
    message: str = ""
    degraded_extensions: tuple[str, ...] = ()
    current_pi_version: str | None = None
    previous_pi_version: str | None = None
    latest_pi_version: str | None = None
    path_removed: bool | None = None

    def to_json(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "command": self.command,
            "changed": self.changed,
            "currentRelease": self.current_release,
            "previousRelease": self.previous_release,
            "profile": self.profile,
            "message": self.message,
            "degradedExtensions": list(self.degraded_extensions),
        }
        if self.command == "update-check":
            payload["updateAvailable"] = self.changed
        if any((self.current_pi_version, self.previous_pi_version, self.latest_pi_version)):
            payload["pi"] = {
                "currentVersion": self.current_pi_version,
                "previousVersion": self.previous_pi_version,
                "latestVersion": self.latest_pi_version,
            }
        if self.command == "update-check" and self.latest_pi_version:
            payload["piUpdateAvailable"] = self.current_pi_version != self.latest_pi_version
        if self.command == "update" and self.changed and self.current_pi_version:
            payload["piChanged"] = self.current_pi_version != self.previous_pi_version
        if self.path_removed is not None:
            payload["pathRemoved"] = self.path_removed
        return payload


ComponentReconciler = Callable[[InstallState], list[ManagedExtensionState]]
CACHE_UNPROTECTED_RETENTION = 2


def _cache_key(tag: str, version: str, release_id: str | None = None) -> str:
    identity = release_id or ""
    return sha256(f"{tag}\0{version}\0{identity}".encode("utf-8")).hexdigest()[:16]


def _manifest_digest(manifest: ReleaseManifest) -> str:
    payload = json.dumps(manifest.to_json(), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return sha256(payload.encode("utf-8")).hexdigest()


def _read_package_version(source: Path) -> str:
    try:
        package = json.loads((source / "package.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeError) as error:
        raise RuntimeError(f"Unable to read Dove Pi package version at {source}: {error}") from error
    version = package.get("version") if isinstance(package, dict) else None
    if not isinstance(version, str) or not version.strip():
        raise RuntimeError("Dove Pi package.json has no version")
    return version.strip()


def _source_fingerprint(source: Path) -> str:
    digest = sha256()
    excluded_directories = {".git", ".trellis", ".dove", ".agent-data", "node_modules", "__pycache__", "dist"}
    excluded_files = {".DS_Store"}
    files: list[Path] = []
    for directory, names, filenames in os.walk(source):
        names[:] = sorted(name for name in names if name not in excluded_directories)
        files.extend(Path(directory) / name for name in sorted(filenames) if name not in excluded_files and not name.endswith(".pyc"))
    verification_assets = [source / ".trellis" / "workflow.md"]
    verification_spec = source / ".trellis" / "spec"
    if verification_spec.is_dir():
        verification_assets.extend(path for path in verification_spec.rglob("*") if path.is_file())
    files.extend(path for path in verification_assets if path.is_file())
    for path in sorted(files, key=lambda item: item.relative_to(source).as_posix().lower()):
        relative = path.relative_to(source)
        digest.update(relative.as_posix().encode("utf-8"))
        try:
            digest.update(path.read_bytes())
        except OSError as error:
            raise RuntimeError(f"Unable to fingerprint Dove Pi source file {path}: {error}") from error
    return digest.hexdigest()[:12]


def source_release_manifest(source: Path) -> ReleaseManifest:
    embedded = source / "release.json"
    if embedded.is_file():
        return ReleaseManifest.read(embedded)
    version = _read_package_version(source)
    fingerprint = _source_fingerprint(source)
    generated: ReleaseManifest | None = None
    node = shutil.which("node")
    loader = source / "node_modules" / "tsx" / "dist" / "loader.mjs"
    generator = source / "scripts" / "build-release-manifest.mts"
    if node and loader.is_file() and generator.is_file():
        with TemporaryDirectory(prefix="dove-pi-manifest-") as temporary:
            destination = Path(temporary) / "release.json"
            try:
                subprocess.run(
                    [node, "--import", loader.as_uri(), str(generator), str(destination)],
                    cwd=source,
                    check=True,
                    capture_output=True,
                    text=True,
                )
                generated = ReleaseManifest.read(destination)
            except (OSError, subprocess.CalledProcessError, RuntimeError):
                # A source checkout may be incomplete before its first npm ci.
                # Installation can still proceed; managed-extension state will
                # be populated when a packaged release manifest is available.
                generated = None
    return ReleaseManifest(
        version=version,
        release_id=f"{version}+source.{fingerprint}",
        commit=fingerprint,
        runtime=generated.runtime if generated else {},
        components=generated.components if generated else {},
        profiles=generated.profiles if generated else {},
        # Without the TS manifest generator we cannot reproduce the adapter's
        # identity digest; leave it unknown instead of inventing a divergent
        # value that would incorrectly report drift.
        dove_extension=generated.dove_extension if generated else {},
        source_path=str(source),
        source_digest=generated.source_digest if generated and generated.source_digest else fingerprint,
    )


def _legacy_profile(source: Path) -> str | None:
    try:
        value = json.loads((source / ".dove" / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeError):
        return None
    profile = value.get("profile") if isinstance(value, dict) else None
    return profile if profile in {"minimal", "dev", "research", "security", "max"} else None


def write_managed_launchers(layout: ManagedLayout, *, python: Path | None = None) -> None:
    layout.bin_dir.mkdir(parents=True, exist_ok=True)
    state_relative = r"state\install.json"
    versions_relative = r"app\versions"
    ps1_content = f"""$ErrorActionPreference = 'Stop'
$doveRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $doveRoot '{state_relative}'
$versionsRoot = [IO.Path]::GetFullPath((Join-Path $doveRoot '{versions_relative}'))
try {{ $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json }}
catch {{ Write-Error \"Dove Pi state is unavailable. Run 'dove-pi repair' from the installer.\"; exit 1 }}
function Resolve-DoveRelease($candidate) {{
    if (-not $candidate -or -not $candidate.installPath) {{ return $null }}
    try {{ $targetRoot = [IO.Path]::GetFullPath([string]$candidate.installPath) }} catch {{ return $null }}
    $boundary = $versionsRoot.TrimEnd('\\') + '\\'
    if (-not $targetRoot.StartsWith($boundary, [StringComparison]::OrdinalIgnoreCase)) {{ return $null }}
    if (-not (Test-Path -LiteralPath (Join-Path $targetRoot 'dove_pi.py') -PathType Leaf)) {{ return $null }}
    if (-not (Test-Path -LiteralPath (Join-Path $targetRoot 'release.json') -PathType Leaf)) {{ return $null }}
    if (-not (Test-Path -LiteralPath (Join-Path $targetRoot 'node_modules') -PathType Container)) {{ return $null }}
    return $targetRoot
}}
$targetRoot = Resolve-DoveRelease $state.current
if (-not $targetRoot) {{
    $targetRoot = Resolve-DoveRelease $state.previous
    if ($targetRoot) {{ Write-Warning 'Current Dove Pi release is unavailable; using previous. Run dove-pi repair.' }}
}}
if (-not $targetRoot) {{ Write-Error 'No runnable Dove Pi release is installed. Run dove-pi repair.'; exit 1 }}
$doveArguments = @($args)
$pythonCommands = @('doctor', 'project', 'task', 'session', 'skills', 'web', 'cache', 'token', 'capability', 'rpc', 'mcp', 'extensions', 'install', 'setup', 'update', 'repair', 'rollback', 'uninstall', 'icons', 'help', '-h', '--help', 'version', '--version')
$argumentIndex = 0
while ($argumentIndex -lt $doveArguments.Count -and @('--offline', '--skip-version-check') -contains [string]$doveArguments[$argumentIndex]) {{ $argumentIndex++ }}
$usePiFastPath = $argumentIndex -ge $doveArguments.Count -or $pythonCommands -notcontains [string]$doveArguments[$argumentIndex]
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue | Select-Object -First 1
$fastLauncher = Join-Path $targetRoot 'bin\dove-pi.cjs'
if ($usePiFastPath -and $nodeCommand -and (Test-Path -LiteralPath $fastLauncher -PathType Leaf)) {{
    $nodePath = if ($nodeCommand.Source) {{ [string]$nodeCommand.Source }} else {{ [string]$nodeCommand.Path }}
    & $nodePath $fastLauncher @doveArguments
    exit $LASTEXITCODE
}}
$script = Join-Path $targetRoot 'dove_pi.py'
$python = $null
$pythonArguments = @()
foreach ($name in @('python.exe', 'python', 'py.exe', 'py')) {{
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {{
        $candidate = if ($command.Source) {{ [string]$command.Source }} else {{ [string]$command.Path }}
        $candidateArguments = if ($name -eq 'py.exe' -or $name -eq 'py') {{ @('-3') }} else {{ @() }}
        try {{
            $probeOutput = @(& $candidate @candidateArguments -c 'import platform; print(platform.python_version())' 2>$null)
            $probeExitCode = $LASTEXITCODE
            if ($probeExitCode -eq 0 -and $probeOutput.Count -gt 0 -and [version]([string]$probeOutput[0]).Trim() -ge [version]'3.10.0') {{
                $python = $candidate
                $pythonArguments = $candidateArguments
                break
            }}
        }} catch {{}}
    }}
}}
if (-not $python) {{ Write-Error 'Python 3.10 or newer is unavailable. Run the public Dove Pi bootstrap, then retry dove-pi repair.'; exit 1 }}
& $python @pythonArguments $script @args
exit $LASTEXITCODE
"""
    ps1 = layout.bin_dir / "dove-pi.ps1"
    ps1_tmp = layout.bin_dir / f"dove-pi.ps1.tmp-{os.getpid()}"
    ps1_tmp.write_text(ps1_content, encoding="utf-8-sig")
    os.replace(ps1_tmp, ps1)
    cmd = layout.bin_dir / "dove-pi.cmd"
    cmd_tmp = layout.bin_dir / f"dove-pi.cmd.tmp-{os.getpid()}"
    cmd_tmp.write_text(
        '@echo off\r\nwhere powershell.exe >nul 2>nul\r\nif not errorlevel 1 goto windows_powershell\r\nwhere pwsh.exe >nul 2>nul\r\nif not errorlevel 1 goto powershell_core\r\necho PowerShell is unavailable. Run the Dove Pi bootstrap again. 1>&2\r\nexit /b 1\r\n:windows_powershell\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0dove-pi.ps1" %*\r\nexit /b %ERRORLEVEL%\r\n:powershell_core\r\npwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0dove-pi.ps1" %*\r\nexit /b %ERRORLEVEL%\r\n',
        encoding="ascii",
    )
    os.replace(cmd_tmp, cmd)


class ManagedInstaller:
    def __init__(self, layout: ManagedLayout, *, fetch_release: Callable[[], ReleaseAsset] = fetch_latest_release) -> None:
        self.layout = layout
        self.fetch_release = fetch_release
        self.transaction = ManagedTransaction(layout)

    def install_source(
        self,
        source: Path,
        *,
        profile: str | None = None,
        verify: str = "quick",
        force_rebuild: bool = False,
        reconcile_components: ComponentReconciler | None = None,
        source_asset: tuple[Path, Path, str] | None = None,
    ) -> MaintenanceResult:
        source = source.resolve(strict=True)
        with MaintenanceLock(self.layout.lock_path, "install"):
            state = load_state(self.layout, strict=True)
            state.profile = profile or (_legacy_profile(source) if not self.layout.state_path.exists() else None) or state.profile
            manifest = source_release_manifest(source)
            if source_asset is not None:
                archive, checksum, tag = source_asset
                self._validate_local_asset(archive, checksum, tag=tag, manifest=manifest)
            prepared = self.transaction.prepare_source(source, manifest, verify=verify, force_rebuild=force_rebuild)
            if source_asset is not None:
                archive, checksum, tag = source_asset
                self._cache_local_asset(
                    archive,
                    checksum,
                    tag=tag,
                    version=prepared.manifest.version,
                    release_id=prepared.manifest.release_id,
                    manifest=prepared.manifest,
                )
            state = self.transaction.activate(prepared, state, command="install")
            state = self._reconcile_components(state, reconcile_components, command="install")
            write_managed_launchers(self.layout)
            self.transaction.prune(state)
            self._prune_cache(state)
            return _result("install", not prepared.reused, state, f"Dove Pi {manifest.version} is installed.")

    def update(
        self,
        *,
        check: bool = False,
        verify: str = "quick",
        reconcile_components: ComponentReconciler | None = None,
    ) -> MaintenanceResult:
        if check:
            asset = self.fetch_release()
            latest_pi_version = _asset_pi_version(asset)
            state = load_state(self.layout, strict=True)
            current_matches_asset = bool(state.current and self._matches_asset(state.current, asset))
            current = state.current.release_id if state.current else None
            update_available = not current_matches_asset or not self._is_runnable_ref(state.current)
            return MaintenanceResult(
                command="update-check",
                changed=update_available,
                current_release=current,
                previous_release=state.previous.release_id if state.previous else None,
                profile=state.profile,
                message=f"Latest stable release: {asset.tag}",
                degraded_extensions=tuple(entry.identity for entry in state.managed_extensions if entry.status != "healthy"),
                current_pi_version=_release_pi_version(state.current),
                previous_pi_version=_release_pi_version(state.previous),
                latest_pi_version=latest_pi_version,
            )
        with MaintenanceLock(self.layout.lock_path, "update"):
            state = load_state(self.layout, strict=True)
            asset = self.fetch_release()
            return self._update_locked(state, asset, verify=verify, reconcile_components=reconcile_components)

    def repair(
        self,
        *,
        verify: str = "quick",
        reconcile_components: ComponentReconciler | None = None,
    ) -> MaintenanceResult:
        with MaintenanceLock(self.layout.lock_path, "repair"):
            recovery_message = None
            try:
                state = load_state(self.layout, strict=True)
            except StateLoadError as error:
                state = self._recover_state()
                recovery_message = str(error)
            if state.current and self._verify_ref(state.current, verify=verify):
                state = self._reconcile_components(state, reconcile_components, command="repair")
                write_managed_launchers(self.layout)
                if reconcile_components is None:
                    write_state(self.layout, state, command="repair")
                message = "Current release and launcher are healthy."
                if recovery_message:
                    message = f"Recovered managed state; {message}"
                return _result("repair", False, state, message)
            if state.previous and self._verify_ref(state.previous, verify=verify):
                state.current, state.previous = state.previous, state.current
                write_state(self.layout, state, command="repair")
                state = self._reconcile_components(state, reconcile_components, command="repair")
                write_managed_launchers(self.layout)
                return _result("repair", True, state, "Recovered the previous runnable release.")
            cached = self._cached_asset(
                state.current.version if state.current else None,
                state.current.release_id if state.current else None,
            )
            if cached:
                with TemporaryDirectory(prefix="dove-pi-repair-") as temporary:
                    source, manifest = self._download_release(cached, Path(temporary))
                    prepared = self.transaction.prepare_source(source, manifest, verify=verify, force_rebuild=True)
                    state = self.transaction.activate(prepared, state, command="repair")
                    state = self._reconcile_components(state, reconcile_components, command="repair")
                write_managed_launchers(self.layout)
                self.transaction.prune(state)
                self._prune_cache(state)
                return _result("repair", True, state, f"Rebuilt Dove Pi {manifest.release_id} from the verified release cache.")
            asset = self.fetch_release()
            return self._update_locked(
                state,
                asset,
                verify=verify,
                reconcile_components=reconcile_components,
                command="repair",
                force_refresh=True,
            )

    def rollback(self) -> MaintenanceResult:
        with MaintenanceLock(self.layout.lock_path, "rollback"):
            state = self.transaction.rollback(load_state(self.layout, strict=True))
            write_managed_launchers(self.layout)
            return _result("rollback", True, state, "Switched to the previous Dove Pi application release; user extensions were not changed.")

    def uninstall(self, *, confirmed: bool = False) -> MaintenanceResult:
        if not confirmed:
            raise RuntimeError("Uninstall requires --yes. Pi user data, projects, extensions, and development checkouts are preserved.")
        with MaintenanceLock(self.layout.lock_path, "uninstall"):
            root = self.layout.root.resolve(strict=False)
            if root == Path(root.anchor) or root == Path.home().resolve(strict=False):
                raise RuntimeError(f"Refusing to uninstall an unsafe managed root: {root}")
            # Remove only known Dove-owned children; never recurse over an
            # arbitrary caller-supplied root wholesale. npm dependency trees
            # routinely exceed the legacy Windows MAX_PATH limit, so validate
            # the ordinary path first and only then add the Win32 long-path
            # prefix used by the filesystem deletion call.
            for directory in (self.layout.bin_dir, self.layout.versions_dir.parent, self.layout.cache_dir.parent, self.layout.staging_dir, self.layout.logs_dir):
                if directory.exists():
                    managed = self.layout.require_managed_path(directory)
                    shutil.rmtree(_deletion_path(managed), ignore_errors=False)
            state_files = [self.layout.state_path, self.layout.state_dir / STATE_BACKUP_NAME]
            for pattern in ("install.json.corrupt-*", "install.json.tmp-*", f"{STATE_BACKUP_NAME}.tmp-*", "maintenance.stale-*.json"):
                state_files.extend(self.layout.state_dir.glob(pattern))
            for state_file in state_files:
                managed = self.layout.require_managed_path(state_file, boundary=self.layout.state_dir)
                if managed.is_file() or managed.is_symlink():
                    managed.unlink()
        # Keep the now-empty state/root directories. Removing the lock and then
        # recursively deleting its parent would create a race in which another
        # maintenance process could acquire a fresh lock and have it deleted.
        return MaintenanceResult("uninstall", True, None, profile="max", message="Dove Pi managed application files were removed; user and project data were preserved.")

    def _recover_state(self) -> InstallState:
        backup = load_state_backup(self.layout)
        candidates: list[tuple[int, int, ReleaseRef]] = []
        seen: set[Path] = set()
        seen_release_ids: set[str] = set()
        if backup is not None:
            for priority, reference in ((2, backup.current), (1, backup.previous)):
                if reference is None or not self._verify_ref(reference, verify="none"):
                    continue
                resolved = reference.install_path.resolve(strict=False)
                seen.add(resolved)
                seen_release_ids.add(reference.release_id)
                candidates.append((priority, 0, reference))
        if self.layout.versions_dir.is_dir():
            for path in self.layout.versions_dir.iterdir():
                if not path.is_dir():
                    continue
                try:
                    managed_path = self.layout.require_version_path(path)
                    if managed_path in seen:
                        continue
                    manifest = self.transaction.verify_existing(managed_path, verify="none")
                    if manifest.release_id in seen_release_ids:
                        continue
                    timestamp = managed_path.stat().st_mtime_ns
                except (OSError, RuntimeError):
                    continue
                seen_release_ids.add(manifest.release_id)
                candidates.append((0, timestamp, ReleaseRef(manifest.release_id, managed_path, manifest.version)))
        candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
        if not candidates:
            raise StateLoadError(
                f"Managed Dove Pi state is corrupt and no verified release is available at {self.layout.versions_dir}; "
                "restore a backup or run the public installer.",
            )
        refs = [item[2] for item in candidates[:2]]
        return InstallState(
            current=refs[0],
            previous=refs[1] if len(refs) > 1 else None,
            profile=backup.profile if backup else "max",
            managed_extensions=list(backup.managed_extensions) if backup else [],
        )

    def _update_locked(
        self,
        state: InstallState,
        asset: ReleaseAsset,
        *,
        verify: str,
        reconcile_components: ComponentReconciler | None,
        command: str = "update",
        force_refresh: bool = False,
    ) -> MaintenanceResult:
        latest_pi_version = _asset_pi_version(asset)
        current_matches_asset = bool(state.current and self._matches_asset(state.current, asset))
        if not force_refresh and current_matches_asset and self._is_runnable_ref(state.current):
            state = self._reconcile_components(state, reconcile_components, command=command)
            write_managed_launchers(self.layout)
            if reconcile_components is None:
                write_state(self.layout, state, command=command)
            return _result(
                "update" if command == "update" else command,
                False,
                state,
                f"Dove Pi {asset.version} is already current.",
                latest_pi_version=latest_pi_version,
            )
        with TemporaryDirectory(prefix="dove-pi-release-") as temporary:
            source, manifest = self._download_release(asset, Path(temporary))
            prepared = self.transaction.prepare_source(source, manifest, verify=verify)
            state = self.transaction.activate(prepared, state, command=command)
            state = self._reconcile_components(state, reconcile_components, command=command)
        write_managed_launchers(self.layout)
        self.transaction.prune(state)
        self._prune_cache(state)
        return _result(
            "update" if command == "update" else command,
            not prepared.reused,
            state,
            f"Dove Pi is ready at {manifest.release_id}.",
            latest_pi_version=latest_pi_version,
        )

    def _download_release(self, asset: ReleaseAsset, temporary: Path) -> tuple[Path, ReleaseManifest]:
        cache_key = _cache_key(asset.tag, asset.version, asset.release_id or (asset.manifest.release_id if asset.manifest else None))
        cache = self.layout.cache_dir / cache_key
        cache.mkdir(parents=True, exist_ok=True)
        archive = cache / "dove-pi-windows.zip"
        checksum = cache / "dove-pi-windows.zip.sha256"
        cache_verified = False
        try:
            verify_sha256(archive, read_expected_sha256(checksum))
            cache_verified = True
        except (OSError, RuntimeError):
            download_file(asset.archive_url, archive)
            download_file(asset.checksum_url, checksum)
            verify_sha256(archive, read_expected_sha256(checksum))
        try:
            source, manifest = self._extract_and_validate_release(asset, archive, temporary / "extracted")
        except (RuntimeError, OSError):
            if not cache_verified:
                raise
            archive.unlink(missing_ok=True)
            checksum.unlink(missing_ok=True)
            (cache / "asset.json").unlink(missing_ok=True)
            try:
                shutil.rmtree(temporary / "extracted")
            except OSError as error:
                raise RuntimeError(
                    "Unable to reset the stale release cache extraction; close Dove Pi/Node processes and retry.",
                ) from error
            download_file(asset.archive_url, archive)
            download_file(asset.checksum_url, checksum)
            verify_sha256(archive, read_expected_sha256(checksum))
            source, manifest = self._extract_and_validate_release(asset, archive, temporary / "extracted")
        descriptor = cache / "asset.json"
        descriptor_tmp = cache / f"asset.json.tmp-{os.getpid()}"
        descriptor_tmp.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "tag": asset.tag,
                    "version": asset.version,
                    "releaseId": manifest.release_id,
                    "manifestDigest": _manifest_digest(manifest),
                    "sha256": read_expected_sha256(checksum),
                },
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )
        os.replace(descriptor_tmp, descriptor)
        return source, manifest

    @staticmethod
    def _extract_and_validate_release(asset: ReleaseAsset, archive: Path, extracted: Path) -> tuple[Path, ReleaseManifest]:
        source, manifest = ManagedInstaller._extract_release_root(archive, extracted)
        if (
            manifest.version != asset.version
            or asset.tag.removeprefix("v") != manifest.version
            or (asset.release_id is not None and manifest.release_id != asset.release_id)
            or (asset.manifest is not None and manifest != asset.manifest)
        ):
            raise TransactionError(
                "release",
                f"Release metadata mismatch: expected {asset.tag} ({asset.release_id or asset.version}), "
                f"archive {manifest.version} ({manifest.release_id})",
            )
        return source, manifest

    def _validate_local_asset(
        self,
        archive: Path,
        checksum: Path,
        *,
        tag: str,
        manifest: ReleaseManifest,
    ) -> None:
        if tag != f"v{manifest.version}":
            raise TransactionError(
                "release",
                f"Bootstrap tag {tag} does not match archive version {manifest.version}",
            )
        verify_sha256(archive, read_expected_sha256(checksum))
        validate_stable_manifest(manifest)
        with TemporaryDirectory(prefix="dove-pi-bootstrap-asset-") as temporary:
            _source, embedded = self._extract_release_root(archive, Path(temporary) / "extracted")
        if embedded != manifest:
            raise TransactionError(
                "release",
                "Bootstrap archive release.json does not match the extracted release source",
            )

    @staticmethod
    def _extract_release_root(archive: Path, extracted: Path) -> tuple[Path, ReleaseManifest]:
        safe_extract_zip(archive, extracted)
        candidates = [path.parent for path in extracted.rglob("release.json") if (path.parent / "dove_pi.py").is_file()]
        if len(candidates) != 1:
            raise TransactionError("release", "The Dove Pi archive must contain exactly one release root")
        return candidates[0], ReleaseManifest.read(candidates[0] / "release.json")

    def _cache_local_asset(
        self,
        archive: Path,
        checksum: Path,
        *,
        tag: str,
        version: str,
        release_id: str | None = None,
        manifest: ReleaseManifest | None = None,
    ) -> None:
        expected = read_expected_sha256(checksum)
        verify_sha256(archive, expected)
        cache_key = _cache_key(tag, version, release_id)
        cache = self.layout.cache_dir / cache_key
        cache.mkdir(parents=True, exist_ok=True)
        for source, name in ((archive, "dove-pi-windows.zip"), (checksum, "dove-pi-windows.zip.sha256")):
            temporary = cache / f"{name}.tmp-{os.getpid()}"
            shutil.copy2(source, temporary)
            os.replace(temporary, cache / name)
        descriptor = cache / "asset.json"
        descriptor_tmp = cache / f"asset.json.tmp-{os.getpid()}"
        descriptor_tmp.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "tag": tag,
                    "version": version,
                    "releaseId": release_id,
                    "manifestDigest": _manifest_digest(manifest) if manifest else None,
                    "sha256": expected,
                },
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )
        os.replace(descriptor_tmp, descriptor)

    def _cached_asset(self, version: str | None, release_id: str | None = None) -> ReleaseAsset | None:
        if not version or not self.layout.cache_dir.is_dir():
            return None
        for descriptor in self.layout.cache_dir.glob("*/asset.json"):
            try:
                value = json.loads(descriptor.read_text(encoding="utf-8"))
                if (
                    not isinstance(value, dict)
                    or value.get("schemaVersion") != 1
                    or value.get("version") != version
                    or not isinstance(value.get("tag"), str)
                    or not isinstance(value.get("releaseId"), str)
                    or not isinstance(value.get("manifestDigest"), str)
                    or not isinstance(value.get("sha256"), str)
                ):
                    continue
                if release_id is not None and value.get("releaseId") != release_id:
                    continue
                archive = descriptor.parent / "dove-pi-windows.zip"
                checksum = descriptor.parent / "dove-pi-windows.zip.sha256"
                expected = read_expected_sha256(checksum)
                if isinstance(value.get("sha256"), str) and value["sha256"] != expected:
                    continue
                verify_sha256(archive, expected)
                with TemporaryDirectory(prefix="dove-pi-cache-validate-") as temporary:
                    _source, manifest = self._extract_release_root(archive, Path(temporary) / "extracted")
                if (
                    manifest.version != version
                    or manifest.release_id != value["releaseId"]
                    or value["tag"] != f"v{manifest.version}"
                    or _manifest_digest(manifest) != value["manifestDigest"]
                ):
                    continue
                return ReleaseAsset(
                    value["tag"],
                    version,
                    archive.as_uri(),
                    checksum.as_uri(),
                    release_id=manifest.release_id,
                    manifest=manifest,
                )
            except (OSError, RuntimeError, json.JSONDecodeError, UnicodeError):
                continue
        return None

    def _prune_cache(self, state: InstallState) -> None:
        if not self.layout.cache_dir.is_dir():
            return
        protected = {reference.release_id for reference in (state.current, state.previous) if reference}
        entries: list[tuple[bool, int, Path]] = []
        invalid_entries: list[Path] = []
        for candidate in self.layout.cache_dir.iterdir():
            try:
                entry = self.layout.require_managed_path(candidate, boundary=self.layout.cache_dir)
                if not candidate.is_dir():
                    invalid_entries.append(entry)
                    continue
                descriptor = candidate / "asset.json"
                value = json.loads(descriptor.read_text(encoding="utf-8"))
                if (
                    not isinstance(value, dict)
                    or value.get("schemaVersion") != 1
                    or not isinstance(value.get("releaseId"), str)
                    or not isinstance(value.get("manifestDigest"), str)
                    or not isinstance(value.get("sha256"), str)
                ):
                    invalid_entries.append(entry)
                    continue
                release_id = value.get("releaseId")
                entries.append((isinstance(release_id, str) and release_id in protected, entry.stat().st_mtime_ns, entry))
            except (OSError, RuntimeError, json.JSONDecodeError, UnicodeError):
                try:
                    invalid_entries.append(self.layout.require_managed_path(candidate, boundary=self.layout.cache_dir))
                except RuntimeError:
                    continue
        entries.sort(key=lambda item: (item[0], item[1]), reverse=True)
        keep = {entry for protected_entry, _timestamp, entry in entries if protected_entry}
        unprotected = [entry for protected_entry, _timestamp, entry in entries if not protected_entry]
        keep.update(unprotected[:CACHE_UNPROTECTED_RETENTION])
        stale_entries = [entry for _protected_entry, _timestamp, entry in entries if entry not in keep]
        for entry in invalid_entries + stale_entries:
            try:
                if entry.is_dir():
                    shutil.rmtree(_deletion_path(entry), ignore_errors=False)
                else:
                    entry.unlink()
            except OSError:
                continue

    def _verify_ref(self, reference: ReleaseRef, *, verify: str) -> bool:
        try:
            manifest = self.transaction.verify_existing(reference.install_path, verify=verify)
        except TransactionError:
            return False
        return manifest.release_id == reference.release_id

    def _is_runnable_ref(self, reference: ReleaseRef) -> bool:
        return self._verify_ref(reference, verify="none")

    @staticmethod
    def _matches_asset(reference: ReleaseRef, asset: ReleaseAsset) -> bool:
        if reference.version != asset.version:
            return False
        if asset.release_id is not None and reference.release_id != asset.release_id:
            return False
        if asset.manifest is not None:
            try:
                return ReleaseManifest.read(reference.install_path / "release.json") == asset.manifest
            except RuntimeError:
                return False
        return True

    def _reconcile_components(
        self,
        state: InstallState,
        reconciler: ComponentReconciler | None,
        *,
        command: str,
    ) -> InstallState:
        if reconciler is None:
            return state
        state.managed_extensions = list(reconciler(state))
        write_state(self.layout, state, command=command)
        return state


def _release_pi_version(reference: ReleaseRef | None) -> str | None:
    if reference is None:
        return None
    try:
        version = ReleaseManifest.read(reference.install_path / "release.json").components.get("pi")
    except RuntimeError:
        return None
    return version if isinstance(version, str) and version.strip() else None


def _asset_pi_version(asset: ReleaseAsset) -> str | None:
    version = asset.manifest.components.get("pi") if asset.manifest is not None else None
    return version if isinstance(version, str) and version.strip() else None


def _result(
    command: str,
    changed: bool,
    state: InstallState,
    message: str,
    *,
    latest_pi_version: str | None = None,
) -> MaintenanceResult:
    return MaintenanceResult(
        command=command,
        changed=changed,
        current_release=state.current.release_id if state.current else None,
        previous_release=state.previous.release_id if state.previous else None,
        profile=state.profile,
        message=message,
        degraded_extensions=tuple(entry.identity for entry in state.managed_extensions if entry.status != "healthy"),
        current_pi_version=_release_pi_version(state.current),
        previous_pi_version=_release_pi_version(state.previous),
        latest_pi_version=latest_pi_version,
    )
