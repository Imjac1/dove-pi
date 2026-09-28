/**
 * Session keepalive policy for the Dove Pi adapter.
 *
 * Purpose: the review P0.3 asks for a heartbeat that keeps the upstream provider cache warm, so a session does
 * not lose its prefix to an idle expiry.
 *
 * **Why this is its own module rather than part of `context-guard.ts`**: the guard reads what has already
 * happened to the prefix and says so. This decides whether to *make a request*, which is a different kind of
 * act - and one with a network cost.
 *
 * **Why the interval is not the one the review proposes.** The review suggests four to five minutes. **The
 * repository own observation contradicts that**: `context-guard.ts` records *observed data (08-29, both
 * projects): cache misses are time-driven (gap>60s -> 34-40% miss, independent of prefix size)*. A heartbeat every
 * four or five minutes would therefore fire **after three or four missed expiries**, not before one. The interval
 * here is derived from that observation and sits below it.
 *
 * **Offline-first, and that is why it is off.** A keepalive is a provider request, so enabling it is enabling the
 * network - and the review own note says to make it optional. **`enabled` defaults to false, and nothing here
 * reaches the network itself**: this module decides, the caller acts.
 */

/** The gap at which the repository observed misses begin. Stated here so the interval below can be checked against it. */
export const OBSERVED_MISS_GAP_MS = 60_000;

/**
 * How long a session may sit idle before a keepalive is due.
 *
 * **Derived, not chosen**: three quarters of the observed miss gap, so a heartbeat lands before the expiry the
 * repository measured rather than after several of them. **The review suggested four to five minutes, which is
 * four to five times this** and would miss the window it exists to protect.
 */
export const KEEPALIVE_IDLE_MS = 45_000;

export interface KeepaliveReading {
	readonly due: boolean;
	/** Milliseconds since the last provider request, when the caller knows. */
	readonly sinceLastRequestMs?: number;
	/** Present only when something is due, and it says what. */
	readonly reason?: string;
}

/**
 * Decide whether a keepalive is due.
 *
 * **It decides and does not act.** Every branch that cannot know says so: a caller with no elapsed time gets
 * `due: false` rather than a guess, because a heartbeat sent on an unknown gap is a request nobody can account
 * for. **And the disabled branch is checked first**, so an installation that has not opted in never even computes
 * the comparison.
 */
export function evaluateSessionKeepalive(input: {
	readonly sinceLastRequestMs?: number;
	readonly enabled?: boolean;
	readonly idleMs?: number;
}): KeepaliveReading {
	const since = input.sinceLastRequestMs;
	const enabled = input.enabled === true;
	const idleMs = input.idleMs !== undefined && Number.isFinite(input.idleMs) && input.idleMs > 0 ? input.idleMs : KEEPALIVE_IDLE_MS;
	if (!enabled) {
		return { due: false, ...(since === undefined ? {} : { sinceLastRequestMs: since }) };
	}
	if (since === undefined || !Number.isFinite(since) || since < 0) {
		return { due: false, reason: "no elapsed time was supplied, so there is nothing to decide from" };
	}
	if (since < idleMs) return { due: false, sinceLastRequestMs: since };
	return {
		due: true,
		sinceLastRequestMs: since,
		reason: `the session has been idle ${Math.round(since / 1000)}s, past the ${Math.round(idleMs / 1000)}s the repository own observation allows before the provider cache expires`,
	};
}
