from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
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
from .state import InstallState, ManagedExtensionState, ReleaseRef, load_state, write_state
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
    python_path = str((python or Path(sys.executable)).resolve()).replace("'", "''")
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
$script = Join-Path $targetRoot 'dove_pi.py'
& '{python_path}' $script @args
exit $LASTEXITCODE
"""
    ps1 = layout.bin_dir / "dove-pi.ps1"
    ps1_tmp = layout.bin_dir / f"dove-pi.ps1.tmp-{os.getpid()}"
    ps1_tmp.write_text(ps1_content, encoding="utf-8-sig")
    os.replace(ps1_tmp, ps1)
    cmd = layout.bin_dir / "dove-pi.cmd"
    cmd_tmp = layout.bin_dir / f"dove-pi.cmd.tmp-{os.getpid()}"
    cmd_tmp.write_text(
        '@echo off\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0dove-pi.ps1" %*\r\nexit /b %ERRORLEVEL%\r\n',
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
            state = load_state(self.layout)
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
                )
            state = self.transaction.activate(prepared, state, command="install")
            state = self._reconcile_components(state, reconcile_components, command="install")
            write_managed_launchers(self.layout)
            self.transaction.prune(state)
            return _result("install", not prepared.reused, state, f"Dove Pi {manifest.version} is installed.")

    def update(
        self,
        *,
        check: bool = False,
        verify: str = "quick",
        reconcile_components: ComponentReconciler | None = None,
    ) -> MaintenanceResult:
        state = load_state(self.layout)
        asset = self.fetch_release()
        latest_pi_version = _asset_pi_version(asset)
        current_matches_asset = bool(state.current and self._matches_asset(state.current, asset))
        if check:
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
            state = load_state(self.layout)
            current_matches_asset = bool(state.current and self._matches_asset(state.current, asset))
            if current_matches_asset and self._is_runnable_ref(state.current):
                state = self._reconcile_components(state, reconcile_components, command="update")
                write_managed_launchers(self.layout)
                if reconcile_components is None:
                    write_state(self.layout, state, command="update")
                return _result(
                    "update",
                    False,
                    state,
                    f"Dove Pi {asset.version} is already current.",
                    latest_pi_version=latest_pi_version,
                )
            with TemporaryDirectory(prefix="dove-pi-release-") as temporary:
                source, manifest = self._download_release(asset, Path(temporary))
                prepared = self.transaction.prepare_source(source, manifest, verify=verify)
                state = self.transaction.activate(prepared, state, command="update")
                state = self._reconcile_components(state, reconcile_components, command="update")
            write_managed_launchers(self.layout)
            self.transaction.prune(state)
            return _result(
                "update",
                not prepared.reused,
                state,
                f"Dove Pi is ready at {manifest.release_id}.",
                latest_pi_version=latest_pi_version,
            )

    def repair(
        self,
        *,
        verify: str = "quick",
        reconcile_components: ComponentReconciler | None = None,
    ) -> MaintenanceResult:
        with MaintenanceLock(self.layout.lock_path, "repair"):
            state = load_state(self.layout)
            if state.current and self._verify_ref(state.current, verify=verify):
                state = self._reconcile_components(state, reconcile_components, command="repair")
                write_managed_launchers(self.layout)
                if reconcile_components is None:
                    write_state(self.layout, state, command="repair")
                return _result("repair", False, state, "Current release and launcher are healthy.")
            if state.previous and self._verify_ref(state.previous, verify=verify):
                state.current, state.previous = state.previous, state.current
                write_state(self.layout, state, command="repair")
                state = self._reconcile_components(state, reconcile_components, command="repair")
                write_managed_launchers(self.layout)
                return _result("repair", True, state, "Recovered the previous runnable release.")
            cached = self._cached_asset(state.current.version if state.current else None)
            if cached:
                with TemporaryDirectory(prefix="dove-pi-repair-") as temporary:
                    source, manifest = self._download_release(cached, Path(temporary))
                    prepared = self.transaction.prepare_source(source, manifest, verify=verify, force_rebuild=True)
                    state = self.transaction.activate(prepared, state, command="repair")
                    state = self._reconcile_components(state, reconcile_components, command="repair")
                write_managed_launchers(self.layout)
                self.transaction.prune(state)
                return _result("repair", True, state, f"Rebuilt Dove Pi {manifest.release_id} from the verified release cache.")
        # Do not hold the lock while delegating to update, which owns the same
        # transaction boundary and can rebuild from the stable release.
        return self.update(check=False, verify=verify, reconcile_components=reconcile_components)

    def rollback(self) -> MaintenanceResult:
        with MaintenanceLock(self.layout.lock_path, "rollback"):
            state = self.transaction.rollback(load_state(self.layout))
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
            self.layout.state_path.unlink(missing_ok=True)
        # Keep the now-empty state/root directories. Removing the lock and then
        # recursively deleting its parent would create a race in which another
        # maintenance process could acquire a fresh lock and have it deleted.
        return MaintenanceResult("uninstall", True, None, profile="max", message="Dove Pi managed application files were removed; user and project data were preserved.")

    def _download_release(self, asset: ReleaseAsset, temporary: Path) -> tuple[Path, ReleaseManifest]:
        cache_key = sha256(f"{asset.tag}\0{asset.version}".encode("utf-8")).hexdigest()[:16]
        cache = self.layout.cache_dir / cache_key
        cache.mkdir(parents=True, exist_ok=True)
        archive = cache / "dove-pi-windows.zip"
        checksum = cache / "dove-pi-windows.zip.sha256"
        try:
            verify_sha256(archive, read_expected_sha256(checksum))
        except (OSError, RuntimeError):
            download_file(asset.archive_url, archive)
            download_file(asset.checksum_url, checksum)
            verify_sha256(archive, read_expected_sha256(checksum))
        source, manifest = self._extract_release_root(archive, temporary / "extracted")
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
        descriptor = cache / "asset.json"
        descriptor_tmp = cache / f"asset.json.tmp-{os.getpid()}"
        descriptor_tmp.write_text(
            json.dumps({"tag": asset.tag, "version": asset.version, "releaseId": manifest.release_id}, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(descriptor_tmp, descriptor)
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
    ) -> None:
        expected = read_expected_sha256(checksum)
        verify_sha256(archive, expected)
        cache_key = sha256(f"{tag}\0{version}".encode("utf-8")).hexdigest()[:16]
        cache = self.layout.cache_dir / cache_key
        cache.mkdir(parents=True, exist_ok=True)
        for source, name in ((archive, "dove-pi-windows.zip"), (checksum, "dove-pi-windows.zip.sha256")):
            temporary = cache / f"{name}.tmp-{os.getpid()}"
            shutil.copy2(source, temporary)
            os.replace(temporary, cache / name)
        descriptor = cache / "asset.json"
        descriptor_tmp = cache / f"asset.json.tmp-{os.getpid()}"
        descriptor_tmp.write_text(
            json.dumps({"tag": tag, "version": version, "releaseId": release_id}, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(descriptor_tmp, descriptor)

    def _cached_asset(self, version: str | None) -> ReleaseAsset | None:
        if not version or not self.layout.cache_dir.is_dir():
            return None
        for descriptor in self.layout.cache_dir.glob("*/asset.json"):
            try:
                value = json.loads(descriptor.read_text(encoding="utf-8"))
                if not isinstance(value, dict) or value.get("version") != version or not isinstance(value.get("tag"), str):
                    continue
                archive = descriptor.parent / "dove-pi-windows.zip"
                checksum = descriptor.parent / "dove-pi-windows.zip.sha256"
                verify_sha256(archive, read_expected_sha256(checksum))
                release_id = value.get("releaseId")
                return ReleaseAsset(
                    value["tag"],
                    version,
                    archive.as_uri(),
                    checksum.as_uri(),
                    release_id=release_id if isinstance(release_id, str) else None,
                )
            except (OSError, RuntimeError, json.JSONDecodeError, UnicodeError):
                continue
        return None

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
