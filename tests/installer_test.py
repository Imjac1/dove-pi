import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from dove_pi import format_version, main, parse_install, write_launchers


class InstallerCliTests(unittest.TestCase):
    def test_default_install_uses_quick_verification_and_manifest_profile(self):
        options = parse_install([])
        self.assertIsNone(options.profile)
        self.assertEqual(options.verify, "quick")
        self.assertFalse(options.no_font)
        # No --profile means the stored manifest profile, and install() resolves it.
        with patch("dove_pi.read_manifest", return_value={"profile": "security"}), \
                patch("dove_pi.executable"), patch("dove_pi.node_version", return_value=(22, 19, 0)), \
                patch("dove_pi.run"), patch("dove_pi.run_local_cli", return_value=0), \
                patch("dove_pi.ensure_icon_font"), patch("dove_pi.configure_icons"), \
                patch("dove_pi.launcher_directory"), patch("dove_pi.write_launchers"), \
                patch("dove_pi.add_user_path"), patch("dove_pi.update_trellis_cli"), \
                patch("dove_pi.write_manifest") as write_manifest, \
                patch("dove_pi.git_current_commit", return_value="abc123"):
            from dove_pi import install
            install(verify="none", extension_profile=None)
        profile_arg = write_manifest.call_args.kwargs.get("profile")
        self.assertEqual(profile_arg, "security")
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


class ManifestTests(unittest.TestCase):
    def test_read_manifest_missing_returns_empty(self):
        from dove_pi import MANIFEST_PATH, read_manifest
        with TemporaryDirectory() as temporary:
            with patch("dove_pi.MANIFEST_PATH", Path(temporary) / "manifest.json"):
                self.assertEqual(read_manifest(), {})

    def test_read_manifest_corrupt_returns_empty(self):
        from dove_pi import MANIFEST_PATH, read_manifest
        with TemporaryDirectory() as temporary:
            manifest = Path(temporary) / "manifest.json"
            manifest.write_text("{not json", encoding="utf-8")
            with patch("dove_pi.MANIFEST_PATH", manifest):
                self.assertEqual(read_manifest(), {})

    def test_write_manifest_roundtrip(self):
        from dove_pi import MANIFEST_DIR, MANIFEST_PATH, read_manifest, write_manifest
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            with patch("dove_pi.MANIFEST_DIR", root / ".dove"), patch("dove_pi.MANIFEST_PATH", root / ".dove" / "manifest.json") as manifest_path:
                write_manifest(profile="security", previous_commit="abc", current_commit="def")
                manifest = read_manifest()
                self.assertEqual(manifest["profile"], "security")
                self.assertEqual(manifest["previousCommit"], "abc")
                self.assertEqual(manifest["currentCommit"], "def")
                self.assertIn("lastUpdatedAt", manifest)
                self.assertTrue(manifest_path.exists())

    def test_write_manifest_merges_existing(self):
        from dove_pi import MANIFEST_DIR, MANIFEST_PATH, read_manifest, write_manifest
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            with patch("dove_pi.MANIFEST_DIR", root / ".dove"), patch("dove_pi.MANIFEST_PATH", root / ".dove" / "manifest.json"):
                write_manifest(profile="minimal")
                write_manifest(previous_commit="old")
                manifest = read_manifest()
                self.assertEqual(manifest["profile"], "minimal")
                self.assertEqual(manifest["previousCommit"], "old")


