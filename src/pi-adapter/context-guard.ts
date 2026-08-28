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

const DEFAULT_MAX_FRACTION = 0.82;
const DEFAULT_MAX_TOKENS = 260_000;

function envFraction(): number {
	const raw = Number(process.env.DOVE_PI_MAX_CONTEXT_FRACTION);
	return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : DEFAULT_MAX_FRACTION;
}

function envMaxTokens(): number {
	const raw = Number(process.env.DOVE_PI_MAX_CONTEXT_TOKENS);
	return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_TOKENS;
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

	// Absolute-token guard: an alternative safety floor for very wide windows
	// Absolute-token guard: an alternative safety floor for very wide windows.
	// Tuned to ~25-30% of a 1M model window so we advise compaction or a new
	// session before the hot prefix gets so large that a rebuild (post-compact
	// full cache MISS at 300K+ tokens) becomes the dominant cost. Compacting a
	// warm 260K prefix is cheaper than compacting a 500K one:
	// the hit rate is high (≈90%), so hot prefixes are cheap - the expensive
	// operation is destroying and rebuilding them.
	if (tokens !== undefined && tokens > maxTokens) {
		return {
			compactAdvised: true,
			fractionUsed,
			hint: `当前会话已累积约 ${tokens.toLocaleString()} tokens（软上限 ${maxTokens.toLocaleString()}）。建议 /compact 或开始新会话，以避免一次昂贵的完整缓存 MISS。`,
		};
	}

	return { compactAdvised: false, hint: undefined, fractionUsed };
}
