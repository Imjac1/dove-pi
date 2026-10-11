import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, relative, dirname, sep } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Reachability is the defect that started 09-26-dove-agent-harness-capabilities: 12 of the 35 modules under
 * `src/core` are referenced only by each other or by their own tests, so nothing that runs ever loads them.
 * A "test" that asserts a module exists cannot see this, because every one of those modules has tests and
 * they pass.
 *
 * This walks relative import edges forward from the entry points and asserts that the set of modules nothing
 * reaches is EXACTLY the allow-list below. Two directions, and both matter:
 *
 *   - a module unreachable and NOT listed      -> fail  (new dead code arrived)
 *   - a module reachable and still listed      -> fail  (the list rotted; removing the entry is the
 *                                                        definition of done for that module)
 *
 * The second direction is what keeps this honest as M1-M4 wire the modules: the list can only shrink.
 */

const repoRoot = process.cwd();
const srcRoot = resolve(repoRoot, "src");

// The four entry points, as established in research/ground-truth-what-runs.md. src/pi-adapter/extension.ts is
// the only one the Pi host actually runs; the other three are CLI and adapter fronts.
const ENTRY_POINTS = [
	"src/cli.ts",
	"src/pi-adapter/extension.ts",
	"src/adapters/local-rpc.ts",
	"src/adapters/mcp.ts",
];

/**
 * `wiredBy` names the milestone that will make the module **reachable** - not the one that edits it. The
 * assertion is about reachability, so a milestone that edits an unreachable module removes nothing from this
 * list, and saying otherwise would make the list a place to hide. `wiredBy: null` means no milestone in this
 * task makes it reachable, stated rather than left blank.
 */
