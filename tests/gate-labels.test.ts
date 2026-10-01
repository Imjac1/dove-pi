import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createActionPolicy } from "../src/core/action-policy.ts";
import { GATE_LABELS, GATE_LABEL_NAMES } from "../src/core/task-convergence.ts";
import { gateLabelOf } from "../src/core/loop.ts";
import type { GateDecision } from "../src/core/loop.ts";
import type { WorkMode } from "../src/core/work-mode.ts";

/**
 * **The vocabulary a manifest prediction is validated against, and the producers on the other side of it.**
 *
 * `GATE_LABELS` is the closed set a `gate-refusals` prediction may name: a subject outside it is refused, so a label a
 * producer writes and the set does not carry means **a refusal class nobody can predict**.
 *
 * **What is checked here, and what is checked by the compiler:**
 *
 * - the set and the union come from one declaration, so they cannot disagree - **here**,
 * - the label a refusal carries is a member of the vocabulary - **by the typecheck**, because `labelled` takes a
 *   `GateLabel`. That is what found the eleventh label: the intensity ceiling labelled its refusal `intensity`, the set
 *   carried ten, and three earlier rounds had counted those ten by hand,
 * - the policy gate list is a subset of the vocabulary - **here**, because that list is data whose entries come from gate
 *   objects with wider ids.
 *
 * **What neither checks**: a label in the vocabulary that no producer writes. The type rejects new labels rather than
 * unused ones, and a text scan for the strings is the weak form this repository already withdrew once. Saying so is the
 * point of this comment.
 */

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
		limits: [{ id: "notional", argument: "notional", max: 1000 }],
		effectClasses: {},
		...overrides,
	} as WorkMode;
}

describe("the refusal-label vocabulary", () => {
	it("reads the class out of the reason, and never a gate's own name", () => {
		// **What this field feeds is a count of refusal classes.** `countGateRefusals` splits the recorded value on
		// `+`, and a convergence prediction may name only a member of this vocabulary - so a value outside the set is
		// a refusal nobody can predict. That is the defect the comment above states the rule against, and it was real:
		// the axi turn recorded its gate's id, `action-policy`, in the field. A gate's name is not a class, and the
		// fallback below is what makes an unlabelled reason land in one.
		const block = (reason: string): GateDecision => ({ outcome: "block", reason, remediation: "do the permitted thing" });
		assert.equal(gateLabelOf(block("[limit] over the ceiling"), ["deny", "limit"]), "limit");
		assert.equal(gateLabelOf(block("no prefix at all"), ["deny", "limit"]), "deny+limit", "an unlabelled reason falls back to the set the policy can produce");
		assert.equal(gateLabelOf(block("action-policy says no"), ["deny"]), "deny", "a gate's own name is not a class and must not be recorded as one");
		assert.equal(gateLabelOf({ outcome: "allow" }, ["deny"]), "deny");

		// The property that closes the class: every atom it can produce comes from the vocabulary.
		for (const label of GATE_LABELS) {
			assert.equal(gateLabelOf(block(`[${label}] something`), []), label);
		}
		for (const atom of gateLabelOf(block("no prefix"), [...GATE_LABELS]).split("+")) {
			assert.equal(GATE_LABELS.has(atom), true, `the fallback produced '${atom}', which no prediction may name`);
		}
	});

	it("comes from one declaration, so the set and the union cannot disagree", () => {
		assert.deepEqual([...GATE_LABELS].sort(), [...GATE_LABEL_NAMES].sort());
		assert.equal(GATE_LABELS.size, GATE_LABEL_NAMES.length);
	});

	it("carries every label the policy gate list can produce", () => {
		// The list is data, so this direction is a runtime check. It is the one a type cannot cover: a gate object id is
		// wider than the vocabulary, and the policy reads them.
		const policy = createActionPolicy({ mode: mode(), registeredCapabilities: mode().capabilities, workspaceRoot: process.cwd() });
		const missing = policy.gates.filter((gate) => !GATE_LABELS.has(gate));
		assert.deepEqual(missing, [], "the policy can refuse with these labels and the vocabulary does not carry them");
		assert.ok(policy.gates.length > 0, "and the list is not empty, which would make the check vacuous");
	});

	it("carries the label the intensity ceiling refuses with", () => {
		// The compiler found this one: typing the label a refusal carries rejected `intensity` because the set carried ten,
		// and three earlier rounds had verified those ten by hand. The label is here now, and a prediction may name it.
		assert.ok(GATE_LABELS.has("intensity"));
		assert.ok(GATE_LABELS.has("effect-claim"), "and the one the effect boundary writes in the adapter");
	});
});
