import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from dove_pi import format_version, main, parse_install, parse_managed_update
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

    def test_no_arguments_launches_pi(self):
        with patch("dove_pi.launch", return_value=0) as launch:
            self.assertEqual(main([]), 0)
            launch.assert_called_once_with([])


class ManagedUpdateCliTests(unittest.TestCase):
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
