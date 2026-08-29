import contextlib
import hashlib
import io
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest
import warnings
import zipfile

from scripts.check_release_readiness import (
    EXPECTED_ASSETS,
    main,
    validate_asset_set,
    validate_clean_checkout,
    validate_checksum,
    validate_archive,
)


ROOT = Path(__file__).resolve().parents[1]


def write_fixture(root: Path):
    dependencies = {
        "@earendil-works/pi-coding-agent": "0.84.3",
        "@earendil-works/pi-tui": "0.84.3",
        "@mindfoldhq/trellis": "0.6.16",
    }
    (root / "package.json").write_text(
        json.dumps({"version": "0.3.0", "dependencies": dependencies}),
        encoding="utf-8",
    )
    (root / "package-lock.json").write_text(
        json.dumps(
            {
                "packages": {
                    f"node_modules/{name}": {"version": version}
                    for name, version in dependencies.items()
                },
            }
        ),
        encoding="utf-8",
    )
    manifest = {
        "schemaVersion": 1,
        "version": "0.3.0",
        "releaseId": "0.3.0+abcdef0",
        "commit": "abcdef012345",
        "platform": "windows",
        "runtime": {"python": ">=3.10", "node": ">=22.19.0"},
        "components": {"pi": "0.84.3", "piTui": "0.84.3", "trellis": "0.6.16"},
        "profiles": {name: [] for name in ("minimal", "dev", "research", "security", "max")},
    }
    manifest_path = root / "release.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    archive = root / "dove-pi-windows.zip"
    with zipfile.ZipFile(archive, "w") as bundle:
        for name in (
            "dove_pi.py",
            "package.json",
            "package-lock.json",
            "installer/release.py",
            "src/cli.ts",
        ):
            bundle.writestr(name, "fixture\n")
        bundle.writestr("release.json", json.dumps(manifest))
    checksum = root / "dove-pi-windows.zip.sha256"
    checksum.write_text(
        f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  dove-pi-windows.zip\n",
        encoding="ascii",
    )
    return manifest_path, archive, checksum


class ReleaseReadinessTests(unittest.TestCase):
    def test_complete_release_bundle_passes(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest, archive, checksum = write_fixture(root)
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                result = main(
                    [
                        "--source-root", str(root),
                        "--tag", "v0.3.0",
                        "--commit", "abcdef012345",
                        "--manifest", str(manifest),
                        "--archive", str(archive),
                        "--checksum", str(checksum),
                        "--bootstrap", str(ROOT / "install.ps1"),
                        "--asset", str(archive),
                        "--asset", str(checksum),
                        "--asset", str(ROOT / "install.ps1"),
                        "--asset", str(manifest),
                        "--skip-clean-check",
                    ]
                )
            self.assertEqual(result, 0)
            self.assertIn("assets=4", output.getvalue())

    def test_checksum_mismatch_is_rejected(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            _manifest, archive, checksum = write_fixture(root)
            archive.write_bytes(archive.read_bytes() + b"corrupt")
            with self.assertRaisesRegex(RuntimeError, "checksum mismatch"):
                validate_checksum(archive, checksum)

    def test_asset_set_must_be_exact(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = [root / name for name in sorted(EXPECTED_ASSETS - {"release.json"})]
            with self.assertRaisesRegex(RuntimeError, "exactly"):
                validate_asset_set(paths)

    def test_unsafe_or_duplicate_archive_entries_are_rejected(self):
        for entry, expected in (("C:/outside.txt", "Unsafe"), ("duplicate.txt", "duplicate")):
            with self.subTest(entry=entry), TemporaryDirectory() as temporary:
                root = Path(temporary)
                manifest, archive, _checksum = write_fixture(root)
                expected_manifest = json.loads(manifest.read_text(encoding="utf-8"))
                mode = "a"
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", UserWarning)
                    with zipfile.ZipFile(archive, mode) as bundle:
                        bundle.writestr(entry, "first")
                        if entry == "duplicate.txt":
                            bundle.writestr(entry, "second")
                with self.assertRaisesRegex(RuntimeError, expected):
                    validate_archive(archive, expected_manifest)

    def test_release_workflow_runs_readiness_after_gates_before_publish(self):
        workflow = (ROOT / ".github" / "workflows" / "release.yml").read_text(encoding="utf-8")
        readiness = workflow.index("Verify release readiness")
        publish = workflow.index("softprops/action-gh-release@v2")
        self.assertGreater(readiness, workflow.index("npm run test:installer"))
        self.assertGreater(readiness, workflow.index("npm run doctor"))
        self.assertGreater(readiness, workflow.index("npm run pi:smoke"))
        self.assertLess(readiness, publish)

    def test_dirty_checkout_is_rejected(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            subprocess.run(["git", "init", "--quiet"], cwd=root, check=True)
            subprocess.run(["git", "config", "user.email", "fixture@example.invalid"], cwd=root, check=True)
            subprocess.run(["git", "config", "user.name", "Fixture"], cwd=root, check=True)
            tracked = root / "tracked.txt"
            tracked.write_text("clean\n", encoding="utf-8")
            subprocess.run(["git", "add", "tracked.txt"], cwd=root, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "fixture"], cwd=root, check=True)
            tracked.write_text("dirty\n", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "unstaged tracked changes"):
                validate_clean_checkout(root, [])


if __name__ == "__main__":
    unittest.main()
