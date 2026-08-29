import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { normalize } from "node:path";
import { getBundledTrellisEntry } from "../src/project-provider/trellis-cli.ts";

describe("bundled Trellis CLI", () => {
	it("resolves the release-locked Trellis executable instead of PATH", () => {
		const entry = normalize(getBundledTrellisEntry());
		assert.match(entry, /node_modules[\\/]@mindfoldhq[\\/]trellis[\\/]bin[\\/]trellis\.js$/);
		assert.equal(existsSync(entry), true);
	});
});
