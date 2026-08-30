import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch

from dove_pi import format_version, launch, main, package_versions, parse_install, parse_managed_update, run_installed_cli_json, without_user_path_entry
from installer.manager import MaintenanceResult


class InstallerCliTests(unittest.TestCase):
    def test_default_install_uses_managed_quick_profile_inheritance(self):
        options = parse_install([])
        self.assertIsNone(options.profile)
        self.assertEqual(options.verify, "quick")
        self.assertFalse(options.no_extensions)
        self.assertFalse(options.no_font)

    def test_no_extensions_does_not_reenable_stored_profile(self):
        result = MaintenanceResult("install", True, "0.2.0+test", profile="security", message="ok")
        with patch("dove_pi.ManagedInstaller") as installer_type, \
                patch("dove_pi.ManagedLayout.default"), \
                patch("dove_pi.emit_maintenance_result"), \
                patch("dove_pi.add_user_path"):
            installer_type.return_value.install_source.return_value = result
            self.assertEqual(main(["install", "--no-extensions", "--no-font", "--verify", "none"]), 0)
        self.assertIsNone(installer_type.return_value.install_source.call_args.kwargs["reconcile_components"])

    def test_high_level_compatibility_aliases_are_supported(self):
        options = parse_install(["--profile", "dev", "--verify", "full", "--no-font"])
        self.assertEqual(options.profile, "dev")
        self.assertEqual(options.verify, "full")
        self.assertTrue(options.no_font)

        legacy = parse_install(["--extensions", "minimal", "--skip-checks"])
        self.assertEqual(legacy.profile, "minimal")
        self.assertTrue(legacy.skip_checks)

    def test_version_formatting(self):
        self.assertEqual(format_version((22, 19, 0)), "22.19.0")

    def test_package_versions_are_release_locked(self):
        with TemporaryDirectory() as temporary:
            package = Path(temporary) / "package.json"
            package.write_text(
                json.dumps({
                    "version": "1.2.3",
                    "dependencies": {"@earendil-works/pi-coding-agent": "4.5.6"},
                }),
                encoding="utf-8",
            )
            self.assertEqual(package_versions(package), ("1.2.3", "4.5.6"))

    def test_version_reports_dove_and_pi_without_launching(self):
        output = io.StringIO()
        with patch("dove_pi.package_versions", return_value=("1.2.3", "4.5.6")), \
                patch("dove_pi.launch") as launch, \
                contextlib.redirect_stdout(output):
            self.assertEqual(main(["--version"]), 0)
        self.assertEqual(output.getvalue().strip(), "Dove Pi 1.2.3 (Pi 4.5.6)")
        launch.assert_not_called()

    def test_no_arguments_launches_pi(self):
        with patch("dove_pi.launch", return_value=0) as launch:
            self.assertEqual(main([]), 0)
            launch.assert_called_once_with([])

    def test_finite_diagnostics_route_to_local_cli(self):
        for arguments in (["cache", "audit", "--min-requests=2"], ["token", "audit", "--since=1h"]):
            with self.subTest(command=arguments[0]), \
                    patch("dove_pi.run_local_cli", return_value=0) as local_cli, \
                    patch("dove_pi.launch") as launch:
                self.assertEqual(main(arguments), 0)
                local_cli.assert_called_once_with(arguments)
                launch.assert_not_called()

    def test_unknown_arguments_still_pass_through_to_pi(self):
        with patch("dove_pi.run_local_cli") as local_cli, \
                patch("dove_pi.launch", return_value=0) as launch:
            self.assertEqual(main(["--model", "provider/model"]), 0)
            launch.assert_called_once_with(["--model", "provider/model"])
            local_cli.assert_not_called()

    def test_launch_network_controls_use_official_pi_environment_flags(self):
        with TemporaryDirectory() as temporary:
            pi_entry = Path(temporary) / "cli.js"
            pi_entry.write_text("fixture", encoding="utf-8")
            completed = subprocess.CompletedProcess(args=[], returncode=0)
            with patch.dict(os.environ, {}, clear=True), \
                    patch("dove_pi.PI_ENTRY", pi_entry), \
                    patch("dove_pi.executable", return_value="node"), \
                    patch("dove_pi.subprocess.run", return_value=completed) as child:
                self.assertEqual(launch(["--skip-version-check", "--offline", "--model", "provider/model"]), 0)
            command = child.call_args.args[0]
            environment = child.call_args.kwargs["env"]
            self.assertNotIn("--skip-version-check", command)
            self.assertNotIn("--offline", command)
            self.assertEqual(command[-2:], ["--model", "provider/model"])
            self.assertEqual(environment["PI_SKIP_VERSION_CHECK"], "1")
            self.assertEqual(environment["PI_OFFLINE"], "1")

    def test_managed_launch_always_suppresses_pi_self_update(self):
        completed = subprocess.CompletedProcess(args=[], returncode=0)
        with patch("dove_pi.executable", return_value="node"), \
                patch("dove_pi.PI_ENTRY") as pi_entry, \
                patch("dove_pi.subprocess.run", return_value=completed) as run:
            pi_entry.exists.return_value = True
            self.assertEqual(launch([]), 0)
        self.assertEqual(run.call_args.kwargs["env"]["PI_SKIP_VERSION_CHECK"], "1")

    def test_windows_path_cleanup_removes_only_the_managed_launcher(self):
        current = r'C:\Tools;"C:\Users\Alice\AppData\Local\DovePi\bin\";C:\Other;'
        updated, removed = without_user_path_entry(current, Path(r"c:\users\alice\appdata\local\dovepi\bin"))
        self.assertTrue(removed)
        self.assertEqual(updated, r"C:\Tools;C:\Other;")


