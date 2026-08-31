import { createHash } from "node:crypto";

export interface ProgressToolResult {
	toolName: string;
	isError: boolean;
	input?: unknown;
	observation?: unknown;
	details?: unknown;
	idempotent?: boolean;
}

export interface ProgressGuardOptions {
	consecutiveErrorThreshold?: number;
	repeatedFailureThreshold?: number;
	repeatedSuccessThreshold?: number;
	repeatedSuccessHardStopThreshold?: number;
	interactiveQuestionThreshold?: number;
	interactiveQuestionHardStopThreshold?: number;
	longRunMinutes?: number;
}

export interface ProgressRunOptions {
	readOnlyToolWarningThreshold?: number;
	readOnlyToolHardStopThreshold?: number;
}

export interface ProgressSnapshot {
	active: boolean;
	startedAt?: number;
	lastActivityAt?: number;
	toolCalls: number;
	readOnlyToolCalls: number;
	toolErrors: number;
	consecutiveToolErrors: number;
	lastToolName?: string;
	lastFailureFingerprint?: string;
	repeatedFailureCount: number;
	repeatedSuccessCount: number;
	interactiveQuestionRepeatCount: number;
	interactivePositiveAnswerCount: number;
	longRun: boolean;
	warning?: "consecutive-errors" | "repeated-failure" | "repeated-success" | "interactive-confirmation-loop" | "read-only-budget";
}

