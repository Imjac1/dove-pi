import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseAuthorityDocument, type AuthorityDocument } from "./authority.ts";
import type { EffectClass } from "./effect-ledger.ts";
import type { LimitSpec } from "./gate-limit.ts";
import type { WorkspaceMode } from "./workspace-policy.ts";

/**
 * The work-mode loader (design section 3.4).
 *
 * A mode is a directory of three files: a portable `MODE.md` whose frontmatter the wider ecosystem
 * already understands, a `governance.yaml` carrying the fields nothing else in that ecosystem has
 * (scope, authority, gate, sandbox, evidence, stop conditions), and a `permissions.yaml` carrying the
 * fail-closed deny list.
 *
 * The validation contract is deliberately stricter than every precedent surveyed, all of which
 * **silently ignore unknown fields**. That means a typo in a security-relevant key fails open and
 * silent, which is the wrong direction for a file whose whole purpose is to constrain an agent. So:
 *
 * - unknown fields are **rejected with a named error**, never ignored;
 * - all three files are **required**;
 * - `scope`, `authority.capabilities` and `gate.semantics` are **required**, because a mode without
 *   an authority boundary is a mode that cannot be reviewed before it runs;
 * - an out-of-range `framework` is **refused**, not partially applied.
 */

export type WorkModeErrorCode =
	| "missing-file"
	| "unparseable"
	| "missing-field"
	| "unknown-field"
	| "invalid-type"
	| "framework-range"
	| "framework-range-unparseable"
	| "authority-unresolved";

export class WorkModeError extends Error {
	public readonly code: WorkModeErrorCode;
	public readonly detail: string;
	constructor(code: WorkModeErrorCode, detail: string) {
		super(`${code}: ${detail}`);
		this.name = "WorkModeError";
		this.code = code;
		this.detail = detail;
	}
}

export interface WorkModeFiles {
	readonly mode: string;
	readonly governance: string;
	readonly permissions: string;
}

export interface PermissionSet {
	readonly always_allow: readonly string[];
	readonly ask_before: readonly string[];
	readonly never_allow: readonly string[];
}

export interface WorkMode {
	readonly id: string;
	readonly description: string;
	readonly body: string;
	readonly governanceVersion: string;
	readonly frameworkRange: string;
	readonly governance: Readonly<Record<string, unknown>>;
	readonly permissions: PermissionSet;
	/**
	 * The numeric thresholds this mode declares, validated at load.
	 *
	 * Typed here rather than left inside `governance`, because a limit that can never decide anything must be a
	 * **load** error naming the mode - not a `LimitSpecError` thrown later by whichever gate happens to be
	 * constructed first. A mode that fails validation refuses to start (design section 5.4).
	 */
	/** Which gate semantics this mode declares. A consumer must not dig into `governance` for it. */
	readonly gateSemantics: "limit" | "conformance" | "both";
	/**
	 * The dotted path into an action's arguments that names the authority target, for a conformance mode.
	 *
	 * Declared rather than inferred, because a host tool call carries a command or a path while an authority
	 * document names targets it defines (`t-web`), and nothing in the call says which of its fields is *the*
	 * target. Absent means the mode's targets cannot be resolved from an action, which the conformance gate
	 * treats as "cannot tell" - a block, never an allow.
	 */
	readonly targetArgument?: string;
	/** The `authority.grant` this mode names: a document path relative to the workspace, or a bare name. */
	readonly authorityGrant?: string;
	readonly limits: readonly LimitSpec[];
	/**
	 * The effect class of each tool the mode names, consumed by the claim at the dispatch line (design 5.1).
	 *
	 * A tool this map does not name is `non-idempotent`: an omission must not silently grant the right to
	 * retry. Declaring `idempotent` or `key-idempotent` is how a mode states that a second run is harmless.
	 */
	readonly effectClasses: Readonly<Record<string, EffectClass>>;
}

