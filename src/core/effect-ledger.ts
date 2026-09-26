import { createHash } from "node:crypto";

/**
 * The effect ledger: the evidence plane for effects (design section 6) and the **at-most-once dispatch
 * boundary** (design section 5.1).
 *
 * **What this module may claim, stated exactly.** It used to describe itself as an "exactly-once
 * primitive". That claim is withdrawn, because a durable record follows the side effect: a crash between
 * the effect and the record keeps the effect and loses the record, and this layer cannot close that window
 * (*"the harness barely matters, the contract explains 81%"*, arXiv 2609.29095). The true claim is
 * **at-most-once dispatch from our own resumption paths, plus an idempotency key the tool must forward and
 * the backend must enforce.** Exactly-once requires the backend's enforcement and is never this layer's
 * property.
 *
 * Two things here are deliberately not the obvious implementation.
 *
 * **1. Consume-once is an atomic `claim`, not a read-then-write.** The measurement is unambiguous:
 * *"k processes resuming one parked interrupt fire the gated effect k times, saturation 1.0 in 36 of
 * 40 cells, and the failure crosses hosts"* (arXiv 2608.03836). A `has()` check followed by a
 * `record()` write cannot prevent that, because the window between them is exactly where the
 * duplicate lands. The store therefore exposes one operation - {@link EffectStore.claim} - and an
 * implementation is responsible for making it atomic.
 *
 * **2. The effect identity is the idempotency key the backend must honour.** The measurement again:
 * *"the harness barely matters"* and *"the contract explains 81%"* of duplicate behaviour
 * (arXiv 2609.29095). Loop-level deduplication cannot be exactly-once under late commits or double
 * delivery, so the key is derived here, recorded here, and handed to the executing tool - which is
 * what makes it a *contract* rather than a local bookkeeping detail.
 */

export interface ModeIdentity {
	readonly id: string;
	readonly version: string;
	readonly governanceVersion: string;
}

/**
 * The terminal states of an effect.
 *
 * `unknown` is the state that makes the other four honest. A claim whose outcome was never written is
 * neither completed nor failed - the process died between the effect and the record - and every default a
 * two-state ledger can pick for it is wrong in one direction. It is reachable **by construction**: the
 * claim is taken before dispatch, so an interrupted run leaves a claimed record with no outcome.
 */
export type EffectOutcome = "completed" | "failed" | "cancelled" | "unknown";

/**
 * What kind of retry an effect tolerates, declared per tool by the mode rather than guessed at a call site
 * (design section 5.2).
 *
 * - `idempotent` - running it twice is the same as running it once (a read, a set-to-value write).
 * - `key-idempotent` - running it twice is safe **only because** the backend enforces the key the tool
 *   forwards. Stripe's `Idempotent-Replayed` and a venue's client-order-id are this class.
 * - `non-idempotent` - a second run is a second effect. Nothing here may retry it.
 */
export type EffectClass = "idempotent" | "key-idempotent" | "non-idempotent";

/**
 * Only the two classes whose second run is provably harmless are automatically retryable.
 *
 * The default for an undeclared tool is `non-idempotent`, and that direction is deliberate: a table that
 * omits a tool must not silently acquire the right to retry it. Fail closed, then declare.
 */
export function isAutomaticallyRetryable(effectClass: EffectClass): boolean {
	return effectClass === "idempotent" || effectClass === "key-idempotent";
}

/**
 * Resolve a tool's declared class, failing safe on an undeclared tool.
 *
 * Returns the class and whether it was declared, so a caller can report "undeclared, treated as
 * non-idempotent" instead of presenting a default as a declaration. A silent default here would be the
 * same defect as a gate that allows what it could not evaluate.
 */
export function effectClassOf(tool: string, declared: Readonly<Record<string, EffectClass>> = {}): { readonly effectClass: EffectClass; readonly declared: boolean } {
	const found = declared[tool];
	if (found === undefined) return { effectClass: "non-idempotent", declared: false };
	return { effectClass: found, declared: true };
}

export interface EffectRecord {
	/** Framework-generated. Stable across retries of the same logical effect, which is what makes it a key. */
	readonly effectKey: string;
	readonly engagement: string;
	/** Stamped on every record: without it, "what was this agent allowed to do when it did that?" is unanswerable. */
	readonly mode: ModeIdentity;
	readonly tool: string;
	readonly target?: string;
	readonly decision: "allowed" | "blocked";
	readonly gateReason?: string;
	/** The grants that resolved for this action, so the authority at the time is reconstructable. */
	readonly grantIds?: readonly string[];
	readonly startedAt: string;
	readonly completedAt?: string;
	readonly outcome?: EffectOutcome;
	/**
	 * A digest of the validated arguments, so "same key, a different payload" is detectable.
	 *
	 * The key already carries the digest, so this is only load-bearing when an `explicitKey` is supplied: two
	 * different payloads can then collide on one key, and replaying the first result for the second payload
	 * would be a wrong answer presented as a remembered one. The expired IETF draft's section 2.4 calls this
	 * an idempotency fingerprint and answers it with 422 rather than a replay.
	 */
	readonly argumentsDigest?: string;
	readonly artifacts?: readonly string[];
}

