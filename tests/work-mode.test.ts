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
		permissions: ["always_allow: [read_*]", "ask_before: [write_report]", "never_allow: [shell.exec]"].join("\n"),
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
	const permissions = { always_allow: ["read_*"], ask_before: ["write_report"], never_allow: ["shell.exec"] };
	it("lets never_allow win over every other list", () => {
		assert.equal(evaluatePermission({ always_allow: ["shell.exec"], ask_before: [], never_allow: ["shell.exec"] }, "shell.exec"), "deny");
	});
	it("matches wildcards", () => {
		assert.equal(evaluatePermission(permissions, "read_repo"), "allow");
		assert.equal(evaluatePermission(permissions, "write_report"), "ask");
	});
	it("defaults to ask rather than allow for an unlisted tool", () => {
		assert.equal(evaluatePermission(permissions, "something_new"), "ask");
	});
});
