import { createHash, randomUUID } from "node:crypto";

export type RequestInputSource = "interactive" | "rpc" | "extension";
export type RequestStreamingBehavior = "steer" | "followUp";
export type RequestDelivery = "initial" | "steer" | "follow-up";
export type RequestState = "queued" | "active" | "settled";
export type RequestTerminalReason =
	| "completed"
	| "cancelled"
	| "superseded"
	| "startup-failed"
	| "startup-conflict"
	| "invalid-configuration"
	| "authorization-denied"
	| "recovered"
	| "failed";
export type RequestAttemptTrigger = "initial" | "provider-retry" | "compaction-retry" | "continuation" | "recovery";
export type RequestAttemptOutcome = "completed" | "transient-failure" | "failed" | "cancelled" | "superseded";

export interface RequestLease {
	readonly logicalRequestId: string;
	readonly source: RequestInputSource;
	readonly delivery: RequestDelivery;
	readonly state: RequestState;
	readonly createdAt: string;
	readonly hostSubmissionId?: string;
	readonly attemptCount: number;
	readonly nonIdempotentEffectStarted: boolean;
}

export interface RequestAttempt {
	readonly attemptId: string;
	readonly logicalRequestId: string;
	readonly number: number;
	readonly trigger: RequestAttemptTrigger;
	readonly startedAt: string;
	readonly completedAt?: string;
	readonly outcome?: RequestAttemptOutcome;
}

export interface RequestTerminalTransition {
	readonly logicalRequestId: string;
	readonly reason: RequestTerminalReason;
	readonly detail?: string;
	readonly policyAbort?: boolean;
	readonly settledAt: string;
}

export interface ProviderFailureInput {
	readonly httpStatus?: number;
	readonly code?: string;
	readonly cancelled?: boolean;
	readonly category?: "startup-conflict" | "invalid-configuration" | "authorization-denied" | "unknown";
}

export interface ProviderFailureClassification {
	readonly kind: "transient" | "terminal";
	readonly reason: string;
}

interface MutableAttempt {
	attemptId: string;
	logicalRequestId: string;
	number: number;
	trigger: RequestAttemptTrigger;
	startedAt: string;
	completedAt?: string;
	outcome?: RequestAttemptOutcome;
}

interface MutableLease {
	logicalRequestId: string;
	source: RequestInputSource;
	delivery: RequestDelivery;
	state: RequestState;
	createdAt: string;
	hostSubmissionId?: string;
	promptDigest: string;
	origin: "input" | "synthetic";
	attemptCount: number;
	nonIdempotentEffectStarted: boolean;
	currentAttempt?: MutableAttempt;
}

export interface RequestLifecycleControllerOptions {
	readonly createId?: () => string;
	readonly now?: () => Date;
	readonly maxAttempts?: number;
}

/**
 * Owns the identity of a user submission independently of Pi/provider retry
 * machinery. Prompt digests are used only as supporting evidence while a
 * matching lease is unsettled; they are never a completed-request dedupe key.
 */
export class RequestLifecycleController {
	readonly #createId: () => string;
	readonly #now: () => Date;
	readonly #maxAttempts: number;
	readonly #pending: MutableLease[] = [];
	readonly #byHostSubmissionId = new Map<string, MutableLease>();
	readonly #attempts: MutableAttempt[] = [];
	readonly #terminals: RequestTerminalTransition[] = [];
	#active?: MutableLease;

