import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notificationsEnabled } from "../.pi/extensions/notify.ts";

/**
 * **The switch this extension shipped without.** `.pi/extensions/notify.ts` is auto-discovered by Pi in every session and fires a
 * Windows toast on every settled instruction, and measured, it had no way to stop it and no line of documentation anywhere. The
 * predicate is exported so the spellings are testable without spawning a process or a toast: an off switch that does not recognise a
 * spelling is an off switch that does not work.
 */
describe("the desktop notification switch", () => {
	it("is off for the three spellings this repository already uses", () => {
		for (const spelling of ["0", "off", "false", " OFF ", "False"]) {
			assert.equal(notificationsEnabled({ DOVE_PI_NOTIFY: spelling } as NodeJS.ProcessEnv), false, spelling + " turns it off");
		}
	});

	it("is on for everything else, including nothing at all", () => {
		assert.equal(notificationsEnabled({} as NodeJS.ProcessEnv), true, "the default must not change for anyone who liked it");
		for (const spelling of ["1", "on", "true", "yes", ""]) {
			assert.equal(notificationsEnabled({ DOVE_PI_NOTIFY: spelling } as NodeJS.ProcessEnv), true, JSON.stringify(spelling) + " leaves it on");
		}
	});
});
