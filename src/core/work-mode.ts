import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { WITNESSED_TECHNIQUES } from "./argument-syntax.ts";
import { readDeclaration } from "./declaration-read.ts";
import { LOOP_STOP_KINDS } from "./loop.ts";
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

/**
 * A mode's permission list, and the one thing it must state: what an action on none of the three lists gets.
 *
 * `unlisted` is **required** rather than defaulted, because a default here is a policy nobody chose. Every one of
 * the eleven systems the frontier study reads takes a position on this question and takes it *per mode* - Gemini
 * CLI's PLAN/DEFAULT/AUTO_EDIT/YOLO, Mistral Vibe's SAFE/NEUTRAL/DESTRUCTIVE/YOLO, Codex's collaboration modes -
 * so the stance belongs in the mode file where a reviewer can read it.
 *
 * `always_allow` is the list that answers `unlisted: ask` for named actions. With `unlisted: allow` it could
 * only restate the default, so the loader refuses that combination rather than accepting a list that decides nothing.
 */
export interface PermissionSet {
	readonly unlisted: "allow" | "ask";
	readonly always_allow: readonly string[];
	readonly ask_before: readonly string[];
	readonly never_allow: readonly string[];
}

export interface WorkMode {
	readonly id: string;
	readonly description: string;
	readonly body: string;
	/**
	 * The directory name this mode was loaded from, when a host loaded it by name.
	 *
	 * **Carried because a consumer that shows the body has to be able to cite it.** `id` is the frontmatter's display name
	 * and need not equal the directory, so `modes/<id>/MODE.md` is a path that can fail to exist - and a citation that can
	 * be false is the defect this repository keeps finding in its own declarations. Absent means the mode was built from
	 * file contents alone (`loadWorkMode`), and then no path is named rather than a guessed one.
	 */
	readonly source?: string;
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
	readonly gateSemantics: "none" | "limit" | "conformance" | "both";
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
	/**
	 * Targets this mode must not touch, from `scope.exclusions`.
	 *
	 * A mode that names something it excludes is making a claim about what it will not do, so the claim is read and
	 * enforced at the boundary rather than validated for shape and forgotten: an exclusion that cannot refuse the
	 * thing it names is the defect this field was carrying.
	 */
	readonly scopeExclusions?: readonly string[];
	/**
	 * The turn budget this mode declares, from `session.budget.turns`.
	 *
	 * Carried because it is the **one** field of that block the runtime can honour: there is a turn bound in the
	 * reference loop, and the host passes this number to it. The rest of the block is refused, and `turns` was refused
	 * with it until this field existed - a number nothing reads is not a budget.
	 */
	readonly sessionTurns?: number;
	/**
	 * The capabilities this mode grants the agent, from `authority.capabilities`.
	 *
	 * Typed and exposed rather than left in `governance`, because a capability scoping check is only worth having if
	 * the ceiling comes from **trusted input read before untrusted content**: a scope assembled by a caller that has
	 * already read a repository has been influenced by it (design section 4.3).
	 */
	readonly capabilities: readonly string[];
	readonly limits: readonly LimitSpec[];
	/**
	 * The techniques this mode forbids outright, from `gate.excluded_techniques`.
	 *
	 * Enforced here in addition to any authority document, because a technique can be named on a call that no
	 * document constrains - a mode is the one place the operator can forbid something without depending on a
	 * third party having written it down.
	 */
	readonly excludedTechniques?: readonly string[];
	/**
	 * The isolation policy this mode declares, from the `governance.sandbox` block.
	 *
	 * **Carrying it is not enforcing it.** What the host does with this is the decision D1 turns on: refuse to run
	 * under an isolation it cannot provide (fail-honest, and the reason the shape is validated here), enforce what is
	 * enforceable at its tool boundary, or record that the block was deleted. A mode file that claims
	 * `isolation: container` while the run is unconfined is the claim the host's own documentation warns against.
	 */
	readonly sandbox?: {
		readonly isolation?: "none" | "container" | "worktree";
		readonly network?: "none" | "allowlist" | "unrestricted";
		readonly filesystem?: "unrestricted" | "ephemeral" | "read-only-source";
	};
	/**
	 * The workspace paths this mode protects from being written, from the `governance.fence` block.
	 *
	 * **What it is for.** A mode that declares a fence names the part of the workspace that constitutes the
	 * harness's own control surface - its policy, its verifier, its ledger - and the tool boundary refuses writes
	 * into it. That is the precondition for an agent editing its own harness at all: the thing that decides
	 * whether an edit was good has to be out of reach of the edit.
	 *
	 * **`shell` is required and is not defaulted.** The host's shell classifier (`pi-adapter/extension.ts`) reads
	 * command names and never paths, so a fence cannot see through `bash`. A mode must therefore state which route
	 * it took: `denied` closes it, `uncovered` declares it open. Both are honest; a default would be a policy
	 * nobody chose, which is the rule `permissions.unlisted` already follows.
	 *
	 * **A path is a prefix, not a glob.** It matches a file exactly and a directory's whole subtree; a trailing
	 * `/*` or `/**` is accepted and stripped ({@link normalizeFencePath}). `targets` extends
	 * {@link FENCE_TARGETS} with the tools this repository cannot read a schema for.
	 */
	readonly fence?: {
		readonly paths: readonly string[];
		readonly shell: "denied" | "uncovered";
		readonly targets?: Readonly<Record<string, string>>;
	};
	/**
	 * How many actions this mode permits per phase, from `gate.intensity`, e.g. `{ discovery: 2 }`.
	 *
	 * A **ceiling on a count**, not a threshold on an argument: a limit says an order may not exceed a notional,
	 * and this says a phase may not exceed a number of actions. The two fail differently, which is why this is not
	 * a `limits` entry.
	 */
	readonly intensityCeilings?: Readonly<Record<string, number>>;
	/**
	 * The effect class of each tool the mode names, consumed by the claim at the dispatch line (design 5.1).
	 *
	 * A tool this map does not name is `non-idempotent`: an omission must not silently grant the right to
	 * retry. Declaring `idempotent` or `key-idempotent` is how a mode states that a second run is harmless.
	 */
	readonly effectClasses: Readonly<Record<string, EffectClass>>;
}

