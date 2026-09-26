import { createHash } from "node:crypto";
import {
	createEffectLedger,
	deriveEffectKey,
	effectClassOf,
	isAutomaticallyRetryable,
	type EffectClass,
	type EffectLedger,
	type EffectOutcome,
	type EffectStore,
} from "./effect-ledger.ts";
import type { WorkMode } from "./work-mode.ts";

/**
 * The effect boundary, at the host's dispatch point.
 *
 * **Why the claim is scoped to a replay attempt, and why that is not a weakening.** An effect identity derived
 * from an action's arguments cannot tell a **replay** from a **deliberate repeat**: a model that reads the same
 * file twice, or runs the same check twice, produces the same key twice, and both are legitimate. Refusing those
 * would break ordinary work while looking like containment - the worst shape a control can take.
 *
 * What the identity can tell apart is the failure the contract exists for: a dispatch on **our own resumption
 * path**, where an attempt after the first re-issues work an earlier attempt may already have performed. So:
 *
 *   - on the **first attempt** the claim is taken and the action always dispatches - there is no earlier attempt
 *     to duplicate, so refusing would be a false positive by construction;
 *   - on a **later attempt** an action whose class says a second run is harmless still dispatches, and an action
 *     whose class says otherwise is **refused and reported**.
 *
 * The class is what makes that distinction real rather than assumed: `idempotent` and `key-idempotent` are
 * declarations that a second run cannot duplicate anything, while `non-idempotent` - which is also the default
 * for an undeclared tool, because a default must not grant a retry - is the case where it can.
 *
 * A claim whose record cannot be read is refused in every case, on any attempt: that is the one state where
 * both answers available to a guess are wrong.
 */
export interface EffectBoundaryOptions {
	readonly engagement: string;
	readonly mode: WorkMode;
	readonly store: EffectStore;
	readonly now?: () => string;
}

export interface EffectBoundaryDecision {
	readonly dispatch: boolean;
	readonly effectKey: string;
	readonly effectClass: EffectClass;
	/** Whether the mode declared the class, so a caller can report a default as a default. */
	readonly declared: boolean;
	readonly outcome?: EffectOutcome;
	readonly refusal?: string;
}

/** A digest of an action's arguments that does not depend on the order a JSON encoder happened to emit. */
export function argumentsDigest(value: unknown): string {
	return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
	if (value === undefined) return "null";
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, entry]) => entry !== undefined)
		.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
	return "{" + entries.map(([key, entry]) => JSON.stringify(key) + ":" + stableStringify(entry)).join(",") + "}";
}

export interface EffectBoundary {
	readonly ledger: EffectLedger;
	prepare(input: { readonly action: string; readonly arguments: unknown; readonly replayed: boolean }): Promise<EffectBoundaryDecision>;
	complete(effectKey: string, outcome: EffectOutcome): Promise<void>;
}

export function createEffectBoundary(options: EffectBoundaryOptions): EffectBoundary {
	const ledger = createEffectLedger({
		engagement: options.engagement,
		store: options.store,
		...(options.now === undefined ? {} : { now: options.now }),
	});
	const modeIdentity = { id: options.mode.id, version: options.mode.governanceVersion, governanceVersion: options.mode.governanceVersion };

	return {
		ledger,
		async prepare(input) {
			const { effectClass, declared } = effectClassOf(input.action, options.mode.effectClasses);
			const digest = argumentsDigest(input.arguments);
			const effectKey = deriveEffectKey({
				engagement: options.engagement,
				mode: modeIdentity,
				tool: input.action,
				argumentsDigest: digest,
			});
			const claim = await ledger.begin({
				effectKey,
				engagement: options.engagement,
				mode: modeIdentity,
				tool: input.action,
				decision: "allowed",
				argumentsDigest: digest,
			});
			if (claim.unreadable === true) {
				return {
					dispatch: false,
					effectKey,
					effectClass,
					declared,
					refusal: `an earlier attempt claimed '` + input.action + `' and its record cannot be read, so whether that effect landed is unknown`,
				};
			}
			if (claim.claimed || !input.replayed || isAutomaticallyRetryable(effectClass)) {
				return { dispatch: true, effectKey, effectClass, declared };
			}
			const previous = claim.existing?.outcome;
			return {
				dispatch: false,
				effectKey,
				effectClass,
				declared,
				...(previous === undefined ? {} : { outcome: previous }),
				refusal:
					`'` + input.action + `' (effect class '` + effectClass + (declared ? "'" : "', undeclared") + `) already reached dispatch in an earlier attempt of this request` + (previous === undefined ? ` and never recorded an outcome, so it may have landed` : ` with outcome '` + previous + `'`),
			};
		},
		async complete(effectKey, outcome) {
			await ledger.complete(effectKey, { outcome });
		},
	};
}