const MODE_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata"]);
const GOVERNANCE_FIELDS = new Set(["version", "framework", "scope", "authority", "gate", "effects", "sandbox", "session", "evidence", "coordination", "stop"]);
const PERMISSION_FIELDS = new Set(["always_allow", "ask_before", "never_allow"]);
const SCOPE_FIELDS = new Set(["targets", "environment", "exclusions", "ownership_evidence"]);
const AUTHORITY_FIELDS = new Set(["grant", "grant_graph", "capabilities", "expires"]);
const GATE_FIELDS = new Set(["semantics", "limits", "target_argument", "intensity", "excluded_techniques", "windows", "approval"]);
const GATE_SEMANTICS = new Set(["limit", "conformance", "both"]);
const LIMIT_FIELDS = new Set(["argument", "max", "min", "unit", "required", "tools"]);
const EFFECTS_FIELDS = new Set(["classes"]);
const EFFECT_CLASSES = new Set(["idempotent", "key-idempotent", "non-idempotent"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknown(where: string, value: Record<string, unknown>, allowed: Set<string>): void {
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) {
			throw new WorkModeError("unknown-field", `${where} declares unknown field '${key}'. Known fields: ${[...allowed].join(", ")}.`);
		}
	}
}

function requireRecord(where: string, value: unknown): Record<string, unknown> {
	if (!isRecord(value)) throw new WorkModeError("missing-field", `${where} is required and must be a mapping.`);
	return value;
}

function requireStringArray(where: string, value: unknown): readonly string[] {
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
		throw new WorkModeError("invalid-type", `${where} must be a list of strings.`);
	}
	return value as readonly string[];
}