class UpdateCommandTests(unittest.TestCase):
    def test_update_check_prints_availability_without_changes(self):
        from dove_pi import run_update
        with patch("dove_pi.git_is_repository", return_value=True), \
                patch("dove_pi.git_has_origin", return_value=True), \
                patch("dove_pi.git_detached_head", return_value=False), \
                patch("dove_pi.git_fetch_origin"), \
                patch("dove_pi.git_current_commit", return_value="aaa"), \
                patch("dove_pi.git_remote_commit", return_value="bbb"), \
                patch("dove_pi.git_is_ancestor", return_value=True), \
                patch("dove_pi.git_status_porcelain", return_value=""), \
                patch("dove_pi.install") as install_mock, \
                patch("dove_pi.write_manifest") as write_manifest:
            import io
            import contextlib
            from dove_pi import run_update
            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                exit_code = run_update(["--check"])
        self.assertEqual(exit_code, 0)
        install_mock.assert_not_called()
        write_manifest.assert_not_called()
        import json
        result = json.loads(buffer.getvalue().strip())
        self.assertTrue(result["updateAvailable"])
        self.assertEqual(result["currentCommit"], "aaa")
        self.assertEqual(result["targetCommit"], "bbb")
        self.assertEqual(result["state"], "remote-ahead")

    def test_update_check_does_not_call_local_ahead_an_update(self):
        from dove_pi import run_update
        with patch("dove_pi.git_is_repository", return_value=True), \
                patch("dove_pi.git_has_origin", return_value=True), \
                patch("dove_pi.git_detached_head", return_value=False), \
                patch("dove_pi.git_current_branch", return_value="master"), \
                patch("dove_pi.git_fetch_origin"), \
                patch("dove_pi.git_current_commit", return_value="bbb"), \
                patch("dove_pi.git_remote_commit", return_value="aaa"), \
                patch("dove_pi.git_is_ancestor", side_effect=[False, True]), \
                patch("dove_pi.install") as install_mock:
            import io
            import contextlib
            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                exit_code = run_update(["--check"])
        self.assertEqual(exit_code, 0)
        install_mock.assert_not_called()
        import json
        result = json.loads(buffer.getvalue().strip())
        self.assertFalse(result["updateAvailable"])
        self.assertEqual(result["state"], "local-ahead")

    def test_update_is_noop_when_local_checkout_is_ahead(self):
        from dove_pi import run_update
        with patch("dove_pi.git_is_repository", return_value=True), \
                patch("dove_pi.git_has_origin", return_value=True), \
                patch("dove_pi.git_detached_head", return_value=False), \
                patch("dove_pi.git_current_branch", return_value="master"), \
                patch("dove_pi.git_status_porcelain", return_value=""), \
                patch("dove_pi.git_current_commit", return_value="bbb"), \
                patch("dove_pi.git_fetch_origin"), \
                patch("dove_pi.git_remote_commit", return_value="aaa"), \
                patch("dove_pi.git_is_ancestor", side_effect=[False, True]), \
                patch("dove_pi.git_fast_forward") as fast_forward, \
                patch("dove_pi.install") as install_mock, \
                patch("dove_pi.write_manifest") as write_manifest:
            import io
            import contextlib
            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                exit_code = run_update([])
        self.assertEqual(exit_code, 0)
        fast_forward.assert_not_called()
        install_mock.assert_not_called()
        write_manifest.assert_not_called()
        import json
        result = json.loads(buffer.getvalue().strip())
        self.assertFalse(result["updated"])
        self.assertEqual(result["state"], "local-ahead")

    def test_update_rejects_non_master_branch_before_fetch(self):
        from dove_pi import run_update
        with patch("dove_pi.git_is_repository", return_value=True), \
                patch("dove_pi.git_has_origin", return_value=True), \
                patch("dove_pi.git_detached_head", return_value=False), \
                patch("dove_pi.git_current_branch", return_value="feature/demo"), \
                patch("dove_pi.git_fetch_origin") as fetch_mock:
            with self.assertRaisesRegex(RuntimeError, "git switch master"):
                run_update(["--check"])
        fetch_mock.assert_not_called()

    def test_update_aborts_on_dirty_tree_without_force(self):
        from dove_pi import run_update
        with patch("dove_pi.git_is_repository", return_value=True), \
                patch("dove_pi.git_has_origin", return_value=True), \
                patch("dove_pi.git_detached_head", return_value=False), \
                patch("dove_pi.git_status_porcelain", return_value=" M src/cli.ts"), \
                patch("dove_pi.git_reset_hard") as reset_hard, \
                patch("dove_pi.git_fetch_origin") as fetch_mock, \
                patch("dove_pi.install") as install_mock, \
                patch("dove_pi.write_manifest") as write_manifest:
            with self.assertRaises(RuntimeError):
                run_update([])
        fetch_mock.assert_not_called()
        install_mock.assert_not_called()
        write_manifest.assert_not_called()
        reset_hard.assert_not_called()

    def test_update_force_resets_dirty_tree(self):
        from dove_pi import run_update
        with patch("dove_pi.git_is_repository", return_value=True), \
                patch("dove_pi.git_has_origin", return_value=True), \
                patch("dove_pi.git_detached_head", return_value=False), \
                patch("dove_pi.git_status_porcelain", return_value=" M src/cli.ts"), \
                patch("dove_pi.git_reset_hard") as reset_hard, \
                patch("dove_pi.git_current_commit", return_value="aaa"), \
                patch("dove_pi.git_fetch_origin"), \
                patch("dove_pi.git_remote_commit", return_value="aaa"), \
                patch("dove_pi.git_is_ancestor", return_value=True), \
                patch("dove_pi.git_fast_forward"), \
                patch("dove_pi.read_manifest", return_value={"profile": "max"}), \
                patch("dove_pi.install") as install_mock, \
                patch("dove_pi.write_manifest") as write_manifest:
            exit_code = run_update(["--force"])
        self.assertEqual(exit_code, 0)
        reset_hard.assert_called_once()
        # Already up to date: no install step.
        install_mock.assert_not_called()
        write_manifest.assert_not_called()

    def test_update_applies_ff_merge_and_reinstalls(self):
        from dove_pi import run_update
        with patch("dove_pi.git_is_repository", return_value=True), \
                patch("dove_pi.git_has_origin", return_value=True), \
                patch("dove_pi.git_detached_head", return_value=False), \
                patch("dove_pi.git_status_porcelain", return_value=""), \
                patch("dove_pi.git_current_commit", side_effect=["aaa", "ccc"]), \
                patch("dove_pi.git_fetch_origin"), \
                patch("dove_pi.git_remote_commit", return_value="bbb"), \
                patch("dove_pi.git_is_ancestor", return_value=True), \
                patch("dove_pi.git_fast_forward") as fast_forward, \
                patch("dove_pi.read_manifest", return_value={"profile": "security"}), \
                patch("dove_pi.install") as install_mock, \
                patch("dove_pi.write_manifest") as write_manifest:
            import io
            import contextlib
            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer):
                exit_code = run_update([])
        self.assertEqual(exit_code, 0)
        fast_forward.assert_called_once()
        install_mock.assert_called_once()
        # previousCommit recorded before the merge, currentCommit after.
        # previousCommit recorded before the merge (Python param name is snake_case).
        previous_kwargs = write_manifest.call_args_list[0].kwargs
        self.assertEqual(previous_kwargs["previous_commit"], "aaa")
        import json
        result = json.loads(buffer.getvalue().strip())
        self.assertTrue(result["updated"])
        self.assertEqual(result["previousCommit"], "aaa")
        self.assertEqual(result["currentCommit"], "ccc")
        self.assertEqual(result["profile"], "security")

    def test_update_diverged_history_aborts(self):
        from dove_pi import run_update
        with patch("dove_pi.git_is_repository", return_value=True), \
                patch("dove_pi.git_has_origin", return_value=True), \
                patch("dove_pi.git_detached_head", return_value=False), \
                patch("dove_pi.git_status_porcelain", return_value=""), \
                patch("dove_pi.git_current_commit", return_value="aaa"), \
                patch("dove_pi.git_fetch_origin"), \
                patch("dove_pi.git_remote_commit", return_value="bbb"), \
                patch("dove_pi.git_is_ancestor", return_value=False), \
                patch("dove_pi.git_fast_forward") as fast_forward, \
                patch("dove_pi.install") as install_mock, \
                patch("dove_pi.write_manifest") as write_manifest:
            with self.assertRaises(RuntimeError):
                run_update([])
        fast_forward.assert_not_called()
        install_mock.assert_not_called()
        write_manifest.assert_not_called()

    def test_update_trellis_cli_failure_is_warning(self):
        from dove_pi import update_trellis_cli
        fake = type("Fake", (), {"returncode": 1, "stderr": "boom", "stdout": ""})()
        with patch("dove_pi.executable", return_value="npm"), \
                patch("dove_pi.subprocess.run", return_value=fake), \
                patch("sys.stderr"):
            update_trellis_cli()  # must not raise

    def test_update_trellis_cli_success_is_silent(self):
        from dove_pi import update_trellis_cli
        fake = type("Fake", (), {"returncode": 0, "stderr": "", "stdout": ""})()
        with patch("dove_pi.executable", return_value="npm"), \
                patch("dove_pi.subprocess.run", return_value=fake):
            update_trellis_cli()  # must not raise


if __name__ == "__main__":
    unittest.main()
