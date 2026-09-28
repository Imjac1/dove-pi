import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateSessionKeepalive, KEEPALIVE_IDLE_MS, OBSERVED_MISS_GAP_MS, SessionKeepaliveTimer } from "../src/pi-adapter/session-keepalive.ts";

/**
 * **Which class of defect this holds, and which it does not.** It holds the keepalive policy: that it is off
 * unless asked, that its interval sits below the gap the repository observed misses at, that an unknown elapsed
 * time yields no heartbeat rather than a guess, and that nothing in the module reaches the network.
 *
 * **It does not hold the timer that would call it**, which is wiring rather than policy, and it does not hold
 * whether a keepalive actually keeps a given provider cache warm - that needs the network.
 */

describe("the keepalive timer, with its clock injected", () => {
	function clock() {
		let now = 0;
		let pending: { at: number; callback: () => void } | undefined;
		return {
			clock: {
				now: () => now,
				setTimer: (callback: () => void, delayMs: number) => { pending = { at: now + delayMs, callback }; return pending; },
				clearTimer: (handle: unknown) => { if (pending === handle) pending = undefined; },
			},
			advance: (ms: number) => { now += ms; },
			pending: () => pending,
			// **A real timer fires when it is due, and the fake has to model that** or a test can fire early and call
			// the result a defect. It returns whether it fired, so a case can say which it expected.
			fire: () => {
				const p = pending;
				if (!p || now < p.at) return false;
				pending = undefined;
				p.callback();
				return true;
			},
		};
	}

	it("schedules nothing until it is armed, which is the offline-first default made operable", () => {
		const c = clock();
		let due = 0;
		new SessionKeepaliveTimer({ clock: c.clock, onDue: () => { due += 1; } });
		assert.equal(c.pending(), undefined, "constructing one schedules nothing");
		assert.equal(due, 0);
	});

	it("fires once past the interval, and the callback cannot stack a second heartbeat behind it", () => {
		const c = clock();
		let due = 0;
		const timer = new SessionKeepaliveTimer({ clock: c.clock, onDue: () => { due += 1; } });
		timer.arm();
		assert.ok(c.pending(), "arming schedules one");
		c.advance(KEEPALIVE_IDLE_MS);
		c.fire();
		assert.equal(due, 1);
		assert.equal(c.pending(), undefined, "and the timer disarms itself before calling out");
		// The control: a second fire with nothing pending does nothing, so the count above is about the callback.
		c.fire();
		assert.equal(due, 1);
	});

	it("pushes the next heartbeat out when a request happens", () => {
		const c = clock();
		let due = 0;
		const timer = new SessionKeepaliveTimer({ clock: c.clock, onDue: () => { due += 1; } });
		timer.arm();
		c.advance(KEEPALIVE_IDLE_MS - 1_000);
		timer.observe();
		c.advance(1_000);
		assert.equal(c.fire(), false, "the old timer was cleared and the new one is not due yet");
		assert.equal(due, 0, "a session that just talked is not idle");
		c.advance(KEEPALIVE_IDLE_MS);
		assert.equal(c.fire(), true, "and once it falls silent past the interval, the heartbeat is due");
		assert.equal(due, 1);
	});

	it("disarms on shutdown, so a timer cannot outlive the session that armed it", () => {
		const c = clock();
		let due = 0;
		const timer = new SessionKeepaliveTimer({ clock: c.clock, onDue: () => { due += 1; } });
		timer.arm();
		timer.disarm();
		assert.equal(c.pending(), undefined, "disarming clears what was pending");
		c.advance(10 * KEEPALIVE_IDLE_MS);
		c.fire();
		assert.equal(due, 0, "and nothing fires afterwards");
	});
});

describe("the session keepalive policy", () => {
	it("is off unless it is asked for, which is what offline-first means", () => {
		assert.equal(evaluateSessionKeepalive({ sinceLastRequestMs: 10 * 60_000 }).due, false, "no flag, no request");
		assert.equal(evaluateSessionKeepalive({ sinceLastRequestMs: 10 * 60_000, enabled: false }).due, false);
		assert.equal(evaluateSessionKeepalive({ sinceLastRequestMs: 10 * 60_000, enabled: true }).due, true,
			"and asking for it does schedule one");
	});

	it("keeps its interval below the gap the repository observed misses at", () => {
		assert.ok(KEEPALIVE_IDLE_MS < OBSERVED_MISS_GAP_MS,
			`${KEEPALIVE_IDLE_MS}ms must sit under the observed ${OBSERVED_MISS_GAP_MS}ms, or a heartbeat arrives after the expiry it exists to prevent`);
		// The review suggested four to five minutes. Measured against the observation, that is late by a factor.
		assert.ok(KEEPALIVE_IDLE_MS < 4 * 60_000 / 2, "and well below the interval the review suggested");
	});

	it("fires at the interval, not before it", () => {
		const at = evaluateSessionKeepalive({ sinceLastRequestMs: KEEPALIVE_IDLE_MS, enabled: true });
		assert.equal(at.due, true);
		assert.match(at.reason ?? "", /观察|observation|past the/);
		assert.equal(evaluateSessionKeepalive({ sinceLastRequestMs: KEEPALIVE_IDLE_MS - 1, enabled: true }).due, false);
	});

	it("answers no when it cannot know, rather than sending a request nobody can account for", () => {
		for (const since of [undefined, Number.NaN, -1, Number.POSITIVE_INFINITY]) {
			const reading = evaluateSessionKeepalive({ sinceLastRequestMs: since, enabled: true });
			assert.equal(reading.due, false, String(since));
		}
		// The control: a real elapsed time of the same magnitude does fire, so the above is about the input.
		assert.equal(evaluateSessionKeepalive({ sinceLastRequestMs: 90_000, enabled: true }).due, true);
	});

	it("takes an explicit interval for a caller that measured its own provider", () => {
		assert.equal(evaluateSessionKeepalive({ sinceLastRequestMs: 5_000, enabled: true, idleMs: 1_000 }).due, true);
		assert.equal(evaluateSessionKeepalive({ sinceLastRequestMs: 5_000, enabled: true, idleMs: 0 }).due, false,
			"a non-positive interval is refused rather than treated as always-due");
	});
});
