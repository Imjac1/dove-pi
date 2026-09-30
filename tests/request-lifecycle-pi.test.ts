import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension from "../src/pi-adapter/extension.ts";

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
			assert.equal((terminals[0]?.details as { terminal?: { origin?: string; code?: string } } | undefined)?.terminal?.origin, "session");
			assert.equal((terminals[0]?.details as { terminal?: { origin?: string; code?: string } } | undefined)?.terminal?.code, "completed");
			assert.equal(abortCount, 0);
		} finally {
			if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
			else process.env.DOVE_PI_STATE_DIR = previousStateDir;
			rmSync(stateDir, { recursive: true, force: true });
		}
	});

	it("aborts Pi retry after the bound, on terminal HTTP status, or at the overflow replay after an effect", async () => {
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
			// The threshold warning is gated behind `ctx.hasUI`, so a context without a UI cannot observe whether the
			// guard held - it would pass this assertion by being unable to fail it. A UI is declared and the
			// notifications are collected, so "did not warn" means the guard decided that, not that nobody was listening.
			const notifications: string[] = [];
			const context = {
				hasUI: true, model: { contextWindow: 100_000, maxTokens: 4_096 }, signal: undefined,
				abort() { aborts++; },
				ui: { theme: { fg: (_color: string, value: string) => value }, setStatus() {}, notify(message: string) { notifications.push(message); }, confirm: async () => false },
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
			// **The two counters, and why they are two.** Measured on a real session: the observation reported 1 provider
			// round for a request that made 8, while the goal line - which counts ledger records - said 8. The increment
			// was guarded so a retry would not start a new round of *progress*, and that guard was also deciding the
			// observation's number. Three attempts here: one initial and two retries, so three real provider requests.
			const ledgerRecords = () => readFileSync(join(stateDir, "execution.jsonl"), "utf8")
				.split("\n").filter((line) => line.trim() !== "")
				.map((line) => JSON.parse(line) as { kind?: string; details?: Record<string, unknown> });
			const observations = () => ledgerRecords().filter((record) => record.kind === "task.convergence.observed" && record.details?.observationOnly === true);
			assert.equal(
				observations().at(-1)?.details?.providerRounds,
				3,
				"a retry is a provider request, so the request's last observation counts every attempt",
			);
			// **And the "budget" that message announced no longer exists.** Three provider requests under a chat plan
			// used to be measured against a per-intent/mode threshold (two, for chat in standard) and warned about once
			// it was reached. That threshold could not stop anything, so it was removed rather than left announcing a
			// ceiling - and the count above is the whole of what remains: an observation.
			assert.ok(
				!notifications.some((message) => /provider-round/i.test(message)),
				"no notification claims a provider-round threshold, because none is enforced",
			);
			// A host may deliver the next prompt before the explicit abort's
			// `agent_settled` callback. The new request must not inherit the old
			// provider terminal state.
			await startRequest("request after policy abort");
			await events.get("agent_start")?.({ type: "agent_start" }, context);
			await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "stop", content: [] }] }, context);
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await startRequest("terminal auth");
			const denied = await failAttempt(401);
			assert.equal(aborts, 2, "authorization/terminal HTTP failures do not retry");
			assert.equal(denied.stopReason, "aborted");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			// **The relaxation, and what it rests on.** A transient provider failure after a non-idempotent tool call
			// used to end the request here. R0 measured Pi's provider retry as three provider calls and one tool
			// execution - it continues from the transcript that already carries the tool result - so the request
			// continues instead, and the effect stays on the lease as the record of what ran.
			await startRequest("mutating effect");
			await failAttempt(503, { name: "write", id: "write-1" });
			assert.equal(aborts, 2, "a provider failure after a non-idempotent tool call now continues, because Pi's provider retry does not re-run the tool");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await startRequest("run mutating recipe");
			await failAttempt(503, { name: "agent_run_recipe", id: "recipe-1", input: { name: "dev.validate_project" } });
			assert.equal(aborts, 2, "a recipe is non-idempotent when any registered step is non-idempotent, and that does not refuse the retry either");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await startRequest("run plugin tool");
			await failAttempt(503, { name: "third_party_unknown", id: "plugin-1" });
			assert.equal(aborts, 2, "an unknown third-party tool stays non-idempotent, and its provider retry continues");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			// **The refusal that is left, at the boundary where it can still be made.** Overflow recovery is the one
			// replay R0 never reached (its probe compacted nothing), and it is the one that rewrites the context the
			// model sees, so the record that the tool already ran is weaker rather than absent. Pi lets a compaction be
			// cancelled, so that is where Dove refuses: nothing is re-sent and the message still names what to
			// reconcile. Asserted here rather than claimed, because a relaxation that quietly lost its last refusal
			// would look exactly like this change.
			await startRequest("compact after effect");
			await failAttempt(503, { name: "write", id: "write-2" });
			const compactRefusal = await events.get("session_before_compact")?.({ type: "session_before_compact", reason: "overflow", willRetry: true }, context);
			assert.deepEqual(compactRefusal, { cancel: true }, "the overflow replay after an effect is cancelled before anything is re-sent");
			assert.equal(aborts, 3, "and the refusal stops the run it belongs to");
			// **The refusal has to say what to reconcile.** "Inspect the workspace and reconcile the effect" names
			// nothing; on a real session that sentence was the whole of what the operator got. The refusal is per
			// attempt, so re-submitting is already the way to continue - the message has to say so.
			const requestTerminals = (): readonly { code?: string; nextAction?: string }[] => ledgerRecords()
				.filter((record) => record.kind === "request.terminal")
				.map((record) => (record.details?.terminal ?? {}) as { code?: string; nextAction?: string });
			const effectRefusal = requestTerminals().find((terminal) => terminal.code === "retry-refused-after-effect");
			assert.ok(effectRefusal !== undefined, "the refusal after a non-idempotent effect reaches the ledger");
			assert.match(effectRefusal?.nextAction ?? "", /write/, "and it names the action the operator has to reconcile");
			assert.match(effectRefusal?.nextAction ?? "", /new request is allowed/i, "and says how to continue");
			// The control: a failure with no non-idempotent action behind it names none, so the message is a fact about
			// this request rather than a sentence stapled to every refusal.
			const deniedTerminal = requestTerminals().find((terminal) => terminal.code === "provider-authorization-denied");
			assert.ok(deniedTerminal !== undefined, "the authorization refusal is recorded too");
			assert.doesNotMatch(deniedTerminal?.nextAction ?? "", /\bwrite\b/, "a failure with no such action names none");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			// **A compaction with no effect behind it is left alone.** The guard keys on the effect, not on the
			// compaction: an ordinary overflow still recovers, which is what keeps this a refusal rather than a ban.
			await startRequest("compact without effect");
			await failAttempt(503, { name: "read", id: "read-1" });
			const allowedCompaction = await events.get("session_before_compact")?.({ type: "session_before_compact", reason: "overflow", willRetry: true }, context);
			assert.equal(allowedCompaction, undefined, "a request with no non-idempotent effect is not refused its overflow recovery");
			assert.equal(aborts, 3, "and nothing aborts it");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await startRequest("abnormal terminal path");
			await events.get("agent_start")?.({ type: "agent_start" }, context);
			await events.get("before_provider_request")?.({ type: "before_provider_request", payload: { max_tokens: 4_096, messages: [{ role: "user", content: "x" }] } }, context);
			await events.get("after_provider_response")?.({ type: "after_provider_response", status: 401, headers: {} }, context);
			await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "error", errorMessage: "HTTP 401", content: [] }] }, context);
			assert.equal(aborts, 4, "agent_end retains the structured policy reason even if message_end was skipped abnormally");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			await startRequest("shutdown before message end");
			await events.get("agent_start")?.({ type: "agent_start" }, context);
			await events.get("before_provider_request")?.({ type: "before_provider_request", payload: { max_tokens: 4_096, messages: [{ role: "user", content: "x" }] } }, context);
			await events.get("after_provider_response")?.({ type: "after_provider_response", status: 401, headers: {} }, context);
			await events.get("session_shutdown")?.({ type: "session_shutdown", reason: "new" }, context);

			await startRequest("user cancellation");
			await events.get("agent_start")?.({ type: "agent_start" }, context);
			await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "aborted", errorMessage: "Request was aborted", content: [] }] }, context);
			assert.equal(aborts, 4, "a user cancellation is not re-aborted as policy enforcement");
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);

			const records = readFileSync(join(stateDir, "execution.jsonl"), "utf8")
				.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind: string; details?: { reason?: string; detail?: string; policyAbort?: boolean; failureReason?: string } });
			const terminals = records.filter((record) => record.kind === "request.terminal");
			const terminalEnvelopes = terminals.map((record) => (record.details as { terminal?: { origin?: string; code?: string; retryable?: boolean } } | undefined)?.terminal);
			// The three `completed` rows in the middle are the harness settling requests Pi would really be retrying:
			// after the relaxation those attempts end as `transient-failure` with no policy terminal, and this test
			// closes each scenario by hand. They are not a claim about a real session, and they are the reason the
			// refusal below is asserted by code and by an explicit cancel rather than by position in this list.
			assert.deepEqual(terminals.map((record) => [record.details?.reason, record.details?.detail, record.details?.policyAbort]), [
				["failed", "attempt-limit", true],
				["completed", undefined, undefined],
				["authorization-denied", "authorization-denied", true],
				["completed", undefined, undefined],
				["completed", undefined, undefined],
				["completed", undefined, undefined],
				["failed", "non-idempotent-effect", true],
				["completed", undefined, undefined],
				["authorization-denied", "authorization-denied", true],
				["authorization-denied", "authorization-denied", true],
				["cancelled", "cancelled", undefined],
			]);
			assert.deepEqual(terminalEnvelopes.map((terminal) => [terminal?.origin, terminal?.code, terminal?.retryable]), [
				["provider", "provider-attempt-limit", true],
				["session", "completed", false],
				["provider", "provider-authorization-denied", false],
				["session", "completed", false],
				["session", "completed", false],
				["session", "completed", false],
				["provider", "retry-refused-after-effect", false],
				["session", "completed", false],
				["provider", "provider-authorization-denied", false],
				["provider", "provider-authorization-denied", false],
				["user", "user-cancelled", false],
			]);
			assert.deepEqual(records.filter((record) => record.kind === "request.attempt.completed").filter((record) => record.details?.failureReason).map((record) => record.details?.failureReason), ["attempt-limit", "authorization-denied", "authorization-denied", "cancelled"]);
		} finally {
			if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
			else process.env.DOVE_PI_STATE_DIR = previousStateDir;
			rmSync(stateDir, { recursive: true, force: true });
		}
	});
});
