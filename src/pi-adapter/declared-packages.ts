import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * A package `settings.json` declares that none of the stores this runtime can name has.
 *
 * **This is the fact the extension used to get wrong.** Its warning about the missing hashline family said the current
 * Pi host does not provide those tools, and the measurement on 2026-10-05 corrected it: the host provides them, and what
 * was missing was the agent directory's package store - the declaration travels in `settings.json`, the package does
 * not. A message that names the declaration it can see is unsatisfied is a message a reader can act on; one that blames
 * the host is not.
 */
export interface MissingDeclaredPackage {
	/** The declaration as written, e.g. `npm:pi-hashline-edit-pro@2.7.0`. */
	readonly declaration: string;
	/** The name the store would hold it under, e.g. `pi-hashline-edit-pro`. */
	readonly name: string;
}

export interface DeclaredPackageReport {
	/** Every store that was searched, in the order it was searched, for the message to name. */
	readonly checkedStores: readonly string[];
	readonly missing: readonly MissingDeclaredPackage[];
}

/**
 * The stores to search, and **the reason this list is a union rather than one path.**
 *
 * The host resolves an `npm:` declaration from more than one place: the managed store under the agent directory, the
 * project store under the project, and - for a user-scope declaration whose managed path does not exist - a legacy
 * global store (`PackageManager`: `getManagedNpmInstallPath`, `getLegacyGlobalNpmInstallPath`, and `getNpmInstallPath`
 * choosing between them). Its own resolver is **private**, so this module cannot ask where a given declaration resolved.
 * Measured 2026-10-14 on the machine that wrote this: a first version searched only the managed store, and would have
 * told a person their declaration had nothing behind it while the package sat in the global root, which exists and is
 * not empty. That is the failure this whole message exists to remove, so the list is a union and the message reports
 * **what was searched** rather than asserting the package is absent everywhere.
 *
 * `SettingsManager.getPackages()` cannot narrow this down either: it returns the user and project declarations **merged**,
 * and `PackageSource` carries no scope field, so a declaration cannot be attributed to one store.
 */
export function npmStoreCandidates(agentDir: string, cwd: string): readonly string[] {
	const stores = [
		// The managed user-scope store, which is the one a run's own agent directory is given.
		join(agentDir, "npm", "node_modules"),
		// The project-scope store, which the host reads when the project is trusted.
		join(cwd, ".pi", "npm", "node_modules"),
	];
	const legacy = legacyGlobalStore();
	if (legacy !== undefined) stores.push(legacy);
	return stores;
}

/**
 * The legacy global store, from what the environment says without running anything.
 *
 * The host reads this by asking npm (`getGlobalNpmRoot`), which is a subprocess this warning is not worth. A configured
 * prefix is what npm itself would use; `%APPDATA%\npm\node_modules` is where Windows puts a global install when no
 * prefix was set. Both are **widenings**: a package found in either stops the warning, and a store the host would also
 * have searched but this function cannot name simply means the message says less, never something false.
 */
function legacyGlobalStore(): string | undefined {
	const prefix = process.env.npm_config_prefix ?? process.env.NPM_CONFIG_PREFIX;
	if (prefix !== undefined && prefix.length > 0) return join(prefix, "node_modules");
	const appData = process.env.APPDATA;
	return appData !== undefined && appData.length > 0 ? join(appData, "npm", "node_modules") : undefined;
}

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
 * The declared packages that none of {@link npmStoreCandidates} has.
 *
 * An empty `missing` means the declaration and the stores that could be searched agree, which is also what an agent
 * directory with no declarations reports - so a caller must not read it as *everything you might have declared is
 * installed*.
 */
export function declaredPackagesMissingFromStore(
	agentDir: string,
	cwd: string,
	packages: readonly (string | { source?: string })[],
): DeclaredPackageReport {
	const checkedStores = npmStoreCandidates(agentDir, cwd);
	const missing: MissingDeclaredPackage[] = [];
	for (const entry of packages) {
		const declaration = typeof entry === "string" ? entry : entry?.source;
		if (typeof declaration !== "string") continue;
		const name = npmPackageNameOf(declaration);
		if (name === undefined) continue;
		// A scoped name is two path segments; `join` handles both that and a plain name.
		const segments = name.split("/");
		if (!checkedStores.some((store) => existsSync(join(store, ...segments)))) missing.push({ declaration, name });
	}
	return { checkedStores, missing };
}
