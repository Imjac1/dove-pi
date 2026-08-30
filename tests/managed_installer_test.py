import json
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import zipfile

from installer.layout import ManagedLayout, _deletion_path, is_path_within
from installer.lock import MaintenanceLock, MaintenanceLockedError
from installer.manager import ManagedInstaller, source_release_manifest, write_managed_launchers
from installer.release import ReleaseAsset, ReleaseManifest, safe_extract_zip
from installer.state import InstallState, ManagedExtensionState, ReleaseRef, load_state, write_state
from installer.transaction import ManagedTransaction, TransactionError


def complete_manifest(version: str, release_id: str, commit: str, *, pi_version: str = "0.84.3") -> ReleaseManifest:
    return ReleaseManifest(
        version,
        release_id,
        commit,
        components={"pi": pi_version, "piTui": pi_version, "trellis": "0.6.16"},
        runtime={"python": ">=3.10", "node": ">=22.19.0"},
        profiles={
            "minimal": [],
            "dev": [],
            "research": [],
            "security": [],
            "max": ["npm:example-extension@1.0.0"],
        },
    )


def write_long_windows_marker(root: Path) -> tuple[Path, str]:
    nested = root
    for index in range(7):
        nested /= f"package-{index}-" + ("x" * 32)
    marker = nested / "installed-package.js"
    extended_marker = _deletion_path(marker.resolve(strict=False))
    os.makedirs(os.path.dirname(extended_marker), exist_ok=True)
    with open(extended_marker, "w", encoding="utf-8") as stream:
        stream.write("managed")
    if len(str(marker.resolve(strict=False))) <= 260:
        raise AssertionError("Windows long-path fixture must exceed legacy MAX_PATH")
    return marker, extended_marker


def write_installed_components(root: Path, components: dict[str, str]) -> None:
    package_names = {
        "pi": "@earendil-works/pi-coding-agent",
        "piTui": "@earendil-works/pi-tui",
        "trellis": "@mindfoldhq/trellis",
    }
    for component, package_name in package_names.items():
        package_path = root / "node_modules" / Path(*package_name.split("/"))
        package_path.mkdir(parents=True, exist_ok=True)
        (package_path / "package.json").write_text(
            json.dumps({"name": package_name, "version": components[component]}),
            encoding="utf-8",
        )


def make_source(root: Path, release_id: str = "0.2.0+abcdef0") -> tuple[Path, ReleaseManifest]:
    source = root / "source"
    source.mkdir()
    (source / "dove_pi.py").write_text("print('ok')\n", encoding="utf-8")
    (source / "package.json").write_text('{"name":"dove-pi","version":"0.2.0"}\n', encoding="utf-8")
    (source / "package-lock.json").write_text('{"lockfileVersion":3}\n', encoding="utf-8")
    manifest = complete_manifest("0.2.0", release_id, "abcdef0")
    return source, manifest


def successful_runner(command, cwd: Path) -> None:
    if "ci" in command:
        (cwd / "node_modules").mkdir(exist_ok=True)
        package = json.loads((cwd / "package.json").read_text(encoding="utf-8"))
        dependencies = package.get("dependencies") if isinstance(package, dict) else None
        pi_version = dependencies.get("@earendil-works/pi-coding-agent", "0.84.3") if isinstance(dependencies, dict) else "0.84.3"
        write_installed_components(cwd, {
            "pi": pi_version,
            "piTui": dependencies.get("@earendil-works/pi-tui", pi_version) if isinstance(dependencies, dict) else pi_version,
            "trellis": dependencies.get("@mindfoldhq/trellis", "0.6.16") if isinstance(dependencies, dict) else "0.6.16",
        })
    if "release:manifest" in command:
        destination = Path(command[command.index("--") + 1])
        release_id = command[command.index("--release-id") + 1]
        commit = command[command.index("--commit") + 1]
        package = json.loads((cwd / "package.json").read_text(encoding="utf-8"))
        dependencies = package.get("dependencies") if isinstance(package, dict) else None
        pi_version = dependencies.get("@earendil-works/pi-coding-agent", "0.84.3") if isinstance(dependencies, dict) else "0.84.3"
        destination.write_text(
            json.dumps(complete_manifest(package["version"], release_id, commit, pi_version=pi_version).to_json()),
            encoding="utf-8",
        )


