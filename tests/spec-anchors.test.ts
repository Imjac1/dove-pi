/**
 * The specification pages cite positions, and this is the smallest honest door over them.
 *
 * **Why a door at all.** The repository guards its structure mechanically: every path in the harness surface
 * must resolve, the reachability list is asserted in both directions, the label vocabulary is closed by the
 * typechecker. The specs are the one surface that *requires* a line number - the live code is forbidden from
 * carrying one - and nothing checked them, so a citation was wrong the moment somebody edited above it. Of the
 * citations an audit measured on this tree, six had already rotted, one of them within a day of being written.
 *
 * **What it checks, and what it deliberately does not.** The first version judged a citation against the
 * symbols the same line names, and it was withdrawn after the measurement: the pages make **group** claims - a
 * table row naming four types and citing four lines - so names and lines are not a one-to-one pairing, and the
 * rule reported three citations that had already been verified as correct. A check with false findings is worse
 * than no check, because a boundary people turn off protects nothing.
 *
 * What is left can be judged without guessing: **a cited path must resolve, and a cited line must exist**. That
 * is a floor, and the class it catches is real - a citation a reader cannot follow, because the path is an
 * abbreviation or the file has moved. Judging whether the line still *says* what the page claims would need the
 * pages to state one claim per citation, which is a change to the pages rather than to this check.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..");

/**
 * The citations this check cannot hold, and why - named rather than inferred from how they look.
 *
 * A citation into an installed package is not this repository's to keep in sync, and the version is pinned in
 * `package.json`. Anything else that does not resolve is a finding, not a skip.
 */
const EXEMPT: ReadonlyMap<string, string> = new Map([
	["pi-coding-agent/docs/", "the Pi host's own documentation, pinned by the installed module version"],
	["node_modules/", "an installed package, whose line numbers are not ours to hold"],
]);

/**
 * A citation is a path with an extension and a line number.
 *
 * The first character class admits a dot, because the pages cite repository paths that start with one - a page
 * under the specification directory, or a sibling reached through `..`. Refusing it truncated the citation to
 * the part after the dot, which resolved to nothing and was reported as unresolvable: a false finding produced
 * by the checker, which is the failure this file's own header says to avoid.
 */
const ANCHOR = /(?<path>[A-Za-z0-9_.][A-Za-z0-9_./-]*\.(?:ts|mts|md|yaml|yml|ps1|json|jsonl|py)):(?<line>\d+)/gu;
/** A range is written with its second number bare, in its own code mark on the same line. */
const CONTINUATION = /`:(?<line>\d+)`/gu;

export interface AnchorClaim {
	readonly page: string;
	/** The line of the page the citation is written on. */
	readonly line: number;
	readonly path: string;
	readonly citedLine: number;
}

export interface AnchorFinding {
	readonly page: string;
	readonly line: number;
	readonly anchor: string;
	readonly problem: string;
}

function markdownFiles(root: string): readonly string[] {
	const found: string[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const full = join(root, entry.name);
		if (entry.isDirectory()) found.push(...markdownFiles(full));
		else if (entry.name.endsWith(".md")) found.push(full);
	}
	return found;
}

function isExempt(path: string): boolean {
	for (const prefix of EXEMPT.keys()) if (path.startsWith(prefix)) return true;
	return false;
}

/**
 * Where a citation points, tried the two ways a page can mean it: from the repository root, then from the page
 * itself - a guide cites a sibling that way. Resolving only one of the two would report the other as
 * unresolvable, and a false finding is how a check gets turned off.
 */
function resolveTarget(root: string, page: string, cited: string): string {
	if (isAbsolute(cited)) return cited;
	const fromRoot = resolve(root, cited);
	if (existsSync(fromRoot)) return fromRoot;
	const fromPage = resolve(root, page, "..", cited);
	if (existsSync(fromPage)) return fromPage;
	return fromRoot;
}

export function anchorsIn(page: string, text: string): readonly AnchorClaim[] {
	const claims: AnchorClaim[] = [];
	for (const [index, raw] of text.split(/\r?\n/u).entries()) {
		const line = index + 1;
		for (const match of raw.matchAll(ANCHOR)) {
			const path = match.groups?.path ?? "";
			const cited = Number(match.groups?.line ?? "0");
			if (path === "" || cited <= 0) continue;
			claims.push({ page, line, path, citedLine: cited });
			for (const range of raw.matchAll(CONTINUATION)) {
				const second = Number(range.groups?.line ?? "0");
				if (second <= 0 || second === cited) continue;
				claims.push({ page, line, path, citedLine: second });
			}
		}
	}
	return claims;
}

