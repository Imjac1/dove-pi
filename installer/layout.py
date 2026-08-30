from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path


def _normalized(path: Path) -> str:
    return os.path.normcase(str(path.resolve(strict=False)))


def is_path_within(path: Path, parent: Path) -> bool:
    """Return whether *path* resolves below *parent* (or equals it)."""
    candidate = _normalized(path)
    boundary = _normalized(parent)
    try:
        return os.path.commonpath((candidate, boundary)) == boundary
    except ValueError:
        return False


def _deletion_path(path: Path) -> str:
    """Return a Windows extended-length path for recursive managed deletion."""
    value = str(path)
    if os.name != "nt" or value.startswith("\\\\?\\"):
        return value
    if value.startswith("\\\\"):
        return "\\\\?\\UNC\\" + value[2:]
    return "\\\\?\\" + value


@dataclass(frozen=True)
class ManagedLayout:
    root: Path

    @classmethod
    def default(cls) -> "ManagedLayout":
        override = os.environ.get("DOVE_PI_HOME")
        if override:
            return cls(Path(override).expanduser().resolve(strict=False))
        if os.name == "nt":
            local_app_data = os.environ.get("LOCALAPPDATA")
            if not local_app_data:
                raise RuntimeError("LOCALAPPDATA is unavailable; set DOVE_PI_HOME to an explicit managed install directory.")
            return cls((Path(local_app_data) / "DovePi").resolve(strict=False))
        return cls((Path.home() / ".local" / "share" / "dove-pi").resolve(strict=False))

    @classmethod
    def at(cls, root: Path | str) -> "ManagedLayout":
        return cls(Path(root).expanduser().resolve(strict=False))

    @property
    def bin_dir(self) -> Path:
        return self.root / "bin"

    @property
    def versions_dir(self) -> Path:
        return self.root / "app" / "versions"

    @property
    def cache_dir(self) -> Path:
        return self.root / "cache" / "releases"

    @property
    def staging_dir(self) -> Path:
        return self.root / "staging"

    @property
    def state_dir(self) -> Path:
        return self.root / "state"

    @property
    def state_path(self) -> Path:
        return self.state_dir / "install.json"

    @property
    def lock_path(self) -> Path:
        return self.state_dir / "maintenance.lock"

    @property
    def logs_dir(self) -> Path:
        return self.root / "logs"

    def ensure_base_directories(self) -> None:
        for directory in (self.bin_dir, self.versions_dir, self.cache_dir, self.staging_dir, self.state_dir, self.logs_dir):
            directory.mkdir(parents=True, exist_ok=True)

    def require_managed_path(self, path: Path, *, boundary: Path | None = None) -> Path:
        resolved = path.resolve(strict=False)
        parent = (boundary or self.root).resolve(strict=False)
        if resolved == parent or not is_path_within(resolved, parent):
            raise RuntimeError(f"Refusing to modify path outside the managed boundary: {resolved}")
        return resolved

    def require_version_path(self, path: Path) -> Path:
        return self.require_managed_path(path, boundary=self.versions_dir)