/** Parse the leading `---` frontmatter block and return it with the remaining body. */
function splitFrontmatter(source: string): { frontmatter: Record<string, unknown>; body: string } {
	const lines = source.split(/\r?\n/);
	if (lines[0]?.trim() !== "---") {
		throw new WorkModeError("missing-field", "MODE.md must open with a '---' frontmatter fence on its first line.");
	}
	const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (end < 0) throw new WorkModeError("unparseable", "MODE.md frontmatter is not closed by a '---' fence.");
	const raw = lines.slice(1, end).join("\n");
	let parsed: unknown;
	try {
		parsed = parseYaml(raw);
	} catch (error) {
		throw new WorkModeError("unparseable", `MODE.md frontmatter is not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!isRecord(parsed)) throw new WorkModeError("invalid-type", "MODE.md frontmatter must be a mapping.");
	return { frontmatter: parsed, body: lines.slice(end + 1).join("\n").trim() };
}

function parseGovernance(source: string): Record<string, unknown> {
	let parsed: unknown;
	try {
		parsed = parseYaml(source);
	} catch (error) {
		throw new WorkModeError("unparseable", `governance.yaml is not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!isRecord(parsed)) throw new WorkModeError("invalid-type", "governance.yaml must be a mapping.");
	return parsed;
}

/**
 * Validate the limits a mode declares.
 *
 * A limit with neither `max` nor `min` is refused **here** rather than at gate construction: it can never
 * decide anything, and the place to say so is the file that declared it, naming the mode rather than the
 * gate that happened to be built first.
 */
function parseLimits(where: string, value: unknown): readonly LimitSpec[] {
	if (value === undefined) return [];
	if (Array.isArray(value)) {
		throw new WorkModeError(
			"invalid-type",
			`${where} must be a mapping keyed by limit id - the shape modes/trading/governance.yaml declares. A list would make the id a field that can disagree with the key naming the same limit.`,
		);
	}
	const declared = requireRecord(where, value);
	return Object.entries(declared).map(([id, entry]) => {
		const at = `${where}.${id}`;
		if (id.trim() === "") {
			throw new WorkModeError("missing-field", `${where} has an empty limit id, and the id is what a block reason and an evidence record name.`);
		}
		const record = requireRecord(at, entry);
		// An inner `id` is rejected as unknown rather than ignored: the key is the identity, and two names for
		// one limit is how they drift apart.
		rejectUnknown(at, record, LIMIT_FIELDS);
		if (typeof record.argument !== "string" || record.argument.trim() === "") {
			throw new WorkModeError("missing-field", `${at}.argument is required: a limit with no argument to read can never decide anything.`);
		}
		for (const bound of ["min", "max"] as const) {
			const raw = record[bound];
			if (raw === undefined) continue;
			if (typeof raw !== "number" || !Number.isFinite(raw)) {
				throw new WorkModeError("invalid-type", `${at}.${bound} must be a finite number, because a limit that cannot compare is a limit that always passes.`);
			}
		}
		if (record.min === undefined && record.max === undefined) {
			throw new WorkModeError("missing-field", `${at} declares neither min nor max, so it can never decide anything. Declare a bound, or remove the limit.`);
		}
		if (record.unit !== undefined && typeof record.unit !== "string") {
			throw new WorkModeError("invalid-type", `${at}.unit must be a string.`);
		}
		if (record.required !== undefined && typeof record.required !== "boolean") {
			throw new WorkModeError("invalid-type", `${at}.required must be a boolean.`);
		}
		const tools = record.tools === undefined ? undefined : requireStringArray(`${at}.tools`, record.tools);
		return {
			id,
			argument: record.argument,
			...(record.max === undefined ? {} : { max: record.max as number }),
			...(record.min === undefined ? {} : { min: record.min as number }),
			...(record.unit === undefined ? {} : { unit: record.unit as string }),
			...(record.required === undefined ? {} : { required: record.required as boolean }),
			...(tools === undefined ? {} : { tools }),
		};
	});
}

/**
 * Validate the declared effect classes (design section 5.1).
 *
 * An unrecognised class is refused by name rather than defaulted, because the default this map exists to
 * avoid is the dangerous one: a class that silently became `idempotent` would hand the retry right to an
 * effect that does not have it.
 */
function parseEffectClasses(where: string, value: unknown): Readonly<Record<string, EffectClass>> {
	if (value === undefined) return {};
	const effects = requireRecord(where, value);
	rejectUnknown(where, effects, EFFECTS_FIELDS);
	if (effects.classes === undefined) return {};
	const classes = requireRecord(`${where}.classes`, effects.classes);
	const result: Record<string, EffectClass> = {};
	for (const [tool, raw] of Object.entries(classes)) {
		if (typeof raw !== "string" || !EFFECT_CLASSES.has(raw)) {
			throw new WorkModeError("invalid-type", `${where}.classes.${tool} must be one of: ${[...EFFECT_CLASSES].join(", ")} (got ${JSON.stringify(raw)}).`);
		}
		result[tool] = raw as EffectClass;
	}
	return result;
}

function parsePermissions(source: string): PermissionSet {
	let parsed: unknown;
	try {
		parsed = parseYaml(source);
	} catch (error) {
		throw new WorkModeError("unparseable", `permissions.yaml is not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
	}
	const record = requireRecord("permissions.yaml", parsed);
	rejectUnknown("permissions.yaml", record, PERMISSION_FIELDS);
	return {
		always_allow: record.always_allow === undefined ? [] : requireStringArray("permissions.always_allow", record.always_allow),
		ask_before: record.ask_before === undefined ? [] : requireStringArray("permissions.ask_before", record.ask_before),
		never_allow: record.never_allow === undefined ? [] : requireStringArray("permissions.never_allow", record.never_allow),
	};
}

// ---------------------------------------------------------------------------------------------
// Framework range
// ---------------------------------------------------------------------------------------------

function compareTriples(left: readonly number[], right: readonly number[]): number {
	for (let index = 0; index < 3; index += 1) {
		const a = left[index] ?? 0;
		const b = right[index] ?? 0;
		if (a !== b) return a < b ? -1 : 1;
	}
	return 0;
}

/**
 * A deliberately narrow version-range check.
 *
 * The schema documents exactly one shape: space-separated `>=X.Y.Z` and `<X.Y.Z` clauses. Anything
 * else is **refused** rather than assumed satisfied - an unparseable range must not silently admit a
 * mode whose behaviour the operator never agreed to.
 */
export function satisfiesFrameworkRange(range: string, version: string): boolean {
	const clause = /^(>=|<)\s*(\d+)\.(\d+)\.(\d+)$/;
	const parsedVersion = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
	if (parsedVersion === null) {
		throw new WorkModeError("framework-range-unparseable", `Running framework version '${version}' is not a numeric X.Y.Z version.`);
	}
	const current = [Number(parsedVersion[1]), Number(parsedVersion[2]), Number(parsedVersion[3])];
	const clauses = range.trim().split(/\s+/).filter(Boolean);
	if (clauses.length === 0) throw new WorkModeError("framework-range-unparseable", "framework range is empty.");
	for (const item of clauses) {
		const match = clause.exec(item);
		if (match === null) {
			throw new WorkModeError("framework-range-unparseable", `framework range clause '${item}' is not of the form '>=X.Y.Z' or '<X.Y.Z'.`);
		}
		const bound = [Number(match[2]), Number(match[3]), Number(match[4])];
		const comparison = compareTriples(current, bound);
		if (match[1] === ">=" && comparison < 0) return false;
		if (match[1] === "<" && comparison >= 0) return false;
	}
	return true;
}

// ---------------------------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------------------------

export interface LoadWorkModeOptions {
	readonly frameworkVersion: string;
}

export function loadWorkMode(files: WorkModeFiles, options: LoadWorkModeOptions): WorkMode {
	const { frontmatter, body } = splitFrontmatter(files.mode);
	rejectUnknown("MODE.md frontmatter", frontmatter, MODE_FIELDS);
	if (typeof frontmatter.name !== "string" || frontmatter.name.trim() === "") {
		throw new WorkModeError("missing-field", "MODE.md frontmatter requires a non-empty 'name'.");
	}
	if (typeof frontmatter.description !== "string" || frontmatter.description.trim() === "") {
		throw new WorkModeError("missing-field", "MODE.md frontmatter requires a non-empty 'description'.");
	}

	const governance = parseGovernance(files.governance);
	rejectUnknown("governance.yaml", governance, GOVERNANCE_FIELDS);

	if (typeof governance.version !== "string") throw new WorkModeError("missing-field", "governance.version is required and must be a string.");
	if (typeof governance.framework !== "string") throw new WorkModeError("missing-field", "governance.framework is required and must be a version range string.");
	if (!satisfiesFrameworkRange(governance.framework, options.frameworkVersion)) {
		throw new WorkModeError(
			"framework-range",
			`Mode '${frontmatter.name}' targets framework range '${governance.framework}', which excludes the running version ${options.frameworkVersion}.`,
		);
	}

	const scope = requireRecord("governance.scope", governance.scope);
	rejectUnknown("governance.scope", scope, SCOPE_FIELDS);

	const authority = requireRecord("governance.authority", governance.authority);
	rejectUnknown("governance.authority", authority, AUTHORITY_FIELDS);
	if (authority.capabilities === undefined) {
		throw new WorkModeError("missing-field", "governance.authority.capabilities is required: a mode that cannot declare its authority cannot be reviewed before it runs.");
	}
	const capabilities = requireStringArray("governance.authority.capabilities", authority.capabilities);

	const gate = requireRecord("governance.gate", governance.gate);
	rejectUnknown("governance.gate", gate, GATE_FIELDS);
	if (typeof gate.semantics !== "string" || !GATE_SEMANTICS.has(gate.semantics)) {
		throw new WorkModeError("missing-field", `governance.gate.semantics is required and must be one of: ${[...GATE_SEMANTICS].join(", ")}.`);
	}

	const targetArgument = gate.target_argument;
	if (targetArgument !== undefined && (typeof targetArgument !== "string" || targetArgument.trim() === "")) {
		throw new WorkModeError("invalid-type", "governance.gate.target_argument must be a non-empty dotted path when declared.");
	}
	const grant = authority.grant;
	if (grant !== undefined && (typeof grant !== "string" || grant.trim() === "")) {
		throw new WorkModeError("invalid-type", "governance.authority.grant must be a non-empty string when declared.");
	}

	const permissions = parsePermissions(files.permissions);
	const limits = parseLimits("governance.gate.limits", gate.limits);
	const effectClasses = parseEffectClasses("governance.effects", governance.effects);

	return {
		id: frontmatter.name,
		description: frontmatter.description,
		body,
		governanceVersion: governance.version,
		frameworkRange: governance.framework,
		governance: { ...governance, scope, authority: { ...authority, capabilities }, gate },
		gateSemantics: gate.semantics as "limit" | "conformance" | "both",
		...(targetArgument === undefined ? {} : { targetArgument: targetArgument as string }),
		...(grant === undefined ? {} : { authorityGrant: grant as string }),
		permissions,
		limits,
		effectClasses,
	};
}

/**
 * Permission precedence. `never_allow` wins over `always_allow`, over `ask_before`, and over any mode
 * setting - a deny list that a mode can override is not a deny list.
 */
export function evaluatePermission(permissions: PermissionSet, tool: string): "allow" | "ask" | "deny" {
	const matches = (list: readonly string[]): boolean =>
		list.some((entry) => (entry === tool ? true : entry.endsWith("*") && tool.startsWith(entry.slice(0, -1))));
	if (matches(permissions.never_allow)) return "deny";
	if (matches(permissions.ask_before)) return "ask";
	if (matches(permissions.always_allow)) return "allow";
	return "ask";
}

// ---------------------------------------------------------------------------------------------
// Selection: which mode the host should load, and whether anything is declared at all
// ---------------------------------------------------------------------------------------------

/** The project-level declaration. Optional, one concern per file, mirroring `.dove/workspace.json`. */
export const WORK_MODE_DECLARATION = join(".dove", "mode.json");

export type WorkModeSelectionSource = "none" | "declared" | "workspace-pentest" | "override";

export interface WorkModeSelection {
	readonly workspaceRoot: string;
	readonly path: string;
	/** The mode directory name to load, or `undefined` when nothing is selected. */
	readonly name: string | undefined;
	readonly source: WorkModeSelectionSource;
	/**
	 * A declaration exists and could not be read.
	 *
	 * This is **not** the same fact as "nothing is declared", and the two must not be collapsed: a malformed
	 * declaration that degrades to `none` would run the agent with no mode-scoped controls while the project
	 * believed it had declared them. {@link workModeRefusal} is the single rule that tells them apart.
	 */
	readonly malformed: boolean;
}

/** A mode name is a directory name: no separators, no traversal, no surprises. */
const WORK_MODE_NAME = /^[a-z0-9][a-z0-9-]*$/;

export function workModeDeclarationPath(workspaceRoot: string): string {
	return join(resolve(workspaceRoot), WORK_MODE_DECLARATION);
}

/**
 * Resolve the mode selection.
 *
 * Precedence, highest first: an explicit override (a CLI flag), the project's declaration, and then **one
 * implication** - a `pentest` workspace mode selects `modes/pentest`, because authorized security testing is
 * what that workspace mode means and the rules-of-engagement gate is part of it rather than an extra step.
 * Nothing else is implied: `development` is ordinary work and selects no mode, which is why it is not
 * written as a default here.
 */
export function resolveWorkModeSelection(options: { readonly workspaceRoot: string; readonly override?: unknown; readonly workspaceMode?: WorkspaceMode }): WorkModeSelection {
	const workspaceRoot = resolve(options.workspaceRoot);
	const path = workModeDeclarationPath(workspaceRoot);

	if (options.override !== undefined) {
		if (typeof options.override === "string" && WORK_MODE_NAME.test(options.override)) {
			return { workspaceRoot, path, name: options.override, source: "override", malformed: false };
		}
		return { workspaceRoot, path, name: undefined, source: "override", malformed: true };
	}

	if (existsSync(path)) {
		try {
			const value = JSON.parse(readFileSync(path, "utf8")) as { schemaVersion?: unknown; mode?: unknown };
			if (value.schemaVersion === 1 && typeof value.mode === "string" && WORK_MODE_NAME.test(value.mode)) {
				return { workspaceRoot, path, name: value.mode, source: "declared", malformed: false };
			}
			return { workspaceRoot, path, name: undefined, source: "declared", malformed: true };
		} catch {
			return { workspaceRoot, path, name: undefined, source: "declared", malformed: true };
		}
	}

	if (options.workspaceMode === "pentest") {
		return { workspaceRoot, path, name: "pentest", source: "workspace-pentest", malformed: false };
	}

	return { workspaceRoot, path, name: undefined, source: "none", malformed: false };
}

/**
 * The one rule that decides whether a selection (or a load failure) stops the run, used by the host and by the
 * tests so that the two cannot disagree about it.
 *
 * Returns a reason when the run must not proceed, and `undefined` when it may.
 */
export function workModeRefusal(selection: WorkModeSelection, failure?: WorkModeError | Error): string | undefined {
	if (failure !== undefined) {
		return `Work mode '${selection.name ?? "?"}' could not be loaded: ${failure instanceof Error ? failure.message : String(failure)}. A mode that fails validation refuses to start rather than starting unconstrained.`;
	}
	if (selection.malformed) {
		return `The work-mode declaration at '${selection.path}' exists but could not be read. This is not "no mode declared": a project that declares a mode and gets none would run without the controls it asked for. Fix the declaration, or remove it to run with no mode.`;
	}
	return undefined;
}

// ---------------------------------------------------------------------------------------------
// Loading from a directory: the three files a mode is made of
// ---------------------------------------------------------------------------------------------

export function workModeDirectory(root: string, name: string): string {
	if (!WORK_MODE_NAME.test(name)) {
		throw new WorkModeError("missing-file", `Refusing mode name '${name}': a mode name is a single directory name under modes/.`);
	}
	return join(resolve(root), "modes", name);
}

/**
 * Read the three files. **A missing file is an error, never an empty string**: an absent `permissions.yaml`
 * defaulting to empty would be a mode with no deny list, which is the one thing it must never be.
 */
export function readWorkModeFiles(directory: string): WorkModeFiles {
	const read = (file: string): string => {
		const path = join(directory, file);
		try {
			return readFileSync(path, "utf8");
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			throw new WorkModeError("missing-file", `mode file '${path}' could not be read: ${detail}. A mode is three files, and a missing one must not become an empty default.`);
		}
	};
	return { mode: read("MODE.md"), governance: read("governance.yaml"), permissions: read("permissions.yaml") };
}

export interface LoadedWorkMode {
	readonly mode: WorkMode;
	/** The document a conformance mode is checked against. Absent when the mode declares no conformance. */
	readonly authorityDocument?: AuthorityDocument;
}

/**
 * Load a mode by name from `<root>/modes/<name>/`, resolving the grant document a conformance mode needs.
 *
 * **This is the only supported way to load a mode for a host**, and it is why the authority document is
 * resolved here rather than by the file-level loader: resolution needs a workspace root, and a conformance
 * mode that cannot resolve its document must refuse to load rather than start gated by nothing.
 */
export function loadWorkModeFromDirectory(root: string, name: string, options: LoadWorkModeOptions): LoadedWorkMode {
	const workspaceRoot = resolve(root);
	const mode = loadWorkMode(readWorkModeFiles(workModeDirectory(workspaceRoot, name)), options);
	if (mode.gateSemantics === "limit") return { mode };

	const grant = mode.authorityGrant;
	if (grant === undefined) {
		throw new WorkModeError(
			"authority-unresolved",
			`Mode '${mode.id}' declares gate.semantics '${mode.gateSemantics}' and names no 'authority.grant', so there is nothing an action could be checked against. Declare the grant document, or declare gate.semantics: limit if this mode has no external grantor.`,
		);
	}
	const path = resolve(workspaceRoot, grant);
	if (!existsSync(path)) {
		throw new WorkModeError(
			"authority-unresolved",
			`Mode '${mode.id}' declares gate.semantics '${mode.gateSemantics}' but its grant '${grant}' is not a document at '${path}'. A conformance mode with no document would run gated by nothing while declaring that it is gated. Point 'authority.grant' at a grant document, or declare gate.semantics: limit.`,
		);
	}
	let source: string;
	try {
		source = readFileSync(path, "utf8");
	} catch (error) {
		throw new WorkModeError("authority-unresolved", `Mode '${mode.id}': grant document '${path}' could not be read: ${error instanceof Error ? error.message : String(error)}.`);
	}
	try {
		return { mode, authorityDocument: parseAuthorityDocument(source, path) };
	} catch (error) {
		throw new WorkModeError("authority-unresolved", `Mode '${mode.id}': ${error instanceof Error ? error.message : String(error)}`);
	}
}

