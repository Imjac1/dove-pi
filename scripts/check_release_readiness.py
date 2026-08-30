#!/usr/bin/env python3
"""Fail closed unless a Dove Pi GitHub Release bundle is internally consistent."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
from typing import Sequence
import zipfile


EXPECTED_ASSETS = {
    "dove-pi-windows.zip",
    "dove-pi-windows.zip.sha256",
    "install.ps1",
    "release.json",
}
EXPECTED_PROFILES = {"minimal", "dev", "research", "security", "max"}
REQUIRED_ARCHIVE_FILES = {
    "dove_pi.py",
    "package.json",
    "package-lock.json",
    "release.json",
    "installer/release.py",
    "src/cli.ts",
}
EXACT_VERSION = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")


def read_json(path: Path) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Unable to read JSON from {path}: {error}") from error
    if not isinstance(value, dict):
        raise RuntimeError(f"{path} must contain a JSON object")
    return value


def validate_manifest(source_root: Path, manifest_path: Path, tag: str, commit: str | None) -> dict[str, object]:
    package = read_json(source_root / "package.json")
    lock = read_json(source_root / "package-lock.json")
    manifest = read_json(manifest_path)
    version = package.get("version")
    if not isinstance(version, str) or not EXACT_VERSION.fullmatch(version):
        raise RuntimeError(f"package.json has an invalid release version: {version}")
    if tag != f"v{version}":
        raise RuntimeError(f"Release tag {tag or '<missing>'} does not match package.json version {version}")
    if manifest.get("schemaVersion") != 1 or manifest.get("version") != version:
        raise RuntimeError("release.json schema/version does not match package.json")
    release_id = manifest.get("releaseId")
    if not isinstance(release_id, str) or not release_id.startswith(f"{version}+"):
        raise RuntimeError("release.json releaseId does not identify the package version")
    if manifest.get("platform") != "windows":
        raise RuntimeError("release.json must target windows")
    if manifest.get("runtime") != {"python": ">=3.10", "node": ">=22.19.0"}:
        raise RuntimeError("release.json has an invalid Python/Node runtime contract")
    if commit and manifest.get("commit") != commit:
        raise RuntimeError(f"release.json commit {manifest.get('commit')} does not match {commit}")
    dove_extension = manifest.get("doveExtension")
    if dove_extension is not None:
        if not isinstance(dove_extension, dict) or dove_extension.get("extensionId") != "dove.personal-agent" or dove_extension.get("version") != version:
            raise RuntimeError("release.json has an invalid Dove extension identity")
        if not isinstance(dove_extension.get("implementationDigest"), str) or not dove_extension.get("implementationDigest"):
            raise RuntimeError("release.json is missing Dove extension implementationDigest")

    dependencies = package.get("dependencies")
    lock_packages = lock.get("packages")
    components = manifest.get("components")
    if not isinstance(dependencies, dict) or not isinstance(lock_packages, dict) or not isinstance(components, dict):
        raise RuntimeError("Package dependencies, lock packages, and release components must be objects")
    expected_components = {
        "pi": "@earendil-works/pi-coding-agent",
        "piTui": "@earendil-works/pi-tui",
        "trellis": "@mindfoldhq/trellis",
    }
    for component, dependency in expected_components.items():
        declared = dependencies.get(dependency)
        locked_entry = lock_packages.get(f"node_modules/{dependency}")
        locked = locked_entry.get("version") if isinstance(locked_entry, dict) else None
        if not isinstance(declared, str) or not EXACT_VERSION.fullmatch(declared):
            raise RuntimeError(f"{dependency} must use an exact publishable version")
        if locked != declared or components.get(component) != declared:
            raise RuntimeError(f"{dependency} package/lock/manifest versions do not match")
    profiles = manifest.get("profiles")
    if not isinstance(profiles, dict) or set(profiles) != EXPECTED_PROFILES:
        raise RuntimeError("release.json must contain exactly the supported extension profiles")
    if not all(isinstance(specs, list) and all(isinstance(spec, str) and spec for spec in specs) for specs in profiles.values()):
        raise RuntimeError("release.json has an invalid extension profile entry")
    return manifest


def validate_checksum(archive: Path, checksum: Path) -> None:
    try:
        expected = checksum.read_text(encoding="ascii").strip().split()[0].lower()
    except (OSError, UnicodeError, IndexError) as error:
        raise RuntimeError(f"Unable to read release checksum: {error}") from error
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise RuntimeError("Release checksum asset is invalid")
    digest = hashlib.sha256()
    try:
        with archive.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError as error:
        raise RuntimeError(f"Unable to read release archive: {error}") from error
    actual = digest.hexdigest()
    if actual != expected:
        raise RuntimeError(f"Release checksum mismatch: expected {expected}, got {actual}")


def validate_archive(archive: Path, expected_manifest: dict[str, object]) -> None:
    try:
        with zipfile.ZipFile(archive) as bundle:
            normalized_names = [
                entry.filename.replace("\\", "/").rstrip("/")
                for entry in bundle.infolist()
                if not entry.is_dir()
            ]
            if len(normalized_names) != len(set(normalized_names)):
                raise RuntimeError("Archive contains duplicate file entries")
            names = set(normalized_names)
            for name in names:
                path = PurePosixPath(name)
                if path.is_absolute() or name.startswith("//") or re.match(r"^[A-Za-z]:", name) or ".." in path.parts:
                    raise RuntimeError(f"Unsafe archive entry: {name}")
            roots: list[str] = []
            for name in names:
                if name == "release.json":
                    prefix = ""
                elif name.endswith("/release.json"):
                    prefix = name[: -len("release.json")]
                else:
                    continue
                if all(f"{prefix}{required}" in names for required in REQUIRED_ARCHIVE_FILES):
                    roots.append(prefix)
            if len(roots) != 1:
                raise RuntimeError("Archive must contain exactly one complete Dove Pi release root")
            embedded = json.loads(bundle.read(f"{roots[0]}release.json").decode("utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError, zipfile.BadZipFile, KeyError) as error:
        raise RuntimeError(f"Unable to validate release archive: {error}") from error
    if embedded != expected_manifest:
        raise RuntimeError("Archive release.json does not match the published release.json asset")


def validate_bootstrap(bootstrap: Path) -> None:
    try:
        source = bootstrap.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        raise RuntimeError(f"Unable to read bootstrap: {error}") from error
    if "releases/latest/download/" not in source or "release.json" not in source:
        raise RuntimeError("Bootstrap does not use the direct latest Release manifest")
    if "api.github.com" in source or "Invoke-RestMethod" in source:
        raise RuntimeError("Bootstrap must not depend on the GitHub REST release API")
    powershell = shutil.which("powershell.exe") or shutil.which("pwsh")
    if not powershell:
        raise RuntimeError("PowerShell is required to validate install.ps1 syntax")
    escaped = str(bootstrap.resolve()).replace("'", "''")
    command = (
        "$tokens=$null; $errors=$null; "
        f"[System.Management.Automation.Language.Parser]::ParseFile('{escaped}',[ref]$tokens,[ref]$errors)|Out-Null; "
        "if($errors.Count){$errors|ForEach-Object{Write-Error $_.ToString()};exit 1}"
    )
    completed = subprocess.run(
        [powershell, "-NoLogo", "-NoProfile", "-Command", command],
        text=True,
        capture_output=True,
        timeout=30,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"install.ps1 has syntax errors: {completed.stderr.strip()}")


def validate_asset_set(paths: Sequence[Path]) -> None:
    names = [path.name for path in paths]
    if len(names) != len(EXPECTED_ASSETS) or set(names) != EXPECTED_ASSETS:
        raise RuntimeError(f"Release assets must be exactly: {', '.join(sorted(EXPECTED_ASSETS))}")
    missing = [str(path) for path in paths if not path.is_file()]
    if missing:
        raise RuntimeError(f"Release assets are missing: {', '.join(missing)}")


def validate_clean_checkout(source_root: Path, generated_assets: Sequence[Path]) -> None:
    for arguments, description in (
        (["git", "diff", "--quiet", "--"], "unstaged tracked changes"),
        (["git", "diff", "--cached", "--quiet", "--"], "staged changes"),
    ):
        result = subprocess.run(arguments, cwd=source_root, check=False)
        if result.returncode == 1:
            raise RuntimeError(f"Refusing release readiness with {description}")
        if result.returncode != 0:
            raise RuntimeError(f"Unable to inspect Git checkout for {description}")
    completed = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard"],
        cwd=source_root,
        check=True,
        text=True,
        capture_output=True,
    )
    allowed = set()
    for path in generated_assets:
        try:
            allowed.add(path.resolve().relative_to(source_root.resolve()).as_posix())
        except ValueError:
            pass
    unexpected = [line for line in completed.stdout.splitlines() if line and line not in allowed]
    if unexpected:
        raise RuntimeError(f"Refusing release readiness with untracked files: {', '.join(unexpected[:5])}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=Path.cwd())
    parser.add_argument("--tag", default=os.environ.get("GITHUB_REF_NAME", ""))
    parser.add_argument("--commit", default=os.environ.get("GITHUB_SHA"))
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--checksum", type=Path, required=True)
    parser.add_argument("--bootstrap", type=Path, required=True)
    parser.add_argument("--asset", type=Path, action="append", required=True)
    parser.add_argument("--skip-clean-check", action="store_true", help=argparse.SUPPRESS)
    return parser


def main(arguments: Sequence[str] | None = None) -> int:
    options = build_parser().parse_args(arguments)
    source_root = options.source_root.resolve()
    commit = options.commit
    if not commit:
        try:
            commit = subprocess.check_output(
                ["git", "rev-parse", "HEAD"],
                cwd=source_root,
                text=True,
            ).strip()
        except (OSError, subprocess.CalledProcessError) as error:
            raise RuntimeError("Unable to resolve the release commit") from error
    assets = [path.resolve() for path in options.asset]
    validate_asset_set(assets)
    validated_assets = {
        options.archive.resolve(),
        options.checksum.resolve(),
        options.bootstrap.resolve(),
        options.manifest.resolve(),
    }
    if set(assets) != validated_assets:
        raise RuntimeError("The four validated files must be the same files passed to the publisher")
    if not options.skip_clean_check:
        validate_clean_checkout(source_root, [options.archive.resolve(), options.checksum.resolve()])
    manifest = validate_manifest(source_root, options.manifest.resolve(), options.tag, commit)
    validate_checksum(options.archive.resolve(), options.checksum.resolve())
    validate_archive(options.archive.resolve(), manifest)
    validate_bootstrap(options.bootstrap.resolve())
    print(f"Release ready: {options.tag} ({manifest['releaseId']}); assets={len(assets)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Release readiness failed: {error}", file=sys.stderr)
        raise SystemExit(1)
