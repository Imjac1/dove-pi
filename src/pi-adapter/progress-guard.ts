export interface ProgressToolResult {
	toolName: string;
	isError: boolean;
	input?: unknown;
}

export interface ProgressGuardOptions {
	consecutiveErrorThreshold?: number;
	repeatedFailureThreshold?: number;
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
	longRun: boolean;
	warning?: "consecutive-errors" | "repeated-failure";
}

export interface ProgressWarning {
	kind: "consecutive-errors" | "repeated-failure";
	message: string;
	snapshot: ProgressSnapshot;
}

function positiveInteger(value: number | undefined, fallback: number): number {
	return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function stableSerialize(value: unknown): string {
	if (value === undefined) return "undefined";
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
	return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(",")}}`;
}

export function progressFingerprint(toolName: string, input: unknown): string {
	return `${toolName}:${stableSerialize(input)}`;
}

export class ProgressGuard {
	private readonly consecutiveErrorThreshold: number;
	private readonly repeatedFailureThreshold: number;
	private readonly longRunMs: number;
	private state: ProgressSnapshot = this.emptySnapshot();
	private lastFailureFingerprint?: string;

	constructor(options: ProgressGuardOptions = {}) {
		this.consecutiveErrorThreshold = positiveInteger(options.consecutiveErrorThreshold, 3);
		this.repeatedFailureThreshold = positiveInteger(options.repeatedFailureThreshold, 2);
		this.longRunMs = positiveInteger(options.longRunMinutes, 20) * 60_000;
	}

	private emptySnapshot(): ProgressSnapshot {
		return {
			active: false,
			toolCalls: 0,
			toolErrors: 0,
			consecutiveToolErrors: 0,
			repeatedFailureCount: 0,
			longRun: false,
		};
	}

	start(now = Date.now()): void {
		this.state = { ...this.emptySnapshot(), active: true, startedAt: now, lastActivityAt: now };
		this.lastFailureFingerprint = undefined;
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
		this.state = {
			...this.state,
			lastActivityAt: now,
			toolCalls: this.state.toolCalls + 1,
			toolErrors: this.state.toolErrors + (result.isError ? 1 : 0),
			consecutiveToolErrors,
			lastToolName: result.toolName,
			lastFailureFingerprint: fingerprint,
			repeatedFailureCount,
			longRun: this.state.startedAt !== undefined && now - this.state.startedAt >= this.longRunMs,
			warning: result.isError ? previousWarning : undefined,
		};
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
	}
}

export function formatProgressSnapshot(snapshot: ProgressSnapshot, now = Date.now()): string {
	if (!snapshot.active) return "idle";
	const duration = snapshot.startedAt === undefined ? 0 : Math.max(0, Math.floor((now - snapshot.startedAt) / 60_000));
	const warning = snapshot.warning ? `, warning=${snapshot.warning}` : "";
	return `running ${duration}m, tools=${snapshot.toolCalls}, errors=${snapshot.toolErrors}, consecutiveErrors=${snapshot.consecutiveToolErrors}${snapshot.longRun ? ", longRun=true" : ""}${warning}`;
}
