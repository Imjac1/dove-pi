import { runPowerShell } from "./powershell.ts";

export interface WindowsDoctorReport {
	readonly available: boolean;
	readonly executable: string;
	readonly version?: string;
	readonly isAdministrator?: boolean;
	readonly tools: Record<string, string | null>;
	readonly error?: string;
}

const SCRIPT = `$names = @('git','docker','ssh','nmap','hydra')
$tools = @{}
foreach ($name in $names) {
  $command = Get-Command $name -ErrorAction SilentlyContinue
  $tools[$name] = if ($command) { $command.Source } else { $null }
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
[pscustomobject]@{
  version = $PSVersionTable.PSVersion.ToString()
  isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  tools = $tools
} | ConvertTo-Json -Compress`;

export async function inspectWindowsEnvironment(cwd?: string): Promise<WindowsDoctorReport> {
	const result = await runPowerShell(SCRIPT, { cwd, timeoutMs: 15_000 });
	if (result.exitCode !== 0) {
		return { available: false, executable: result.executable, tools: {}, error: result.stderr || `PowerShell exited with ${result.exitCode}` };
	}
	const parsed = JSON.parse(result.stdout) as { version?: string; isAdministrator?: boolean; tools?: Record<string, string | null> };
	return { available: true, executable: result.executable, version: parsed.version, isAdministrator: parsed.isAdministrator, tools: parsed.tools ?? {} };
}