/**
 * The result of a claim.
 *
 * `unreadable` exists because the primitive underneath a file store is a two-step "create, then write":
 * `open(2)` with `O_CREAT|O_EXCL` makes the claim visible, and the record lands a moment later. A crash in
 * that window leaves a claim whose content cannot be read, and the two facts it could be mistaken for are
 * both worse than the truth:
 *
 * - read as "nothing claimed" -> the effect re-runs, which is the duplicate this whole contract prevents;
 * - read as "claimed and completed" -> a result is invented for work that may never have happened.
 *
 * So it is its own answer, and callers must refuse on it rather than pick one of the two.
 */
export interface ClaimResult {
	readonly claimed: boolean;
	readonly existing?: EffectRecord;
	/** The claim exists but its record could not be read. Refuse and surface; never treat as unclaimed. */
	readonly unreadable?: boolean;
}

/**
 * The atomic primitive. Implementations must make `claim` atomic across processes, because the failure it
 * prevents is a duplicate: a `has()` followed by a `record()` cannot prevent it, since the window between
 * them is exactly where the duplicate lands.
 *
 * **The atomicity a file store can honestly offer is bounded, and the bound belongs in the implementation's
 * documentation**: between processes on **one host with a local filesystem**. No filesystem primitive is
 * safe across a network mount - not exclusive create, not `flock` (absent over NFS before Linux 2.6.11 and
 * non-advisory over SMB since 5.5), not `O_APPEND` (documented racy on NFS), not SQLite (documented to
 * corrupt). Cross-host exclusion is the backend's, through the forwarded key.
 */
export interface EffectStore {
	claim(record: EffectRecord): Promise<ClaimResult>;
	/**
	 * The record for a key, or `undefined` when no claim exists.
	 *
	 * **Throws when a claim exists but cannot be read.** Returning `undefined` there would report "never
	 * claimed" for a key that was claimed, which is the one answer that leads to running the effect again.
	 */
	get(effectKey: string): Promise<EffectRecord | undefined>;
	complete(effectKey: string, patch: { readonly completedAt: string; readonly outcome: EffectOutcome; readonly artifacts?: readonly string[] }): Promise<void>;
}

/**
 * An in-memory store for tests and single-process use.
 *
 * **This is not sufficient for production.** Its `claim` is atomic only within one JavaScript realm;
 * the duplicate it is meant to prevent crosses hosts. A real deployment supplies a store backed by
 * something with a compare-and-set - a database row, a lock service, an append-only log with a unique
 * constraint.
 */
export function createInMemoryEffectStore(): EffectStore {
	const records = new Map<string, EffectRecord>();
	return {
		async claim(record: EffectRecord) {
			const existing = records.get(record.effectKey);
			if (existing !== undefined) return { claimed: false, existing };
			records.set(record.effectKey, record);
			return { claimed: true };
		},
		async get(effectKey: string) {
			return records.get(effectKey);
		},
		async complete(effectKey, patch) {
			const existing = records.get(effectKey);
			if (existing === undefined) return;
			records.set(effectKey, { ...existing, ...patch });
		},
	};
}

export interface DeriveEffectKeyInput {
	readonly engagement: string;
	readonly mode: ModeIdentity;
	readonly tool: string;
	readonly target?: string;
	/** A digest of the validated arguments. Digest rather than raw, so the key never carries payload. */
	readonly argumentsDigest: string;
	/**
	 * An explicit key from the caller. Use this when a logical effect must survive a retry that would
	 * otherwise look identical - a client order id is the canonical example, and it is also what lets
	 * the *venue* reject a duplicate rather than only the framework.
	 */
	readonly explicitKey?: string;
}

export function deriveEffectKey(input: DeriveEffectKeyInput): string {
	const material = [
		"dove-effect/v1",
		input.engagement,
		input.mode.id,
		input.mode.version,
		input.mode.governanceVersion,
		input.tool,
		input.target ?? "",
		input.argumentsDigest,
		input.explicitKey ?? "",
	].join("\u0000");
	return createHash("sha256").update(material).digest("hex");
}

/**
 * Map a framework effect identity onto a venue's client-order-id field.
 *
 * This is the piece that makes "the effect key is an idempotency key the backend honours" true rather
 * than aspirational. The framework derives the identity; the venue rejects a duplicate; and both are
 * talking about the same string. Without this mapping the framework's deduplication is local and the
 * venue would happily accept the same order twice.
 *
 * Venue constraints are real and narrow - Binance documents `newClientOrderId` as
 * `^[\.A-Z\:/a-z0-9_-]{1,36}$` - so the identity is truncated and any character outside that set is
 * dropped rather than escaped. Truncation keeps the leading characters of a hash, which is where the
 * entropy is.
 */
