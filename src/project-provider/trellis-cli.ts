import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

export async function initializeTrellis(projectRoot: string): Promise<void> {
	if (existsSync(join(projectRoot, ".trellis"))) throw new Error(`Trellis is already initialized at ${projectRoot}`);
	// Pi owns the interactive host, so avoid nesting Trellis' questionnaire
	// inside the Pi TUI. The Codex preset is used only as Trellis' shared-skill
	// compatibility path: it creates .agents/skills without installing
	// Trellis' own .pi extension, which would overlap Dove's adapter.
	await runTrellisCli(projectRoot, ["init", "--yes", "--codex", "--no-monorepo"]);
}

export async function updateTrellis(projectRoot: string): Promise<void> {
	if (!existsSync(join(projectRoot, ".trellis"))) throw new Error(`No Trellis project found at ${projectRoot}; run '/project init' first`);
	await runTrellisCli(projectRoot, ["update"]);
}

export async function runTrellisCli(projectRoot: string, command: readonly string[]): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn("trellis", [...command], { cwd: projectRoot, stdio: "inherit", shell: process.platform === "win32", windowsHide: false });
		child.on("error", (error) => reject(new Error(`Trellis CLI is unavailable; install/configure it explicitly before running 'trellis ${command.join(" ")}'. ${error.message}`)));
		child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`trellis ${command[0] ?? "command"} exited with ${code ?? "unknown status"}`)));
	});
}
