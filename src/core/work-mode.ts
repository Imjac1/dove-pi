import { parse as parseYaml } from "yaml";

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
	| "framework-range-unparseable";

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
}

const MODE_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata"]);
const GOVERNANCE_FIELDS = new Set(["version", "framework", "scope", "authority", "gate", "sandbox", "session", "evidence", "coordination", "stop"]);
const PERMISSION_FIELDS = new Set(["always_allow", "ask_before", "never_allow"]);
const SCOPE_FIELDS = new Set(["targets", "environment", "exclusions", "ownership_evidence"]);
const AUTHORITY_FIELDS = new Set(["grant", "grant_graph", "capabilities", "expires"]);
const GATE_FIELDS = new Set(["semantics", "limits", "intensity", "excluded_techniques", "windows", "approval"]);
const GATE_SEMANTICS = new Set(["limit", "conformance", "both"]);

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

	const permissions = parsePermissions(files.permissions);

	return {
		id: frontmatter.name,
		description: frontmatter.description,
		body,
		governanceVersion: governance.version,
		frameworkRange: governance.framework,
		governance: { ...governance, scope, authority: { ...authority, capabilities }, gate },
		permissions,
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
