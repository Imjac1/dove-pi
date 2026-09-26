import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension from "../src/pi-adapter/extension.ts";
import { resolveActionIdentity } from "../src/pi-adapter/action-identity.ts";
import { representativeTools } from "./fixtures/representative-tool-catalog.ts";

const repoRoot = process.cwd();
const stateDir = mkdtempSync(join(tmpdir(), "dove-mode-host-state-"));
const previousStateDir = process.env.DOVE_PI_STATE_DIR;
const previousFrameworkVersion = process.env.DOVE_PI_FRAMEWORK_VERSION;
process.env.DOVE_PI_STATE_DIR = stateDir;
after(() => {
	if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
	else process.env.DOVE_PI_STATE_DIR = previousStateDir;
	if (previousFrameworkVersion === undefined) delete process.env.DOVE_PI_FRAMEWORK_VERSION;
	else process.env.DOVE_PI_FRAMEWORK_VERSION = previousFrameworkVersion;
	rmSync(stateDir, { recursive: true, force: true });
});

interface FakeContext {
	hasUI?: boolean;
	ui: { theme: { fg: (color: string, value: string) => string }; setStatus: (key: string, value: string | undefined) => void; notify: (message: string, level?: string) => void };
	sessionManager: { getEntries: () => unknown[]; getBranch?: () => unknown[]; getSessionId?: () => string };
}

/** A host that records what the extension registers, so the handlers can be invoked the way Pi invokes them. */
function startHost(root: string) {
	const previousCwd = process.cwd();
	process.chdir(root);
	const events = new Map<string, (event: any, ctx: any) => Promise<any>>();
	const notifications: string[] = [];
	const tools = new Map<string, { name: string }>();
	const api = {
		registerCommand() {},
		registerShortcut() {},
		registerFlag() {},
		appendEntry() {},
		registerTool(definition: { name: string }) { tools.set(definition.name, definition); },
		getAllTools() { return representativeTools.map((name) => ({ name })); },
		setActiveTools() {},
		getActiveTools() { return [...representativeTools]; },
		getThinkingLevel() { return "max"; },
		on(name: string, handler: (event: any, ctx: any) => Promise<any>) { events.set(name, handler); },
	} as unknown as ExtensionAPI;
	extension(api);
	const context: FakeContext = {
		hasUI: true,
		ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify: (message: string) => { notifications.push(message); } },
		sessionManager: { getEntries: () => [], getBranch: () => [], getSessionId: () => "work-mode-test" },
	};
	return { events, notifications, context, tools, restoreCwd: () => process.chdir(previousCwd) };
}

function freshRoot(): string {
	return mkdtempSync(join(tmpdir(), "dove-mode-root-"));
}

function declareMode(root: string, value: string): void {
	mkdirSync(join(root, ".dove"), { recursive: true });
	writeFileSync(join(root, ".dove", "mode.json"), value);
}

/** Copy a shipped mode into the throwaway workspace, reading the real files so the fixture cannot drift. */
function copyMode(root: string, name: string): void {
	const target = join(root, "modes", name);
	mkdirSync(target, { recursive: true });
	for (const file of ["MODE.md", "governance.yaml", "permissions.yaml"]) {
		writeFileSync(join(target, file), readFileSync(join(repoRoot, "modes", name, file), "utf8"));
	}
}

async function callTool(host: ReturnType<typeof startHost>, toolName: string, input: unknown): Promise<{ block?: boolean; reason?: string } | undefined> {
	const handler = host.events.get("tool_call");
	if (handler === undefined) throw new Error("the extension registered no tool_call handler, so this test would prove nothing");
	return handler({ type: "tool_call", toolCallId: "c-1", toolName, input }, host.context);
}

describe("the host loads the work mode (design 5.4: 'loaded by the host' is the point)", () => {
	it("names the action a tool call is, so a capability invocation is not its tool name", () => {
		assert.deepEqual(resolveActionIdentity("bash", { command: "ls" }), { action: "bash", viaCapability: false });
		assert.deepEqual(resolveActionIdentity("agent_run_capability", { name: "shell.exec", args: {} }), { action: "shell.exec", viaCapability: true });
		assert.deepEqual(
			resolveActionIdentity("agent_run_capability", {}),
			{ action: "agent_run_capability.<unnamed>", viaCapability: true },
			"an unnameable capability call stays inside a namespace a mode can still deny",
		);
	});

	it("blocks every tool call when a declared mode cannot be read, instead of running without it", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		declareMode(root, "{ not json");
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(
				host.notifications.some((message) => /not "no mode declared"/.test(message)),
				"the operator is told the difference between a broken declaration and none: " + host.notifications.join(" | "),
			);
			const decision = await callTool(host, "bash", { command: "ls" });
			assert.equal(decision?.block, true, "an unreadable declaration stops the action rather than degrading to no mode");
			assert.match(decision?.reason ?? "", /\[Dove mode\]/);
		} finally {
			host.restoreCwd();
		}
	});

	it("enforces the loaded mode's never_allow against the action, and leaves an unlisted tool alone", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "code-audit");
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "code-audit" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(host.notifications.some((message) => /code-audit loaded from modes\/code-audit/.test(message)), host.notifications.join(" | "));
			assert.ok(
				host.notifications.some((message) => /ask_before is not consumed yet/.test(message)),
				"the half that is not enforced is stated rather than implied",
			);

			// code-audit's never_allow names 'shell.exec', a Dove action. It is reached through the capability tool,
			// which is exactly why the action mapping exists: matched against the tool name it would never fire.
			const denied = await callTool(host, "agent_run_capability", { name: "shell.exec", args: {} });
			assert.equal(denied?.block, true, "the mode's deny list must actually fire");
			assert.match(denied?.reason ?? "", /never_allow/);
			assert.match(denied?.reason ?? "", /shell\.exec/);

			const bash = await callTool(host, "bash", { command: "git status --short" });
			assert.notEqual(bash?.block, true, "bash is not on this mode's deny list, and the mapping is what makes that distinguishable");
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses a declared mode when the framework version is unavailable, rather than comparing a different number", async () => {
		const root = freshRoot();
		delete process.env.DOVE_PI_FRAMEWORK_VERSION;
		copyMode(root, "code-audit");
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "code-audit" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(host.notifications.some((message) => /DOVE_PI_FRAMEWORK_VERSION is not set/.test(message)), host.notifications.join(" | "));
			const decision = await callTool(host, "bash", { command: "ls" });
			assert.equal(decision?.block, true, "a mode whose range cannot be checked must not start");
		} finally {
			host.restoreCwd();
		}
	});

	it("runs with no mode when nothing is declared, and does not report that as a problem", async () => {
		const root = freshRoot();
		delete process.env.DOVE_PI_FRAMEWORK_VERSION;
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.equal(
				host.notifications.some((message) => /\[Dove mode\]/.test(message)),
				false,
				"no declaration is a legitimate state and must not be announced as an error",
			);
			const decision = await callTool(host, "bash", { command: "ls" });
			assert.notEqual(decision?.block, true);
		} finally {
			host.restoreCwd();
		}
	});
});
