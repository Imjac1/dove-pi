import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const backendSpecDir = join(process.cwd(), ".trellis", "spec", "backend");
const routerName = "personal-agent-runtime.md";
const routedSpecNames = [
	"personal-agent-request-runtime.md",
	"personal-agent-capability-runtime.md",
	"personal-agent-project-context.md",
	"personal-agent-extension-runtime.md",
	"personal-agent-managed-install.md",
] as const;
const expectedHeadingsBySpec = {
	"personal-agent-request-runtime.md": [
		"1. Scope / Trigger",
		"2. Signatures",
		"3. Contracts",
		"4. Validation & Error Matrix",
		"5. Good / Base / Bad Cases",
		"6. Tests Required",
		"7. Wrong vs Correct",
		"Design Decision: Adapter Firewall",
		"V2 Request Planning and Provider Budget Firewall",
		"Request Lifecycle Identity and Retry Contract",
	],
	"personal-agent-capability-runtime.md": [
		"Scenario: Capability Protocol and External Adapters",
		"Scenario: Dispatch Cost Calibration",
		"Scenario: Transactional Workspace Operations",
		"Scenario: Reusable Development Capabilities",
	],
	"personal-agent-project-context.md": [
		"Scenario: Structured Trellis Context",
		"Scenario: Trellis-First Project Provider Firewall",
		"Scenario: Skill Discovery Diagnostics",
	],
	"personal-agent-extension-runtime.md": [
		"Scenario: Extension Profiles and Doctor",
		"Scenario: Dove Extension Identity and Authority Synchronization",
	],
	"personal-agent-managed-install.md": ["Scenario: Managed Dove Pi Installation and Stable Updates"],
} as const satisfies Record<(typeof routedSpecNames)[number], readonly string[]>;

const readSpec = (name: string): string => readFileSync(join(backendSpecDir, name), "utf8");
const normalizedUtf8Bytes = (content: string): number =>
	Buffer.byteLength(content.replace(/\r\n/g, "\n"), "utf8");
const secondLevelHeadings = (content: string): string[] =>
	[...content.matchAll(/^## ([^\r\n]+)$/gm)].map((match) => match[1] ?? "");

describe("personal Agent runtime specification routing", () => {
	it("keeps the router and every routed specification within the project budgets", () => {
		assert.ok(normalizedUtf8Bytes(readSpec(routerName)) <= 8_192, "runtime spec router exceeds 8 KiB");
		for (const name of routedSpecNames) {
			assert.ok(normalizedUtf8Bytes(readSpec(name)) <= 24_576, `${name} exceeds 24 KiB`);
		}
	});

	it("measures context budgets independently of checkout line endings", () => {
		assert.equal(normalizedUtf8Bytes("alpha\nbeta\n"), normalizedUtf8Bytes("alpha\r\nbeta\r\n"));
	});

	it("declares exactly the existing routed runtime specifications", () => {
		const router = readSpec(routerName);
		const targets = [...router.matchAll(/\]\(\.\/(personal-agent-[^)]+\.md)\)/g)].map((match) => match[1]);
		assert.deepEqual(targets, routedSpecNames);
		for (const target of targets) assert.doesNotThrow(() => statSync(join(backendSpecDir, target)));
	});

	it("keeps only routing structure in the router", () => {
		const router = readSpec(routerName);
		assert.deepEqual(secondLevelHeadings(router), ["Runtime specification routes", "Selection rules", "Context budget contract"]);
		assert.doesNotMatch(router, /^#{3,} /m);
		assert.doesNotMatch(router, /```/);
	});

	it("preserves the complete top-level contract inventory in its owning specifications", () => {
		for (const name of routedSpecNames) {
			assert.deepEqual(secondLevelHeadings(readSpec(name)), expectedHeadingsBySpec[name], `unexpected contract inventory in ${name}`);
		}
	});
});
