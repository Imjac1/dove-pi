import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createActionPolicy, type ActionPolicy, type ActionPolicyOptions } from "../src/core/action-policy.ts";
import type { AuthorityDocument } from "../src/core/authority.ts";
import type { GateInvocation } from "../src/core/loop.ts";
import type { WorkMode } from "../src/core/work-mode.ts";

const asCapability = { viaCapability: true } as const;

const AT = "2026-09-26T12:00:00.000Z";
const MODE_IDENTITY = { id: "pentest", version: "1.0.0", governanceVersion: "1.0.0" };

const sha256 = (text: string): string => createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");

/** A workspace with the two evidence files the document below names, and their real digests. */
function workspace(): { root: string; permission: string; inventory: string } {
	const root = mkdtempSync(join(tmpdir(), "dove-policy-"));
	mkdirSync(join(root, "engagements"), { recursive: true });
	const permission = sha256("permission-to-test");
	const inventory = sha256("asset-inventory");
	writeFileSync(join(root, "engagements", "permission-to-test.pdf"), "permission-to-test");
	writeFileSync(join(root, "engagements", "inventory.csv"), "asset-inventory");
	return { root, permission, inventory };
}

function document(permission: string, inventory: string): AuthorityDocument {
	return {
		version: 1,
		engagement: "test-engagement",
		principals: [
			{ id: "client", kind: "grantor" },
			{ id: "operator", kind: "operator" },
		],
		grants: [
			{
				id: "g-client-scope",
				from: "client",
				to: "operator",
				authorizes: { actions: ["net.scan"] },
				targets: ["t-web"],
				evidence: [{ kind: "signed-permission", ref: "engagements/permission-to-test.pdf", sha256: permission }],
			},
		],
		targets: [
			{
				id: "t-web",
				address: "10.0.0.5",
				owner: "client",
				ownership_evidence: { kind: "asset-inventory-attestation", ref: "engagements/inventory.csv", sha256: inventory },
				requires_grants: ["g-client-scope"],
			},
			{
				id: "t-api",
				address: "10.0.0.6",
				owner: "client",
				ownership_evidence: { kind: "asset-inventory-attestation", ref: "engagements/inventory.csv", sha256: inventory },
				requires_grants: ["g-client-scope"],
			},
		],
	};
}

function mode(overrides: Partial<WorkMode> = {}): WorkMode {
	return {
		id: "pentest",
		description: "authorized testing",
		body: "",
		governanceVersion: "1.0.0",
		frameworkRange: ">=0.2.0 <0.3.0",
		governance: {},
		capabilities: ["net.scan", "exploit.run"],
		gateSemantics: "conformance",
		targetArgument: "target",
		authorityGrant: "engagements/authority.yaml",
		permissions: { unlisted: "ask", always_allow: ["net.scan"], ask_before: ["exploit.run"], never_allow: ["dos.*"] },
		limits: [],
		effectClasses: {},
		...overrides,
	};
}

function invocation(tool: string, args: unknown): GateInvocation {
	return { tool, arguments: args, mode: MODE_IDENTITY, at: AT, elapsedMs: 0, accumulatedIntensity: {} };
}

/**
 * A policy over the caller's mode, with **the runtime providing what the mode declares** - the ordinary case, and the
 * one that keeps a test which is not about the registration check from exercising it. A test that is about it passes
 * `registeredCapabilities` explicitly.
 */
function createPolicy(options: Omit<ActionPolicyOptions, "registeredCapabilities"> & { registeredCapabilities?: readonly string[] }): ActionPolicy {
	return createActionPolicy({ registeredCapabilities: options.mode.capabilities, ...options });
}

