import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadWorkMode, evaluatePermission, type WorkModeFiles } from "../src/core/work-mode.ts";
import { effectClassOf } from "../src/core/effect-ledger.ts";
import { createConformanceGate } from "../src/core/gate-conformance.ts";
import { createAgentLoop } from "../src/core/loop-runner.ts";
import { createScriptedProvider } from "../src/adapters/loop-scripted.ts";
import { baselineOf, fingerprintsOf, toSarifLog, type Finding } from "../src/core/evidence-sarif.ts";
import type { AuthorityDocument } from "../src/core/authority.ts";
import { createDoveRuntime } from "../src/runtime.ts";
import { parseCatalog } from "../src/code-audit/catalog.ts";
import { scanCategory } from "../src/code-audit/seed-scanner.ts";

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


/** A claim that satisfies the schema, so the disposition check is exercised on real input. */
const wellFormedClaim = (candidateId: string): Record<string, unknown> => ({
	candidateId,
	category: "SQL_INJECTION",
	severity: "HIGH",
	status: "CONFIRMED",
	runtimeStatus: "NOT_TESTED",
	ruleChecks: Object.fromEntries(
		["sink_semantics", "entry_reachability", "source_controllability", "data_flow", "parameter_usage", "defense_effectiveness", "auth_boundary", "combination_chains", "category_requirements"].map((check) => [
			check,
			"For " + candidateId + ", examined the " + check + " and found a concrete reason.",
		]),
	),
	categoryProof: {
		sql_executed: "The statement reaches the driver with the value interpolated.",
		syntax_influenced: "The value changes the predicate, not just the operand.",
		source_controlled: "The value comes straight from the query string.",
		parameterization_absent: "The call site concatenates and never binds.",
	},
	title: "An identifier reaches a statement unbound",
	impact: "A caller can read rows outside their own tenant.",
	remediation: "Bind the value instead of concatenating it.",
	callChain: [
		{ kind: "ROUTE", location: "src/db/query.ts:42", note: "The request reaches this handler." },
		{ kind: "SINK", location: "src/db/query.ts:45", note: "The statement is executed here." },
	],
	poc: { format: "curl", request: "curl -s localhost/api/users?id=1", successIndicator: "Rows from another tenant come back." },
});

