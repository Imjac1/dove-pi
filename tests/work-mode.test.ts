import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	loadWorkMode,
	loadWorkModeFromDirectory,
	evaluatePermission,
	resolveWorkModeSelection,
	satisfiesFrameworkRange,
	workModeDirectory,
	workModeRefusal,
	WorkModeError,
	type WorkModeFiles,
	type WorkModeSelection,
} from "../src/core/work-mode.ts";
import { effectClassOf } from "../src/core/effect-ledger.ts";
import { LOOP_STOP_KINDS } from "../src/core/loop.ts";

const FRAMEWORK = "0.1.0";

/** A throwaway workspace root, used by everything that reads a declaration or a mode directory off disk. */
function freshRoot(): string {
	return mkdtempSync(join(tmpdir(), "dove-mode-"));
}

function files(overrides: Partial<WorkModeFiles> = {}): WorkModeFiles {
	return {
		mode: [
			"---",
			"name: code-audit",
			"description: Review a repository and emit findings",
			"license: MIT",
			"---",
			"",
			"Review the repository and report findings as SARIF.",
			"",
		].join("\n"),
		governance: [
			"version: 1.0.0",
			'framework: ">=0.1.0 <1.0.0"',
			"scope:",
			"  targets: [repo]",
			"  environment: non-production",
			"authority:",
			"  grant: local-review",
			"  capabilities: [read_repo, write_report]",
			"gate:",
			"  semantics: conformance",
			"",
		].join("\n"),
		permissions: ["unlisted: ask", "always_allow: [read_*]", "ask_before: [write_report]", "never_allow: [shell.exec]"].join("\n"),
		...overrides,
	};
}

function expectError(run: () => unknown, code: WorkModeError["code"]): WorkModeError {
	try {
		run();
	} catch (error) {
		assert.ok(error instanceof WorkModeError, `expected WorkModeError, got ${String(error)}`);
		assert.equal(error.code, code);
		return error;
	}
	throw new Error(`expected a WorkModeError with code '${code}', but nothing was thrown`);
}

