import json
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import zipfile

from dove_pi import validate_managed_prerequisites


ROOT = Path(__file__).resolve().parents[1]
BOOTSTRAP = ROOT / "install.ps1"


class BootstrapPrerequisiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.powershell = shutil.which("powershell.exe") or shutil.which("pwsh")
        if not cls.powershell:
            raise unittest.SkipTest("PowerShell is unavailable")

    def run_harness(self, body):
        escaped = str(BOOTSTRAP).replace("'", "''")
        command = f". '{escaped}'; {body}"
        environment = dict(os.environ)
        environment["DOVE_PI_BOOTSTRAP_TEST_ONLY"] = "1"
        completed = subprocess.run(
            [self.powershell, "-NoLogo", "-NoProfile", "-Command", command],
            cwd=ROOT,
            env=environment,
            text=True,
            capture_output=True,
            timeout=30,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        lines = [line for line in completed.stdout.splitlines() if line.strip()]
        self.assertTrue(lines, completed.stdout)
        return json.loads(lines[-1])

    def test_compatible_runtime_is_preserved_without_winget(self):
        result = self.run_harness(
            "$script:wingetLookups = 0; "
            "$resolver = { param($name,$minimum,$arguments,$companion) "
            "[pscustomobject]@{Path='C:\\existing.exe';Version='3.12.4';Compatible=$true;Reason=''} }; "
            "$find = { $script:wingetLookups++; 'C:\\winget.exe' }; "
            "$runtime = Ensure-DovePrerequisite -DisplayName Python -CommandName python "
            "-Minimum ([version]'3.10.0') -VersionArguments @('--version') "
            "-WingetPackage Python.Python.3.12 -ResolveRuntime $resolver -FindWinget $find; "
            "[pscustomobject]@{path=$runtime.Path;wingetLookups=$script:wingetLookups} | ConvertTo-Json -Compress"
        )
        self.assertEqual(result, {"path": "C:\\existing.exe", "wingetLookups": 0})

    def test_real_native_python_runtime_is_detected(self):
        python = str(Path(os.sys.executable)).replace("'", "''")
        result = self.run_harness(
            f"function Get-DoveCommandPath([string]$Name) {{ '{python}' }}; "
            "$runtime=Get-DoveRuntime python ([version]'3.10.0') "
            "@('-c','import platform; print(platform.python_version())'); "
            "[pscustomobject]@{present=[bool]$runtime;compatible=$runtime.Compatible;version=$runtime.Version}|ConvertTo-Json -Compress"
        )
        self.assertTrue(result["present"])
        self.assertTrue(result["compatible"])
        self.assertRegex(result["version"], r"^\d+\.\d+(?:\.\d+)?$")

    def test_missing_runtime_is_installed_then_re_resolved(self):
        result = self.run_harness(
            "$script:resolveCalls=0; $script:installs=0; $script:refreshes=0; "
            "$resolver={ param($name,$minimum,$arguments,$companion) $script:resolveCalls++; "
            "if($script:resolveCalls -eq 1){ return $null }; "
            "[pscustomobject]@{Path='C:\\python.exe';Version='3.12.4';Compatible=$true;Reason=''} }; "
            "$find={ 'C:\\winget.exe' }; "
            "$install={ param($winget,$package) $script:installs++ }; "
            "$refresh={ $script:refreshes++ }; "
            "$null=Ensure-DovePrerequisite -DisplayName Python -CommandName python "
            "-Minimum ([version]'3.10.0') -VersionArguments @('--version') "
            "-WingetPackage Python.Python.3.12 -ResolveRuntime $resolver -FindWinget $find "
            "-InstallRuntime $install -RefreshPath $refresh; "
            "[pscustomobject]@{resolveCalls=$script:resolveCalls;installs=$script:installs;refreshes=$script:refreshes} | ConvertTo-Json -Compress"
        )
        self.assertEqual(result, {"resolveCalls": 2, "installs": 1, "refreshes": 1})

    def test_outdated_runtime_uses_the_exact_reviewed_package(self):
        result = self.run_harness(
            "$script:resolveCalls=0; $script:package=''; "
            "$resolver={ param($name,$minimum,$arguments,$companion) $script:resolveCalls++; "
            "if($script:resolveCalls -eq 1){ return [pscustomobject]@{Path='C:\\node.exe';Version='20.0.0';Compatible=$false;Reason=''} }; "
            "[pscustomobject]@{Path='C:\\node.exe';Version='24.0.0';Compatible=$true;Reason=''} }; "
            "$install={ param($winget,$package) $script:package=$package }; "
            "$null=Ensure-DovePrerequisite -DisplayName 'Node.js' -CommandName node "
            "-Minimum ([version]'22.19.0') -VersionArguments @('--version') "
            "-WingetPackage OpenJS.NodeJS.LTS -ResolveRuntime $resolver -FindWinget { 'C:\\winget.exe' } "
            "-InstallRuntime $install -RefreshPath {}; "
            "[pscustomobject]@{package=$script:package;command=(Get-DoveWingetInstallCommand $script:package)} | ConvertTo-Json -Compress"
        )
        self.assertEqual(result["package"], "OpenJS.NodeJS.LTS")
        self.assertEqual(
            result["command"],
            "winget install --id OpenJS.NodeJS.LTS --exact --source winget --silent --accept-source-agreements --accept-package-agreements",
        )

    def test_winget_unavailable_fails_before_install_with_one_retry_command(self):
        result = self.run_harness(
            "$resolver={ param($name,$minimum,$arguments,$companion) $null }; "
            "$result = try { $null=Ensure-DovePrerequisite -DisplayName Python -CommandName python "
            "-Minimum ([version]'3.10.0') -VersionArguments @('--version') "
            "-WingetPackage Python.Python.3.12 -ResolveRuntime $resolver -FindWinget { $null }; "
            "[pscustomobject]@{ok=$true} } catch { [pscustomobject]@{ok=$false;message=$_.Exception.Message} }; "
            "$result | ConvertTo-Json -Compress"
        )
        self.assertFalse(result["ok"])
        self.assertIn("winget is unavailable", result["message"])
        self.assertIn("winget install --id Python.Python.3.12 --exact", result["message"])
        self.assertIn("retry the Dove Pi bootstrap", result["message"])

    def test_post_install_still_missing_is_actionable(self):
        result = self.run_harness(
            "$resolver={ param($name,$minimum,$arguments,$companion) $null }; "
            "$result = try { $null=Ensure-DovePrerequisite -DisplayName Python -CommandName python "
            "-Minimum ([version]'3.10.0') -VersionArguments @('--version') "
            "-WingetPackage Python.Python.3.12 -ResolveRuntime $resolver -FindWinget { 'C:\\winget.exe' } "
            "-InstallRuntime {} -RefreshPath {}; [pscustomobject]@{ok=$true} } "
            "catch { [pscustomobject]@{ok=$false;message=$_.Exception.Message} }; $result | ConvertTo-Json -Compress"
        )
        self.assertFalse(result["ok"])
        self.assertIn("still missing or too old", result["message"])
        self.assertIn("Open a new terminal", result["message"])

    def test_path_refresh_composes_machine_then_user_without_mutation(self):
        result = self.run_harness(
            "[pscustomobject]@{combined=(Join-DoveProcessPath 'C:\\Machine' 'C:\\User'); "
            "machineOnly=(Join-DoveProcessPath 'C:\\Machine' '')} | ConvertTo-Json -Compress"
        )
        self.assertEqual(result, {"combined": "C:\\Machine;C:\\User", "machineOnly": "C:\\Machine"})

    def test_powershell_core_is_a_supported_same_release_fallback(self):
        result = self.run_harness(
            "function Get-DoveCommandPath([string]$Name) { "
            "if($Name -eq 'pwsh.exe'){ return 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' }; $null }; "
            "[pscustomobject]@{path=(Get-DovePowerShellPath)}|ConvertTo-Json -Compress"
        )
        self.assertEqual(result["path"], "C:\\Program Files\\PowerShell\\7\\pwsh.exe")

    def test_complete_bootstrap_success_path_with_unicode_workspace(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary) / "鹈鹕 bootstrap"
            assets = root / "assets"
            release_root = root / "release-source"
            assets.mkdir(parents=True)
            release_root.mkdir()
            record = root / "installer-arguments.json"
            manifest = {
                "schemaVersion": 1,
                "version": "0.3.0",
                "releaseId": "0.3.0+bootstrap-e2e",
                "platform": "windows",
            }
            manifest_text = json.dumps(manifest, ensure_ascii=False, separators=(",", ":"))
            (assets / "release.json").write_text(manifest_text, encoding="utf-8")
            (release_root / "release.json").write_text(manifest_text, encoding="utf-8")
            (release_root / "dove_pi.py").write_text(
                "import json, os, pathlib, sys\n"
                "pathlib.Path(os.environ['DOVE_BOOTSTRAP_RECORD']).write_text("
                "json.dumps(sys.argv[1:]), encoding='utf-8')\n",
                encoding="utf-8",
            )
            archive = assets / "dove-pi-windows.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                for path in release_root.iterdir():
                    bundle.write(path, path.name)
            (assets / "dove-pi-windows.zip.sha256").write_text(
                f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  dove-pi-windows.zip\n",
                encoding="ascii",
            )

            def ps_quote(value: Path | str) -> str:
                return str(value).replace("'", "''")

            escaped_bootstrap = ps_quote(BOOTSTRAP)
            command = (
                f". '{escaped_bootstrap}'; "
                f"$script:fixtureAssets='{ps_quote(assets)}'; "
                f"$env:DOVE_PI_HOME='{ps_quote(root / 'managed')}'; "
                f"$env:DOVE_BOOTSTRAP_RECORD='{ps_quote(record)}'; "
                "$script:NoPath=$true; $script:NoFont=$true; $script:NoExtensions=$true; "
                "$script:ReleaseBaseUrl='https://fixture.invalid/'; "
                "$script:ManifestUrl=$script:ReleaseBaseUrl+'release.json'; "
                "function Ensure-DovePrerequisite { param($DisplayName); "
                f"if($DisplayName -eq 'Python'){{[pscustomobject]@{{Path='{ps_quote(Path(os.sys.executable))}';Version='3.11.0';Compatible=$true;Reason=''}}}} "
                "else{[pscustomobject]@{Path='C:\\node.exe';Version='22.19.0';Compatible=$true;Reason=''}} }; "
                "function Invoke-WebRequest { param([switch]$UseBasicParsing,[string]$Uri,$Headers,[string]$OutFile,[switch]$PassThru); "
                "$name=[IO.Path]::GetFileName(([Uri]$Uri).AbsolutePath); Copy-Item -LiteralPath (Join-Path $script:fixtureAssets $name) -Destination $OutFile; "
                "if($PassThru){[pscustomobject]@{BaseResponse=$null}} }; "
                "Invoke-DoveBootstrap"
            )
            environment = dict(os.environ)
            environment["DOVE_PI_BOOTSTRAP_TEST_ONLY"] = "1"
            environment["OS"] = "Windows_NT"
            completed = subprocess.run(
                [self.powershell, "-NoLogo", "-NoProfile", "-Command", command],
                cwd=ROOT,
                env=environment,
                text=True,
                capture_output=True,
                timeout=30,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn("[1/5] Prerequisites", completed.stdout)
            self.assertIn("[5/5] Ready", completed.stdout)
            arguments = json.loads(record.read_text(encoding="utf-8"))
            self.assertEqual(arguments[:5], ["install", "--profile", "max", "--verify", "quick"])
            self.assertEqual(arguments[-2:], ["--source-tag", "v0.3.0"])
            self.assertIn("--source-archive", arguments)
            self.assertIn("--source-checksum", arguments)
            self.assertIn("--no-path", arguments)
            self.assertIn("--no-font", arguments)
            self.assertIn("--no-extensions", arguments)

    def test_embedded_manifest_must_exactly_match_downloaded_manifest(self):
        result = self.run_harness(
            "$root=Join-Path ([IO.Path]::GetTempPath()) ('dove-manifest-test-'+[guid]::NewGuid().ToString('N')); "
            "New-Item -ItemType Directory -Path $root|Out-Null; "
            "$expectedPath=Join-Path $root 'expected.json'; $actualPath=Join-Path $root 'actual.json'; "
            "$expectedJson='{\"schemaVersion\":1,\"version\":\"0.3.0\",\"releaseId\":\"0.3.0+abc\",\"platform\":\"windows\",\"components\":{\"pi\":\"0.84.3\"}}'; "
            "$actualJson='{\"schemaVersion\":1,\"version\":\"0.3.0\",\"releaseId\":\"0.3.0+abc\",\"platform\":\"windows\",\"components\":{\"pi\":\"0.84.2\"}}'; "
            "Set-Content -LiteralPath $expectedPath -Value $expectedJson -Encoding UTF8; Set-Content -LiteralPath $actualPath -Value $actualJson -Encoding UTF8; "
            "$expected=$expectedJson|ConvertFrom-Json; $actual=$actualJson|ConvertFrom-Json; "
            "$check=try { Assert-DoveManifestIdentity $expected $actual $expectedPath $actualPath; [pscustomobject]@{ok=$true} } "
            "catch { [pscustomobject]@{ok=$false;message=$_.Exception.Message} }; "
            "$check|ConvertTo-Json -Compress; Remove-Item -LiteralPath $root -Recurse -Force"
        )
        self.assertFalse(result["ok"])
        self.assertIn("exactly match", result["message"])

    def test_object_storage_redirect_keeps_latest_download_base(self):
        result = self.run_harness(
            "$fallback='https://github.com/Imjac1/dove-pi/releases/latest/download/'; "
            "$object=Get-DoveResolvedReleaseBase 'https://release-assets.githubusercontent.com/object/release.json?sig=x' 'v0.3.0' $fallback; "
            "$tagged=Get-DoveResolvedReleaseBase 'https://github.com/Imjac1/dove-pi/releases/download/v0.3.0/release.json' 'v0.3.0' $fallback; "
            "[pscustomobject]@{object=$object;tagged=$tagged}|ConvertTo-Json -Compress"
        )
        self.assertEqual(result["object"], "https://github.com/Imjac1/dove-pi/releases/latest/download/")
        self.assertEqual(result["tagged"], "https://github.com/Imjac1/dove-pi/releases/download/v0.3.0/")

    def test_bootstrap_uses_direct_release_assets_not_rest(self):
        source = BOOTSTRAP.read_text(encoding="utf-8")
        self.assertIn("releases/latest/download/", source)
        self.assertIn("release.json", source)
        self.assertNotIn("api.github.com", source)
        self.assertNotIn("Invoke-RestMethod", source)

    def test_running_cli_points_missing_node_back_to_the_public_bootstrap(self):
        with patch("dove_pi.node_version", side_effect=RuntimeError("node is required but was not found in PATH")):
            with self.assertRaisesRegex(RuntimeError, "releases/latest/download/install.ps1"):
                validate_managed_prerequisites()

    def test_same_release_is_reused_without_archive_download(self):
        result = self.run_harness(
            "$root=Join-Path ([IO.Path]::GetTempPath()) ('dove-bootstrap-test-'+[guid]::NewGuid().ToString('N')); "
            "$env:DOVE_PI_HOME=$root; $install=Join-Path $root 'app\\versions\\current'; "
            "New-Item -ItemType Directory -Path (Join-Path $root 'state'),(Join-Path $root 'bin'),(Join-Path $install 'node_modules') -Force|Out-Null; "
            "New-Item -ItemType File -Path (Join-Path $root 'bin\\dove-pi.ps1'),(Join-Path $install 'dove_pi.py'),(Join-Path $install 'release.json') -Force|Out-Null; "
            "$state=@{schemaVersion=2;profile='max';current=@{version='0.3.0';releaseId='0.3.0+abc';installPath=$install}}|ConvertTo-Json -Depth 4; "
            "Set-Content -LiteralPath (Join-Path $root 'state\\install.json') -Value $state -Encoding UTF8; "
            "$launcher=Get-DoveReusableLauncher '0.3.0' '0.3.0+abc' 'max'; "
            "[pscustomobject]@{reused=[bool]$launcher;wrongIdentity=[bool](Get-DoveReusableLauncher '0.3.0' '0.3.0+other' 'max')}|ConvertTo-Json -Compress; "
            "Remove-Item -LiteralPath $root -Recurse -Force"
        )
        self.assertEqual(result, {"reused": True, "wrongIdentity": False})

    def test_same_release_bootstrap_respects_advanced_switches(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            managed = root / "managed"
            install = managed / "app" / "versions" / "current"
            assets = root / "assets"
            record = root / "launcher-calls.jsonl"
            (managed / "state").mkdir(parents=True)
            (managed / "bin").mkdir()
            (install / "node_modules").mkdir(parents=True)
            assets.mkdir()
            manifest = {
                "schemaVersion": 1,
                "version": "0.3.0",
                "releaseId": "0.3.0+same-release",
                "platform": "windows",
            }
            manifest_text = json.dumps(manifest, separators=(",", ":"))
            (assets / "release.json").write_text(manifest_text, encoding="utf-8")
            (install / "release.json").write_text(manifest_text, encoding="utf-8")
            (install / "dove_pi.py").write_text("# managed marker\n", encoding="utf-8")
            (managed / "state" / "install.json").write_text(
                json.dumps(
                    {
                        "schemaVersion": 2,
                        "profile": "max",
                        "current": {
                            "version": "0.3.0",
                            "releaseId": "0.3.0+same-release",
                            "installPath": str(install),
                        },
                    }
                ),
                encoding="utf-8",
            )
            (managed / "bin" / "dove-pi.ps1").write_text(
                "[IO.File]::AppendAllText($env:DOVE_BOOTSTRAP_RECORD, (($args | ConvertTo-Json -Compress) + [Environment]::NewLine))\n",
                encoding="utf-8",
            )

            def ps_quote(value: Path | str) -> str:
                return str(value).replace("'", "''")

            result = self.run_harness(
                f"$script:fixtureAssets='{ps_quote(assets)}'; "
                f"$env:DOVE_PI_HOME='{ps_quote(managed)}'; "
                f"$env:DOVE_BOOTSTRAP_RECORD='{ps_quote(record)}'; "
                "$script:NoPath=$true; $script:NoFont=$true; $script:NoExtensions=$true; "
                "$script:ReleaseBaseUrl='https://fixture.invalid/'; "
                "$script:ManifestUrl=$script:ReleaseBaseUrl+'release.json'; "
                "$script:pathWrites=0; "
                "function Add-DoveUserPath { $script:pathWrites++ }; "
                "function Ensure-DovePrerequisite { param($DisplayName); "
                f"if($DisplayName -eq 'Python'){{[pscustomobject]@{{Path='{ps_quote(Path(os.sys.executable))}';Version='3.11.0';Compatible=$true;Reason=''}}}} "
                "else{[pscustomobject]@{Path='C:\\node.exe';Version='22.19.0';Compatible=$true;Reason=''}} }; "
                "function Invoke-WebRequest { param([switch]$UseBasicParsing,[string]$Uri,$Headers,[string]$OutFile,[switch]$PassThru); "
                "$name=[IO.Path]::GetFileName(([Uri]$Uri).AbsolutePath); Copy-Item -LiteralPath (Join-Path $script:fixtureAssets $name) -Destination $OutFile; "
                "if($PassThru){[pscustomobject]@{BaseResponse=$null}} }; "
                "Invoke-DoveBootstrap; "
                "[pscustomobject]@{pathWrites=$script:pathWrites} | ConvertTo-Json -Compress"
            )
            calls = [json.loads(line) for line in record.read_text(encoding="utf-8-sig").splitlines() if line]
            self.assertEqual(result["pathWrites"], 0)
            self.assertEqual(calls, [["repair", "--verify", "quick", "--no-extensions"]])

    def test_same_release_with_changed_manifest_is_not_reused(self):
        result = self.run_harness(
            "$root=Join-Path ([IO.Path]::GetTempPath()) ('dove-bootstrap-test-'+[guid]::NewGuid().ToString('N')); "
            "$env:DOVE_PI_HOME=$root; $install=Join-Path $root 'app\\versions\\current'; "
            "New-Item -ItemType Directory -Path (Join-Path $root 'state'),(Join-Path $root 'bin'),(Join-Path $install 'node_modules') -Force|Out-Null; "
            "New-Item -ItemType File -Path (Join-Path $root 'bin\\dove-pi.ps1'),(Join-Path $install 'dove_pi.py') -Force|Out-Null; "
            "$expectedPath=Join-Path $root 'expected.json'; $installedPath=Join-Path $install 'release.json'; "
            "$expectedJson='{\"schemaVersion\":1,\"version\":\"0.3.0\",\"releaseId\":\"0.3.0+abc\",\"platform\":\"windows\",\"components\":{\"pi\":\"0.84.3\"}}'; "
            "$installedJson='{\"schemaVersion\":1,\"version\":\"0.3.0\",\"releaseId\":\"0.3.0+abc\",\"platform\":\"windows\",\"components\":{\"pi\":\"0.84.2\"}}'; "
            "Set-Content -LiteralPath $expectedPath -Value $expectedJson -Encoding UTF8; Set-Content -LiteralPath $installedPath -Value $installedJson -Encoding UTF8; "
            "$state=@{schemaVersion=2;profile='max';current=@{version='0.3.0';releaseId='0.3.0+abc';installPath=$install}}|ConvertTo-Json -Depth 4; "
            "Set-Content -LiteralPath (Join-Path $root 'state\\install.json') -Value $state -Encoding UTF8; "
            "$expected=$expectedJson|ConvertFrom-Json; "
            "$launcher=Get-DoveReusableLauncher '0.3.0' '0.3.0+abc' 'max' $expected $expectedPath; "
            "[pscustomobject]@{reused=[bool]$launcher}|ConvertTo-Json -Compress; Remove-Item -LiteralPath $root -Recurse -Force"
        )
        self.assertEqual(result, {"reused": False})


if __name__ == "__main__":
    unittest.main()
