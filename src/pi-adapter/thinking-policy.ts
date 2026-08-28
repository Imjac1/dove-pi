import type { AgentMode } from "../core/contracts.ts";

/**
 * Thinking-level policy for the Dove Pi adapter.
 *
 * Two modes of operation, chosen by the user:
 *   - auto (default): derive the thinking level from the execution mode
 *     (fast -> low, standard -> high, ultra -> max). Applied on every turn
 *     start, so a manual shift+tab tweak only affects the current turn.
 *   - lock <level>: pin a fixed thinking level for every turn until the user
 *     runs `/dove-thinking auto`. Manual shift+tab stays turn-scoped: the next
 *     turn returns to the locked level.
 *
 * The policy is advisory to Pi's own setting default: the effective level is
 * asserted via `pi.setThinkingLevel()` at `before_agent_start`, which the
 * agent loop reads per turn, so the provider always sees the intended level
 * without touching `defaultThinkingLevel` in the user's settings file.
 */

export type ThinkingLevel =
	| "off"
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh"
	| "max";

export const THINKING_LEVELS: readonly ThinkingLevel[] = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
];

export type ThinkingPolicyState =
	| { readonly kind: "off"; readonly reason?: string }
	| { readonly kind: "auto" }
	| { readonly kind: "lock"; readonly level: ThinkingLevel };

/** Execution mode -> default thinking level (kept deliberately simple). */
const MODE_THINKING_LEVEL: Readonly<Record<AgentMode, ThinkingLevel>> = {
	fast: "low",
	standard: "high",
	ultra: "max",
};

export function modeThinkingLevel(mode: AgentMode): ThinkingLevel {
	return MODE_THINKING_LEVEL[mode];
}

export function parseThinkingLevel(value: string): ThinkingLevel | undefined {
	const normalized = value.trim().toLowerCase();
	return (THINKING_LEVELS as readonly string[]).includes(normalized)
		? (normalized as ThinkingLevel)
		: undefined;
}

/** Parse the persisted policy string ("auto", "lock:<level>", "off"). */
export function parsePolicy(value: string | undefined): ThinkingPolicyState {
	if (value === undefined) return { kind: "auto" };
	const normalized = value.trim().toLowerCase();
	if (normalized === "off" || normalized === "0" || normalized === "false")
		return { kind: "off", reason: "disabled" };
	if (
		normalized === "auto" ||
		normalized === "1" ||
		normalized === "true" ||
		normalized === ""
	)
		return { kind: "auto" };
	if (normalized.startsWith("lock:")) {
		const level = parseThinkingLevel(normalized.slice(5));
		if (level) return { kind: "lock", level };
	}
	return { kind: "auto" };
}

export function serializePolicy(state: ThinkingPolicyState): string {
	if (state.kind === "lock") return `lock:${state.level}`;
	if (state.kind === "off") return "off";
	return "auto";
}

/** The level that should be asserted before the next turn starts. */
export function resolveThinkingLevel(
	state: ThinkingPolicyState,
	mode: AgentMode,
): ThinkingLevel {
	if (state.kind === "lock") return state.level;
	return modeThinkingLevel(mode);
}

export function formatPolicy(
	state: ThinkingPolicyState,
	mode: AgentMode,
): string {
	if (state.kind === "lock") return `lock:${state.level}`;
	if (state.kind === "off") return "off (manual only)";
	return `auto (${mode} -> ${modeThinkingLevel(mode)})`;
}

/** Human-readable one-liner for the status bar / /status output. */
export function formatPolicyShort(
	state: ThinkingPolicyState,
	mode: AgentMode,
): string {
	if (state.kind === "lock") return `thinking=${state.level} (locked)`;
	if (state.kind === "off") return "thinking=manual (policy off)";
	return `thinking=${modeThinkingLevel(mode)} (auto:${mode})`;
}
