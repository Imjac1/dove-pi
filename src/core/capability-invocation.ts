import { randomUUID } from "node:crypto";
import type { TSchema } from "typebox";
import { Value } from "typebox/value";
import type { CapabilityRegistry } from "./capability-registry.ts";
import { CAPABILITY_PROTOCOL_VERSION, capabilityManifest, parseCapabilityInvocationRequest, parseCapabilityInvocationResponse, type CapabilityInvocationRequest, type CapabilityInvocationResponse, type CapabilityProtocolManifest } from "./capability-protocol.ts";
import { ExecutionLedger } from "./execution-ledger.ts";
import { executeFastPath, type CapabilityExecutionOptions } from "./fast-path.ts";

export type RuntimePlatform = "windows" | "linux" | "macos";

export interface CapabilityInvocationServiceOptions {
	readonly platform?: RuntimePlatform;
	readonly ownerPid?: number;
	readonly authorize?: (request: CapabilityInvocationRequest) => boolean | Promise<boolean>;
	readonly captureEvidence?: CapabilityExecutionOptions["captureEvidence"];
}

/** One host-neutral entry point shared by Pi, CLI/RPC, and MCP adapters. */
export class CapabilityInvocationService {
	public constructor(
		private readonly registry: CapabilityRegistry,
		private readonly ledger: ExecutionLedger,
		private readonly options: CapabilityInvocationServiceOptions = {},
	) {}

	public discover(): readonly CapabilityProtocolManifest[] {
		return this.registry.list().map(capabilityManifest);
	}

	public async invoke(rawRequest: unknown, signal?: AbortSignal): Promise<CapabilityInvocationResponse> {
		const request = parseCapabilityInvocationRequest(rawRequest);
		const definition = this.registry.require(request.capability.name);
		if (request.capability.version && request.capability.version !== definition.version) {
			throw new Error(`Capability version mismatch: requested ${request.capability.version}, available ${definition.version}.`);
		}
		if (definition.parameterSchema && !Value.Check(definition.parameterSchema as TSchema, request.arguments)) {
			throw new Error(`Capability arguments do not match the advertised parameter schema: ${definition.name}.`);
		}
		const executionId = `exec-${randomUUID()}`;
		if (!supportsPlatform(definition.platforms, this.options.platform ?? runtimePlatform())) {
			return response(request, definition.version, executionId, "unsupported_platform", 0, [], undefined, `Capability ${definition.name} does not support ${this.options.platform ?? runtimePlatform()}.`);
		}

		const approval = request.approval ?? "unavailable";
		const requiresApproval = definition.sideEffects.some((effect) => effect !== "read_only");
		const result = await executeFastPath(this.registry, this.ledger, definition.name, request.arguments, {
			cwd: request.context.cwd,
			mode: request.context.mode,
			taskId: request.context.taskId,
			stepId: request.context.stepId,
			signal,
			requestId: request.correlation.requestId,
			sessionId: request.correlation.hostSessionId,
			toolCallId: request.correlation.toolCallId,
			ownerPid: this.options.ownerPid,
		}, {
			required: true,
			recordPending: requiresApproval,
			authorize: async () => {
				if (!requiresApproval) return true;
				if (approval !== "granted") return false;
				return this.options.authorize ? await this.options.authorize(request) : false;
			},
		}, {
			timeoutMs: request.execution?.timeoutMs,
			retries: request.execution?.retries,
			executionId,
			captureEvidence: this.options.captureEvidence,
		});

		const status = result.outcome === "approval_denied" ? "approval_denied"
			: result.outcome === "cancelled" ? "cancelled"
			: result.outcome === "timed_out" ? "timeout"
			: result.status === "success" ? "success" : "failure";
		return response(request, definition.version, executionId, status, result.durationMs, result.evidenceRefs, result.result, result.error);
	}
}

function response(
	request: CapabilityInvocationRequest,
	version: string,
	executionId: string,
	status: CapabilityInvocationResponse["status"],
	durationMs: number,
	evidenceRefs: readonly string[],
	result?: unknown,
	error?: string,
): CapabilityInvocationResponse {
	return parseCapabilityInvocationResponse({
		protocolVersion: CAPABILITY_PROTOCOL_VERSION,
		capability: { name: request.capability.name, version },
		status,
		correlation: { ...request.correlation, executionId },
		durationMs,
		evidenceRefs,
		...(result === undefined ? {} : { result }),
		...(error ? { error } : {}),
	});
}

function supportsPlatform(platforms: readonly string[], platform: RuntimePlatform): boolean {
	return platforms.includes("any") || platforms.includes(platform);
}

function runtimePlatform(): RuntimePlatform {
	if (process.platform === "win32") return "windows";
	if (process.platform === "darwin") return "macos";
	return "linux";
}
