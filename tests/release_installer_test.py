import json
import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from urllib.error import URLError
import zipfile

from installer.release import (
    GITHUB_LATEST_MANIFEST,
    ReleaseAsset,
    ReleaseManifest,
    download_file,
    fetch_latest_release,
)
from installer.layout import ManagedLayout
from installer.manager import ManagedInstaller
from installer.transaction import TransactionError


def release_manifest(*, version="0.3.0", release_id="0.3.0+abcdef0", platform="windows"):
    return {
        "schemaVersion": 1,
        "version": version,
        "releaseId": release_id,
        "commit": "abcdef0",
        "platform": platform,
        "runtime": {"python": ">=3.10", "node": ">=22.19.0"},
        "components": {"pi": "0.84.3", "piTui": "0.84.3"},
        "profiles": {name: [] for name in ("minimal", "dev", "research", "security", "max")},
    }


class FakeResponse:
    def __init__(self, value, final_url):
        self.payload = json.dumps(value).encode("utf-8")
        self.final_url = final_url

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.payload

    def geturl(self):
        return self.final_url


class DirectReleaseDiscoveryTests(unittest.TestCase):
    def test_manifest_first_discovery_never_calls_github_rest(self):
        final_url = "https://github.com/Imjac1/dove-pi/releases/download/v0.3.0/release.json"

        def open_direct(request, timeout):
            self.assertEqual(timeout, 30)
            self.assertEqual(request.full_url, GITHUB_LATEST_MANIFEST)
            self.assertNotIn("api.github.com", request.full_url)
            return FakeResponse(release_manifest(), final_url)

        with patch("installer.release.urlopen", side_effect=open_direct) as open_url:
            asset = fetch_latest_release()

        open_url.assert_called_once()
        self.assertEqual(asset.tag, "v0.3.0")
        self.assertEqual(asset.version, "0.3.0")
        self.assertEqual(asset.manifest, ReleaseManifest.from_json(release_manifest()))
        self.assertEqual(
            asset.archive_url,
            "https://github.com/Imjac1/dove-pi/releases/download/v0.3.0/dove-pi-windows.zip",
        )
        self.assertEqual(
            asset.checksum_url,
            "https://github.com/Imjac1/dove-pi/releases/download/v0.3.0/dove-pi-windows.zip.sha256",
        )

    def test_redirect_tag_must_match_manifest_version(self):
        final_url = "https://github.com/Imjac1/dove-pi/releases/download/v0.2.0/release.json"
        with patch("installer.release._read_json_url", return_value=(release_manifest(), final_url)):
            with self.assertRaisesRegex(RuntimeError, "does not match"):
                fetch_latest_release()

    def test_object_storage_redirect_keeps_latest_download_asset_urls(self):
        final_url = "https://release-assets.githubusercontent.com/github-production-release-asset/release.json?sig=secret"
        with patch("installer.release._read_json_url", return_value=(release_manifest(), final_url)):
            asset = fetch_latest_release()
        self.assertEqual(
            asset.archive_url,
            "https://github.com/Imjac1/dove-pi/releases/latest/download/dove-pi-windows.zip",
        )
        self.assertEqual(
            asset.checksum_url,
            "https://github.com/Imjac1/dove-pi/releases/latest/download/dove-pi-windows.zip.sha256",
        )

    def test_malformed_manifest_fails_before_asset_download(self):
        with patch(
            "installer.release._read_json_url",
            return_value=({"schemaVersion": 1, "version": "0.3.0"}, GITHUB_LATEST_MANIFEST),
        ):
            with self.assertRaisesRegex(RuntimeError, "releaseId"):
                fetch_latest_release()

    def test_incomplete_stable_manifest_is_rejected(self):
        value = release_manifest()
        value["profiles"] = {"max": []}
        with patch("installer.release._read_json_url", return_value=(value, GITHUB_LATEST_MANIFEST)):
            with self.assertRaisesRegex(RuntimeError, "supported extension profiles"):
                fetch_latest_release()

    def test_release_identity_must_include_the_advertised_version(self):
        value = release_manifest(release_id="other+abcdef0")
        with patch("installer.release._read_json_url", return_value=(value, GITHUB_LATEST_MANIFEST)):
            with self.assertRaisesRegex(RuntimeError, "does not identify version"):
                fetch_latest_release()

    def test_missing_direct_asset_is_actionable(self):
        with TemporaryDirectory() as temporary:
            destination = Path(temporary) / "dove-pi-windows.zip"
            with patch("installer.release.urlopen", side_effect=URLError("asset missing")):
                with self.assertRaisesRegex(RuntimeError, "Unable to download"):
                    download_file(
                        "https://github.com/Imjac1/dove-pi/releases/download/v0.3.0/dove-pi-windows.zip",
                        destination,
                    )
            self.assertFalse(destination.exists())
            self.assertFalse(destination.with_name(destination.name + ".part").exists())

    def test_bootstrap_tag_mismatch_fails_before_preparing_dependencies(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "release"
            source.mkdir()
            installer = ManagedInstaller(ManagedLayout.at(root / "DovePi"))
            asset = (root / "archive.zip", root / "archive.zip.sha256", "v0.2.0")
            with patch(
                "installer.manager.source_release_manifest",
                return_value=ReleaseManifest("0.3.0", "0.3.0+abcdef0"),
            ), patch.object(installer.transaction, "prepare_source") as prepare:
                with self.assertRaisesRegex(TransactionError, "does not match archive version"):
                    installer.install_source(source, verify="none", source_asset=asset)
            prepare.assert_not_called()

    def test_bootstrap_checksum_fails_before_preparing_dependencies(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "release"
            source.mkdir()
            archive = root / "archive.zip"
            checksum = root / "archive.zip.sha256"
            archive.write_bytes(b"tampered")
            checksum.write_text("0" * 64, encoding="ascii")
            installer = ManagedInstaller(ManagedLayout.at(root / "DovePi"))
            with patch(
                "installer.manager.source_release_manifest",
                return_value=ReleaseManifest("0.3.0", "0.3.0+abcdef0"),
            ), patch.object(installer.transaction, "prepare_source") as prepare:
                with self.assertRaisesRegex(RuntimeError, "SHA-256 mismatch"):
                    installer.install_source(
                        source,
                        verify="none",
                        source_asset=(archive, checksum, "v0.3.0"),
                    )
            prepare.assert_not_called()

    def test_archive_release_id_must_match_direct_manifest_identity(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = root / "dove-pi-windows.zip"
            manifest = ReleaseManifest("0.3.0", "0.3.0+archive")
            with zipfile.ZipFile(archive, "w") as bundle:
                bundle.writestr("dove_pi.py", "print('ok')\n")
                bundle.writestr("release.json", json.dumps(manifest.to_json()))
            checksum = root / "dove-pi-windows.zip.sha256"
            checksum.write_text(hashlib.sha256(archive.read_bytes()).hexdigest(), encoding="ascii")
            installer = ManagedInstaller(ManagedLayout.at(root / "DovePi"))
            release_asset = ReleaseAsset(
                "v0.3.0",
                "0.3.0",
                archive.as_uri(),
                checksum.as_uri(),
                release_id="0.3.0+manifest",
            )
            with self.assertRaisesRegex(TransactionError, "metadata mismatch"):
                installer._download_release(release_asset, root / "temporary")

    def test_archive_manifest_must_fully_match_direct_manifest(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = root / "dove-pi-windows.zip"
            embedded = ReleaseManifest(
                "0.3.0",
                "0.3.0+manifest",
                commit="abcdef0",
                components={"pi": "0.84.2"},
                profiles={"max": []},
            )
            advertised = ReleaseManifest(
                "0.3.0",
                "0.3.0+manifest",
                commit="abcdef0",
                components={"pi": "0.84.3"},
                profiles={"max": []},
            )
            with zipfile.ZipFile(archive, "w") as bundle:
                bundle.writestr("dove_pi.py", "print('ok')\n")
                bundle.writestr("release.json", json.dumps(embedded.to_json()))
            checksum = root / "dove-pi-windows.zip.sha256"
            checksum.write_text(hashlib.sha256(archive.read_bytes()).hexdigest(), encoding="ascii")
            installer = ManagedInstaller(ManagedLayout.at(root / "DovePi"))
            release_asset = ReleaseAsset(
                "v0.3.0",
                "0.3.0",
                archive.as_uri(),
                checksum.as_uri(),
                release_id=advertised.release_id,
                manifest=advertised,
            )
            with self.assertRaisesRegex(TransactionError, "metadata mismatch"):
                installer._download_release(release_asset, root / "temporary")


if __name__ == "__main__":
    unittest.main()
