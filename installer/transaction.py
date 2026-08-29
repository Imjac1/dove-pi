from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Callable, Sequence
from uuid import uuid4

from .layout import ManagedLayout
from .release import ReleaseManifest
from .state import InstallState, ReleaseRef, write_state


class TransactionError(RuntimeError):
    def __init__(self, step: str, message: str) -> None:
        super().__init__(message)
        self.step = step


CommandRunner = Callable[[Sequence[str], Path], None]


def default_command_runner(command: Sequence[str], cwd: Path) -> None:
    # Maintenance commands reserve stdout for their final machine-readable
    # result. Keep dependency/test progress visible without allowing inherited
    # npm output to corrupt `--json` callers.
    subprocess.run(list(command), cwd=cwd, check=True, stdout=sys.stderr)


def _copy_ignore(_directory: str, names: list[str]) -> set[str]:
    ignored_names = {".git", ".trellis", ".dove", ".agent-data", "node_modules", "dist", "__pycache__"}
    return {name for name in names if name in ignored_names or name.endswith(".pyc")}


@dataclass(frozen=True)
class PreparedRelease:
    manifest: ReleaseManifest
    install_path: Path
    reused: bool = False


class ManagedTransaction:
    def __init__(self, layout: ManagedLayout, *, runner: CommandRunner = default_command_runner) -> None:
        self.layout = layout
        self.runner = runner

    def prepare_source(self, source: Path, manifest: ReleaseManifest, *, verify: str = "quick", force_rebuild: bool = False) -> PreparedRelease:
        source = source.resolve(strict=True)
        if not (source / "dove_pi.py").is_file() or not (source / "package.json").is_file():
            raise TransactionError("source", f"Dove Pi source is incomplete at {source}")
        self.layout.ensure_base_directories()
        target = self.layout.versions_dir / manifest.release_id
        if target.is_dir() and not force_rebuild and self._is_prepared(target, manifest):
            return PreparedRelease(manifest, target, True)
        if target.exists():
            target = self.layout.versions_dir / f"{manifest.release_id}-repair-{uuid4().hex[:8]}"
        staging = self.layout.staging_dir / f"{manifest.release_id}-{uuid4().hex[:8]}"
        self.layout.require_managed_path(staging, boundary=self.layout.staging_dir)
        try:
            shutil.copytree(source, staging, ignore=_copy_ignore)
            (staging / "release.json").write_text(json.dumps(manifest.to_json(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            npm = shutil.which("npm")
            if not npm:
                raise TransactionError("dependencies", "npm is required but was not found in PATH")
            self.runner([npm, "ci", "--no-audit", "--no-fund", "--loglevel=error"], staging)
            generated_path = staging / "release.generated.json"
            self.runner([
                npm,
                "run",
                "release:manifest",
                "--",
                str(generated_path),
                "--release-id",
                manifest.release_id,
                "--commit",
                manifest.commit or manifest.release_id,
            ], staging)
            generated = ReleaseManifest.read(generated_path)
            generated_path.unlink(missing_ok=True)
            if generated.version != manifest.version or generated.release_id != manifest.release_id:
                raise TransactionError("release", "Generated source release metadata does not match the prepared source release")
            if not manifest.components or not manifest.profiles:
                manifest = generated
                (staging / "release.json").write_text(json.dumps(manifest.to_json(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            elif generated.components != manifest.components or generated.profiles != manifest.profiles:
                raise TransactionError("release", "Packaged release metadata does not match the locked components and extension catalog")
            if verify != "none":
                self.runner([npm, "run", "typecheck"], staging)
                self.runner([npm, "run", "pi:smoke"], staging)
                if verify == "full":
                    self.runner([npm, "test"], staging)
            os.replace(staging, target)
            return PreparedRelease(manifest, target)
        except TransactionError:
            raise
        except (OSError, subprocess.CalledProcessError) as error:
            raise TransactionError("prepare", f"Unable to prepare Dove Pi {manifest.release_id}: {error}") from error
        finally:
            if staging.exists():
                shutil.rmtree(self.layout.require_managed_path(staging, boundary=self.layout.staging_dir), ignore_errors=True)

    def verify_existing(self, path: Path, *, verify: str = "quick") -> ReleaseManifest:
        path = self.layout.require_version_path(path)
        try:
            manifest = ReleaseManifest.read(path / "release.json")
            if not (path / "dove_pi.py").is_file() or not (path / "node_modules").is_dir():
                raise TransactionError("verify", f"Managed release is incomplete at {path}")
            if verify != "none":
                npm = shutil.which("npm")
                if not npm:
                    raise TransactionError("dependencies", "npm is required but was not found in PATH")
                self.runner([npm, "run", "typecheck"], path)
                self.runner([npm, "run", "pi:smoke"], path)
                if verify == "full":
                    self.runner([npm, "test"], path)
            return manifest
        except TransactionError:
            raise
        except (OSError, subprocess.CalledProcessError, RuntimeError) as error:
            raise TransactionError("verify", f"Unable to verify managed release at {path}: {error}") from error

    def activate(self, prepared: PreparedRelease, state: InstallState, *, command: str) -> InstallState:
        path = self.layout.require_version_path(prepared.install_path)
        if not self._is_prepared(path, prepared.manifest):
            raise TransactionError("activate", f"Prepared release failed validation at {path}")
        next_ref = ReleaseRef(prepared.manifest.release_id, path, prepared.manifest.version)
        previous = state.current if state.current and state.current.install_path != path else state.previous
        next_state = InstallState(
            current=next_ref,
            previous=previous,
            profile=state.profile,
            managed_extensions=list(state.managed_extensions),
            last_maintenance=dict(state.last_maintenance),
        )
        write_state(self.layout, next_state, command=command)
        return next_state

    def rollback(self, state: InstallState) -> InstallState:
        if not state.previous or not self._is_valid_ref(state.previous):
            raise TransactionError("rollback", "No valid previous Dove Pi release is available")
        next_state = InstallState(
            current=state.previous,
            previous=state.current,
            profile=state.profile,
            managed_extensions=list(state.managed_extensions),
            last_maintenance=dict(state.last_maintenance),
        )
        write_state(self.layout, next_state, command="rollback")
        return next_state

    def prune(self, state: InstallState) -> list[Path]:
        keep = {ref.install_path.resolve(strict=False) for ref in (state.current, state.previous) if ref}
        removed: list[Path] = []
        if not self.layout.versions_dir.exists():
            return removed
        for candidate in self.layout.versions_dir.iterdir():
            resolved = candidate.resolve(strict=False)
            if resolved in keep:
                continue
            self.layout.require_version_path(resolved)
            if candidate.is_dir():
                shutil.rmtree(resolved)
            else:
                candidate.unlink()
            removed.append(resolved)
        return removed

    def _is_valid_ref(self, reference: ReleaseRef) -> bool:
        try:
            self.layout.require_version_path(reference.install_path)
            installed = ReleaseManifest.read(reference.install_path / "release.json")
        except RuntimeError:
            return False
        return (
            installed.release_id == reference.release_id
            and (reference.install_path / "dove_pi.py").is_file()
            and (reference.install_path / "node_modules").is_dir()
        )

    @staticmethod
    def _is_prepared(path: Path, manifest: ReleaseManifest) -> bool:
        try:
            installed = ReleaseManifest.read(path / "release.json")
        except RuntimeError:
            return False
        return installed.release_id == manifest.release_id and (path / "dove_pi.py").is_file() and (path / "node_modules").is_dir()
