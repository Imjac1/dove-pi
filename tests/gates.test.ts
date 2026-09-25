import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLimitGate, LimitSpecError } from "../src/core/gate-limit.ts";
import { createConformanceGate } from "../src/core/gate-conformance.ts";
import { evaluateAuthority, type AuthorityDocument } from "../src/core/authority.ts";
import type { GateInvocation } from "../src/core/loop.ts";

const MODE = { id: "test", version: "1.0.0", governanceVersion: "1" };
const AT = "2026-09-25T12:00:00.000Z";

function invocation(tool: string, args: unknown, target?: string): GateInvocation {
	return { tool, arguments: args, ...(target === undefined ? {} : { target, displayTarget: target }), mode: MODE, at: AT, elapsedMs: 0, accumulatedIntensity: {} };
}

describe("limit gate (threshold semantics, for order-entry style controls)", () => {
	const gate = createLimitGate([
		{ id: "notional", argument: "order.notional", max: 100_000, unit: "USD" },
		{ id: "quantity", argument: "order.quantity", min: 1, max: 10_000 },
	]);

	it("allows an action inside the declared bounds", () => {
		assert.equal(gate.evaluate(invocation("order.submit", { order: { notional: 50_000, quantity: 100 } })).outcome, "allow");
	});

	it("blocks above the maximum and states the limit", () => {
		const decision = gate.evaluate(invocation("order.submit", { order: { notional: 250_000, quantity: 100 } }));
		assert.equal(decision.outcome, "block");
		assert.match((decision as { reason: string }).reason, /exceeds limit 'notional'/);
		assert.match((decision as { reason: string }).reason, /250000 USD is above the permitted maximum of 100000 USD/);
	});

	it("blocks below the minimum", () => {
		const decision = gate.evaluate(invocation("order.submit", { order: { notional: 10, quantity: 0 } }));
		assert.equal(decision.outcome, "block");
		assert.match((decision as { reason: string }).reason, /below limit 'quantity'/);
	});

	it("fails closed when a required argument is absent", () => {
		const decision = gate.evaluate(invocation("order.submit", { order: { quantity: 5 } }));
		assert.equal(decision.outcome, "block", "a limit gate that passes on a missing value is worse than no gate");
		assert.match((decision as { reason: string }).reason, /could not be evaluated/);
	});

	it("fails closed when the argument is not a finite number", () => {
		const decision = gate.evaluate(invocation("order.submit", { order: { notional: "lots", quantity: 5 } }));
		assert.equal(decision.outcome, "block");
		assert.match((decision as { reason: string }).reason, /not a finite number/);
	});

	it("rejects at construction a limit that can never decide anything", () => {
		assert.throws(() => createLimitGate([{ id: "useless", argument: "x" }]), LimitSpecError);
	});

	it("passes a non-required limit when its argument is absent", () => {
		const lenient = createLimitGate([{ id: "optional", argument: "opt", max: 1, required: false }]);
		assert.equal(lenient.evaluate(invocation("t", {})).outcome, "allow");
	});
});

