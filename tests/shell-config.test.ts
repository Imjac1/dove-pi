import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectShellConfig, setShellPath, shellSettingsPath } from "../src/pi-adapter/shell-config.ts";

function createFixture(): { root: string; env: NodeJS.ProcessEnv } {
	const root = mkdtempSync(join(tmpdir(), "dove-shell-config-"));
	return { root, env: { ...process.env, PI_CODING_AGENT_DIR: join(root, "agent") } };
}

describe("shell configuration", () => {
	it("reads the global shellPath from the configured Pi agent directory", () => {
		const { root, env } = createFixture();
		try {
			const path = shellSettingsPath("global", root, env);
			mkdirSync(join(root, "agent"), { recursive: true });
			writeFileSync(path, JSON.stringify({ shellPath: process.execPath }), "utf8");
			const result = inspectShellConfig(root, env);
			assert.equal(result.source, "global");
			assert.equal(result.path, path);
			assert.equal(result.configuredPath, process.execPath);
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	it("prefers the project setting over a global setting", () => {
		const { root, env } = createFixture();
		try {
			const globalPath = shellSettingsPath("global", root, env);
			const projectPath = shellSettingsPath("project", root, env);
			mkdirSync(join(root, "agent"), { recursive: true });
			mkdirSync(join(root, ".pi"), { recursive: true });
			writeFileSync(globalPath, JSON.stringify({ shellPath: process.execPath }), "utf8");
			writeFileSync(projectPath, JSON.stringify({ shellPath: process.execPath, otherSetting: true }), "utf8");
			const result = inspectShellConfig(root, env);
			assert.equal(result.source, "project");
			assert.equal(result.path, projectPath);
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	it("restores automatic resolution without removing unrelated project settings", () => {
		const { root, env } = createFixture();
		try {
			const projectPath = shellSettingsPath("project", root, env);
			mkdirSync(join(root, ".pi"), { recursive: true });
			writeFileSync(projectPath, JSON.stringify({ shellPath: process.execPath, theme: "dark" }), "utf8");
			const result = setShellPath("auto", "project", root, env);
			assert.equal(result.source, "auto");
			assert.deepEqual(JSON.parse(readFileSync(projectPath, "utf8")), { theme: "dark" });
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	it("rejects a missing or directory shell path before creating settings", () => {
		const { root, env } = createFixture();
		try {
			assert.throws(() => setShellPath(join(root, "missing-bash.exe"), "project", root, env), /does not exist/);
			assert.throws(() => setShellPath(root, "project", root, env), /not a file/);
			assert.equal(existsSync(shellSettingsPath("project", root, env)), false);
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	it("uses PI_CODING_AGENT_DIR for global settings", () => {
		const { root, env } = createFixture();
		try {
			assert.equal(shellSettingsPath("global", root, env), join(root, "agent", "settings.json"));
		} finally { rmSync(root, { recursive: true, force: true }); }
	});
});
