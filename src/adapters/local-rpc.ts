import type { Readable, Writable } from "node:stream";
import { CapabilityInvocationService } from "../core/capability-invocation.ts";
import type { CapabilityInvocationRequest } from "../core/capability-protocol.ts";
import { ExecutionLedger } from "../core/execution-ledger.ts";
import { createDoveRuntime } from "../runtime.ts";

export const LOCAL_RPC_VERSION = "1.0.0" as const;
export const MAX_RPC_LINE_BYTES = 128 * 1024;

export interface JsonRpcRequest {
	readonly jsonrpc: "2.0";
	readonly id: string | number | null;
	readonly method: "capabilities/list" | "capabilities/invoke";
	readonly params?: unknown;
}

export type JsonRpcResponse =
	| { readonly jsonrpc: "2.0"; readonly id: JsonRpcRequest["id"]; readonly result: unknown }
	| { readonly jsonrpc: "2.0"; readonly id: JsonRpcRequest["id"]; readonly error: { readonly code: number; readonly message: string } };

export class LocalCapabilityAdapter {
	private readonly runtime = createDoveRuntime();
	private readonly service: CapabilityInvocationService;

	public constructor(ledgerPath: string, options: { readonly ownerPid?: number; readonly authorize?: (request: CapabilityInvocationRequest) => boolean | Promise<boolean> } = {}) {
		this.service = new CapabilityInvocationService(this.runtime.capabilities, new ExecutionLedger(ledgerPath), {
			ownerPid: options.ownerPid,
			authorize: options.authorize,
		});
	}

	public discover() {
		return this.service.discover();
	}

	public sideEffects(name: string): readonly string[] {
		return this.runtime.capabilities.require(name).sideEffects;
	}

	public async invoke(request: CapabilityInvocationRequest, signal?: AbortSignal) {
		return await this.service.invoke(request, signal);
	}

	public async handleRpc(raw: unknown): Promise<JsonRpcResponse> {
		const request = parseRpcRequest(raw);
		try {
			const result = request.method === "capabilities/list"
				? { rpcVersion: LOCAL_RPC_VERSION, capabilities: this.discover() }
				: await this.service.invoke(request.params);
			return { jsonrpc: "2.0", id: request.id, result };
		} catch (error) {
			return { jsonrpc: "2.0", id: request.id, error: { code: -32_000, message: error instanceof Error ? error.message : String(error) } };
		}
	}
}

export async function runLocalRpcStdio(adapter: LocalCapabilityAdapter, input: Readable, output: Writable): Promise<void> {
	let pending = Buffer.alloc(0);
	let discardingOversizedLine = false;
	for await (const chunk of input) {
		let bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
		while (bytes.length > 0) {
			const newline = bytes.indexOf(0x0a);
			const fragment = newline >= 0 ? bytes.subarray(0, newline) : bytes;
			if (discardingOversizedLine) {
				if (newline >= 0) {
					writeOversizedRpcError(output);
					discardingOversizedLine = false;
				}
			} else if (pending.length + fragment.length > MAX_RPC_LINE_BYTES) {
				pending = Buffer.alloc(0);
				if (newline >= 0) writeOversizedRpcError(output);
				else discardingOversizedLine = true;
			} else {
				pending = pending.length === 0 ? Buffer.from(fragment) : Buffer.concat([pending, fragment]);
				if (newline >= 0) {
					if (pending.at(-1) === 0x0d) pending = pending.subarray(0, -1);
					await writeRpcResponse(adapter, pending.toString("utf8"), output);
					pending = Buffer.alloc(0);
				}
			}
			bytes = newline >= 0 ? bytes.subarray(newline + 1) : Buffer.alloc(0);
		}
	}
	if (discardingOversizedLine) writeOversizedRpcError(output);
	else if (pending.length > 0) await writeRpcResponse(adapter, pending.toString("utf8"), output);
}

async function writeRpcResponse(adapter: LocalCapabilityAdapter, line: string, output: Writable): Promise<void> {
	let response: JsonRpcResponse;
	try {
		response = await adapter.handleRpc(JSON.parse(line));
	} catch (error) {
		response = { jsonrpc: "2.0", id: null, error: { code: -32_700, message: error instanceof Error ? error.message : String(error) } };
	}
	output.write(`${JSON.stringify(response)}\n`);
}

function writeOversizedRpcError(output: Writable): void {
	const response: JsonRpcResponse = { jsonrpc: "2.0", id: null, error: { code: -32_700, message: `RPC request exceeds ${MAX_RPC_LINE_BYTES} bytes.` } };
	output.write(`${JSON.stringify(response)}\n`);
}

function parseRpcRequest(value: unknown): JsonRpcRequest {
	if (typeof value !== "object" || value === null) throw new Error("Invalid JSON-RPC request.");
	const candidate = value as Record<string, unknown>;
	if (candidate.jsonrpc !== "2.0") throw new Error("JSON-RPC version must be 2.0.");
	if (candidate.method !== "capabilities/list" && candidate.method !== "capabilities/invoke") throw new Error("Unsupported JSON-RPC method.");
	if (candidate.id !== null && typeof candidate.id !== "string" && typeof candidate.id !== "number") throw new Error("JSON-RPC id must be a string, number, or null.");
	return candidate as unknown as JsonRpcRequest;
}
