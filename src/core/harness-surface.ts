import { parse as parseYaml } from "yaml";
import { CHANGE_SURFACES, type ChangeSurface } from "./task-convergence.ts";

/**
 * **The declared editable surface: AHE's component observability, in the form this repository can check.**
 *
 * The requirement (`2604.25850` §3.3) is that "every editable harness component [has] a **file-level
 * representation** so the action space is **explicit and revertible**". The components *are* files here; what was
 * missing is the map that binds each of the seven names to the paths that belong to it, and the check that those
 * paths exist.
 *
 * **Why the map is validated rather than trusted.** A declaration whose entries do not resolve names an action space
 * that is not there - the same defect as a policy field nothing reads, one layer out. So an entry that matches
 * nothing is refused, and the refusals here are about shape while the resolution is the caller's (it has the
 * filesystem; this module does not, which is what keeps it testable).
 */

export type HarnessSurfaceErrorCode = "unparseable" | "invalid-type" | "unknown-field" | "unknown-component" | "empty";

export class HarnessSurfaceError extends Error {
	public readonly code: HarnessSurfaceErrorCode;
	public constructor(code: HarnessSurfaceErrorCode, detail: string) {
		super(detail);
		this.name = "HarnessSurfaceError";
		this.code = code;
	}
}

export interface HarnessComponent {
	readonly name: ChangeSurface;
	readonly paths: readonly string[];
}

export interface HarnessSurface {
	readonly version: 1;
	readonly components: readonly HarnessComponent[];
	/**
	 * Which suites verify each component: **the passing behaviours a fix must not regress.**
	 *
	 * Self-Harness requires a failure record to carry them, and this is where the harness states them, per component. A
	 * component with no entry means nobody has stated what verifies it - a fact about what we know, not a gap to fill
	 * with something plausible.
	 */
	readonly verifiedBy: Readonly<Partial<Record<ChangeSurface, readonly string[]>>>;
	/**
	 * **The verifier, declared in two parts.** A change that edits the verifier is not a loop turn, and which edits those are
	 * was a reader judgment until this existed.
	 *
	 * `paths` are the files that are verifier code; `embedded` are files that contain it and are otherwise harness, named
	 * with the symbols inside them because that code cannot be declared as a path until it is extracted.
	 */
	readonly verifier: HarnessVerifier;
}

export interface HarnessVerifier {
	readonly paths: readonly string[];
	readonly embedded: readonly { readonly path: string; readonly symbols: readonly string[] }[];
}