// **Every entry is `wiredBy: null`, and that was measured rather than assumed.** The field exists to force a statement - its own words
// are "stated rather than left blank" - and a non-null value is a promise attached to a task. Read across every entry, none of them
// carries one: the task that made the claims this list was born with has finished, and each claim left the list as it was wired, which are
// the shrinks recorded below. **So there is no outstanding promise here** - only modules that are unreachable on purpose, or that
// predate the framework work and are claimed by nothing. A future entry that names a milestone is making a promise, and this comment is
// where the next reader learns that a promise from a finished task is the one thing the exactness assertion cannot see.
const ALLOW_LIST: Record<string, { reason: string; wiredBy: string | null }> = {
	// **Four entries left this list when M3's host load landed**, which is the first time it has shrunk:
	// `work-mode.ts` became reachable from the host's startup path, and `gate-limit.ts`, `effect-ledger.ts` and
	// `loop.ts` came with it (work-mode imports the first two, and gate-limit imports the loop's gate types).
	// The assertion below is what noticed, which is the reason it asserts in both directions.
	// **`src/core/loop-runner.ts` left this list when the axi turn command began reaching it** - the eighth
	// shrink, and the first one caused by a consumer added *for the framework's own loop* rather than by the
	// host. `src/commands/axi-turn.ts` composes the loop and is imported by `src/cli.ts`, which is one of the
	// four entry points this walk starts from; the paired turn test (`tests/axi-turn.test.ts`) is what holds the
	// behaviour still.
	// `src/core/effect-store-file.ts` left this list when the host began composing the effect boundary at session
	// start - the fourth shrink. That is M1's reachability gap closed for the store.
	// **`checkpoint.ts` stays, with its reason corrected.** The reference runner is reachable now, but it does not
	// compose action-boundary checkpoints: it takes a provider, a gate, tools, an executor and a turn budget, and
	// nothing about effects. Its old reason - "reached only through the unreachable loop" - would have been right
	// for the wrong reason, which is the failure this list exists to make visible.
	"src/core/checkpoint.ts": { reason: "action-boundary checkpoints; the reference loop does not compose them yet, so only tests exercise the claim", wiredBy: null },
	// `src/core/gate-conformance.ts` left this list when the action policy composed it behind the host's
	// tool_call boundary - the third shrink, and the assertion is what noticed.
	// `src/core/authority.ts` left this list when the mode loader began resolving a conformance mode's grant
	// document - the second time the list has shrunk, and again the assertion is what noticed.
	// `src/core/capability-scope.ts` left this list when the action policy began scoping capability calls against
	// the mode's declared set - the sixth shrink, and the last module a milestone claimed.
	// `src/core/context-admission.ts` left this list when the host's tool-result compaction began delegating to
	// it - the fifth shrink, and the first module to leave because it *replaced* an implementation rather than
	// gaining a consumer.
	// **The Safety & Stability axis is unreachable on purpose, and this is the entry that says so.** It is read by
	// `scripts/harness-axes.mts` and by its own test, and by nothing in the harness: a measurement the harness acted
	// on would be a control, and a control is what the mode files and the fence are for. If it ever gains a runtime
	// consumer, that consumer is a decision - and the entry comes out.
	"src/core/harness-axes.ts": { reason: "a reading, consumed by scripts/harness-axes.mts and its test; deliberately not reached by the harness", wiredBy: null },
	// The failure reading rides beside the axis for the same reason and with the same consumer shape: a script and a
	// test read it, and **nothing in the harness does** - a reading the harness acted on would be a control. Its input
	// is the ledger, which the harness writes; its output is a report, which a person or the loop's proposal half
	// reads. If a runtime consumer appears, that consumer is the decision, and this entry comes out.
	"src/core/failure-reading.ts": { reason: "a reading, consumed by scripts/harness-failures.mts and its test; deliberately not reached by the harness", wiredBy: null },
	// The third reading, and the same shape again: the surface check is consumed by scripts/harness-rounds.mts and its
	// test. The harness records the *claim* (operation=applied); the check that the claim holds runs where git is, which
	// is a script by design - a process spawn on the request path to check one claim would be a control where a reading
	// belongs. If the runtime ever checks it, that is the decision, and this entry comes out.
	"src/core/harness-round.ts": { reason: "a reading, consumed by scripts/harness-rounds.mts and its test; deliberately not reached by the harness", wiredBy: null },
	// The fourth reading and the same shape: the corpus summary is consumed by scripts/harness-corpus.mts and its test.
	// It answers a question a person asks (what do we have), not one the harness asks while serving a request - and a
	// summary the harness acted on would be a control.
	"src/core/harness-corpus.ts": { reason: "a reading, consumed by scripts/harness-corpus.mts and its test; deliberately not reached by the harness", wiredBy: null },
	"src/adapters/loop-pi-agent-core.ts": { reason: "a reference adapter for a loop the host owns; reachable only from the island below", wiredBy: null },
	// **`src/adapters/loop-scripted.ts` left this list with the same shrink as `loop-runner.ts`**: the axi turn
	// command drives it, so the deterministic offline provider is now reached by production code rather than only
	// by tests - which is what its own header says it was written to be.
	// **`src/pi-adapter/session-keepalive.ts` left this list when the adapter began arming it on session start and
	// observing it on every provider request** - the seventh shrink, and the one the check stated the rule for:
	// *removing the entry is the definition of done for that module*.

	// **The six `src/jailer/` entries left together, and the consumer is the one every one of their reasons named.**
	// "the loop's startup path will" (`types.ts`, `acl.ts`), "the loop's dispatch path will" (`launch.ts`),
	// "`token.ts` and `launch.ts` will" (`host.ts`), "`launch.ts` will" (`token.ts`) - that path is
	// `src/commands/axi-turn.ts`, which now establishes the boundary before it runs a turn and starts the improver's
	// work through the helper. The readings travel out with it in the order the mechanism asks for: the ACL
	// invariants re-read, the token's restricting list verified, and the child's own exit code recorded rather than
	// judged. This is the eighth shrink, and the first one this list grew in order to pay.

};

/**
 * Canaries: modules that are reachable today by a path that goes through a `../` specifier. The first
 * implementation of this walk did not normalize `..` and reported 24 unreachable instead of 12, every extra
 * one a false positive, with a green exit status. These four are the ones that catch that class of break,
 * because a walk that cannot follow `../` cannot reach any of them.
 */
const REACHABLE_CANARIES = [
	"src/core/task-convergence.ts",
	"src/core/subagent.ts",
	"src/core/capability-runtime.ts",
	"src/core/evidence-sarif.ts",
];

const SPECIFIER = /(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g;

function listSourceFiles(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) found.push(...listSourceFiles(full));
		else if (entry.isFile() && entry.name.endsWith(".ts")) found.push(full);
	}
	return found;
}

function toKey(absolutePath: string): string {
	return relative(repoRoot, absolutePath).split(sep).join("/");
}

