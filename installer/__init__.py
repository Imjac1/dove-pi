"""Transactional managed-install primitives for Dove Pi."""

from .layout import ManagedLayout, is_path_within
from .lock import MaintenanceLock, MaintenanceLockedError
from .manager import MaintenanceResult, ManagedInstaller, source_release_manifest, write_managed_launchers
from .release import ReleaseAsset, ReleaseManifest, fetch_latest_release, safe_extract_zip
from .state import InstallState, ManagedExtensionState, ReleaseRef, load_state, write_state
from .transaction import ManagedTransaction, TransactionError

__all__ = [
    "InstallState",
    "MaintenanceLock",
    "MaintenanceLockedError",
    "MaintenanceResult",
    "ManagedExtensionState",
    "ManagedLayout",
    "ManagedInstaller",
    "ManagedTransaction",
    "ReleaseAsset",
    "ReleaseManifest",
    "ReleaseRef",
    "TransactionError",
    "fetch_latest_release",
    "is_path_within",
    "load_state",
    "safe_extract_zip",
    "source_release_manifest",
    "write_managed_launchers",
    "write_state",
]
