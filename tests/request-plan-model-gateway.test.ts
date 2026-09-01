import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequestPlan, isTaskInventoryRequest } from "../src/core/request-plan.ts";
import { ModelBudgetError, ModelGateway, normalizeStopReason, accountModelBudget, boundedOutputReservation, limitProviderOutputTokens, modelPayloadFromProvider, providerOutputTokenLimit, providerToolSchemaMetrics, providerToolSchemaTokens } from "../src/core/model-gateway.ts";
import { requestPolicy } from "../src/core/prompt-policy.ts";

describe("request planning", () => {
	it("keeps policy ownership single-sourced by intent", () => {
		assert.match(requestPolicy("chat"), /registered Dove capabilities/);
		assert.doesNotMatch(requestPolicy("chat"), /Web access/);
		assert.match(requestPolicy("lookup"), /Web access/);
		assert.match(requestPolicy("execution"), /Parallelize/);
	});
	it("keeps an ordinary hi turn as isolated chat", () => {
		const plan = createRequestPlan({ message: "hi", projectAvailable: true, requestId: "r1" });
		assert.equal(plan.intent, "chat");
		assert.equal(plan.lane, "fast");
		assert.deepEqual(plan.contextClasses, ["conversation"]);
		assert.equal("capabilityIds" in plan, false);
		assert.equal("approval" in plan, false);
		assert.equal(Object.isFrozen(plan), true);
	});

	it("supports explicit chat and work context modes without changing intent safety", () => {
		const chat = createRequestPlan({ message: "修复登录超时问题", projectAvailable: true, interactionMode: "chat" });
		assert.equal(chat.interactionMode, "chat");
		assert.equal(chat.intent, "execution");
		assert.equal(chat.lane, "fast");
		assert.deepEqual(chat.contextClasses, ["conversation"]);

		const work = createRequestPlan({ message: "修复登录超时问题", projectAvailable: true, interactionMode: "work" });
		assert.equal(work.interactionMode, "work");
		assert.equal(work.intent, "execution");
		assert.equal(work.lane, "fast");
		assert.deepEqual(work.contextClasses, ["conversation", "project-task", "project-spec"]);

		const formalChat = createRequestPlan({ message: "规划并生成 PRD", projectAvailable: true, interactionMode: "chat" });
		assert.equal(formalChat.lane, "fast");
		assert.equal(formalChat.intent, "project-work");
		assert.deepEqual(formalChat.contextClasses, ["conversation"]);
	});

	it("distinguishes lookup, project work, and execution", () => {
		assert.equal(createRequestPlan({ message: "show project status", projectAvailable: true }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "implement the login feature", projectAvailable: true }).intent, "execution");
		assert.equal(createRequestPlan({ message: "work on the project plan", projectAvailable: true }).intent, "project-work");
	});

	it("selects formal persistence only for explicit or clearly complex work", () => {
		assert.equal(createRequestPlan({ message: "修复登录超时问题", projectAvailable: true }).lane, "fast");
		assert.equal(createRequestPlan({ message: "规划并重构登录模块，保留 PRD、设计和验收产物", projectAvailable: true }).lane, "formal");
		assert.equal(createRequestPlan({ message: "设计登录模块架构", projectAvailable: true }).lane, "formal");
		assert.equal(createRequestPlan({ message: "design the authentication architecture", projectAvailable: true }).lane, "formal");
		assert.equal(createRequestPlan({ message: "继续当前项目任务", projectAvailable: true }).lane, "fast");
		assert.equal(createRequestPlan({ message: "解释一下架构设计", projectAvailable: true }).lane, "fast");
		assert.equal(createRequestPlan({ message: "how does the architecture work?", projectAvailable: true }).lane, "fast");
		assert.equal(createRequestPlan({ message: "请规划并设计一个缓存命中率优化方案，只回复完成", projectAvailable: true }).lane, "formal");
		const responseOnlyFormal = createRequestPlan({ message: "请规划并设计一个缓存命中率优化方案，只回复完成", projectAvailable: true });
		assert.deepEqual(responseOnlyFormal.contextClasses, ["conversation", "project-task", "project-spec"]);
		assert.equal(responseOnlyFormal.outputBudget, 4096);
		assert.equal(createRequestPlan({ message: "查看 PRD 内容", projectAvailable: true }).lane, "fast");
		const pendingFormal = createRequestPlan({ message: "规划并生成 PRD", projectAvailable: true, requestId: "formal-source" });
		const affirmative = createRequestPlan({ message: "可以", projectAvailable: true, pendingPlan: pendingFormal });
		assert.equal(affirmative.lane, "formal");
		assert.equal(affirmative.continuedFromRequestId, "formal-source");
	});

	it("recognizes task inventory despite an explicit no-edit constraint", () => {
		assert.equal(isTaskInventoryRequest("Inspect and list unfinished Trellis tasks without modifying files."), true);
		assert.equal(isTaskInventoryRequest("检查并列出未完成任务，不要修改文件。"), true);
		assert.equal(isTaskInventoryRequest("继续未完成任务并修复测试"), false);
	});

	it("classifies save-context and dialogue-log file requests as execution", () => {
		assert.equal(createRequestPlan({ message: "先保存一下现在的上下文我记录一下用来审计优化agent流程" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "我需要对话日志文件" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "generate a summary of our conversation" }).intent, "chat");
		assert.equal(createRequestPlan({ message: "总结一下我们的对话" }).intent, "chat");
	});

	it("inherits execution intent for a short affirmative reply", () => {
		const pendingPlan = createRequestPlan({ message: "导出当前会话日志", requestId: "request-export" });
		const plan = createRequestPlan({ message: "可以", requestId: "request-confirm", pendingPlan });

		assert.equal(plan.intent, "execution");
		assert.equal(plan.continuedFromRequestId, "request-export");
	});

	it("does not inherit intent for an unrelated explicit prompt", () => {
		const pendingPlan = createRequestPlan({ message: "导出当前会话日志", requestId: "request-export" });
		const plan = createRequestPlan({ message: "解释当前缓存命中率", requestId: "request-cache", pendingPlan });

		assert.equal(plan.intent, "lookup");
		assert.equal(plan.continuedFromRequestId, undefined);
	});

	it("does not let explicit chat intent bypass mutation safety", () => {
		assert.equal(createRequestPlan({ message: "delete the temp file", explicitIntent: "chat" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "hello", explicitIntent: "invalid" as never }).intent, "chat");
	});

	it("does not treat negated or explanatory action language as execution", () => {
		assert.equal(createRequestPlan({ message: "分析登录模块的代码结构，不要修改文件" }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "分析 src/pi-adapter/tool-profile.ts，不修改文件" }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "告诉我怎么运行测试，但不要执行" }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "show me how to run tests without executing them" }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "do not wait; run the tests" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "do not wait, run the tests" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "不要等待，执行测试" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "do not execute, just explain the test plan" }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "不要执行，只分析测试方案" }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "分析 src/invoice.js 和测试，说明失败根因并给出修复计划，但不要修改文件、不要运行命令。" }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "现在只读说明 src/invoice.js 修复后的计算公式，别修改或运行任何命令。" }).intent, "lookup");
	});

	it("keeps conversational summaries cheap and continuation read-only", () => {
		assert.equal(createRequestPlan({ message: "用一句话总结我们刚才完成了什么。" }).intent, "chat");
		assert.equal(createRequestPlan({ message: "Briefly summarize what we just changed." }).intent, "chat");
		const continuation = createRequestPlan({ message: "继续当前项目任务", projectAvailable: true });
		assert.equal(continuation.intent, "project-work");
		assert.equal(continuation.projectAction, "continue");
		assert.equal(continuation.workflowAction, "continue");
		assert.equal(createRequestPlan({ message: "Resume the current project task", projectAvailable: true }).projectAction, "continue");
		assert.equal(createRequestPlan({ message: "继续工作", projectAvailable: true }).projectAction, "continue");
		assert.equal(createRequestPlan({ message: "Continue current work", projectAvailable: true }).projectAction, "continue");
		assert.equal(createRequestPlan({ message: "create a task", projectAvailable: true }).workflowAction, "create-task");
		assert.equal(createRequestPlan({ message: "create a task", projectAvailable: true }).intent, "project-work");
		assert.equal(createRequestPlan({ message: "创建任务", projectAvailable: true, explicitIntent: "chat" }).intent, "project-work");
		assert.equal("approval" in createRequestPlan({ message: "创建任务", projectAvailable: true }), false);
		assert.equal(createRequestPlan({ message: "start a task", projectAvailable: true }).workflowAction, "start-task");
		assert.equal(createRequestPlan({ message: "finish the current task", projectAvailable: true }).workflowAction, "finish-task");
		assert.equal(createRequestPlan({ message: "archive a task", projectAvailable: true }).workflowAction, "archive-task");
		assert.equal(createRequestPlan({ message: "继续当前项目任务，然后修复登录问题", projectAvailable: true }).workflowAction, undefined);
		const originalE2ePrompt = createRequestPlan({ message: "继续当前项目任务；如果没有活动任务，就告诉我下一步应该怎么开始，不要创建或完成任务。", projectAvailable: true });
		assert.equal(originalE2ePrompt.intent, "project-work");
		assert.equal(originalE2ePrompt.projectAction, "continue");
		assert.equal(createRequestPlan({ message: "查看如何继续当前任务", projectAvailable: true }).projectAction, undefined);
		const executingContinuation = createRequestPlan({ message: "继续当前项目任务，然后修复登录问题", projectAvailable: true });
		assert.equal(executingContinuation.intent, "execution");
		assert.equal(executingContinuation.projectAction, undefined);
	});

	it("keeps response-only probes cheap but preserves independent actions", () => {
		assert.equal(createRequestPlan({ message: "这是缓存测试第一轮，只回复：第一轮完成" }).intent, "chat");
		assert.equal(createRequestPlan({ message: "测试一下回复，只回复完成" }).intent, "chat");
		assert.equal(createRequestPlan({ message: "cache test; only reply: done" }).intent, "chat");
		assert.equal(createRequestPlan({ message: "test the project" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "修复登录超时问题" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "运行测试并修复失败" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "修复问题，只回复完成" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "测试当前项目" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "请帮我测试这个项目" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "test the current project" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "please test this project" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "先查看代码，然后测试当前项目" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "inspect the code and then test this project" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "不要修改，但请测试当前项目" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "do not edit and then test this project" }).intent, "execution");
		assert.notEqual(createRequestPlan({ message: "测试用例有哪些" }).intent, "execution");
	});

	it("routes browser viewing and interaction through the single intent owner", () => {
		assert.equal(createRequestPlan({ message: "打开登录页面" }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "open the website" }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "take a screenshot" }).intent, "lookup");
		assert.equal(createRequestPlan({ message: "点击登录按钮" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "please click the login button" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "打开网页并点击登录" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "open the website and then click login" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "do not click the ad and then click login" }).intent, "execution");
		assert.equal(createRequestPlan({ message: "如何点击登录按钮，不要实际操作" }).intent, "lookup");
	});
});

