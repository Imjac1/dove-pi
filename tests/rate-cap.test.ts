/**
 * The grant's rate cap, judged where the grant's other constraints are.
 *
 * **The counting end is exercised in `action-policy.test.ts`**, because the count is the policy's - it is the only
 * thing holding session state - while the judgement is this file's subject: `constraints.max_requests_per_second`
 * sat in the schema with **no reader at all**, so a document could advertise a rate limit that nothing limited.
 *
 * A cap that refuses everything and a cap that refuses nothing look the same from a distance, so the cases come in
 * threes: under the cap passes, the call that crosses it is refused *by name*, and a document without the cap is
 * not affected by the field appearing at all.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateAuthority, parseAuthorityDocument, type AuthorityDocument } from "../src/core/authority.ts";

/** A document with one windowed, evidenced grant, carrying the cap under test when one is given. */
function documentWith(cap: number | undefined, digests: { permission: string; inventory: string }): AuthorityDocument {
	// JSON is valid YAML and the parser takes text: writing the object and serialising it keeps this fixture readable
	// while still going through the real parser rather than around it.
	return parseAuthorityDocument(
		JSON.stringify({
			version: 1,
			engagement: "rate-cap",
			principals: [
				{ id: "client", kind: "grantor" },
				{ id: "operator", kind: "operator" },
			],
			grants: [
				{
					id: "g-cap",
					from: "client",
					to: "operator",
					authorizes: { actions: ["net.scan"], outcomes: ["findings-report"] },
					targets: ["t-web"],
					window: { from: "2025-01-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" },
					evidence: [
						{ kind: "signed-permission", ref: "engagements/rate-cap/permission.pdf", sha256: digests.permission },
						{ kind: "tool-output", ref: "engagements/rate-cap/inventory.csv", sha256: digests.inventory },
					],
					constraints: cap === undefined ? {} : { max_requests_per_second: cap },
				},
			],
			targets: [
				{
					id: "t-web",
					address: "10.0.0.5",
					owner: "client",
					ownership_evidence: { kind: "asset-inventory-attestation", ref: "engagements/rate-cap/inventory.csv", sha256: digests.inventory },
					requires_grants: ["g-cap"],
				},
			],
		}),
		"tests/rate-cap.test.ts",
	);
}

const request = (overrides: Record<string, unknown> = {}) => ({
	action: "net.scan",
	target: "t-web",
	at: "2026-10-02T12:00:00.000Z",
	evidenceDigests: { "engagements/rate-cap/permission.pdf": "p", "engagements/rate-cap/inventory.csv": "i" },
	...overrides,
});

describe("the grant's rate cap is decided where the grant's other constraints are", () => {
	it("allows a call that keeps the count inside the cap, and refuses the one that crosses it", () => {
		const document = documentWith(5, { permission: "p", inventory: "i" });
		const under = evaluateAuthority(document, request({ requestsInLastSecond: 4 }));
		assert.equal(under.outcome, "allow", "the fifth call in a second is inside a cap of five: " + JSON.stringify(under));

		const over = evaluateAuthority(document, request({ requestsInLastSecond: 5 }));
		assert.equal(over.outcome, "block", "the sixth call in a second is what the cap forbids: " + JSON.stringify(over));
		assert.match(over.outcome === "block" ? over.reason : "", /max_requests_per_second|rate/iu, "and the refusal names the cap it crossed");
		assert.match(over.outcome === "block" ? over.remediation : "", /wait|raise/iu, "with a remedy rather than only a refusal");
	});

	it("says nothing about a document whose grant declares no cap", () => {
		const document = documentWith(undefined, { permission: "p", inventory: "i" });
		assert.equal(evaluateAuthority(document, request({ requestsInLastSecond: 500 })).outcome, "allow");
	});
});
