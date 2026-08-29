import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension, { compactModelPayload, compactToolResultContent, getProjectContextBudget, getRemainingContextChars, shouldOfferProjectBootstrap } from "../src/pi-adapter/extension.ts";
import { hasHashlineEditTools, selectDoveToolNames } from "../src/pi-adapter/tool-profile.ts";
import { formatProgressSnapshot, ProgressGuard } from "../src/pi-adapter/progress-guard.ts";
import { representativeTools } from "./fixtures/representative-tool-catalog.ts";

const adapterStateDir = mkdtempSync(join(tmpdir(), "pi-adapter-state-"));
const previousStateDir = process.env.DOVE_PI_STATE_DIR;
process.env.DOVE_PI_STATE_DIR = adapterStateDir;
after(() => {
	if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
	else process.env.DOVE_PI_STATE_DIR = previousStateDir;
	rmSync(adapterStateDir, { recursive: true, force: true });
});

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
		let hostActiveTools: string[] = [];
		let providerAborted = false;
		const api = {
			registerCommand(name: string, definition: { handler: (args: string, ctx: FakeContext) => Promise<void> }) { commands.set(name, definition); },
			registerShortcut(key: string, definition: { handler: (ctx: FakeContext) => Promise<void> }) { shortcuts.set(key, definition); },
			registerTool(definition: { name: string }) { tools.set(definition.name, definition); },
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return representativeTools.map((name) => ({ name })); },
			setActiveTools(names: string[]) { hostActiveTools = [...names]; activeToolSets.push(names); },
			getActiveTools() { return hostActiveTools; },
			getThinkingLevel() { return "max"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;

		extension(api);
		assert.deepEqual([...commands.keys()], ["mode", "status", "sysprompt", "reasoning-voice", "dove-thinking", "dove-tools", "设置", "settings-zh", "capabilities", "web", "skills", "project", "task", "memory"]);
		assert.equal(commands.has("thinking"), false, "Dove must not shadow Pi's built-in /thinking command");
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
		assert.ok(events.has("before_provider_request"));
		assert.ok(events.has("after_provider_response"));
		const context: FakeContext = {
			ui: {
				theme: { fg: (color, value) => { statusColors.push(color); return value; } },
				setStatus: (_key, value) => { if (value) statuses.push(value); },
				notify: (message) => { notifications.push(message); },
			},
			sessionManager: { getEntries: () => [], getSessionId: () => "session-test" },
			abort: () => { providerAborted = true; },
		};
		const headers: Record<string, string> = {};
		await events.get("before_provider_headers")?.({ type: "before_provider_headers", headers }, { ...context, model: { provider: "cc-switch-open-router", baseUrl: "https://openrouter.ai/api" } });
		assert.equal(headers["x-session-affinity"], "session-test");
		const preservedHeaders = { "x-session-affinity": "existing" };
		await events.get("before_provider_headers")?.({ type: "before_provider_headers", headers: preservedHeaders }, { ...context, model: { provider: "cc-switch-open-router" } });
		assert.equal(preservedHeaders["x-session-affinity"], "existing");
		const beforeProviderRequest = events.get("before_provider_request");
		assert.ok(beforeProviderRequest);
		await beforeProviderRequest({ type: "before_provider_request", payload: { max_tokens: 20, messages: [{ role: "user", content: "x".repeat(2_000) }] } }, { ...context, model: { contextWindow: 100, maxTokens: 20 } });
		assert.equal(providerAborted, true, "an over-budget Pi request must abort the host operation instead of relying on a swallowed exception");
		await events.get("session_start")?.(undefined, context);
		assert.deepEqual(activeToolSets.at(-1), []);
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
		providerAborted = false;
		const unknownProviderPayload = { messages: [{ role: "user", content: "ok" }] };
		const unknownProviderResult = await beforeProviderRequest({ type: "before_provider_request", payload: unknownProviderPayload }, { ...context, model: { contextWindow: 12_800, maxTokens: 16_384 } });
		assert.equal(providerAborted, true, "Dove must abort when an unknown provider field prevents a required safe clamp");
		assert.equal(unknownProviderResult, undefined, "Dove must not invent a provider-specific output field");
		providerAborted = false;
		const boundedProviderPayload = await beforeProviderRequest({ type: "before_provider_request", payload: { max_tokens: 16_384, messages: [{ role: "user", content: "ok" }] } }, { ...context, model: { contextWindow: 12_800, maxTokens: 16_384 } });
		assert.equal(providerAborted, false);
		assert.equal((boundedProviderPayload as { max_tokens?: number })?.max_tokens, 12_543, "the payload sent by Pi must use the larger safe output reservation Dove accounted for");
		providerAborted = false;
		await beforeProviderRequest({
			type: "before_provider_request",
			payload: { max_tokens: 20, messages: [{ role: "user", content: "ok" }], tools: [{ type: "function", function: { name: "large", description: "x".repeat(1_000), parameters: {} } }] },
		}, { ...context, model: { contextWindow: 400, maxTokens: 20 } });
		assert.equal(providerAborted, true, "the final Pi gate must reject the real serialized tool schema rather than a count-only estimate");
		const dsmlResult = await events.get("message_end")?.({
			message: {
				role: "assistant",
				content: [{ type: "thinking", thinking: '<｜DSML｜tool_calls><｜DSML｜invoke name="read"><｜DSML｜parameter name="path" string="true">README.md</｜DSML｜parameter></｜DSML｜invoke></｜DSML｜tool_calls>', thinkingSignature: "" }],
				stopReason: "toolUse",
			},
		}, context);
		const dsmlMessage = (dsmlResult as { message?: { content?: Array<{ type: string; name?: string }> } } | undefined)?.message;
		assert.equal(dsmlMessage?.content?.[0]?.type, "toolCall");
		assert.equal(dsmlMessage?.content?.[0]?.name, "read");
		assert.match(readFileSync(join(adapterStateDir, "execution.jsonl"), "utf8"), /"stopReason":"tool_call"/);

		await commands.get("mode")?.handler("fast", context);
		assert.ok(statuses.some((value) => value.includes("Dove · Fast · Ready")));
		await commands.get("mode")?.handler("ultra", context);
		assert.ok(statuses.filter((value) => value.includes("Dove ✦ Ultra · Ready")).length >= 2);
		await commands.get("skills")?.handler("trellis", context);
		assert.ok(notifications.some((value) => value.includes("trellis-start")));
		await commands.get("project")?.handler("doctor", context);
		assert.ok(notifications.some((value) => value.includes("Provider: trellis")));
		hostActiveTools = ["mcp", "fusion_reason", "bg_delegate"];
		const freshChat = await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.deepEqual(activeToolSets.at(-1), [], "fresh Chat must expose zero tools and reassert Dove policy after third-party activation");
		assert.equal((freshChat as { message?: unknown })?.message, undefined, "fresh Chat must not append project context");
		const firstStartResult = await events.get("before_agent_start")?.({ prompt: "打开网页并截图", systemPrompt: "", type: "before_agent_start" }, context);
		const firstStartMessage = (firstStartResult as { message?: { customType?: string; details?: { schemaVersion?: number; segments?: unknown[] } } })?.message;
		const firstSystemPrompt = String((firstStartResult as { systemPrompt?: string })?.systemPrompt);
		assert.equal(firstStartMessage, undefined, "a lookup with no relevant project segments must not append an empty context wrapper");
		const lookupToolSet = activeToolSets.at(-1) ?? [];
		for (const name of ["web_search", "source_check", "fetch_content", "get_search_content"]) assert.ok(lookupToolSet.includes(name));
		assert.equal(lookupToolSet.includes("agent_browser"), false, "Lookup must not expose browser automation");
		assert.equal(lookupToolSet.includes("mcp"), false, "Lookup must not expose generic MCP dispatch");
		const autoToolSetCount = activeToolSets.length;
		const hiStart = await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, autoToolSetCount + 1, "Lookup -> Chat must remove the prior request's schemas");
		assert.deepEqual(activeToolSets.at(-1), []);
		assert.equal(String((hiStart as { systemPrompt?: string })?.systemPrompt), firstSystemPrompt, "Dove's provider-prefix policy stays stable across intent changes");
		const consecutiveChatCount = activeToolSets.length;
		await events.get("before_agent_start")?.({ prompt: "hello", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount, "consecutive requests with the same exact set must not call setActiveTools again");
		hostActiveTools = [...hostActiveTools, "mcp", "fusion_reason", "bg_delegate"];
		await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount + 1, "Dove reasserts its request-exact set after later third-party activation");
		assert.deepEqual(activeToolSets.at(-1), []);
		await events.get("before_agent_start")?.({ prompt: "修复登录问题，打开浏览器并通过 MCP 委派后台任务", systemPrompt: "", type: "before_agent_start" }, context);
		const executionToolSet = activeToolSets.at(-1) ?? [];
		for (const name of ["bash", "write", "replace", "insert", "agent_workspace_patch", "agent_browser", "mcp", "bg_delegate"]) assert.ok(executionToolSet.includes(name), `Execution must expose ${name}`);
		await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.deepEqual(activeToolSets.at(-1), [], "Execution -> Chat must drop every mutation schema");
		await events.get("before_agent_start")?.({ prompt: "修复登录问题，打开浏览器并通过 MCP 委派后台任务", systemPrompt: "", type: "before_agent_start" }, context);
		await events.get("before_agent_start")?.({ prompt: "读取 package.json", systemPrompt: "", type: "before_agent_start" }, context);
		const exactLookupToolSet = activeToolSets.at(-1) ?? [];
		for (const name of ["bash", "powershell", "write", "replace", "insert", "agent_workspace_patch", "agent_project_task", "agent_browser", "mcp", "mcpScript", "fusion_reason", "bg_delegate"]) {
			assert.equal(exactLookupToolSet.includes(name), false, `Execution -> Lookup must drop ${name}`);
		}
		assert.deepEqual(exactLookupToolSet, selectDoveToolNames(representativeTools, "auto", "lookup", "读取 package.json"));
		assert.match(firstSystemPrompt, /\[DOVE REGISTERED CAPABILITIES\]/);
		const isolatedChat = await events.get("context")?.({
			type: "context",
			messages: [
				{ role: "user", content: [{ type: "text", text: "hi" }], timestamp: 1 },
				{ role: "custom", customType: "personal-agent-context", content: "previous project PRD", display: false, details: { schemaVersion: 2, epoch: "old" }, timestamp: 2 },
				{ role: "assistant", content: [{ type: "text", text: "hello" }], timestamp: 3 },
			],
		}, context);
		assert.equal(isolatedChat, undefined, "ordinary Chat must preserve the current v2 message and provider ordering");
		const notificationCount = notifications.length;
		await commands.get("mode")?.handler("max", context);
		assert.equal(notifications.length, notificationCount + 1);
		assert.equal(notifications.at(-1), "Mode must be fast, standard, or ultra.");
		await commands.get("dove-tools")?.handler("full", context);
		assert.deepEqual(activeToolSets.at(-1), selectDoveToolNames(representativeTools, "full"));
		await commands.get("dove-tools")?.handler("reset", context);
		assert.deepEqual(activeToolSets.at(-1), [], "reset returns Auto to its zero-tool Chat baseline");
		const emptyLookup = await events.get("before_agent_start")?.(
			{ prompt: "打开网页并截图", systemPrompt: "", type: "before_agent_start" },
			{ ...context, model: { contextWindow: 100_000 } },
		);
		assert.equal((emptyLookup as { message?: unknown })?.message, undefined, "an empty lookup must not emit a wrapper or consume the project epoch");
		const budgetOmitted = await events.get("before_agent_start")?.(
			{ prompt: "修复 Provider Prompt-Cache Boundary", systemPrompt: "", type: "before_agent_start" },
			{ ...context, model: { contextWindow: 1_000 } },
		);
		assert.doesNotMatch(String((budgetOmitted as { message?: { content?: string } })?.message?.content), /\[PERSONAL AGENT REQUEST CONTEXT\]/);
		const beforeStart = await events.get("before_agent_start")?.(
			{ prompt: "修复 Provider Prompt-Cache Boundary", systemPrompt: "", type: "before_agent_start" },
			{ ...context, model: { contextWindow: 100_000 } },
		);
		// Prompt-specific guidance is delivered for the current request, while the
		// project snapshot itself stays tied to the stable mode/revision epoch.
		const beforeStartMessage = (beforeStart as { message?: { content?: string; details?: { guidance?: boolean; segments?: unknown[] } } })?.message;
		assert.match(beforeStartMessage?.content ?? "", /trellis-before-dev/);
		assert.match(beforeStartMessage?.content ?? "", /\[PERSONAL AGENT REQUEST CONTEXT\]/);
		assert.equal(beforeStartMessage?.details?.guidance, true);
		assert.ok((beforeStartMessage?.details?.segments?.length ?? 0) > 0, "an empty lookup must not consume the epoch needed by a later relevant project request");
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
		assert.match(String((repeatedStart as { message?: { content?: string } })?.message?.content), /trellis-before-dev/, "current-turn guidance must not be stranded in an older snapshot");
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

		const derivedContext = `[PERSONAL AGENT REQUEST CONTEXT]\n${"d".repeat(250)}`;
		await events.get("context")?.({
			type: "context",
			messages: [
				{ role: "user", content: [{ type: "text", text: "keep" }], timestamp: 29 },
				{ role: "custom", customType: "personal-agent-context", content: derivedContext, display: false, details: { schemaVersion: 2, epoch: "budget" }, timestamp: 30 },
			],
		}, context);
		providerAborted = false;
		const literalUserContext = `[PERSONAL AGENT REQUEST CONTEXT]\n${"u".repeat(250)}`;
		const compactedProviderPayload = await beforeProviderRequest({
			type: "before_provider_request",
			payload: {
				max_tokens: 20,
				messages: [
					{ role: "user", content: literalUserContext, timestamp: 29 },
					{ role: "user", content: derivedContext, timestamp: 30 },
				],
			},
		}, { ...context, model: { contextWindow: 380, maxTokens: 20 } });
		assert.equal(providerAborted, false);
		assert.deepEqual(
			(compactedProviderPayload as { messages?: Array<{ timestamp?: number }> })?.messages?.map((message) => message.timestamp),
			[29],
			"budget fallback removes only the exact Dove-derived message and preserves user text containing the same marker",
		);

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
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser", "web_search"], "auto", "lookup", "打开网页并截图"), ["read", "agent_doctor", "web_search"]);
		assert.deepEqual(selectDoveToolNames(["read", "plan_mode_question"], "auto", "lookup", "explain this error"), ["read"]);
		assert.deepEqual(selectDoveToolNames(["read", "lsp_diagnostics", "symbol_search"], "auto", "project-work", "继续当前任务", "08-25-execute-assembly-impl e2e protocol"), ["read", "lsp_diagnostics", "symbol_search"]);
		assert.deepEqual(selectDoveToolNames(["read", "lsp_diagnostics", "symbol_search"], "auto", "project-work", "继续", "Personal Agent OS"), ["read", "lsp_diagnostics", "symbol_search"]);
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser"], "full"), ["read", "agent_doctor", "agent_browser"]);
		assert.equal(hasHashlineEditTools(["read", "replace", "insert", "grep"]), true);
		assert.deepEqual(selectDoveToolNames(["read", "edit", "grep", "replace", "insert"], "core"), ["read", "grep"]);
		assert.deepEqual(selectDoveToolNames(["read", "edit", "grep", "replace", "insert"], "auto", "execution"), ["read", "grep", "replace", "insert"]);
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

	it("enforces read-only mode across project, workspace, and side-effect capability paths", async () => {
		const tools = new Map<string, { execute: (...args: any[]) => Promise<any> }>();
		const api = {
			registerCommand() {},
			registerShortcut() {},
			registerTool(definition: { name: string; execute: (...args: any[]) => Promise<any> }) { tools.set(definition.name, definition); },
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return [{ name: "read" }, { name: "agent_doctor" }]; },
			setActiveTools() {},
			getActiveTools() { return []; },
			getThinkingLevel() { return "medium"; },
			on() {},
		} as unknown as ExtensionAPI;
		const confirmations: string[] = [];
		const context: FakeContext = {
			hasUI: true,
			ui: {
				theme: { fg: (_color, value) => value },
				setStatus: () => {},
				notify: () => {},
				confirm: async (message: string) => { confirmations.push(message); return true; },
			},
			sessionManager: { getEntries: () => [], getSessionId: () => "read-only-test" },
		};
		const previous = process.env.DOVE_PI_READ_ONLY;
		process.env.DOVE_PI_READ_ONLY = "1";
		try {
			extension(api);
			const projectTask = await tools.get("agent_project_task")?.execute("call", { operation: "finish" }, undefined, undefined, context);
			assert.equal(projectTask?.details?.blocked, true);
			const restore = await tools.get("agent_workspace_restore")?.execute("call", { snapshotId: "missing" }, undefined, undefined, context);
			assert.equal(restore?.details?.ok, false);
			const patch = await tools.get("agent_workspace_patch")?.execute("call", { operations: [] }, undefined, undefined, context);
			assert.equal(patch?.details?.appliedOperations, 0);
			const capability = await tools.get("agent_run_capability")?.execute("call", { name: "dev.project_test" }, undefined, undefined, context);
			assert.equal(capability?.details?.status, "approval_denied");
			assert.equal(confirmations.length, 0, "read-only mode must not surface an approval that can re-enable side effects");
		} finally {
			if (previous === undefined) delete process.env.DOVE_PI_READ_ONLY;
			else process.env.DOVE_PI_READ_ONLY = previous;
		}
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

	it("limits first-request project context for small model windows", () => {
		const budget = getProjectContextBudget({ contextWindow: 12_800, promptChars: 18_000 });
		assert.ok(budget);
		assert.ok(budget <= 8_000, `budget=${budget}`);
		const observed = getProjectContextBudget({ tokens: 23_218, contextWindow: 12_800 });
		assert.equal(observed, 1_024);
		assert.equal(getProjectContextBudget({ promptChars: 1_000 }), undefined);
	});

	it("auto policy respects explicit per-model thinking level from settings", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "pi-adapter-fix1-"));
		const agentDir = join(tmpDir, "agent");
		mkdirSync(agentDir, { recursive: true });
		writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ defaultThinkingLevel: "max", modelThinkingLevels: { "cc-switch-open-router/deepseek-v4-flash-0731": "max" } }), "utf8");
		const prevEnv = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = agentDir;
		try {
			const commands = new Map<string, { handler: (args: string, ctx: FakeContext) => Promise<void> }>();
			const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
			const sets: string[] = [];
			const api = {
				registerCommand(name: string, definition: { handler: (args: string, ctx: FakeContext) => Promise<void> }) { commands.set(name, definition); },
				registerShortcut() {},
				registerTool() {},
				registerFlag() {},
				appendEntry() {},
				getAllTools() { return [{ name: "read" }, { name: "agent_doctor" }]; },
				setActiveTools() {},
				getActiveTools() { return []; },
				getThinkingLevel() { return "max"; },
				setThinkingLevel(level: string) { sets.push(level); },
				on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
			} as unknown as ExtensionAPI;
			extension(api);
			const context: FakeContext = {
				model: { provider: "cc-switch-open-router", id: "deepseek-v4-flash-0731" },
				ui: { theme: { fg: (c, v) => v }, setStatus: () => {}, notify: () => {} },
				sessionManager: { getEntries: () => [] },
			};
			// Auto policy + explicit per-model max -> must NOT override with mode level
			await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
			assert.deepEqual(sets, [], "explicit per-model level must be respected by auto policy");
		} finally {
			if (prevEnv === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = prevEnv;
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("auto policy asserts mode level when no explicit thinking level configured", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "pi-adapter-fix1b-"));
		const agentDir = join(tmpDir, "agent");
		mkdirSync(agentDir, { recursive: true });
		writeFileSync(join(agentDir, "settings.json"), JSON.stringify({}), "utf8");
		const prevEnv = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = agentDir;
		try {
			const commands = new Map<string, { handler: (args: string, ctx: FakeContext) => Promise<void> }>();
			const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
			const sets: string[] = [];
			const api = {
				registerCommand(name: string, definition: { handler: (args: string, ctx: FakeContext) => Promise<void> }) { commands.set(name, definition); },
				registerShortcut() {},
				registerTool() {},
				registerFlag() {},
				appendEntry() {},
				getAllTools() { return [{ name: "read" }, { name: "agent_doctor" }]; },
				setActiveTools() {},
				getActiveTools() { return []; },
				getThinkingLevel() { return "medium"; },
				setThinkingLevel(level: string) { sets.push(level); },
				on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
			} as unknown as ExtensionAPI;
			extension(api);
			const context: FakeContext = {
				model: { provider: "some-provider", id: "some-model" },
				ui: { theme: { fg: (c, v) => v }, setStatus: () => {}, notify: () => {} },
				sessionManager: { getEntries: () => [] },
			};
			// No explicit config -> auto derives standard->high and asserts it
			await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
			assert.deepEqual(sets, ["high"], "auto policy must assert mode-derived level when no explicit config");
		} finally {
			if (prevEnv === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = prevEnv;
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});
});

interface FakeContext {
	hasUI?: boolean;
	model?: unknown;
	ui: {
		theme: { fg: (color: string, value: string) => string };
		setStatus: (key: string, value: string | undefined) => void;
		notify: (message: string, level?: string) => void;
		confirm?: (message: string, detail?: string) => Promise<boolean>;
	};
	sessionManager: { getEntries: () => unknown[]; getSessionId?: () => string };
	abort?: () => void;
}