	public constructor(options: RequestLifecycleControllerOptions = {}) {
		this.#createId = options.createId ?? randomUUID;
		this.#now = options.now ?? (() => new Date());
		this.#maxAttempts = options.maxAttempts ?? 3;
		if (!Number.isSafeInteger(this.#maxAttempts) || this.#maxAttempts < 1) throw new RangeError("maxAttempts must be a positive integer");
	}

	public acceptSubmission(input: {
		readonly text: string;
		readonly source: RequestInputSource;
		readonly streamingBehavior?: RequestStreamingBehavior;
		readonly hostSubmissionId?: string;
	}): { readonly lease: RequestLease; readonly delivery: RequestDelivery; readonly newLogicalRequest: boolean; readonly coalesced: boolean; readonly reason?: "host-submission-id" | "in-flight-redelivery" | "active-delivery"; readonly terminalized: readonly RequestTerminalTransition[] } {
		const hostSubmissionId = input.hostSubmissionId?.trim() || undefined;
		const delivery = normalizeDelivery(input.streamingBehavior);
		if (hostSubmissionId) {
			const existing = this.#byHostSubmissionId.get(hostSubmissionId);
			if (existing && existing.state !== "settled") return { lease: snapshotLease(existing), delivery, newLogicalRequest: false, coalesced: true, reason: "host-submission-id", terminalized: [] };
		}

		const promptDigest = digestPrompt(input.text);
		// Pi drains steering/follow-up messages inside the already active low-level
		// run and does not emit another before_agent_start. Treat them as deliberate
		// deliveries on that logical request, not as orphan request identities that
		// can never own the provider/tool work they trigger.
		if (delivery !== "initial" && this.#active?.state === "active") {
			return { lease: snapshotLease(this.#active), delivery, newLogicalRequest: false, coalesced: false, reason: "active-delivery", terminalized: [] };
		}
		// Pi 0.84.3 does not expose a submission id. An equivalent input can only
		// be treated as host redelivery while the same initial submission remains
		// unsettled. Steering/follow-up are always deliberate new submissions.
		if (delivery === "initial") {
			const candidate = [this.#active].find((lease): lease is MutableLease =>
				lease !== undefined
				&& lease.state !== "settled"
				&& lease.origin === "input"
				&& lease.delivery === delivery
				&& lease.source === input.source
				&& lease.promptDigest === promptDigest,
			);
			if (candidate) return { lease: snapshotLease(candidate), delivery, newLogicalRequest: false, coalesced: true, reason: "in-flight-redelivery", terminalized: [] };
		}
		const terminalized: RequestTerminalTransition[] = [];
		if (delivery === "initial") {
			// A queued initial lease has passed `input` but never reached
			// `before_agent_start`. Pi can fail model/auth/startup preflight in that
			// gap and emits no `agent_settled`, so the next real submission closes it
			// instead of inheriting or replaying its identity.
			for (const stale of this.#pending.filter((lease) => lease.delivery === "initial")) {
				terminalized.push(this.#settleLease(stale, "startup-failed"));
			}
			this.#removeSettledPending();
		}

		const lease: MutableLease = {
			logicalRequestId: `req_${this.#createId()}`,
			source: input.source,
			delivery,
			state: "queued",
			createdAt: this.#now().toISOString(),
			hostSubmissionId,
			promptDigest,
			origin: "input",
			attemptCount: 0,
			nonIdempotentEffectStarted: false,
		};
		this.#pending.push(lease);
		if (hostSubmissionId) this.#byHostSubmissionId.set(hostSubmissionId, lease);
		return { lease: snapshotLease(lease), delivery, newLogicalRequest: true, coalesced: false, terminalized };
	}

	public beginRequest(input: { readonly prompt: string }): RequestLease & { readonly isNewRequest: boolean } {
		const pendingIndex = this.#pending.findIndex((lease) => lease.delivery === "initial");
		const pending = pendingIndex >= 0 ? this.#pending.splice(pendingIndex, 1)[0] : undefined;
		if (pending) {
			if (this.#active && this.#active !== pending) this.#settleLease(this.#active, "superseded");
			pending.state = "active";
			this.#active = pending;
			return { ...snapshotLease(pending), isNewRequest: true };
		}

		if (this.#active?.origin === "input" && this.#active.state === "active") {
			return { ...snapshotLease(this.#active), isNewRequest: false };
		}
		if (this.#active) this.#settleLease(this.#active, "superseded");
		const synthetic: MutableLease = {
			logicalRequestId: `req_${this.#createId()}`,
			source: "extension",
			delivery: "initial",
			state: "active",
			createdAt: this.#now().toISOString(),
			promptDigest: digestPrompt(input.prompt),
			origin: "synthetic",
			attemptCount: 0,
			nonIdempotentEffectStarted: false,
		};
		this.#active = synthetic;
		return { ...snapshotLease(synthetic), isNewRequest: true };
	}

	public activeLease(): RequestLease | undefined {
		return this.#active?.state === "active" ? snapshotLease(this.#active) : undefined;
	}

	public startAttempt(trigger: RequestAttemptTrigger): RequestAttempt {
		const lease = this.#requireActive();
		if (lease.currentAttempt && !lease.currentAttempt.completedAt) this.#finishAttempt(lease.currentAttempt, "superseded");
		const attempt: MutableAttempt = {
			attemptId: `attempt_${this.#createId()}`,
			logicalRequestId: lease.logicalRequestId,
			number: ++lease.attemptCount,
			trigger,
			startedAt: this.#now().toISOString(),
		};
		lease.currentAttempt = attempt;
		this.#attempts.push(attempt);
		return snapshotAttempt(attempt);
	}

	public currentAttempt(): RequestAttempt | undefined {
		const attempt = this.#active?.currentAttempt;
		return attempt ? snapshotAttempt(attempt) : undefined;
	}

	public finishAttempt(attemptId: string, outcome: RequestAttemptOutcome): RequestAttempt {
		const lease = this.#requireActive();
		const attempt = lease.currentAttempt;
		if (!attempt || attempt.attemptId !== attemptId) throw new Error(`Attempt is not active: ${attemptId}`);
		this.#finishAttempt(attempt, outcome);
		lease.currentAttempt = undefined;
		return snapshotAttempt(attempt);
	}

	public markEffectStarted(input: { readonly effectId: string; readonly idempotent: boolean }): void {
		if (!input.effectId.trim()) throw new Error("effectId is required");
		if (!input.idempotent) this.#requireActive().nonIdempotentEffectStarted = true;
	}

	public retryDecision(failure: ProviderFailureClassification): { readonly retry: boolean; readonly reason: string } {
		const lease = this.#requireActive();
		if (failure.kind !== "transient") return { retry: false, reason: failure.reason };
		if (lease.nonIdempotentEffectStarted) return { retry: false, reason: "non-idempotent-effect" };
		if (lease.attemptCount >= this.#maxAttempts) return { retry: false, reason: "attempt-limit" };
		return { retry: true, reason: failure.reason };
	}

	public settle(reason: RequestTerminalReason, options: { readonly detail?: string; readonly policyAbort?: boolean } = {}): readonly RequestTerminalTransition[] {
		const transitions: RequestTerminalTransition[] = [];
		if (this.#active && this.#active.state !== "settled") transitions.push(this.#settleLease(this.#active, reason, options));
		// Streaming steer/follow-up submissions are consumed inside Pi's existing
		// run and never receive `before_agent_start`. They remain distinct user
		// identities for correlation, then close at the same reliable settlement
		// boundary so no stale lease can capture the next unrelated prompt.
		for (const pending of this.#pending.filter((lease) => lease.delivery !== "initial")) {
			transitions.push(this.#settleLease(pending, reason, options));
		}
		this.#removeSettledPending();
		return transitions;
	}

	/** Close every lease when the host tears down before normal settlement. */
	public terminateAll(reason: RequestTerminalReason, options: { readonly detail?: string; readonly policyAbort?: boolean } = {}): readonly RequestTerminalTransition[] {
		const transitions: RequestTerminalTransition[] = [];
		if (this.#active && this.#active.state !== "settled") transitions.push(this.#settleLease(this.#active, reason, options));
		for (const pending of [...this.#pending]) {
			if (pending.state === "settled") continue;
			// An initial input that never reached before_agent_start failed in Pi's
			// preflight gap. Host shutdown is the final observation boundary for it.
			const pendingReason = pending.delivery === "initial" && pending.state === "queued" ? "startup-failed" : reason;
			transitions.push(this.#settleLease(pending, pendingReason, pendingReason === "startup-failed" ? { detail: "host-shutdown-preflight" } : options));
		}
		this.#removeSettledPending();
		return transitions;
	}

	public attemptHistory(): readonly RequestAttempt[] {
		return this.#attempts.map(snapshotAttempt);
	}

	public terminalHistory(): readonly RequestTerminalTransition[] {
		return this.#terminals.map((terminal) => ({ ...terminal }));
	}

	#requireActive(): MutableLease {
		if (!this.#active || this.#active.state !== "active") throw new Error("No active logical request");
		return this.#active;
	}

	#finishAttempt(attempt: MutableAttempt, outcome: RequestAttemptOutcome): void {
		if (attempt.completedAt) return;
		attempt.completedAt = this.#now().toISOString();
		attempt.outcome = outcome;
	}

	#settleLease(lease: MutableLease, reason: RequestTerminalReason, options: { readonly detail?: string; readonly policyAbort?: boolean } = {}): RequestTerminalTransition {
		if (lease.currentAttempt && !lease.currentAttempt.completedAt) this.#finishAttempt(lease.currentAttempt, reason === "cancelled" ? "cancelled" : reason === "completed" ? "completed" : "failed");
		lease.currentAttempt = undefined;
		lease.state = "settled";
		if (lease.hostSubmissionId) this.#byHostSubmissionId.delete(lease.hostSubmissionId);
		const transition = {
			logicalRequestId: lease.logicalRequestId,
			reason,
			...(options.detail ? { detail: options.detail } : {}),
			...(options.policyAbort ? { policyAbort: true } : {}),
			settledAt: this.#now().toISOString(),
		} as const;
		this.#terminals.push(transition);
		if (this.#active === lease) this.#active = undefined;
		return transition;
	}

	#removeSettledPending(): void {
		for (let index = this.#pending.length - 1; index >= 0; index--) {
			if (this.#pending[index]?.state === "settled") this.#pending.splice(index, 1);
		}
	}
}

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET"]);

export function classifyProviderFailure(input: ProviderFailureInput): ProviderFailureClassification {
	if (input.cancelled) return { kind: "terminal", reason: "cancelled" };
	if (input.category && input.category !== "unknown") return { kind: "terminal", reason: input.category };
	if (input.httpStatus !== undefined) {
		if (input.httpStatus === 401 || input.httpStatus === 403) return { kind: "terminal", reason: "authorization-denied" };
		return TRANSIENT_HTTP_STATUSES.has(input.httpStatus) || (input.httpStatus >= 500 && input.httpStatus <= 599)
			? { kind: "transient", reason: `http_${input.httpStatus}` }
			: { kind: "terminal", reason: `http_${input.httpStatus}` };
	}
	const code = input.code?.trim().toUpperCase();
	if (code) return TRANSIENT_CODES.has(code) ? { kind: "transient", reason: code } : { kind: "terminal", reason: code };
	return { kind: "terminal", reason: "unknown" };
}

function normalizeDelivery(value: RequestStreamingBehavior | undefined): RequestDelivery {
	return value === "followUp" ? "follow-up" : value ?? "initial";
}

function digestPrompt(value: string): string {
	return createHash("sha256").update(value.normalize("NFC")).digest("hex");
}

function snapshotLease(lease: MutableLease): RequestLease {
	return Object.freeze({
		logicalRequestId: lease.logicalRequestId,
		source: lease.source,
		delivery: lease.delivery,
		state: lease.state,
		createdAt: lease.createdAt,
		...(lease.hostSubmissionId ? { hostSubmissionId: lease.hostSubmissionId } : {}),
		attemptCount: lease.attemptCount,
		nonIdempotentEffectStarted: lease.nonIdempotentEffectStarted,
	});
}

function snapshotAttempt(attempt: MutableAttempt): RequestAttempt {
	return Object.freeze({ ...attempt });
}