export interface ClientOrderIdOptions {
	/** Maximum length the venue accepts. Binance allows 36. */
	readonly maxLength?: number;
	/** A per-run prefix, useful when a venue wants a human-recognisable order tag. */
	readonly prefix?: string;
}

const VENUE_SAFE = /[^A-Za-z0-9_.:-]/g;

export function toClientOrderId(effectKey: string, options: ClientOrderIdOptions = {}): string {
	const maxLength = options.maxLength ?? 36;
	const prefix = (options.prefix ?? "").replace(VENUE_SAFE, "");
	const safe = effectKey.replace(VENUE_SAFE, "");
	const room = Math.max(1, maxLength - prefix.length);
	return `${prefix}${safe.slice(0, room)}`;
}

export class EffectIsolationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EffectIsolationError";
	}
}

export interface EffectLedger {
	/**
	 * Claim and, if newly claimed, record. `claimed: false` means the effect was claimed before.
	 *
	 * Throws {@link EffectKeyConflictError} when the key was claimed **with a different payload digest**, and
	 * {@link EffectIsolationError} for another engagement's record.
	 */
	begin(record: Omit<EffectRecord, "startedAt"> & { readonly startedAt?: string }): Promise<ClaimResult>;
	complete(effectKey: string, patch: { readonly outcome: EffectOutcome; readonly artifacts?: readonly string[]; readonly completedAt?: string }): Promise<void>;
	/**
	 * The outcome of a key as a reader should understand it: `undefined` when nothing was claimed,
	 * `unknown` when it was claimed and no outcome was ever written, otherwise the recorded outcome.
	 *
	 * This is the read side of the three-state model. A caller that reads `undefined` for an interrupted run
	 * would conclude the effect never started, and one that reads `failed` would conclude it did not land.
	 * Both are guesses; `unknown` is the fact.
	 */
	outcomeOf(effectKey: string): Promise<EffectOutcome | undefined>;
	/** This engagement's records only. There is deliberately no way to read another engagement's. */
	records(): readonly EffectRecord[];
}

/**
 * Raised when one effect key carries two different payloads.
 *
 * This is the `explicitKey` collision case: a caller-supplied key makes the identity stable across a retry,
 * which is what it is for, but it also lets two *different* effects share one key. Replaying the first
 * result for the second payload would answer a question that was never asked.
 */
export class EffectKeyConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EffectKeyConflictError";
	}
}

/**
 * Raised when a retry is opted into for an effect that cannot tolerate one.
 *
 * The opt-in is only safe because a backend enforces the key, which is what `key-idempotent` means. Asking
 * for a retry without declaring a retryable class is the unsafe case, and it is refused rather than
 * downgraded: a silent downgrade would leave the caller believing the retry happened.
 */
export class EffectRetryRefusedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EffectRetryRefusedError";
	}
}

export interface EffectLedgerOptions {
	readonly engagement: string;
	readonly store: EffectStore;
	readonly now?: () => string;
}

/**
 * A per-engagement ledger.
 *
 * **Cross-engagement isolation is enforced here, not documented.** PTES is explicit about why:
 * *"don't re-use a report from another customer engagement as a template"*. A ledger refuses a record
 * whose engagement differs from its own, so an artifact from one engagement cannot be read as, or
 * mistaken for, another's.
 */
export function createEffectLedger(options: EffectLedgerOptions): EffectLedger {
	const now = options.now ?? (() => new Date().toISOString());
	const log: EffectRecord[] = [];

	return {
		async begin(record) {
			if (record.engagement !== options.engagement) {
				throw new EffectIsolationError(
					`Ledger for engagement '${options.engagement}' refused a record for '${record.engagement}'. Evidence is partitioned per engagement.`,
				);
			}
			const full: EffectRecord = { ...record, startedAt: record.startedAt ?? now() };
			const result = await options.store.claim(full);
			if (result.claimed) log.push(full);
			// One key, two payloads: refuse rather than replay the first payload's answer for the second.
			if (!result.claimed && result.existing !== undefined && full.argumentsDigest !== undefined) {
				const previous = result.existing.argumentsDigest;
				if (previous !== undefined && previous !== full.argumentsDigest) {
					throw new EffectKeyConflictError(
						`Effect key '${full.effectKey}' was already claimed with a different payload digest ('${previous}' then '${full.argumentsDigest}'). Give the second payload its own key rather than reading the first result as its own.`,
					);
				}
			}
			return result;
		},
		async complete(effectKey, patch) {
			const completedAt = patch.completedAt ?? now();
			await options.store.complete(effectKey, { completedAt, outcome: patch.outcome, ...(patch.artifacts === undefined ? {} : { artifacts: patch.artifacts }) });
			const index = log.findIndex((entry) => entry.effectKey === effectKey);
			if (index >= 0) {
				log[index] = { ...log[index]!, completedAt, outcome: patch.outcome, ...(patch.artifacts === undefined ? {} : { artifacts: patch.artifacts }) };
			}
		},
		async outcomeOf(effectKey) {
			const record = await options.store.get(effectKey);
			if (record === undefined) return undefined;
			return record.outcome ?? "unknown";
		},
		records() {
			return [...log];
		},
	};
}