describe("model gateway budget", () => {
	const config = { contextWindow: 100, reservedOutput: 20, reservedReasoning: 10, toolSchemaOverhead: 5, providerOverhead: 5 };

	it("audits the final provider message envelope", () => {
		const request = modelPayloadFromProvider({ messages: [{ role: "system", content: "abcd" }, { role: "user", content: [{ type: "text", text: "你好" }] }] });
		assert.equal(request.segments.length, 2);
		assert.equal(request.segments[1]?.source, "provider:user");
		assert.match(request.segments[1]?.content ?? "", /你好/);
	});

	it("accounts for all reservations", () => {
		const budget = accountModelBudget({ payload: {}, segments: [{ id: "user", source: "user", content: "a".repeat(120) }] }, config);
		assert.equal(budget.availableInput, 60);
		assert.equal(budget.overflowTokens, 0); // ASCII estimate is 30 tokens.
	});

	it("accounts for the serialized tools in common provider envelopes", () => {
		const tools = [{ type: "function", function: { name: "read", description: "x".repeat(400), parameters: { type: "object" } } }];
		assert.deepEqual(providerToolSchemaMetrics({ body: { tools } }), { toolCount: 1, schemaBytes: Buffer.byteLength(JSON.stringify(tools), "utf8") });
		const direct = providerToolSchemaTokens({ messages: [], tools });
		const nested = providerToolSchemaTokens({ input: { messages: [], tools } });
		const body = providerToolSchemaTokens({ body: { messages: [], tools } });
		const request = providerToolSchemaTokens({ request: { messages: [], tools } });
		assert.equal(direct, nested);
		assert.equal(direct, body);
		assert.equal(direct, request);
		assert.ok((direct ?? 0) > 100);
		assert.equal(providerToolSchemaTokens({ messages: [] }), 0);
		assert.equal(providerToolSchemaTokens("opaque"), undefined);
	});

	it("does not double count duplicate message envelopes", () => {
		const request = modelPayloadFromProvider({
			system: "system",
			messages: [{ role: "user", content: "root" }],
			input: { messages: [{ role: "user", content: "nested duplicate" }] },
		});
		assert.deepEqual(request.segments.map((segment) => segment.content), ["system", "root"]);
		assert.deepEqual(modelPayloadFromProvider({ body: { system: "nested-system", messages: [{ role: "user", content: "nested-body" }] } }).segments.map((segment) => segment.content), ["nested-system", "nested-body"]);
		assert.deepEqual(modelPayloadFromProvider({ request: { messages: [{ role: "user", content: "nested-request" }] } }).segments.map((segment) => segment.content), ["nested-request"]);
	});

	it("rejects a small-window payload using its real serialized tool schema", () => {
		const payload = { messages: [{ role: "user", content: "hi" }], tools: [{ type: "function", function: { name: "large", description: "x".repeat(1_000), parameters: {} } }] };
		const toolSchemaOverhead = providerToolSchemaTokens(payload) ?? 0;
		assert.throws(() => new ModelGateway({ contextWindow: 300, reservedOutput: 40, toolSchemaOverhead, providerOverhead: 20 }).validate(modelPayloadFromProvider(payload)), ModelBudgetError);
		assert.doesNotThrow(() => new ModelGateway({ contextWindow: 10_000, reservedOutput: 40, toolSchemaOverhead, providerOverhead: 20 }).validate(modelPayloadFromProvider(payload)));
	});

	it("rejects an over-budget required segment before transport dispatch", async () => {
		let calls = 0;
		const gateway = new ModelGateway({ contextWindow: 100, reservedOutput: 20, reservedReasoning: 10, toolSchemaOverhead: 5, providerOverhead: 5 });
		const request = { payload: { messages: [] }, segments: [{ id: "required-prd", source: "prd", content: "x".repeat(400), required: true }] };
		await assert.rejects(() => gateway.dispatch(request, { send: async () => { calls++; return { result: "ok", stopReason: "stop" }; } }), (error: unknown) => {
			assert.ok(error instanceof ModelBudgetError);
			assert.equal(error.diagnostic.code, "MODEL_CONTEXT_OVER_BUDGET");
			assert.deepEqual(error.diagnostic.requiredSegments, ["required-prd"]);
			return true;
		});
		assert.equal(calls, 0);
	});

	it("normalizes provider stop reasons", () => {
		assert.equal(normalizeStopReason("max_tokens"), "length");
		assert.equal(normalizeStopReason("toolUse"), "tool_call");
		assert.equal(normalizeStopReason("cancelled"), "cancelled");
		assert.equal(normalizeStopReason("stop"), "completed");
	});

	it("treats plan output as minimum headroom while keeping transport aligned", () => {
		const reservation = boundedOutputReservation({ contextWindow: 12_800, providerRequestedOutput: 16_384, planOutputBudget: 1_024, fixedOverhead: 768, inputTokens: 1, canWriteProviderLimit: true });
		assert.equal(reservation, 12_031);
		assert.deepEqual(limitProviderOutputTokens({ max_tokens: 16_384, messages: [] }, reservation), { max_tokens: 12_031, messages: [] });
		assert.equal(providerOutputTokenLimit({ max_tokens: 16_384, max_output_tokens: 512 }), 512);

		const ultraReservation = boundedOutputReservation({ contextWindow: 100_000, providerRequestedOutput: 32_768, planOutputBudget: 4_096, fixedOverhead: 2_000, inputTokens: 10_000, canWriteProviderLimit: true });
		assert.equal(ultraReservation, 32_768, "a large-window project request must not inherit the static 4096-token planning target as a ceiling");

		const smallerExplicit = boundedOutputReservation({ contextWindow: 12_800, providerRequestedOutput: 512, planOutputBudget: 1_024, fixedOverhead: 768, inputTokens: 1, canWriteProviderLimit: true });
		assert.equal(smallerExplicit, 512);
		assert.deepEqual(limitProviderOutputTokens({ max_output_tokens: 512, messages: [] }, smallerExplicit), { max_output_tokens: 512, messages: [] });
	});

	it("fails closed when a provider limit needs clamping but has no writable field", () => {
		const reservation = boundedOutputReservation({ contextWindow: 100, providerRequestedOutput: 80, planOutputBudget: 20, fixedOverhead: 20, inputTokens: 30, canWriteProviderLimit: false });
		assert.equal(reservation, 80);
		assert.deepEqual(limitProviderOutputTokens({ messages: [] }, 50), { messages: [] }, "Dove must not invent an output field for an unknown provider API");
		assert.throws(() => new ModelGateway({ contextWindow: 100, reservedOutput: reservation, toolSchemaOverhead: 10, providerOverhead: 10 }).validate({ payload: {}, inputTokens: 30, segments: [] }), ModelBudgetError);
	});
});
