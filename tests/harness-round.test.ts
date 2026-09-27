import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { surfaceFit, verifierFit } from "../src/core/harness-round.ts";

/**
 * The check that an edit stayed inside the surface it declared. It reuses the fence rule rather than reimplementing it,
 * so what these tests pin is the **three answers**: inside, outside with the offenders named, and unresolved when
 * nobody could tell - because "the edit went somewhere it declared it would not" and "nobody could tell" are different
 * facts, and only one of them is about the edit.
 */

const ROOT = process.platform === "win32" ? "C:\\repo" : "/repo";

function fit(touchedFiles: readonly string[] | undefined, declaredPaths: readonly string[]) {
	return surfaceFit({ touchedFiles, declaredPaths, workspaceRoot: ROOT });
}

describe("did the edit stay inside the surface it declared", () => {
	it("accepts a file inside a declared directory path, and one that is the declared path itself", () => {
		assert.deepEqual(fit(["src/core/harness-round.ts", "src"], ["src"]), { fit: "inside", outside: [] });
		assert.deepEqual(fit(["modes/pentest/MODE.md"], ["modes"]), { fit: "inside", outside: [] });
		assert.deepEqual(fit(["AGENTS.md"], ["AGENTS.md"]), { fit: "inside", outside: [] });
	});

	it("names the files that fall outside, rather than only saying that some did", () => {
		// The refusal the fence issues names the declaration that would have allowed the write; this names the files, for
		// the same reason: a reader should not have to diff the commit to find out which part was the surprise.
		const result = fit(["src/a.ts", "README.md", ".trellis/harness-surface.yaml"], ["src"]);
		assert.equal(result.fit, "outside");
		assert.deepEqual(result.outside, ["README.md", ".trellis/harness-surface.yaml"]);
	});

	it("does not confuse a prefix with a path boundary", () => {
		// `src-notes.md` is not inside `src`, and a rule that compared strings would say it was.
		assert.equal(fit(["src-notes.md"], ["src"]).fit, "outside");
		assert.equal(fit(["src/notes.md"], ["src"]).fit, "inside");
	});

	it("answers unresolved when nobody could tell, which is not the same as outside", () => {
		// A commit git cannot resolve says nothing about where the edit went, and reporting it as outside would put a
		// defect on the change that belongs to the reading.
		assert.deepEqual(fit(undefined, ["src"]), { fit: "unresolved", outside: [] });
	});

	it("treats a commit that touched nothing as vacuously inside", () => {
		assert.deepEqual(fit([], ["src"]), { fit: "inside", outside: [] });
	});

	it("answers definite, possible or none for whether an edit is a verifier change", () => {
		// The boundary says a change that edits the verifier is not a loop turn. Two of the three answers are certainties
		// and the middle one is a declaration of a limit: the code is in a file that is mostly harness, and naming the
		// symbols makes the judgment it leaves an informed one.
		const verifier = { paths: ["src/core/failure-reading.ts"], embedded: [{ path: "src/pi-adapter/extension.ts", symbols: ["unresolvedAcceptanceEvidence", "changeObservables"] }] };
		const fit = (touchedFiles: readonly string[] | undefined) => verifierFit({ touchedFiles, verifier, workspaceRoot: ROOT });
		assert.equal(fit(["src/core/failure-reading.ts"]).fit, "definite", "the file is verifier code");
		const possible = fit(["src/pi-adapter/extension.ts"]);
		assert.equal(possible.fit, "possible");
		assert.deepEqual(possible.embedded, [{ path: "src/pi-adapter/extension.ts", symbols: ["unresolvedAcceptanceEvidence", "changeObservables"] }]);
		assert.equal(fit(["src/core/action-policy.ts"]).fit, "none", "harness code is not a verifier change");
		assert.equal(fit(["src/core/failure-reading.ts", "src/pi-adapter/extension.ts"]).fit, "definite", "a verifier file outranks an embedding one");
	});

	it("claims nothing about a commit it could not read", () => {
		const verifier = { paths: ["src/core/failure-reading.ts"], embedded: [{ path: "src/pi-adapter/extension.ts", symbols: ["x"] }] };
		// Unlike the surface fit, an unreadable commit is not a third state here: the question is whether the verifier is at
		// stake, and nothing was read, so nothing is claimed.
		assert.equal(verifierFit({ touchedFiles: undefined, verifier, workspaceRoot: ROOT }).fit, "none");
		assert.equal(verifierFit({ touchedFiles: [], verifier, workspaceRoot: ROOT }).fit, "none");
	});

	it("normalizes the paths the way the fence does, so one rule serves both", () => {
		// Windows separators, a redundant prefix and trailing separators all have to come out the same, because the fence
		// already had to make that decision and two answers would mean two rules.
		assert.equal(fit(["src\\core\\harness-round.ts"], ["src"]).fit, "inside", "backslashes are path separators here");
		assert.equal(fit(["./src/core/harness-round.ts"], ["src"]).fit, "inside");
		assert.equal(fit(["src/core/"], ["src"]).fit, "inside");
	});
});
