from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
from pathlib import Path
import re
import shutil
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen
import zipfile

from .layout import is_path_within


GITHUB_RELEASE_BASE = "https://github.com/Imjac1/dove-pi/releases/latest/download/"
GITHUB_LATEST_MANIFEST = urljoin(GITHUB_RELEASE_BASE, "release.json")
# Kept as a compatibility import for callers that supplied the old constant.
# Its value is now the direct Release asset, never the GitHub REST endpoint.
GITHUB_LATEST_RELEASE = GITHUB_LATEST_MANIFEST
RELEASE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$")
VERSION_PATTERN = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")
EXPECTED_RUNTIME = {"python": ">=3.10", "node": ">=22.19.0"}
EXPECTED_COMPONENTS = {"pi", "piTui", "trellis"}
EXPECTED_PROFILES = {"minimal", "dev", "research", "security", "max"}


@dataclass(frozen=True)
class ReleaseManifest:
    version: str
    release_id: str
    commit: str = ""
    platform: str = "windows"
    runtime: dict[str, str] = field(default_factory=dict)
    components: dict[str, str] = field(default_factory=dict)
    profiles: dict[str, list[str]] = field(default_factory=dict)

    @classmethod
    def from_json(cls, value: object) -> "ReleaseManifest":
        if not isinstance(value, dict):
            raise RuntimeError("release.json must contain an object")
        try:
            schema = int(value.get("schemaVersion"))
        except (TypeError, ValueError) as error:
            raise RuntimeError("release.json has an invalid schemaVersion") from error
        if schema != 1:
            raise RuntimeError(f"Unsupported release manifest schema {schema}")
        version = value.get("version")
        release_id = value.get("releaseId")
        if not isinstance(version, str) or not version.strip():
            raise RuntimeError("release.json is missing version")
        if not isinstance(release_id, str) or not RELEASE_ID_PATTERN.fullmatch(release_id):
            raise RuntimeError("release.json has an unsafe releaseId")
        runtime = _string_map(value.get("runtime"))
        components = _string_map(value.get("components"))
        profiles: dict[str, list[str]] = {}
        raw_profiles = value.get("profiles")
        if isinstance(raw_profiles, dict):
            for name, specs in raw_profiles.items():
                if isinstance(name, str) and isinstance(specs, list) and all(isinstance(spec, str) and spec for spec in specs):
                    profiles[name] = list(specs)
        commit = value.get("commit")
        platform = value.get("platform")
        return cls(version.strip(), release_id, commit.strip() if isinstance(commit, str) else "", platform.strip() if isinstance(platform, str) and platform.strip() else "windows", runtime, components, profiles)

    @classmethod
    def read(cls, path: Path) -> "ReleaseManifest":
        try:
            return cls.from_json(json.loads(path.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError, UnicodeError) as error:
            raise RuntimeError(f"Unable to read release manifest at {path}: {error}") from error

    def to_json(self) -> dict[str, Any]:
        return {
            "schemaVersion": 1,
            "version": self.version,
            "releaseId": self.release_id,
            "commit": self.commit,
            "platform": self.platform,
            "runtime": self.runtime,
            "components": self.components,
            "profiles": self.profiles,
        }


def _string_map(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {str(key): item for key, item in value.items() if isinstance(key, str) and isinstance(item, str) and item}


def validate_stable_manifest(manifest: ReleaseManifest) -> None:
    if not VERSION_PATTERN.fullmatch(manifest.version):
        raise RuntimeError(f"release.json has an invalid version: {manifest.version}")
    if manifest.platform.lower() != "windows":
        raise RuntimeError(f"The latest Dove Pi release targets {manifest.platform}, not windows")
    if not manifest.release_id.startswith(f"{manifest.version}+"):
        raise RuntimeError(
            f"release.json releaseId {manifest.release_id} does not identify version {manifest.version}",
        )
    if manifest.runtime != EXPECTED_RUNTIME:
        raise RuntimeError("release.json has an invalid Python/Node runtime contract")
    if set(manifest.components) != EXPECTED_COMPONENTS:
        raise RuntimeError("release.json must contain exactly the Pi, Pi TUI, and Trellis components")
    if set(manifest.profiles) != EXPECTED_PROFILES:
        raise RuntimeError("release.json must contain exactly the supported extension profiles")


@dataclass(frozen=True)
class ReleaseAsset:
    tag: str
    version: str
    archive_url: str
    checksum_url: str
    manifest_url: str | None = None
    release_id: str | None = None
    manifest: ReleaseManifest | None = None


def _read_json_url(url: str) -> tuple[object, str]:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "dove-pi-installer"})
    try:
        with urlopen(request, timeout=30) as response:
            value = json.loads(response.read().decode("utf-8"))
            final_url = response.geturl() if hasattr(response, "geturl") else url
            return value, final_url if isinstance(final_url, str) and final_url else url
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, UnicodeError) as error:
        raise RuntimeError(f"Unable to read Dove Pi release metadata from GitHub: {error}") from error


