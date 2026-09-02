from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any

from .layout import ManagedLayout, is_path_within


STATE_SCHEMA_VERSION = 2
PROFILES = {"minimal", "dev", "research", "security", "max"}
STATE_BACKUP_NAME = "install.json.bak"


class StateLoadError(RuntimeError):
    """Raised when an existing managed state cannot be trusted."""


def _write_durable(path: Path, payload: bytes) -> None:
    with path.open("wb") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


@dataclass(frozen=True)
class ReleaseRef:
    release_id: str
    install_path: Path
    version: str = ""

    def to_json(self) -> dict[str, str]:
        return {
            "releaseId": self.release_id,
            "installPath": str(self.install_path),
            **({"version": self.version} if self.version else {}),
        }


@dataclass(frozen=True)
class ManagedExtensionState:
    identity: str
    spec: str
    status: str = "healthy"
    error: str | None = None

    def to_json(self) -> dict[str, str]:
        return {
            "identity": self.identity,
            "spec": self.spec,
            "status": self.status,
            **({"error": self.error} if self.error else {}),
        }


@dataclass
class InstallState:
    current: ReleaseRef | None = None
    previous: ReleaseRef | None = None
    profile: str = "max"
    managed_extensions: list[ManagedExtensionState] = field(default_factory=list)
    last_maintenance: dict[str, str] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return {
            "schemaVersion": STATE_SCHEMA_VERSION,
            "current": self.current.to_json() if self.current else None,
            "previous": self.previous.to_json() if self.previous else None,
            "profile": self.profile,
            "managedExtensions": [entry.to_json() for entry in self.managed_extensions],
            "lastMaintenance": self.last_maintenance,
        }


def _parse_release_ref(value: object, layout: ManagedLayout) -> ReleaseRef | None:
    if not isinstance(value, dict):
        return None
    release_id = value.get("releaseId")
    install_path = value.get("installPath")
    version = value.get("version")
    if not isinstance(release_id, str) or not release_id.strip() or not isinstance(install_path, str):
        return None
    if version is not None and not isinstance(version, str):
        return None
    path = Path(install_path).expanduser().resolve(strict=False)
    if not is_path_within(path, layout.versions_dir) or path == layout.versions_dir.resolve(strict=False):
        return None
    return ReleaseRef(release_id.strip(), path, version.strip() if isinstance(version, str) else "")


def _parse_extensions(value: object, *, source: Path) -> list[ManagedExtensionState]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise StateLoadError(f"Managed Dove Pi state at {source} has invalid managedExtensions; run 'dove-pi repair'.")
    result: list[ManagedExtensionState] = []
    for entry in value:
        if not isinstance(entry, dict):
            raise StateLoadError(f"Managed Dove Pi state at {source} has an invalid managed extension entry; run 'dove-pi repair'.")
        identity = entry.get("identity")
        spec = entry.get("spec")
        status = entry.get("status")
        error = entry.get("error")
        if not isinstance(identity, str) or not identity.strip() or not isinstance(spec, str) or not spec.strip():
            raise StateLoadError(f"Managed Dove Pi state at {source} has an incomplete managed extension entry; run 'dove-pi repair'.")
        if status is not None and (not isinstance(status, str) or not status.strip()):
            raise StateLoadError(f"Managed Dove Pi state at {source} has an invalid managed extension status; run 'dove-pi repair'.")
        if error is not None and not isinstance(error, str):
            raise StateLoadError(f"Managed Dove Pi state at {source} has an invalid managed extension error; run 'dove-pi repair'.")
        result.append(ManagedExtensionState(identity.strip(), spec.strip(), status.strip() if isinstance(status, str) else "unknown", error if isinstance(error, str) and error else None))
    return result


