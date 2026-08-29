/** Host/provider-neutral model request accounting and dispatch contracts. */
export interface ModelBudgetConfig {
	readonly contextWindow: number;
	readonly reservedOutput: number;
	readonly reservedReasoning?: number;
	readonly toolSchemaOverhead?: number;
	readonly providerOverhead?: number;
}

export interface ModelPayloadSegment {
	readonly id: string;
	readonly source: string;
	readonly content: string;
	readonly required?: boolean;
	readonly estimatedTokens?: number;
}

export interface ModelPayload<TPayload = unknown> {
	readonly payload: TPayload;
	readonly segments: readonly ModelPayloadSegment[];
	/** Explicit estimate from a compiler; otherwise calculated from segments. */
	readonly inputTokens?: number;
}

export interface BudgetAccounting {
	readonly contextWindow: number;
	readonly inputTokens: number;
	readonly reservedOutput: number;
	readonly reservedReasoning: number;
	readonly toolSchemaOverhead: number;
	readonly providerOverhead: number;
	readonly totalReserved: number;
	readonly availableInput: number;
	readonly overflowTokens: number;
}

export interface BudgetDiagnostic extends BudgetAccounting {
	readonly code: "MODEL_CONTEXT_OVER_BUDGET" | "MODEL_CONTEXT_INVALID_BUDGET";
	readonly message: string;
	readonly requiredSegments: readonly string[];
	readonly segmentTokens: Readonly<Record<string, number>>;
}

export class ModelBudgetError extends Error {
	public readonly diagnostic: BudgetDiagnostic;

	public constructor(diagnostic: BudgetDiagnostic) {
		super(diagnostic.message);
		this.name = "ModelBudgetError";
		this.diagnostic = diagnostic;
	}
}

export type NormalizedStopReason = "completed" | "length" | "tool_call" | "cancelled" | "error" | "unknown";

export function normalizeStopReason(raw: unknown): NormalizedStopReason {
	const value = String(raw ?? "").trim().toLowerCase().replace(/[ -]/g, "_");
	if (["stop", "end", "end_turn", "complete", "completed", "eos", "finished"].includes(value)) return "completed";
	if (["length", "max_tokens", "max_token", "context_length", "token_limit"].includes(value)) return "length";
	if (["tool_call", "tool_calls", "tool_use", "tooluse", "function_call", "function_calls"].includes(value)) return "tool_call";
	if (["cancel", "cancelled", "canceled", "abort", "aborted"].includes(value)) return "cancelled";
	if (["error", "failed", "failure"].includes(value)) return "error";
	return "unknown";
}

export interface ProviderResponse<TResult = unknown> {
	readonly result: TResult;
	readonly stopReason?: unknown;
	readonly usage?: Readonly<Record<string, number>>;
}

export interface GatewayResponse<TResult = unknown> extends ProviderResponse<TResult> {
	readonly stopReason: NormalizedStopReason;
	readonly budget: BudgetAccounting;
}

export interface ModelTransport<TPayload = unknown, TResult = unknown> {
	send(payload: TPayload): Promise<ProviderResponse<TResult>>;
}

/**
 * Convert an opaque provider payload into conservative, auditable segments.
 * Providers differ in envelope shape, but Pi payloads consistently carry
 * message content under `messages` (occasionally nested in `input`). Keeping
 * this decoder here prevents each host adapter from inventing token accounting.
 */
export function providerPayloadSegments(payload: unknown): readonly ModelPayloadSegment[] {
	const segments: ModelPayloadSegment[] = [];
	const messages = findMessages(payload);
	for (const envelope of providerEnvelopeCandidates(payload)) {
		const system = envelope.system;
		const systemText = extractText(system);
		if (systemText) {
			segments.push({ id: "provider-system", source: "provider:system", content: systemText });
			break;
		}
	}
	if (messages.length > 0) {
		messages.forEach((message, index) => {
			const role = typeof message === "object" && message !== null && typeof (message as { role?: unknown }).role === "string"
				? String((message as { role: string }).role) : "message";
			const content = extractText(message);
			if (content) segments.push({ id: `provider-message-${index}`, source: `provider:${role}`, content });
		});
		return segments;
	}
	const content = extractText(payload);
	return content ? [{ id: "provider-payload", source: "provider", content }] : [];
}

export function modelPayloadFromProvider<TPayload>(payload: TPayload): ModelPayload<TPayload> {
	const segments = providerPayloadSegments(payload);
	return { payload, segments };
}