describe("work-mode loader", () => {
	// **A declaration the runtime cannot honour is refused, by name.** These four came out of a whole-scope check that
	// asked the field-level question across the repository: every one of them was accepted, read as a control, and
	// read by nothing. The cure is the one this repository already uses for a gate-level `windows` block - the key
	// stays in the allowed set so the message is precise, and the message says which field, and why.
	const withGovernance = (line: string): WorkModeFiles => files({ governance: files().governance + line.replace(/^\s+/u, "") + "\n" });

	it("carries the turn budget it validated, instead of dropping it after checking it  [D4]", () => {
		// **The failure this case exists for**: the first version of this check validated `turns` and then dropped it -
		// checked and inert, which is the defect the task is about, reproduced inside its own fix. A validated value
		// nobody carries is exactly as useful as an unvalidated one.
		const mode = loadWorkMode(withGovernance("  session:\n    budget:\n      turns: 7"), { frameworkVersion: FRAMEWORK });
		assert.equal(mode.sessionTurns, 7, "the number the mode declares is on the mode");
		assert.equal(loadWorkMode(files(), { frameworkVersion: FRAMEWORK }).sessionTurns, undefined, "and a mode that declares none carries none");
	});

	it("refuses a non-numeric turn budget, and the shapes that walk around the check  [D4]", () => {
		// A budget that cannot be compared is one that stops nothing, and the first version of this check only looked for
		// sibling *keys*: a string count, a scalar budget and a nested `session: {turns}` all loaded, which is how a
		// check written to catch this class came to be walkable around.
		const cases: readonly (readonly [string, string])[] = [
			["a string turn count", "  session:\n    budget:\n      turns: sixty"],
			["a budget that is not a mapping", "  session:\n    budget: 60"],
			["a budget beside turns", "  session:\n    turns: 60"],
			["a stop reason that is not a list", "  stop:\n    on: budget-exhausted"],
		];
		for (const [what, line] of cases) {
			const error = expectError(() => loadWorkMode(withGovernance(line), { frameworkVersion: FRAMEWORK }), "invalid-type");
			assert.match(error.message, /session|stop|budget|turns/u, `${what} is refused: ${error.message}`);
		}
	});

	it("accepts exactly the stop reasons the loop itself produces  [D4]", () => {
		// **The vocabulary is the loop's, not a copy of it.** A stop condition nothing can raise is a promise about the
		// end of a run, and the shipped modes named three that exist nowhere; the loader held its own hand-written list,
		// so the two could drift apart silently. This case binds them.
		for (const kind of LOOP_STOP_KINDS) {
			assert.doesNotThrow(() => loadWorkMode(withGovernance(`  stop:\n    on: [${kind}]`), { frameworkVersion: FRAMEWORK }), `${kind} is a reason the loop produces`);
		}
		const error = expectError(() => loadWorkMode(withGovernance("  stop:\n    on: [budget-exhausted]"), { frameworkVersion: FRAMEWORK }), "invalid-type");
		assert.match(error.message, /budget-exhausted/u, "and one the loop never produces is named back");
	});

	it("refuses the shapes of an exclusion list that would silently become no exclusion list  [D4]", () => {
		// The check found this one on the refusal it had just been written to make: a scalar, a mapping or a list of
		// junk was coerced to `undefined` before the guard ran, so a mode could write the likeliest mistake -
		// `exclusions: production-venue`, singular - and load with the list quietly gone and no loss recorded.
		for (const wrong of ["  exclusions: production-venue", "  exclusions:\n    venue: production-venue", "  exclusions: [\"\"]", "  exclusions: [42]"]) {
			const governance = files().governance.replace("  targets: [repo]", "  targets: [repo]\n" + wrong);
			const error = expectError(() => loadWorkMode(files({ governance }), { frameworkVersion: FRAMEWORK }), "invalid-type");
			assert.match(error.message, /exclusions/u, "the field is named, whatever shape it took: " + error.message);
		}
	});

	it("refuses an exclusion list on a mode whose semantics never resolve the document it would check against  [D4]", () => {
		// The guard used to ask only for `target_argument`. A `limit` or `none` mode never has its document parsed, so
		// the id-to-address resolution gets an empty table and the list fires only on the exact spelling - which is the
		// hole this task closed once already, kept open under the other semantics.
		const governance = files().governance
			.replace("  semantics: conformance", "  semantics: none")
			.replace("  targets: [repo]", "  targets: [repo]\n  exclusions: [some-venue]");
		const error = expectError(() => loadWorkMode(files({ governance }), { frameworkVersion: FRAMEWORK }), "invalid-type");
		assert.match(error.message, /semantics/u, "the reason names what is missing: " + error.message);
	});

	it("refuses `gate.approval`, which states a stance nothing reads  [D4]", () => {
		// Inside the gate block, where the field belongs: a top-level `approval` is an unknown key, which is a different
		// refusal answering a different question.
		const governance = files().governance.replace("  semantics: conformance", "  semantics: conformance\n  approval: none");
		const error = expectError(() => loadWorkMode(files({ governance }), { frameworkVersion: FRAMEWORK }), "invalid-type");
		assert.match(error.message, /approval/u, "the field is named: " + error.message);
	});

	it("refuses an exclusion list the gate cannot enforce  [D4]", () => {
		// `scope.exclusions` is checked against the target a call names, and a mode that declares no `target_argument`
		// gives that check nothing to read - so the list is inert. `modes/trading` shipped exactly that shape:
		// `exclusions: [production-venue]` under a gate that carries no target, and a case titled "keeps production out
		// of reach" that asserted the raw value rather than an enforcement. A statement that cannot fire is this task's
		// defect, so it is refused rather than kept for its good intentions.
		const governance = files().governance.replace("  targets: [repo]", "  targets: [repo]\n  exclusions: [some-venue]");
		const error = expectError(() => loadWorkMode(files({ governance }), { frameworkVersion: FRAMEWORK }), "invalid-type");
		assert.match(error.message, /exclusions/u, "the field is named");
		assert.match(error.message, /target_argument/u, "and the way to make it enforceable");
	});

	it("refuses `authority.grant_graph`, which duplicates what the document binds  [D4]", () => {
		// Inside the `authority` block, where the field belongs: appended at the top level it would be an unknown-key
		// refusal instead, which is a different check answering a different question.
		const governance = files().governance.replace("  capabilities: [read_repo, write_report]", "  capabilities: [read_repo, write_report]\n  grant_graph: [g-client-scope]");
		const error = expectError(() => loadWorkMode(files({ governance }), { frameworkVersion: FRAMEWORK }), "invalid-type");
		assert.match(error.message, /grant_graph/u, "the field is named");
		assert.match(error.message, /requires_grants/u, "and the reader is sent to where the binding actually lives");
	});

	it("refuses a `stop.on` reason the runtime never produces  [D4]", () => {
		// The shipped pentest mode names three (`budget-exhausted`, `window-closed`, `emergency-stop`) and none of them
		// exists anywhere in the runtime: a stop condition nothing can raise is a promise about the end of a run.
		const error = expectError(
			() => loadWorkMode(withGovernance("  stop:\n    on: [budget-exhausted]"), { frameworkVersion: FRAMEWORK }),
			"invalid-type",
		);
		assert.match(error.message, /budget-exhausted/u, "the value is named");
		assert.match(error.message, /maxTurns|completed|never produces|does not produce/u, "and the legal set is described");
	});

	it("refuses `evidence` and `coordination`, whose promises this runtime cannot keep  [D4]", () => {
		for (const [line, field] of [["  evidence:", "evidence"], ["  coordination:", "coordination"]] as const) {
			const error = expectError(() => loadWorkMode(withGovernance(line), { frameworkVersion: FRAMEWORK }), "invalid-type");
			assert.match(error.message, new RegExp(field, "u"), `the field is named: ${field}`);
		}
	});

	it("carries `session.budget.turns` and refuses the siblings it cannot honour  [D4]", () => {
		// `turns` is honoured - the runtime has a real turn bound and the mode's number is fed to it. `tokens`,
		// `cost_multiplier` and `exploration` are not, and a budget that meters two of four things meters nothing.
		const error = expectError(
			() => loadWorkMode(withGovernance("  session:\n    budget:\n      turns: 60\n      tokens: 600000"), { frameworkVersion: FRAMEWORK }),
			"invalid-type",
		);
		assert.match(error.message, /tokens/u, "the field it cannot honour is named");
	});

	it("refuses a `grant` name that resolves to nothing, whatever the semantics  [D4]", () => {
		// The loader returns early for `limit`/`none` because it must not load a document those modes do not use - its
		// own comment says why. But a name that resolves to nothing is a different fact: it reads like authority nobody
		// granted. Two shipped modes carry one each.
		const root = freshRoot();
		const directory = join(root, "modes", "unresolvable");
		mkdirSync(directory, { recursive: true });
		writeFileSync(join(directory, "MODE.md"), ["---", "name: unresolvable", "description: A mode whose grant is not there", "license: MIT", "---", "", "Body.", ""].join("\n"));
		writeFileSync(
			join(directory, "governance.yaml"),
			["version: 1.0.0", 'framework: ">=0.1.0 <1.0.0"', "scope:", "  targets: [repo]", "  environment: non-production", "authority:", "  grant: local-nothing", "  capabilities: [read_repo]", "gate:", "  semantics: none", ""].join("\n"),
		);
		writeFileSync(join(directory, "permissions.yaml"), ["unlisted: ask", "always_allow: []", "ask_before: []", "never_allow: []", ""].join("\n"));
		const error = expectError(() => loadWorkModeFromDirectory(root, "unresolvable", { frameworkVersion: FRAMEWORK }), "authority-unresolved");
		assert.match(error.message, /local-nothing/u, "the name is named");
	});

	it("loads a well-formed three-file mode", () => {
		const mode = loadWorkMode(files(), { frameworkVersion: FRAMEWORK });
		assert.equal(mode.id, "code-audit");
		assert.equal(mode.governanceVersion, "1.0.0");
		assert.equal(mode.frameworkRange, ">=0.1.0 <1.0.0");
		assert.match(mode.body, /report findings as SARIF/);
		assert.deepEqual(mode.permissions.never_allow, ["shell.exec"]);
	});

	it("rejects an unknown field instead of ignoring it, unlike every surveyed precedent", () => {
		const mode = files({ mode: files().mode.replace("license: MIT", "permissionMode: bypassPermissions") });
		const error = expectError(() => loadWorkMode(mode, { frameworkVersion: FRAMEWORK }), "unknown-field");
		assert.match(error.detail, /permissionMode/);
	});

	it("rejects an unknown field in governance and in permissions", () => {
		expectError(() => loadWorkMode(files({ governance: files().governance + "sandboxx: {}\n" }), { frameworkVersion: FRAMEWORK }), "unknown-field");
		expectError(() => loadWorkMode(files({ permissions: files().permissions + "\nallow_all: [x]\n" }), { frameworkVersion: FRAMEWORK }), "unknown-field");
	});

	it("requires the frontmatter fence and the two required frontmatter fields", () => {
		expectError(() => loadWorkMode(files({ mode: "no fence here\n" }), { frameworkVersion: FRAMEWORK }), "missing-field");
		expectError(() => loadWorkMode(files({ mode: files().mode.replace("name: code-audit\n", "") }), { frameworkVersion: FRAMEWORK }), "missing-field");
		expectError(() => loadWorkMode(files({ mode: files().mode.replace("description: Review a repository and emit findings\n", "") }), { frameworkVersion: FRAMEWORK }), "missing-field");
	});

	it("requires scope, authority.capabilities and gate.semantics", () => {
		expectError(() => loadWorkMode(files({ governance: files().governance.replace("scope:\n  targets: [repo]\n  environment: non-production\n", "") }), { frameworkVersion: FRAMEWORK }), "missing-field");
		expectError(() => loadWorkMode(files({ governance: files().governance.replace("  capabilities: [read_repo, write_report]\n", "") }), { frameworkVersion: FRAMEWORK }), "missing-field");
		expectError(() => loadWorkMode(files({ governance: files().governance.replace("  semantics: conformance\n", "") }), { frameworkVersion: FRAMEWORK }), "missing-field");
	});

	it("rejects an unrecognised gate semantics value", () => {
		const bad = files({ governance: files().governance.replace("semantics: conformance", "semantics: whatever") });
		const error = expectError(() => loadWorkMode(bad, { frameworkVersion: FRAMEWORK }), "missing-field");
		assert.match(error.detail, /gate.semantics/);
		// The message lists the values, so a fourth one has to appear in it rather than only in the constant.
		for (const value of ["none", "limit", "conformance", "both"]) assert.match(error.detail, new RegExp(value));
	});

	it("refuses a mode whose framework range excludes the running version", () => {
		const error = expectError(() => loadWorkMode(files(), { frameworkVersion: "2.0.0" }), "framework-range");
		assert.match(error.detail, /excludes the running version 2.0.0/);
	});

	it("refuses an unparseable framework range rather than assuming it is satisfied", () => {
		const bad = files({ governance: files().governance.replace('">=0.1.0 <1.0.0"', '">=0.1.0 || ^3"') });
		expectError(() => loadWorkMode(bad, { frameworkVersion: FRAMEWORK }), "framework-range-unparseable");
	});

	it("handles a YAML block scalar description, the shape that broke a real adapter round-trip", () => {
		const folded = files({
			mode: ["---", "name: folded", "description: >", "  Review the repository", "  and emit findings", "---", "body"].join("\n"),
		});
		const mode = loadWorkMode(folded, { frameworkVersion: FRAMEWORK });
		assert.equal(mode.description, "Review the repository and emit findings\n");
	});
});

