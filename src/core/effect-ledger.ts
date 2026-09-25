import { createHash } from "node:crypto";

/**
 * The effect ledger: the append-only evidence plane (design section 6) and the exactly-once primitive
 * (design section 5.2).
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
	readonly outcome?: "completed" | "failed" | "cancelled";
	readonly artifacts?: readonly string[];
}

/**
 * The atomic primitive. Implementations must make `claim` atomic across processes, because the
 * failure it prevents is a cross-host duplicate.
 */
export interface EffectStore {
	claim(record: EffectRecord): Promise<{ readonly claimed: boolean; readonly existing?: EffectRecord }>;
	get(effectKey: string): Promise<EffectRecord | undefined>;
	complete(effectKey: string, patch: { readonly completedAt: string; readonly outcome: EffectRecord["outcome"]; readonly artifacts?: readonly string[] }): Promise<void>;
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
	/** Claim and, if newly claimed, record. Returns `claimed: false` when the effect already ran. */
	begin(record: Omit<EffectRecord, "startedAt"> & { readonly startedAt?: string }): Promise<{ readonly claimed: boolean; readonly existing?: EffectRecord }>;
	complete(effectKey: string, patch: { readonly outcome: EffectRecord["outcome"]; readonly artifacts?: readonly string[]; readonly completedAt?: string }): Promise<void>;
	/** This engagement's records only. There is deliberately no way to read another engagement's. */
	records(): readonly EffectRecord[];
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
	 */
	readonly retryPriorAttempt?: boolean;
}

export async function dispatchOnce<T>(
	ledger: EffectLedger,
	record: Omit<EffectRecord, "startedAt">,
	execute: () => Promise<T>,
	options: DispatchOptions = {},
): Promise<{ readonly executed: boolean; readonly value?: T; readonly existing?: EffectRecord }> {
	const claim = await ledger.begin(record);
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