describe("conformance gate (scope semantics, for authorized engagement work)", () => {
	const document: AuthorityDocument = {
		version: 1,
		engagement: "eng-1",
		principals: [
			{ id: "client", kind: "grantor" },
			{ id: "operator", kind: "operator" },
			{ id: "hosting", kind: "third-party" },
		],
		grants: [
			{
				id: "g-client",
				from: "client",
				to: "operator",
				authorizes: { actions: ["scan", "exploit"] },
				targets: ["t-web"],
				window: { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" },
				evidence: [{ kind: "signed-permission", ref: "perm.pdf", sha256: "aaaa" }],
				constraints: { excluded_techniques: ["dos"], intensity: { discovery: 2, exploitation: 1 } },
			},
			{
				id: "g-host",
				from: "hosting",
				to: "operator",
				authorizes: { actions: ["scan"] },
				targets: ["t-web"],
				external_state: { kind: "provider-form", ref: "aws-form", state: "approved", checked_at: "2026-09-25T06:00:00.000Z" },
			},
		],
		targets: [{ id: "t-web", address: "10.0.0.5", owner: "client", ownership_evidence: { kind: "inventory", ref: "inv.csv", sha256: "bbbb" }, requires_grants: ["g-client", "g-host"] }],
	};
	const digests = { "perm.pdf": "aaaa", "inv.csv": "bbbb" };
	const gate = createConformanceGate({ document, toRequest: (i) => ({ action: String((i.arguments as { action?: string }).action ?? "scan"), target: i.target ?? "", at: i.at, evidenceDigests: digests }) });

	it("allows an action fully covered by every required grant", () => {
		const decision = gate.evaluate(invocation("scan", { action: "scan" }, "t-web"));
		assert.equal(decision.outcome, "allow");
		assert.match((decision as { reason: string }).reason, /Authorized by g-client, g-host/);
	});

	it("blocks a target that is not in the document, rather than treating an empty scope as unrestricted", () => {
		const decision = gate.evaluate(invocation("scan", { action: "scan" }, "t-unknown"));
		assert.equal(decision.outcome, "block");
		assert.match((decision as { reason: string }).reason, /not present in authority document/);
	});

	it("blocks when ownership evidence cannot be verified", () => {
		const noDigest = createConformanceGate({ document, toRequest: (i) => ({ action: "scan", target: i.target ?? "", at: i.at, evidenceDigests: { "perm.pdf": "aaaa" } }) });
		const decision = noDigest.evaluate(invocation("scan", {}, "t-web"));
		assert.equal(decision.outcome, "block");
		assert.match((decision as { reason: string }).reason, /no digest was supplied/);
	});

	it("blocks an action the grant does not authorize", () => {
		const decision = gate.evaluate(invocation("destroy", { action: "destroy" }, "t-web"));
		assert.equal(decision.outcome, "block");
		assert.match((decision as { reason: string }).reason, /does not authorize action 'destroy'/);
	});

	it("blocks when the required grant is missing from the document", () => {
		const thin: AuthorityDocument = { ...document, grants: document.grants.filter((g) => g.id !== "g-host") };
		const g = createConformanceGate({ document: thin, toRequest: (i) => ({ action: "scan", target: i.target ?? "", at: i.at, evidenceDigests: digests }) });
		const decision = g.evaluate(invocation("scan", {}, "t-web"));
		assert.equal(decision.outcome, "block");
		assert.match((decision as { reason: string }).reason, /requires grant 'g-host', which is not present/);
	});

	it("blocks a grant issued by the operator itself", () => {
		const selfGranted: AuthorityDocument = { ...document, grants: document.grants.map((g) => (g.id === "g-client" ? { ...g, from: "operator" } : g)) };
		const g = createConformanceGate({ document: selfGranted, toRequest: (i) => ({ action: "scan", target: i.target ?? "", at: i.at, evidenceDigests: digests }) });
		const decision = g.evaluate(invocation("scan", {}, "t-web"));
		assert.equal(decision.outcome, "block");
		assert.match((decision as { reason: string }).reason, /issued by the operator itself/);
	});

	it("blocks an action outside the grant window", () => {
		const decision = evaluateAuthority(document, { action: "scan", target: "t-web", at: "2026-11-01T00:00:00.000Z", evidenceDigests: digests });
		assert.equal(decision.outcome, "block");
		assert.match((decision as { reason: string }).reason, /outside its window/);
	});

	it("blocks when an external approval is pending or stale", () => {
		const pending: AuthorityDocument = { ...document, grants: document.grants.map((g) => (g.id === "g-host" ? { ...g, external_state: { ...g.external_state!, state: "pending" as const } } : g)) };
		const stale: AuthorityDocument = { ...document, grants: document.grants.map((g) => (g.id === "g-host" ? { ...g, external_state: { ...g.external_state!, checked_at: "2026-09-01T00:00:00.000Z" } } : g)) };
		assert.match((evaluateAuthority(pending, { action: "scan", target: "t-web", at: AT, evidenceDigests: digests }) as { reason: string }).reason, /which is 'pending'/);
		assert.match((evaluateAuthority(stale, { action: "scan", target: "t-web", at: AT, evidenceDigests: digests }) as { reason: string }).reason, /which is stale/);
	});

	it("blocks an excluded technique and an over-ceiling intensity", () => {
		assert.match((evaluateAuthority(document, { action: "scan", target: "t-web", at: AT, technique: "dos", evidenceDigests: digests }) as { reason: string }).reason, /excluded by grant/);
		assert.match((evaluateAuthority(document, { action: "scan", target: "t-web", at: AT, phase: "discovery", intensity: 5, evidenceDigests: digests }) as { reason: string }).reason, /exceeds the ceiling 2/);
	});

	it("blocks when the action cannot be mapped to a request at all", () => {
		const unmappable = createConformanceGate({ document, toRequest: () => undefined });
		const decision = unmappable.evaluate(invocation("mystery", {}, "t-web"));
		assert.equal(decision.outcome, "block", "'cannot tell' is not 'allowed'");
		assert.match((decision as { reason: string }).reason, /could not be mapped/);
	});
});