/** A mode that declares whatever the caller appends under `gate:` or at the top level. */
function withPolicy(yaml: string): WorkModeFiles {
	return files({ governance: files().governance + yaml });
}

describe("mode-declared limits", () => {
	it("validates and exposes the limits a mode declares, keyed by id", () => {
		const mode = loadWorkMode(
			withPolicy(["  limits:", "    notional:", "      argument: order.notional", "      max: 100000", "      unit: USD", "      tools: [order.submit]", ""].join("\n")),
			{ frameworkVersion: FRAMEWORK },
		);
		assert.deepEqual(mode.limits, [{ id: "notional", argument: "order.notional", max: 100000, unit: "USD", tools: ["order.submit"] }]);
	});

	it("refuses a limit that can never decide anything, naming the file that declared it", () => {
		const error = expectError(
			() => loadWorkMode(withPolicy(["  limits:", "    useless:", "      argument: order.notional", ""].join("\n")), { frameworkVersion: FRAMEWORK }),
			"missing-field",
		);
		assert.match(error.detail, /neither min nor max/, "a limit with no bound is refused at load, not later by whichever gate is built first");
	});

	it("refuses a non-finite bound rather than letting the limit always pass", () => {
		expectError(
			() => loadWorkMode(withPolicy(["  limits:", "    n:", "      argument: a", '      max: "lots"', ""].join("\n")), { frameworkVersion: FRAMEWORK }),
			"invalid-type",
		);
	});

	it("refuses a list of limits, because the id would then be a second name for the key", () => {
		const error = expectError(
			() => loadWorkMode(withPolicy(["  limits:", "    - id: n", "      argument: a", "      max: 1", ""].join("\n")), { frameworkVersion: FRAMEWORK }),
			"invalid-type",
		);
		assert.match(error.detail, /keyed by limit id/);
	});

	it("refuses an unknown field inside a limit, including a nested id", () => {
		expectError(
			() => loadWorkMode(withPolicy(["  limits:", "    n:", "      argument: a", "      max: 1", "      maximum: 2", ""].join("\n")), { frameworkVersion: FRAMEWORK }),
			"unknown-field",
		);
		expectError(
			() => loadWorkMode(withPolicy(["  limits:", "    n:", "      id: n2", "      argument: a", "      max: 1", ""].join("\n")), { frameworkVersion: FRAMEWORK }),
			"unknown-field",
		);
	});
});

