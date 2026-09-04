import unittest
from unittest.mock import patch

from dove_pi import main


class InteropLauncherRoutingTests(unittest.TestCase):
    def test_interoperability_commands_route_to_local_cli(self):
        for arguments in (["capability", "list"], ["rpc"], ["mcp"], ["task", "list"], ["session", "list"], ["--offline", "task", "list"], ["--skip-version-check", "task", "list"], ["--offline", "--skip-version-check", "doctor"]):
            with self.subTest(command=arguments[0]), \
                    patch("dove_pi.run_local_cli", return_value=0) as local_cli, \
                    patch("dove_pi.launch") as launch:
                self.assertEqual(main(arguments), 0)
                expected = list(arguments)
                while expected and expected[0] in {"--offline", "--skip-version-check"}:
                    expected.pop(0)
                local_cli.assert_called_once_with(expected if len(expected) != len(arguments) else arguments)
                launch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