export interface ProgressWarning {
	kind: "consecutive-errors" | "repeated-failure" | "repeated-success" | "interactive-confirmation-loop" | "read-only-budget";
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

type InteractiveOptionIntent = "affirmative" | "negative" | "other";

interface InteractiveQuestionProfile {
	shapeFingerprint: string;
	tokens: ReadonlySet<string>;
}

interface InteractiveQuestionState {
	profile: InteractiveQuestionProfile;
	repeatCount: number;
	positiveAnswerCount: number;
	lastAnswerAffirmative: boolean;
}

const INTERACTIVE_STOP_WORDS = new Set([
	"a", "an", "and", "are", "as", "at", "before", "confirm", "confirmation", "do", "for", "in", "is", "it", "last", "of", "on", "the", "this", "to", "with",
	"一个", "之后", "之前", "进入", "任务", "问题", "本轮", "现在", "收到", "确认", "创建后", "范围", "立即", "执行前", "执行后",
]);

function interactiveTextTokens(value: unknown): ReadonlySet<string> {
	if (typeof value !== "string") return new Set();
	const normalized = value
		.toLocaleLowerCase()
		.replace(/https?:\/\/\S+/g, " value ")
		.replace(/`[^`]*`|"[^"]*"|'[^']*'/g, " value ")
		.replace(/\d+/g, " value ")
		.replace(/确认|任务|问题|本轮|之后|之前|进入|范围|立即|最后|直接|收到|现在|执行前|执行后/g, " ");
	const tokens = normalized.match(/[a-z][a-z0-9_-]*|[\u3400-\u9fff]+/g) ?? [];
	return new Set(tokens.filter((token) => !INTERACTIVE_STOP_WORDS.has(token)));
}

function interactiveOptionIntent(value: unknown): InteractiveOptionIntent {
	if (typeof value !== "string") return "other";
	const text = value.toLocaleLowerCase();
	if (/\b(no|cancel|decline|reject|abort|defer|adjust|skip|not)\b|取消|否|拒绝|暂缓|调整|先改|不创建|不要/.test(text)) return "negative";
	if (/\b(yes|ok|okay|confirm|approve|create|execute|proceed|continue|start|accept)\b|确认|创建|执行|继续|开始|同意|确定|好/.test(text)) return "affirmative";
	return "other";
}

function interactiveQuestionProfile(input: unknown): InteractiveQuestionProfile | undefined {
	if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
	const questions = (input as { questions?: unknown }).questions;
	if (!Array.isArray(questions) || questions.length === 0) return undefined;
	const profiles = questions.map((rawQuestion) => {
		const question = rawQuestion && typeof rawQuestion === "object" ? rawQuestion as Record<string, unknown> : {};
		const options = Array.isArray(question.options) ? question.options : [];
		const optionIntents = options.map((rawOption) => {
			const option = rawOption && typeof rawOption === "object" ? rawOption as Record<string, unknown> : {};
			return interactiveOptionIntent(option.label);
		});
		return {
			multiSelect: question.multiSelect === true,
			optionIntents,
			text: `${typeof question.header === "string" ? question.header : ""} ${typeof question.question === "string" ? question.question : ""}`,
		};
	});
	const hasConfirmationShape = profiles.every((profile) => profile.optionIntents.includes("affirmative") && profile.optionIntents.includes("negative"));
	if (!hasConfirmationShape) return undefined;
	const shapeFingerprint = createHash("sha256").update(stableProgressSerialize(profiles.map(({ multiSelect, optionIntents }) => ({ multiSelect, optionIntents })))).digest("hex").slice(0, 24);
	const tokens = new Set<string>();
	for (const profile of profiles) for (const token of interactiveTextTokens(profile.text)) tokens.add(token);
	return { shapeFingerprint, tokens };
}

function equivalentInteractiveQuestion(left: InteractiveQuestionProfile, right: InteractiveQuestionProfile): boolean {
	if (left.shapeFingerprint !== right.shapeFingerprint) return false;
	if (left.tokens.size === 0 && right.tokens.size === 0) return true;
	const union = new Set([...left.tokens, ...right.tokens]);
	const intersection = [...left.tokens].filter((token) => right.tokens.has(token)).length;
	// Confirmation wording often adds a changing scope, slug, or sequencing
	// phrase. The option shape carries the safety signal; retain enough shared
	// action/target text to keep unrelated confirmations separate.
	return intersection / union.size >= 0.3;
}

function interactiveAnswerIntents(details: unknown, observation: unknown): InteractiveOptionIntent[] {
	const answers = details && typeof details === "object" && !Array.isArray(details) ? (details as { answers?: unknown }).answers : undefined;
	if (Array.isArray(answers)) {
		return answers.map((answer) => {
			const value = answer && typeof answer === "object" ? (answer as { answer?: unknown }).answer : answer;
			return interactiveOptionIntent(value);
		});
	}
	if (Array.isArray(observation)) {
		return observation.flatMap((part) => part && typeof part === "object" && (part as { type?: unknown }).type === "text" ? [interactiveOptionIntent((part as { text?: unknown }).text)] : []);
	}
	return [];
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
	private readonly interactiveQuestionThreshold: number;
	private readonly interactiveQuestionHardStopThreshold: number;
	private readonly longRunMs: number;
	private state: ProgressSnapshot = this.emptySnapshot();
	private lastFailureFingerprint?: string;
	private readonly batchCalls = new Map<string, string>();
	private lastSuccessfulObservation?: { callFingerprint: string; observationFingerprint: string; count: number };
	private interactiveQuestion?: InteractiveQuestionState;
	private interactiveWarningIssued = false;
	private readOnlyToolWarningThreshold?: number;
	private readOnlyToolHardStopThreshold?: number;
	private readOnlyBudgetWarningIssued = false;

	constructor(options: ProgressGuardOptions = {}) {
		this.consecutiveErrorThreshold = positiveInteger(options.consecutiveErrorThreshold, 3);
		this.repeatedFailureThreshold = positiveInteger(options.repeatedFailureThreshold, 2);
		this.repeatedSuccessThreshold = positiveInteger(options.repeatedSuccessThreshold, 2);
		this.repeatedSuccessHardStopThreshold = Math.max(this.repeatedSuccessThreshold, positiveInteger(options.repeatedSuccessHardStopThreshold, 3));
		this.interactiveQuestionThreshold = positiveInteger(options.interactiveQuestionThreshold, 2);
		this.interactiveQuestionHardStopThreshold = Math.max(this.interactiveQuestionThreshold, positiveInteger(options.interactiveQuestionHardStopThreshold, 3));
		this.longRunMs = positiveInteger(options.longRunMinutes, 20) * 60_000;
	}

	private emptySnapshot(): ProgressSnapshot {
		return {
			active: false,
			toolCalls: 0,
			readOnlyToolCalls: 0,
			toolErrors: 0,
			consecutiveToolErrors: 0,
			repeatedFailureCount: 0,
			repeatedSuccessCount: 0,
			interactiveQuestionRepeatCount: 0,
			interactivePositiveAnswerCount: 0,
			longRun: false,
		};
	}

	start(now = Date.now(), options: ProgressRunOptions = {}): void {
		this.state = { ...this.emptySnapshot(), active: true, startedAt: now, lastActivityAt: now };
		this.readOnlyToolWarningThreshold = optionalPositiveInteger(options.readOnlyToolWarningThreshold);
		this.readOnlyToolHardStopThreshold = optionalPositiveInteger(options.readOnlyToolHardStopThreshold);
		if (this.readOnlyToolWarningThreshold !== undefined && this.readOnlyToolHardStopThreshold !== undefined) {
			this.readOnlyToolHardStopThreshold = Math.max(this.readOnlyToolWarningThreshold, this.readOnlyToolHardStopThreshold);
		}
		this.lastFailureFingerprint = undefined;
		this.batchCalls.clear();
		this.lastSuccessfulObservation = undefined;
		this.interactiveQuestion = undefined;
		this.interactiveWarningIssued = false;
		this.readOnlyBudgetWarningIssued = false;
	}

	beginToolBatch(): void {
		this.batchCalls.clear();
	}

	beforeToolCall(toolCallId: string, toolName: string, input: unknown, idempotent: boolean): ProgressToolCallDecision {
		const fingerprint = progressFingerprint(toolName, input);
		if (toolName === "ask_user_question") {
			const profile = interactiveQuestionProfile(input);
			if (profile) {
				const previous = this.interactiveQuestion;
				const equivalent = previous !== undefined && equivalentInteractiveQuestion(previous.profile, profile);
				const repeatCount = equivalent && previous.lastAnswerAffirmative ? previous.repeatCount + 1 : equivalent ? previous.repeatCount : 1;
				this.interactiveQuestion = equivalent && previous
					? { ...previous, profile, repeatCount, lastAnswerAffirmative: false }
					: { profile, repeatCount: 1, positiveAnswerCount: 0, lastAnswerAffirmative: false };
				this.state = { ...this.state, interactiveQuestionRepeatCount: repeatCount, interactivePositiveAnswerCount: this.interactiveQuestion.positiveAnswerCount };
				if (repeatCount >= this.interactiveQuestionHardStopThreshold) {
					return {
						action: "terminate",
						fingerprint,
						reason: `同一确认问题在收到肯定答复后已重复 ${repeatCount} 次；请立即执行已确认的动作或直接给出结果，不要再次询问确认`,
					};
				}
			}
		}
		if (!idempotent) return { action: "allow", fingerprint };
		const primaryToolCallId = this.batchCalls.get(fingerprint);
		if (primaryToolCallId) {
			return { action: "coalesce", fingerprint, primaryToolCallId, reason: `Duplicate read-only call coalesced with ${primaryToolCallId}` };
		}
		const previous = this.lastSuccessfulObservation;
		if (previous && previous.callFingerprint === fingerprint && previous.count >= this.repeatedSuccessHardStopThreshold) {
			return { action: "terminate", fingerprint, reason: `Unchanged read-only observation repeated ${previous.count} times; stop and change strategy` };
		}
		if (this.readOnlyToolHardStopThreshold !== undefined && this.state.readOnlyToolCalls >= this.readOnlyToolHardStopThreshold) {
			return { action: "terminate", fingerprint, reason: `Read-only exploration reached its ${this.readOnlyToolHardStopThreshold}-call limit; answer from the evidence already collected instead of issuing another lookup` };
		}
		this.batchCalls.set(fingerprint, toolCallId);
		this.state = { ...this.state, readOnlyToolCalls: this.state.readOnlyToolCalls + 1 };
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
		let interactiveWarning: ProgressWarning | undefined;
		if (result.toolName === "ask_user_question") {
			if (result.isError) {
				this.interactiveQuestion = undefined;
				this.interactiveWarningIssued = false;
			} else {
				const intents = interactiveAnswerIntents(result.details, result.observation);
				const affirmative = intents.length > 0 && intents.every((intent) => intent === "affirmative");
				const negative = intents.some((intent) => intent === "negative");
				if (negative || !affirmative) {
					if (negative) {
						this.interactiveQuestion = undefined;
						this.interactiveWarningIssued = false;
					} else if (this.interactiveQuestion) {
						this.interactiveQuestion.lastAnswerAffirmative = false;
					}
				} else if (this.interactiveQuestion) {
					this.interactiveQuestion.lastAnswerAffirmative = true;
					this.interactiveQuestion.positiveAnswerCount += 1;
					if (this.interactiveQuestion.repeatCount >= this.interactiveQuestionThreshold && !this.interactiveWarningIssued) {
						this.interactiveWarningIssued = true;
						interactiveWarning = {
							kind: "interactive-confirmation-loop",
							message: `检测到确认问题在收到肯定答复后重复 ${this.interactiveQuestion.repeatCount} 次；请执行已确认的动作或直接给出结果，不要再次询问确认。`,
							snapshot: this.snapshot(),
						};
					}
				}
			}
		} else {
			// Any other tool result is a progress boundary. A real operation, read,
			// or failure means the next confirmation starts a fresh interaction window.
			this.interactiveQuestion = undefined;
			this.interactiveWarningIssued = false;
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
			interactiveQuestionRepeatCount: this.interactiveQuestion?.repeatCount ?? 0,
			interactivePositiveAnswerCount: this.interactiveQuestion?.positiveAnswerCount ?? 0,
			longRun: this.state.startedAt !== undefined && now - this.state.startedAt >= this.longRunMs,
			warning: result.isError ? previousWarning : undefined,
		};
		if (interactiveWarning) {
			this.state.warning = interactiveWarning.kind;
			interactiveWarning = { ...interactiveWarning, snapshot: this.snapshot() };
			return interactiveWarning;
		}
		if (!result.isError && result.idempotent && this.readOnlyToolWarningThreshold !== undefined && this.state.readOnlyToolCalls >= this.readOnlyToolWarningThreshold && !this.readOnlyBudgetWarningIssued) {
			this.readOnlyBudgetWarningIssued = true;
			this.state.warning = "read-only-budget";
			return {
				kind: "read-only-budget",
				message: `只读探索已调用 ${this.state.readOnlyToolCalls} 次；请用现有证据回答或明确说明缺口，不要继续扩大搜索范围。`,
				snapshot: this.snapshot(),
			};
		}
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
		this.interactiveQuestion = undefined;
		this.interactiveWarningIssued = false;
		this.readOnlyToolWarningThreshold = undefined;
		this.readOnlyToolHardStopThreshold = undefined;
		this.readOnlyBudgetWarningIssued = false;
	}
}

export function formatProgressSnapshot(snapshot: ProgressSnapshot, now = Date.now()): string {
	if (!snapshot.active) return "idle";
	const duration = snapshot.startedAt === undefined ? 0 : Math.max(0, Math.floor((now - snapshot.startedAt) / 60_000));
	const warning = snapshot.warning ? `, warning=${snapshot.warning}` : "";
	return `running ${duration}m, tools=${snapshot.toolCalls}, reads=${snapshot.readOnlyToolCalls}, errors=${snapshot.toolErrors}, consecutiveErrors=${snapshot.consecutiveToolErrors}, repeatedSuccess=${snapshot.repeatedSuccessCount}, interactiveRepeat=${snapshot.interactiveQuestionRepeatCount}${snapshot.longRun ? ", longRun=true" : ""}${warning}`;
}

function optionalPositiveInteger(value: number | undefined): number | undefined {
	return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}