class ManagedLayoutTests(unittest.TestCase):
    def test_path_boundary_rejects_sibling_prefix(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary) / "DovePi"
            self.assertTrue(is_path_within(root / "app", root))
            self.assertFalse(is_path_within(Path(f"{root}-other") / "app", root))

    def test_version_boundary_rejects_root_and_outside(self):
        with TemporaryDirectory() as temporary:
            layout = ManagedLayout.at(Path(temporary) / "DovePi")
            layout.ensure_base_directories()
            with self.assertRaises(RuntimeError):
                layout.require_version_path(layout.versions_dir)
            with self.assertRaises(RuntimeError):
                layout.require_version_path(Path(temporary) / "outside")


class ManagedStateTests(unittest.TestCase):
    def test_state_roundtrip_and_invalid_path_filter(self):
        with TemporaryDirectory() as temporary:
            layout = ManagedLayout.at(Path(temporary) / "DovePi")
            layout.ensure_base_directories()
            current_path = layout.versions_dir / "one"
            state = InstallState(current=ReleaseRef("one", current_path, "1.0.0"), profile="dev")
            write_state(layout, state, command="install")
            loaded = load_state(layout)
            self.assertEqual(loaded.current.release_id, "one")
            self.assertEqual(loaded.profile, "dev")
            payload = json.loads(layout.state_path.read_text(encoding="utf-8"))
            payload["current"]["installPath"] = str(Path(temporary) / "outside")
            layout.state_path.write_text(json.dumps(payload), encoding="utf-8")
            self.assertIsNone(load_state(layout).current)

    def test_invalid_state_schema_falls_back(self):
        with TemporaryDirectory() as temporary:
            layout = ManagedLayout.at(Path(temporary) / "DovePi")
            layout.ensure_base_directories()
            layout.state_path.write_text('{"schemaVersion":"broken","profile":"dev"}', encoding="utf-8")
            loaded = load_state(layout)
            self.assertIsNone(loaded.current)
            self.assertEqual(loaded.profile, "max")


