import type { GateDecision, GateInvocation, SynchronousActionGate } from "./loop.ts";

/**
 * The **limit** gate: allow iff the proposed action is inside declared numeric bounds.
 *
 * This is the semantics SEC Rule 15c3-5 requires of order entry - pre-trade controls that
 * "prevent the entry of orders that exceed appropriate pre-set credit or capital thresholds, or that
 * appear to be erroneous". It is a *threshold* check, not a scope check: an in-scope action can still
 * be blocked here, and that is the point.
 *
 * **Fail-closed rules.** A limit gate that passes when it cannot find the value it is supposed to
 * check is worse than no gate, because it looks like one. So:
 *
 * - a declared limit whose argument is absent, non-numeric, or non-finite is a **block**, not a pass;
 * - a limit declared with neither `max` nor `min` is rejected at construction, since it can never
 *   decide anything;
 * - an invocation that cannot be evaluated at all is a **block**.
 */
export interface LimitSpec {
	/** Stable identity, used in the block reason and the evidence record. */
	readonly id: string;
	/** Dotted path into the action's arguments, e.g. `order.notional`. */
	readonly argument: string;
	/** Inclusive upper bound. */
	readonly max?: number;
	/** Inclusive lower bound. */
	readonly min?: number;
	/** Human-readable unit, for the block reason only. */
	readonly unit?: string;
	/** Whether the absence of this argument is itself a block. Defaults to `true`. */
	readonly required?: boolean;
}

export class LimitSpecError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LimitSpecError";
	}
}

function readPath(value: unknown, path: string): unknown {
	let current: unknown = value;
	for (const segment of path.split(".")) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

function block(reason: string, remediation: string): GateDecision {
	return { outcome: "block", reason, remediation };
}

export interface LimitGateOptions {
	/** Restrict this gate to these tool names. Omitted means it applies to every action. */
	readonly tools?: readonly string[];
}

export function createLimitGate(limits: readonly LimitSpec[], options: LimitGateOptions = {}): SynchronousActionGate {
	for (const limit of limits) {
		if (limit.max === undefined && limit.min === undefined) {
			throw new LimitSpecError(`Limit '${limit.id}' declares neither max nor min, so it can never decide anything.`);
		}
	}
	const scope = options.tools === undefined ? undefined : new Set(options.tools);

	return {
		id: "limit",
		evaluate(invocation: GateInvocation): GateDecision {
			if (scope !== undefined && !scope.has(invocation.tool)) return { outcome: "allow" };

			for (const limit of limits) {
				const raw = readPath(invocation.arguments, limit.argument);
				const required = limit.required !== false;
				const unit = limit.unit === undefined ? "" : ` ${limit.unit}`;

				if (raw === undefined || raw === null) {
					if (!required) continue;
					return block(
						`Limit '${limit.id}' could not be evaluated: argument '${limit.argument}' is absent from the ${invocation.tool} call.`,
						`Supply '${limit.argument}', or declare this limit as not required if its absence is genuinely acceptable.`,
					);
				}
				const value = typeof raw === "number" ? raw : Number(raw);
				if (!Number.isFinite(value)) {
					return block(
						`Limit '${limit.id}' could not be evaluated: argument '${limit.argument}' is not a finite number.`,
						`Supply a finite number for '${limit.argument}'.`,
					);
				}
				if (limit.max !== undefined && value > limit.max) {
					return block(
						`${invocation.tool} exceeds limit '${limit.id}': ${value}${unit} is above the permitted maximum of ${limit.max}${unit}.`,
						`Reduce '${limit.argument}' to at most ${limit.max}${unit}, or request a limit change through the authority document rather than retrying.`,
					);
				}
				if (limit.min !== undefined && value < limit.min) {
					return block(
						`${invocation.tool} is below limit '${limit.id}': ${value}${unit} is under the permitted minimum of ${limit.min}${unit}.`,
						`Raise '${limit.argument}' to at least ${limit.min}${unit}, or request a limit change through the authority document.`,
					);
				}
			}
			return { outcome: "allow" };
		},
	};
}