describe("mode-declared effect classes", () => {
	it("exposes the declared classes, and an undeclared tool stays non-idempotent", () => {
		const mode = loadWorkMode(
			withPolicy(["effects:", "  classes:", "    read: idempotent", "    order.submit: key-idempotent", ""].join("\n")),
			{ frameworkVersion: FRAMEWORK },
		);
		assert.deepEqual(mode.effectClasses, { read: "idempotent", "order.submit": "key-idempotent" });
		const undeclared = effectClassOf("bash", mode.effectClasses);
		assert.equal(undeclared.effectClass, "non-idempotent", "an omission must not grant a retry");
		assert.equal(undeclared.declared, false, "and the caller can tell the mode did not say so");
	});

	it("refuses an unrecognised class by name rather than defaulting it", () => {
		const error = expectError(
			() => loadWorkMode(withPolicy(["effects:", "  classes:", "    read: safe", ""].join("\n")), { frameworkVersion: FRAMEWORK }),
			"invalid-type",
		);
		assert.match(error.detail, /key-idempotent/, "the error names the accepted classes");
	});

	it("refuses an unknown field in the effects section", () => {
		expectError(
			() => loadWorkMode(withPolicy(["effects:", "  classez:", "    read: idempotent", ""].join("\n")), { frameworkVersion: FRAMEWORK }),
			"unknown-field",
		);
	});
});

