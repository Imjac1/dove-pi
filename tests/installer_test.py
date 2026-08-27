import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from dove_pi import format_version, main, parse_install, write_launchers


class InstallerCliTests(unittest.TestCase):
    def test_default_install_is_complete_but_uses_quick_verification(self):
        options = parse_install([])
        self.assertEqual(options.profile, "max")
        self.assertEqual(options.verify, "quick")
        self.assertFalse(options.no_font)

    def test_high_level_aliases_are_supported(self):
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

    def test_launcher_supports_non_ascii_windows_paths(self):
        # Exercise the Windows branch on every CI host. The old ASCII write
        # failed before creating either launcher when the user/repository path
        # contained CJK characters.
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            launcher_dir = root / "启动器"
            launcher_dir.mkdir()
            with patch("dove_pi.os.name", "nt"), patch("dove_pi.PROJECT_ROOT", root / "项目"), patch("dove_pi.sys.executable", str(root / "Python 中文" / "python.exe")):
                write_launchers(launcher_dir)

            cmd = launcher_dir / "dove-pi.cmd"
            ps1 = launcher_dir / "dove-pi.ps1"
            self.assertTrue(cmd.exists())
            self.assertIn("%~dp0dove-pi.ps1", cmd.read_text(encoding="ascii"))
            self.assertEqual(ps1.read_bytes()[:3], b"\xef\xbb\xbf")


if __name__ == "__main__":
    unittest.main()
