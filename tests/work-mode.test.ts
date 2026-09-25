import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadWorkMode, satisfiesFrameworkRange, evaluatePermission, WorkModeError, type WorkModeFiles } from "../src/core/work-mode.ts";

const FRAMEWORK = "0.1.0";

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
