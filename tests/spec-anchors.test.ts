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
 * What is left can be judged without guessing: **a cited path must resolve, a cited line must exist, and a range's
 * two numbers must be in order**. That is a floor, and the class it catches is real - a citation a reader cannot
 * follow, because the path is an abbreviation or the file has moved. Judging whether the line still *says* what the
 * page claims would need the pages to state one claim per citation, which is a change to the pages rather than to
 * this check.
 *
 * **The third property was added after this file's own defect**, and it is scoped to the form it belongs to. A
 * repoint script shifted a range's start and not its end, leaving `3681-3620`: a citation whose path resolved and
 * whose start existed, so every check here passed it. The pages write a range as `path:N-M` in one code mark, and
 * there `M` was not turned into a claim at all - not checked for existence, not for order. **The other spelling is
 * not a range**: a bare `` `:M` `` after an anchor means *another line of the same file*, the pages use it in lists,
 * and one of them cites a base with a continuation below it. Ordering that pair would report the real pages as
 * broken, so the ordering requirement is confined to the single-span form.
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
const ANCHOR = /(?<path>[A-Za-z0-9_.][A-Za-z0-9_./-]*\.(?:ts|mts|md|yaml|yml|ps1|json|jsonl|py)):(?<line>\d+)(?:-(?<end>\d+))?/gu;
/**
 * A range written the other way - the path and one of its lines, then the second number in its own bare code mark.
 *
 * **This is a list, not a range.** The pages use it to mean two lines of one file, in no order, and one page cites a
 * base with a continuation *below* it. So the number is claimed and existence-checked, and it carries no ordering:
 * only the single-span form is a range, and only there is order a property the door can judge without guessing.
 */
const CONTINUATION = /`:(?<line>\d+)`/gu;

export interface AnchorClaim {
	readonly page: string;
	/** The line of the page the citation is written on. */
	readonly line: number;
	readonly path: string;
	readonly citedLine: number;
	/**
	 * The first number of the single-span range this claim is the end of, when it is one. Present only for the
	 * `path:N-M` form: it is what lets the door ask whether a range runs forwards, and its absence is what keeps a
	 * continuation pair out of that question.
	 */
	readonly rangeStart?: number;
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
			// **The end of a single-span range is a cited line too**, and until this line existed it was not one. The
			// anchor matched only the `path:N` part of `path:N-M`, so `M` was never read: not for existence, and not
			// for order. A hand repoint of this tree's citations produced `3681-3620`, and every check here passed it.
			const end = Number(match.groups?.end ?? "0");
			if (end > 0) claims.push({ page, line, path, citedLine: end, rangeStart: cited });
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
			// **A range that runs backwards cannot be followed however well it resolves**, and it is asked here rather
			// than after the file is read because it is a property of the citation rather than of the file: both
			// numbers can exist and the pair still describe nothing a reader can use.
			if (claim.rangeStart !== undefined && claim.citedLine < claim.rangeStart) {
				findings.push({
					page: claim.page,
					line: claim.line,
					anchor: `${claim.path}:${String(claim.rangeStart)}-${String(claim.citedLine)}`,
					problem: `the range ends at ${String(claim.citedLine)}, before its start at ${String(claim.rangeStart)}`,
				});
				continue;
			}
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

