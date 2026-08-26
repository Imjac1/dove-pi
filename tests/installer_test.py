import unittest
from unittest.mock import patch

from dove_pi import format_version, main, parse_install


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


if __name__ == "__main__":
    unittest.main()
