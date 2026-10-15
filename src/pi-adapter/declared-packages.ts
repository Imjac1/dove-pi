import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * A package `settings.json` declares with nothing behind it in the store Pi resolves from.
 *
 * **This is the fact the extension used to get wrong.** Its warning about the missing hashline family said the current
 * Pi host does not provide those tools, and the measurement on 2026-10-05 corrected it: the host provides them, and what
 * was missing was the agent directory's package store - the declaration travels in `settings.json`, the package does
 * not, so a session whose agent directory holds a declaration and no store loads none of them. A message that names the
 * declaration it can see is unsatisfied is a message a reader can act on; one that blames the host is not.
 */
export interface MissingDeclaredPackage {
	/** The declaration as written, e.g. `npm:pi-hashline-edit-pro@2.7.0`. */
	readonly declaration: string;
	/** The name the store would hold it under, e.g. `pi-hashline-edit-pro`. */
	readonly name: string;
}

/**
 * Where an `npm:` declaration is resolved from, relative to the agent directory.
 *
 * **Measured, not read from an API.** The host keeps its own npm root private (`PackageManager` has a private
 * `globalNpmRoot` and no exported accessor), so this path was taken from an installed tree on 2026-10-14: the agent
 * directory holds `npm/node_modules/`, with both plain (`pi-open-tui`) and scoped (`@juicesharp/...`) package
 * directories in it. If a host release moves it, the symptom is this function reporting nothing missing - which is why
 * the message names the store it looked in rather than asserting the package is absent from every store there is.
 */
export const NPM_STORE_FROM_AGENT_DIR = join("npm", "node_modules");

/**
 * The package name a declaration names, or `undefined` for a declaration that is not ours to resolve.
 *
 * The specifier forms are the host's own: `npm:<name>`, `npm:<name>@<version>`, `npm:@<scope>/<name>@<version>`. A path
 * or a git URL is left alone - this runtime has no way to check those, and reporting them as missing would be a guess
 * wearing the shape of a measurement.
 */
export function npmPackageNameOf(declaration: string): string | undefined {
	if (!declaration.startsWith("npm:")) return undefined;
	const specifier = declaration.slice("npm:".length);
	// The version separator is the **last** `@`, because a scoped name starts with one: `@scope/name@1.2.3`.
	const separator = specifier.lastIndexOf("@");
	const name = separator > 0 ? specifier.slice(0, separator) : specifier;
	return name.length > 0 ? name : undefined;
}

/**
 * The declared packages the store does not have.
 *
 * Empty means the declarations and the store agree, which is also what an agent directory with no declarations
 * reports - so a caller must not read an empty result as *the store has everything you might have declared*.
 */
export function declaredPackagesMissingFromStore(
	agentDir: string,
	packages: readonly (string | { source?: string })[],
): readonly MissingDeclaredPackage[] {
	const store = join(agentDir, NPM_STORE_FROM_AGENT_DIR);
	const missing: MissingDeclaredPackage[] = [];
	for (const entry of packages) {
		const declaration = typeof entry === "string" ? entry : entry?.source;
		if (typeof declaration !== "string") continue;
		const name = npmPackageNameOf(declaration);
		if (name === undefined) continue;
		// A scoped name is two path segments; `join` handles both that and a plain name.
		if (!existsSync(join(store, ...name.split("/")))) missing.push({ declaration, name });
	}
	return missing;
}
