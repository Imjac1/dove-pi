import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { CAPABILITY_PROTOCOL_VERSION } from "../core/capability-protocol.ts";
import { LocalCapabilityAdapter } from "./local-rpc.ts";
import { createProjectProvider } from "../project-provider/index.ts";
import { buildInteroperableProjectContext } from "../context/interoperable.ts";

export interface DoveMcpServerOptions {
	readonly cwd: string;
	readonly ledgerPath: string;
	readonly ownerPid?: number;
}

export function createDoveMcpServer(options: DoveMcpServerOptions): McpServer {
	const adapter = new LocalCapabilityAdapter(options.ledgerPath, { ownerPid: options.ownerPid });
	const server = new McpServer({ name: "dove-pi", version: CAPABILITY_PROTOCOL_VERSION });

	server.registerTool("dove_capabilities", {
		title: "Dove Capabilities",
		description: "Discover versioned Dove Core capabilities. Pi plugin-owned capabilities remain available through Pi itself.",
		inputSchema: {},
		annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
	}, async () => {
		const result = { protocolVersion: CAPABILITY_PROTOCOL_VERSION, capabilities: adapter.discover() };
		return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
	});

	server.registerTool("dove_context", {
		title: "Dove Project Context",
		description: "Read the normalized Trellis/AGENTS.md/CLAUDE.md/Agent Skills context index or targeted excerpts.",
		inputSchema: {
			query: z.string().max(2_000).optional(),
			mode: z.enum(["fast", "standard", "ultra"]).optional(),
		},
		annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
	}, async (input) => {
		const interoperable = buildInteroperableProjectContext(createProjectProvider(options.cwd), input.query?.trim() ?? "", input.mode ?? "standard");
		const result = {
			provider: interoperable.projection.provider,
			projectRoot: interoperable.projection.projectRoot,
			revision: interoperable.projection.revision,
			authorities: interoperable.projection.authorities,
			conflicts: interoperable.projection.conflicts,
			index: interoperable.projection.index,
			context: interoperable.context,
		};
		return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
	});

	server.registerTool("dove_invoke", {
		title: "Invoke Dove Capability",
		description: "Invoke one reviewed Dove capability through the shared policy, ledger, and evidence boundary.",
		inputSchema: {
			name: z.string().min(1).max(160),
			arguments: z.record(z.string().max(160), z.unknown()).optional(),
			mode: z.enum(["fast", "standard", "ultra"]).optional(),
			taskId: z.string().min(1).max(320).optional(),
			stepId: z.string().min(1).max(320).optional(),
			requestId: z.string().min(1).max(160).optional(),
			timeoutMs: z.number().int().min(1).max(86_400_000).optional(),
			retries: z.number().int().min(0).max(10).optional(),
		},
		annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
	}, async (input, extra) => {
		const requestId = input.requestId ?? `mcp-${randomUUID()}`;
		const sideEffects = adapter.sideEffects(input.name);
		const needsApproval = sideEffects.some((effect) => effect !== "read_only");
		const result = await adapter.invoke({
			protocolVersion: CAPABILITY_PROTOCOL_VERSION,
			capability: { name: input.name },
			arguments: input.arguments ?? {},
			context: {
				cwd: options.cwd,
				mode: input.mode ?? "standard",
				taskId: input.taskId ?? "mcp-session",
				stepId: input.stepId ?? requestId,
			},
			correlation: {
				requestId,
				hostSessionId: extra.sessionId,
				providerTaskId: input.taskId,
			},
			approval: needsApproval ? "unavailable" : "not_required",
			execution: {
				...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
				...(input.retries === undefined ? {} : { retries: input.retries }),
			},
		}, extra.signal);
		return {
			content: [{ type: "text", text: JSON.stringify(result) }],
			structuredContent: result,
			isError: result.status !== "success",
		};
	});

	return server;
}

export async function runDoveMcpStdio(options: DoveMcpServerOptions): Promise<void> {
	const server = createDoveMcpServer(options);
	await server.connect(new StdioServerTransport());
}
