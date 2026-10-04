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
	"personal-agent-framework-core.md",
	"personal-agent-mode-format.md",
	"personal-agent-audit-vertical.md",
	"personal-agent-harness-loop.md",
	"personal-agent-convergence-record.md",
	"personal-agent-field-run.md",
	"personal-agent-use-time-architecture.md",
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
		"Design Decision: Adapter Coordination Boundary",
		"V2 Request Planning and Provider Budgets",
		"Request Lifecycle Identity and Retry Contract",
	],
	"personal-agent-capability-runtime.md": [
		"Scenario: Capability Protocol and External Adapters",
		"Scenario: Transactional Workspace Operations",
		"Scenario: Reusable Development Capabilities",
	],
	"personal-agent-project-context.md": [
		"1. Ownership",
		"2. Native State Contract",
		"3. Native Provider",
		"4. Legacy Trellis Compatibility",
		"5. Context And Cache",
		"6. Diagnostics",
		"7. Error Matrix",
		"8. Tests Required",
	],
	"personal-agent-extension-runtime.md": [
		"Scenario: Extension Profiles and Doctor",
		"Scenario: Dove Extension Identity and Authority Synchronization",
	],
	"personal-agent-managed-install.md": ["Scenario: Managed Dove Pi Installation and Stable Updates"],
	"personal-agent-framework-core.md": [
		"Scenario: Loop Ownership and Gate Boundary",
		"Scenario: Authority Grant Graph",
		"Scenario: Effect Identity and Exactly-Once",
		"Scenario: Evidence Plane and Action Checkpoint",
		"Scenario: Context Admission",
		"Scenario: Capability Scoping",
	],
	"personal-agent-mode-format.md": ["Scenario: Work-Mode Layout and Validation"],
	"personal-agent-harness-loop.md": ["Scenario: Bounded Harness Improvement"],
	"personal-agent-convergence-record.md": ["Scenario: Formal Task Convergence State"],
	"personal-agent-audit-vertical.md": [
		"Scenario: Deterministic Seeds and the Coverage Receipt",
		"Scenario: The Finding Claim Schema",
	],
	"personal-agent-field-run.md": ["Scenario: Real-Provider Field Run"],
	"personal-agent-use-time-architecture.md": [
		"1. Who owns the loop",
		"2. The eighteen mount points",
		"3. Where the gate is enforced (today)",
		"4. Process boundaries",
		"5. The trust ladder",
		"6. Where the evidence lands",
		"7. The two blanks, and the one square axi changes",
		"How to check this page",
	],
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