/**
 * Estimate the final serialized provider tool definitions. A missing `tools`
 * field on an otherwise valid request means zero tools; `undefined` is
 * reserved for payloads whose envelope cannot be inspected.
 */
export function providerToolSchemaTokens(payload: unknown): number | undefined {
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
	for (const candidate of providerEnvelopeCandidates(payload)) {
		const tools = candidate.tools;
		if (!Array.isArray(tools)) continue;
		try {
			return estimateTextTokens(JSON.stringify(tools));
		} catch {
			return undefined;
		}
	}
	return 0;
}

/**
 * Bound common provider output fields to the budget actually reserved by the
 * gateway. Returning a replacement envelope keeps accounting and transport in
 * agreement without mutating Pi/provider-owned objects.
 */
const PROVIDER_OUTPUT_TOKEN_FIELDS = ["max_tokens", "max_output_tokens", "max_completion_tokens"] as const;

/** Read the effective explicit provider limit without guessing a provider API. */
export function providerOutputTokenLimit(payload: unknown): number | undefined {
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
	const object = payload as Record<string, unknown>;
	const limits = PROVIDER_OUTPUT_TOKEN_FIELDS
		.map((key) => object[key])
		.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
		.map((value) => Math.floor(value));
	return limits.length > 0 ? Math.min(...limits) : undefined;
}

export function limitProviderOutputTokens<TPayload>(payload: TPayload, maxTokens: number): TPayload {
	const limit = Math.max(1, Math.floor(maxTokens));
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return payload;
	const object = payload as Record<string, unknown>;
	let changed = false;
	const replacement: Record<string, unknown> = { ...object };
	for (const key of PROVIDER_OUTPUT_TOKEN_FIELDS) {
		const value = object[key];
		if (typeof value === "number" && Number.isFinite(value) && value > limit) {
			replacement[key] = limit;
			changed = true;
		}
	}
	return (changed ? replacement : payload) as TPayload;
}

/**
 * Select the output reservation from the final provider input. The request-plan
 * budget is minimum response headroom, not a ceiling. If the provider supplied
 * a smaller explicit limit, that explicit choice remains authoritative.
 *
 * When a request needs clamping but has no known writable output field, retain
 * the requested reservation so ModelGateway rejects it instead of accounting
 * for a limit that transport will not actually receive.
 */
export function boundedOutputReservation(input: {
	contextWindow: number;
	providerRequestedOutput?: number;
	planOutputBudget: number;
	fixedOverhead?: number;
	inputTokens?: number;
	canWriteProviderLimit?: boolean;
}): number {
	const fixedOverhead = finiteNonNegative(input.fixedOverhead);
	const contextWindow = finiteNonNegative(input.contextWindow);
	const inputTokens = finiteNonNegative(input.inputTokens);
	const planOutputBudget = Math.max(1, finiteNonNegative(input.planOutputBudget, 1));
	const providerRequestedOutput = input.providerRequestedOutput === undefined
		? planOutputBudget
		: Math.max(1, finiteNonNegative(input.providerRequestedOutput, planOutputBudget));
	const minimumHeadroom = Math.min(planOutputBudget, providerRequestedOutput);
	const safeCapacity = Math.floor(contextWindow - fixedOverhead - inputTokens);
	if (!Number.isFinite(safeCapacity) || safeCapacity < minimumHeadroom) return minimumHeadroom;
	if (providerRequestedOutput <= safeCapacity) return providerRequestedOutput;
	return input.canWriteProviderLimit === true ? safeCapacity : providerRequestedOutput;
}

function findMessages(payload: unknown): readonly unknown[] {
	for (const envelope of providerEnvelopeCandidates(payload)) if (Array.isArray(envelope.messages)) return envelope.messages;
	return [];
}

/** Root-first, one-level provider envelopes. Consumers stop at the first field
 * they own so duplicate compatibility projections are never double counted. */
function providerEnvelopeCandidates(payload: unknown): readonly Record<string, unknown>[] {
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return [];
	const root = payload as Record<string, unknown>;
	const candidates: Record<string, unknown>[] = [root];
	for (const key of ["input", "body", "request"] as const) {
		const candidate = root[key];
		if (typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)) candidates.push(candidate as Record<string, unknown>);
	}
	return candidates;
}