class MaintenanceLockTests(unittest.TestCase):
    def test_live_lock_is_not_overwritten(self):
        with TemporaryDirectory() as temporary:
            path = Path(temporary) / "maintenance.lock"
            with MaintenanceLock(path, "first"):
                with self.assertRaises(MaintenanceLockedError):
                    MaintenanceLock(path, "second").acquire()
            self.assertFalse(path.exists())

    def test_dead_lock_is_rotated(self):
        with TemporaryDirectory() as temporary:
            path = Path(temporary) / "maintenance.lock"
            path.write_text('{"pid":99999999,"command":"old"}', encoding="utf-8")
            with patch("installer.lock._pid_is_alive", return_value=False):
                with MaintenanceLock(path, "new"):
                    self.assertTrue(path.exists())
            self.assertTrue(any(Path(temporary).glob("maintenance.stale-*.json")))

    def test_unreadable_lock_fails_closed(self):
        with TemporaryDirectory() as temporary:
            path = Path(temporary) / "maintenance.lock"
            path.write_text("", encoding="utf-8")
            with self.assertRaisesRegex(MaintenanceLockedError, "metadata is unreadable"):
                MaintenanceLock(path, "new").acquire()
            self.assertTrue(path.exists())

    def test_separate_process_cannot_take_live_lock(self):
        with TemporaryDirectory() as temporary:
            path = Path(temporary) / "maintenance.lock"
            program = (
                "from pathlib import Path\n"
                "import sys\n"
                "from installer.lock import MaintenanceLock\n"
                "with MaintenanceLock(Path(sys.argv[1]), 'child'):\n"
                " print('ready', flush=True)\n"
                " sys.stdin.readline()\n"
            )
            child = subprocess.Popen(
                [sys.executable, "-c", program, str(path)],
                cwd=Path(__file__).resolve().parents[1],
                text=True,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            try:
                self.assertEqual(child.stdout.readline().strip(), "ready")
                with self.assertRaises(MaintenanceLockedError):
                    MaintenanceLock(path, "parent").acquire()
            finally:
                _stdout, stderr = child.communicate("\n", timeout=10)
            self.assertEqual(child.returncode, 0, stderr)


class ManagedTransactionTests(unittest.TestCase):
    def test_prepare_activate_and_rollback(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, first_manifest = make_source(root, "0.2.0+abcdef0")
            transaction = ManagedTransaction(layout, runner=successful_runner)
            first = transaction.prepare_source(source, first_manifest, verify="quick")
            state = transaction.activate(first, InstallState(profile="max"), command="install")
            self.assertEqual(state.current.release_id, first_manifest.release_id)
            (source / "new.txt").write_text("next", encoding="utf-8")
            (source / "package.json").write_text('{"name":"dove-pi","version":"0.3.0"}\n', encoding="utf-8")
            second_manifest = complete_manifest("0.3.0", "0.3.0+1234567", "1234567")
            second = transaction.prepare_source(source, second_manifest, verify="none")
            state = transaction.activate(second, state, command="update")
            self.assertEqual(state.previous.release_id, first_manifest.release_id)
            state = transaction.rollback(state)
            self.assertEqual(state.current.release_id, first_manifest.release_id)

    def test_prepare_failure_does_not_change_current_state(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, manifest = make_source(root)
            current_path = layout.versions_dir / "existing"
            current_path.mkdir(parents=True)
            state = InstallState(current=ReleaseRef("existing", current_path))
            write_state(layout, state, command="install")

            def failing_runner(_command, _cwd):
                raise OSError("injected failure")

            with self.assertRaises(TransactionError):
                ManagedTransaction(layout, runner=failing_runner).prepare_source(source, manifest)
            loaded = load_state(layout)
            self.assertEqual(loaded.current.release_id, "existing")

    @unittest.skipUnless(os.name == "nt", "Windows extended-length path regression")
    def test_prepare_failure_cleans_long_staging_paths(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, manifest = make_source(root)

            def failing_runner(command, cwd):
                if "ci" in command:
                    write_long_windows_marker(cwd / "node_modules")
                    raise OSError("injected failure after dependency extraction")
                successful_runner(command, cwd)

            with self.assertRaises(TransactionError):
                ManagedTransaction(layout, runner=failing_runner).prepare_source(source, manifest)

            self.assertFalse(any(layout.staging_dir.iterdir()))

    def test_prepare_rejects_an_installed_pi_version_that_differs_from_the_manifest(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, manifest = make_source(root)

            def mismatched_pi_runner(command, cwd: Path) -> None:
                successful_runner(command, cwd)
                if "ci" in command:
                    package = cwd / "node_modules" / "@earendil-works" / "pi-coding-agent" / "package.json"
                    package.write_text(json.dumps({"version": "0.83.0"}), encoding="utf-8")

            transaction = ManagedTransaction(layout, runner=mismatched_pi_runner)
            with self.assertRaisesRegex(TransactionError, "Installed pi version 0.83.0 does not match release manifest 0.84.3") as raised:
                transaction.prepare_source(source, manifest, verify="none")
            self.assertEqual(raised.exception.step, "dependencies")
            self.assertFalse(any(layout.versions_dir.glob("*")))

    def test_existing_healthy_release_is_reused(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, manifest = make_source(root)
            calls = []

            def runner(command, cwd):
                calls.append(list(command))
                successful_runner(command, cwd)

            transaction = ManagedTransaction(layout, runner=runner)
            transaction.prepare_source(source, manifest, verify="none")
            first_call_count = len(calls)
            reused = transaction.prepare_source(source, manifest, verify="full")
            self.assertTrue(reused.reused)
            self.assertEqual(len(calls), first_call_count)

    @unittest.skipUnless(os.name == "nt", "Windows extended-length path regression")
    def test_prune_removes_old_release_paths_beyond_legacy_max_path(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            old_release = layout.versions_dir / "old"
            _marker, extended_marker = write_long_windows_marker(old_release / "node_modules")

            removed = ManagedTransaction(layout).prune(InstallState())

            self.assertEqual(removed, [old_release.resolve(strict=False)])
            self.assertFalse(os.path.exists(extended_marker))

    def test_dependency_and_verification_failures_keep_current_state(self):
        for failing_token in ("ci", "typecheck", "pi:smoke"):
            with self.subTest(step=failing_token), TemporaryDirectory() as temporary:
                root = Path(temporary)
                layout = ManagedLayout.at(root / "DovePi")
                source, manifest = make_source(root)
                current = layout.versions_dir / "current"
                current.mkdir(parents=True)
                write_state(layout, InstallState(current=ReleaseRef("current", current, "0.1.0")), command="install")

                def runner(command, cwd):
                    successful_runner(command, cwd)
                    if failing_token in command:
                        raise OSError(f"injected {failing_token} failure")

                with self.assertRaises(TransactionError):
                    ManagedTransaction(layout, runner=runner).prepare_source(source, manifest, verify="quick")
                self.assertEqual(load_state(layout).current.release_id, "current")

    def test_activation_write_failure_preserves_old_state(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, manifest = make_source(root)
            current = layout.versions_dir / "current"
            current.mkdir(parents=True)
            write_state(layout, InstallState(current=ReleaseRef("current", current, "0.1.0")), command="install")
            transaction = ManagedTransaction(layout, runner=successful_runner)
            prepared = transaction.prepare_source(source, manifest, verify="none")
            with patch("installer.transaction.write_state", side_effect=OSError("injected activation failure")):
                with self.assertRaises(OSError):
                    transaction.activate(prepared, load_state(layout), command="update")
            self.assertEqual(load_state(layout).current.release_id, "current")


class ManagedInstallerCommandTests(unittest.TestCase):
    def test_source_install_does_not_modify_checkout_and_writes_state_launcher(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, _manifest = make_source(root)
            before = {path.relative_to(source): path.read_bytes() for path in source.rglob("*") if path.is_file()}
            installer = ManagedInstaller(layout)
            installer.transaction = ManagedTransaction(layout, runner=successful_runner)
            result = installer.install_source(source, profile="security", verify="none")
            after = {path.relative_to(source): path.read_bytes() for path in source.rglob("*") if path.is_file()}
            self.assertEqual(before, after)
            self.assertTrue(result.changed)
            self.assertEqual(result.profile, "security")
            state = load_state(layout)
            self.assertIsNotNone(state.current)
            self.assertTrue((layout.bin_dir / "dove-pi.cmd").is_file())
            self.assertTrue((layout.bin_dir / "dove-pi.ps1").is_file())
            self.assertNotIn(str(source), (layout.bin_dir / "dove-pi.ps1").read_text(encoding="utf-8-sig"))

    def test_source_install_hydrates_manifest_and_reconciles_components_under_lock(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, _manifest = make_source(root)
            installer = ManagedInstaller(layout)
            installer.transaction = ManagedTransaction(layout, runner=successful_runner)
            observed = {}

            def reconcile(state):
                observed["profiles"] = ReleaseManifest.read(state.current.install_path / "release.json").profiles
                with self.assertRaises(MaintenanceLockedError):
                    MaintenanceLock(layout.lock_path, "competing").acquire()
                return [ManagedExtensionState("npm:example-extension", "npm:example-extension@1.0.0")]

            installer.install_source(source, verify="none", reconcile_components=reconcile)
            state = load_state(layout)
            self.assertIn("max", observed["profiles"])
            self.assertEqual(state.managed_extensions[0].identity, "npm:example-extension")

    def test_source_install_caches_verified_bootstrap_asset_for_offline_repair(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, manifest = make_source(root)
            (source / "release.json").write_text(json.dumps(manifest.to_json()), encoding="utf-8")
            archive = root / "dove-pi-windows.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                for path in source.rglob("*"):
                    if path.is_file():
                        bundle.write(path, path.relative_to(source))
            checksum = root / "dove-pi-windows.zip.sha256"
            checksum.write_text(hashlib.sha256(archive.read_bytes()).hexdigest(), encoding="ascii")
            installer = ManagedInstaller(layout)
            installer.transaction = ManagedTransaction(layout, runner=successful_runner)
            installer.install_source(
                source,
                verify="none",
                source_asset=(archive, checksum, "v0.2.0"),
            )
            cached = installer._cached_asset(manifest.version)
            self.assertIsNotNone(cached)
            self.assertTrue(cached.archive_url.startswith("file:"))
            shutil.rmtree(load_state(layout).current.install_path / "node_modules")
            installer.fetch_release = lambda: (_ for _ in ()).throw(RuntimeError("network unavailable"))
            repaired = installer.repair(verify="none")
            self.assertTrue(repaired.changed)
            self.assertTrue((load_state(layout).current.install_path / "node_modules").is_dir())

    def test_source_manifest_changes_when_source_changes(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            source, _manifest = make_source(root)
            first = source_release_manifest(source)
            (source / "dove_pi.py").write_text("print('changed')\n", encoding="utf-8")
            second = source_release_manifest(source)
            self.assertNotEqual(first.release_id, second.release_id)

    def test_managed_launcher_contains_state_boundary_not_checkout_path(self):
        with TemporaryDirectory() as temporary:
            layout = ManagedLayout.at(Path(temporary) / "DovePi")
            write_managed_launchers(layout, python=Path("C:/Python/python.exe"))
            script = (layout.bin_dir / "dove-pi.ps1").read_text(encoding="utf-8-sig")
            self.assertIn("state\\install.json", script)
            self.assertIn("app\\versions", script)
            self.assertIn("StartsWith", script)

    @unittest.skipUnless(os.name == "nt" and shutil.which("powershell.exe"), "Windows PowerShell launcher test")
    def test_managed_launcher_falls_back_when_current_directory_is_incomplete(self):
        with TemporaryDirectory() as temporary:
            layout = ManagedLayout.at(Path(temporary) / "DovePi")
            current = layout.versions_dir / "current"
            previous = layout.versions_dir / "previous"
            current.mkdir(parents=True)
            previous.mkdir(parents=True)
            (current / "dove_pi.py").write_text("print('current')\n", encoding="utf-8")
            (previous / "dove_pi.py").write_text("print('previous')\n", encoding="utf-8")
            (previous / "release.json").write_text(json.dumps(ReleaseManifest("0.1.0", "previous").to_json()), encoding="utf-8")
            (previous / "node_modules").mkdir()
            write_state(
                layout,
                InstallState(current=ReleaseRef("current", current, "0.2.0"), previous=ReleaseRef("previous", previous, "0.1.0")),
                command="install",
            )
            write_managed_launchers(layout, python=Path(sys.executable))
            completed = subprocess.run(
                ["powershell.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(layout.bin_dir / "dove-pi.ps1")],
                text=True,
                capture_output=True,
                timeout=20,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn("previous", completed.stdout)
            self.assertIn("using previous", f"{completed.stdout}\n{completed.stderr}".lower())

    def test_update_from_release_asset_and_noop_check(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            release_root = root / "release-source"
            release_root.mkdir()
            (release_root / "dove_pi.py").write_text("print('release')\n", encoding="utf-8")
            (release_root / "package.json").write_text('{"name":"dove-pi","version":"0.3.0"}\n', encoding="utf-8")
            (release_root / "package-lock.json").write_text('{"lockfileVersion":3}\n', encoding="utf-8")
            manifest = complete_manifest("0.3.0", "0.3.0+7654321", "7654321")
            (release_root / "release.json").write_text(json.dumps(manifest.to_json()), encoding="utf-8")
            archive = root / "dove-pi-windows.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                for path in release_root.rglob("*"):
                    if path.is_file():
                        bundle.write(path, path.relative_to(release_root))
            checksum = root / "dove-pi-windows.zip.sha256"
            checksum.write_text(f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  dove-pi-windows.zip\n", encoding="ascii")
            asset = ReleaseAsset("v0.3.0", "0.3.0", archive.as_uri(), checksum.as_uri())
            installer = ManagedInstaller(layout, fetch_release=lambda: asset)
            installer.transaction = ManagedTransaction(layout, runner=successful_runner)
            result = installer.update(verify="none")
            self.assertTrue(result.changed)
            self.assertEqual(load_state(layout).current.release_id, manifest.release_id)
            check = installer.update(check=True)
            self.assertFalse(check.changed)
            shutil.rmtree(load_state(layout).current.install_path / "node_modules")
            installer.fetch_release = lambda: (_ for _ in ()).throw(RuntimeError("network unavailable"))
            repaired = installer.repair(verify="none")
            self.assertTrue(repaired.changed)
            self.assertTrue((load_state(layout).current.install_path / "node_modules").is_dir())

    def test_update_atomically_switches_to_the_release_locked_pi_version(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, _manifest = make_source(root)
            installer = ManagedInstaller(layout)
            installer.transaction = ManagedTransaction(layout, runner=successful_runner)
            installed = installer.install_source(source, verify="none")
            self.assertEqual(installed.current_pi_version, "0.84.3")

            release_root = root / "release-with-new-pi"
            release_root.mkdir()
            (release_root / "dove_pi.py").write_text("print('release')\n", encoding="utf-8")
            (release_root / "package.json").write_text(
                json.dumps({
                    "name": "dove-pi",
                    "version": "0.3.0",
                    "dependencies": {"@earendil-works/pi-coding-agent": "0.85.0"},
                }) + "\n",
                encoding="utf-8",
            )
            (release_root / "package-lock.json").write_text('{"lockfileVersion":3}\n', encoding="utf-8")
            manifest = complete_manifest("0.3.0", "0.3.0+newpi00", "newpi00", pi_version="0.85.0")
            (release_root / "release.json").write_text(json.dumps(manifest.to_json()), encoding="utf-8")
            archive = root / "dove-pi-new-pi.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                for path in release_root.rglob("*"):
                    if path.is_file():
                        bundle.write(path, path.relative_to(release_root))
            checksum = root / "dove-pi-new-pi.zip.sha256"
            checksum.write_text(hashlib.sha256(archive.read_bytes()).hexdigest(), encoding="ascii")
            asset = ReleaseAsset(
                "v0.3.0",
                "0.3.0",
                archive.as_uri(),
                checksum.as_uri(),
                release_id=manifest.release_id,
                manifest=manifest,
            )
            installer.fetch_release = lambda: asset

            check = installer.update(check=True)
            self.assertTrue(check.to_json()["piUpdateAvailable"])
            self.assertEqual(check.latest_pi_version, "0.85.0")
            result = installer.update(verify="none")

            state = load_state(layout)
            self.assertEqual(result.current_pi_version, "0.85.0")
            self.assertEqual(result.previous_pi_version, "0.84.3")
            self.assertEqual(result.latest_pi_version, "0.85.0")
            self.assertTrue(result.to_json()["piChanged"])
            self.assertEqual(ReleaseManifest.read(state.current.install_path / "release.json").components["pi"], "0.85.0")
            self.assertEqual(ReleaseManifest.read(state.previous.install_path / "release.json").components["pi"], "0.84.3")
            installed_pi = json.loads((state.current.install_path / "node_modules" / "@earendil-works" / "pi-coding-agent" / "package.json").read_text(encoding="utf-8"))
            self.assertEqual(installed_pi["version"], "0.85.0")

    def test_update_check_reads_remote_metadata_without_writing_managed_state(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, _manifest = make_source(root)
            installer = ManagedInstaller(layout)
            installer.transaction = ManagedTransaction(layout, runner=successful_runner)
            installer.install_source(source, profile="max", verify="none")
            current = load_state(layout).current
            self.assertIsNotNone(current)
            manifest = ReleaseManifest.read(current.install_path / "release.json")
            before = {
                path.relative_to(layout.root).as_posix(): path.read_bytes()
                for path in layout.root.rglob("*")
                if path.is_file()
            }
            asset = ReleaseAsset(
                f"v{manifest.version}",
                manifest.version,
                "https://invalid.example/archive",
                "https://invalid.example/checksum",
                release_id=manifest.release_id,
                manifest=manifest,
            )
            installer.fetch_release = lambda: asset

            result = installer.update(check=True, verify="full")

            after = {
                path.relative_to(layout.root).as_posix(): path.read_bytes()
                for path in layout.root.rglob("*")
                if path.is_file()
            }
            self.assertFalse(result.changed)
            self.assertEqual(after, before)
            self.assertFalse(layout.lock_path.exists())

    def test_isolated_install_noop_update_new_update_rollback_and_offline_repair(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, _manifest = make_source(root)
            installer = ManagedInstaller(layout)
            installer.transaction = ManagedTransaction(layout, runner=successful_runner)

            installed = installer.install_source(source, profile="max", verify="none")
            first = load_state(layout).current
            self.assertTrue(installed.changed)
            self.assertEqual(first.version, "0.2.0")

            installer.fetch_release = lambda: ReleaseAsset(
                "v0.2.0",
                "0.2.0",
                "https://invalid.example/archive",
                "https://invalid.example/checksum",
            )
            with patch("installer.manager.download_file") as download:
                unchanged = installer.update(verify="full")
            self.assertFalse(unchanged.changed)
            download.assert_not_called()

            release_root = root / "release-0.3.0"
            release_root.mkdir()
            (release_root / "dove_pi.py").write_text("print('release')\n", encoding="utf-8")
            (release_root / "package.json").write_text('{"name":"dove-pi","version":"0.3.0"}\n', encoding="utf-8")
            (release_root / "package-lock.json").write_text('{"lockfileVersion":3}\n', encoding="utf-8")
            next_manifest = complete_manifest("0.3.0", "0.3.0+7654321", "7654321")
            (release_root / "release.json").write_text(json.dumps(next_manifest.to_json()), encoding="utf-8")
            archive = root / "dove-pi-windows.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                for path in release_root.rglob("*"):
                    if path.is_file():
                        bundle.write(path, path.relative_to(release_root))
            checksum = root / "dove-pi-windows.zip.sha256"
            checksum.write_text(
                f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  dove-pi-windows.zip\n",
                encoding="ascii",
            )
            installer.fetch_release = lambda: ReleaseAsset(
                "v0.3.0",
                "0.3.0",
                archive.as_uri(),
                checksum.as_uri(),
                release_id=next_manifest.release_id,
            )
            updated = installer.update(verify="none")
            self.assertTrue(updated.changed)
            self.assertEqual(load_state(layout).current.release_id, next_manifest.release_id)

            installer.rollback()
            rolled_back = load_state(layout)
            self.assertEqual(rolled_back.current.release_id, first.release_id)
            shutil.rmtree(rolled_back.current.install_path / "node_modules")
            installer.fetch_release = lambda: (_ for _ in ()).throw(RuntimeError("simulated GitHub REST 403"))
            repaired = installer.repair(verify="none")
            self.assertTrue(repaired.changed)
            self.assertEqual(load_state(layout).current.release_id, next_manifest.release_id)

    def test_same_version_update_does_not_download_or_run_npm(self):
        with TemporaryDirectory() as temporary:
            layout = ManagedLayout.at(Path(temporary) / "DovePi")
            current = layout.versions_dir / "0.3.0+current"
            current.mkdir(parents=True)
            (current / "dove_pi.py").write_text("print('ok')\n", encoding="utf-8")
            (current / "release.json").write_text(json.dumps(ReleaseManifest("0.3.0", "0.3.0+current").to_json()), encoding="utf-8")
            (current / "node_modules").mkdir()
            write_state(layout, InstallState(current=ReleaseRef("0.3.0+current", current, "0.3.0")), command="install")
            asset = ReleaseAsset(
                "v0.3.0",
                "0.3.0",
                "https://invalid.example/archive",
                "https://invalid.example/checksum",
                release_id="0.3.0+current",
            )
            installer = ManagedInstaller(layout, fetch_release=lambda: asset)
            installer.transaction = ManagedTransaction(layout, runner=lambda *_args: self.fail("npm must not run for a no-op update"))
            with patch("installer.manager.download_file") as download:
                result = installer.update(verify="full")
            self.assertFalse(result.changed)
            download.assert_not_called()

    def test_same_version_different_release_identity_is_not_a_noop(self):
        with TemporaryDirectory() as temporary:
            layout = ManagedLayout.at(Path(temporary) / "DovePi")
            current = layout.versions_dir / "0.3.0+source"
            current.mkdir(parents=True)
            (current / "dove_pi.py").write_text("print('ok')\n", encoding="utf-8")
            (current / "release.json").write_text(
                json.dumps(ReleaseManifest("0.3.0", "0.3.0+source").to_json()),
                encoding="utf-8",
            )
            (current / "node_modules").mkdir()
            write_state(
                layout,
                InstallState(current=ReleaseRef("0.3.0+source", current, "0.3.0")),
                command="install",
            )
            asset = ReleaseAsset(
                "v0.3.0",
                "0.3.0",
                "https://invalid.example/archive",
                "https://invalid.example/checksum",
                release_id="0.3.0+stable",
            )
            installer = ManagedInstaller(layout, fetch_release=lambda: asset)
            self.assertTrue(installer.update(check=True).changed)
            with patch.object(installer, "_download_release", side_effect=RuntimeError("download attempted")) as download:
                with self.assertRaisesRegex(RuntimeError, "download attempted"):
                    installer.update(verify="none")
            download.assert_called_once()

    def test_same_identity_but_changed_manifest_is_not_a_noop(self):
        with TemporaryDirectory() as temporary:
            layout = ManagedLayout.at(Path(temporary) / "DovePi")
            current = layout.versions_dir / "0.3.0+stable"
            current.mkdir(parents=True)
            installed = ReleaseManifest(
                "0.3.0",
                "0.3.0+stable",
                components={"pi": "0.84.2"},
                profiles={"max": []},
            )
            advertised = ReleaseManifest(
                "0.3.0",
                "0.3.0+stable",
                components={"pi": "0.84.3"},
                profiles={"max": []},
            )
            (current / "dove_pi.py").write_text("print('ok')\n", encoding="utf-8")
            (current / "release.json").write_text(json.dumps(installed.to_json()), encoding="utf-8")
            (current / "node_modules").mkdir()
            write_state(
                layout,
                InstallState(current=ReleaseRef(installed.release_id, current, installed.version)),
                command="install",
            )
            asset = ReleaseAsset(
                "v0.3.0",
                "0.3.0",
                "https://invalid.example/archive",
                "https://invalid.example/checksum",
                release_id=advertised.release_id,
                manifest=advertised,
            )
            installer = ManagedInstaller(layout, fetch_release=lambda: asset)
            self.assertTrue(installer.update(check=True).changed)

    def test_legacy_profile_migrates_and_corrupt_manifest_falls_back(self):
        for manifest_text, expected_profile in ((json.dumps({"profile": "dev"}), "dev"), ("{bad", "max")):
            with self.subTest(profile=expected_profile), TemporaryDirectory() as temporary:
                root = Path(temporary)
                layout = ManagedLayout.at(root / "DovePi")
                source, _manifest = make_source(root)
                (source / ".dove").mkdir()
                (source / ".dove" / "manifest.json").write_text(manifest_text, encoding="utf-8")
                installer = ManagedInstaller(layout)
                installer.transaction = ManagedTransaction(layout, runner=successful_runner)
                result = installer.install_source(source, verify="none")
                self.assertEqual(result.profile, expected_profile)

    def test_repair_recovers_previous_runnable_release(self):
        with TemporaryDirectory() as temporary:
            layout = ManagedLayout.at(Path(temporary) / "DovePi")
            broken = layout.versions_dir / "broken"
            previous = layout.versions_dir / "previous"
            broken.mkdir(parents=True)
            previous.mkdir(parents=True)
            (previous / "dove_pi.py").write_text("print('ok')\n", encoding="utf-8")
            previous_manifest = complete_manifest("0.1.0", "previous", "abcdef0")
            (previous / "release.json").write_text(json.dumps(previous_manifest.to_json()), encoding="utf-8")
            write_installed_components(previous, previous_manifest.components)
            write_state(layout, InstallState(current=ReleaseRef("broken", broken), previous=ReleaseRef("previous", previous)), command="install")
            result = ManagedInstaller(layout).repair(verify="none")
            self.assertTrue(result.changed)
            self.assertEqual(load_state(layout).current.release_id, "previous")

    def test_repair_full_verifies_current_release(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            source, manifest = make_source(root)
            calls = []

            def runner(command, cwd):
                calls.append(list(command))
                successful_runner(command, cwd)

            installer = ManagedInstaller(layout)
            installer.transaction = ManagedTransaction(layout, runner=runner)
            installer.install_source(source, verify="none")
            calls.clear()
            result = installer.repair(verify="full")
            self.assertFalse(result.changed)
            self.assertTrue(any("typecheck" in command for command in calls))
            self.assertTrue(any("pi:smoke" in command for command in calls))
            self.assertTrue(any("test" in command for command in calls))

    def test_uninstall_preserves_user_project_checkout_and_unknown_root_files(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            layout.ensure_base_directories()
            (layout.bin_dir / "dove-pi.cmd").write_text("managed", encoding="utf-8")
            unknown = layout.root / "caller-owned.txt"
            unknown.write_text("keep", encoding="utf-8")
            preserved = [root / "pi-user", root / "project" / ".trellis", root / "checkout" / ".git"]
            for path in preserved:
                path.mkdir(parents=True)
                (path / "marker").write_text("keep", encoding="utf-8")
            ManagedInstaller(layout).uninstall(confirmed=True)
            self.assertFalse(layout.bin_dir.exists())
            self.assertTrue(unknown.is_file())
            self.assertTrue(all((path / "marker").is_file() for path in preserved))

    @unittest.skipUnless(os.name == "nt", "Windows extended-length path regression")
    def test_uninstall_removes_release_files_beyond_legacy_max_path(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            layout.ensure_base_directories()
            _marker, extended_marker = write_long_windows_marker(layout.versions_dir / "current" / "node_modules")

            ManagedInstaller(layout).uninstall(confirmed=True)

            self.assertFalse(os.path.exists(extended_marker))
            self.assertFalse(layout.versions_dir.parent.exists())

    def test_checksum_failure_keeps_current_release(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            layout = ManagedLayout.at(root / "DovePi")
            current = layout.versions_dir / "current"
            current.mkdir(parents=True)
            write_state(layout, InstallState(current=ReleaseRef("current", current, "0.2.0")), command="install")
            archive = root / "dove-pi-windows.zip"
            archive.write_bytes(b"not-a-zip")
            checksum = root / "dove-pi-windows.zip.sha256"
            checksum.write_text("0" * 64, encoding="ascii")
            asset = ReleaseAsset("v0.3.0", "0.3.0", archive.as_uri(), checksum.as_uri())
            with self.assertRaises(RuntimeError):
                ManagedInstaller(layout, fetch_release=lambda: asset).update(verify="none")
            self.assertEqual(load_state(layout).current.release_id, "current")


class ReleaseArchiveTests(unittest.TestCase):
    def test_safe_extract_rejects_zip_slip(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = root / "bad.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                bundle.writestr("../outside.txt", "bad")
            with self.assertRaises(RuntimeError):
                safe_extract_zip(archive, root / "extract")
            self.assertFalse((root / "outside.txt").exists())


if __name__ == "__main__":
    unittest.main()