const MODE_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata"]);
const GOVERNANCE_FIELDS = new Set(["version", "framework", "scope", "authority", "gate", "effects", "sandbox", "fence", "session", "evidence", "coordination", "stop"]);
const PERMISSION_FIELDS = new Set(["unlisted", "always_allow", "ask_before", "never_allow"]);
const UNLISTED_STANCES = new Set(["allow", "ask"]);
const SCOPE_FIELDS = new Set(["targets", "environment", "exclusions", "ownership_evidence"]);
const AUTHORITY_FIELDS = new Set(["grant", "grant_graph", "capabilities", "expires"]);
// `windows` is deliberately absent: a mode that declares one is refused with an explanation rather than an
// unknown-field error, because the reason it is refused is the design point (see parseMode).
const GATE_FIELDS = new Set(["semantics", "limits", "target_argument", "intensity", "excluded_techniques", "approval"]);
const GATE_SEMANTICS = new Set(["none", "limit", "conformance", "both"]);
const LIMIT_FIELDS = new Set(["argument", "max", "min", "unit", "required", "tools"]);
const EFFECTS_FIELDS = new Set(["classes"]);
const EFFECT_CLASSES = new Set(["idempotent", "key-idempotent", "non-idempotent"]);
const SANDBOX_FIELDS = new Set(["isolation", "network", "filesystem"]);
/**
 * The values each sandbox axis accepts.
 *
 * **Exported because the claim table below is checked against it.** A value added to an axis and not classified there would
 * be a claim this runtime cannot say anything about, which is the shape of the defect the table was written to end.
 */
export const SANDBOX_AXES = {
	isolation: ["none", "container", "worktree"],
	network: ["none", "allowlist", "unrestricted"],
	filesystem: ["unrestricted", "ephemeral", "read-only-source"],
} as const;
const SANDBOX_ISOLATION = new Set<string>(SANDBOX_AXES.isolation);
const SANDBOX_NETWORK = new Set<string>(SANDBOX_AXES.network);
const SANDBOX_FILESYSTEM = new Set<string>(SANDBOX_AXES.filesystem);
export interface SandboxClaim {
	readonly axis: "isolation" | "network" | "filesystem";
	readonly value: string;
	readonly stance: "unconstrained" | "enforced" | "refused";
	/** Why this stance, in the words a refusal prints: the reason *is* the design point, so it travels with the claim. */
	readonly reason: string;
}

/**
 * Every sandbox claim a mode may declare, and what this runtime does about it.
 *
 * **One table, because there were two lists and neither could see the other.** This file carried `ENFORCEABLE_SANDBOX`, a
 * hand-written pair that **nothing read** (`rg -n ENFORCEABLE_SANDBOX src` returned its own definition and no other line),
 * while the adapter decided for itself which claims to refuse by naming literals in an `if` chain. A value added to an axis
 * reached neither, and the pair that read like a control could be edited without changing any behaviour. The stances below
 * are the whole decision, and a test holds the table against `SANDBOX_AXES` in both directions.
 *
 * `refused` means the host must not start the mode: a claim it cannot keep is worse than no claim, because an operator
 * plans around it. **`filesystem: ephemeral` is in that bucket, and it is the case this table was written for**: with
 * `isolation: none` the loader refuses the contradiction, but with any other isolation - or with the axis simply absent -
 * the mode loaded and nothing happened, and the word appeared nowhere in `src` outside this file. `unconstrained` is not a
 * third kind of silence: it is the axis saying "nothing asked", which is a declaration too.
 */
export const SANDBOX_CLAIMS: readonly SandboxClaim[] = [
	{ axis: "isolation", value: "none", stance: "unconstrained", reason: "an unconfined run is what this host provides" },
	{ axis: "isolation", value: "container", stance: "refused", reason: "requires an OS sandbox this runtime does not provide" },
	{ axis: "isolation", value: "worktree", stance: "refused", reason: "requires an OS sandbox this runtime does not provide" },
	{ axis: "network", value: "none", stance: "enforced", reason: "refused by tool name at the tool boundary" },
	{ axis: "network", value: "allowlist", stance: "refused", reason: "requires an egress control this runtime does not provide" },
	{ axis: "network", value: "unrestricted", stance: "unconstrained", reason: "the axis declares no constraint rather than omitting one" },
	{ axis: "filesystem", value: "read-only-source", stance: "enforced", reason: "refused by the fence's declared targets at the tool boundary" },
	{ axis: "filesystem", value: "ephemeral", stance: "refused", reason: "this runtime has no ephemeral filesystem, so the claim would be ignored rather than kept" },
	{ axis: "filesystem", value: "unrestricted", stance: "unconstrained", reason: "the axis declares no constraint rather than omitting one" },
];

