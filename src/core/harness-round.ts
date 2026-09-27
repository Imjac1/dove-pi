import { declaredPrefixHit, workspaceRelativeTarget } from "./action-policy.ts";

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
export function surfaceFit(input: { readonly touchedFiles: readonly string[] | undefined; readonly declaredPaths: readonly string[]; readonly workspaceRoot: string }): SurfaceFitResult {
	if (input.touchedFiles === undefined) return { fit: "unresolved", outside: [] };
	const outside: string[] = [];
	for (const file of input.touchedFiles) {
		const relative = workspaceRelativeTarget(input.workspaceRoot, file);
		if (declaredPrefixHit(input.declaredPaths, relative) === undefined) outside.push(file);
	}
	return { fit: outside.length === 0 ? "inside" : "outside", outside };
}
