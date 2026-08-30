import { createHash } from "node:crypto";

export interface ProgressToolResult {
	toolName: string;
	isError: boolean;
	input?: unknown;
	observation?: unknown;
	idempotent?: boolean;
}

export interface ProgressGuardOptions {
	consecutiveErrorThreshold?: number;
	repeatedFailureThreshold?: number;
	repeatedSuccessThreshold?: number;
	repeatedSuccessHardStopThreshold?: number;
	longRunMinutes?: number;
}

export interface ProgressSnapshot {
	active: boolean;
	startedAt?: number;
	lastActivityAt?: number;
	toolCalls: number;
	toolErrors: number;
	consecutiveToolErrors: number;
	lastToolName?: string;
	lastFailureFingerprint?: string;
	repeatedFailureCount: number;
	repeatedSuccessCount: number;
	longRun: boolean;
	warning?: "consecutive-errors" | "repeated-failure" | "repeated-success";
}

export interface ProgressWarning {
	kind: "consecutive-errors" | "repeated-failure" | "repeated-success";
	message: string;
	snapshot: ProgressSnapshot;
}

function positiveInteger(value: number | undefined, fallback: number): number {
	return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function stableProgressSerialize(value: unknown): string {
	if (value === undefined) return "undefined";
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableProgressSerialize).join(",")}]`;
	return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableProgressSerialize(entry)}`).join(",")}}`;
}

/** Normalize only the host defaults that affect call identity. The digest keeps
 * paths, commands, and credentials out of ledger-visible fingerprints. */
export function normalizeProgressInput(toolName: string, input: unknown): unknown {
	if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
	const normalized = { ...(input as Record<string, unknown>) };
	if (toolName === "ls" && (typeof normalized.path !== "string" || normalized.path.trim() === "")) normalized.path = ".";
	return normalized;
}

export function progressFingerprint(toolName: string, input: unknown): string {
	const canonical = stableProgressSerialize(normalizeProgressInput(toolName, input));
	return `${toolName}:${createHash("sha256").update(canonical).digest("hex").slice(0, 24)}`;
}

function observationFingerprint(value: unknown): string {
	return createHash("sha256").update(stableProgressSerialize(value)).digest("hex").slice(0, 24);
}

export interface ProgressToolCallDecision {
	readonly action: "allow" | "coalesce" | "terminate";
	readonly fingerprint: string;
	readonly primaryToolCallId?: string;
	readonly reason?: string;
}

export class ProgressGuard {
	private readonly consecutiveErrorThreshold: number;
	private readonly repeatedFailureThreshold: number;
	private readonly repeatedSuccessThreshold: number;
	private readonly repeatedSuccessHardStopThreshold: number;
	private readonly longRunMs: number;
	private state: ProgressSnapshot = this.emptySnapshot();
	private lastFailureFingerprint?: string;
	private readonly batchCalls = new Map<string, string>();
	private lastSuccessfulObservation?: { callFingerprint: string; observationFingerprint: string; count: number };

	constructor(options: ProgressGuardOptions = {}) {
		this.consecutiveErrorThreshold = positiveInteger(options.consecutiveErrorThreshold, 3);
		this.repeatedFailureThreshold = positiveInteger(options.repeatedFailureThreshold, 2);
		this.repeatedSuccessThreshold = positiveInteger(options.repeatedSuccessThreshold, 2);
		this.repeatedSuccessHardStopThreshold = Math.max(this.repeatedSuccessThreshold, positiveInteger(options.repeatedSuccessHardStopThreshold, 3));
		this.longRunMs = positiveInteger(options.longRunMinutes, 20) * 60_000;
	}

	private emptySnapshot(): ProgressSnapshot {
		return {
			active: false,
			toolCalls: 0,
			toolErrors: 0,
			consecutiveToolErrors: 0,
			repeatedFailureCount: 0,
			repeatedSuccessCount: 0,
			longRun: false,
		};
	}

	start(now = Date.now()): void {
		this.state = { ...this.emptySnapshot(), active: true, startedAt: now, lastActivityAt: now };
		this.lastFailureFingerprint = undefined;
		this.batchCalls.clear();
		this.lastSuccessfulObservation = undefined;
	}

	beginToolBatch(): void {
		this.batchCalls.clear();
	}

	beforeToolCall(toolCallId: string, toolName: string, input: unknown, idempotent: boolean): ProgressToolCallDecision {
		const fingerprint = progressFingerprint(toolName, input);
		if (!idempotent) return { action: "allow", fingerprint };
		const primaryToolCallId = this.batchCalls.get(fingerprint);
		if (primaryToolCallId) {
			return { action: "coalesce", fingerprint, primaryToolCallId, reason: `Duplicate read-only call coalesced with ${primaryToolCallId}` };
		}
		const previous = this.lastSuccessfulObservation;
		if (previous && previous.callFingerprint === fingerprint && previous.count >= this.repeatedSuccessHardStopThreshold) {
			return { action: "terminate", fingerprint, reason: `Unchanged read-only observation repeated ${previous.count} times; stop and change strategy` };
		}
		this.batchCalls.set(fingerprint, toolCallId);
		return { action: "allow", fingerprint };
	}

	end(now = Date.now()): void {
		if (!this.state.active) return;
		this.state = { ...this.state, active: false, lastActivityAt: now };
	}

	recordToolResult(result: ProgressToolResult, now = Date.now()): ProgressWarning | undefined {
		if (!this.state.active) this.start(now);
		const previousWarning = this.state.warning;
		const fingerprint = result.isError ? progressFingerprint(result.toolName, result.input) : undefined;
		const repeatedFailureCount = fingerprint && fingerprint === this.lastFailureFingerprint ? this.state.repeatedFailureCount + 1 : fingerprint ? 1 : 0;
		this.lastFailureFingerprint = fingerprint;
		const consecutiveToolErrors = result.isError ? this.state.consecutiveToolErrors + 1 : 0;
		const callFingerprint = progressFingerprint(result.toolName, result.input);
		let repeatedSuccessCount = 0;
		if (!result.isError && result.idempotent) {
			const observationDigest = observationFingerprint(result.observation);
			const previous = this.lastSuccessfulObservation;
			repeatedSuccessCount = previous?.callFingerprint === callFingerprint && previous.observationFingerprint === observationDigest ? previous.count + 1 : 1;
			this.lastSuccessfulObservation = { callFingerprint, observationFingerprint: observationDigest, count: repeatedSuccessCount };
		} else {
			// An error, mutation, or unknown tool is a progress boundary. It must
			// prevent an old read from being hard-stopped after state may have changed.
			this.lastSuccessfulObservation = undefined;
		}
		this.state = {
			...this.state,
			lastActivityAt: now,
			toolCalls: this.state.toolCalls + 1,
			toolErrors: this.state.toolErrors + (result.isError ? 1 : 0),
			consecutiveToolErrors,
			lastToolName: result.toolName,
			lastFailureFingerprint: fingerprint,
			repeatedFailureCount,
			repeatedSuccessCount,
			longRun: this.state.startedAt !== undefined && now - this.state.startedAt >= this.longRunMs,
			warning: result.isError ? previousWarning : undefined,
		};
		if (!result.isError && result.idempotent && repeatedSuccessCount >= this.repeatedSuccessThreshold && previousWarning !== "repeated-success") {
			this.state.warning = "repeated-success";
			return {
				kind: "repeated-success",
				message: `检测到同一个只读工具返回了 ${repeatedSuccessCount} 次未变化结果；请停止重复读取并更换策略。`,
				snapshot: this.snapshot(),
			};
		}
		if (result.isError && repeatedFailureCount >= this.repeatedFailureThreshold && previousWarning !== "repeated-failure") {
			this.state.warning = "repeated-failure";
			return {
				kind: "repeated-failure",
				message: `检测到同一个工具失败调用重复 ${repeatedFailureCount} 次；建议停止重复尝试，重新读取当前状态后再继续。`,
				snapshot: this.snapshot(),
			};
		}
		if (result.isError && consecutiveToolErrors >= this.consecutiveErrorThreshold && previousWarning !== "consecutive-errors") {
			this.state.warning = "consecutive-errors";
			return {
				kind: "consecutive-errors",
				message: `检测到连续 ${consecutiveToolErrors} 次工具失败；建议生成 checkpoint，确认假设和下一步，不要继续盲目重试。`,
				snapshot: this.snapshot(),
			};
		}
		return undefined;
	}

	snapshot(now = Date.now()): ProgressSnapshot {
		const longRun = this.state.startedAt !== undefined && now - this.state.startedAt >= this.longRunMs;
		return { ...this.state, longRun };
	}

	reset(): void {
		this.state = this.emptySnapshot();
		this.lastFailureFingerprint = undefined;
		this.batchCalls.clear();
		this.lastSuccessfulObservation = undefined;
	}
}

export function formatProgressSnapshot(snapshot: ProgressSnapshot, now = Date.now()): string {
	if (!snapshot.active) return "idle";
	const duration = snapshot.startedAt === undefined ? 0 : Math.max(0, Math.floor((now - snapshot.startedAt) / 60_000));
	const warning = snapshot.warning ? `, warning=${snapshot.warning}` : "";
	return `running ${duration}m, tools=${snapshot.toolCalls}, errors=${snapshot.toolErrors}, consecutiveErrors=${snapshot.consecutiveToolErrors}, repeatedSuccess=${snapshot.repeatedSuccessCount}${snapshot.longRun ? ", longRun=true" : ""}${warning}`;
}