/** `isolation: 'container'` - one rendering, so a rule and the message about it cannot be spelled differently. */
export function formatSandboxClaim(claim: Pick<SandboxClaim, "axis" | "value">): string {
	return `${claim.axis}: '${claim.value}'`;
}

/** The claims a mode actually makes - only the axes it names - each with its stance. */
export function sandboxClaimsOf(sandbox: WorkMode["sandbox"] | undefined): readonly SandboxClaim[] {
	if (sandbox === undefined) return [];
	const named: readonly (readonly [SandboxClaim["axis"], string | undefined])[] = [
		["isolation", sandbox.isolation],
		["network", sandbox.network],
		["filesystem", sandbox.filesystem],
	];
	return named
		.filter((entry): entry is readonly [SandboxClaim["axis"], string] => entry[1] !== undefined)
		.map(([axis, value]) => SANDBOX_CLAIMS.find((claim) => claim.axis === axis && claim.value === value) ?? {
			axis,
			value,
			stance: "refused" as const,
			reason: "this value is not in the claim table, so no one can say what the host would do about it",
		});
}

/**
 * The claims that stop a mode from starting, with the reason a refusal prints.
 *
 * An unclassified value is refused rather than allowed: a mode declaring something this runtime has no stance on is exactly
 * the case where starting it silently would be the claim nobody checked.
 */
export function unenforceableSandboxClaims(sandbox: WorkMode["sandbox"] | undefined): readonly SandboxClaim[] {
	return sandboxClaimsOf(sandbox).filter((claim) => claim.stance === "refused");
}

/** The claims the tool boundary enforces, for the way out a refusal offers. */
export function enforceableSandboxClaims(): readonly SandboxClaim[] {
	return SANDBOX_CLAIMS.filter((claim) => claim.stance === "enforced");
}
const FENCE_FIELDS = new Set(["paths", "shell", "targets"]);
const FENCE_SHELL_STANCES = new Set(["denied", "uncovered"]);
/**
 * The tools whose path argument this repository can **verify**, and where that argument is.
 *
 * Read from the installed host's own schemas (`pi-agent-core`, `dist/harness/tools/*.d.ts`): `write` and `edit`
 * both take `path`, and `tools/index.d.ts` exports exactly `{read, write, edit, bash}`. `agent_workspace_patch`
 * is ours (`pi-adapter/extension.ts`) and takes a **list**, which is why a target is a set rather than a value.
 *
 * **The map is deliberately tiny, and the smallness is the design.** The installed catalog holds 57 tool names
 * across extensions this repository cannot read schemas for, so "which other tools mutate, and where is their
 * path" is a claim we cannot back. Everything outside this map is either declared by the mode
 * (`fence.targets`) or **refused at the boundary** - never assumed harmless.
 */
export const FENCE_TARGETS: Readonly<Record<string, { readonly at: string; readonly each?: string }>> = {
	write: { at: "path" },
	edit: { at: "path" },
	agent_workspace_patch: { at: "operations", each: "path" },
};

/**
 * A fence path as it is compared: forward slashes, no leading `./`, no trailing `/*` or `/`.
 *
 * A **prefix** rather than a glob, because `matchesPermission` already owns the one wildcard rule this format
 * has, and a second, richer rule for one field is how two rules come to disagree. `modes`, `modes/`, `modes/*`
 * and `modes/**` therefore mean the same thing, and say so in one place.
 */
