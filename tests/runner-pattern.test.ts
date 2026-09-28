import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * **Every test file sits directly under `tests/`, and that is what makes the runner pattern unambiguous.** The suite runs as
 * `node --import tsx --test` over a glob rooted at `tests`, and for a file at depth one both a single star and a double star match it,
 * so nothing here depends on how
 * `**` is interpreted - by Node, by the shell, or by whichever one expands it. **A nested test file would make that interpretation
 * load-bearing**, and the round that measured this could not establish it: two reporter formats and an explicit-file run were tried, and
 * none of them reports which files were loaded.
 *
 * So this asserts the assumption rather than the behaviour: **nesting a test file is a decision about the runner pattern, not a
 * convenience**, and this is where the next person finds that out.
 */
describe("the test runner pattern", () => {
	it("matches every test file because every test file is at depth one", () => {
		// Recursive readdir returns paths relative to the directory it was given, which is exactly what is needed here: a path with a
		// separator in it is a nested test file.
		// **The separator is normalised, and that is not cosmetic**: recursive readdir returns backslashes on Windows, so a filter
		// looking for a forward slash matched nothing and this check passed over a planted nested file. Its negative control is what
		// found that - a test that cannot fail is not a test.
		const nested = readdirSync(join(process.cwd(), "tests"), { recursive: true, encoding: "utf8" })
			.map((entry) => entry.replaceAll("\\", "/"))
			.filter((entry) => entry.endsWith(".test.ts") && entry.includes("/"));
		assert.deepEqual(nested, [], "a test file in a subdirectory makes the runner pattern meaning-bearing: " + nested.join(", "));
	});
});