def _release_tag_from_asset_url(url: str) -> str | None:
    parts = [unquote(part) for part in urlsplit(url).path.split("/") if part]
    for index in range(len(parts) - 3):
        if parts[index:index + 2] == ["releases", "download"] and parts[index + 3] == "release.json":
            return parts[index + 2]
    return None


def fetch_latest_release(url: str = GITHUB_LATEST_MANIFEST) -> ReleaseAsset:
    value, final_manifest_url = _read_json_url(url)
    manifest = ReleaseManifest.from_json(value)
    validate_stable_manifest(manifest)
    expected_tag = f"v{manifest.version}"
    resolved_tag = _release_tag_from_asset_url(final_manifest_url)
    if resolved_tag is not None and resolved_tag != expected_tag:
        raise RuntimeError(
            f"Release tag {resolved_tag} does not match release.json version {manifest.version}",
        )
    archive_name = "dove-pi-windows.zip"
    checksum_name = f"{archive_name}.sha256"
    # GitHub commonly follows the release redirect all the way to a signed
    # objects.githubusercontent.com URL. Sibling filenames under that object
    # URL are not release assets, so only derive a tag-specific base when the
    # resolved URL still has GitHub's canonical release path. Otherwise retain
    # the original latest/download channel; embedded manifest identity catches
    # a latest-release change between metadata and archive requests.
    asset_base = final_manifest_url if resolved_tag is not None else url
    return ReleaseAsset(
        expected_tag,
        manifest.version,
        urljoin(asset_base, archive_name),
        urljoin(asset_base, checksum_name),
        final_manifest_url,
        manifest.release_id,
        manifest,
    )


def download_file(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = Request(url, headers={"User-Agent": "dove-pi-installer"})
    temporary = destination.with_name(destination.name + ".part")
    try:
        with urlopen(request, timeout=60) as response, temporary.open("wb") as handle:
            shutil.copyfileobj(response, handle)
        temporary.replace(destination)
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"Unable to download {url}: {error}") from error


def read_expected_sha256(path: Path) -> str:
    try:
        token = path.read_text(encoding="utf-8").strip().split()[0].lower()
    except (OSError, UnicodeError, IndexError) as error:
        raise RuntimeError(f"Unable to read SHA-256 file {path}: {error}") from error
    if not re.fullmatch(r"[0-9a-f]{64}", token):
        raise RuntimeError(f"Invalid SHA-256 value in {path}")
    return token


def verify_sha256(path: Path, expected: str) -> None:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    actual = digest.hexdigest()
    if actual.lower() != expected.lower():
        raise RuntimeError(f"SHA-256 mismatch for {path.name}: expected {expected}, got {actual}")


def safe_extract_zip(archive: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve(strict=False)
    try:
        with zipfile.ZipFile(archive) as bundle:
            for item in bundle.infolist():
                target = (root / item.filename).resolve(strict=False)
                if not is_path_within(target, root):
                    raise RuntimeError(f"Unsafe archive entry escapes staging: {item.filename}")
            bundle.extractall(root)
    except zipfile.BadZipFile as error:
        raise RuntimeError(f"Invalid Dove Pi release archive {archive}: {error}") from error