/** A real scan of the fixture: real seeds, a real receipt, and the digest binding between them. */
const scanFixture = () => {
	const catalog = parseCatalog(readFileSync(join(process.cwd(), "modes", "code-audit", "catalog", "typescript.json"), "utf8"));
	return scanCategory({ catalog, category: "SQL_INJECTION", roots: [join(process.cwd(), "tests", "fixtures", "code-audit", "vulnerable")], scope: "test" });
};

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

	it("transitions baselineState correctly when a finding is edited and a new one appears", () => {
		const baseline = baselineOf(toSarifLog(FINDINGS, { toolVersion: FRAMEWORK }));
		const changed: Finding[] = [
			// The matched code changed where the finding already was. Under the old two-state contract this
			// read as "new", which is the defect: an edit in place is an update, and reporting it as new is
			// what turns a re-run into noise. Tier 3 matches it by (category, path).
			{ ...FINDINGS[0]!, existingCode: 'db.query(safeSql, [id])', message: "Now parameterised." }, // updated
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
		assert.equal(states.get("src/db/query.ts"), "updated", "an edit in place is an update, not a new defect");
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

	it("registers the vertical capabilities in the shared runtime, with honest effects", () => {
		const runtime = createDoveRuntime();
		const names = runtime.capabilities.list().map((capability) => capability.name);
		assert.ok(names.includes("code-audit.seed"), "the seed scanner must be reachable");
		assert.ok(names.includes("code-audit.diff"), "the diff must be reachable");

		const seed = runtime.capabilities.require("code-audit.seed");
		assert.deepEqual(seed.sideEffects, ["read_only"], "the scanner reads text and hashes files; claiming more would be dishonest");
		assert.equal(seed.idempotent, true, "the same tree yields the same seeds, so a retry is safe");

		const diff = runtime.capabilities.require("code-audit.diff");
		assert.deepEqual(diff.sideEffects, ["workspace_write"], "the diff writes an artifact and touches nothing else");
		assert.equal(diff.idempotent, true);
	});

	it("keeps the mode the authority list for those capabilities", async () => {
		// A capability that is registered but not declared by the mode is authority the mode never
		// granted. The two lists have to agree, and the mode is the one that governs.
		const mode = await loadMode();
		const declared = (mode.governance as { authority: { capabilities: readonly string[] } }).authority.capabilities;
		const registered = createDoveRuntime()
			.capabilities.list()
			.map((capability) => capability.name)
			.filter((name) => name.startsWith("code-audit."));
		assert.ok(registered.length > 0);
		for (const name of registered) assert.ok(declared.includes(name), name + " is registered but not declared by the mode");
	});


	it("enforces the every-seed-dispositioned rule through a capability, not only a helper", async () => {
		// A helper that exists but is never called is not enforcement.
		const disposition = createDoveRuntime().capabilities.require("code-audit.disposition");
		const context = { cwd: process.cwd(), mode: "default" } as never;
		const { seeds, receipt } = scanFixture();

		// One seed left unmentioned: refused, and named.
		await assert.rejects(
			async () => disposition.execute({ seeds, receipt, claims: seeds.slice(1).map((seed) => wellFormedClaim(seed.candidateId)) }, context),
			new RegExp("no disposition: " + seeds[0]!.candidateId),
		);

		// A claim the schema rejects: also refused.
		await assert.rejects(
			async () =>
				disposition.execute(
					{
						seeds,
						receipt,
						claims: [{ candidateId: seeds[0]!.candidateId, category: "SQL_INJECTION", severity: "HIGH", status: "CONFIRMED", runtimeStatus: "NOT_TESTED", ruleChecks: {} }],
					},
					context,
				),
			/claim error/,
		);
	});

	it("refuses a candidate claimed twice, and reports the breakdown from the same walk", async () => {
		// The cardinality rule. `findUndispositionedSeeds` only checks the superset direction - every seed
		// mentioned - so a duplicate was accepted: four seeds with one candidate claimed twice produced six
		// claims and a breakdown that could not tell four dispositions from two done twice. A count is not a
		// closure claim unless the multiplicity is one.
		const disposition = createDoveRuntime().capabilities.require("code-audit.disposition");
		const context = { cwd: process.cwd(), mode: "default" } as never;
		const { seeds, receipt } = scanFixture();
		const claims = seeds.map((seed) => wellFormedClaim(seed.candidateId));

		await assert.rejects(
			async () => disposition.execute({ seeds, receipt, claims: [...claims, wellFormedClaim(seeds[0]!.candidateId)] }, context),
			new RegExp("candidate " + seeds[0]!.candidateId + " is claimed twice"),
		);

		// And the breakdown comes from the reconciliation, so it describes a proven claim set.
		const report = (await disposition.execute({ seeds, receipt, claims }, context)) as { claimsByStatus: Record<string, number> };
		assert.deepEqual(report.claimsByStatus, { CONFIRMED: seeds.length }, "the breakdown describes a proven claim set");
	});

	it("refuses a seed set that does not match the receipt the scan produced", async () => {
		// The check ground truth used to be an id list supplied by whoever was being checked, and a scan of
		// the fixture that produced four seeds passed it by reporting none: dropping seeds - the act the rule
		// exists to prevent - was satisfiable. The ids are derived from the seeds here, and the seeds are
		// bound to the receipt, so a shorter list cannot be handed in at all.
		const disposition = createDoveRuntime().capabilities.require("code-audit.disposition");
		const context = { cwd: process.cwd(), mode: "default" } as never;
		const { seeds, receipt } = scanFixture();
		assert.ok(seeds.length >= 2, "the fixture has at least two SQL candidates");

		await assert.rejects(async () => disposition.execute({ seeds: [], receipt, claims: [] }, context), /do not match the receipt/);
		await assert.rejects(
			async () => disposition.execute({ seeds: seeds.slice(1), receipt, claims: seeds.slice(1).map((seed) => wellFormedClaim(seed.candidateId)) }, context),
			/do not match the receipt/,
		);

		// The unmodified scan output passes, so the refusal above is the binding and not a blanket one.
		const verified = (await disposition.execute({ seeds, receipt, claims: seeds.map((seed) => wellFormedClaim(seed.candidateId)) }, context)) as {
			seedDigestVerified: boolean;
			undispositioned: readonly string[];
		};
		assert.equal(verified.seedDigestVerified, true);
		assert.deepEqual(verified.undispositioned, []);
	});

	it("reports repeated explanations through the capability, not only through the helper", async () => {
		// The capability put the id and the claim into an if/else on the same condition, so the claim list
		// was always empty and this check never fired. Calling the helper directly returned nine repeats
		// while the capability returned none, which is what exposed it.
		const disposition = createDoveRuntime().capabilities.require("code-audit.disposition");
		const context = { cwd: process.cwd(), mode: "default" } as never;
		const { seeds, receipt } = scanFixture();
		const ids = seeds.map((seed) => seed.candidateId);
		const first = wellFormedClaim(ids[0]!);
		// The second claim repeats the first explanations verbatim but is otherwise its own claim, so the
		// schema accepts it and only the repetition is wrong. The rest are ordinary claims.
		const second = { ...wellFormedClaim(ids[1]!), ruleChecks: first["ruleChecks"] };
		const claims = ids.map((id, index) => (index === 0 ? first : index === 1 ? second : wellFormedClaim(id)));
		const report = (await disposition.execute({ seeds, receipt, claims }, context)) as { repeatedExplanations: readonly string[] };
		assert.equal(report.repeatedExplanations.length, 9, "all nine explanations are repeated verbatim");
		assert.ok(report.repeatedExplanations.every((entry) => entry.includes("repeats")));
	});

	it("refuses to write a report while a seed has no disposition", async () => {
		// The enforcement point. The rule is checked where the artifact is produced rather than by asking the
		// caller to remember to check, which is the pattern scanCategory already uses for its own receipt.
		// The check runs before any file is opened, so a refusal here needs no fixture on disk.
		const diff = createDoveRuntime().capabilities.require("code-audit.diff");
		const context = { cwd: process.cwd(), mode: "default" } as never;
		const { seeds, receipt } = scanFixture();
		const attempt = (submitted: typeof seeds, claims: readonly unknown[]) =>
			diff.execute({ baselinePath: "a.sarif", outputPath: "c.sarif", seeds: submitted, receipt, claims }, context);

		await assert.rejects(
			async () => attempt(seeds, seeds.slice(1).map((seed) => wellFormedClaim(seed.candidateId))),
			new RegExp("no disposition: " + seeds[0]!.candidateId),
		);

		// A seed set that does not match the receipt refuses it too.
		await assert.rejects(async () => attempt([], []), /do not match the receipt/);

		// With every seed dispositioned it proceeds past the check, so the refusals above are the check
		// rather than a blanket refusal. It then fails on the missing baseline file, as expected here.
		await assert.rejects(
			async () => attempt(seeds, seeds.map((seed) => wellFormedClaim(seed.candidateId))),
			(error: Error) => !/disposition incomplete/.test(error.message) && !/do not match the receipt/.test(error.message),
		);
	});

	it("accepts a run where every seed is dispositioned and every claim is well formed", async () => {
		const disposition = createDoveRuntime().capabilities.require("code-audit.disposition");
		const context = { cwd: process.cwd(), mode: "default" } as never;
		const { seeds, receipt } = scanFixture();
		const report = (await disposition.execute({ seeds, receipt, claims: seeds.map((seed) => wellFormedClaim(seed.candidateId)) }, context)) as {
			ok: boolean;
			seedCount: number;
			undispositioned: readonly string[];
			claimErrors: readonly string[];
		};
		assert.equal(report.ok, true, "errors: " + report.claimErrors.join("; "));
		assert.equal(report.seedCount, seeds.length);
		assert.deepEqual(report.undispositioned, []);
	});

	it("bumped the mode version when its authority changed", async () => {
		const mode = await loadMode();
		const governance = mode.governance as { version: string; evidence: { artifacts: readonly string[] } };
		// 1.4.0 because the mode now declares which of its effects a retry may repeat, and that is a change to
		// what it authorizes - the same reason 1.2.0 and 1.3.0 were bumped. A version that does not move when the
		// authority set does cannot attribute a run to one authority set.
		assert.equal(governance.version, "1.4.0", "an authority change increments the version, so a run can be attributed to one");
		assert.ok(governance.evidence.artifacts.includes("coverage.json"), "the receipt is an artifact of the run, not an aside");
	});

	it("declares which of its effects a retry may repeat, and defaults the rest to non-idempotent", async () => {
		const mode = await loadMode();
		// The mapping is consumed by the claim at the dispatch line through effectClassOf, which reports an
		// undeclared tool as a default rather than as a declaration - so an omission cannot grant a retry.
		assert.equal(effectClassOf("code-audit.seed", mode.effectClasses).effectClass, "idempotent");
		assert.equal(effectClassOf("code-audit.seed", mode.effectClasses).declared, true);
		const undeclared = effectClassOf("bash", mode.effectClasses);
		assert.equal(undeclared.effectClass, "non-idempotent", "running a command twice is two commands");
		assert.equal(undeclared.declared, false, "and the caller can see that the mode did not say so");
		assert.equal(effectClassOf("edit", mode.effectClasses).effectClass, "non-idempotent", "a patch applied twice is not the state one application produced");
	});
});
