import type { AgentMode } from "../core/contracts.ts";

/**
 * Context guard for the Dove Pi adapter.
 *
 * Purpose: keep the request prefix inside the active model's usable window so
 * the model always sees the full, untruncated prompt (truncation silently
 * degrades answer quality far more than a compaction hint ever could).
 *
 * This module is STRICTLY ADVISORY. It never deletes, rewrites, or drops
 * user history. It only:
 *   - reports whether the prefix is approaching the model's window, and
 *   - produces an advisory hint the adapter may surface (notify + append to
 *     the append-only context message so the model can suggest /compact).
 *
 * Quality guardrail: advisory-only, offline, no network, no data mutation.
 */

export interface ContextGuard {
	readonly compactAdvised: boolean;
	readonly hint: string | undefined;
	readonly fractionUsed: number | undefined;
}

export const DEFAULT_MAX_CONTEXT_FRACTION = 0.82;
export const DEFAULT_MAX_CONTEXT_TOKENS = 150_000;

function envFraction(): number {
	const raw = Number(process.env.DOVE_PI_MAX_CONTEXT_FRACTION);
	return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : DEFAULT_MAX_CONTEXT_FRACTION;
}

function envMaxTokens(): number {
	const raw = Number(process.env.DOVE_PI_MAX_CONTEXT_TOKENS);
	return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_CONTEXT_TOKENS;
}

function isGuardEnabled(): boolean {
	return !(
		process.env.DOVE_PI_PREFIX_FUSE === "0" ||
		process.env.DOVE_PI_PREFIX_FUSE === "off" ||
		process.env.DOVE_PI_PREFIX_FUSE === "false"
	);
}

export function guardContext(input: {
	tokens?: number | null;
	contextWindow?: number;
	mode: AgentMode;
}): ContextGuard {
	if (!isGuardEnabled())
		return { compactAdvised: false, hint: undefined, fractionUsed: undefined };

	const maxFraction = envFraction();
	const maxTokens = envMaxTokens();
	const tokens = input.tokens ?? undefined;
	const contextWindow = input.contextWindow ?? undefined;

	const fractionUsed =
		tokens !== undefined && contextWindow !== undefined && contextWindow > 0
			? tokens / contextWindow
			: undefined;

	// Window-fraction guard: when the prefix is close to the model window we
	// advise compaction BEFORE silent truncation would drop relevant content.
	if (fractionUsed !== undefined && fractionUsed >= maxFraction) {
		return {
			compactAdvised: true,
			fractionUsed,
			hint: `通过率达到前缀窗口的 ${(fractionUsed * 100).toFixed(0)}%（阈值 ${(maxFraction * 100).toFixed(0)}%）——建议 /compact 以保留高质量上下文。`,
		};
	}

	// Absolute-token guard: keeps the prefix from growing unboundedly before the
	// single advisory hint. Observed data (08-29, both projects): cache misses
	// are time-driven (gap>60s -> 34-40% miss, independent of prefix size); when
	// a miss does happen its cost equals the whole prefix, so a moderate cap
	// bounds the worst-case miss cost. Purely advisory - never auto-compacts.
	// It is NOT a cost fix on its own (no cliff to avoid); it only bounds risk.
	if (tokens !== undefined && tokens > maxTokens) {
		return {
			compactAdvised: true,
			fractionUsed,
			hint: `当前会话已累积约 ${tokens.toLocaleString()} tokens（提示阈值 ${maxTokens.toLocaleString()}）。缓存失效时按整个前缀计费，前缀越大单次损失越大；任务告一段落时建议开新会话，避免长前缀在停顿后全量重算。`,
		};
	}

	return { compactAdvised: false, hint: undefined, fractionUsed };
}