/**
 * `gate.semantics` says *which* gate the mode has. A value that declares a gate the mode does not supply is refused,
 * because the field would otherwise read as a control while the run had none - the shape this project keeps finding.
 */
describe("gate semantics vocabulary", () => {
	/** The fixture with its `gate.semantics` replaced, plus anything the caller appends under `gate:`. */
	function withSemantics(value: string, extra = ""): WorkModeFiles {
		return files({ governance: files().governance.replace("semantics: conformance", "semantics: " + value) + extra });
	}
	const limits = ["  limits:", "    notional:", "      argument: order.notional", "      max: 100000", ""].join("\n");

	it("accepts 'none' and exposes it, for a mode that has no gate at all", () => {
		const mode = loadWorkMode(withSemantics("none"), { frameworkVersion: FRAMEWORK });
		assert.equal(mode.gateSemantics, "none");
		assert.deepEqual(mode.limits, []);
	});

	it("refuses 'limit' with no limits, naming the field and both ways out", () => {
		const error = expectError(() => loadWorkMode(withSemantics("limit"), { frameworkVersion: FRAMEWORK }), "missing-field");
		assert.match(error.detail, /gate\.limits/, "the field that is missing");
		assert.match(error.detail, /gate\.semantics: none/, "and the value that fits a mode with no gate, so the author is not sent back to the one that failed");
	});

	it("refuses 'both' with no limits, because both halves have to hold", () => {
		const error = expectError(() => loadWorkMode(withSemantics("both"), { frameworkVersion: FRAMEWORK }), "missing-field");
		assert.match(error.detail, /both/);
	});

	it("still accepts 'limit' with limits, which is the case the rule must not break", () => {
		const mode = loadWorkMode(withSemantics("limit", limits), { frameworkVersion: FRAMEWORK });
		assert.equal(mode.gateSemantics, "limit");
		assert.equal(mode.limits.length, 1);
	});

	it("refuses 'none' with limits, because the thresholds would never be consulted", () => {
		const error = expectError(() => loadWorkMode(withSemantics("none", limits), { frameworkVersion: FRAMEWORK }), "invalid-type");
		assert.match(error.detail, /never be consulted/);
		assert.match(error.detail, /gate\.semantics: limit/, "and it names the value that would fit");
	});
});

describe("mode selection", () => {
	function declare(where: string, value: string): void {
		mkdirSync(join(where, ".dove"), { recursive: true });
		writeFileSync(join(where, ".dove", "mode.json"), value);
	}

	it("selects nothing when nothing is declared, which is a state and not a failure", () => {
		const selection = resolveWorkModeSelection({ workspaceRoot: freshRoot() });
		assert.equal(selection.name, undefined);
		assert.equal(selection.source, "none");
		assert.equal(workModeRefusal(selection), undefined, "running with no mode is legitimate; the host says which state it is in");
	});

	it("reads a declaration and records where the selection came from", () => {
		const where = freshRoot();
		declare(where, JSON.stringify({ schemaVersion: 1, mode: "code-audit" }));
		const selection = resolveWorkModeSelection({ workspaceRoot: where });
		assert.equal(selection.name, "code-audit");
		assert.equal(selection.source, "declared");
		assert.equal(selection.malformed, false);
	});

	it("refuses a malformed declaration instead of degrading to no mode", () => {
		const where = freshRoot();
		for (const value of ["{ not json", JSON.stringify({ schemaVersion: 2, mode: "code-audit" }), JSON.stringify({ schemaVersion: 1, mode: "../../etc" }), JSON.stringify({ schemaVersion: 1 })]) {
			declare(where, value);
			const selection = resolveWorkModeSelection({ workspaceRoot: where });
			assert.equal(selection.malformed, true, `${value} must not read as a valid declaration`);
			assert.equal(selection.name, undefined);
			const refusal = workModeRefusal(selection);
			assert.ok(refusal !== undefined, "a declared-but-unreadable mode must stop the run");
			assert.match(refusal, /not "no mode declared"/, "the refusal distinguishes the two facts");
		}
	});

	it("implies pentest from the workspace mode, and implies nothing else", () => {
		const where = freshRoot();
		const pentest = resolveWorkModeSelection({ workspaceRoot: where, workspaceMode: "pentest" });
		assert.equal(pentest.name, "pentest");
		assert.equal(pentest.source, "workspace-pentest");
		assert.equal(resolveWorkModeSelection({ workspaceRoot: where, workspaceMode: "development" }).name, undefined, "ordinary development declares no mode");
	});

	it("lets an explicit override win, and refuses one that is not a mode name", () => {
		const where = freshRoot();
		declare(where, JSON.stringify({ schemaVersion: 1, mode: "code-audit" }));
		assert.equal(resolveWorkModeSelection({ workspaceRoot: where, override: "trading" }).name, "trading");
		assert.equal(resolveWorkModeSelection({ workspaceRoot: where, override: "trading" }).source, "override");
		assert.equal(resolveWorkModeSelection({ workspaceRoot: where, override: "not a name" }).malformed, true);
	});
});

