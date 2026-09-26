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
const ALLOW_LIST: Record<string, { reason: string; wiredBy: string | null }> = {
	// **Four entries left this list when M3's host load landed**, which is the first time it has shrunk:
	// `work-mode.ts` became reachable from the host's startup path, and `gate-limit.ts`, `effect-ledger.ts` and
	// `loop.ts` came with it (work-mode imports the first two, and gate-limit imports the loop's gate types).
	// The assertion below is what noticed, which is the reason it asserts in both directions.
	"src/core/loop-runner.ts": { reason: "the reference runner; M1 places the effect claim at its dispatch line, but nothing reaches this module, so the claim is exercised by tests only", wiredBy: null },
	"src/core/effect-store-file.ts": { reason: "the claim store M1 adds; reached only from loop-runner.ts, which is itself unreachable. Reachable from tests until the boundary also sits on the host's tool_call/tool_result hooks", wiredBy: null },
	"src/core/checkpoint.ts": { reason: "action-boundary checkpoints; reached only through the unreachable loop", wiredBy: null },
	"src/core/gate-conformance.ts": { reason: "conformance-gate semantics; reached only from loop-runner, and M2 composes it behind the gate policy at the host's tool_call hook", wiredBy: "M2" },
	"src/core/authority.ts": { reason: "the grant graph the mode declares; M2's conformance gate is what consumes it, and the mode load alone does not reach this", wiredBy: "M2" },
	"src/core/capability-scope.ts": { reason: "typed capabilities held outside model context; M3 scopes them from the loaded mode, which has not landed yet", wiredBy: "M3" },
	"src/core/context-admission.ts": { reason: "the admission policy; M4 either delegates from it or removes it", wiredBy: "M4" },
	"src/core/dispatcher.ts": { reason: "pre-existing, from before the framework work; no milestone in this task claims it", wiredBy: null },
	"src/core/dispatch-policy.ts": { reason: "pre-existing, from before the framework work; no milestone in this task claims it", wiredBy: null },
	"src/adapters/loop-pi-agent-core.ts": { reason: "a reference adapter for a loop the host owns; reachable only from the island below", wiredBy: null },
	"src/adapters/loop-scripted.ts": { reason: "a reference adapter for a loop the host owns; reachable only from the island below", wiredBy: null },
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
});