export function normalizeFencePath(entry: string): string {
	return entry.trim().replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/?\*+$/u, "").replace(/\/+$/u, "");
}

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
	// Required, and refused by name rather than defaulted: an approval default that the mode did not state is a
	// policy the operator never agreed to, and this is the one place in the format where an unstated value would
	// decide whether an action runs.
	if (record.unlisted === undefined) {
		throw new WorkModeError(
			"missing-field",
			"permissions.unlisted is required: it is what an action on none of the mode's three lists gets, and a mode that does not state it has an approval default nobody chose. Declare 'allow' or 'ask'.",
		);
	}
	if (typeof record.unlisted !== "string" || !UNLISTED_STANCES.has(record.unlisted)) {
		throw new WorkModeError(
			"invalid-type",
			`permissions.unlisted must be one of: ${[...UNLISTED_STANCES].join(", ")} (got ${JSON.stringify(record.unlisted)}).`,
		);
	}
	return {
		unlisted: record.unlisted as "allow" | "ask",
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
	// **`gate.approval` is refused with the rest.** It sat in the gate block of all three shipped modes, was never
	// validated, and was read by nothing: the mode's consent stance is its `permissions` block, and a second place to
	// state it read as a control the loader would honour. The mode-format page's own sentence - that the gate reads
	// every field a mode declares - is what made this one worth refusing rather than leaving.
	if ((governance.gate as { readonly approval?: unknown } | undefined)?.approval !== undefined) {
		throw new WorkModeError(
			"invalid-type",
			"governance.gate.approval is not enforceable by the runtime: a mode's consent stance is its permissions block, and nothing here reads a second statement of it. Remove the field.",
		);
	}
	// **Blocks that read as controls and control nothing are refused, by name** - but the loop lives below, beside the
	// `authority` declaration it reads from: `grant_graph` is a key *inside* that block, and a version of this check that
	// ran before the block was parsed looked for it on the governance object and never saw it.
	// `session.budget.turns` is the one budget field the runtime can honour - it has a real turn bound, and the mode's
	// number is carried to it. Its siblings are refused with it, because a budget that meters one of four things
	// meters nothing, and a reader cannot tell from the file which of the four would have stopped the run.
	// Read once here so the validated value can be carried on the mode: the check below refuses it unless it is a
	// positive whole number, and the return spreads it. Reading it twice would let the two disagree.
	const declaredTurns: unknown = (governance.session as { readonly budget?: { readonly turns?: unknown } } | undefined)?.budget?.turns;
	const session = governance.session;
	if (session !== undefined && (typeof session !== "object" || session === null || Array.isArray(session))) {
		throw new WorkModeError("invalid-type", "governance.session must be a mapping whose one enforceable key is 'budget'.");
	}
	const unknownSessionKey = typeof session === "object" && session !== null && !Array.isArray(session) ? Object.keys(session).find((key) => key !== "budget") : undefined;
	if (unknownSessionKey !== undefined) {
		throw new WorkModeError(
			"invalid-type",
			`governance.session.${unknownSessionKey} is not enforceable by the runtime: this runtime has a turn bound and nothing else behind this block. Keep 'budget', or remove the block.`,
		);
	}
	const budget = (session as { readonly budget?: unknown } | undefined)?.budget;
	if (budget !== undefined && (typeof budget !== "object" || budget === null || Array.isArray(budget))) {
		throw new WorkModeError("invalid-type", "governance.session.budget must be a mapping of 'turns' - a scalar budget has no field anything can read.");
	}
	if (budget !== undefined && typeof budget === "object" && budget !== null) {
		const unknownBudgetKey = Object.keys(budget).find((key) => key !== "turns");
		if (unknownBudgetKey !== undefined) {
			throw new WorkModeError(
				"invalid-type",
				`governance.session.budget.${unknownBudgetKey} is not enforceable by the runtime: this runtime has a turn bound and no token, cost or exploration accounting. Keep 'turns' and remove the rest.`,
			);
		}
		// **A turn count that cannot be compared stops nothing**, so the value is checked and not only its key. A string
		// count, a scalar budget and a nested `session: {turns}` all loaded once, which is how a check written to catch
		// this class came to be walkable around.
		const turns = declaredTurns;
		if (turns !== undefined && (typeof turns !== "number" || !Number.isInteger(turns) || turns < 1)) {
			throw new WorkModeError(
				"invalid-type",
				`governance.session.budget.turns must be a positive whole number, and this is ${JSON.stringify(turns)} - a budget that cannot be compared stops nothing.`,
			);
		}
	}
	const stop = governance.stop;
	if (stop !== undefined) {
		// **The block's shape is checked before its contents**, because a shape nothing reads is a stop block that stops
		// nothing: `stop: {on: budget-exhausted}` as a scalar loaded fine, and so did a key nobody has ever read.
		if (typeof stop !== "object" || stop === null || Array.isArray(stop)) {
			throw new WorkModeError("invalid-type", "governance.stop must be a mapping of 'on' and nothing else - a scalar stop block is one no reader can match against.");
		}
		const unknownStopKey = Object.keys(stop).find((key) => key !== "on");
		if (unknownStopKey !== undefined) {
			throw new WorkModeError(
				"invalid-type",
				`governance.stop.${unknownStopKey} is not enforceable by the runtime: what this loop has is the reasons it stops, which 'on' names. Keep 'on', or remove the block.`,
			);
		}
		const declared = (stop as { readonly on?: unknown }).on;
		if (declared !== undefined && (!Array.isArray(declared) || declared.some((entry) => typeof entry !== "string"))) {
			throw new WorkModeError("invalid-type", "governance.stop.on must be a list of stop reasons - a bare name cannot be matched against what the loop raises.");
		}
		// The legal set is the loop's own, imported rather than copied: a second hand-written list can drift from the
		// union it describes, and this one did.
		const asked = Array.isArray(declared) ? (declared as readonly string[]) : [];
		const never = asked.find((entry) => !(LOOP_STOP_KINDS as readonly string[]).includes(entry));
		if (never !== undefined) {
			throw new WorkModeError(
				"invalid-type",
				`governance.stop names '${never}', which this runtime never produces: the loop stops with ${LOOP_STOP_KINDS.join(", ")}. Name one of those, or remove the block.`,
			);
		}
	}

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
	// **Carried, not just checked.** The shape of `exclusions` was validated here and the value then dropped, so a
	// mode could state what it must not touch and touch it anyway. The list is read into a typed field **because
	// trusted input read before untrusted content is the whole point** (design 4.3): a scope assembled after the agent
	// has read a repository has been influenced by it.
	// **Checked as a value, not coerced into one.** The first version read the field with `Array.isArray(...) ? … :
	// undefined`, which quietly turned a scalar, a mapping or a list of junk into *no exclusions at all* - so a mode
	// could write `exclusions: production-venue` (the singular, the likeliest mistake) and load with the list silently
	// gone, and the refusal below never fired because there was nothing left to refuse. A shape that is dropped is a
	// shape that hides, which is the class this task exists to remove.
	if (scope.exclusions !== undefined && !Array.isArray(scope.exclusions)) {
		throw new WorkModeError("invalid-type", "governance.scope.exclusions must be a list of target ids or addresses - a scalar or a mapping is silently no exclusions at all.");
	}
	const badExclusion = Array.isArray(scope.exclusions) ? scope.exclusions.find((entry) => typeof entry !== "string" || entry.trim() === "") : undefined;
	if (badExclusion !== undefined) {
		throw new WorkModeError("invalid-type", `governance.scope.exclusions entries must be non-empty strings, and this list contains ${JSON.stringify(badExclusion)}.`);
	}
	const scopeExclusions = Array.isArray(scope.exclusions) ? (scope.exclusions as readonly string[]).map((entry) => entry.trim()) : undefined;
	// The check asked what happens when the semantics make the exclusion useless, and the answer was: nothing. A
	// `limit` or `none` mode never has its document parsed (`loadWorkModeFromDirectory` returns before that), so the
	// check that resolves a target's id against its address gets an empty table - and the list fires only on the exact
	// spelling again. The guard therefore asks for **both** halves of what makes the list enforceable.
	const declaredGate = governance.gate as { readonly semantics?: unknown; readonly target_argument?: unknown } | undefined;
	const resolvesDocument = declaredGate?.semantics === "conformance" || declaredGate?.semantics === "both";
	if (scopeExclusions !== undefined && scopeExclusions.length > 0 && (!resolvesDocument || declaredGate?.target_argument === undefined)) {
		// **An exclusion list that cannot fire is refused.** It is checked against the target a call names, and that
		// target comes from `gate.target_argument`; a mode that declares none gives the check nothing to read, so the
		// list would sit there reading as a boundary while nothing was bounded. `modes/trading` shipped exactly that.
		throw new WorkModeError(
			"invalid-type",
			"governance.scope.exclusions names targets, and this mode cannot check one: it needs a 'gate.target_argument' to say which argument names a call's target, and a 'gate.semantics' that resolves the engagement document - without both, the list can only match a spelling. Declare both, or remove the exclusions.",
		);
	}


	const authority = requireRecord("governance.authority", governance.authority);
	rejectUnknown("governance.authority", authority, AUTHORITY_FIELDS);
	// **Blocks that read as controls and control nothing are refused, by name**, for the reason a gate-level `windows`
	// block is: the runtime has no machinery behind them, so a mode declaring one claims a bound nobody can reach. Each
	// message says which field and why, because the reason it is refused is the design point. **Where a block lives
	// matters**: `grant_graph` is a key *inside* `authority`, and the first version of this loop looked for every field
	// on the governance object - so it never saw that one, which is how the field survived the check written to catch it.
	const UNHONOURED_BLOCKS: readonly (readonly [Record<string, unknown>, string, string, string])[] = [
		[authority, "grant_graph", "governance.authority.grant_graph", "the binding it names lives in the engagement document's targets[].requires_grants, which is checked per action - a second list here would be a less verifiable copy"],
		[governance, "evidence", "governance.evidence", "retention and isolation are promises this runtime cannot keep: nothing deletes by age or isolates per engagement"],
		[governance, "coordination", "governance.coordination", "there is no second agent to coordinate with, so a cadence here describes machinery that is not present"],
	];
	for (const [source, field, where, why] of UNHONOURED_BLOCKS) {
		if (source[field] === undefined) continue;
		throw new WorkModeError("invalid-type", `${where} is not enforceable by the runtime: ${why}. Remove the block, or build it.`);
	}
	// **`expires` is refused, for the reason `gate.windows` is**: a calendar claim outlives a session and belongs to
	// the engagement document's grant, whose `window` the pre-flight and every action check. Keeping the key in the
	// field set means a mode that writes one is told precisely this rather than that the key is unknown - which is
	// the point of refusing it here instead of deleting it from the schema, and the reason this is a missed
	// application of a decision rather than a new one.
	if (authority.expires !== undefined) {
		throw new WorkModeError(
			"invalid-type",
			"governance.authority.expires is not enforceable by the runtime: an expiry outlives a session and is a property of the engagement document's grant, whose 'window' the pre-flight and every action check. Declare the window on the grant instead, or drop the field.",
		);
	}
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
	// The same "a declaration that cannot decide anything is refused" rule the gate obeys below, applied to the pair
	// the approval stance creates. With `unlisted: allow` an action on no list already runs, so an `always_allow`
	// entry beside it could only restate that default - and a list that reads as a permission while granting none is
	// the defect this rule exists to stop. As with the gate, the refusal names both ways out.
	if (permissions.unlisted === "allow" && permissions.always_allow.length > 0) {
		throw new WorkModeError(
			"invalid-type",
			`Mode '${frontmatter.name}' declares permissions.unlisted 'allow' with ${permissions.always_allow.length} always_allow entr${permissions.always_allow.length === 1 ? "y" : "ies"}, so the list would never decide anything: an action on no list already runs. Remove 'permissions.always_allow', or declare permissions.unlisted: ask if this mode wants to be asked about the actions it did not list.`,
		);
	}
	const limits = parseLimits("governance.gate.limits", gate.limits);
	const effectClasses = parseEffectClasses("governance.effects", governance.effects);

	// `gate.intensity` is a map of phase name to a ceiling, and a ceiling that is not a finite positive number is a
	// declaration that reads as a bound while bounding nothing. Validated at load for the same reason a limit with
	// neither `max` nor `min` is: this has to be a load error naming the mode, not a throw inside a gate.
	const intensityCeilings: Record<string, number> = {};
	if (gate.intensity !== undefined) {
		if (!isRecord(gate.intensity)) {
			throw new WorkModeError("invalid-type", "governance.gate.intensity must be a mapping of phase name to a finite positive number.");
		}
		for (const [phase, ceiling] of Object.entries(gate.intensity)) {
			if (typeof ceiling !== "number" || !Number.isFinite(ceiling) || ceiling < 1) {
				throw new WorkModeError(
					"invalid-type",
					`governance.gate.intensity.${phase} must be a finite number of at least 1 (got ${JSON.stringify(ceiling)}): a ceiling below one permits no action at all, and one that is not a number never compares.`,
				);
			}
			intensityCeilings[phase] = ceiling;
		}
	}
	// `gate.excluded_techniques` is a list of names, and a name that is not a string cannot be matched against an
	// action's technique - so an entry like that would read as a prohibition while prohibiting nothing.
	const excludedTechniques: string[] = [];
	if (gate.excluded_techniques !== undefined) {
		if (!Array.isArray(gate.excluded_techniques)) {
			throw new WorkModeError("invalid-type", "governance.gate.excluded_techniques must be a list of technique names.");
		}
		for (const technique of gate.excluded_techniques) {
			if (typeof technique !== "string" || technique.trim() === "") {
				throw new WorkModeError("invalid-type", `governance.gate.excluded_techniques entries must be non-empty strings (got ${JSON.stringify(technique)}).`);
			}
			excludedTechniques.push(technique);
		}
	}
	// **A prohibition the runtime cannot witness prohibits nothing.** The witness table reads a technique's *shape*,
	// because a name match is defeated by spelling the name differently; a name with no entry there would sit in the
	// mode looking like a control while the boundary has nothing to look for. Refusing it by name is the same cure as
	// the expiry above, and it keeps the two halves honest: either the technique has a shape this repository can
	// check, or the mode does not get to claim it forbids it.
	for (const technique of excludedTechniques) {
		if (WITNESSED_TECHNIQUES.has(technique)) continue;
		throw new WorkModeError(
			"invalid-type",
			`governance.gate.excluded_techniques names '${technique}', which this runtime cannot witness: a technique is only prohibitable when it has a shape the boundary can read, and this name has none. Drop it, or add a witness for it.`,
		);
	}
	// `gate.windows` is refused outright, and the reason is not "unimplemented" but "unenforceable here": the
	// runtime has no clock over a calendar that outlives a session, while the **authority document** - the thing a
	// window constrains - carries its own `window` field and is checked against it at pre-flight and per action. A
	// mode repeating that claim would be a second, less-verifiable copy of a control that already exists one level
	// down. Keeping the field in `GATE_FIELDS` means a mode that writes one is told precisely this, rather than
	// being told the key is unknown.
	if (gate.windows !== undefined) {
		throw new WorkModeError(
			"invalid-type",
			"governance.gate.windows is not enforceable by the runtime: a calendar window outlives a session and is a property of the authority document, which carries and checks its own 'window' field. Declare the window on the grant instead.",
		);
	}

	// **A declaration that cannot decide anything is refused, at the level it is declared.** The rule one level down
	// already exists: a limit with neither `max` nor `min` is rejected because it "can never decide anything". The
	// same argument applies to the field that says *which* gate the mode has, and there was no rule - so a mode could
	// declare `limit`, declare no thresholds, and read as threshold-bounded while nothing bounded it. `none` is the
	// value for a mode that genuinely has no gate, which is why the refusal can offer it as a way out.
	if ((gate.semantics === "limit" || gate.semantics === "both") && limits.length === 0) {
		throw new WorkModeError(
			"missing-field",
			`Mode '${frontmatter.name}' declares gate.semantics '${gate.semantics}' and no 'gate.limits', so the threshold gate it declares would never decide anything. Declare the limits, or declare gate.semantics: none if this mode has no gate.`,
		);
	}
	// The converse: thresholds nothing would ever consult, because the mode has said it has no gate. The code names the
	// shape of the failure (a combination the format does not allow) rather than a TypeScript type, which is how
	// `invalid-type` is already used for the `target_argument` value constraint above.
	if (gate.semantics === "none" && limits.length > 0) {
		throw new WorkModeError(
			"invalid-type",
			`Mode '${frontmatter.name}' declares gate.semantics 'none' and ${limits.length} limit(s), so the thresholds would never be consulted. Remove 'gate.limits', or declare gate.semantics: limit if this mode is bounded by them.`,
		);
	}

	// **The sandbox block is validated at load, and what it claims is carried.** Whether the host can *honour* it
	// is the host's decision (it may refuse to run the mode), but a mode whose isolation fields are misspelled or
	// contradictory must not load looking governed. An explicit `none`/`unrestricted` is honest in a way an absent
	// block is not - and a field that is **absent** is not refused either: D1's own conclusion is that a mode
	// deletes a claim it cannot honour, so the block may name only the axes it is stating.
	let sandbox: WorkMode["sandbox"];
	if (governance.sandbox !== undefined) {
		const block = requireRecord("governance.sandbox", governance.sandbox);
		rejectUnknown("governance.sandbox", block, SANDBOX_FIELDS);
		const readField = (field: string, allowed: ReadonlySet<string>): string | undefined => {
			const value = block[field];
			if (value === undefined) return undefined;
			if (typeof value !== "string" || !allowed.has(value)) {
				throw new WorkModeError("invalid-type", `governance.sandbox.${field} must be one of: ${[...allowed].join(", ")} (got ${JSON.stringify(value)}).`);
			}
			return value;
		};
		const isolation = readField("isolation", SANDBOX_ISOLATION) as "none" | "container" | "worktree" | undefined;
		const network = readField("network", SANDBOX_NETWORK) as "none" | "allowlist" | "unrestricted" | undefined;
		const filesystem = readField("filesystem", SANDBOX_FILESYSTEM) as "unrestricted" | "ephemeral" | "read-only-source" | undefined;
		sandbox = {
			...(isolation === undefined ? {} : { isolation }),
			...(network === undefined ? {} : { network }),
			...(filesystem === undefined ? {} : { filesystem }),
		};
		// A claim the mode contradicts in its own file: an unconfined run has no ephemeral filesystem to write to.
		if (sandbox.isolation === "none" && sandbox.filesystem === "ephemeral") {
			throw new WorkModeError("invalid-type", "governance.sandbox declares 'isolation: none' with 'filesystem: ephemeral', but an unconfined run has no ephemeral filesystem to write to. Declare an isolation the host provides, or 'filesystem: unrestricted'.");
		}
	}

	// **The fence is validated at load, and its two required fields are the point.** A fence with no usable path
	// would read as a protection while protecting nothing - the defect class this block exists for. And `shell` is
	// required because the fence cannot see through the shell (`pi-adapter/extension.ts` classifies a command by
	// name and never by path): a mode must state whether it closed that route or left it open, in the shape
	// `permissions.unlisted` already uses for a stance nobody should be able to leave implicit.
	let fence: WorkMode["fence"];
	if (governance.fence !== undefined) {
		const block = requireRecord("governance.fence", governance.fence);
		rejectUnknown("governance.fence", block, FENCE_FIELDS);
		const paths = (block.paths === undefined ? [] : requireStringArray("governance.fence.paths", block.paths)).map(normalizeFencePath);
		if (paths.length === 0 || paths.some((entry) => entry === "")) {
			throw new WorkModeError(
				"missing-field",
				`Mode '${frontmatter.name}' declares a 'fence' with no usable 'paths', so it would read as fenced while protecting nothing. Declare the workspace paths the fence protects (a file matches exactly, a directory its whole subtree), or remove the 'fence' block.`,
			);
		}
		if (block.shell === undefined) {
			throw new WorkModeError(
				"missing-field",
				`Mode '${frontmatter.name}' declares a 'fence' and no 'shell' stance, and the fence cannot see through the shell: its classifier reads command names, never paths. Declare shell: 'denied' to refuse bash and powershell in this mode, or 'uncovered' to state that a shell command can still write into the fence.`,
			);
		}
		if (typeof block.shell !== "string" || !FENCE_SHELL_STANCES.has(block.shell)) {
			throw new WorkModeError("invalid-type", `governance.fence.shell must be one of: ${[...FENCE_SHELL_STANCES].join(", ")} (got ${JSON.stringify(block.shell)}). 'denied' refuses bash and powershell; 'uncovered' declares that a shell command can still write into the fence.`);
		}
		let targets: Record<string, string> | undefined;
		if (block.targets !== undefined) {
			const declared = requireRecord("governance.fence.targets", block.targets);
			targets = {};
			for (const [tool, at] of Object.entries(declared)) {
				if (typeof at !== "string" || at.trim() === "") {
					throw new WorkModeError("invalid-type", `governance.fence.targets.${tool} must name the argument path carrying that tool's target (got ${JSON.stringify(at)}).`);
				}
				targets[tool] = at;
			}
		}
		fence = {
			paths,
			shell: block.shell as "denied" | "uncovered",
			...(targets === undefined ? {} : { targets }),
		};
	}

	return {
		id: frontmatter.name,
		description: frontmatter.description,
		body,
		governanceVersion: governance.version,
		frameworkRange: governance.framework,
		governance: { ...governance, scope, authority: { ...authority, capabilities }, gate },
		capabilities,
		gateSemantics: gate.semantics as "none" | "limit" | "conformance" | "both",
		...(targetArgument === undefined ? {} : { targetArgument: targetArgument as string }),
		...(grant === undefined ? {} : { authorityGrant: grant as string }),
			// **Attached, or the extraction above is just a local variable.** This is the step that was missing when the
			// exclusion check first ran: the list was read, typed, and then dropped on the floor a second time.
			...(scopeExclusions === undefined ? {} : { scopeExclusions }),
			// **The one budget field the runtime can honour**, carried so the loop that reads a turn bound can be given
			// it. Without this line the number would be validated and then dropped - which is the defect this task
			// exists to remove, and it was the defect in the first version of this very fix.
			...(typeof declaredTurns === "number" ? { sessionTurns: declaredTurns } : {}),
		...(excludedTechniques.length === 0 ? {} : { excludedTechniques }),
		...(sandbox === undefined ? {} : { sandbox }),
		...(fence === undefined ? {} : { fence }),
		...(Object.keys(intensityCeilings).length === 0 ? {} : { intensityCeilings }),
		permissions,
		limits,
		effectClasses,
	};
}

