import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createDoveMcpServer } from "../src/adapters/mcp.ts";
import { LocalCapabilityAdapter } from "../src/adapters/local-rpc.ts";
import { CapabilityInvocationService } from "../src/core/capability-invocation.ts";
import { CAPABILITY_PROTOCOL_VERSION, type CapabilityInvocationRequest, type CapabilityInvocationResponse } from "../src/core/capability-protocol.ts";
import { ExecutionLedger } from "../src/core/execution-ledger.ts";
import piExtension from "../src/pi-adapter/extension.ts";
import { createDoveRuntime } from "../src/runtime.ts";

const CAPABILITY = "workspace.inspect";
const CAPABILITY_VERSION = "0.1.0";

describe("external-host interoperability smoke matrix", () => {
	it("returns the same Capability Protocol result shape through Core, RPC, MCP, and Pi", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-interop-matrix-"));
		const previousStateDir = process.env.DOVE_PI_STATE_DIR;
		process.env.DOVE_PI_STATE_DIR = join(temporary, "pi-state");
		const mcpServer = createDoveMcpServer({ cwd: process.cwd(), ledgerPath: join(temporary, "mcp.jsonl"), ownerPid: process.pid });
		const mcpClient = new Client({ name: "dove-smoke-matrix", version: "1.0.0" }, { capabilities: {} });
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		try {
			const runtime = createDoveRuntime();
			const direct = await new CapabilityInvocationService(
				runtime.capabilities,
				new ExecutionLedger(join(temporary, "direct.jsonl")),
				{ ownerPid: process.pid },
			).invoke(invocation("direct-smoke"));

			const rpcReply = await new LocalCapabilityAdapter(join(temporary, "rpc.jsonl"), { ownerPid: process.pid }).handleRpc({
				jsonrpc: "2.0",
				id: 1,
				method: "capabilities/invoke",
				params: invocation("rpc-smoke"),
			});
			assert.ok("result" in rpcReply);
			const rpc = rpcReply.result as CapabilityInvocationResponse;

			await mcpServer.connect(serverTransport);
			await mcpClient.connect(clientTransport);
			const mcpCall = await mcpClient.callTool({
				name: "dove_invoke",
				arguments: { name: CAPABILITY, arguments: { path: "package.json" }, requestId: "mcp-smoke" },
			});
			const mcp = mcpCall.structuredContent as unknown as CapabilityInvocationResponse;

			const tools = new Map<string, PiTool>();
			piExtension({
				registerCommand() {},
				registerShortcut() {},
				registerTool(tool: PiTool) { tools.set(tool.name, tool); },
				registerFlag() {},
				appendEntry() {},
				getAllTools() { return []; },
				setActiveTools() {},
				getActiveTools() { return []; },
				getThinkingLevel() { return "medium"; },
				on() {},
			} as unknown as ExtensionAPI);
			const piResult = await tools.get("agent_run_capability")?.execute(
				"pi-tool-call",
				{ name: CAPABILITY, args: { path: "package.json" } },
				undefined,
				undefined,
				{ hasUI: false, sessionManager: { getSessionId: () => "pi-session" } },
			);
			assert.ok(piResult);
			const pi = piResult.details as CapabilityInvocationResponse;

			for (const [host, result, requestId] of [
				["Direct Core", direct, "direct-smoke"],
				["CLI/RPC", rpc, "rpc-smoke"],
				["MCP", mcp, "mcp-smoke"],
				["Pi", pi, undefined],
			] as const) {
				assert.equal(result.protocolVersion, CAPABILITY_PROTOCOL_VERSION, `${host} protocol version`);
				assert.deepEqual(result.capability, { name: CAPABILITY, version: CAPABILITY_VERSION }, `${host} capability identity`);
				assert.equal(result.status, "success", `${host} terminal status`);
				assert.deepEqual(result.evidenceRefs, direct.evidenceRefs, `${host} evidence projection`);
				assert.ok(result.correlation.executionId, `${host} execution correlation`);
				if (requestId) assert.equal(result.correlation.requestId, requestId, `${host} request correlation`);
			}
			assert.match(pi.correlation.requestId, /^pi-/, "Pi injects its own request correlation when no request plan is active");
		} finally {
			await mcpClient.close().catch(() => undefined);
			await mcpServer.close().catch(() => undefined);
			if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
			else process.env.DOVE_PI_STATE_DIR = previousStateDir;
			await rm(temporary, { recursive: true, force: true });
		}
	});
});

function invocation(requestId: string): CapabilityInvocationRequest {
	return {
		protocolVersion: CAPABILITY_PROTOCOL_VERSION,
		capability: { name: CAPABILITY },
		arguments: { path: "package.json" },
		context: { cwd: process.cwd(), mode: "standard", taskId: "interop-smoke", stepId: requestId },
		correlation: { requestId },
		approval: "not_required",
	};
}

interface PiTool {
	readonly name: string;
	readonly execute: (...args: unknown[]) => Promise<{ readonly details: unknown }>;
}
