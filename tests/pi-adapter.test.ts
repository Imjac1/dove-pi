import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension, { compactModelPayload, compactToolResultContent, getRemainingContextChars, shouldOfferProjectBootstrap } from "../src/pi-adapter/extension.ts";
import { hasHashlineEditTools, selectDoveToolNames } from "../src/pi-adapter/tool-profile.ts";
import { formatProgressSnapshot, ProgressGuard } from "../src/pi-adapter/progress-guard.ts";

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
			getThinkingLevel() { return "max"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;

		extension(api);
		assert.deepEqual([...commands.keys()], ["mode", "status", "sysprompt", "reasoning-voice", "thinking", "dove-tools", "设置", "settings-zh", "capabilities", "web", "skills", "project", "task", "memory"]);
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
		assert.ok(events.has("message_end"));
		assert.ok(events.has("tool_result"));
		assert.ok(events.has("thinking_level_select"));
		assert.ok(events.has("before_provider_headers"));
		const context: FakeContext = {
			ui: {
				theme: { fg: (color, value) => { statusColors.push(color); return value; } },
				setStatus: (_key, value) => { if (value) statuses.push(value); },
				notify: (message) => { notifications.push(message); },
			},
			sessionManager: { getEntries: () => [], getSessionId: () => "session-test" },
		};
		const headers: Record<string, string> = {};
		await events.get("before_provider_headers")?.({ type: "before_provider_headers", headers }, { ...context, model: { provider: "cc-switch-open-router", baseUrl: "https://openrouter.ai/api" } });
		assert.equal(headers["x-session-affinity"], "session-test");
		const preservedHeaders = { "x-session-affinity": "existing" };
		await events.get("before_provider_headers")?.({ type: "before_provider_headers", headers: preservedHeaders }, { ...context, model: { provider: "cc-switch-open-router" } });
		assert.equal(preservedHeaders["x-session-affinity"], "existing");
		await events.get("session_start")?.(undefined, context);
		assert.deepEqual(activeToolSets.at(-1), ["read", "agent_doctor"]);
		assert.ok(statuses.some((value) => value.includes("Dove ◆ Standard · Ready")));
		assert.ok(statuses.some((value) => value.includes("Pi max")));
		assert.ok(notifications.some((value) => value.includes("Ctrl+P 切换模型")));
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		await events.get("tool_result")?.({ type: "tool_result", toolName: "bash", toolCallId: "1", input: { command: "bad" }, content: [{ type: "text", text: "failed" }], isError: true }, { ...context, hasUI: true });
		await events.get("tool_result")?.({ type: "tool_result", toolName: "bash", toolCallId: "2", input: { command: "bad" }, content: [{ type: "text", text: "failed" }], isError: true }, { ...context, hasUI: true });
		assert.ok(notifications.some((value) => value.includes("同一个工具失败调用重复 2 次")));
		assert.match(notifications.find((value) => value.includes("同一个工具失败调用重复 2 次")) ?? "", /重新读取当前状态/);
		await events.get("agent_end")?.({ type: "agent_end", messages: [] }, context);
		await shortcuts.get("ctrl+alt+m")?.handler(context);
		assert.ok(statuses.some((value) => value.includes("Dove ✦ Ultra · Ready")));
		assert.ok(statusColors.includes("thinkingMax"));
		const dsmlResult = await events.get("message_end")?.({
			message: {
				role: "assistant",
				content: [{ type: "thinking", thinking: '<｜DSML｜tool_calls><｜DSML｜invoke name="read"><｜DSML｜parameter name="path" string="true">README.md</｜DSML｜parameter></｜DSML｜invoke></｜DSML｜tool_calls>', thinkingSignature: "" }],
			},
		}, context);
		const dsmlMessage = (dsmlResult as { message?: { content?: Array<{ type: string; name?: string }> } } | undefined)?.message;
		assert.equal(dsmlMessage?.content?.[0]?.type, "toolCall");
		assert.equal(dsmlMessage?.content?.[0]?.name, "read");

		await commands.get("mode")?.handler("fast", context);
		assert.ok(statuses.some((value) => value.includes("Dove · Fast · Ready")));
		await commands.get("mode")?.handler("ultra", context);
		assert.ok(statuses.filter((value) => value.includes("Dove ✦ Ultra · Ready")).length >= 2);
		await commands.get("skills")?.handler("trellis", context);
		assert.ok(notifications.some((value) => value.includes("trellis-start")));
		await commands.get("project")?.handler("doctor", context);
		assert.ok(notifications.some((value) => value.includes("Provider: trellis")));
		const firstStartResult = await events.get("before_agent_start")?.({ prompt: "打开网页并截图", systemPrompt: "", type: "before_agent_start" }, context);
		const firstStartMessage = (firstStartResult as { message?: { customType?: string; details?: { schemaVersion?: number } } })?.message;
		assert.equal(firstStartMessage?.customType, "personal-agent-context");
		assert.equal(firstStartMessage?.details?.schemaVersion, 2);
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
		await commands.get("dove-tools")?.handler("reset", context);
		assert.deepEqual(activeToolSets.at(-1), ["read", "agent_doctor"]);
		const beforeStart = await events.get("before_agent_start")?.({ prompt: "修复登录超时问题", systemPrompt: "", type: "before_agent_start" }, context);
		// Epoch is stable (mode + project revision): a prompt that only changes the
		// workflow-skill suggestion must NOT re-emit the context snapshot, so the
		// provider prompt-cache prefix survives intent flips.
		assert.equal((beforeStart as { message?: unknown })?.message, undefined, "prompt-dependent suggestion must not re-emit the context snapshot");
		assert.doesNotMatch(String((beforeStart as { systemPrompt?: string })?.systemPrompt), /trellis-before-dev/);
		assert.match(String((beforeStart as { systemPrompt?: string })?.systemPrompt), /supplied separately at request time/);
		const sysCaptured = notifications.length;
		await commands.get("sysprompt")?.handler("", context);
		assert.ok(notifications.slice(sysCaptured).at(-1)?.includes("[PERSONAL AGENT]"));
		assert.ok(notifications.slice(sysCaptured).at(-1)?.includes("supplied separately at request time"));
		await commands.get("reasoning-voice")?.handler("off", context);
		const withoutVoiceStart = await events.get("before_agent_start")?.({ prompt: "修复登录超时问题", systemPrompt: "", type: "before_agent_start" }, context);
		assert.doesNotMatch(String((withoutVoiceStart as { systemPrompt?: string })?.systemPrompt), /We need|first-person-plural/);
		await commands.get("reasoning-voice")?.handler("on", context);
		const withVoiceStart = await events.get("before_agent_start")?.({ prompt: "修复登录超时问题", systemPrompt: "", type: "before_agent_start" }, context);
		assert.match(String((withVoiceStart as { systemPrompt?: string })?.systemPrompt), /first-person-plural/);
		const repeatedStart = await events.get("before_agent_start")?.({ prompt: "修复登录超时问题", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal((repeatedStart as { message?: unknown })?.message, undefined, "unchanged context epochs must not append another snapshot");
		const contextResult = await events.get("context")?.({
			type: "context",
			messages: [
				{ role: "custom", customType: "personal-agent-context", content: "legacy", display: false, timestamp: 1 },
				{ role: "user", content: [{ type: "text", text: "keep" }], timestamp: 2 },
				{ role: "custom", customType: "personal-agent-context", content: [{ type: "text", text: "current" }], display: false, details: { schemaVersion: 2, epoch: "test" }, timestamp: 3 },
			],
		}, context);
		const contextMessages = (contextResult as { messages?: Array<{ role?: string; content?: unknown }> })?.messages ?? [];
		assert.equal(contextMessages.length, 2, "legacy context entries are removed without reordering current history");
		assert.equal(contextMessages[0]?.role, "user");
		assert.match(JSON.stringify(contextMessages[1]?.content), /current/);
		const appendOnlyResult = await events.get("context")?.({
			type: "context",
			messages: [
				{ role: "user", content: [{ type: "text", text: "keep" }], timestamp: 2 },
				{ role: "custom", customType: "personal-agent-context", content: "current", display: false, details: { schemaVersion: 2, epoch: "test" }, timestamp: 3 },
				{ role: "assistant", content: [{ type: "text", text: "answer" }], timestamp: 4 },
				{ role: "toolResult", toolCallId: "1", toolName: "read", content: [{ type: "text", text: "result" }], isError: false, timestamp: 5 },
			],
		}, context);
		assert.equal(appendOnlyResult, undefined, "v2 context history remains append-only across provider requests");
	});

	it("warns once for a repeated failure and resets after progress", () => {
		const guard = new ProgressGuard({ consecutiveErrorThreshold: 3, repeatedFailureThreshold: 2, longRunMinutes: 1 });
		guard.start(1_000);
		assert.equal(guard.recordToolResult({ toolName: "read", input: { path: "missing" }, isError: true }, 2_000)?.kind, undefined);
		assert.equal(guard.recordToolResult({ toolName: "read", input: { path: "missing" }, isError: true }, 3_000)?.kind, "repeated-failure");
		assert.equal(guard.recordToolResult({ toolName: "read", input: { path: "missing" }, isError: true }, 4_000)?.kind, "consecutive-errors");
		assert.equal(guard.recordToolResult({ toolName: "read", input: { path: "ok" }, isError: false }, 5_000), undefined);
		assert.equal(guard.snapshot(61_001).longRun, true);
		assert.match(formatProgressSnapshot(guard.snapshot(61_001), 61_001), /longRun=true/);
	});

	it("keeps only the compact core tool set by default", () => {
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser", "web_search"], "core"), ["read", "agent_doctor"]);
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser", "web_search"], "auto", "打开网页并截图"), ["read", "agent_doctor", "agent_browser", "web_search"]);
		assert.deepEqual(selectDoveToolNames(["read", "plan_mode_question"], "auto", "explain this error"), ["read", "plan_mode_question"]);
		assert.deepEqual(selectDoveToolNames(["read", "lsp_diagnostics", "symbol_search"], "auto", "继续当前任务", "08-25-execute-assembly-impl e2e protocol"), ["read", "lsp_diagnostics", "symbol_search"]);
		assert.deepEqual(selectDoveToolNames(["read", "lsp_diagnostics", "symbol_search"], "auto", "继续", "Personal Agent OS"), ["read"]);
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser"], "full"), ["read", "agent_doctor", "agent_browser"]);
		assert.equal(hasHashlineEditTools(["read", "replace", "insert", "grep"]), true);
		assert.deepEqual(selectDoveToolNames(["read", "edit", "grep", "replace", "insert"], "core"), ["read", "grep", "replace", "insert"]);
		assert.deepEqual(selectDoveToolNames(["read", "edit", "grep", "replace", "insert"], "full"), ["read", "grep", "replace", "insert"]);
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

	it("bounds oversized built-in tool results without changing small results", () => {
		assert.equal(compactToolResultContent([{ type: "text", text: "small" }]), undefined);
		const compacted = compactToolResultContent([{ type: "text", text: "x".repeat(40_000) }], 1_000);
		assert.ok(compacted);
		assert.ok((compacted?.[0] as { text: string }).text.length <= 1_100);
		assert.match((compacted?.[0] as { text: string }).text, /tool result compacted/);
		const withImage = compactToolResultContent([{ type: "text", text: "x".repeat(40_000) }, { type: "image", data: "abc", mimeType: "image/png" }], 1_000);
		assert.equal(withImage?.some((part) => part.type === "image"), true);
	});

	it("derives an Ultra context budget from the active model window", () => {
		assert.equal(getRemainingContextChars(undefined, 200_000), undefined);
		assert.equal(getRemainingContextChars(10_000, undefined), undefined);
		const remaining = getRemainingContextChars(180_000, 200_000);
		assert.ok(remaining && remaining >= 4_096 && remaining < 60_000);
	});
});

interface FakeContext {
	hasUI?: boolean;
	model?: unknown;
	ui: {
		theme: { fg: (color: string, value: string) => string };
		setStatus: (key: string, value: string | undefined) => void;
		notify: (message: string, level?: string) => void;
	};
	sessionManager: { getEntries: () => unknown[]; getSessionId?: () => string };
}
