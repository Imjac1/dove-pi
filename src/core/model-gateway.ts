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
	if (typeof payload === "object" && payload !== null) {
		const system = (payload as { system?: unknown }).system;
		const systemText = extractText(system);
		if (systemText) segments.push({ id: "provider-system", source: "provider:system", content: systemText });
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

function findMessages(payload: unknown): readonly unknown[] {
	if (typeof payload !== "object" || payload === null) return [];
	const candidate = (payload as { messages?: unknown; input?: unknown }).messages;
	if (Array.isArray(candidate)) return candidate;
	const input = (payload as { input?: unknown }).input;
	if (typeof input === "object" && input !== null && Array.isArray((input as { messages?: unknown }).messages)) {
		return (input as { messages: unknown[] }).messages;
	}
	return [];
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

function estimateSegmentTokens(segment: ModelPayloadSegment): number {
	if (segment.estimatedTokens !== undefined) return finiteNonNegative(segment.estimatedTokens);
	let estimate = 0;
	for (const character of segment.content) estimate += /[\u0000-\u007f]/.test(character) ? 0.25 : 1;
	return Math.ceil(estimate);
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