class ManagedUpdateCliTests(unittest.TestCase):
    def test_managed_extension_json_allows_progress_on_stderr_only(self):
        with TemporaryDirectory() as temporary:
            install_root = Path(temporary)
            (install_root / "src").mkdir()
            (install_root / "node_modules" / "tsx" / "dist").mkdir(parents=True)
            (install_root / "src" / "cli.ts").write_text("fixture", encoding="utf-8")
            (install_root / "node_modules" / "tsx" / "dist" / "loader.mjs").write_text("fixture", encoding="utf-8")
            completed = subprocess.CompletedProcess(
                args=[],
                returncode=0,
                stdout='{"failed":[],"installed":["open-tui"]}\n',
                stderr="Installed npm:pi-open-tui@0.2.15\n",
            )
            diagnostics = io.StringIO()
            with patch("dove_pi.executable", return_value="node"), \
                    patch("dove_pi.subprocess.run", return_value=completed) as child, \
                    contextlib.redirect_stderr(diagnostics):
                result = run_installed_cli_json(install_root, ["extensions", "install", "max"])
            self.assertEqual(result["failed"], [])
            self.assertIn("Installed npm:pi-open-tui", diagnostics.getvalue())
            self.assertEqual(child.call_args.kwargs["stdout"], subprocess.PIPE)
            self.assertIsNone(child.call_args.kwargs["stderr"])

    def test_managed_extension_failure_bounds_captured_stdout(self):
        with TemporaryDirectory() as temporary:
            install_root = Path(temporary)
            (install_root / "src").mkdir()
            (install_root / "node_modules" / "tsx" / "dist").mkdir(parents=True)
            (install_root / "src" / "cli.ts").write_text("fixture", encoding="utf-8")
            (install_root / "node_modules" / "tsx" / "dist" / "loader.mjs").write_text("fixture", encoding="utf-8")
            completed = subprocess.CompletedProcess(
                args=[],
                returncode=1,
                stdout="UNBOUNDED_PREFIX\n" + ("x" * 800) + "TAIL",
                stderr=None,
            )
            with patch("dove_pi.executable", return_value="node"), \
                    patch("dove_pi.subprocess.run", return_value=completed):
                with self.assertRaises(RuntimeError) as raised:
                    run_installed_cli_json(install_root, ["extensions", "install", "max"])
            message = str(raised.exception)
            self.assertNotIn("UNBOUNDED_PREFIX", message)
            self.assertTrue(message.endswith("TAIL"))
            self.assertLessEqual(len(message), 570)

    def test_transaction_subprocess_progress_is_sent_to_stderr(self):
        completed = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import json,sys; from pathlib import Path; "
                    "from installer.transaction import default_command_runner; "
                    "default_command_runner([sys.executable,'-c',\"print('npm progress')\"],Path.cwd()); "
                    "print(json.dumps({'status':'ready'}))"
                ),
            ],
            cwd=Path(__file__).resolve().parents[1],
            text=True,
            capture_output=True,
            timeout=20,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(json.loads(completed.stdout), {"status": "ready"})
        self.assertIn("npm progress", completed.stderr)

    def test_update_check_json_is_one_document_and_read_only(self):
        result = MaintenanceResult(
            "update-check",
            True,
            "0.1.0+old",
            profile="max",
            message="Latest stable release: v0.2.0",
        )
        with patch("dove_pi.ManagedLayout.default"), \
                patch("dove_pi.ManagedInstaller") as installer_type:
            installer_type.return_value.update.return_value = result
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(main(["update", "--check", "--json"]), 0)
        installer_type.return_value.update.assert_called_once_with(check=True, verify="quick", reconcile_components=None)
        payload = json.loads(output.getvalue())
        self.assertTrue(payload["updateAvailable"])
        self.assertEqual(payload["command"], "update-check")

    def test_managed_update_rejects_legacy_force(self):
        with self.assertRaisesRegex(RuntimeError, "do not use --force"):
            parse_managed_update(["--force"])

    def test_uninstall_removes_managed_path_and_keeps_json_stdout_clean(self):
        layout = Mock()
        layout.bin_dir = Path(r"C:\Users\Alice\AppData\Local\DovePi\bin")
        result = MaintenanceResult("uninstall", True, None, message="removed")
        output = io.StringIO()
        with patch("dove_pi.ManagedLayout.default", return_value=layout), \
                patch("dove_pi.ManagedInstaller") as installer_type, \
                patch("dove_pi.remove_user_path", return_value=True) as remove_path, \
                contextlib.redirect_stdout(output):
            installer_type.return_value.layout = layout
            installer_type.return_value.uninstall.return_value = result
            self.assertEqual(main(["uninstall", "--yes", "--json"]), 0)
        installer_type.return_value.uninstall.assert_called_once_with(confirmed=True)
        remove_path.assert_called_once_with(layout.bin_dir)
        self.assertEqual(json.loads(output.getvalue())["pathRemoved"], True)

    def test_managed_json_failure_is_one_document_and_uses_temp_root(self):
        with TemporaryDirectory() as temporary:
            env = dict(os.environ)
            env["DOVE_PI_HOME"] = str(Path(temporary) / "DovePi")
            completed = subprocess.run(
                [sys.executable, "dove_pi.py", "rollback", "--json"],
                cwd=Path(__file__).resolve().parents[1],
                env=env,
                text=True,
                capture_output=True,
                timeout=20,
            )
            self.assertNotEqual(completed.returncode, 0)
            payload = json.loads(completed.stdout)
            self.assertEqual(payload["status"], "error")
            self.assertEqual(payload["failedStep"], "rollback")
            self.assertTrue(Path(payload["logPath"]).is_file())


if __name__ == "__main__":
    unittest.main()
