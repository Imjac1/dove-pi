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

/**
 * The scheduling half, with its clocks injected.
 *
 * **Why it takes a timer rather than calling `setTimeout` itself**: the adapter has no scheduling facility and
 * the host fires callbacks rather than time, so this is the only part of the keepalive that can act without a
 * request. **Injecting the clock is what makes the decision testable** - the scheduling rules are the same in a
 * test and in production, and only the provider call the callback makes is out of reach.
 */
export interface KeepaliveClock {
	readonly now: () => number;
	readonly setTimer: (callback: () => void, delayMs: number) => unknown;
	readonly clearTimer: (handle: unknown) => void;
}

export interface KeepaliveTimerOptions {
	readonly clock: KeepaliveClock;
	/** Called when a keepalive is due. **This is the only place a request can be made**, and the policy never calls it itself. */
	readonly onDue: () => void;
	readonly idleMs?: number;
}

/**
 * Arm, observe and disarm a keepalive.
 *
 * **The rules it enforces, and each answers something the policy cannot know on its own:**
 *
 * - `observe()` records that a request happened, and **re-arms or cancels**: a session that is talking needs no
 *   heartbeat, and one that falls silent past the interval does.
 * - **`disarm()` is the caller obligation on session shutdown.** A timer surviving its session would send the
 *   next session a request nobody asked for, which is worse than a cold cache.
 * - **A due callback disarms itself first**, so a slow callback cannot stack a second heartbeat behind the first.
 */
export class SessionKeepaliveTimer {
	private handle: unknown = undefined;
	private lastRequestAt: number | undefined;
	private disabled = true;

	public constructor(private readonly options: KeepaliveTimerOptions) {
		// **Assigned here rather than in a field initializer**, which would run before the parameter property exists:
		// TypeScript reports exactly that as `options is used before its initialization`.
		this.lastRequestAt = options.clock.now();
	}

	/** Start watching. Until this is called nothing is scheduled, which is the offline-first default made operal. */
	public arm(): void {
		this.disabled = false;
		this.lastRequestAt = this.options.clock.now();
		this.reschedule();
	}

	/** Record a request and push the next heartbeat out behind it. */
	public observe(): void {
		this.lastRequestAt = this.options.clock.now();
		if (!this.disabled) this.reschedule();
	}

	/** Stop for good, and clear anything pending. Called on session shutdown. */
	public disarm(): void {
		this.disabled = true;
		if (this.handle !== undefined) {
			this.options.clock.clearTimer(this.handle);
			this.handle = undefined;
		}
	}

	private reschedule(): void {
		if (this.handle !== undefined) {
			this.options.clock.clearTimer(this.handle);
			this.handle = undefined;
		}
		const since = this.options.clock.now() - (this.lastRequestAt ?? this.options.clock.now());
		const reading = evaluateSessionKeepalive({
			sinceLastRequestMs: since,
			enabled: true,
			...(this.options.idleMs === undefined ? {} : { idleMs: this.options.idleMs }),
		});
		const delay = reading.due ? 0 : (this.options.idleMs ?? KEEPALIVE_IDLE_MS) - Math.max(0, since);
		this.handle = this.options.clock.setTimer(() => {
			this.handle = undefined;
			if (this.disabled) return;
			// Disarm before calling out: a callback slower than the interval must not stack heartbeats.
			this.disabled = true;
			this.options.onDue();
		}, delay);
	}
}

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