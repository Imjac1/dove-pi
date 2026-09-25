import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CapabilityWideningError, createCapabilityScope } from "../src/core/capability-scope.ts";

const NOW = "2026-09-25T12:00:00.000Z";

function scope() {
	return createCapabilityScope({
		now: () => NOW,
		sets: [
			{ agentId: "auditor", capabilities: [{ id: "repo.read" }, { id: "file.write", resource: "reports/**" }] },
			{ agentId: "narrowed", capabilities: [{ id: "repo.read" }, { id: "file.write", resource: "reports/**" }] },
			{ agentId: "expiring", capabilities: [{ id: "repo.read", expiresAt: "2026-09-24T00:00:00.000Z" }] },
		],
	});
}

describe("capability scoping (the strongest measured control)", () => {
	it("allows an action the issuing agent holds a capability for", () => {
		assert.equal(scope().authorize({ agentId: "auditor", capability: "repo.read" }).outcome, "allow");
	});

	it("denies an action the issuing agent does not hold, however plausible the name", () => {
		// The injection case: untrusted text can name any resource it likes; naming is not authority.
		const decision = scope().authorize({ agentId: "auditor", capability: "shell.exec", resource: "/etc/passwd" });
		assert.equal(decision.outcome, "deny");
		assert.match(decision.outcome === "deny" ? decision.reason : "", /does not hold capability 'shell.exec'/);
	});

	it("denies an agent that has no capability set at all, rather than defaulting to permissive", () => {
		const decision = scope().authorize({ agentId: "stranger", capability: "repo.read" });
		assert.equal(decision.outcome, "deny");
		assert.match(decision.outcome === "deny" ? decision.reason : "", /has no capability set/);
	});

	it("enforces resource restrictions and says what is held instead", () => {
		assert.equal(scope().authorize({ agentId: "auditor", capability: "file.write", resource: "reports/q3.md" }).outcome, "allow");
		const outside = scope().authorize({ agentId: "auditor", capability: "file.write", resource: "src/core/loop.ts" });
		assert.equal(outside.outcome, "deny");
		assert.match(outside.outcome === "deny" ? outside.reason : "", /held: reports\/\*\*/);
	});

	it("stops honouring an expired capability", () => {
		assert.equal(scope().authorize({ agentId: "expiring", capability: "repo.read" }).outcome, "deny");
	});

	it("does not let one agent's capability be used by another, which is the delegation case", () => {
		const s = scope();
		assert.equal(s.authorize({ agentId: "auditor", capability: "file.write", resource: "reports/a.md" }).outcome, "allow");
		// A subagent does not inherit the parent's authority merely by existing.
		assert.equal(s.authorize({ agentId: "child", capability: "file.write", resource: "reports/a.md" }).outcome, "deny");
	});

	it("lets a delegate narrow its authority", () => {
		const s = scope();
		const child = s.narrow("auditor", { agentId: "child", capabilities: [{ id: "repo.read" }] });
		assert.deepEqual(child.capabilities, [{ id: "repo.read" }]);
		assert.equal(s.authorize({ agentId: "child", capability: "repo.read" }).outcome, "allow");
		assert.equal(s.authorize({ agentId: "child", capability: "file.write", resource: "reports/a.md" }).outcome, "deny");
	});

	it("refuses a delegate that tries to widen, including by claiming a broader resource", () => {
		const s = scope();
		assert.throws(() => s.narrow("auditor", { agentId: "child", capabilities: [{ id: "shell.exec" }] }), CapabilityWideningError);
		assert.throws(() => s.narrow("auditor", { agentId: "child", capabilities: [{ id: "file.write" }] }), CapabilityWideningError);
		assert.throws(() => s.narrow("auditor", { agentId: "child", capabilities: [{ id: "file.write", resource: "src/**" }] }), CapabilityWideningError);
	});

	it("narrows an unrestricted parent capability by adding a resource", () => {
		const s = scope();
		const child = s.narrow("auditor", { agentId: "child", capabilities: [{ id: "repo.read", resource: "docs/**" }] });
		assert.equal(s.authorize({ agentId: "child", capability: "repo.read", resource: "docs/x.md" }).outcome, "allow");
		assert.equal(s.authorize({ agentId: "child", capability: "repo.read", resource: "src/x.ts" }).outcome, "deny");
		assert.deepEqual(child.capabilities, [{ id: "repo.read", resource: "docs/**" }]);
	});

	it("exposes no path that renders the capability set into model-visible text", () => {
		const s = scope();
		assert.deepEqual(Object.keys(s).sort(), ["authorize", "capabilitiesOf", "narrow"], "a capability the model can read is one it can be persuaded to describe");
		const decision = s.authorize({ agentId: "auditor", capability: "repo.read" });
		assert.equal(JSON.stringify(decision), JSON.stringify({ outcome: "allow", capability: "repo.read" }), "an allow decision carries no inventory");
	});
});