/** Resolve a relative specifier the way the runtime does, and refuse anything that leaves src/. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
	const base = resolve(dirname(fromFile), specifier);
	const candidates = [base, `${base}.ts`, join(base, "index.ts")];
	for (const candidate of candidates) {
		if (!candidate.startsWith(srcRoot)) continue;
		if (existsSync(candidate) && candidate.endsWith(".ts")) return candidate;
	}
	return null;
}

function buildGraph(): { files: string[]; edges: Map<string, string[]> } {
	const files = listSourceFiles(srcRoot).map((file) => resolve(file));
	const edges = new Map<string, string[]>();
	for (const file of files) {
		const text = readFileSync(file, "utf8");
		const targets = new Set<string>();
		for (const match of text.matchAll(SPECIFIER)) {
			const resolvedTarget = resolveSpecifier(file, match[1]);
			if (resolvedTarget) targets.add(resolvedTarget);
		}
		edges.set(file, [...targets]);
	}
	return { files, edges };
}

function reachableSet(edges: Map<string, string[]>): Set<string> {
	const roots = ENTRY_POINTS.map((entry) => resolve(repoRoot, entry));
	const seen = new Set<string>();
	const stack = roots.filter((root) => existsSync(root));
	assert.equal(stack.length, ENTRY_POINTS.length, "an entry point is missing from disk; the walk would silently start from fewer roots");
	while (stack.length > 0) {
		const current = stack.pop() as string;
		if (seen.has(current)) continue;
		seen.add(current);
		for (const next of edges.get(current) ?? []) {
			if (!seen.has(next)) stack.push(next);
		}
	}
	return seen;
}

describe("harness reachability", () => {
	const { files, edges } = buildGraph();
	const reached = reachableSet(edges);
	const unreachable = files.filter((file) => !reached.has(file)).map(toKey).sort();
	const allowed = Object.keys(ALLOW_LIST).sort();

	it("walks a non-trivial graph, so a broken walk cannot report a clean tree", () => {
		assert.ok(files.length > 80, `expected the walk to find the source tree, found ${files.length} files`);
		assert.ok(edges.size === files.length, "every file must have an edge entry, including the empty ones");
	});

	it("reaches the canaries, which are only reachable through a '../' specifier", () => {
		for (const canary of REACHABLE_CANARIES) {
			const absolute = resolve(repoRoot, canary);
			assert.ok(
				reached.has(absolute),
				`${canary} is unreachable. It is reachable in the current tree, so this is the walk failing to follow a relative specifier - not a finding. Check that resolution normalizes '..' rather than producing a second path key.`,
			);
		}
	});

	it("reaches every entry point", () => {
		for (const entry of ENTRY_POINTS) {
			assert.ok(reached.has(resolve(repoRoot, entry)), `${entry} is declared an entry point but is not reachable from itself`);
		}
	});

	it("has no module that is unreachable and unlisted", () => {
		const unlisted = unreachable.filter((file) => !(file in ALLOW_LIST));
		assert.deepEqual(
			unlisted,
			[],
			`these modules nothing reaches are not on the allow-list. Either wire them or list them with a reason:\n  ${unlisted.join("\n  ")}`,
		);
	});

	it("has no stale allow-list entry - a reachable module must be removed from the list", () => {
		const stale = allowed.filter((file) => !unreachable.includes(file));
		assert.deepEqual(
			stale,
			[],
			`these allow-list entries are now reachable. Removing the entry is the definition of done for that module:\n  ${stale.join("\n  ")}`,
		);
	});

	it("requires a reason for every allow-list entry", () => {
		for (const [file, entry] of Object.entries(ALLOW_LIST)) {
			assert.ok(entry.reason.trim().length >= 12, `${file} needs a stated reason, not a placeholder`);
		}
	});

	it("reaches every record kind from a writer, so a kind nothing produces cannot stay in the set", () => {
		// **A record kind is a claim about what this harness writes, and it belongs in this file for the same reason a module
		// does.** The dispatch path's `dispatch.decided` and `dispatch.completed` sat in the closed set after their writer went,
		// so a reader saw two mechanisms where there was none, and an audit found them rather than a check. The union is read
		// out of `contracts.ts` and every member has to appear as a literal somewhere else in the source tree.
		const contracts = readFileSync(join(repoRoot, "src", "core", "contracts.ts"), "utf8");
		const union = /export type ExecutionRecordKind =([^;]+);/u.exec(contracts);
		assert.ok(union, "the record-kind union is still declared in one place");
		const kinds = [...(union[1] ?? "").matchAll(/"([^"]+)"/gu)].map((match) => match[1] as string);
		assert.ok(kinds.length > 10, `expected the vocabulary, found ${kinds.length} kinds`);
		const writers = files.filter((file) => !file.endsWith("contracts.ts")).map((file) => readFileSync(file, "utf8"));
		const unwritten = kinds.filter((kind) => !writers.some((text) => text.includes(`"${kind}"`)));
		assert.deepEqual(unwritten, [], "a kind in the closed set must be written by something, or it describes a mechanism nothing has");
	});
});
