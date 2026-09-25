import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadWorkMode, evaluatePermission, type WorkModeFiles } from "../src/core/work-mode.ts";
import { createConformanceGate } from "../src/core/gate-conformance.ts";
import { createAgentLoop } from "../src/core/loop-runner.ts";
import { createScriptedProvider } from "../src/adapters/loop-scripted.ts";
import { fingerprintsOf, toSarifLog, type Finding } from "../src/core/evidence-sarif.ts";
import type { AuthorityDocument } from "../src/core/authority.ts";

const MODE_DIR = join(process.cwd(), "modes", "code-audit");
const FRAMEWORK = "0.2.0";
const MODE_IDENTITY = { id: "code-audit", version: "1.0.0", governanceVersion: "1.0.0" };

async function loadMode() {
	const files: WorkModeFiles = {
		mode: await readFile(join(MODE_DIR, "MODE.md"), "utf8"),
		governance: await readFile(join(MODE_DIR, "governance.yaml"), "utf8"),
		permissions: await readFile(join(MODE_DIR, "permissions.yaml"), "utf8"),
	};
	return loadWorkMode(files, { frameworkVersion: FRAMEWORK });
}

/** The authority contract the mode's conformance gate is checked against. */
const AUTHORITY: AuthorityDocument = {
	version: 1,
	engagement: "audit-1",
	principals: [
		{ id: "repo-owner", kind: "grantor" },
		{ id: "operator", kind: "operator" },
	],
	grants: [
		{
			id: "g-review",
			from: "repo-owner",
			to: "operator",
			authorizes: { actions: ["repo.read", "report.write"] },
			targets: ["repository"],
			evidence: [{ kind: "signed-permission", ref: "review-approval.pdf", sha256: "aaaa" }],
		},
	],
	targets: [{ id: "repository", address: "local", owner: "repo-owner", ownership_evidence: { kind: "inventory", ref: "inv.csv", sha256: "bbbb" }, requires_grants: ["g-review"] }],
};

const DIGESTS = { "review-approval.pdf": "aaaa", "inv.csv": "bbbb" };

const FINDINGS: Finding[] = [
	{ path: "src/db/query.ts", category: "sql-injection", existingCode: 'db.query("... " + id)', message: "User input reaches a SQL statement.", severity: "error", startLine: 42 },
	{ path: "src/http/upload.ts", category: "path-traversal", existingCode: "join(root, req.query.name)", message: "A request value is joined onto a path.", severity: "warning", startLine: 18 },
];

describe("code-audit vertical (first vertical, lowest blast radius)", () => {
	it("loads from disk with no core modification and passes its own permission policy", async () => {
		const mode = await loadMode();
		assert.equal(mode.id, "code-audit");
		assert.equal(mode.governance.gate !== undefined, true);
		assert.equal(evaluatePermission(mode.permissions, "read_file"), "allow");
		assert.equal(evaluatePermission(mode.permissions, "report.write"), "ask");
		assert.equal(evaluatePermission(mode.permissions, "shell.exec"), "deny", "the deny list must survive the mode's own settings");
	});

	it("requires no per-vertical branch in the core", async () => {
		const coreDir = join(process.cwd(), "src", "core");
		const entries = await readdir(coreDir);
		// Comments are stripped first: a module docstring may legitimately say which vertical motivated
		// it, and that is documentation rather than a special case. What must not appear is the mode id
		// in executable code, which would mean the framework grew a branch for one vertical.
		const stripComments = (source: string): string =>
			source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
		const offenders: string[] = [];
		for (const entry of entries.filter((name) => name.endsWith(".ts"))) {
			const source = stripComments(await readFile(join(coreDir, entry), "utf8"));
			if (source.includes("code-audit")) offenders.push(entry);
		}
		assert.deepEqual(offenders, [], "if a vertical needs a core change, that is a framework defect, not a vertical feature");
	});

	it("produces identical finding identities across two runs over the same tree", async () => {
		const first = toSarifLog(FINDINGS, { toolVersion: FRAMEWORK });
		const second = toSarifLog(FINDINGS.map((f) => ({ ...f, message: `${f.message} (reworded by the model)` })), { toolVersion: FRAMEWORK });
		assert.deepEqual([...fingerprintsOf(second)].sort(), [...fingerprintsOf(first)].sort(), "a reworded message must not create a new finding");
	});

	it("transitions baselineState correctly when a finding changes and a new one appears", () => {
		const baseline = fingerprintsOf(toSarifLog(FINDINGS, { toolVersion: FRAMEWORK }));
		const changed: Finding[] = [
			{ ...FINDINGS[0]!, existingCode: 'db.query(safeSql, [id])', message: "Now parameterised." }, // updated -> new identity
			FINDINGS[1]!, // unchanged
			{ path: "src/auth/session.ts", category: "weak-random", existingCode: "Math.random()", message: "Insecure randomness.", severity: "error", startLine: 7 }, // new
		];
		const log = toSarifLog(changed, { toolVersion: FRAMEWORK, baseline });
		const states = new Map(
			(log.runs[0] as { results: { baselineState: string; locations: { physicalLocation: { artifactLocation: { uri: string } } }[] }[] }).results.map((r) => [
				r.locations[0]?.physicalLocation.artifactLocation.uri,
				r.baselineState,
			]),
		);
		assert.equal(states.get("src/db/query.ts"), "new", "a changed finding has a new identity, which is what makes the diff actionable");
		assert.equal(states.get("src/http/upload.ts"), "unchanged");
		assert.equal(states.get("src/auth/session.ts"), "new");
	});

	it("runs the mode's conformance gate end to end and blocks an out-of-scope action", async () => {
		const gate = createConformanceGate({
			document: AUTHORITY,
			toRequest: (invocation) => {
				const action = (invocation.arguments as { action?: string }).action ?? "repo.read";
				return { action, target: invocation.target ?? "", at: invocation.at, evidenceDigests: DIGESTS };
			},
		});
		const inScope = await createAgentLoop({
			provider: createScriptedProvider({ steps: [{ kind: "tools", calls: [{ name: "read_file", arguments: { action: "repo.read" } }] }, { kind: "text", text: "done" }] }),
			model: "m",
			mode: MODE_IDENTITY,
			systemPrompt: "audit",
			tools: [{ name: "read_file", description: "read" }],
			gate,
			maxTurns: 4,
			executeTool: async () => ({ content: "read" }),
			resolveTarget: () => ({ target: "repository", displayTarget: "repository" }),
		}).run("audit");
		assert.equal(inScope.executedActions, 1);

		const outOfScope = await createAgentLoop({
			provider: createScriptedProvider({ steps: [{ kind: "tools", calls: [{ name: "deploy", arguments: { action: "deploy" } }] }, { kind: "text", text: "done" }] }),
			model: "m",
			mode: MODE_IDENTITY,
			systemPrompt: "audit",
			tools: [{ name: "deploy", description: "deploy" }],
			gate,
			maxTurns: 4,
			executeTool: async () => ({ content: "deployed" }),
			resolveTarget: () => ({ target: "repository", displayTarget: "repository" }),
		}).run("audit");
		assert.equal(outOfScope.executedActions, 0, "an action outside the grant is blocked by the mode's own gate");
		assert.match(outOfScope.blockedActions[0]?.reason ?? "", /does not authorize action 'deploy'/);
	});
});
