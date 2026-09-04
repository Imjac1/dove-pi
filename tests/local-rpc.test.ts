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
			const result = response.result as { schemaVersion: number; lastTerminal?: { terminal?: { origin?: string; code?: string }; policyAbort?: boolean }; lastResourceObservation?: { inputTokens?: number; toolDurationMs?: number; stopReasons?: readonly string[] } };
			assert.equal(result.schemaVersion, 1);
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