/**
 * Whether a permission list names this action. The wildcard rule, in one place, because three lists are read
 * with it and a second copy of it is a second thing to get wrong.
 */
export function matchesPermission(list: readonly string[], action: string): boolean {
	return list.some((entry) => (entry === action ? true : entry.endsWith("*") && action.startsWith(entry.slice(0, -1))));
}

/**
 * Permission precedence, and the mode's own answer for everything the lists do not mention. `never_allow` wins
 * over `always_allow`, over `ask_before`, and over any mode setting - a deny list that a mode can override is not
 * a deny list.
 *
 * **The unlisted answer is the mode's, not this function's.** It returns `permissions.unlisted`, so a mode that
 * wants to be asked about what it did not list says so, and a mode that does not says that instead. Nothing here
 * invents a default, and nothing here can: a mode with no stance never reaches this function, because the loader
 * refuses to load it.
 *
 * **`"ask"` still has two causes.** An action on `ask_before` is one the mode named; an action on no list is one
 * the mode's stance covers. Both ask, and they differ only in what the reason should say, so the caller draws that
 * distinction with {@link matchesPermission}.
 */
export function evaluatePermission(permissions: PermissionSet, tool: string): "allow" | "ask" | "deny" {
	if (matchesPermission(permissions.never_allow, tool)) return "deny";
	if (matchesPermission(permissions.ask_before, tool)) return "ask";
	if (matchesPermission(permissions.always_allow, tool)) return "allow";
	return permissions.unlisted;
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
			const value = JSON.parse(readDeclaration(path)) as { schemaVersion?: unknown; mode?: unknown };
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
	// **The directory name travels with the mode**, because it is the only place that knows it: the frontmatter's `name` is
	// the mode's own display name, and a prompt that cited `modes/<name>/MODE.md` would be citing a path derived from the
	// wrong field. See `WorkMode.source`.
	const mode: WorkMode = { ...loadWorkMode(readWorkModeFiles(workModeDirectory(workspaceRoot, name)), options), source: name };
	// **Both no-contract values return here, and this line is why `none` had to extend it.** A value that fell through
	// would be sent to the conformance path and refused with a message about grant documents - the value would look
	// implemented and not be.
	// **The name is resolved whatever the semantics; only the *document* is skipped for the values that have no
	// contract.** The early return below exists so a `limit`/`none` mode is not refused with a message about grant
	// documents - its own comment says the value would then look implemented and not be. A name that resolves to
	// nothing is a different fact: it reads like authority nobody granted, and two shipped modes carried one.
	const declaredGrant = mode.authorityGrant;
	if (declaredGrant !== undefined) {
		const declaredPath = resolve(workspaceRoot, declaredGrant);
		if (!existsSync(declaredPath)) {
			throw new WorkModeError(
				"authority-unresolved",
				`Mode '${mode.id}' declares 'authority.grant: ${declaredGrant}', and there is no document at ${declaredPath}. A name that resolves to nothing reads as authority nobody granted. Point it at a document, or drop the field - a mode bounded by its own permissions and scope does not need to name an engagement.`,
			);
		}
	}
	if (mode.gateSemantics === "limit" || mode.gateSemantics === "none") return { mode };

	const grant = mode.authorityGrant;
	if (grant === undefined) {
		throw new WorkModeError(
			"authority-unresolved",
			`Mode '${mode.id}' declares gate.semantics '${mode.gateSemantics}' and names no 'authority.grant', so there is nothing an action could be checked against. Declare the grant document, or declare gate.semantics: limit if this mode is bounded by thresholds, or none if it has no gate at all.`,
		);
	}
	const path = resolve(workspaceRoot, grant);
	if (!existsSync(path)) {
		throw new WorkModeError(
			"authority-unresolved",
			`Mode '${mode.id}' declares gate.semantics '${mode.gateSemantics}' but its grant '${grant}' is not a document at '${path}'. A conformance mode with no document would run gated by nothing while declaring that it is gated. Point 'authority.grant' at a grant document, or declare gate.semantics: limit if this mode is bounded by thresholds, or none if it has no gate at all.`,
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