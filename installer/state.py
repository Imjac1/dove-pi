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
    path = Path(install_path).expanduser().resolve(strict=False)
    if not is_path_within(path, layout.versions_dir) or path == layout.versions_dir.resolve(strict=False):
        return None
    return ReleaseRef(release_id.strip(), path, version.strip() if isinstance(version, str) else "")


def _parse_extensions(value: object) -> list[ManagedExtensionState]:
    if not isinstance(value, list):
        return []
    result: list[ManagedExtensionState] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        identity = entry.get("identity")
        spec = entry.get("spec")
        status = entry.get("status")
        error = entry.get("error")
        if not isinstance(identity, str) or not identity or not isinstance(spec, str) or not spec:
            continue
        result.append(ManagedExtensionState(identity, spec, status if isinstance(status, str) and status else "unknown", error if isinstance(error, str) and error else None))
    return result


def load_state(layout: ManagedLayout) -> InstallState:
    try:
        parsed = json.loads(layout.state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeError):
        return InstallState()
    if not isinstance(parsed, dict):
        return InstallState()
    schema = parsed.get("schemaVersion")
    try:
        if int(schema) != STATE_SCHEMA_VERSION:
            return InstallState()
    except (TypeError, ValueError):
        return InstallState()
    profile = parsed.get("profile")
    if not isinstance(profile, str) or profile not in PROFILES:
        profile = "max"
    maintenance = parsed.get("lastMaintenance")
    normalized_maintenance = {str(key): str(value) for key, value in maintenance.items() if isinstance(key, str) and isinstance(value, (str, int, float, bool))} if isinstance(maintenance, dict) else {}
    return InstallState(
        current=_parse_release_ref(parsed.get("current"), layout),
        previous=_parse_release_ref(parsed.get("previous"), layout),
        profile=profile,
        managed_extensions=_parse_extensions(parsed.get("managedExtensions")),
        last_maintenance=normalized_maintenance,
    )


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
    temporary.write_text(payload, encoding="utf-8")
    os.replace(temporary, layout.state_path)
