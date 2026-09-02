import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension, { compactModelPayload, compactToolResultContent, compactToolResultContentWithMetadata, formatTaskInventoryGuidance, getLsObservationMetadata, getProjectContextBudget, getRemainingContextChars, getToolResultCharBudget, normalizeLsToolInput, readOnlyToolBudget, readProjectContinuationForPlan } from "../src/pi-adapter/extension.ts";
import { createRequestPlan } from "../src/core/request-plan.ts";
import { hasHashlineEditTools, selectDoveToolNames } from "../src/pi-adapter/tool-profile.ts";
import { formatProgressSnapshot, progressFingerprint, ProgressGuard } from "../src/pi-adapter/progress-guard.ts";
import { representativeTools } from "./fixtures/representative-tool-catalog.ts";
import { createProjectProvider, type ProjectContextSnapshot, type ProjectProvider, type ProjectTask } from "../src/project-provider/index.ts";
import { SEPT1_QUESTION_VARIANTS, sept1QuestionInput } from "./fixtures/sept1-question-loop.ts";
import { restoreLatestContextSnapshot } from "../src/pi-adapter/context-snapshot.ts";

const adapterStateDir = mkdtempSync(join(tmpdir(), "pi-adapter-state-"));
const previousStateDir = process.env.DOVE_PI_STATE_DIR;
const repositoryNativeStatePath = join(process.cwd(), ".dove", "state.json");
const previousRepositoryNativeState = existsSync(repositoryNativeStatePath) ? readFileSync(repositoryNativeStatePath, "utf8") : undefined;
process.env.DOVE_PI_STATE_DIR = adapterStateDir;
after(() => {
	if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
	else process.env.DOVE_PI_STATE_DIR = previousStateDir;
	rmSync(adapterStateDir, { recursive: true, force: true });
	if (previousRepositoryNativeState === undefined) rmSync(repositoryNativeStatePath, { force: true });
	else writeFileSync(repositoryNativeStatePath, previousRepositoryNativeState, "utf8");
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
		let hostActiveTools: string[] = [...representativeTools];
		let sessionEntries: unknown[] = [];
		let fallbackSessionEntries: unknown[] = [];
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
		assert.deepEqual([...commands.keys()], ["mode", "dove-mode", "status", "sysprompt", "reasoning-voice", "dove-thinking", "dove-tools", "设置", "settings-zh", "capabilities", "web", "skills", "project", "task", "memory"]);
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
		const projectStatusTool = tools.get("agent_project_status") as { promptGuidelines?: string[]; execute: (...args: unknown[]) => Promise<{ content: Array<{ text?: string }> }> };
		const projectStatusText = (await projectStatusTool.execute("status-call", {})).content[0]?.text ?? "";
		assert.match(projectStatusText, /"tasks"/);
		assert.match(projectStatusText, /"tasksOmitted"/);
		assert.match(projectStatusTool.promptGuidelines?.[0] ?? "", /use one agent_project_status result/i);
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
			sessionManager: { getEntries: () => fallbackSessionEntries, getBranch: () => sessionEntries, getSessionId: () => "session-test" },
			abort: () => { providerAborted = true; },
		};
		const capabilityTool = tools.get("agent_run_capability") as { execute: (...args: unknown[]) => Promise<{ details?: { status?: string } }> };
		const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = join(adapterStateDir, "pi-capability-no-confirm");
		try {
			const result = await capabilityTool.execute("capability-call", { name: "web.real_user_setup", args: { hosts: ["example.com"] } }, undefined, undefined, context);
			assert.equal(result.details?.status, "success", "an accepted Pi tool call must not require a second Dove confirmation");
		} finally {
			if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		}
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
		const piSessionBaseline = [...representativeTools];
		assert.equal(activeToolSets.length, 0, "Auto must observe Pi's active tools without calling setActiveTools");
		const doctorTool = tools.get("agent_doctor") as { execute: (...args: unknown[]) => Promise<{ details: { toolSchemaStability: { inSync: boolean; expectedCount: number; activeCount: number; missing: string[]; unexpected: string[] } } }> };
		const doctorResult = await doctorTool.execute("doctor-call", {}, undefined, undefined, context);
		assert.deepEqual(doctorResult.details.toolSchemaStability, {
			inSync: true,
			expectedCount: piSessionBaseline.length,
			activeCount: piSessionBaseline.length,
			missing: [],
			unexpected: [],
			finalProvider: undefined,
		});
		assert.ok(statuses.some((value) => value.includes("Dove ◆ Standard · Auto · Ready")));
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
		assert.ok(statuses.some((value) => value.includes("Dove ✦ Ultra · Auto · Ready")));
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
		assert.ok(statuses.some((value) => value.includes("Dove · Fast · Auto · Ready")));
		await commands.get("mode")?.handler("ultra", context);
		assert.ok(statuses.filter((value) => value.includes("Dove ✦ Ultra · Auto · Ready")).length >= 2);
		await commands.get("dove-mode")?.handler("chat", context);
		assert.equal(readFileSync(join(adapterStateDir, "interaction-mode"), "utf8"), "chat");
		await commands.get("dove-mode")?.handler("status", context);
		assert.ok(notifications.at(-1)?.includes("Chat"));
		await commands.get("dove-mode")?.handler("work", context);
		assert.ok(notifications.at(-1)?.includes("Work"));
		await commands.get("dove-mode")?.handler("auto", context);
		await commands.get("skills")?.handler("__missing_dove_skill__", context);
		assert.ok(notifications.some((value) => value.includes("没有找到匹配的 skill")));
		await commands.get("project")?.handler("doctor", context);
		assert.ok(notifications.some((value) => value.includes("Provider: native")));
		hostActiveTools = ["mcp", "fusion_reason", "bg_delegate"];
		const freshChat = await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, 0, "fresh Chat must not overwrite Pi or third-party tool changes");
		assert.deepEqual(hostActiveTools, ["mcp", "fusion_reason", "bg_delegate"]);
		assert.equal((freshChat as { message?: unknown })?.message, undefined, "fresh Chat must not append project context");
		const firstStartResult = await events.get("before_agent_start")?.({ prompt: "打开网页并截图", systemPrompt: "", type: "before_agent_start" }, context);
		const firstStartMessage = (firstStartResult as { message?: { customType?: string; details?: { schemaVersion?: number; segments?: unknown[] } } })?.message;
		const firstSystemPrompt = String((firstStartResult as { systemPrompt?: string })?.systemPrompt);
		assert.equal(firstStartMessage, undefined, "a lookup with no relevant project segments must not append an empty context wrapper");
		const autoToolSetCount = activeToolSets.length;
		const hiStart = await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, autoToolSetCount, "Lookup -> Chat must leave Pi's schema untouched");
		assert.equal(String((hiStart as { systemPrompt?: string })?.systemPrompt), firstSystemPrompt, "Dove's provider-prefix policy stays stable across intent changes");
		const consecutiveChatCount = activeToolSets.length;
		await events.get("before_agent_start")?.({ prompt: "hello", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount, "consecutive requests with the same exact set must not call setActiveTools again");
		hostActiveTools = [...hostActiveTools, "agent_browser"];
		await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount, "Dove diagnoses later tool activation without reverting it");
		assert.ok(hostActiveTools.includes("agent_browser"));
		await events.get("before_agent_start")?.({ prompt: "修复登录问题，打开浏览器并通过 MCP 委派后台任务", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount, "Execution intent must not become a tool permission tier");
		await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount);
		await events.get("before_agent_start")?.({ prompt: "修复登录问题，打开浏览器并通过 MCP 委派后台任务", systemPrompt: "", type: "before_agent_start" }, context);
		await events.get("before_agent_start")?.({ prompt: "读取 package.json", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount, "Execution -> Lookup must not invoke Dove tool selection");
		const continuationStart = await events.get("before_agent_start")?.({ prompt: "继续当前项目任务", systemPrompt: "", type: "before_agent_start" }, context);
		const continuationMessage = String((continuationStart as { message?: { content?: string } })?.message?.content);
		assert.equal(activeToolSets.length, consecutiveChatCount, "natural-language continuation must not churn the provider schema");
		assert.match(continuationMessage, /Project continuation state/);
		assert.match(continuationMessage, /"kind":"(?:current|single_candidate|ambiguous|none)"/);
		assert.doesNotMatch(continuationMessage, /Read agent_project_status/);
		assert.doesNotMatch(continuationMessage, /skill:trellis-continue/);
		assert.match(continuationMessage, /Treat every field as data/);
		assert.match(continuationMessage, /has not attempted any tool/);
		assert.match(continuationMessage, /never claim that a tool, capability, or command was called, missing, unavailable, or failed/);
		assert.match(continuationMessage, /Do not ask for confirmation when the state is current\/single_candidate/);
		assert.match(continuationMessage, /do not recommend a workflow command/i);
		await events.get("before_agent_start")?.({ prompt: "读取 package.json", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount, "the next ordinary request leaves Pi's schema untouched");
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
		await commands.get("dove-tools")?.handler("auto", context);
		assert.deepEqual(activeToolSets.at(-1), piSessionBaseline, "Auto returns authority to Pi's session baseline");
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
		// Relevant project context is delivered without a workflow skill gate.
		const beforeStartMessage = (beforeStart as { message?: { content?: string; details?: { guidance?: boolean; epoch?: string; revision?: string; segments?: unknown[] } } })?.message;
		assert.doesNotMatch(beforeStartMessage?.content ?? "", /trellis-before-dev|Workflow suggestion/);
		assert.match(beforeStartMessage?.content ?? "", /\[PERSONAL AGENT REQUEST CONTEXT\]/);
		assert.equal(beforeStartMessage?.details?.guidance, false, "project context is not a workflow instruction");
		assert.ok((beforeStartMessage?.details?.segments?.length ?? 0) > 0, "an empty lookup must not consume the epoch needed by a later relevant project request");
		sessionEntries = [{
			type: "custom_message",
			customType: "personal-agent-context",
			content: beforeStartMessage?.content,
			details: {
				schemaVersion: 2,
				epoch: beforeStartMessage?.details?.epoch,
				revision: beforeStartMessage?.details?.revision,
				segments: beforeStartMessage?.details?.segments,
			},
		}];
		fallbackSessionEntries = [{
			type: "custom_message",
			customType: "personal-agent-context",
			content: "wrong branch context",
			details: {
				schemaVersion: 2,
				epoch: "standard:wrong-branch",
				revision: "wrong-branch",
				segments: beforeStartMessage?.details?.segments,
			},
		}];
		await events.get("session_start")?.({ type: "session_start" }, context);
		const resumedStart = await events.get("before_agent_start")?.(
			{ prompt: "修复 Provider Prompt-Cache Boundary", systemPrompt: "", type: "before_agent_start" },
			{ ...context, model: { contextWindow: 100_000 } },
		);
		assert.equal((resumedStart as { message?: unknown })?.message, undefined, "an unchanged resumed branch must not append duplicate Dove context");
		sessionEntries = [];
		await events.get("session_shutdown")?.({ type: "session_shutdown", reason: "new" }, context);
		await events.get("session_start")?.({ type: "session_start" }, context);
		const freshStart = await events.get("before_agent_start")?.(
			{ prompt: "修复 Provider Prompt-Cache Boundary", systemPrompt: "", type: "before_agent_start" },
			{ ...context, model: { contextWindow: 100_000 } },
		);
		assert.match(String((freshStart as { message?: { content?: string } })?.message?.content), /\[PERSONAL AGENT REQUEST CONTEXT\]/, "a replacement session must compile its own context");
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
		assert.equal((repeatedStart as { message?: unknown })?.message, undefined, "ordinary execution must not inject a workflow prompt on every turn");
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
		const guidanceResult = await events.get("context")?.({
			type: "context",
			messages: [
				{ role: "user", content: [{ type: "text", text: "keep" }], timestamp: 6 },
				{ role: "custom", customType: "personal-agent-context", content: "old guidance", display: false, details: { schemaVersion: 2, guidance: true, segments: [] }, timestamp: 7 },
				{ role: "assistant", content: [{ type: "text", text: "answer" }], timestamp: 8 },
				{ role: "custom", customType: "personal-agent-context", content: "current guidance", display: false, details: { schemaVersion: 2, guidance: true, segments: [] }, timestamp: 9 },
			],
		}, context);
		const guidanceMessages = (guidanceResult as { messages?: Array<{ content?: unknown; timestamp?: number }> })?.messages ?? [];
		assert.deepEqual(guidanceMessages.map((message) => message.timestamp), [6, 8, 9], "only the current guidance message remains in the Provider context");

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

	it("restores only the newest valid context snapshot from the active branch", () => {
		const segment = { id: "task", kind: "task", trust: "untrusted", included: true, estimatedChars: 12, estimatedTokens: 3, reason: "included" };
		const snapshot = (epoch: string, revision: string, content: string) => ({
			type: "custom_message",
			customType: "personal-agent-context",
			content,
			details: { schemaVersion: 2, epoch, revision, segments: [segment] },
		});
		const restored = restoreLatestContextSnapshot([
			snapshot("old", "old", "old context"),
			{ type: "custom_message", customType: "personal-agent-context", content: "guidance only", details: { schemaVersion: 2, epoch: "guidance", segments: [] } },
			snapshot("current", "revision-2", "current context"),
		]);
		assert.deepEqual(restored, { content: "current context", epoch: "current", revision: "revision-2", segments: [segment] });
		const nested = restoreLatestContextSnapshot([{
			type: "message",
			message: { role: "custom", customType: "personal-agent-context", content: "nested context", details: { schemaVersion: 2, epoch: "nested", revision: "revision-1", segments: [segment] } },
		}]);
		assert.equal(nested?.epoch, "nested");
		assert.equal(restoreLatestContextSnapshot([
			{ type: "custom_message", customType: "personal-agent-context", content: "malformed", details: { schemaVersion: 2, epoch: "bad", revision: "bad", segments: [{ ...segment, trust: "trusted" }] } },
		]), undefined);
	});

	it("records an optional native goal directly without planning questions or legacy script execution", async () => {
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
			let activeTools: string[] = [...representativeTools];
			let confirmations = 0;
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
				ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {}, confirm: async () => { confirmations += 1; return true; } },
				sessionManager: { getEntries: () => [], getSessionId: () => "planning-replay" },
			};
			const simplePrompt = "查看 README.md";
			await events.get("input")?.({ type: "input", text: simplePrompt, source: "interactive", streamingBehavior: "immediate" }, context);
			await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: simplePrompt, systemPrompt: "" }, context);
			assert.equal(existsSync(join(root, ".dove", "state.json")), false, "fast-lane lookup must not create formal state");
			await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "completed", content: [] }] }, context);

			const formalPrompt = "请规划并设计一个缓存命中率优化方案，只回复完成，不要调用工具。";
			await events.get("input")?.({ type: "input", text: formalPrompt, source: "interactive", streamingBehavior: "immediate" }, context);
			await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: formalPrompt, systemPrompt: "" }, context);
			const formalTask = createProjectProvider(root).getCurrentTask();
			assert.equal(formalTask?.formal, true);
			assert.ok(formalTask?.providerTaskId);
			for (const artifact of ["prd.md", "design.md", "implement.md", "acceptance.md"]) assert.equal(existsSync(join(root, ".dove", "tasks", formalTask!.providerTaskId, artifact)), true);
			await events.get("agent_start")?.({ type: "agent_start" }, context);
			await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "completed", content: [] }] }, context);
			assert.match(readFileSync(join(root, ".dove", "tasks", formalTask!.providerTaskId, "evidence.jsonl"), "utf8"), /"outcome":"completed"/);

			await events.get("input")?.({ type: "input", text: "创建一个项目任务：缓存命中率优化", source: "interactive", streamingBehavior: "immediate" }, context);
			const start = await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "创建一个项目任务：缓存命中率优化", systemPrompt: "" }, context) as { message?: { content?: string } };
			assert.equal(activeTools.includes("agent_project_task"), true);
			assert.equal(activeTools.includes("bash"), true, "Dove must preserve Pi's active execution tools");
			assert.doesNotMatch(start.message?.content ?? "", /collecting-name|ask one structured question/i);

			const taskTool = tools.get("agent_project_task");
			assert.ok(taskTool);
			const taskResult = await taskTool.execute("task-call", { operation: "create", title: "缓存命中率优化", description: "减少未缓存输入" }, undefined, undefined, context);
			assert.equal(confirmations, 0, "Pi-hosted task execution must not ask for a second Dove approval");
			assert.equal(existsSync(join(root, "create-called")), false, "legacy task.py must never execute");
			assert.match(readFileSync(join(root, ".dove", "state.json"), "utf8"), /缓存命中率优化/);
			assert.match(taskResult.details.goal.taskId, /^native:goal-/);
			assert.match(taskResult.details.goal.path, /[\\\/]\.dove[\\\/]state\.json$/);
			const mutationRecords = readFileSync(join(stateDir, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind?: string; details?: { operation?: string; revision?: string } });
			const createStart = mutationRecords.find((record) => record.kind === "project.mutation.started" && record.details?.operation === "create");
			assert.ok(createStart);
			assert.notEqual(createStart?.details?.revision, "before", "mutation recovery must retain the actual pre-state revision");
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

	it("warns and stops varied read-only exploration at the request budget", () => {
		const guard = new ProgressGuard();
		guard.start(1_000, { readOnlyToolWarningThreshold: 2, readOnlyToolHardStopThreshold: 3 });
		for (let index = 0; index < 2; index++) {
			assert.equal(guard.beforeToolCall(`read-${index}`, "read", { path: `${index}.ts` }, true).action, "allow");
			const warning = guard.recordToolResult({ toolName: "read", input: { path: `${index}.ts` }, observation: [index], idempotent: true, isError: false });
			assert.equal(warning?.kind, index === 1 ? "read-only-budget" : undefined);
		}
		assert.equal(guard.beforeToolCall("read-2", "read", { path: "2.ts" }, true).action, "allow");
		guard.recordToolResult({ toolName: "read", input: { path: "2.ts" }, observation: [2], idempotent: true, isError: false });
		const stopped = guard.beforeToolCall("read-3", "read", { path: "3.ts" }, true);
		assert.equal(stopped.action, "terminate");
		assert.match(stopped.reason ?? "", /3-call limit/);
		assert.equal(guard.snapshot().readOnlyToolCalls, 3);
		assert.deepEqual(readOnlyToolBudget({ intent: "lookup", mode: "standard" }), { readOnlyToolWarningThreshold: 6, readOnlyToolHardStopThreshold: 12 });
		assert.deepEqual(readOnlyToolBudget({ intent: "project-work", mode: "standard" }, true), { readOnlyToolWarningThreshold: 1, readOnlyToolHardStopThreshold: 2 });
		assert.deepEqual(readOnlyToolBudget({ intent: "execution", mode: "ultra" }), { readOnlyToolWarningThreshold: 32, readOnlyToolHardStopThreshold: 64 });
	});

	it("formats task inventory as a bounded no-tool projection", () => {
		const guidance = formatTaskInventoryGuidance({
			provider: "trellis",
			projectRoot: "C:/project",
			revision: "rev-1",
			tasks: [{ stableId: "trellis:a", provider: "trellis", providerTaskId: "a", path: ".trellis/tasks/a", title: "A", status: "in_progress", files: [] }],
			documents: [],
		});
		assert.match(guidance, /already resolved locally/);
		assert.match(guidance, /\"taskCount\":1/);
		assert.match(guidance, /Do not call tools/);
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
		assert.equal(guard.beforeToolCall("question-2", "ask_user_question", rewrittenQuestion, false).action, "terminate");
		assert.equal(guard.beforeToolCall("question-3", "ask_user_question", firstQuestion, false).action, "terminate");
		assert.match(guard.beforeToolCall("question-4", "ask_user_question", firstQuestion, false).reason ?? "", /不要再次提问/);

		guard.recordToolResult({ toolName: "write", input: { path: "task.md" }, isError: false });
		assert.equal(guard.beforeToolCall("question-5", "ask_user_question", firstQuestion, false).action, "terminate", "progress does not reset the per-goal question budget");
		const distinctQuestion = {
			questions: [{ question: "确认删除 README？", header: "确认删除", options: [{ label: "确认删除" }, { label: "取消" }] }],
		};
		assert.equal(guard.beforeToolCall("question-6", "ask_user_question", distinctQuestion, false).action, "terminate", "different wording cannot bypass the per-goal limit");
		guard.start(2_000);
		assert.equal(guard.beforeToolCall("question-new-goal", "ask_user_question", distinctQuestion, false).action, "allow", "a new goal gets a fresh question budget");
	});

	it("stops all September 1 wording variants before question two", () => {
		const guard = new ProgressGuard();
		guard.start(1_000);
		for (let index = 0; index < SEPT1_QUESTION_VARIANTS.length; index += 1) {
			const decision = guard.beforeToolCall(`sept1-question-${index + 1}`, "ask_user_question", sept1QuestionInput(index), false);
			assert.equal(decision.action, index === 0 ? "allow" : "terminate", `question ${index + 1} must not bypass the per-goal limit`);
		}
		assert.equal(guard.snapshot().interactiveQuestionCalls, 1);
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
		const blocked = await events.get("tool_call")?.({ ...second, toolCallId: "question-2" }, context) as { block?: boolean; terminate?: boolean; reason?: string } | undefined;
		assert.equal(blocked?.block, true);
		assert.equal(blocked?.terminate, true);
		assert.match(blocked?.reason ?? "", /不要再次提问/);
	});

	it("continues a pending execution once without restricting Pi tools", async () => {
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		let activeTools: string[] = [];
		const api = {
			registerCommand() {}, registerShortcut() {}, registerTool() {}, registerFlag() {}, appendEntry() {},
			getAllTools() { return [{ name: "ask_user_question" }, { name: "write" }]; },
			setActiveTools(names: string[]) { activeTools = [...names]; },
			getActiveTools() { return activeTools; },
			getThinkingLevel() { return "high"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		const context: FakeContext = {
			ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {} },
			sessionManager: { getEntries: () => [], getSessionId: () => "pending-continuation-session" },
		};
		const firstPrompt = "先保存一下现在的上下文我记录一下用来审计优化agent流程";
		await events.get("input")?.({ type: "input", text: firstPrompt, source: "interactive", streamingBehavior: "immediate" }, context);
		await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: firstPrompt, systemPrompt: "" }, context);
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		const questionInput = { questions: [{ question: "确认保存？", header: "保存", options: [{ label: "可以" }, { label: "取消" }] }] };
		assert.equal(await events.get("tool_call")?.({ type: "tool_call", toolCallId: "pending-question", toolName: "ask_user_question", input: questionInput }, context), undefined);
		await events.get("tool_result")?.({ type: "tool_result", toolCallId: "pending-question", toolName: "ask_user_question", input: questionInput, content: [{ type: "text", text: "可以" }], details: { answers: [{ answer: "可以" }] }, isError: false }, context);
		await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "completed", content: [] }] }, context);
		await events.get("agent_settled")?.({ type: "agent_settled" }, context);

		const beforeRecords = readFileSync(join(adapterStateDir, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind?: string; details?: { requestId?: string; continuedFromRequestId?: string } });
		const sourceRequestId = beforeRecords.filter((record) => record.kind === "request.planned").at(-1)?.details?.requestId;
		assert.ok(sourceRequestId);

		await events.get("input")?.({ type: "input", text: "可以", source: "interactive", streamingBehavior: "immediate" }, context);
		await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "可以", systemPrompt: "" }, context);
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		const repeatedQuestion = await events.get("tool_call")?.({ type: "tool_call", toolCallId: "repeated-question", toolName: "ask_user_question", input: questionInput }, context) as { block?: boolean; terminate?: boolean; reason?: string } | undefined;
		assert.equal(repeatedQuestion?.block, true);
		assert.equal(repeatedQuestion?.terminate, true);
		assert.match(repeatedQuestion?.reason ?? "", /already confirmed/);
		assert.equal(await events.get("tool_call")?.({ type: "tool_call", toolCallId: "write-log", toolName: "write", input: { path: "audit.log", content: "ok" } }, context), undefined, "Dove must leave Pi's valid tools usable");
		assert.equal(await events.get("tool_call")?.({ type: "tool_call", toolCallId: "host-tool", toolName: "third_party_write", input: {} }, context), undefined, "Dove must not add an intent-derived tool firewall on top of Pi");

		const afterRecords = readFileSync(join(adapterStateDir, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind?: string; details?: { continuedFromRequestId?: string } });
		assert.equal(afterRecords.filter((record) => record.kind === "request.planned").at(-1)?.details?.continuedFromRequestId, sourceRequestId);
	});

	it("keeps Auto unrestricted while retaining explicit compatibility profiles", () => {
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser", "web_search"], "core"), ["read", "agent_doctor"]);
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser", "web_search"], "auto", "lookup", "打开网页并截图"), ["read", "agent_doctor", "agent_browser", "web_search"]);
		assert.deepEqual(selectDoveToolNames(["read", "plan_mode_question"], "auto", "chat", "hi"), ["read", "plan_mode_question"]);
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser"], "full"), ["read", "agent_doctor", "agent_browser"]);
		assert.equal(hasHashlineEditTools(["read", "replace", "insert", "grep"]), true);
		assert.deepEqual(selectDoveToolNames(["read", "edit", "grep", "replace", "insert"], "core"), ["read", "grep"]);
		assert.deepEqual(selectDoveToolNames(["read", "edit", "grep", "replace", "insert"], "auto", "execution"), ["read", "edit", "grep", "replace", "insert"]);
		assert.deepEqual(selectDoveToolNames(["read", "edit", "grep", "replace", "insert"], "full"), ["read", "edit", "grep", "replace", "insert"]);
	});

	it("keeps large execution logs out of model-facing tool results", () => {
		const payload = compactModelPayload({ stdout: "x".repeat(10_000), nested: [{ stderr: "y".repeat(9_000) }] }) as { stdout: string; nested: Array<{ stderr: string }> };
		assert.ok(payload.stdout.length < 8_500);
		assert.match(payload.stdout, /truncated/);
		assert.ok(payload.nested[0].stderr.length < 8_500);
	});

	it("preserves an explicit Pi tool selection for continuation", async () => {
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
		assert.deepEqual(hostActiveTools, selected);
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
	sessionManager: { getEntries: () => unknown[]; getBranch?: () => unknown[]; getSessionId?: () => string };
	abort?: () => void;
}
