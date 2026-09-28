import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalizeDoveEntryPath, compareDoveExtensionIdentity, doveImplementationDigest, isSameDoveEntryPath, selectDoveExtension, shouldSuppressDoveWrapper, type DoveExtensionIdentity } from "../src/core/extension-identity.ts";
import { claimDoveRegistration } from "../src/pi-adapter/extension.ts";

const identity = (overrides: Partial<DoveExtensionIdentity> = {}): DoveExtensionIdentity => ({
	extensionId: "dove.personal-agent", version: "1.2.3", implementationDigest: doveImplementationDigest("1.2.3"), entryPath: "C:/managed/personal-agent.ts", origin: "managed", trust: "managed", ...overrides,
});

describe("Dove extension identity", () => {
	it("canonicalizes aliases without treating wrapper text as identity", () => {
		assert.equal(canonicalizeDoveEntryPath("C:\\Managed\\..\\Managed\\personal-agent.ts"), "c:/managed/personal-agent.ts");
		assert.equal(canonicalizeDoveEntryPath("c:/managed/personal-agent.ts"), "c:/managed/personal-agent.ts");
		assert.equal(doveImplementationDigest("1.2.3"), doveImplementationDigest("1.2.3"));
		assert.notEqual(doveImplementationDigest("1.2.4"), doveImplementationDigest("1.2.3"));
		assert.equal(isSameDoveEntryPath("C:\\Release\\.pi\\extensions\\personal-agent.ts", "c:/release/.pi/extensions/personal-agent.ts"), true);
		assert.equal(isSameDoveEntryPath("C:/project/.pi/extensions/personal-agent.ts", "C:/release/.pi/extensions/personal-agent.ts"), false);
		assert.equal(shouldSuppressDoveWrapper({ guardEnabled: true, currentEntry: "C:/release/.pi/extensions/personal-agent.ts", configuredEntry: "C:/release/.pi/extensions/personal-agent.ts" }), false);
		assert.equal(shouldSuppressDoveWrapper({ guardEnabled: true, currentEntry: "C:/project/.pi/extensions/personal-agent.ts", configuredEntry: "C:/release/.pi/extensions/personal-agent.ts" }), true);
		assert.equal(shouldSuppressDoveWrapper({ guardEnabled: false, currentEntry: "C:/project/.pi/extensions/personal-agent.ts", configuredEntry: "C:/release/.pi/extensions/personal-agent.ts" }), false);
	});
	it("answers for an absent managed identity rather than calling it drift", () => {
		// **What this holds and what it does not.** It holds the branch that exists so a source install does not read as drift, because
		// that install has no extension identity at all: no manifest generator ran, the serialiser omitted the field, and validation
		// was skipped for it. It does not hold that the absent identity is *produced* - that is source_release_manifest and the
		// serialiser, held elsewhere - and it does not hold anything about a real adapter beside a real project.
		const project = identity({ origin: "project", trust: "trusted" });
		assert.equal(compareDoveExtensionIdentity(undefined, project), "project_newer", "an absent managed identity is not drift");
		assert.equal(compareDoveExtensionIdentity(undefined, undefined), "unknown", "nor is an absent pair, which is a state and not a fault");
		// The control, in place: the same call with a managed identity present *can* report drift, so the assertions above are not
		// vacuous - they are about absence, not about a function that never says diverged.
		assert.equal(
			compareDoveExtensionIdentity(identity(), identity({ implementationDigest: "different" })),
			"diverged",
			"the control: with something to compare, divergence is reported",
		);
	});
	it("classifies in-sync, version drift, and same-version divergence", () => {
		assert.equal(compareDoveExtensionIdentity(identity(), identity({ origin: "project", trust: "trusted" })), "in_sync");
		assert.equal(compareDoveExtensionIdentity(identity(), identity({ version: "1.2.2", implementationDigest: doveImplementationDigest("1.2.2") })), "managed_newer");
		assert.equal(compareDoveExtensionIdentity(identity(), identity({ version: "1.2.3", implementationDigest: "different" })), "diverged");
	});
	it("keeps managed authority unless a trusted explicit project override is provided", () => {
		const managed = identity();
		const project = identity({ origin: "project", trust: "untrusted", entryPath: "C:/project/personal-agent.ts", version: "9.0.0", implementationDigest: doveImplementationDigest("9.0.0") });
		assert.equal(selectDoveExtension({ managed, project }).selected, managed);
		assert.equal(selectDoveExtension({ managed, project, explicitProject: true, projectTrusted: false }).selected, managed);
		assert.equal(selectDoveExtension({ managed, project, explicitProject: true, projectTrusted: true }).selected?.origin, "explicit");
	});
	it("claims duplicate wrappers once and replaces a stale owner after reload", () => {
		let stale = false;
		const first = { getAllTools() { if (stale) throw new Error("stale"); return []; } } as any;
		const second = { getAllTools() { return []; } } as any;
		assert.equal(claimDoveRegistration(first, identity()), true);
		assert.equal(claimDoveRegistration(second, identity({ origin: "project" })), false);
		stale = true;
		assert.equal(claimDoveRegistration(second, identity({ origin: "project" })), true);
	});
});