describe("loading a mode from a directory", () => {
	// The version the host is actually running, so the shipped modes load the way the host loads them.
	const PACKAGE_VERSION = (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string }).version;

	it("loads a shipped mode by name, with its limits and effect classes", () => {
		const trading = loadWorkModeFromDirectory(process.cwd(), "trading", { frameworkVersion: PACKAGE_VERSION }).mode;
		assert.equal(trading.id, "trading");
		assert.deepEqual(trading.limits.map((limit) => limit.id), ["notional", "quantity"], "the thresholds are mode content, not test content");
		const pentest = loadWorkModeFromDirectory(process.cwd(), "pentest", { frameworkVersion: PACKAGE_VERSION });
		assert.equal(pentest.mode.id, "pentest");
		assert.equal(pentest.authorityDocument?.engagement, "example-engagement", "a conformance mode loads with the document it is checked against");
		assert.ok((pentest.authorityDocument?.grants.length ?? 0) > 0, "and that document has grants, or the mode is gated by an empty scope");
	});

	it("refuses a mode name that is a path, before touching the filesystem", () => {
		assert.throws(() => workModeDirectory(process.cwd(), "../../etc"), WorkModeError);
	});

	it("treats a missing file as an error, never as an empty default", () => {
		const where = freshRoot();
		mkdirSync(join(where, "modes", "half"), { recursive: true });
		writeFileSync(join(where, "modes", "half", "governance.yaml"), "version: 1.0.0\nframework: \">=0.1.0\"\n");
		const error = expectError(() => loadWorkModeFromDirectory(where, "half", { frameworkVersion: "0.1.0" }), "missing-file");
		assert.match(error.detail, /MODE\.md/, "the error names the file that is missing");
	});

	it("refuses a corrupt mode with a reason the host can report, which is 'refuses to start'", () => {
		const where = freshRoot();
		mkdirSync(join(where, "modes", "broken"), { recursive: true });
		writeFileSync(join(where, "modes", "broken", "MODE.md"), "---\nname: broken\ndescription: A mode with no governance\n---\nbody\n");
		writeFileSync(join(where, "modes", "broken", "governance.yaml"), "version: 1.0.0\n");
		writeFileSync(join(where, "modes", "broken", "permissions.yaml"), "never_allow: [shell.exec]\n");
		const selection: WorkModeSelection = { workspaceRoot: where, path: join(where, ".dove", "mode.json"), name: "broken", source: "declared", malformed: false };
		let failure: unknown;
		try {
			loadWorkModeFromDirectory(where, "broken", { frameworkVersion: "0.1.0" });
		} catch (error) {
			failure = error;
		}
		assert.ok(failure instanceof WorkModeError, "a mode that fails validation throws rather than loading partially");
		const refusal = workModeRefusal(selection, failure);
		assert.ok(refusal !== undefined && /refuses to start rather than starting unconstrained/.test(refusal), String(refusal));
	});
});

describe("framework range", () => {
	it("evaluates the documented clause shapes", () => {
		assert.equal(satisfiesFrameworkRange(">=0.1.0 <1.0.0", "0.1.0"), true);
		assert.equal(satisfiesFrameworkRange(">=0.1.0 <1.0.0", "0.9.9"), true);
		assert.equal(satisfiesFrameworkRange(">=0.1.0 <1.0.0", "1.0.0"), false);
		assert.equal(satisfiesFrameworkRange(">=0.1.0 <1.0.0", "0.0.9"), false);
	});
});

