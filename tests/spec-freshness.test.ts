import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { RULE_CHECKS } from "../src/code-audit/claim-schema.ts";
import { createDoveRuntime } from "../src/runtime.ts";

/**
 * The freshness door: a page may state a number about this repository, and the number must still be the one the
 * repository yields.
 *
 * The citation doors check that a **path and line** still exist, which catches a moved file. They say nothing about a
 * **count**, and a count is what rots without anyone touching the sentence: the mode-format page said "six of the
 * nine capabilities" until a fourth mode landed, and nothing failed. This door is that check for the numbers that are
 * mechanically countable.
 *
 * **Every occurrence has to agree, not the first one found.** A page that says the right number in one sentence and a
 * stale one in another is the failure this exists for, and a check that stops at the first match would pass it.
 *
 * **A claim that disappeared is also a failure.** If the sentence is rewritten away, the row stops matching and the
 * door fails, because a row nobody can find is a row nobody is checking - the alternative is a green check that has
 * quietly stopped covering anything.
 *
 * A number this cannot compute is not a row here. Prose counts ("three rules the loop enforces itself") have no
 * source in code, and a door that guessed at them would be a door that lies.
 */

const REPO = resolve(import.meta.dirname, "..");
const SPEC = join(REPO, ".trellis", "spec");

/** The number words a page may use instead of digits, so a row does not force a rewrite of good prose. */
const NUMBER_WORDS: Readonly<Record<string, number>> = {
	one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
	eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

function numberOf(raw: string): number | undefined {
	const word = NUMBER_WORDS[raw.toLowerCase()];
	if (word !== undefined) return word;
	const digits = Number(raw);
	return Number.isFinite(digits) ? digits : undefined;
}

/** Every capability name the runtime registers, asked of the runtime's own composition root. */
function registeredCapabilities(): readonly string[] {
	return createDoveRuntime().capabilities.list().map((capability) => capability.name);
}

/** Every capability name the shipped modes declare in `authority.capabilities`. */
function declaredCapabilities(): readonly string[] {
	const declared: string[] = [];
	for (const mode of readdirSync(join(REPO, "modes"), { withFileTypes: true })) {
		if (!mode.isDirectory()) continue;
		const governance = readFileSync(join(REPO, "modes", mode.name, "governance.yaml"), "utf8");
		const block = /capabilities:\s*\[([^\]]*)\]/u.exec(governance);
		if (block === null) continue;
		for (const entry of (block[1] as string).split(",")) {
			const name = entry.trim();
			if (name !== "") declared.push(name);
		}
	}
	return declared;
}

interface FreshnessRow {
	/** Why this row exists, in the words of the failure it prevents. */
	readonly what: string;
	/** The page that states the number, relative to the repository root. */
	readonly file: string;
	/** A global regex with **named** groups, each holding one stated number. Every match of every group must agree. */
	readonly claim: RegExp;
	/** What the repository actually yields, per named group. A group with no entry here is a defect in the row. */
	readonly expect: Readonly<Record<string, () => number>>;
}

const ROWS: readonly FreshnessRow[] = [
	{
		what: "the capability gap the shipped modes declare, which a fourth mode changed and no check noticed",
		file: ".trellis/spec/backend/personal-agent-capability-runtime.md",
		claim: /(?<unimplemented>eight|8)\s+of\s+the\s+(?<declared>nineteen|19)\s+capabilities/giu,
		expect: {
			unimplemented: () => declaredCapabilities().filter((name) => !registeredCapabilities().includes(name)).length,
			declared: () => declaredCapabilities().length,
		},
	},
	{
		what: "the number of rule checks a code-audit claim must answer, which `RULE_CHECKS` owns",
		file: ".trellis/spec/backend/personal-agent-audit-vertical.md",
		claim: /(?<checks>nine|9)\s+`?ruleChecks`?/giu,
		expect: { checks: () => RULE_CHECKS.length },
	},
];

for (const row of ROWS) {
	test(`${row.file} still states the number this repository yields: ${row.what}`, () => {
		const page = readFileSync(join(REPO, row.file), "utf8");
		const matches = [...page.matchAll(row.claim)];
		assert.ok(
			matches.length > 0,
			`${row.file} no longer states the claim this row covers (${row.what}), so nothing is being checked. Fix the sentence or remove the row deliberately.`,
		);
		for (const match of matches) {
			for (const [group, expected] of Object.entries(row.expect)) {
				const stated = numberOf(match.groups?.[group] ?? "");
				assert.ok(stated !== undefined, `${row.file} states a '${group}' this door cannot read, in '${match[0].trim()}'`);
				const actual = expected();
				assert.equal(
					stated,
					actual,
					`${row.file} says '${match[0].trim()}' and this repository yields ${actual} for '${group}' (${row.what}).`,
				);
			}
		}
	});
}

test("the modes on disk are the ones the door above counts against", () => {
	// Not a claim about a page: a control, so a row that silently started reading an empty directory fails loudly here
	// instead of passing every page against zero.
	const modes = readdirSync(join(REPO, "modes"), { withFileTypes: true }).filter((entry) => entry.isDirectory());
	assert.ok(modes.length > 1, `the modes directory holds ${modes.length} directories, so the rows above would be checking almost nothing`);
	assert.ok(declaredCapabilities().length > 0, "no mode declares a capability, so the capability row would pass vacuously");
	assert.ok(registeredCapabilities().length > 0, "no capability is registered, so the capability row would count every declaration as unimplemented");
	assert.ok(RULE_CHECKS.length > 0, "RULE_CHECKS is empty, so the rule-check row would be vacuous");
	assert.ok(SPEC.length > 0, "the spec root did not resolve");
});