	it("refuses a range that runs backwards, and leaves a list of lines unordered", () => {
		// **The proof that the new property can fail, on a fixture rather than on the pages** - this file's own
		// convention, because writing a wrong citation into a page in order to test the checker would change the
		// evidence in order to check it. The defect behind it was a repoint that moved a range's start and not its
		// end: the result resolved, both numbers existed, and nothing here objected.
		const scratch = mkdtempSync(join(tmpdir(), "spec-anchors-range-"));
		try {
			mkdirSync(join(scratch, ".trellis", "spec"), { recursive: true });
			mkdirSync(join(scratch, "src"), { recursive: true });
			writeFileSync(join(scratch, "src", "thing.ts"), ["export function first(): void {}", "", "export function second(): void {}", "", "export function third(): void {}", ""].join("\n"), "utf8");

			const backwards = join(scratch, ".trellis", "spec", "backwards.md");
			writeFileSync(backwards, "A claim about `second` at `src/thing.ts:3-1`.\n", "utf8");
			const reported = checkAnchors(scratch, [backwards]);
			assert.equal(reported.findings.length, 1, "a range whose end precedes its start is a finding");
			assert.match(reported.findings[0]?.problem ?? "", /ends at 1, before its start at 3/u);

			// **The larger of the two gaps, which is not the one that motivated the change.** In the single-span form
			// the door read only the start, so an end that did not exist was never noticed either.
			const pastTheEnd = join(scratch, ".trellis", "spec", "past.md");
			writeFileSync(pastTheEnd, "A claim at `src/thing.ts:1-99`.\n", "utf8");
			const endReported = checkAnchors(scratch, [pastTheEnd]);
			assert.equal(endReported.findings.length, 1, "the end of a range is existence-checked, which it was not before");
			assert.match(endReported.findings[0]?.problem ?? "", /past the end/u);

			const forwards = join(scratch, ".trellis", "spec", "forwards.md");
			writeFileSync(forwards, "A claim at `src/thing.ts:1-3`.\n", "utf8");
			const forwardReading = checkAnchors(scratch, [forwards]);
			assert.equal(forwardReading.findings.length, 0, "a range that runs forwards is accepted");
			// **Two, not one**: the assertion above passes even if the end is never claimed, which is the state this
			// change exists to leave - so the count is what proves the end is read, and read as a cited line.
			assert.equal(forwardReading.citations, 2, "and both of its numbers are claimed, so the end is existence-checked");

			// **The boundary this must not cross.** A bare second number is a list entry rather than a range's end, and
			// the pages use it that way - one of them cites a base with a continuation below it. Requiring order there
			// would report the real pages as broken, which is the false finding this file's header warns about.
			const list = join(scratch, ".trellis", "spec", "list.md");
			writeFileSync(list, "Implemented at `src/thing.ts:3` and `:1`, in no order.\n", "utf8");
			const listed = checkAnchors(scratch, [list]);
			assert.equal(listed.findings.length, 0, "a continuation pair may decrease, because it is a list rather than a range");
			assert.equal(listed.citations, 2, "and both of its numbers are still checked");
		} finally {
			rmSync(scratch, { recursive: true, force: true });
		}
	});

	it("cites the declaration each mount-point row names, as that page says it does", () => {
		// The page states its own convention: in this table, the line cited is the `pi.on(...)` declaration. Saying so
		// is what makes it checkable, and it needed checking - a one-line import at the top of the extension moved
		// every anchor in the table by one, and the anchor check above cannot see that: it asks whether a line exists,
		// not whether it still holds what the row claims.
		const page = join(REPO, ".trellis", "spec", "backend", "personal-agent-use-time-architecture.md");
		const extension = readFileSync(join(REPO, "src", "pi-adapter", "extension.ts"), "utf8").split(/\r?\n/u);
		const rows = readFileSync(page, "utf8").split(/\r?\n/u).filter((line) => /^\| `[a-z_]+` \| `:\d+` \|/u.test(line));
		assert.equal(rows.length, 18, `the mount table names ${String(rows.length)} rows, and this check only knows how to read that shape`);

		const wrong: string[] = [];
		for (const row of rows) {
			const parsed = /^\| `([a-z_]+)` \| `:(\d+)`/u.exec(row);
			if (parsed === null) continue;
			const name = parsed[1] ?? "";
			const cited = Number(parsed[2] ?? "0");
			const line = extension[cited - 1] ?? "";
			if (!line.includes(`pi.on("${name}"`)) wrong.push(`'${name}' is cited at ${String(cited)}, which holds: ${line.trim() === "" ? "(a blank line)" : line.trim().slice(0, 72)}`);
		}
		assert.equal(wrong.length, 0, `${String(wrong.length)} of 18 mount points cite a line that is not their declaration:\n${wrong.join("\n")}`);
	});
});
