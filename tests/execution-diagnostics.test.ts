import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { projectExecutionDiagnostics } from "../src/core/execution-ledger.ts";

/**
 * **The projection omits a key rather than setting it to undefined, and a consumer sees the difference.** The contract named
 * `lastTerminal` and `lastResourceObservation` as if they were always there; the interface marks them optional and the builder spreads
 * them conditionally, so the prose was the one place that overstated. Measured on a real `doctor` run in a workspace with no ledger
 * records: `schemaVersion` alone, and neither key present.
 *
 * The presence case is asserted elsewhere, in the CLI, adapter and RPC suites. This is the absence case, which is what a fresh workspace
 * gets and which nothing held.
 */
describe("the execution diagnostics projection", () => {
	it("carries only the schema version when the ledger holds nothing to project", () => {
		const projection = projectExecutionDiagnostics([]);
		assert.equal(projection.schemaVersion, 1);
		assert.equal("lastTerminal" in projection, false, "the key is omitted, not present with an undefined value");
		assert.equal("lastResourceObservation" in projection, false);
		assert.deepEqual(Object.keys(projection), ["schemaVersion"], "a key-by-key consumer sees exactly one field here");
	});
});
