import ast
import contextlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch

import dove_pi
from dove_pi import format_version, launch, main, package_versions, parse_install, parse_managed_update, run_installed_cli_json, without_user_path_entry, workspace_mode_from_file
from installer.manager import MaintenanceResult


ROOT = Path(__file__).resolve().parents[1]


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

    def test_help_describes_stable_schema_and_pi_tool_authority(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(main(["--help"]), 0)
        help_text = output.getvalue()
        self.assertIn("leaves Pi's active tool schema unchanged", help_text)
        self.assertIn("never tool permission", help_text)
        self.assertNotIn("intent-based tool loading", help_text)

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

    def test_python_module_does_not_load_installer_for_import_only(self):
        completed = subprocess.run(
            [sys.executable, "-c", "import sys; import dove_pi; print('installer.manager' in sys.modules)"],
            cwd=Path(__file__).resolve().parents[1],
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertEqual(completed.stdout.strip(), "False")

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

    def test_launch_workspace_mode_defaults_to_development_without_disabling_lens(self):
        completed = subprocess.CompletedProcess(args=[], returncode=0)
        with patch("dove_pi.executable", return_value="node"), \
                patch("dove_pi.PI_ENTRY") as pi_entry, \
                patch("dove_pi.subprocess.run", return_value=completed) as run:
            pi_entry.exists.return_value = True
            self.assertEqual(launch([]), 0)
        command = run.call_args.args[0]
        self.assertNotIn("--no-lens", command)
        self.assertEqual(run.call_args.kwargs["env"]["DOVE_PI_WORKSPACE_MODE"], "development")

    def test_launch_workspace_mode_override_disables_lens_without_forwarding_policy_flag(self):
        completed = subprocess.CompletedProcess(args=[], returncode=0)
        with patch("dove_pi.executable", return_value="node"), \
                patch("dove_pi.PI_ENTRY") as pi_entry, \
                patch("dove_pi.subprocess.run", return_value=completed) as run:
            pi_entry.exists.return_value = True
            self.assertEqual(launch(["--workspace-mode", "pentest", "--model", "provider/model"]), 0)
        command = run.call_args.args[0]
        self.assertIn("--no-lens", command)
        self.assertNotIn("--workspace-mode", command)
        self.assertNotIn("pentest", command)
        self.assertEqual(command[-2:], ["--model", "provider/model"])
        self.assertEqual(run.call_args.kwargs["env"]["DOVE_PI_WORKSPACE_MODE"], "pentest")

    def test_workspace_policy_is_inherited_by_nested_launch_directory(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            policy_dir = root / ".dove"
            policy_dir.mkdir()
            (policy_dir / "workspace.json").write_text('{"schemaVersion": 1, "mode": "pentest"}\n', encoding="utf-8")
            nested = root / "src" / "module"
            nested.mkdir(parents=True)
            self.assertEqual(workspace_mode_from_file(nested), "pentest")

    def test_invalid_workspace_mode_is_rejected_before_local_cli_routing(self):
        with self.assertRaisesRegex(RuntimeError, "--workspace-mode must be development or pentest"):
            main(["--workspace-mode", "invalid", "workspace", "status"])

    def test_managed_launch_always_suppresses_pi_self_update(self):
        completed = subprocess.CompletedProcess(args=[], returncode=0)
        with patch("dove_pi.executable", return_value="node"), \
                patch("dove_pi.PI_ENTRY") as pi_entry, \
                patch("dove_pi.subprocess.run", return_value=completed) as run:
            pi_entry.exists.return_value = True
            self.assertEqual(launch([]), 0)
        self.assertEqual(run.call_args.kwargs["env"]["PI_SKIP_VERSION_CHECK"], "1")

    def test_source_launcher_has_direct_pi_startup_path(self):
        source = (Path(__file__).resolve().parents[1] / "bin" / "dove-pi.cjs").read_text(encoding="utf-8")
        self.assertIn("shouldUsePiFastPath", source)
        self.assertIn("process.execPath", source)
        self.assertIn("pythonCommands", source)

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

    def test_repair_can_skip_managed_extension_reconciliation(self):
        result = MaintenanceResult("repair", False, "0.1.1+current", message="healthy")
        output = io.StringIO()
        with patch("dove_pi.validate_managed_prerequisites"), \
                patch("dove_pi.ManagedLayout.default"), \
                patch("dove_pi.ManagedInstaller") as installer_type, \
                contextlib.redirect_stdout(output):
            installer_type.return_value.repair.return_value = result
            self.assertEqual(main(["repair", "--verify", "none", "--no-extensions", "--json"]), 0)
        installer_type.return_value.repair.assert_called_once_with(verify="none", reconcile_components=None)
        self.assertEqual(json.loads(output.getvalue())["command"], "repair")

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


class CliHelpCoverageTests(unittest.TestCase):
    """Every command the READMEs document is named in the CLI own help.

    Found by holding the two against each other. `shell` is documented in both READMEs with its own section and five mentions each, is a
    first-class local CLI command in the router, runs, and appeared nowhere in `dove-pi --help` - so a reader who saw the README could not
    find it from the tool. Three other commands, `cache`, `token` and `extensions`, are also absent from the help, and none of them is
    named in either README, which is what makes their absence consistent and this one not.

    **One direction on purpose**: a README may show a way in without listing everything, so naming fewer commands than the router has is
    not a defect. Naming a command a reader cannot then find in the help is.

    **The layer below this one is clean, measured after the flags**: every subcommand the usage strings name is one the dispatch handles.
    The thickest is `task`, whose usage names ten - list, current, status, continue, verify, convergence, create, start, finish, archive -
    and `src/commands/task.ts` handles exactly those ten, six as branches and four through the mutation path. `project` names four and
    dispatches four, `shell` three and three, `web`, `workspace`, `capability` and `session` likewise. **The READMEs and the help name
    subsets**, which is what a way in is allowed to be.

    **What this does not cover, measured in the round after it**: the flags. The help names eighteen and the READMEs twenty-three, and every
    one of them is accepted - by the program the document is about, which is not always this one. `--cwd`, `--prompt`, `--scenario` and
    `--launcher` belong to `scripts/real-dove-blackbox.mjs` and the READMEs name them under that script, so a check over this program
    would report four false positives. **The first attempt at one did**, twice over: a regex that lost its escaping in the shell that
    generated it, and a parser set that left out the very script the flags belong to. A check is only as good as the scope it declares.
    """

    def test_commands_the_readmes_name_are_named_in_the_help(self):
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            self.assertEqual(main(["--help"]), 0)
        help_text = captured.getvalue()

        for name in ("README.md", "README.en.md"):
            text = (ROOT / name).read_text(encoding="utf-8")
            # **[ \t]+ and not \\s+**: the first version matched across a line break and read "python .\\dove_pi.py install"
            # on the next line as a command named after dove-pi. A pattern that crosses lines is not reading the document it
            # claims to read.
            documented = set(re.findall(r"dove-pi[ \t]+([a-z][a-z-]*)", text))
            missing = {
                command
                for command in documented
                if re.search(r"dove-pi[ \t]+" + re.escape(command) + r"\b", help_text) is None
            }
            self.assertEqual(
                missing,
                set(),
                name + " names a command the CLI help does not: " + ", ".join(sorted(missing)),
            )

    def test_every_local_command_is_either_public_or_declared_internal(self):
        """The set of commands a user can run is the help list plus the exceptions, and nothing else.

        Measured before this existed: cache, token and extensions were runnable and documented nowhere. Reading them split them -
        extensions is invoked by the router itself, while cache and token are audits whose only caller is the CLI dispatch - so the
        first is internal by construction and the other two are user-facing and were simply unfindable.

        Both directions are asserted, because the two ways to get this wrong are opposite: an exception that gains a mention is a
        command nobody declared, and a command that loses its mention is one nobody can find.
        """
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            self.assertEqual(main(["--help"]), 0)
        help_text = captured.getvalue()

        public = {
            command
            for command in dove_pi.LOCAL_CLI_COMMANDS - dove_pi.INTERNAL_CLI_COMMANDS
            if re.search(r"dove-pi[ \t]+" + re.escape(command) + r"\b", help_text) is None
        }
        self.assertEqual(public, set(), "a command a user can run is named nowhere: " + ", ".join(sorted(public)))

        declared = {
            command
            for command in dove_pi.INTERNAL_CLI_COMMANDS
            if re.search(r"dove-pi[ \t]+" + re.escape(command) + r"\b", help_text) is not None
        }
        self.assertEqual(
            declared,
            set(),
            "an internal command is named in the help, so it is not internal: " + ", ".join(sorted(declared)),
        )


class RuntimeMinimumTests(unittest.TestCase):
    """The minimum the launcher enforces is the minimum the release declares.

    Measured across seven places: package.json engines, the release manifest, installer/release.py, the readiness check, both bootstrap
    prerequisite calls, dove_pi.py own checks, and both READMEs. **They agree**, and two of the places compare exactly - a manifest that
    drifts from `EXPECTED_RUNTIME` fails the readiness check, which fails a release.

    **What none of that holds is the value that decides what a user machine does.** `MIN_NODE` is the comparison the launcher makes
    before it will run at all, and the manifest is a declaration about it; if they disagree, a user is told one thing by the release and
    refused by the tool. This is the one direction worth asserting, and it is the enforcer that has to match.
    """

    def test_the_enforced_minimum_matches_the_declared_one(self):
        manifest = (ROOT / "scripts" / "build-release-manifest.mts").read_text(encoding="utf-8")
        declared = re.search(r'runtime:\s*\{\s*python:\s*">=([0-9.]+)",\s*node:\s*">=([0-9.]+)"', manifest)
        self.assertIsNotNone(declared, "the manifest no longer states a runtime minimum in the shape this test reads")

        declared_node = tuple(int(part) for part in declared.group(2).split("."))
        self.assertEqual(
            dove_pi.MIN_NODE,
            declared_node,
            "the launcher enforces " + ".".join(str(part) for part in dove_pi.MIN_NODE) + " and the release declares " + declared.group(2),
        )

        python_minimum = tuple(int(part) for part in declared.group(1).split("."))
        source = (ROOT / "dove_pi.py").read_text(encoding="utf-8")
        self.assertIn(
            "sys.version_info < (" + ", ".join(str(part) for part in python_minimum) + ")",
            source,
            "the launcher Python check and the declared minimum have drifted apart",
        )


class EnvironmentVariableTests(unittest.TestCase):
    """Every variable the help names is one the code reads.

    Measured before this existed: the code reads twenty-seven `DOVE_PI_` variables and the documents named four of them. Seven are set by
    the launcher for the extension it starts - internal by construction, the same reading a previous round gave the `extensions` command -
    and the rest are read by a session and were named nowhere, including plainly user-facing knobs like `DOVE_PI_PREFIX_FUSE` and the
    context budget pair. **A knob a user cannot find is a knob that does nothing**, which is the quiet failure this holds against.

    **The check errs toward silence**: it asks whether the name appears in the code at all, not whether it is read at the right moment,
    because any mention counts and a name that appears nowhere is the thing this can be sure about.
    """

    def test_every_variable_the_help_names_is_named_by_the_code(self):
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            self.assertEqual(main(["--help"]), 0)
        help_text = captured.getvalue()

        named = sorted(set(re.findall(r"\b(DOVE_PI_[A-Z0-9_]+)", help_text)))
        self.assertTrue(named, "the help no longer names any Dove variable, which is its own kind of wrong")

        # **The Python side is parsed rather than searched, and the negative control is what forced that.** The help text lives inside
        # dove_pi.py, so a search over that file found the name in the very block that names it - the check passed over a planted
        # variable that nothing reads. An ast walk cannot make that mistake: it sees reads, not text.
        tree = ast.parse((ROOT / "dove_pi.py").read_text(encoding="utf-8"))
        read_in_python = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Subscript) and getattr(node.value, "attr", None) == "environ":
                index = node.slice
                if isinstance(index, ast.Constant) and isinstance(index.value, str):
                    read_in_python.add(index.value)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "get":
                owner = node.func.value
                if getattr(owner, "attr", None) == "environ" and node.args:
                    first = node.args[0]
                    if isinstance(first, ast.Constant) and isinstance(first.value, str):
                        read_in_python.add(first.value)

        sources = ["install.ps1", "bin/dove-pi.cjs"]
        sources += [str(path.relative_to(ROOT)).replace("\\", "/") for path in (ROOT / "src").rglob("*.ts")]
        elsewhere = "\n".join((ROOT / name).read_text(encoding="utf-8", errors="ignore") for name in sources)

        unread = [name for name in named if name not in read_in_python and name not in elsewhere]
        self.assertEqual(unread, [], "the help names a variable nothing in the code mentions: " + ", ".join(unread))


class CrossLanguageSchemaVersionTests(unittest.TestCase):
    """A state file written by one language and read by another has no constant to share.

    `installer/state.py` stamps `STATE_SCHEMA_VERSION` into the managed install state and refuses anything else on read. The TypeScript
    side reads that same file and compares against a literal, because it cannot import a Python constant. **Two literals with nothing
    keeping them in step is the shape a previous round found in the release digest**, and the failure is quiet: a bump on one side leaves
    the other refusing a file the tool just wrote.

    So the pair is declared here. Adding another is a line, and the check is the only thing that can hold a value across the language
    boundary.
    """

    PAIRS = (
        # (python file, python constant, typescript file, the literal it compares against)
        ("installer/state.py", "STATE_SCHEMA_VERSION", "src/managed-install-status.ts"),
    )

    def test_a_version_written_in_python_and_read_in_typescript_agrees(self):
        for python_file, constant, typescript_file in self.PAIRS:
            source = (ROOT / python_file).read_text(encoding="utf-8")
            declared = re.search(re.escape(constant) + r"\s*=\s*([0-9]+)", source)
            self.assertIsNotNone(declared, python_file + " no longer declares " + constant + " as a number")
            value = declared.group(1)

            reader = (ROOT / typescript_file).read_text(encoding="utf-8")
            self.assertIn(
                "schemaVersion) !== " + value,
                reader,
                typescript_file + " reads the state file against a different version than " + python_file + " writes",
            )


class BootstrapDefaultTests(unittest.TestCase):
    """The bootstrap defaults to max, and the flag it passes defaults to the stored profile.

    Both are deliberate - the bootstrap is the fresh-install path and the flag is the maintenance path - and until a round measured
    them, neither document said what the bootstrap applies. A user running the downloaded script without `-Profile` gets `max` even when a
    profile is stored, because the script passes the flag unconditionally.

    **A default is the behaviour a user gets by saying nothing**, which makes it the most-used value and the least examined. This holds
    the two statements against the two declarations.
    """

    def test_the_bootstrap_defaults_are_the_ones_the_contract_states(self):
        bootstrap = (ROOT / "install.ps1").read_text(encoding="utf-8")
        contract = (ROOT / ".trellis" / "spec" / "backend" / "personal-agent-managed-install.md").read_text(encoding="utf-8")

        for parameter, value in (("Profile", "max"), ("Verify", "quick")):
            declaration = "[string]$" + parameter + " = '" + value + "'"
            self.assertIn(declaration, bootstrap, "install.ps1 no longer defaults -" + parameter + " to " + value)
            self.assertIn(
                "-" + parameter + " " + value,
                contract,
                "the contract does not state the bootstrap default -" + parameter + " " + value,
            )


if __name__ == "__main__":
    unittest.main()