function extractText(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join("\n");
	if (typeof value !== "object" || value === null) return "";
	const object = value as Record<string, unknown>;
	for (const key of ["content", "text", "value", "prompt", "input"]) {
		if (key in object) {
			const text = extractText(object[key]);
			if (text) return text;
		}
	}
	// Images, audio, and provider-specific content blocks have no plain text
	// field but still consume context. Include a bounded structural marker so
	// the final gate remains conservative without dumping binary/base64 data.
	if ("type" in object || "image_url" in object || "data" in object) {
		try { return JSON.stringify(object).slice(0, 8_192); } catch { return "[non-text-content]"; }
	}
	return "";
}

function finiteNonNegative(value: number | undefined, fallback = 0): number {
	return value === undefined ? fallback : Number.isFinite(value) && value >= 0 ? Math.floor(value) : Number.NaN;
}

function estimateTextTokens(content: string): number {
	let estimate = 0;
	for (const character of content) estimate += /[\u0000-\u007f]/.test(character) ? 0.25 : 1;
	return Math.ceil(estimate);
}

function estimateSegmentTokens(segment: ModelPayloadSegment): number {
	if (segment.estimatedTokens !== undefined) return finiteNonNegative(segment.estimatedTokens);
	return estimateTextTokens(segment.content);
}

export function accountModelBudget<TPayload>(request: ModelPayload<TPayload>, config: ModelBudgetConfig): BudgetAccounting {
	const segmentTokens = request.segments.reduce((sum, segment) => sum + estimateSegmentTokens(segment), 0);
	const inputTokens = request.inputTokens === undefined ? segmentTokens : finiteNonNegative(request.inputTokens);
	const reservedOutput = finiteNonNegative(config.reservedOutput);
	const reservedReasoning = finiteNonNegative(config.reservedReasoning);
	const toolSchemaOverhead = finiteNonNegative(config.toolSchemaOverhead);
	const providerOverhead = finiteNonNegative(config.providerOverhead);
	const contextWindow = finiteNonNegative(config.contextWindow);
	const totalReserved = reservedOutput + reservedReasoning + toolSchemaOverhead + providerOverhead;
	const availableInput = contextWindow - totalReserved;
	return {
		contextWindow,
		inputTokens,
		reservedOutput,
		reservedReasoning,
		toolSchemaOverhead,
		providerOverhead,
		totalReserved,
		availableInput,
		overflowTokens: Math.max(0, inputTokens - availableInput),
	};
}

export function validateModelBudget<TPayload>(request: ModelPayload<TPayload>, config: ModelBudgetConfig): BudgetAccounting {
	const accounting = accountModelBudget(request, config);
	const invalid = !Number.isFinite(accounting.contextWindow) || accounting.contextWindow <= 0 ||
		!Number.isFinite(accounting.inputTokens) || !Number.isFinite(accounting.totalReserved) || accounting.totalReserved < 0;
	if (invalid) {
		throw new ModelBudgetError({
			...accounting,
			code: "MODEL_CONTEXT_INVALID_BUDGET",
			message: "Model context budget is invalid; provider dispatch was refused.",
			requiredSegments: request.segments.filter((segment) => segment.required).map((segment) => segment.id),
			segmentTokens: Object.fromEntries(request.segments.map((segment) => [segment.id, estimateSegmentTokens(segment)])),
		});
	}
	if (accounting.overflowTokens > 0) {
		throw new ModelBudgetError({
			...accounting,
			code: "MODEL_CONTEXT_OVER_BUDGET",
			message: `Model payload exceeds context window by ${accounting.overflowTokens} token(s); provider dispatch was refused.`,
			requiredSegments: request.segments.filter((segment) => segment.required).map((segment) => segment.id),
			segmentTokens: Object.fromEntries(request.segments.map((segment) => [segment.id, estimateSegmentTokens(segment)])),
		});
	}
	return accounting;
}

export class ModelGateway {
	public constructor(private readonly config: ModelBudgetConfig) {}

	public validate<TPayload>(request: ModelPayload<TPayload>): BudgetAccounting {
		return validateModelBudget(request, this.config);
	}

	/** Validates the complete request before invoking transport.send exactly once. */
	public async dispatch<TPayload, TResult>(request: ModelPayload<TPayload>, transport: ModelTransport<TPayload, TResult>): Promise<GatewayResponse<TResult>> {
		const budget = this.validate(request);
		const response = await transport.send(request.payload);
		return { ...response, stopReason: normalizeStopReason(response.stopReason), budget };
	}
}