describe("permission precedence", () => {
	const permissions = { unlisted: "ask" as const, always_allow: ["read_*"], ask_before: ["write_report"], never_allow: ["shell.exec"] };
	it("lets never_allow win over every other list", () => {
		assert.equal(evaluatePermission({ unlisted: "ask", always_allow: ["shell.exec"], ask_before: [], never_allow: ["shell.exec"] }, "shell.exec"), "deny");
	});
	it("matches wildcards", () => {
		assert.equal(evaluatePermission(permissions, "read_repo"), "allow");
		assert.equal(evaluatePermission(permissions, "write_report"), "ask");
	});
	it("answers an unlisted action with the stance the mode declared, and with nothing else", () => {
		// The two answers differ only in the line the mode wrote. A constant here would have made one of these modes
		// impossible to express, which is why the stance is a field rather than a default inside this function.
		assert.equal(evaluatePermission(permissions, "something_new"), "ask");
		assert.equal(evaluatePermission({ ...permissions, unlisted: "allow" }, "something_new"), "allow");
	});
	it("lets always_allow outrank the stance, which is the only case where that list decides anything", () => {
		assert.equal(evaluatePermission({ ...permissions, always_allow: ["something_new"] }, "something_new"), "allow");
	});
});
describe("the approval stance a mode has to state", () => {
	/** The shared fixture with its permission file replaced, so a case can write the stance it is about. */
	const stance = (unlisted: string | undefined, alwaysAllow = ""): WorkModeFiles =>
		files({
			permissions: [
				...(unlisted === undefined ? [] : ["unlisted: " + unlisted]),
				"always_allow: [" + alwaysAllow + "]",
				"ask_before: [write_report]",
				"never_allow: [shell.exec]",
			].join("\n"),
		});

	it("accepts both stances the format defines, and exposes the one the mode wrote", () => {
		assert.equal(loadWorkMode(stance("allow"), { frameworkVersion: FRAMEWORK }).permissions.unlisted, "allow");
		assert.equal(loadWorkMode(stance("ask"), { frameworkVersion: FRAMEWORK }).permissions.unlisted, "ask");
	});

	it("refuses a mode that does not state the stance, naming the field and both ways out", () => {
		const error = expectError(() => loadWorkMode(stance(undefined), { frameworkVersion: FRAMEWORK }), "missing-field");
		assert.match(error.detail, /permissions\.unlisted is required/);
		assert.match(error.detail, /'allow' or 'ask'/, "the refusal names the values rather than only the field");
	});

	it("refuses a stance outside the two the format defines, rather than coercing it", () => {
		const error = expectError(() => loadWorkMode(stance("yolo"), { frameworkVersion: FRAMEWORK }), "invalid-type");
		assert.match(error.detail, /must be one of: allow, ask/, "the refusal lists the values the format defines");
	});

	it("refuses always_allow beside 'allow', because the list could not decide anything", () => {
		const error = expectError(() => loadWorkMode(stance("allow", "read_*"), { frameworkVersion: FRAMEWORK }), "invalid-type");
		assert.match(error.detail, /always_allow/, "the refusal names the list that would not decide");
		assert.match(error.detail, /unlisted: ask/, "and the stance that would make it mean something");
	});

	it("accepts always_allow beside 'ask', which is the only combination it exists for", () => {
		const mode = loadWorkMode(stance("ask", "read_*"), { frameworkVersion: FRAMEWORK });
		assert.deepEqual(mode.permissions.always_allow, ["read_*"]);
		assert.equal(evaluatePermission(mode.permissions, "read_repo"), "allow", "the list decides what the stance would have asked about");
		assert.equal(evaluatePermission(mode.permissions, "something_else"), "ask", "and everything it does not name still asks");
	});
});

