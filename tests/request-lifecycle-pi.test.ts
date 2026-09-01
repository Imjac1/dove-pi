import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension, { isPiToolInvocationIdempotent } from "../src/pi-adapter/extension.ts";
import { createDoveRuntime } from "../src/runtime.ts";

describe("Pi request lifecycle integration", () => {
	it("keeps retries and streaming submissions out of the next logical request", async () => {
		const stateDir = mkdtempSync(join(tmpdir(), "dove-pi-lifecycle-"));
		const previousStateDir = process.env.DOVE_PI_STATE_DIR;
		process.env.DOVE_PI_STATE_DIR = stateDir;
		try {
			const events = new Map<string, (event: any, context: any) => Promise<any>>();
			let activeTools: string[] = [];
			let abortCount = 0;
			const api = {
				registerCommand() {}, registerShortcut() {}, registerTool() {}, registerFlag() {}, appendEntry() {},
				getAllTools() { return []; },
				getActiveTools() { return activeTools; },
				setActiveTools(names: string[]) { activeTools = [...names]; },
				getThinkingLevel() { return "medium"; },
				on(name: string, handler: (event: any, context: any) => Promise<any>) { events.set(name, handler); },
			} as unknown as ExtensionAPI;
			extension(api);

			assert.ok(events.has("input"));
			assert.ok(events.has("agent_settled"));
			const context = {
				hasUI: false,
				model: { contextWindow: 100_000, maxTokens: 4_096 },
				signal: undefined,
				abort() { abortCount++; },
				ui: { theme: { fg: (_color: string, value: string) => value }, setStatus() {}, notify() {}, confirm: async () => false },
				sessionManager: { getEntries: () => [], getSessionId: () => "session-lifecycle" },
			};

			await events.get("input")?.({ type: "input", text: "fix login", source: "interactive" }, context);
			const firstStart = await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "fix login", systemPrompt: "" }, context);
			assert.equal((firstStart as { message?: unknown })?.message, undefined, "a clean execution request must not pay for workflow guidance");
			const redelivery = await events.get("input")?.({ type: "input", text: "fix login", source: "interactive" }, context);
			assert.deepEqual(redelivery, { action: "handled" }, "an active host redelivery must be suppressed before Pi persists another user entry");
			const repeatedAutomaticStart = await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "fix login", systemPrompt: "" }, context);
			assert.equal((repeatedAutomaticStart as { message?: unknown })?.message, undefined, "an automatic start must not emit request guidance twice");

			for (let attempt = 0; attempt < 5; attempt++) {
				await events.get("agent_start")?.({ type: "agent_start" }, context);
				await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: attempt === 0 ? "length" : "stop", content: [] }] }, context);
				if (attempt === 0) await events.get("session_compact")?.({ type: "session_compact", willRetry: true }, context);
			}
			await events.get("input")?.({ type: "input", text: "use the other file", source: "interactive", streamingBehavior: "steer" }, context);
			await events.get("input")?.({ type: "input", text: "then summarize", source: "interactive", streamingBehavior: "followUp" }, context);
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await events.get("input")?.({ type: "input", text: "fix login", source: "interactive" }, context);
			await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "fix login", systemPrompt: "" }, context);

			const records = readFileSync(join(stateDir, "execution.jsonl"), "utf8")
				.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind: string; correlation?: { requestId?: string; attemptId?: string }; details?: { delivery?: string; reason?: string; trigger?: string } });
			const received = records.filter((record) => record.kind === "request.received");
			const plans = records.filter((record) => record.kind === "request.planned");
			const attempts = records.filter((record) => record.kind === "request.attempt.started");
			const terminals = records.filter((record) => record.kind === "request.terminal");

			assert.equal(received.length, 4, "initial, steer, follow-up, and later repeat are each recorded once");
			assert.equal(plans.length, 2, "automatic starts persist one plan while the later repeat gets a new plan");
			assert.equal(attempts.length, 5);
			assert.equal(new Set(attempts.map((record) => record.correlation?.attemptId)).size, 5);
			assert.ok(attempts.every((record) => record.correlation?.requestId === plans[0]?.correlation?.requestId));
			assert.deepEqual(attempts.map((record) => record.details?.trigger), ["initial", "compaction-retry", "continuation", "continuation", "continuation"]);
			assert.equal(new Set(received.slice(0, 3).map((record) => record.correlation?.requestId)).size, 1, "steer/follow-up deliveries must remain on the active request correlation chain");
			assert.notEqual(plans[1]?.correlation?.requestId, plans[0]?.correlation?.requestId, "same text after settlement is deliberate and receives a new logical ID");
			assert.equal(plans[1]?.correlation?.requestId, received.at(-1)?.correlation?.requestId, "streaming leases must not leak into the next before_agent_start");
			assert.equal(terminals.length, 1, "one active logical request gets one terminal transition even with deliberate streaming deliveries");
			assert.equal(terminals[0]?.correlation?.requestId, plans[0]?.correlation?.requestId);
			assert.equal(abortCount, 0);
		} finally {
			if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
			else process.env.DOVE_PI_STATE_DIR = previousStateDir;
			rmSync(stateDir, { recursive: true, force: true });
		}
	});

	it("aborts Pi retry after the bound, on terminal HTTP status, or after non-idempotent effects", async () => {
		const stateDir = mkdtempSync(join(tmpdir(), "dove-pi-retry-policy-"));
		const previousStateDir = process.env.DOVE_PI_STATE_DIR;
		process.env.DOVE_PI_STATE_DIR = stateDir;
		try {
			const events = new Map<string, (event: any, context: any) => Promise<any>>();
			let aborts = 0;
			const api = {
				registerCommand() {}, registerShortcut() {}, registerTool() {}, registerFlag() {}, appendEntry() {},
				getAllTools() { return []; }, getActiveTools() { return []; }, setActiveTools() {}, getThinkingLevel() { return "medium"; },
				on(name: string, handler: (event: any, context: any) => Promise<any>) { events.set(name, handler); },
			} as unknown as ExtensionAPI;
			extension(api);
			const context = {
				hasUI: false, model: { contextWindow: 100_000, maxTokens: 4_096 }, signal: undefined,
				abort() { aborts++; },
				ui: { theme: { fg: (_color: string, value: string) => value }, setStatus() {}, notify() {}, confirm: async () => false },
				sessionManager: { getEntries: () => [], getSessionId: () => "session-retry" },
			};
			const startRequest = async (text: string) => {
				await events.get("input")?.({ type: "input", text, source: "interactive" }, context);
				await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: text, systemPrompt: "" }, context);
			};
			const failAttempt = async (status: number, tool?: { name: string; id: string; input?: Record<string, unknown> }) => {
				await events.get("agent_start")?.({ type: "agent_start" }, context);
				if (tool) await events.get("tool_call")?.({ type: "tool_call", toolName: tool.name, toolCallId: tool.id, input: tool.input ?? {} }, context);
				await events.get("before_provider_request")?.({ type: "before_provider_request", payload: { max_tokens: 4_096, messages: [{ role: "user", content: "x" }] } }, context);
				await events.get("after_provider_response")?.({ type: "after_provider_response", status, headers: {} }, context);
				const original = { role: "assistant", stopReason: "error", errorMessage: `HTTP ${status}`, content: [] };
				const transformed = await events.get("message_end")?.({ type: "message_end", message: original }, context) as { message?: typeof original } | undefined;
				const effective = transformed?.message ?? original;
				await events.get("agent_end")?.({ type: "agent_end", messages: [effective] }, context);
				return effective;
			};

			await startRequest("retry transient");
			await failAttempt(429);
			await failAttempt(503);
			assert.equal(aborts, 0, "transient failures inside the bound may continue");
			const limited = await failAttempt(503);
			assert.equal(aborts, 1, "the configured third-attempt limit stops a fourth live attempt");
			assert.equal(limited.stopReason, "aborted", "message_end must stop Pi's real post-agent retry loop before agent_end");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await startRequest("terminal auth");
			const denied = await failAttempt(401);
			assert.equal(aborts, 2, "authorization/terminal HTTP failures do not retry");
			assert.equal(denied.stopReason, "aborted");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await startRequest("mutating effect");
			await failAttempt(503, { name: "write", id: "write-1" });
			assert.equal(aborts, 3, "provider errors after a non-idempotent tool call do not retry");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await startRequest("run mutating recipe");
			await failAttempt(503, { name: "agent_run_recipe", id: "recipe-1", input: { name: "dev.validate_project" } });
			assert.equal(aborts, 4, "a recipe is non-idempotent when any registered step is non-idempotent");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await startRequest("run plugin tool");
			await failAttempt(503, { name: "third_party_unknown", id: "plugin-1" });
			assert.equal(aborts, 5, "unknown third-party tools fail closed for retry safety");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await startRequest("abnormal terminal path");
			await events.get("agent_start")?.({ type: "agent_start" }, context);
			await events.get("before_provider_request")?.({ type: "before_provider_request", payload: { max_tokens: 4_096, messages: [{ role: "user", content: "x" }] } }, context);
			await events.get("after_provider_response")?.({ type: "after_provider_response", status: 401, headers: {} }, context);
			await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "error", errorMessage: "HTTP 401", content: [] }] }, context);
			assert.equal(aborts, 6, "agent_end retains the structured policy reason even if message_end was skipped abnormally");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await startRequest("user cancellation");
			await events.get("agent_start")?.({ type: "agent_start" }, context);
			await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "aborted", errorMessage: "Request was aborted", content: [] }] }, context);
			assert.equal(aborts, 6, "a user cancellation is not re-aborted as policy enforcement");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			const records = readFileSync(join(stateDir, "execution.jsonl"), "utf8")
				.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind: string; details?: { reason?: string; detail?: string; policyAbort?: boolean; failureReason?: string } });
			const terminals = records.filter((record) => record.kind === "request.terminal");
			assert.deepEqual(terminals.map((record) => [record.details?.reason, record.details?.detail, record.details?.policyAbort]), [
				["failed", "attempt-limit", true],
				["authorization-denied", "authorization-denied", true],
				["failed", "non-idempotent-effect", true],
				["failed", "non-idempotent-effect", true],
				["failed", "non-idempotent-effect", true],
				["authorization-denied", "authorization-denied", true],
				["cancelled", "cancelled", undefined],
			]);
			assert.deepEqual(records.filter((record) => record.kind === "request.attempt.completed").filter((record) => record.details?.failureReason).map((record) => record.details?.failureReason), ["attempt-limit", "authorization-denied", "non-idempotent-effect", "non-idempotent-effect", "non-idempotent-effect", "authorization-denied", "cancelled"]);
		} finally {
			if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
			else process.env.DOVE_PI_STATE_DIR = previousStateDir;
			rmSync(stateDir, { recursive: true, force: true });
		}
	});

	it("classifies only reviewed read-only tools and fully idempotent recipes as retry-safe", () => {
		const { capabilities, recipes } = createDoveRuntime();
		assert.equal(isPiToolInvocationIdempotent("read", {}, capabilities, recipes), true);
		assert.equal(isPiToolInvocationIdempotent("agent_run_capability", { name: "workspace.inspect" }, capabilities, recipes), true);
		assert.equal(isPiToolInvocationIdempotent("agent_run_capability", { name: "dev.project_test" }, capabilities, recipes), false);
		assert.equal(isPiToolInvocationIdempotent("agent_run_recipe", { name: "windows.readonly_baseline" }, capabilities, recipes), true);
		assert.equal(isPiToolInvocationIdempotent("agent_run_recipe", { name: "dev.validate_project" }, capabilities, recipes), false);
		assert.equal(isPiToolInvocationIdempotent("third_party_unknown", {}, capabilities, recipes), false);
	});
});