export interface AnchorReading {
	readonly findings: readonly AnchorFinding[];
	readonly citations: number;
}

/**
 * Every citation under the walk root, judged by whether a reader could follow it.
 *
 * Paths resolve from `root`, because the pages cite repository paths and the fixture roots itself; the default
 * walk is the specification directory, because a citation in a task artifact is a note rather than the record
 * of what exists.
 */
export function checkAnchors(root: string, pages?: readonly string[]): AnchorReading {
	const findings: AnchorFinding[] = [];
	let citations = 0;
	for (const page of pages ?? markdownFiles(join(root, ".trellis", "spec"))) {
		const resolved = isAbsolute(page) ? page : join(root, page);
		const relativeToRepo = relative(root, resolved).replace(/\\/gu, "/");
		for (const claim of anchorsIn(relativeToRepo, readFileSync(resolved, "utf8"))) {
			citations += 1;
			if (isExempt(claim.path)) continue;
			let lines: readonly string[];
			try {
				lines = readFileSync(resolveTarget(root, relativeToRepo, claim.path), "utf8").split(/\r?\n/u);
			} catch {
				findings.push({
					page: claim.page,
					line: claim.line,
					anchor: `${claim.path}:${String(claim.citedLine)}`,
					problem: "the cited path does not resolve inside this repository, and it is not on the exempt list",
				});
				continue;
			}
			if (claim.citedLine > lines.length) {
				findings.push({
					page: claim.page,
					line: claim.line,
					anchor: `${claim.path}:${String(claim.citedLine)}`,
					problem: `the cited line is past the end of the file, which holds ${String(lines.length)} lines`,
				});
			}
		}
	}
	return { findings, citations };
}

describe("the specification pages cite positions a reader can follow", () => {
	it("cites only paths that resolve, and lines that exist", () => {
		const reading = checkAnchors(REPO);
		const report = reading.findings.map((finding) => `${finding.page}:${String(finding.line)} cites ${finding.anchor} - ${finding.problem}`).join("\n");
		assert.equal(reading.findings.length, 0, `${String(reading.findings.length)} citations cannot be followed:\n${report}`);
		// A reading with no findings is only worth as much as what it looked at.
		assert.equal(reading.citations > 20, true, `only ${String(reading.citations)} citations were read, so this run proves little`);
	});

	it("reports a citation whose path does not resolve, and accepts one that does", () => {
		// The proof that the check can fail, on a fixture rather than on the pages themselves: writing a wrong
		// citation into a page to test the checker would change the evidence in order to check it.
		const scratch = mkdtempSync(join(tmpdir(), "spec-anchors-"));
		try {
			mkdirSync(join(scratch, ".trellis", "spec"), { recursive: true });
			mkdirSync(join(scratch, "src"), { recursive: true });
			writeFileSync(join(scratch, "src", "thing.ts"), ["export function first(): void {}", "", "export function second(): void {}", ""].join("\n"), "utf8");
			const good = join(scratch, ".trellis", "spec", "good.md");
			const bad = join(scratch, ".trellis", "spec", "bad.md");
			writeFileSync(good, "A claim about `second` at `src/thing.ts:3`.\n", "utf8");
			writeFileSync(bad, "A claim at `somewhere/else.ts:3`, and one past the end at `src/thing.ts:99`.\n", "utf8");

			const clean = checkAnchors(scratch, [good]);
			assert.equal(clean.findings.length, 0, "a citation that resolves must not be reported");
			assert.equal(clean.citations, 1);

			const broken = checkAnchors(scratch, [bad]);
			const problems = broken.findings.map((finding) => finding.problem).join("\n");
			assert.equal(broken.findings.length, 2, "an unresolvable path and a line past the end are both findings");
			assert.match(problems, /does not resolve/u);
			assert.match(problems, /past the end/u);
		} finally {
			rmSync(scratch, { recursive: true, force: true });
		}
	});
});
