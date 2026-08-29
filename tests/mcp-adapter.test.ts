import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createDoveMcpServer } from "../src/adapters/mcp.ts";

describe("MCP capability adapter", () => {
	it("discovers and invokes Core capabilities through the official MCP SDK", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-mcp-"));
		const server = createDoveMcpServer({ cwd: process.cwd(), ledgerPath: join(temporary, "ledger.jsonl"), ownerPid: process.pid });
		const client = new Client({ name: "dove-test", version: "1.0.0" }, { capabilities: {} });
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		try {
			await server.connect(serverTransport);
			await client.connect(clientTransport);
			const tools = await client.listTools();
			assert.deepEqual(tools.tools.map((tool) => tool.name), ["dove_capabilities", "dove_context", "dove_invoke"]);
			const context = await client.callTool({ name: "dove_context", arguments: { query: "AGENTS.md project instruction" } });
			assert.notEqual(context.isError, true);
			assert.ok(Array.isArray((context.structuredContent as { authorities?: unknown[] })?.authorities));
			const result = await client.callTool({ name: "dove_invoke", arguments: { name: "workspace.inspect", arguments: { path: "package.json" }, requestId: "mcp-test" } });
			assert.equal(result.isError, false);
			assert.equal((result.structuredContent as { status?: string })?.status, "success");
			assert.equal((result.structuredContent as { correlation?: { requestId?: string } })?.correlation?.requestId, "mcp-test");
		} finally {
			await client.close();
			await server.close();
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it("keeps side-effect capabilities denied without explicit MCP host approval", async () => {
		const temporary = await mkdtemp(join(tmpdir(), "dove-mcp-deny-"));
		const server = createDoveMcpServer({ cwd: temporary, ledgerPath: join(temporary, "ledger.jsonl") });
		const client = new Client({ name: "dove-test", version: "1.0.0" }, { capabilities: {} });
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		try {
			await server.connect(serverTransport);
			await client.connect(clientTransport);
			const result = await client.callTool({ name: "dove_invoke", arguments: { name: "dev.project_test", requestId: "mcp-denied" } });
			assert.equal(result.isError, true);
			assert.equal((result.structuredContent as { status?: string })?.status, "approval_denied");
			const tool = (await client.listTools()).tools.find((entry) => entry.name === "dove_invoke");
			assert.equal("approve" in ((tool?.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {}), false, "MCP callers cannot self-attest approval in the payload");
		} finally {
			await client.close();
			await server.close();
			await rm(temporary, { recursive: true, force: true });
		}
	});
});