describe("every entry in a shipped mode's permission list names an action that can occur", () => {
	// A permission list is matched against **action** names, and there are exactly two kinds: a raw host tool's name,
	// and a capability's name (when the call goes through `agent_run_capability`). An entry that is neither matches
	// nothing while reading as a control - which is what every literal entry in these three files used to be, and what
	// made "no shell" a claim two other files reasoned from.
	//
	// The host's half of the vocabulary is written out rather than imported, because the host's tool names are the
	// thing being checked against: a list that agreed with a copy of itself would prove nothing.
	const HOST_TOOLS = new Set(["bash", "powershell", "read", "edit", "write", "grep", "find", "ls"]);
	// A dotted name, with `*` allowed as the last segment: the namespace wildcard is the shape a mode uses to refuse
	// a whole family of capabilities it has not enumerated.
	const isCapabilityShaped = (entry: string): boolean => /^[a-z][a-z0-9-]*\.([a-z0-9_-]+|\*)$/.test(entry);

	for (const name of ["code-audit", "pentest", "trading"]) {
		it(name + " lists only host tools and capability names", () => {
			const directory = join(process.cwd(), "modes", name);
			const mode = loadWorkMode(
				{
					mode: readFileSync(join(directory, "MODE.md"), "utf8"),
					governance: readFileSync(join(directory, "governance.yaml"), "utf8"),
					permissions: readFileSync(join(directory, "permissions.yaml"), "utf8"),
				},
				{ frameworkVersion: "0.2.0" },
			);
			const entries = [...mode.permissions.always_allow, ...mode.permissions.ask_before, ...mode.permissions.never_allow];
			assert.ok(entries.length > 0, name + " declares at least one entry, so this check is not vacuous");
			for (const entry of entries) {
				assert.ok(
					HOST_TOOLS.has(entry) || isCapabilityShaped(entry),
					name + " lists '" + entry + "', which is neither a host tool name nor a capability name, so it would match no action",
				);
			}
			assert.equal(typeof mode.permissions.unlisted, "string", name + " states what an action on no list gets");
		});
	}
});

describe("the fence", () => {
	/** The same three files, with a `fence` block inserted ahead of `gate`. */
	function fenced(yaml: string): WorkModeFiles {
		return files({ governance: files().governance.replace("gate:", `fence:\n${yaml}\ngate:`) });
	}

	it("carries a declared fence, with every path normalised to a prefix", () => {
		// `modes/**`, `tests/` and `./.dove/effects` are three ways of writing a prefix. `matchesPermission` owns
		// the one wildcard rule this format has, so the fence reuses its shape rather than adding a glob engine -
		// which is why a trailing `/**` is stripped rather than compiled.
		const mode = loadWorkMode(fenced(['  paths: ["modes/**", "tests/", "./.dove/effects", "AGENTS.md"]', "  shell: denied"].join("\n")), { frameworkVersion: FRAMEWORK });
		assert.deepEqual(mode.fence, { paths: ["modes", "tests", ".dove/effects", "AGENTS.md"], shell: "denied" });
	});

	it("carries targets for a tool this repository cannot read a schema for", () => {
		const mode = loadWorkMode(fenced(['  paths: [modes]', "  shell: uncovered", "  targets:", '    notebook_edit: "path"'].join("\n")), { frameworkVersion: FRAMEWORK });
		assert.equal(mode.fence?.shell, "uncovered");
		assert.deepEqual(mode.fence?.targets, { notebook_edit: "path" });
	});

	it("refuses a fence with no usable path, because it would read as fenced and protect nothing", () => {
		for (const yaml of ['  paths: []\n  shell: denied', '  paths: ["  "]\n  shell: denied', '  paths: ["**"]\n  shell: denied', "  shell: denied"]) {
			const error = expectError(() => loadWorkMode(fenced(yaml), { frameworkVersion: FRAMEWORK }), "missing-field");
			assert.match(error.detail, /protecting nothing/, "the refusal says why an empty fence is worse than none");
		}
	});

	it("requires the shell stance, and names both ways out instead of defaulting one", () => {
		// A default would either silently change a mode's tool availability or let the fence read as complete while
		// a one-line `bash` rewrites the policy. `denied` and `uncovered` are both honest; choosing for the author
		// is not - the rule `permissions.unlisted` already follows.
		const error = expectError(() => loadWorkMode(fenced("  paths: [modes]"), { frameworkVersion: FRAMEWORK }), "missing-field");
		assert.match(error.detail, /'denied'/);
		assert.match(error.detail, /'uncovered'/);
		assert.match(error.detail, /never paths/, "and it says why the fence cannot answer this itself");
	});

	it("refuses an unrecognised shell stance, an unknown key, and a target that names nothing", () => {
		expectError(() => loadWorkMode(fenced("  paths: [modes]\n  shell: maybe"), { frameworkVersion: FRAMEWORK }), "invalid-type");
		expectError(() => loadWorkMode(fenced("  paths: [modes]\n  shell: denied\n  mode: strict"), { frameworkVersion: FRAMEWORK }), "unknown-field");
		expectError(() => loadWorkMode(fenced('  paths: [modes]\n  shell: denied\n  targets:\n    notebook_edit: ""'), { frameworkVersion: FRAMEWORK }), "invalid-type");
	});

	it("leaves a mode without a fence exactly as it was, which is what makes this additive", () => {
		assert.equal(loadWorkMode(files(), { frameworkVersion: FRAMEWORK }).fence, undefined);
	});
});