describe("action policy: one policy, and the order it evaluates in", () => {
	it("allows an action the grant covers, once the evidence digests verify", () => {
		const files = workspace();
		const policy = createPolicy({ mode: mode(), authorityDocument: document(files.permission, files.inventory), workspaceRoot: files.root });
		assert.deepEqual(
			policy.gates,
			["deny", "scope", "registered", "conformance", "ask"],
			"denial, then the ceiling, then the contract, then consent - and no limit gate, because this mode declares no thresholds",
		);
		const decision = policy.evaluate(invocation("net.scan", { target: "t-web" }), asCapability);
		assert.equal(decision.outcome, "allow", JSON.stringify(decision));
	});

	it("builds neither a threshold nor a contract gate for a mode that declares no gate", () => {
		// `gate.semantics: none` is a mode saying it has no gate. The policy is where that becomes visible: `gates` is
		// the list a reader uses to see the policy instead of inferring it, so it must not name a check nobody built.
		const files = workspace();
		const policy = createPolicy({ mode: mode({ gateSemantics: "none" }), workspaceRoot: files.root });
		assert.deepEqual(policy.gates, ["deny", "scope", "registered", "ask"], "denial, the ceiling, what the runtime provides, then consent - and no gate the mode does not have");
	});

	it("refuses a capability the mode declares and nothing registers, naming both ways out", () => {
		const files = workspace();
		// `exploit.run` is in the fixture mode's capabilities and this runtime provides only `net.scan`, which is the
		// shape `modes/trading` has in production: the mode states what its *deployment* must provide.
		const under = createPolicy({ mode: mode({ gateSemantics: "limit" }), workspaceRoot: files.root, registeredCapabilities: ["net.scan"] });
		const decision = under.evaluate(invocation("exploit.run", {}), asCapability);
		assert.equal(decision.outcome, "block");
		assert.match((decision as { reason: string }).reason, /^\[registered\]/, "the reason says which check refused it");
		assert.match((decision as { reason: string }).reason, /nothing in this runtime registers it/);
		assert.match((decision as { remediation: string }).remediation, /authority\.capabilities/, "and gives the way out that is in the mode's hands");
	});

	it("allows the same action once the runtime registers it, and still asks for consent", () => {
		const files = workspace();
		// The check is about the deployment, not about the action: registering it changes nothing else, and
		// `ask_before` still applies. A registration that quietly granted consent would be a second authority path.
		const under = createPolicy({ mode: mode({ gateSemantics: "limit" }), workspaceRoot: files.root, registeredCapabilities: ["net.scan", "exploit.run"] });
		assert.equal(under.evaluate(invocation("exploit.run", {}), asCapability).outcome, "ask");
	});

	it("keeps the registration check behind the scope and the denial, so a deployment problem is not reported as a policy decision", () => {
		const files = workspace();
		const under = createPolicy({ mode: mode({ gateSemantics: "limit" }), workspaceRoot: files.root, registeredCapabilities: [] });
		// Neither declared nor registered: the mode never granted it, and that is the fact worth reporting. Reporting
		// the missing registration instead would send the reader to install something the mode would still refuse.
		const undeclared = under.evaluate(invocation("nope.nope", {}), asCapability);
		assert.equal(undeclared.outcome, "block");
		assert.match((undeclared as { reason: string }).reason, /^\[scope\]/);
		// Denied: the deny list is a policy decision, and it wins over a missing registration.
		const denied = under.evaluate(invocation("dos.syn", {}), asCapability);
		assert.equal(denied.outcome, "block");
		assert.match((denied as { reason: string }).reason, /^\[deny\]/);
	});

	it("leaves a raw tool alone, because the registry is not what governs it", () => {
		const files = workspace();
		// A raw host tool's action is a tool name, and whether the host offers `bash` is the host's business. Gating it
		// on the capability registry would refuse every tool the moment a mode was loaded. What decides it is the
		// mode's own stance, which is the distinction this case exists for.
		const under = createPolicy({ mode: mode({ gateSemantics: "limit" }), workspaceRoot: files.root, registeredCapabilities: [] });
		const decision = under.evaluate(invocation("bash", { command: "ls" }), { viaCapability: false });
		assert.notEqual(decision.outcome, "block", "an empty registry does not refuse a raw tool: " + JSON.stringify(decision));
		assert.equal(decision.outcome, "ask", "the stance is what decides it, and this fixture declares 'unlisted: ask'");
		assert.match((decision as { reason?: string }).reason ?? "", /unlisted: ask/);
	});

	it("refuses a target the grant does not cover, naming the authority", () => {
		const files = workspace();
		const policy = createPolicy({ mode: mode(), authorityDocument: document(files.permission, files.inventory), workspaceRoot: files.root });
		const elsewhere = policy.evaluate(invocation("net.scan", { target: "t-somewhere-else" }), asCapability);
		assert.equal(elsewhere.outcome, "block");
		assert.match((elsewhere as { reason: string }).reason, /^\[conformance\]/, "the reason says which check refused it");
		const uncovered = policy.evaluate(invocation("net.scan", { target: "t-api" }), asCapability);
		assert.equal(uncovered.outcome, "block", "a target whose covering grant does not list it is out of scope");
	});

	it("refuses an action whose target cannot be established rather than treating it as unscoped", () => {
		const files = workspace();
		const policy = createPolicy({ mode: mode(), authorityDocument: document(files.permission, files.inventory), workspaceRoot: files.root });
		const missing = policy.evaluate(invocation("net.scan", {}), asCapability);
		assert.equal(missing.outcome, "block");
		assert.match((missing as { reason: string }).reason, /could not be mapped/);
	});

	it("refuses to check anything when the evidence cannot be read, instead of supplying a placeholder", () => {
		const files = workspace();
		const wrong = document(sha256("something else"), files.inventory);
		const policy = createPolicy({ mode: mode(), authorityDocument: wrong, workspaceRoot: files.root });
		const decision = policy.evaluate(invocation("net.scan", { target: "t-web" }), asCapability);
		assert.equal(decision.outcome, "block", "the digest the file has does not match the digest the document expects");
		assert.match((decision as { reason: string }).reason, /digest mismatch/);
	});

	it("refuses a conformance mode with no document, which the loader makes unreachable and a hand-built policy can still be", () => {
		const files = workspace();
		const policy = createPolicy({ mode: mode(), workspaceRoot: files.root });
		const decision = policy.evaluate(invocation("net.scan", { target: "t-web" }), asCapability);
		assert.equal(decision.outcome, "block");
		assert.match((decision as { reason: string }).reason, /no authority document was loaded/);
	});

	it("denies independently of the target, and a denial cannot be reached around by scope", () => {
		const files = workspace();
		const policy = createPolicy({ mode: mode(), authorityDocument: document(files.permission, files.inventory), workspaceRoot: files.root });
		assert.equal(policy.denyDecision("dos.syn").outcome, "block");
		assert.equal(policy.denyDecision("net.scan").outcome, "allow");
		const denied = policy.denyDecision("dos.syn");
		assert.match((denied as { reason: string }).reason, /never_allow/);
	});

	it("returns 'ask' for an action the mode declares needs consent, instead of deciding consent itself", () => {
		const files = workspace();
		const policy = createPolicy({ mode: mode(), authorityDocument: document(files.permission, files.inventory), workspaceRoot: files.root });
		// exploit.run is ask_before, but conformance refuses it here for a reason of its own - so the consent is never
		// reached, which is the order the policy documents rather than an accident of this fixture.
		const refused = policy.evaluate(invocation("exploit.run", { target: "t-web" }), asCapability);
		assert.equal(refused.outcome, "block", "an action outside the grant is refused by conformance even though the permission list only asked");
		// With nothing else refusing it, the action comes back as `ask`: the declaration is stated, not resolved, because
		// whether consent exists is a fact about the host. The arm is distinct from `allow` on purpose.
		const asked = createPolicy({ mode: mode({ gateSemantics: "limit" }), workspaceRoot: files.root }).evaluate(invocation("exploit.run", {}), asCapability);
		assert.equal(asked.outcome, "ask");
		assert.match((asked as { reason: string }).reason, /^\[ask\]/, "the reason says which check is asking");
		assert.match((asked as { reason: string }).reason, /ask_before/);
	});

	it("answers an unlisted action with the mode's declared stance, so silence is never read as consent", () => {
		const files = workspace();
		// One action, two modes, two answers, and the only difference is the line the mode wrote. The stance is the
		// mode's because a constant would have made one of these two modes impossible to express - and the one that
		// cannot be expressed by a constant is the safe one.
		const asked = createPolicy({ mode: mode({ gateSemantics: "limit" }), workspaceRoot: files.root }).evaluate(invocation("bash", { command: "ls" }), { viaCapability: false });
		assert.equal(asked.outcome, "ask", JSON.stringify(asked));
		assert.match((asked as { reason?: string }).reason ?? "", /unlisted: ask/, "the reason names the line that decided, not a default this code chose");

		const permissive = { unlisted: "allow" as const, always_allow: [], ask_before: ["exploit.run"], never_allow: ["dos.*"] };
		const allowed = createPolicy({ mode: mode({ gateSemantics: "limit", permissions: permissive }), workspaceRoot: files.root }).evaluate(invocation("bash", { command: "ls" }), { viaCapability: false });
		assert.equal(allowed.outcome, "allow", JSON.stringify(allowed));
		assert.equal((allowed as { reason?: string }).reason, undefined, "and there is nothing to say: no list decided it, the stance did");
	});
	it("does not ask the conformance gate about a raw tool, because a document names actions and targets and a call has neither", () => {
		const files = workspace();
		const policy = createPolicy({ mode: mode(), authorityDocument: document(files.permission, files.inventory), workspaceRoot: files.root });
		// Asking conformance about a shell command maps nothing and blocks everything, which is what made an
		// authorized engagement unusable. Raw tools are governed by the permission list and the limits, so the answer
		// here comes from the mode's stance - and the reason says that rather than naming a gate that never looked.
		const shell = policy.evaluate(invocation("bash", { command: "nmap -sV t-web" }), { viaCapability: false });
		assert.equal(shell.outcome, "ask", JSON.stringify(shell));
		assert.match((shell as { reason?: string }).reason ?? "", /^\[ask\]/, "the permission list is what answered");
		assert.doesNotMatch((shell as { reason?: string }).reason ?? "", /conformance/, "and the contract did not look at it");
		// The same policy still checks a capability invocation, and still refuses an out-of-scope target.
		assert.equal(policy.evaluate(invocation("net.scan", { target: "t-elsewhere" }), { viaCapability: true }).outcome, "block");
		assert.equal(policy.evaluate(invocation("net.scan", { target: "t-web" }), { viaCapability: true }).outcome, "allow");
	});

	it("evaluates the denial inside evaluate too, so one entry point is not a way around the other", () => {
		const files = workspace();
		const policy = createPolicy({ mode: mode(), authorityDocument: document(files.permission, files.inventory), workspaceRoot: files.root });
		const denied = policy.evaluate(invocation("dos.syn", { target: "t-web" }), { viaCapability: true });
		assert.equal(denied.outcome, "block", "a caller that runs only evaluate must still get the denial");
		assert.match((denied as { reason: string }).reason, /^\[deny\]/);
	});
	it("refuses a capability the mode does not grant, before any threshold or contract is consulted", () => {
		const files = workspace();
		const policy = createPolicy({ mode: mode(), authorityDocument: document(files.permission, files.inventory), workspaceRoot: files.root });
		const outside = policy.evaluate(invocation("file.write", { target: "t-web" }), { viaCapability: true });
		assert.equal(outside.outcome, "block");
		assert.match((outside as { reason: string }).reason, /^\[scope\]/, "the ceiling refuses it, not the contract: a threshold asks how an action runs, this asks whether the agent may reach it at all");
		// A granted capability passes the scope check and is then decided by the contract.
		assert.equal(policy.evaluate(invocation("net.scan", { target: "t-web" }), { viaCapability: true }).outcome, "allow");
	});
});


