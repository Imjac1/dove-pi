import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import type { CapabilityDefinition } from "./contracts.ts";

export const CAPABILITY_PROTOCOL_VERSION = "1.0.0" as const;
const SEMVER_PATTERN = "^(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)(?:-(?:(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$";
const semanticVersionSchema = Type.String({ minLength: 1, maxLength: 64, pattern: SEMVER_PATTERN });

const agentModeSchema = Type.Union([
	Type.Literal("fast"),
	Type.Literal("standard"),
	Type.Literal("ultra"),
]);

const correlationSchema = Type.Object({
	requestId: Type.String({ minLength: 1, maxLength: 160 }),
	hostSessionId: Type.Optional(Type.String({ minLength: 1, maxLength: 320 })),
	providerTaskId: Type.Optional(Type.String({ minLength: 1, maxLength: 320 })),
	toolCallId: Type.Optional(Type.String({ minLength: 1, maxLength: 320 })),
}, { additionalProperties: false });

export const CapabilityInvocationRequestSchema = Type.Object({
	protocolVersion: Type.Literal(CAPABILITY_PROTOCOL_VERSION),
	capability: Type.Object({
		name: Type.String({ minLength: 1, maxLength: 160, pattern: "^[a-z0-9]+(?:[._-][a-z0-9]+)*$" }),
		version: Type.Optional(semanticVersionSchema),
	}, { additionalProperties: false }),
	arguments: Type.Record(Type.String({ maxLength: 160 }), Type.Unknown(), { maxProperties: 64 }),
	context: Type.Object({
		cwd: Type.String({ minLength: 1, maxLength: 32_768 }),
		mode: agentModeSchema,
		taskId: Type.String({ minLength: 1, maxLength: 320 }),
		stepId: Type.String({ minLength: 1, maxLength: 320 }),
	}, { additionalProperties: false }),
	correlation: correlationSchema,
	approval: Type.Optional(Type.Union([
		Type.Literal("not_required"),
		Type.Literal("granted"),
		Type.Literal("denied"),
		Type.Literal("unavailable"),
	])),
	execution: Type.Optional(Type.Object({
		timeoutMs: Type.Optional(Type.Integer({ minimum: 1, maximum: 86_400_000 })),
		retries: Type.Optional(Type.Integer({ minimum: 0, maximum: 10 })),
	}, { additionalProperties: false })),
}, { additionalProperties: false });

export const CapabilityInvocationResponseSchema = Type.Object({
	protocolVersion: Type.Literal(CAPABILITY_PROTOCOL_VERSION),
	capability: Type.Object({ name: Type.String(), version: semanticVersionSchema }, { additionalProperties: false }),
	status: Type.Union([
		Type.Literal("success"),
		Type.Literal("failure"),
		Type.Literal("approval_denied"),
		Type.Literal("cancelled"),
		Type.Literal("timeout"),
		Type.Literal("unsupported_platform"),
	]),
	correlation: Type.Object({
		requestId: Type.String({ minLength: 1, maxLength: 160 }),
		hostSessionId: Type.Optional(Type.String({ minLength: 1, maxLength: 320 })),
		providerTaskId: Type.Optional(Type.String({ minLength: 1, maxLength: 320 })),
		toolCallId: Type.Optional(Type.String({ minLength: 1, maxLength: 320 })),
		executionId: Type.String({ minLength: 1, maxLength: 320 }),
	}, { additionalProperties: false }),
	durationMs: Type.Number({ minimum: 0 }),
	evidenceRefs: Type.Array(Type.String()),
	result: Type.Optional(Type.Unknown()),
	error: Type.Optional(Type.String()),
}, { additionalProperties: false });

export type CapabilityInvocationRequest = Static<typeof CapabilityInvocationRequestSchema>;
export type CapabilityInvocationResponse = Static<typeof CapabilityInvocationResponseSchema>;

export interface CapabilityProtocolManifest {
	readonly protocolVersion: typeof CAPABILITY_PROTOCOL_VERSION;
	readonly name: string;
	readonly version: string;
	readonly description: string;
	readonly platforms: readonly string[];
	readonly sideEffects: readonly string[];
	readonly idempotent: boolean;
	readonly lifecycle: CapabilityDefinition["status"];
	readonly parameterSchema: Readonly<Record<string, unknown>>;
	readonly requiredArguments: readonly string[];
	readonly preconditions: NonNullable<CapabilityDefinition["preconditions"]>;
	readonly evidence: NonNullable<CapabilityDefinition["evidence"]>;
}

export function capabilityManifest(definition: CapabilityDefinition): CapabilityProtocolManifest {
	if (!Value.Check(semanticVersionSchema, definition.version)) {
		throw new Error(`Capability version is not valid SemVer 2.0.0: ${definition.name}@${definition.version}.`);
	}
	return Object.freeze({
		protocolVersion: CAPABILITY_PROTOCOL_VERSION,
		name: definition.name,
		version: definition.version,
		description: definition.description,
		platforms: Object.freeze([...definition.platforms]),
		sideEffects: Object.freeze([...definition.sideEffects]),
		idempotent: definition.idempotent,
		lifecycle: definition.status,
		parameterSchema: definition.parameterSchema ?? Object.freeze({ type: "object", additionalProperties: true }),
		requiredArguments: Object.freeze([...(definition.requiredArgs ?? [])]),
		preconditions: Object.freeze([...(definition.preconditions ?? [])]),
		evidence: Object.freeze([...(definition.evidence ?? [])]),
	});
}

export function parseCapabilityInvocationRequest(value: unknown): CapabilityInvocationRequest {
	if (!Value.Check(CapabilityInvocationRequestSchema, value)) {
		throw new Error("Invalid Capability Protocol invocation request.");
	}
	return value;
}

export function parseCapabilityInvocationResponse(value: unknown): CapabilityInvocationResponse {
	if (!Value.Check(CapabilityInvocationResponseSchema, value)) {
		throw new Error("Invalid Capability Protocol invocation response.");
	}
	return value;
}
