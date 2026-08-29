from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
from pathlib import Path
import re
import shutil
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import zipfile

from .layout import is_path_within


GITHUB_LATEST_RELEASE = "https://api.github.com/repos/Imjac1/dove-pi/releases/latest"
RELEASE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$")


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


@dataclass(frozen=True)
class ReleaseAsset:
    tag: str
    version: str
    archive_url: str
    checksum_url: str
    manifest_url: str | None = None


def _read_json_url(url: str) -> object:
    request = Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "dove-pi-installer"})
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, UnicodeError) as error:
        raise RuntimeError(f"Unable to read Dove Pi release metadata from GitHub: {error}") from error


def fetch_latest_release(url: str = GITHUB_LATEST_RELEASE) -> ReleaseAsset:
    value = _read_json_url(url)
    if not isinstance(value, dict):
        raise RuntimeError("GitHub returned invalid Dove Pi release metadata")
    tag = value.get("tag_name")
    if not isinstance(tag, str) or not tag:
        raise RuntimeError("The latest Dove Pi release has no tag")
    assets = value.get("assets")
    if not isinstance(assets, list):
        raise RuntimeError("The latest Dove Pi release has no assets")
    by_name: dict[str, str] = {}
    for asset in assets:
        if isinstance(asset, dict) and isinstance(asset.get("name"), str) and isinstance(asset.get("browser_download_url"), str):
            by_name[asset["name"]] = asset["browser_download_url"]
    archive_name = "dove-pi-windows.zip"
    checksum_name = f"{archive_name}.sha256"
    if archive_name not in by_name or checksum_name not in by_name:
        raise RuntimeError(f"Release {tag} is missing {archive_name} or its SHA-256 asset")
    return ReleaseAsset(tag, tag.removeprefix("v"), by_name[archive_name], by_name[checksum_name], by_name.get("release.json"))


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
