import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHANGE_SURFACES } from "../src/core/task-convergence.ts";
import { HarnessSurfaceError, parseHarnessSurface, unresolvedSurfaceEntries } from "../src/core/harness-surface.ts";

/**
 * The surface map is the one declaration here whose correctness can be checked **without a run**: every entry either
 * resolves to a path in this repository or it does not. So the real file is read from disk and checked against the
 * real tree, and the refusals are exercised on constructed text.
 */

const DECLARATION = join(process.cwd(), ".trellis", "harness-surface.yaml");

function expectRefusal(text: string): HarnessSurfaceError {
	try {
		parseHarnessSurface(text);
	} catch (error) {
		assert.ok(error instanceof HarnessSurfaceError, "expected a surface refusal, got " + String(error));
		return error;
	}
	throw new Error("expected a refusal, but the declaration parsed");
}

describe("the declared editable surface", () => {
	it("declares every component the record vocabulary has, and nothing else", () => {
		const surface = parseHarnessSurface(readFileSync(DECLARATION, "utf8"));
		assert.deepEqual(surface.components.map((component) => component.name).sort(), [...CHANGE_SURFACES].sort(), "the map and CHANGE_SURFACES agree in both directions");
		assert.equal(surface.version, 1);
	});

	it("resolves every entry against the real tree, so the map cannot drift from the repository", () => {
		// The "explicit" half of the requirement, and the reason the real file is read rather than a fixture: a
		// declaration whose entries do not exist names an action space that is not there.
		const surface = parseHarnessSurface(readFileSync(DECLARATION, "utf8"));
		assert.deepEqual(unresolvedSurfaceEntries(surface, (relative) => existsSync(join(process.cwd(), relative))), [], "entries that resolve to nothing");
		assert.ok(surface.components.every((component) => component.paths.length > 0), "every component owns at least one path");
	});

	it("lets one path belong to two components, because the map is not a partition", () => {
		// src/pi-adapter/extension.ts is both a tool description and middleware; forcing a partition would make the map
		// lie about one of them.
		const surface = parseHarnessSurface(readFileSync(DECLARATION, "utf8"));
		const owners = surface.components.filter((component) => component.paths.includes("src/pi-adapter/extension.ts")).map((component) => component.name);
		assert.deepEqual(owners.sort(), ["middleware", "tool-description"]);
	});

	it("refuses a component outside the vocabulary, and names the components there are", () => {
		const error = expectRefusal("version: 1\ncomponents:\n  vibes: [src]\n");
		assert.equal(error.code, "unknown-component");
		for (const name of CHANGE_SURFACES) assert.match(error.message, new RegExp(name));
	});

	it("refuses a component with no paths, because it names nothing", () => {
		assert.equal(expectRefusal("version: 1\ncomponents:\n  skill: []\n").code, "empty");
		assert.equal(expectRefusal("version: 1\ncomponents:\n  skill:\n").code, "empty");
	});

	it("refuses a declaration with no components at all", () => {
		assert.equal(expectRefusal("version: 1\ncomponents: {}\n").code, "empty");
	});

	it("refuses an unknown field, a wrong version, and a non-mapping", () => {
		assert.equal(expectRefusal("version: 1\ncomponents:\n  skill: [.agents/skills]\nextra: true\n").code, "unknown-field");
		assert.equal(expectRefusal("version: 2\ncomponents:\n  skill: [.agents/skills]\n").code, "invalid-type");
		assert.equal(expectRefusal("- just\n- a list\n").code, "invalid-type");
		assert.equal(expectRefusal("version: 1\n").code, "invalid-type");
	});

	it("refuses a path that is absolute or escapes the workspace", () => {
		assert.equal(expectRefusal("version: 1\ncomponents:\n  skill: [C:/elsewhere]\n").code, "invalid-type");
		assert.equal(expectRefusal("version: 1\ncomponents:\n  skill: [/etc]\n").code, "invalid-type");
		const escaping = expectRefusal("version: 1\ncomponents:\n  skill: [../outside]\n");
		assert.equal(escaping.code, "invalid-type");
		assert.match(escaping.message, /escapes the workspace/);
	});

	it("names the entry, not the file, when something does not resolve", () => {
		const surface = parseHarnessSurface("version: 1\ncomponents:\n  skill: [.agents/skills, nowhere/at/all]\n  middleware: [src]\n");
		assert.deepEqual(unresolvedSurfaceEntries(surface, (relative) => relative === "src" || relative === ".agents/skills"), ["skill:nowhere/at/all"]);
	});
});
