import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable, Writable } from "node:stream";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LocalCapabilityAdapter, MAX_RPC_LINE_BYTES, runLocalRpcStdio } from "../src/adapters/local-rpc.ts";
import { CAPABILITY_PROTOCOL_VERSION } from "../src/core/capability-protocol.ts";
import { ExecutionLedger } from "../src/core/execution-ledger.ts";

describe("local CLI/RPC capability adapter", () => {
	it("lists and executes the same host-neutral capability with ledger correlation", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-local-rpc-"));
		try {
			const ledgerPath = join(temporary, "ledger.jsonl");
			const adapter = new LocalCapabilityAdapter(ledgerPath, { ownerPid: process.pid });
			assert.ok(adapter.discover().some((entry) => entry.name === "workspace.inspect"));
			const request = {
				protocolVersion: CAPABILITY_PROTOCOL_VERSION,
				capability: { name: "workspace.inspect" },
				arguments: { path: "." },
				context: { cwd: process.cwd(), mode: "fast" as const, taskId: "rpc:test", stepId: "inspect" },
				correlation: { requestId: "rpc-request", hostSessionId: "rpc-session" },
				approval: "not_required" as const,
			};
			const response = await adapter.handleRpc({ jsonrpc: "2.0", id: 1, method: "capabilities/invoke", params: request });
			assert.ok("result" in response);
			assert.equal((response as { result: { status: string } }).result.status, "success");
			const records = (await readFile(ledgerPath, "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line) as { correlation?: { requestId?: string; executionId?: string } });
			assert.ok(records.every((record) => record.correlation?.requestId === "rpc-request"));
			assert.equal(records[0]?.correlation?.executionId, records.at(-1)?.correlation?.executionId);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it("rejects an unsupported RPC method and leaves side effects approval-protected", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-local-rpc-deny-"));
		try {
			const adapter = new LocalCapabilityAdapter(join(temporary, "ledger.jsonl"));
			await assert.rejects(() => adapter.handleRpc({ jsonrpc: "2.0", id: 1, method: "shell/run" }), /Unsupported JSON-RPC method/);
			const response = await adapter.handleRpc({
				jsonrpc: "2.0", id: 2, method: "capabilities/invoke",
				params: {
					protocolVersion: CAPABILITY_PROTOCOL_VERSION,
					capability: { name: "dev.project_test" }, arguments: {},
					context: { cwd: temporary, mode: "standard", taskId: "rpc:test", stepId: "denied" },
					correlation: { requestId: "rpc-denied" }, approval: "unavailable",
				},
			});
			assert.equal("result" in response ? (response.result as { status: string }).status : "error", "approval_denied");
			const forged = await adapter.handleRpc({
				jsonrpc: "2.0", id: 3, method: "capabilities/invoke",
				params: {
					protocolVersion: CAPABILITY_PROTOCOL_VERSION,
					capability: { name: "dev.project_test" }, arguments: {},
					context: { cwd: temporary, mode: "standard", taskId: "rpc:test", stepId: "forged" },
					correlation: { requestId: "rpc-forged" }, approval: "granted",
				},
			});
			assert.equal("result" in forged ? (forged.result as { status: string }).status : "error", "approval_denied");
			const misclassified = await adapter.handleRpc({
				jsonrpc: "2.0", id: 4, method: "capabilities/invoke",
				params: {
					protocolVersion: CAPABILITY_PROTOCOL_VERSION,
					capability: { name: "dev.project_test" }, arguments: {},
					context: { cwd: temporary, mode: "standard", taskId: "rpc:test", stepId: "not-required" },
					correlation: { requestId: "rpc-not-required" }, approval: "not_required",
				},
			});
			assert.equal("result" in misclassified ? (misclassified.result as { status: string }).status : "error", "approval_denied", "the capability's side-effect declaration, not the payload, decides whether approval is required");
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it("bounds a line while streaming and continues with the next request", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-local-rpc-bounds-"));
		try {
			const adapter = new LocalCapabilityAdapter(join(temporary, "ledger.jsonl"));
			const valid = JSON.stringify({ jsonrpc: "2.0", id: 5, method: "capabilities/list" });
			const chunks: Buffer[] = [];
			const output = new Writable({
				write(chunk, _encoding, callback) {
					chunks.push(Buffer.from(chunk));
					callback();
				},
			});
			await runLocalRpcStdio(adapter, Readable.from(["x".repeat(MAX_RPC_LINE_BYTES + 1), `\n${valid}\n`]), output);
			const responses = Buffer.concat(chunks).toString("utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line) as JsonRpcShape);
			assert.match(responses[0]?.error?.message ?? "", /exceeds 131072 bytes/);
			assert.equal(responses[1]?.id, 5);
			assert.ok(Array.isArray((responses[1]?.result as { capabilities?: unknown[] })?.capabilities));
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it("exposes a bounded terminal/resource projection through read-only RPC", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-local-rpc-diagnostics-"));
		try {
			const ledgerPath = join(temporary, "ledger.jsonl");
			const ledger = new ExecutionLedger(ledgerPath);
			await ledger.appendRequestTerminal({
				taskId: "rpc:test",
				stepId: "request:req-diagnostics",
				mode: "standard",
				requestId: "req-diagnostics",
				sessionId: "rpc-session",
				reason: "failed",
				detail: "provider-round-budget",
				policyAbort: true,
				terminal: {
					origin: "provider-round",
					code: "provider-round-budget",
					summary: "Dove stopped after the provider-round budget.",
					retryable: false,
					nextAction: "Review the last evidence.",
				},
			});
			await ledger.appendRequestPlan("rpc:test", "request:req-diagnostics", {
				requestId: "req-diagnostics", intent: "lookup", mode: "standard", interactionMode: "auto",
				contextClasses: ["conversation"], outputBudget: 2048, projectAvailable: true, lane: "fast",
			}, "rpc-session", {
				schemaVersion: 1, logicalRequestId: "req-diagnostics", intent: "lookup", lane: "fast", interactionMode: "auto",
				executionMode: "standard", executionModeSource: "user", thinkingPolicy: "auto", thinkingPolicySource: "auto",
				toolProfile: "auto", toolProfileSource: "pi", activeToolCount: 2,
				providerRound: { used: 1, limit: 3 }, readOnlyBudget: { used: 0, warning: 10, hardStop: 20 },
				context: { omitted: false, compacted: false }, resources: { toolCalls: 0, toolDurationMs: 0, elapsedMs: 12, stopReasons: [] },
			});
			await ledger.appendTaskResourceObservation({
				taskId: "rpc:test",
				stepId: "request:req-diagnostics",
				mode: "standard",
				requestId: "req-diagnostics",
				sessionId: "rpc-session",
				attemptId: "attempt-1",
				toolCalls: 3,
				providerRounds: 2,
				elapsedMs: 1200,
				toolDurationMs: 800,
				inputTokens: 100,
				cacheReadTokens: 40,
				cacheWriteTokens: 5,
				outputTokens: 60,
				reasoningTokens: 10,
				stopReasons: ["tool_call", "length"],
			});
			const adapter = new LocalCapabilityAdapter(ledgerPath);
			const response = await adapter.handleRpc({ jsonrpc: "2.0", id: "diagnostics", method: "diagnostics/status", params: { sessionId: "rpc-session" } });
			assert.ok("result" in response);
			const result = response.result as { schemaVersion: number; strategy?: { intent?: string; lane?: string; executionMode?: string; resources?: { toolCalls?: number; providerRounds?: number; elapsedMs?: number } }; lastTerminal?: { terminal?: { origin?: string; code?: string }; policyAbort?: boolean }; lastResourceObservation?: { inputTokens?: number; toolDurationMs?: number; stopReasons?: readonly string[] } };
			assert.equal(result.schemaVersion, 1);
			assert.deepEqual(result.strategy && { intent: result.strategy.intent, lane: result.strategy.lane, executionMode: result.strategy.executionMode }, { intent: "lookup", lane: "fast", executionMode: "standard" });
			assert.deepEqual(result.lastTerminal?.terminal, {
				origin: "provider-round",
				code: "provider-round-budget",
				summary: "Dove stopped after the provider-round budget.",
				retryable: false,
				nextAction: "Review the last evidence.",
			});
			assert.equal(result.lastTerminal?.policyAbort, true);
			assert.equal(result.lastResourceObservation?.inputTokens, 100);
			assert.equal(result.lastResourceObservation?.toolDurationMs, 800);
			assert.deepEqual(result.lastResourceObservation?.stopReasons, ["tool_call", "length"]);
			assert.equal(result.strategy?.resources?.toolCalls, 3);
			assert.equal(result.strategy?.resources?.providerRounds, 2);
			assert.equal(result.strategy?.resources?.elapsedMs, 1200);
			const filtered = await adapter.handleRpc({ jsonrpc: "2.0", id: "filtered", method: "diagnostics/status", params: { requestId: "other-request" } });
			assert.ok("result" in filtered);
			assert.deepEqual((filtered.result as { lastTerminal?: unknown }).lastTerminal, undefined);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});
});

interface JsonRpcShape {
	readonly id?: string | number | null;
	readonly result?: unknown;
	readonly error?: { readonly message?: string };
}

describe("the approval refusal", () => {
	it("says which gate refused, rather than one sentence for two different gates", async () => {
		// **Two gates, one sentence until this existed**: a caller that did not approve, and a host where no approver is registered. The
		// second is what an rpc invocation always meets, because the adapter accepts an authorize callback and nothing supplies one.
		const temporary = await mkdtemp(join(tmpdir(), "dove-local-rpc-approval-"));
		try {
			const adapter = new LocalCapabilityAdapter(join(temporary, "ledger.jsonl"));
			const invoke = (approval: string) =>
				adapter.handleRpc({
					jsonrpc: "2.0", id: 1, method: "capabilities/invoke",
					params: {
						protocolVersion: CAPABILITY_PROTOCOL_VERSION,
						capability: { name: "dev.project_test" }, arguments: {},
						context: { cwd: temporary, mode: "standard", taskId: "rpc:test", stepId: "approval" },
						correlation: { requestId: "rpc-approval" }, approval,
					},
				} as never).then(
					(response: unknown) => (response as { result: { status: string; error?: string } }).result,
				);

			const notGranted = await invoke("unavailable");
			assert.equal(notGranted.status, "approval_denied", "the status is unchanged");
			assert.equal(notGranted.error, "Capability approval was not granted.", "an unapproved caller is told that");

			const noApprover = await invoke("granted");
			assert.equal(noApprover.status, "approval_denied", "and so is the other gate");
			assert.equal(noApprover.error, "No approver is configured for this host.", "but this caller is told which gate refused");
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});
});

describe("the JSON-RPC error codes", () => {
	it("answers with the code the specification gives, rather than the parse-error code for everything", async () => {
		// **Measured before this existed**: four different validation failures left as plain errors and arrived at the client as -32700,
		// the code for a JSON *parse* failure, so a client keying on the code could not tell a broken document from a method that is not
		// served. The messages were held by the tests above; the codes were held by nothing.
		const temporary = await mkdtemp(join(tmpdir(), "dove-local-rpc-codes-"));
		try {
			const adapter = new LocalCapabilityAdapter(join(temporary, "ledger.jsonl"));
			const codeOf = (request: unknown): Promise<number | undefined> =>
				adapter.handleRpc(request as never).then(() => undefined, (error: { code?: number }) => error.code);
			assert.deepEqual(
				[
					await codeOf({ jsonrpc: "2.0", id: 1, method: "shell/run" }),
					await codeOf({ jsonrpc: "1.0", id: 2, method: "diagnostics/status" }),
					await codeOf({ jsonrpc: "2.0", id: {}, method: "diagnostics/status" }),
					// **Accepted rather than refused, which is the observation**: the params validator is not on this path, so a params value
					// it would reject does not reach it. Asserting a refusal here would have been asserting what I expected rather than what ran.
					await codeOf({ jsonrpc: "2.0", id: 4, method: "diagnostics/status", params: [] }).then((code) => (code === undefined ? -1 : code)),
				],
				[-32601, -32600, -32600, -1],
				"an unserved method is -32601 and a malformed request is -32600",
			);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});
});
