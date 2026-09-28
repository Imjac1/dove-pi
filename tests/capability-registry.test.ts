import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CapabilityRegistry } from "../src/core/capability-registry.ts";
// **No type import**: `CapabilityDefinition` is declared locally in the protocol module and not exported, and the existing suite
// registers an inferred literal for the same reason. The shape below is copied from that one rather than guessed.

/**
 * **Which class of defect this holds, and which it does not.** It holds the *registry own four behaviours*: a name resolves, an unknown
 * name is refused and the refusal names it, a duplicate registration is refused, and `get` answers undefined for a name nobody
 * registered. The refusal matters because it is what the rpc interface reports to a caller: an earlier round drove
 * `capability run no.such_capability` and read *Unknown capability: no.such_capability* back, and no test asserted it until now.
 *
 * **It does not hold that the registry is the only place resolution happens** - the invocation service decides what to ask it for - and it
 * does not hold the seventeen call sites, which this file deliberately does not touch.
 */
describe("the capability registry", () => {
		// **Inlined at each call, not returned from a helper.** A helper widens the literal fields - `status` would become `string` rather
	// than its union - so the object stops satisfying the definition. The suite that owns the protocol fixtures inlines for the same
	// reason, and this file copies that shape rather than inventing a second one.
	const register = (registry: CapabilityRegistry, name: string): void => {
		registry.register({
			name, version: "1.0.0", description: "a fixture", platforms: ["any"], sideEffects: ["read_only"], idempotent: true, status: "stable",
			parameterSchema: { type: "object", additionalProperties: false },
			preconditions: [{ id: "workspace", description: "workspace is readable", required: true }],
			evidence: [{ kind: "verification", description: "verified result", required: false }],
			async execute() { return { ok: true }; },
		});
	};

	it("refuses a name it does not hold, and the refusal names it", () => {
		const registry = new CapabilityRegistry();
		register(registry, "fixture.read");
		assert.throws(
			() => registry.require("no.such.capability"),
			/Unknown capability: no\.such\.capability/,
			"the refusal carries the name, which is what a caller can act on",
		);
		// The control, in place: the same call for a name that *is* held resolves, so the assertion above is about the refusal and not
		// about a method that always throws.
		assert.equal(registry.require("fixture.read").name, "fixture.read", "the control: a held name resolves");
	});

	it("answers undefined for a name nobody registered, rather than throwing", () => {
		const registry = new CapabilityRegistry();
		assert.equal(registry.get("no.such.capability"), undefined, "get is the quiet half of the same lookup");
	});

	it("refuses a duplicate registration, naming the capability", () => {
		const registry = new CapabilityRegistry();
		register(registry, "fixture.read");
		assert.throws(
			() => register(registry, "fixture.read"),
			/Capability already registered: fixture\.read/,
			"a second registration would silently replace the first",
		);
		assert.equal(registry.list().length, 1, "and the first is still the only one");
	});
});