def _parse_state(parsed: object, layout: ManagedLayout, *, source: Path) -> InstallState:
    if not isinstance(parsed, dict):
        raise StateLoadError(f"Managed Dove Pi state at {source} is not a JSON object")
    schema = parsed.get("schemaVersion")
    try:
        if int(schema) != STATE_SCHEMA_VERSION:
            raise StateLoadError(
                f"Managed Dove Pi state at {source} uses unsupported schema {schema}; run 'dove-pi repair'.",
            )
    except (TypeError, ValueError) as error:
        raise StateLoadError(f"Managed Dove Pi state at {source} has an invalid schemaVersion; run 'dove-pi repair'.") from error
    profile = parsed.get("profile")
    if profile is None:
        profile = "max"
    elif not isinstance(profile, str) or profile not in PROFILES:
        raise StateLoadError(f"Managed Dove Pi state at {source} has an invalid profile; run 'dove-pi repair'.")
    current_value = parsed.get("current")
    previous_value = parsed.get("previous")
    current = _parse_release_ref(current_value, layout)
    previous = _parse_release_ref(previous_value, layout)
    if current_value is not None and current is None:
        raise StateLoadError(f"Managed Dove Pi state at {source} has an invalid current release; run 'dove-pi repair'.")
    if previous_value is not None and previous is None:
        raise StateLoadError(f"Managed Dove Pi state at {source} has an invalid previous release; run 'dove-pi repair'.")
    if current and previous and current.install_path == previous.install_path:
        raise StateLoadError(f"Managed Dove Pi state at {source} points current and previous to the same release; run 'dove-pi repair'.")
    if current and previous and current.release_id == previous.release_id:
        raise StateLoadError(f"Managed Dove Pi state at {source} duplicates the current release identity as previous; run 'dove-pi repair'.")
    maintenance = parsed.get("lastMaintenance")
    if maintenance is not None and not isinstance(maintenance, dict):
        raise StateLoadError(f"Managed Dove Pi state at {source} has invalid lastMaintenance; run 'dove-pi repair'.")
    normalized_maintenance = {str(key): str(value) for key, value in maintenance.items() if isinstance(key, str) and isinstance(value, (str, int, float, bool))} if isinstance(maintenance, dict) else {}
    if isinstance(maintenance, dict) and len(normalized_maintenance) != len(maintenance):
        raise StateLoadError(f"Managed Dove Pi state at {source} has invalid lastMaintenance values; run 'dove-pi repair'.")
    return InstallState(
        current=current,
        previous=previous,
        profile=profile,
        managed_extensions=_parse_extensions(parsed.get("managedExtensions"), source=source),
        last_maintenance=normalized_maintenance,
    )


def load_state(layout: ManagedLayout, *, strict: bool = False) -> InstallState:
    if not layout.state_path.exists():
        return InstallState()
    try:
        parsed = json.loads(layout.state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeError) as error:
        if strict:
            raise StateLoadError(f"Managed Dove Pi state at {layout.state_path} is unreadable; run 'dove-pi repair'.") from error
        return InstallState()
    try:
        return _parse_state(parsed, layout, source=layout.state_path)
    except StateLoadError:
        if strict:
            raise
        return InstallState()


def load_state_backup(layout: ManagedLayout) -> InstallState | None:
    backup = layout.state_dir / STATE_BACKUP_NAME
    if not backup.is_file():
        return None
    try:
        parsed = json.loads(backup.read_text(encoding="utf-8"))
        return _parse_state(parsed, layout, source=backup)
    except (OSError, json.JSONDecodeError, UnicodeError, StateLoadError):
        return None


def write_state(layout: ManagedLayout, state: InstallState, *, command: str | None = None, status: str = "ready") -> None:
    layout.state_dir.mkdir(parents=True, exist_ok=True)
    if command:
        state.last_maintenance = {
            "command": command,
            "status": status,
            "at": datetime.now(timezone.utc).isoformat(),
        }
    payload = json.dumps(state.to_json(), indent=2, ensure_ascii=False) + "\n"
    temporary = layout.state_dir / f"install.json.tmp-{os.getpid()}"
    _write_durable(temporary, payload.encode("utf-8"))
    if layout.state_path.is_file():
        try:
            existing = json.loads(layout.state_path.read_text(encoding="utf-8"))
            _parse_state(existing, layout, source=layout.state_path)
        except (OSError, json.JSONDecodeError, UnicodeError, StateLoadError):
            corrupt = layout.state_dir / f"install.json.corrupt-{os.getpid()}"
            os.replace(layout.state_path, corrupt)
        else:
            backup_temporary = layout.state_dir / f"{STATE_BACKUP_NAME}.tmp-{os.getpid()}"
            _write_durable(backup_temporary, layout.state_path.read_bytes())
            os.replace(backup_temporary, layout.state_dir / STATE_BACKUP_NAME)
    os.replace(temporary, layout.state_path)
