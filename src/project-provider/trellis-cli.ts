import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

export async function initializeTrellis(projectRoot: string): Promise<void> {
	if (existsSync(join(projectRoot, ".trellis"))) throw new Error(`Trellis is already initialized at ${projectRoot}`);
	await runTrellisCli(projectRoot, ["init"]);
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
