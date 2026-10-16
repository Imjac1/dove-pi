import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { describePiVersionFailure, getPiVersion, readPiVersion } from "../src/pi-adapter/host-version.ts";
import { temporaryDirectory } from "./temporary-directory.ts";

/**
 * **What this file holds.** The host-version reading: that a version which could **not be read** is distinguishable from
 * one that is present-but-absent-from-the-manifest, and that a reading which found nothing can name what it searched.
 * Measured 2026-10-17, before this file existed: no file under `tests/` or `scripts/` mentioned `getPiVersion` or the
 * module, so the silent `"unknown"` could have been reintroduced without a red anywhere.
 *
 * **What it does not hold.** The fallback `require` path (it runs only where the walk fails, and whether a machine
 * resolves it from here is not something this file can arrange), and nothing about which version the host *should* be -
 * these cases compare the reading against itself and against the filesystem, never against a version number.
 */

const HOST_MANIFEST = join("node_modules", "@earendil-works", "pi-coding-agent", "package.json");

/** Does any directory above this one hold a host package? The unreadable case is only measurable when none does. */
function hostIsReachableFrom(start: string): string | undefined {
	let current = start;
	for (;;) {
		const candidate = join(current, HOST_MANIFEST);
		try {
			readFileSync(candidate);
			return candidate;
		} catch {
			const parent = dirname(current);
			if (parent === current) return undefined;
			current = parent;
		}
	}
}

describe("the host version reading", () => {
	it("reads a version where the host is installed, and says where it came from", () => {
		const reading = readPiVersion();
		assert.equal(reading.unreadable, false);
		assert.notEqual(reading.version, "unknown");
		assert.ok(reading.foundAt?.endsWith(HOST_MANIFEST), `foundAt should be the host manifest, got ${reading.foundAt}`);
		// The walk stops where it found it, so the last path it tried is the file it read.
		assert.equal(reading.searched.at(-1), reading.foundAt);
		// And the string form the call sites use is this reading's version, not a second computation of it.
		assert.equal(getPiVersion(), reading.version);
	});

	it("distinguishes a host that cannot be found from one whose manifest carries no version", () => {
		const root = temporaryDirectory("dove-host-version-");
		const above = hostIsReachableFrom(root);
		assert.equal(
			above,
			undefined,
			`this machine holds a host package above the temp root (${above}), so a walk from there cannot fail; the unreadable case needs a machine without one`,
		);

		// Nothing to find: the reading says so, and it says what it looked at.
		const missing = readPiVersion(root);
		assert.equal(missing.unreadable, true);
		assert.equal(missing.version, "unknown");
		assert.equal(missing.foundAt, undefined);
		assert.ok(missing.searched.length > 0, "a reading that found nothing still has to name the paths it tried");
		const sentence = describePiVersionFailure(missing);
		assert.ok(
			missing.searched.some((candidate) => sentence.includes(candidate)),
			`the failure sentence has to name what was searched; got: ${sentence}`,
		);

		// Found, and carrying no version: a different fact, and it must not be collapsed into the one above.
		const holder = join(root, "node_modules", "@earendil-works", "pi-coding-agent");
		mkdirSync(holder, { recursive: true });
		writeFileSync(join(holder, "package.json"), "{}", "utf8");
		const versionless = readPiVersion(root);
		assert.equal(versionless.unreadable, false, "a manifest that was found is not an unreadable host");
		assert.equal(versionless.version, "unknown", "the field is absent, so the version is unknown");
		assert.ok(versionless.foundAt?.startsWith(root + sep), `foundAt should name the file under the fixture, got ${versionless.foundAt}`);

		// And the same tree, with a version, reads it without the walk having to change.
		writeFileSync(join(holder, "package.json"), JSON.stringify({ version: "9.9.9" }), "utf8");
		const readable = readPiVersion(root);
		assert.equal(readable.unreadable, false);
		assert.equal(readable.version, "9.9.9");
	});
});