/**
 * Wrap an executor so that an effect is dispatched at most once by default.
 *
 * **Why the default is "never duplicate" rather than "never lose work".** A claimed-but-incomplete
 * effect is ambiguous: the previous attempt may be in flight right now, or it may have died
 * mid-effect. A ledger cannot tell those apart - that is exactly the late-commit problem
 * (arXiv 2609.29095: *"no verification-only policy is exactly-once under late commits"*).
 *
 * The two failure directions are not symmetric:
 *
 * - Choosing "retry" makes a race between resumers duplicate the effect **k times** - the measured
 *   failure is saturation in 36 of 40 cells, crossing hosts (arXiv 2608.03836).
 * - Choosing "skip" risks losing work that a crash interrupted.
 *
 * So the default skips, and re-dispatching an incomplete effect is an **explicit opt-in**
 * ({@link DispatchOptions.retryPriorAttempt}). That opt-in is only safe when the effect key is an
 * idempotency key **the backend honours** - which is where the durable guarantee actually lives
 * (*"the harness barely matters ... the contract explains 81%"*).
 *
 * The claim itself is atomic in the store, so concurrent resumers produce one `claimed: true`.
 */
export interface DispatchOptions {
	/**
	 * Re-dispatch an effect whose prior attempt is ambiguous - it was claimed but never completed, or it
	 * failed after possibly taking effect. Only safe when the effect key is an idempotency key the
	 * executing backend honours; otherwise this is the at-least-once duplicate. Defaults to `false`.
	 *
	 * Which effects may set this is a **mode** decision, not a call-site convenience: design section 5.2
	 * has a mode declare each effect as idempotent, key-idempotent, or non-idempotent.
	 *
	 * Setting this without a retryable {@link DispatchOptions.effectClass} throws
	 * {@link EffectRetryRefusedError} rather than being quietly ignored.
	 */
	readonly retryPriorAttempt?: boolean;
	/**
	 * The tool's declared class. Required whenever `retryPriorAttempt` is set, because the opt-in's safety
	 * *is* the class: `key-idempotent` means a backend enforces the key, and `non-idempotent` means a second
	 * run is a second effect no matter what the caller believes.
	 */
	readonly effectClass?: EffectClass;
}

/**
 * What a dispatch did, or why it did not.
 *
 * `existing` is the report for the ordinary refusal ("this effect was already claimed, here is the record").
 * `unreadableClaim` is the report for the one case the record cannot describe, because the record is the
 * thing that could not be read.
 */
export interface DispatchResult<T> {
	readonly executed: boolean;
	readonly value?: T;
	readonly existing?: EffectRecord;
	/** A claim exists with an unreadable record. The effect must not run, and the operator must be told. */
	readonly unreadableClaim?: boolean;
}

export async function dispatchOnce<T>(
	ledger: EffectLedger,
	record: Omit<EffectRecord, "startedAt">,
	execute: () => Promise<T>,
	options: DispatchOptions = {},
): Promise<DispatchResult<T>> {
	if (options.retryPriorAttempt === true && (options.effectClass === undefined || !isAutomaticallyRetryable(options.effectClass))) {
		throw new EffectRetryRefusedError(
			`Retry opted in for '${record.tool}' without a retryable effect class (got ${options.effectClass === undefined ? "none" : `'${options.effectClass}'`}). A retry is only safe for 'idempotent' or 'key-idempotent', so declare the class the mode gives this tool.`,
		);
	}
	const claim = await ledger.begin(record);
	// The one case a record cannot describe, because the record is what could not be read.
	if (claim.unreadable === true) {
		return { executed: false, unreadableClaim: true };
	}
	if (!claim.claimed) {
		const completed = claim.existing?.outcome === "completed";
		if (completed || options.retryPriorAttempt !== true) {
			return { executed: false, existing: claim.existing };
		}
	}
	try {
		const value = await execute();
		await ledger.complete(record.effectKey, { outcome: "completed" });
		return { executed: true, value };
	} catch (error) {
		await ledger.complete(record.effectKey, { outcome: "failed" });
		throw error;
	}
}
