import { declaredPrefixHit, workspaceRelativeTarget } from "./action-policy.ts";
import type { HarnessVerifier } from "./harness-surface.ts";

/**
 * **Did the edit stay inside the surface it declared?**
 *
 * AHE requires the action space to be explicit **and revertible**. The declared surface made it explicit; binding a
 * change to the commit that embodies it is what gives a revert a target. This is the third question, and the one that
 * keeps a claim honest: the manifest said which component the change touches, and the commit either stayed inside that
 * component declared paths or it did not.
 *
 * **The rule is the fence own**, reused through `declaredPrefixHit` rather than reimplemented: a path is inside a
 * declared path when it is that path or under it as a directory, compared after the same workspace-relative
 * normalization the fence applies. Two implementations of that rule is the drift this project keeps paying for, and the
 * helper is named for what it does rather than for its first caller now that it has a second.
 */

export type SurfaceFit = "inside" | "outside" | "unresolved";

export interface SurfaceFitResult {
	readonly fit: SurfaceFit;
	/** The touched files that fall outside every declared path, named so a reader does not have to guess. */
	readonly outside: readonly string[];
}

/**
 * `touchedFiles` is `undefined` when nobody could determine them - a commit that does not resolve, or a workspace that
 * is not a repository - and that is a **third answer, not a nicer word for `outside`**: "the edit went somewhere it
 * declared it would not" and "nobody could tell" are different facts. An empty list is a different thing again: a
 * commit that touched nothing, which is vacuously inside.
 */
/** Whether an edit is a change to the verifier, which is not a loop turn. */
export type VerifierFit = "definite" | "possible" | "none";

export interface VerifierFitResult {
	readonly fit: VerifierFit;
	/** The verifier files the commit touched: the edit **is** a verifier change. */
	readonly paths: readonly string[];
	/** Files that **contain** verifier code, with the symbols at stake - the edit may be one, and a reader can look. */
	readonly embedded: readonly { readonly path: string; readonly symbols: readonly string[] }[];
}

/**
 * **Is this edit a verifier change?** The boundary contract says such a change is not a loop turn, and which edits those
 * are was a reader judgment until the verifier could be pointed at.
 *
 * Three answers, because the evidence supports three: **`definite`** when a touched file is verifier code, **`possible`**
 * when it is a file that embeds verifier code - named with the symbols, so the judgment it leaves is an informed one -
 * and **`none`** otherwise. **An unreadable commit is `none`**, not `possible`: nothing could be read, so nothing is
 * claimed, and the question here is whether the verifier is at stake rather than what the edit touched.
 */
export function verifierFit(input: { readonly touchedFiles: readonly string[] | undefined; readonly verifier: HarnessVerifier; readonly workspaceRoot: string }): VerifierFitResult {
	if (input.touchedFiles === undefined) return { fit: "none", paths: [], embedded: [] };
	const paths: string[] = [];
	const embedded: { path: string; symbols: readonly string[] }[] = [];
	for (const file of input.touchedFiles) {
		const relative = workspaceRelativeTarget(input.workspaceRoot, file);
		if (declaredPrefixHit(input.verifier.paths, relative) !== undefined) paths.push(file);
		const hit = input.verifier.embedded.find((entry) => declaredPrefixHit([entry.path], relative) !== undefined);
		if (hit !== undefined) embedded.push({ path: file, symbols: hit.symbols });
	}
	return { fit: paths.length > 0 ? "definite" : embedded.length > 0 ? "possible" : "none", paths, embedded };
}

export function surfaceFit(input: { readonly touchedFiles: readonly string[] | undefined; readonly declaredPaths: readonly string[]; readonly workspaceRoot: string }): SurfaceFitResult {
	if (input.touchedFiles === undefined) return { fit: "unresolved", outside: [] };
	const outside: string[] = [];
	for (const file of input.touchedFiles) {
		const relative = workspaceRelativeTarget(input.workspaceRoot, file);
		if (declaredPrefixHit(input.declaredPaths, relative) === undefined) outside.push(file);
	}
	return { fit: outside.length === 0 ? "inside" : "outside", outside };
}
