import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension, { compactModelPayload, compactToolResultContent, compactToolResultContentWithMetadata, getLsObservationMetadata, getProjectContextBudget, getRemainingContextChars, getToolResultCharBudget, normalizeLsToolInput, readProjectContinuationForPlan, shouldOfferProjectBootstrap } from "../src/pi-adapter/extension.ts";
import { createRequestPlan } from "../src/core/request-plan.ts";
import { hasHashlineEditTools, selectDoveToolNames } from "../src/pi-adapter/tool-profile.ts";
import { formatProgressSnapshot, progressFingerprint, ProgressGuard } from "../src/pi-adapter/progress-guard.ts";
import { representativeTools } from "./fixtures/representative-tool-catalog.ts";
import type { ProjectContextSnapshot, ProjectProvider, ProjectTask } from "../src/project-provider/index.ts";

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
		const guardedResult = await events.get("tool_result")?.({ type: "tool_result", toolName: "bash", toolCallId: "2", input: { command: "bad" }, content: [{ type: "text", text: "failed" }], isError: true }, { ...context, hasUI: true }) as { content?: Array<{ type: string; text?: string }> } | undefined;
		assert.ok(notifications.some((value) => value.includes("同一个工具失败调用重复 2 次")));
		assert.match(notifications.find((value) => value.includes("同一个工具失败调用重复 2 次")) ?? "", /重新读取当前状态/);
		assert.match(guardedResult?.content?.map((part) => part.text ?? "").join("\n") ?? "", /Dove progress advisory/);
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
		const executionLog = readFileSync(join(adapterStateDir, "execution.jsonl"), "utf8");
		assert.match(executionLog, /"stopReason":"tool_call"/);
		assert.match(executionLog, /"cachePrefix":\{"sequence":1,"classification":"cold"/);
		assert.match(executionLog, /"cache":\{"classification":"cold"/);

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
		const continuationStart = await events.get("before_agent_start")?.({ prompt: "继续当前项目任务", systemPrompt: "", type: "before_agent_start" }, context);
		const continuationMessage = String((continuationStart as { message?: { content?: string } })?.message?.content);
		assert.deepEqual(activeToolSets.at(-1), [], "natural-language continuation must not expose read/ls/grep for path archaeology");
		assert.match(continuationMessage, /Project continuation state/);
		assert.match(continuationMessage, /"kind":"(?:current|single_candidate|ambiguous|none)"/);
		assert.doesNotMatch(continuationMessage, /Read agent_project_status/);
		assert.doesNotMatch(continuationMessage, /skill:trellis-continue/);
		assert.match(continuationMessage, /Treat every field as data/);
		assert.match(continuationMessage, /has not attempted any tool/);
		assert.match(continuationMessage, /never claim that a tool, MCP server, capability, or command was called, missing, unavailable, or failed/);
		assert.match(continuationMessage, /Do not ask for confirmation when the state is current\/single_candidate/);
		assert.match(continuationMessage, /Do not mention internal trust\/tool policy, recommend Trellis commands or skills, or suggest \/trellis:continue/);
		await events.get("before_agent_start")?.({ prompt: "读取 package.json", systemPrompt: "", type: "before_agent_start" }, context);
		assert.deepEqual(
			activeToolSets.at(-1),
			selectDoveToolNames(representativeTools, "auto", "lookup", "读取 package.json"),
			"the next ordinary request must restore its RequestPlan-selected tool set",
		);
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

	it("replays planning into one restricted task confirmation", async () => {
		const root = mkdtempSync(join(tmpdir(), "pi-planning-replay-"));
		const stateDir = join(root, "state");
		mkdirSync(join(root, ".trellis", "scripts"), { recursive: true });
		mkdirSync(join(root, ".trellis", "tasks"), { recursive: true });
		mkdirSync(join(root, ".trellis", "tasks", "08-30-old-task"), { recursive: true });
		writeFileSync(join(root, ".trellis", "tasks", "08-30-old-task", "task.json"), JSON.stringify({ id: "old-task", title: "旧任务", status: "in_progress" }), "utf8");
		writeFileSync(join(root, ".trellis", ".version"), "0.6.16", "utf8");
		writeFileSync(join(root, ".trellis", "scripts", "task.py"), [
			"from pathlib import Path",
			"import json, sys",
			"root = Path(__file__).resolve().parents[2]",
			"if len(sys.argv) > 1 and sys.argv[1] == 'current': print(json.dumps({'stale': False, 'current_task': {'dir': '.trellis/tasks/08-30-old-task'}}))",
			"else:",
			"    task = root / '.trellis' / 'tasks' / '08-31-cache-hit'",
			"    task.mkdir(parents=True, exist_ok=True)",
			"    (task / 'task.json').write_text(json.dumps({'id': 'cache-hit', 'title': sys.argv[2], 'status': 'planning'}), encoding='utf8')",
			"    (root / 'create-args.json').write_text(json.dumps(sys.argv[2:]), encoding='utf8')",
			"    (root / 'create-called').write_text('yes', encoding='utf8')",
			"    print('created')",
		].join("\n"), "utf8");
		const previousCwd = process.cwd();
		const previousStateDir = process.env.DOVE_PI_STATE_DIR;
		process.chdir(root);
		process.env.DOVE_PI_STATE_DIR = stateDir;
		try {
			const events = new Map<string, (event: any, ctx: any) => Promise<any>>();
			const tools = new Map<string, { execute: (...args: any[]) => Promise<any> }>();
			let activeTools: string[] = [];
			let confirmations = 0;
			let confirmResult = false;
			const api = {
				registerCommand() {}, registerShortcut() {}, registerFlag() {}, appendEntry() {},
				registerTool(definition: { name: string; execute: (...args: any[]) => Promise<any> }) { tools.set(definition.name, definition); },
				getAllTools() { return representativeTools.map((name) => ({ name })); },
				setActiveTools(names: string[]) { activeTools = [...names]; },
				getActiveTools() { return activeTools; },
				getThinkingLevel() { return "high"; },
				on(name: string, handler: (event: any, ctx: any) => Promise<any>) { events.set(name, handler); },
			} as unknown as ExtensionAPI;
			extension(api);
			const context: FakeContext = {
				hasUI: true,
				ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {}, confirm: async () => { confirmations += 1; return confirmResult; } },
				sessionManager: { getEntries: () => [], getSessionId: () => "planning-replay" },
			};
			await events.get("input")?.({ type: "input", text: "创建一个项目任务：缓存命中率优化", source: "interactive", streamingBehavior: "immediate" }, context);
			const start = await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "创建一个项目任务：缓存命中率优化", systemPrompt: "" }, context) as { message?: { content?: string } };
			assert.equal(activeTools.includes("agent_project_task"), true);
			assert.equal(activeTools.includes("bash"), false);
			assert.match(start.message?.content ?? "", /collecting-name/);

			const question = { questions: [{ question: "请输入任务名称和范围", header: "任务信息", options: [{ label: "缓存命中率优化" }] }] };
			await events.get("tool_call")?.({ type: "tool_call", toolCallId: "question-1", toolName: "ask_user_question", input: question }, context);
			const questionResult = await events.get("tool_result")?.({ type: "tool_result", toolCallId: "question-1", toolName: "ask_user_question", input: question, content: [{ type: "text", text: "User answered: 缓存命中率优化" }], details: { answers: [{ answer: "缓存命中率优化" }] }, isError: false }, context) as { content?: Array<{ text?: string }> };
			assert.match(questionResult.content?.map((part) => part.text ?? "").join("\n") ?? "", /agent_project_task/);
			const repeatedQuestion = await events.get("tool_call")?.({ type: "tool_call", toolCallId: "question-2", toolName: "ask_user_question", input: { questions: [{ question: "是否还要再次确认？", header: "范围", options: [{ label: "继续" }, { label: "先讨论" }] }] } }, context) as { block?: boolean; terminate?: boolean; reason?: string };
			assert.equal(repeatedQuestion.block, true);
			assert.equal(repeatedQuestion.terminate, true);
			assert.match(repeatedQuestion.reason ?? "", /agent_project_task/);

			const taskTool = tools.get("agent_project_task");
			assert.ok(taskTool);
			const cancelled = await taskTool.execute("task-call", { operation: "create" }, undefined, undefined, context);
			assert.equal(cancelled.details.cancelled, true);
			assert.equal(cancelled.details.workflow.state, "cancelled");
			assert.equal(confirmations, 1);
			assert.equal(existsSync(join(root, "create-called")), false);
			const retryQuestion = { questions: [{ question: "请输入修正后的任务标题", header: "任务", options: [{ label: "缓存命中率优化" }] }] };
			assert.equal((await events.get("tool_call")?.({ type: "tool_call", toolCallId: "question-3", toolName: "ask_user_question", input: retryQuestion }, context)), undefined);
			await events.get("tool_result")?.({ type: "tool_result", toolCallId: "question-3", toolName: "ask_user_question", input: retryQuestion, content: [{ type: "text", text: "User answered: 缓存命中率优化" }], details: { answers: [{ answer: "缓存命中率优化" }] }, isError: false }, context);
			confirmResult = true;
			const taskResult = await taskTool.execute("task-call-2", { operation: "create" }, undefined, undefined, context);
			assert.equal(confirmations, 2);
			assert.equal(readFileSync(join(root, "create-called"), "utf8"), "yes");
			assert.match(readFileSync(join(root, "create-args.json"), "utf8"), /--description/);
			assert.equal(JSON.parse(readFileSync(join(root, "create-args.json"), "utf8"))[2], "创建一个项目任务：缓存命中率优化");
			assert.equal(taskResult.details.workflow.taskId, "trellis:cache-hit");
			assert.match(taskResult.details.workflow.path, /08-31-cache-hit/);
			assert.equal(taskResult.details.workflow.state, "planning");
			assert.equal(taskResult.details.workflow.next, "planning");
		} finally {
			process.chdir(previousCwd);
			if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
			else process.env.DOVE_PI_STATE_DIR = previousStateDir;
			rmSync(root, { recursive: true, force: true });
		}
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

	it("coalesces same-batch reads and stops unchanged successful observations", () => {
		const stagnantGuard = new ProgressGuard({ repeatedSuccessThreshold: 2, repeatedSuccessHardStopThreshold: 3 });
		stagnantGuard.start(1_000);
		stagnantGuard.beginToolBatch();
		assert.equal(stagnantGuard.beforeToolCall("call-1", "ls", { path: "." }, true).action, "allow");
		const duplicate = stagnantGuard.beforeToolCall("call-2", "ls", { path: "." }, true);
		assert.equal(duplicate.action, "coalesce");
		assert.equal(duplicate.primaryToolCallId, "call-1");
		assert.equal(stagnantGuard.beforeToolCall("write-1", "write", { path: "x" }, false).action, "allow");
		assert.equal(stagnantGuard.beforeToolCall("write-2", "write", { path: "x" }, false).action, "allow", "mutations are never coalesced");

		stagnantGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["same"], idempotent: true, isError: false });
		assert.equal(stagnantGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["same"], idempotent: true, isError: false })?.kind, "repeated-success");
		stagnantGuard.beginToolBatch();
		assert.equal(stagnantGuard.beforeToolCall("call-3", "ls", { path: "." }, true).action, "allow", "one final poll is allowed before the hard stop");
		stagnantGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["same"], idempotent: true, isError: false });
		stagnantGuard.beginToolBatch();
		assert.equal(stagnantGuard.beforeToolCall("call-4", "ls", { path: "." }, true).action, "terminate");

		const changingGuard = new ProgressGuard({ repeatedSuccessThreshold: 2, repeatedSuccessHardStopThreshold: 3 });
		changingGuard.start(1_000);
		changingGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["same"], idempotent: true, isError: false });
		changingGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["same"], idempotent: true, isError: false });
		changingGuard.beginToolBatch();
		assert.equal(changingGuard.beforeToolCall("changing-3", "ls", { path: "." }, true).action, "allow");
		changingGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["changed"], idempotent: true, isError: false });
		changingGuard.beginToolBatch();
		assert.equal(changingGuard.beforeToolCall("changing-4", "ls", { path: "." }, true).action, "allow", "changed observations reset stagnation");

		changingGuard.recordToolResult({ toolName: "ls", input: { path: "other" }, observation: ["same"], idempotent: true, isError: false });
		changingGuard.beginToolBatch();
		assert.equal(changingGuard.beforeToolCall("changing-5", "ls", { path: "." }, true).action, "allow", "changed arguments reset the contiguous stagnation window");
	});

	it("bounds repeated confirmation questions after affirmative answers", () => {
		const guard = new ProgressGuard({ interactiveQuestionThreshold: 2, interactiveQuestionHardStopThreshold: 3 });
		guard.start(1_000);
		const firstQuestion = {
			questions: [{
				question: "确认创建 S7 任务并进入规划？",
				header: "确认创建",
				options: [{ label: "确认创建" }, { label: "取消创建" }],
			}],
		};
		const rewrittenQuestion = {
			questions: [{
				question: "S7 创建前最后确认，之后进入规划并直接执行？",
				header: "创建确认",
				options: [{ label: "确认，执行创建" }, { label: "取消" }],
			}],
		};
		assert.equal(guard.beforeToolCall("question-1", "ask_user_question", firstQuestion, false).action, "allow");
		guard.recordToolResult({ toolName: "ask_user_question", input: firstQuestion, details: { answers: [{ answer: "确认创建" }] }, isError: false });
		assert.equal(guard.beforeToolCall("question-2", "ask_user_question", rewrittenQuestion, false).action, "allow");
		const warning = guard.recordToolResult({ toolName: "ask_user_question", input: rewrittenQuestion, details: { answers: [{ answer: "确认，执行创建" }] }, isError: false });
		assert.equal(warning?.kind, "interactive-confirmation-loop");
		assert.equal(guard.beforeToolCall("question-3", "ask_user_question", firstQuestion, false).action, "terminate");
		assert.match(guard.beforeToolCall("question-4", "ask_user_question", firstQuestion, false).reason ?? "", /立即执行已确认的动作/);

		guard.recordToolResult({ toolName: "write", input: { path: "task.md" }, isError: false });
		assert.equal(guard.beforeToolCall("question-5", "ask_user_question", firstQuestion, false).action, "allow", "a real tool result opens a fresh question window");
		const distinctQuestion = {
			questions: [{ question: "确认删除 README？", header: "确认删除", options: [{ label: "确认删除" }, { label: "取消" }] }],
		};
		assert.equal(guard.beforeToolCall("question-6", "ask_user_question", distinctQuestion, false).action, "allow", "a different confirmation target remains allowed");
	});

	it("normalizes opaque tool fingerprints without retaining sensitive input", () => {
		const ordered = progressFingerprint("read", { path: "README.md", token: "fixture-secret" });
		const reordered = progressFingerprint("read", { token: "fixture-secret", path: "README.md" });
		assert.equal(ordered, reordered);
		assert.equal(ordered.includes("fixture-secret"), false);
		assert.equal(progressFingerprint("ls", {}), progressFingerprint("ls", { path: "." }));
	});

	it("normalizes ls defaults and exposes completion without claiming cursor support", () => {
		const input: Record<string, unknown> = {};
		assert.equal(normalizeLsToolInput("ls", input), true);
		assert.deepEqual(input, { path: "." });
		assert.equal(normalizeLsToolInput("ls", input), false);
		assert.deepEqual(getLsObservationMetadata(input, undefined, [{ type: "text", text: "a.txt\ndir/" }]), {
			schemaVersion: 1,
			path: ".",
			returnedEntries: 2,
			complete: true,
			cursor: { supported: false },
		});
		assert.deepEqual(getLsObservationMetadata({ path: ".", limit: 2 }, { entryLimitReached: 2 }, [{ type: "text", text: "a.txt\ndir/\n\n[2 entries limit reached. Use limit=4 for more]" }]), {
			schemaVersion: 1,
			path: ".",
			returnedEntries: 2,
			complete: false,
			cursor: { supported: false },
			continuation: { kind: "increase-limit", nextLimit: 4 },
		});
	});

	it("blocks duplicate read-only Pi tool calls before execution but never coalesces mutations", async () => {
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const api = {
			registerCommand() {},
			registerShortcut() {},
			registerTool() {},
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return [{ name: "ls" }, { name: "write" }]; },
			setActiveTools() {},
			getActiveTools() { return ["read", "write"]; },
			getThinkingLevel() { return "high"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		const context: FakeContext = {
			ui: { theme: { fg: (_color, value) => value }, setStatus: () => {}, notify: () => {} },
			sessionManager: { getEntries: () => [], getSessionId: () => "tool-loop-session" },
		};
		await events.get("input")?.({ type: "input", text: "读取同一个文件", source: "interactive", streamingBehavior: "immediate" }, context);
		await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "读取同一个文件", systemPrompt: "" }, context);
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		await events.get("turn_start")?.({ type: "turn_start" }, context);

		const firstInput: Record<string, unknown> = {};
		const firstRead = await events.get("tool_call")?.({ type: "tool_call", toolCallId: "read-1", toolName: "ls", input: firstInput }, context);
		const duplicateReads = await Promise.all(Array.from({ length: 13 }, (_, index) => events.get("tool_call")?.({
			type: "tool_call",
			toolCallId: `read-${index + 2}`,
			toolName: "ls",
			input: {},
		}, context))) as Array<{ block?: boolean; terminate?: boolean } | undefined>;
		assert.equal(firstRead, undefined, "the first read remains executable");
		assert.deepEqual(firstInput, { path: "." }, "ls receives an explicit default path before execution");
		assert.equal(duplicateReads.length, 13);
		assert.equal(duplicateReads.every((result) => result?.block === true), true, "all 13 duplicates are stopped before the underlying operation can run");
		assert.equal(duplicateReads.every((result) => result?.terminate === false), true);

		const firstWrite = await events.get("tool_call")?.({ type: "tool_call", toolCallId: "write-1", toolName: "write", input: { path: "tmp.txt", content: "x" } }, context);
		const secondWrite = await events.get("tool_call")?.({ type: "tool_call", toolCallId: "write-2", toolName: "write", input: { path: "tmp.txt", content: "x" } }, context);
		assert.equal(firstWrite, undefined);
		assert.equal(secondWrite, undefined, "mutations must never be result-coalesced or replayed");
	});

	it("stops the Pi tool loop when confirmation answers are repeatedly affirmative", async () => {
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const notifications: string[] = [];
		const api = {
			registerCommand() {},
			registerShortcut() {},
			registerTool() {},
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return [{ name: "ask_user_question" }, { name: "write" }]; },
			setActiveTools() {},
			getActiveTools() { return ["ask_user_question", "write"]; },
			getThinkingLevel() { return "high"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		const context: FakeContext = {
			hasUI: true,
			ui: { theme: { fg: (_color, value) => value }, setStatus: () => {}, notify: (message) => notifications.push(message) },
			sessionManager: { getEntries: () => [], getSessionId: () => "interactive-loop-session" },
		};
		await events.get("input")?.({ type: "input", text: "确认问题重复处理", source: "interactive", streamingBehavior: "immediate" }, context);
		await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "确认问题重复处理", systemPrompt: "" }, context);
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		await events.get("turn_start")?.({ type: "turn_start" }, context);
		const question = (text: string) => ({
			type: "tool_call",
			toolName: "ask_user_question",
			input: { questions: [{ question: text, header: "确认创建", options: [{ label: "确认创建" }, { label: "取消" }] }] },
		});
		const answer = (input: unknown) => ({ type: "tool_result", toolName: "ask_user_question", input, content: [{ type: "text", text: "User answered: 确认创建" }], details: { answers: [{ answer: "确认创建" }] }, isError: false });
		const first = question("确认创建 S7 任务并进入规划？");
		const second = question("S7 创建前最后确认，之后进入规划并执行？");
		assert.equal(await events.get("tool_call")?.({ ...first, toolCallId: "question-1" }, context), undefined);
		await events.get("tool_result")?.({ ...answer(first.input), toolCallId: "question-1" }, context);
		assert.equal(await events.get("tool_call")?.({ ...second, toolCallId: "question-2" }, context), undefined);
		await events.get("tool_result")?.({ ...answer(second.input), toolCallId: "question-2" }, context);
		const blocked = await events.get("tool_call")?.({ ...first, toolCallId: "question-3" }, context) as { block?: boolean; terminate?: boolean; reason?: string } | undefined;
		assert.equal(blocked?.block, true);
		assert.equal(blocked?.terminate, true);
		assert.match(blocked?.reason ?? "", /执行已确认的动作/);
		assert.ok(notifications.some((message) => message.includes("确认问题在收到肯定答复后重复 2 次")));
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
		assert.equal(shouldOfferProjectBootstrap(createRequestPlan({ message: "hi" })), false);
		assert.equal(shouldOfferProjectBootstrap(createRequestPlan({ message: "你好" })), false);
		assert.equal(shouldOfferProjectBootstrap(createRequestPlan({ message: "看看 package.json，这个项目是做什么的？只做查看和说明，不要修改文件。" })), false);
		assert.equal(shouldOfferProjectBootstrap(createRequestPlan({ message: "修复登录问题" })), true);
		assert.equal(shouldOfferProjectBootstrap(createRequestPlan({ message: "继续当前任务" })), false);
		assert.equal(shouldOfferProjectBootstrap(createRequestPlan({ message: "继续当前项目任务" })), false);
	});

	it("temporarily narrows an explicit Pi tool selection for continuation", async () => {
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const selected = ["read", "ls", "bash"];
		let hostActiveTools = [...selected];
		const api = {
			registerCommand() {}, registerShortcut() {}, registerTool() {}, registerFlag() {}, appendEntry() {},
			getAllTools() { return representativeTools.map((name) => ({ name })); },
			setActiveTools(names: string[]) { hostActiveTools = [...names]; },
			getActiveTools() { return hostActiveTools; },
			getThinkingLevel() { return "max"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		process.argv.push("--tools");
		try { extension(api); } finally { process.argv.pop(); }
		const context: FakeContext = {
			ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {} },
			sessionManager: { getEntries: () => [], getSessionId: () => "explicit-tools" },
		};
		await events.get("session_start")?.({ type: "session_start" }, context);
		assert.deepEqual(hostActiveTools, selected);
		await events.get("before_agent_start")?.({ prompt: "继续当前项目任务", systemPrompt: "", type: "before_agent_start" }, context);
		assert.deepEqual(hostActiveTools, []);
		await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.deepEqual(hostActiveTools, selected);
	});

	it("reads ProjectProvider context exactly once for every continuation outcome", () => {
		const task = (id: string, status: string): ProjectTask => ({ stableId: `trellis:${id}`, provider: "trellis", providerTaskId: id, path: `C:/project/.trellis/tasks/${id}`, title: id, status, files: [] });
		const current = task("current", "in_progress");
		const snapshots: Array<{ expected: "current" | "single_candidate" | "ambiguous" | "none"; context: ProjectContextSnapshot }> = [
			{ expected: "current", context: { provider: "trellis", projectRoot: "C:/project", revision: "1", currentTask: current, tasks: [current], documents: [] } },
			{ expected: "single_candidate", context: { provider: "trellis", projectRoot: "C:/project", revision: "2", tasks: [task("only", "started")], documents: [] } },
			{ expected: "ambiguous", context: { provider: "trellis", projectRoot: "C:/project", revision: "3", tasks: [task("a", "active"), task("b", "working")], documents: [] } },
			{ expected: "none", context: { provider: "trellis", projectRoot: "C:/project", revision: "4", tasks: [task("done", "completed")], documents: [] } },
		];
		const plan = createRequestPlan({ message: "继续当前项目任务", projectAvailable: true });
		for (const fixture of snapshots) {
			let calls = 0;
			const provider = { getContext() { calls += 1; return fixture.context; } } as ProjectProvider;
			assert.equal(readProjectContinuationForPlan(provider, plan)?.projection.kind, fixture.expected);
			assert.equal(calls, 1, `${fixture.expected} must use one public ProjectProvider read`);
		}
		let nonContinuationCalls = 0;
		const provider = { getContext() { nonContinuationCalls += 1; return snapshots[0].context; } } as ProjectProvider;
		assert.equal(readProjectContinuationForPlan(provider, createRequestPlan({ message: "读取 package.json", projectAvailable: true })), undefined);
		assert.equal(nonContinuationCalls, 0);
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
		const metadata = compactToolResultContentWithMetadata([{ type: "text", text: "z".repeat(20_000) }], 1_000)?.metadata;
		assert.equal(metadata?.originalChars, 20_000);
		assert.ok((metadata?.retainedChars ?? 0) <= 1_000);
		assert.equal(metadata?.contentDigest.length, 24);
		assert.equal(getToolResultCharBudget("read", "lookup"), 8_000);
		assert.equal(getToolResultCharBudget("read", "project-work"), 12_000);
		assert.equal(getToolResultCharBudget("bash", "project-work"), 32_000);
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