const SURFACE_FIELDS = new Set(["version", "components", "verifiedBy", "verifier"]);
const VERIFIER_FIELDS = new Set(["paths", "embedded"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse a surface declaration, or refuse it by naming the entry at fault.
 *
 * The component vocabulary is **not** restated here: it is `CHANGE_SURFACES`, so a component cannot be added to the
 * map and forgotten in the record's own vocabulary (or the reverse), which is the drift this repository has already
 * paid for once.
 */
export function parseHarnessSurface(text: string): HarnessSurface {
	let parsed: unknown;
	try {
		parsed = parseYaml(text);
	} catch (error) {
		throw new HarnessSurfaceError("unparseable", `the harness surface is not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!isRecord(parsed)) throw new HarnessSurfaceError("invalid-type", "the harness surface must be a mapping with 'version' and 'components'.");
	for (const key of Object.keys(parsed)) {
		if (!SURFACE_FIELDS.has(key)) throw new HarnessSurfaceError("unknown-field", `the harness surface declares an unknown field '${key}'. Known fields: ${[...SURFACE_FIELDS].join(", ")}.`);
	}
	if (parsed.version !== 1) throw new HarnessSurfaceError("invalid-type", `the harness surface must declare version: 1 (got ${JSON.stringify(parsed.version)}).`);
	const components = parsed.components;
	if (!isRecord(components)) throw new HarnessSurfaceError("invalid-type", "the harness surface must declare 'components' as a mapping of component name to paths.");
	const names = Object.keys(components);
	if (names.length === 0) throw new HarnessSurfaceError("empty", "the harness surface declares no components: a map with nothing on it is not a declaration.");
	const surface: HarnessComponent[] = [];
	for (const name of names) {
		if (!CHANGE_SURFACES.has(name as ChangeSurface)) {
			throw new HarnessSurfaceError("unknown-component", `'${name}' is not an editable harness component. The components are: ${[...CHANGE_SURFACES].join(", ")}.`);
		}
		const raw = components[name];
		if (!Array.isArray(raw) || raw.length === 0) throw new HarnessSurfaceError("empty", `'${name}' declares no paths, so nothing about the harness belongs to it. Declare the workspace-relative paths of this component, or remove the component.`);
		const paths = raw.map((entry, index) => {
			if (typeof entry !== "string" || entry.trim() === "") throw new HarnessSurfaceError("invalid-type", `'${name}' path ${index + 1} must be a non-empty workspace-relative path.`);
			const value = entry.trim();
			if (value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value)) throw new HarnessSurfaceError("invalid-type", `'${name}' path '${value}' is absolute; the surface is declared relative to the workspace.`);
			if (value.split(/[\\/]+/u).includes("..")) throw new HarnessSurfaceError("invalid-type", `'${name}' path '${value}' escapes the workspace.`);
			return value.replace(/\\/gu, "/").replace(/\/+$/u, "");
		});
		surface.push({ name: name as ChangeSurface, paths });
	}
	const rawVerifiedBy = parsed.verifiedBy;
	const verifiedBy: Partial<Record<ChangeSurface, readonly string[]>> = {};
	if (rawVerifiedBy !== undefined) {
		if (!isRecord(rawVerifiedBy)) throw new HarnessSurfaceError("invalid-type", "verifiedBy must be a mapping of component name to test paths, or absent.");
		for (const [name, raw] of Object.entries(rawVerifiedBy)) {
			if (!CHANGE_SURFACES.has(name as ChangeSurface)) {
				throw new HarnessSurfaceError("unknown-component", "verifiedBy names " + name + ", which is not an editable harness component. The components are: " + [...CHANGE_SURFACES].join(", ") + ".");
			}
			if (!Array.isArray(raw) || raw.length === 0) {
				throw new HarnessSurfaceError("empty", "verifiedBy declares no suites for " + name + ", so nothing verifies it. Remove the entry if nobody has stated what does.");
			}
			verifiedBy[name as ChangeSurface] = raw.map((entry, index) => {
				if (typeof entry !== "string" || entry.trim() === "") throw new HarnessSurfaceError("invalid-type", "verifiedBy " + name + " entry " + String(index + 1) + " must be a non-empty workspace-relative path.");
				return entry.trim().replace(/\\/gu, "/").replace(/\/+$/u, "");
			});
		}
	}
	const rawVerifier = parsed.verifier;
	const verifier: { paths: string[]; embedded: { path: string; symbols: string[] }[] } = { paths: [], embedded: [] };
	if (rawVerifier !== undefined) {
		if (!isRecord(rawVerifier)) throw new HarnessSurfaceError("invalid-type", "verifier must be a mapping with 'paths' and 'embedded'.");
		for (const key of Object.keys(rawVerifier)) {
			if (!VERIFIER_FIELDS.has(key)) throw new HarnessSurfaceError("unknown-field", "the verifier block declares an unknown field " + key + ". Known fields: " + [...VERIFIER_FIELDS].join(", ") + ".");
		}
		const rawPaths = rawVerifier.paths;
		if (rawPaths !== undefined) {
			if (!Array.isArray(rawPaths) || rawPaths.length === 0) throw new HarnessSurfaceError("empty", "verifier.paths is declared but empty: a verifier with no paths is not a declaration.");
			verifier.paths = rawPaths.map((entry, index) => {
				if (typeof entry !== "string" || entry.trim() === "") throw new HarnessSurfaceError("invalid-type", "verifier.paths entry " + String(index + 1) + " must be a non-empty workspace-relative path.");
				return entry.trim().replace(/\\/gu, "/").replace(/\/+$/u, "");
			});
		}
		const rawEmbedded = rawVerifier.embedded;
		if (rawEmbedded !== undefined) {
			if (!Array.isArray(rawEmbedded) || rawEmbedded.length === 0) throw new HarnessSurfaceError("empty", "verifier.embedded is declared but empty: remove it if the verifier is fully separable.");
			verifier.embedded = rawEmbedded.map((entry, index) => {
				if (!isRecord(entry)) throw new HarnessSurfaceError("invalid-type", "verifier.embedded entry " + String(index + 1) + " must be a mapping with 'path' and 'symbols'.");
				const pathValue = typeof entry.path === "string" ? entry.path.trim() : "";
				if (pathValue === "") throw new HarnessSurfaceError("invalid-type", "verifier.embedded entry " + String(index + 1) + " must name a path.");
				const rawSymbols = entry.symbols;
				if (!Array.isArray(rawSymbols) || rawSymbols.length === 0) throw new HarnessSurfaceError("empty", "verifier.embedded " + pathValue + " names no symbols, so nothing says what inside it is verifier code. Remove the entry if nothing is.");
				const symbols = rawSymbols.map((symbol, symbolIndex) => {
					if (typeof symbol !== "string" || symbol.trim() === "") throw new HarnessSurfaceError("invalid-type", "verifier.embedded " + pathValue + " symbol " + String(symbolIndex + 1) + " must be a non-empty name.");
					return symbol.trim();
				});
				return { path: pathValue.replace(/\\/gu, "/").replace(/\/+$/u, ""), symbols };
			});
		}
	}
	return { version: 1, components: surface, verifiedBy, verifier };
}

/**
 * The entries that resolve to nothing, given the caller's own existence check.
 *
 * Each is returned as `component:path` so a refusal names the entry rather than the file, and the predicate is
 * injected rather than imported so this module stays pure: the adapter passes the filesystem, the test passes a set,
 * and both exercise **one** rule.
 */
export function unresolvedSurfaceEntries(surface: HarnessSurface, exists: (relativePath: string) => boolean): readonly string[] {
	const unresolved: string[] = [];
	for (const component of surface.components) {
		for (const path of component.paths) {
			if (!exists(path)) unresolved.push(component.name + ":" + path);
		}
	}
	// The same rule for the suites: a list of tests that do not exist verifies nothing. Named with the mapping it came
	// from, so a reader knows which of the two relations is broken.
	for (const [name, paths] of Object.entries(surface.verifiedBy)) {
		for (const path of paths) {
			if (!exists(path)) unresolved.push("verifiedBy:" + name + ":" + path);
		}
	}
	// The verifier too: a declared verifier path that does not exist is a boundary drawn around nothing.
	for (const path of surface.verifier.paths) {
		if (!exists(path)) unresolved.push("verifier:" + path);
	}
	for (const entry of surface.verifier.embedded) {
		if (!exists(entry.path)) unresolved.push("verifier.embedded:" + entry.path);
	}
	return unresolved;
}
