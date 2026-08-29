from __future__ import annotations

from contextlib import AbstractContextManager
import ctypes
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time


class MaintenanceLockedError(RuntimeError):
    pass


def _pid_is_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        # On Windows, os.kill(pid, 0) sends CTRL_C_EVENT instead of performing
        # the POSIX-style existence probe. Query a limited process handle so a
        # maintenance-lock check can never interrupt the owner it is observing.
        process_query_limited_information = 0x1000
        still_active = 259
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(process_query_limited_information, False, pid)
        if not handle:
            # Access denied means the process exists but is outside our query
            # rights; keep the lock rather than risking concurrent mutation.
            return ctypes.get_last_error() == 5
        try:
            exit_code = ctypes.c_ulong()
            if not kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
                return True
            return exit_code.value == still_active
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except PermissionError:
        return True
    except (OSError, ProcessLookupError):
        return False


class MaintenanceLock(AbstractContextManager["MaintenanceLock"]):
    def __init__(self, path: Path, command: str, *, pid: int | None = None) -> None:
        self.path = path
        self.command = command
        self.pid = pid or os.getpid()
        self.acquired = False

    def _read_owner(self) -> dict[str, object]:
        try:
            value = json.loads(self.path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
        except (OSError, json.JSONDecodeError, UnicodeError):
            return {}

    def acquire(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps({
            "pid": self.pid,
            "command": self.command,
            "startedAt": datetime.now(timezone.utc).isoformat(),
        }, ensure_ascii=False)
        for attempt in range(2):
            try:
                descriptor = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                    handle.write(payload + "\n")
                self.acquired = True
                return
            except FileExistsError:
                owner = self._read_owner()
                owner_pid = owner.get("pid")
                if isinstance(owner_pid, int) and _pid_is_alive(owner_pid):
                    owner_command = owner.get("command") or "unknown"
                    raise MaintenanceLockedError(f"Dove Pi maintenance is already running (PID {owner_pid}, command {owner_command}).")
                if not isinstance(owner_pid, int):
                    raise MaintenanceLockedError(
                        f"Dove Pi maintenance lock metadata is unreadable at {self.path}. "
                        "If no maintenance command is running, move this file aside and retry."
                    )
                if attempt:
                    break
                stale = self.path.with_name(f"maintenance.stale-{int(time.time())}-{os.getpid()}.json")
                try:
                    os.replace(self.path, stale)
                except OSError as error:
                    raise MaintenanceLockedError(f"Unable to recover stale maintenance lock at {self.path}: {error}") from error
        raise MaintenanceLockedError(f"Unable to acquire Dove Pi maintenance lock at {self.path}.")

    def release(self) -> None:
        if not self.acquired:
            return
        try:
            owner = self._read_owner()
            if owner.get("pid") == self.pid:
                self.path.unlink(missing_ok=True)
        finally:
            self.acquired = False

    def __enter__(self) -> "MaintenanceLock":
        self.acquire()
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.release()
