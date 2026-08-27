import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension, { compactModelPayload, shouldOfferProjectBootstrap } from "../src/pi-adapter/extension.ts";
import { selectDoveToolNames } from "../src/pi-adapter/tool-profile.ts";

describe("Pi adapter", () => {
	it("registers modes, shortcuts, capabilities, and doctor", async () => {
		const commands = new Map<string, { handler: (args: string, ctx: FakeContext) => Promise<void> }>();
		const shortcuts = new Map<string, { handler: (ctx: FakeContext) => Promise<void> }>();
		const tools = new Map<string, unknown>();
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const statuses: string[] = [];
		const statusColors: string[] = [];
		const notifications: string[] = [];
		const activeToolSets: string[][] = [];
		const api = {
			registerCommand(name: string, definition: { handler: (args: string, ctx: FakeContext) => Promise<void> }) { commands.set(name, definition); },
			registerShortcut(key: string, definition: { handler: (ctx: FakeContext) => Promise<void> }) { shortcuts.set(key, definition); },
			registerTool(definition: { name: string }) { tools.set(definition.name, definition); },
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return [{ name: "read" }, { name: "agent_doctor" }, { name: "agent_browser" }]; },
			setActiveTools(names: string[]) { activeToolSets.push(names); },
			getActiveTools() { return activeToolSets.at(-1) ?? []; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;

		extension(api);
		assert.deepEqual([...commands.keys()], ["mode", "status", "dove-tools", "设置", "settings-zh", "capabilities", "skills", "project", "task", "memory"]);
		assert.equal(shortcuts.size, 2);
		assert.ok(shortcuts.has("ctrl+shift+l"));
		assert.ok(shortcuts.has("ctrl+alt+m"));
		assert.ok(tools.has("agent_run_capability"));
		assert.ok(tools.has("agent_list_capabilities"));
		assert.ok(tools.has("agent_doctor"));
		assert.ok(tools.has("agent_project_status"));
		assert.ok(tools.has("agent_project_task"));
		assert.ok(tools.has("agent_project_context"));
		assert.ok(tools.has("agent_workspace_snapshot"));
		assert.ok(tools.has("agent_workspace_verify"));
		assert.ok(tools.has("agent_workspace_restore"));
		assert.ok(tools.has("agent_workspace_patch"));
		const projectContextTool = tools.get("agent_project_context") as { execute: (...args: unknown[]) => Promise<{ content: Array<{ text?: string }> }> };
		const projectContextResult = await projectContextTool.execute("test-call", {});
		const projectContextText = projectContextResult.content[0]?.text ?? "";
		assert.ok(projectContextText.length < 20_000, "project context without a query must remain an index, not a raw project dump");
		assert.match(projectContextText, /intentionally an index/);
		assert.match(projectContextText, /"taskCount"/);
		assert.ok(events.has("before_agent_start"));
		assert.ok(events.has("thinking_level_select"));
		const context: FakeContext = {
			ui: {
				theme: { fg: (color, value) => { statusColors.push(color); return value; } },
				setStatus: (_key, value) => { if (value) statuses.push(value); },
				notify: (message) => { notifications.push(message); },
			},
			sessionManager: { getEntries: () => [] },
		};
		await events.get("session_start")?.(undefined, context);
		assert.deepEqual(activeToolSets.at(-1), ["read", "agent_doctor"]);
		assert.ok(statuses.some((value) => value.includes("Dove ◆ Standard · Ready")));
		assert.ok(notifications.some((value) => value.includes("Ctrl+P 切换模型")));
		await shortcuts.get("ctrl+alt+m")?.handler(context);
		assert.ok(statuses.some((value) => value.includes("Dove ✦ Ultra · Ready")));
		assert.ok(statusColors.includes("thinkingMax"));

		await commands.get("mode")?.handler("fast", context);
		assert.ok(statuses.some((value) => value.includes("Dove · Fast · Ready")));
		await commands.get("mode")?.handler("ultra", context);
		assert.ok(statuses.filter((value) => value.includes("Dove ✦ Ultra · Ready")).length >= 2);
		await commands.get("skills")?.handler("trellis", context);
		assert.ok(notifications.some((value) => value.includes("trellis-start")));
		await commands.get("project")?.handler("doctor", context);
		assert.ok(notifications.some((value) => value.includes("Provider: trellis")));
		await events.get("before_agent_start")?.({ prompt: "打开网页并截图", systemPrompt: "", type: "before_agent_start" }, context);
		assert.ok(activeToolSets.at(-1)?.includes("agent_browser"));
		const autoToolSetCount = activeToolSets.length;
		await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, autoToolSetCount, "auto mode keeps intent tools instead of rebuilding the set");
		const notificationCount = notifications.length;
		await commands.get("mode")?.handler("max", context);
		assert.equal(notifications.length, notificationCount + 1);
		assert.equal(notifications.at(-1), "Mode must be fast, standard, or ultra.");
		await commands.get("dove-tools")?.handler("full", context);
		assert.deepEqual(activeToolSets.at(-1), ["read", "agent_doctor", "agent_browser"]);
		const beforeStart = await events.get("before_agent_start")?.({ prompt: "修复登录超时问题", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal((beforeStart as { message?: unknown })?.message, undefined);
		assert.doesNotMatch(String((beforeStart as { systemPrompt?: string })?.systemPrompt), /trellis-before-dev/);
		assert.match(String((beforeStart as { systemPrompt?: string })?.systemPrompt), /supplied separately at request time/);
		const contextResult = await events.get("context")?.({
			type: "context",
			messages: [
				{ role: "custom", customType: "personal-agent-context", content: "stale", display: false, timestamp: 1 },
				{ role: "user", content: [{ type: "text", text: "keep" }], timestamp: 2 },
			],
		}, context);
		assert.equal((contextResult as { messages?: unknown[] })?.messages?.length, 2);
		assert.equal(((contextResult as { messages?: Array<{ role?: string }> })?.messages?.[0])?.role, "user");
		assert.equal(((contextResult as { messages?: Array<{ customType?: string }> })?.messages?.[1])?.customType, "personal-agent-context");
	});

	it("keeps only the compact core tool set by default", () => {
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser", "web_search"], "core"), ["read", "agent_doctor"]);
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser", "web_search"], "auto", "打开网页并截图"), ["read", "agent_doctor", "agent_browser", "web_search"]);
		assert.deepEqual(selectDoveToolNames(["read", "plan_mode_question"], "auto", "explain this error"), ["read", "plan_mode_question"]);
		assert.deepEqual(selectDoveToolNames(["read", "lsp_diagnostics", "symbol_search"], "auto", "继续当前任务", "08-25-execute-assembly-impl e2e protocol"), ["read", "lsp_diagnostics", "symbol_search"]);
		assert.deepEqual(selectDoveToolNames(["read", "lsp_diagnostics", "symbol_search"], "auto", "继续", "Personal Agent OS"), ["read"]);
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser"], "full"), ["read", "agent_doctor", "agent_browser"]);
	});

	it("keeps large execution logs out of model-facing tool results", () => {
		const payload = compactModelPayload({ stdout: "x".repeat(10_000), nested: [{ stderr: "y".repeat(9_000) }] }) as { stdout: string; nested: Array<{ stderr: string }> };
		assert.ok(payload.stdout.length < 8_500);
		assert.match(payload.stdout, /truncated/);
		assert.ok(payload.nested[0].stderr.length < 8_500);
	});

	it("does not block a new directory on bootstrap for ordinary greetings", () => {
		assert.equal(shouldOfferProjectBootstrap("hi"), false);
		assert.equal(shouldOfferProjectBootstrap("你好"), false);
		assert.equal(shouldOfferProjectBootstrap("修复登录问题"), true);
		assert.equal(shouldOfferProjectBootstrap("继续当前任务"), true);
	});
});

interface FakeContext {
	ui: {
		theme: { fg: (color: string, value: string) => string };
		setStatus: (key: string, value: string | undefined) => void;
		notify: (message: string, level?: string) => void;
	};
	sessionManager: { getEntries: () => unknown[] };
}
