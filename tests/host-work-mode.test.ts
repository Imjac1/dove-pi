import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension from "../src/pi-adapter/extension.ts";
import { admitNonConversationalMessages, convergenceOperationFromPiInput } from "../src/pi-adapter/extension.ts";
import { unresolvedAcceptanceEvidence } from "../src/core/harness-verifier.ts";
import { resolveActionIdentity } from "../src/pi-adapter/action-identity.ts";
import { representativeTools } from "./fixtures/representative-tool-catalog.ts";

const repoRoot = process.cwd();
const stateDir = mkdtempSync(join(tmpdir(), "dove-mode-host-state-"));
const previousStateDir = process.env.DOVE_PI_STATE_DIR;
const previousFrameworkVersion = process.env.DOVE_PI_FRAMEWORK_VERSION;
process.env.DOVE_PI_STATE_DIR = stateDir;
after(() => {
	if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
	else process.env.DOVE_PI_STATE_DIR = previousStateDir;
	if (previousFrameworkVersion === undefined) delete process.env.DOVE_PI_FRAMEWORK_VERSION;
	else process.env.DOVE_PI_FRAMEWORK_VERSION = previousFrameworkVersion;
	rmSync(stateDir, { recursive: true, force: true });
});

interface FakeContext {
	hasUI?: boolean;
	ui: {
		theme: { fg: (color: string, value: string) => string };
		setStatus: (key: string, value: string | undefined) => void;
		notify: (message: string, level?: string) => void;
		/** The host's confirmation dialog. Optional, because a host without one is a case the harness must be able to be. */
		confirm?: (title: string, message: string) => Promise<boolean>;
	};
	sessionManager: { getEntries: () => unknown[]; getBranch?: () => unknown[]; getSessionId?: () => string };
}

/** A host that records what the extension registers, so the handlers can be invoked the way Pi invokes them. */
function startHost(root: string) {
	const previousCwd = process.cwd();
	process.chdir(root);
	const events = new Map<string, (event: any, ctx: any) => Promise<any>>();
	const notifications: string[] = [];
	const commands = new Map<string, { handler: (args: string, ctx: FakeContext) => Promise<void> }>();
	const tools = new Map<string, { name: string }>();
	const api = {
		registerCommand(name: string, definition: { handler: (args: string, ctx: FakeContext) => Promise<void> }) { commands.set(name, definition); },
		registerShortcut() {},
		registerFlag() {},
		appendEntry() {},
		registerTool(definition: { name: string }) { tools.set(definition.name, definition); },
		getAllTools() { return representativeTools.map((name) => ({ name })); },
		setActiveTools() {},
		getActiveTools() { return [...representativeTools]; },
		getThinkingLevel() { return "max"; },
		on(name: string, handler: (event: any, ctx: any) => Promise<any>) { events.set(name, handler); },
	} as unknown as ExtensionAPI;
	extension(api);
	const confirmCalls: { title: string; message: string }[] = [];
	let confirmAnswer = true;
	let dialogAvailable = true;
	const context: FakeContext = {
		hasUI: true,
		ui: {
			theme: { fg: (_color, value) => value },
			setStatus() {},
			notify: (message: string) => { notifications.push(message); },
			confirm: async (title: string, message: string) => {
				if (!dialogAvailable) throw new Error("the harness called confirm on a host that has no dialog");
				confirmCalls.push({ title, message });
				return confirmAnswer;
			},
		},
		sessionManager: { getEntries: () => [], getBranch: () => [], getSessionId: () => "work-mode-test" },
	};
	return {
		events,
		notifications,
		commands,
		context,
		tools,
		confirmCalls,
		setConfirmAnswer: (value: boolean) => { confirmAnswer = value; },
		/** A host with no dialog: `confirm` is gone and `hasUI` is false, the way the host's own no-op context is. */
		removeDialog: () => { dialogAvailable = false; context.hasUI = false; delete context.ui.confirm; },
		restoreCwd: () => process.chdir(previousCwd),
	};
}

function freshRoot(): string {
	return mkdtempSync(join(tmpdir(), "dove-mode-root-"));
}

function declareMode(root: string, value: string): void {
	mkdirSync(join(root, ".dove"), { recursive: true });
	writeFileSync(join(root, ".dove", "mode.json"), value);
}

/** Copy shipped content into the throwaway workspace, so a fixture cannot drift from what ships. */
function copyMode(root: string, name: string): void {
	cpSync(join(repoRoot, "modes", name), join(root, "modes", name), { recursive: true });
}

/**
 * Rewrite a copied mode's `gate.semantics`, so a case that pins a rule has a mode that declares the shape the rule is
 * about. Done by editing the copy rather than by shipping a mode with the shape, because a shipped mode that refuses
 * to load is not a fixture - it is a broken vertical.
 */
function forceSemantics(root: string, name: string, value: string): void {
	const path = join(root, "modes", name, "governance.yaml");
	const source = readFileSync(path, "utf8");
	const rewritten = source.replace(/^(\s+)semantics:\s*\S+\s*$/m, "$1semantics: " + value);
	if (rewritten === source) throw new Error("no 'semantics:' line was rewritten in " + path + ", so this test would prove nothing");
	writeFileSync(path, rewritten);
}

/**
 * A mode over a capability the runtime **actually has**, so the mode's own controls are reachable at the host boundary.
 *
 * **Why a fixture and not a shipped mode.** All three shipped modes declare capabilities nothing implements - six of the
 * nine they declare (`repo.read`, `report.write`, `net.scan`, `exploit.run`, `market.read`, `order.submit`), verified by
 * grep on 2026-09-27. A capability invocation for one of those is refused by the registration check before any other
 * control is consulted, so a host case that demonstrates a mode control through such a call is demonstrating it for an
 * action that cannot run. This fixture is how the controls keep host-level evidence.
 *
 * The limit's argument path is the mode author's to choose, which is why a synthetic one is a fixture rather than a
 * fiction.
 */
interface FixtureSpec {
	readonly capability: string;
	/** Listed in `ask_before`, so consent is what stands between the call and dispatch. */
	readonly askBefore?: boolean;
	/** The mode's stance for an action on none of the three lists. Defaults to `allow`, which is what these fixtures were written against. */
	readonly unlisted?: "allow" | "ask";
	/** Listed in `always_allow`, which can only decide under `unlisted: ask` - the loader refuses the other combination. */
	readonly alwaysAllow?: readonly string[];
	readonly limit?: { readonly argument: string; readonly max: number };
	readonly conformance?: { readonly targetArgument: string; readonly document: string };
	/** A technique the mode forbids. Declared so a case can show whether anything reads it. */
	readonly excludedTechniques?: readonly string[];
	/** The mode's own expiry. Declared so a case can show whether anything compares it to now. */
	readonly expires?: string;
	/** Targets the mode excludes. Declared so a case can show whether anything checks them. */
	readonly exclusions?: readonly string[];
	/** The workspace paths the mode protects. Declared so a case can show whether a write into them is refused. */
	readonly fence?: { readonly paths: readonly string[]; readonly shell: "denied" | "uncovered" };
}

function writeFixtureMode(root: string, name: string, spec: FixtureSpec): void {
	const directory = join(root, "modes", name);
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, "MODE.md"), ["---", "name: " + name, "description: A fixture mode over a capability the runtime has.", "license: MIT", "---", "", "Exercise one control at the host boundary.", ""].join("\n"));
	const conformance = spec.conformance;
	writeFileSync(
		join(directory, "governance.yaml"),
		[
			"version: 1.0.0",
			'framework: ">=0.2.0 <0.3.0"',
			"scope:",
			"  targets: [workspace]",
			"  environment: non-production",
			"  exclusions: [" + (spec.exclusions ?? []).join(", ") + "]",
			"authority:",
			// **Only when there is a document to point at.** The loader resolves the name whatever the semantics, because a
			// name that resolves to nothing reads as authority nobody granted - and `local-fixture` was a placeholder
			// nothing ever resolved, which is the same fact the check found in two shipped modes.
			...(conformance === undefined ? [] : ["  grant: " + conformance.document]),
			"  capabilities: [" + spec.capability + "]",
			// **Only when the case asks for one.** The loader refuses `expires` outright - a calendar window belongs to
			// the grant - so a fixture that wrote one by default would put every case in this file behind a refusal.
			...(spec.expires === undefined ? [] : ['  expires: "' + spec.expires + '"']),
			...(spec.fence === undefined ? [] : ["fence:", "  paths: [" + spec.fence.paths.join(", ") + "]", "  shell: " + spec.fence.shell]),
			"gate:",
			// `none` when the fixture declares neither control: a fixture that wrote `limit` with no limits would be refused
			// by the rule this branch is about.
			"  semantics: " + (conformance !== undefined ? "conformance" : spec.limit === undefined ? "none" : "limit"),
			...(conformance === undefined ? [] : ["  target_argument: " + conformance.targetArgument]),
			...(spec.excludedTechniques === undefined ? [] : ["  excluded_techniques: [" + spec.excludedTechniques.join(", ") + "]"]),
			...(spec.limit === undefined
				? []
				: ["  limits:", "    payload:", "      argument: " + spec.limit.argument, "      max: " + spec.limit.max, "      tools: [" + spec.capability + "]"]),
			"  approval: none",
			"",
		].join("\n"),
	);
	// The stance is a spec field because it is the mode's own declaration, and `always_allow` can only decide under
	// `unlisted: ask` - the loader refuses the combination where it could not. `ask_before` and `always_allow` are kept
	// disjoint: precedence makes `ask_before` win, and listing the same action in both would leave a reader unable to
	// tell which control the case is about.
	const permissions = [
		"unlisted: " + (spec.unlisted ?? "allow"),
		"always_allow: [" + (spec.alwaysAllow ?? []).join(", ") + "]",
		"ask_before: [" + (spec.askBefore === true ? spec.capability : "") + "]",
		"never_allow: []",
		"",
	];
	writeFileSync(join(directory, "permissions.yaml"), permissions.join("\n"));
}

/**
 * A conformance document naming a capability the runtime has. The shipped `example-engagement` authorizes `net.scan`,
 * and nothing implements `net.scan`, so a mode pointing at it cannot reach its own conformance gate through a
 * capability call. This is the document that can, with real digests so it pre-flights.
 */
function writeFixtureEngagement(root: string): { document: string; target: string } {
	const directory = join(root, "engagements", "fixture-engagement");
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, "inventory.csv"), "asset,owner\nlocal-workspace,operator\n");
	writeFileSync(join(directory, "permission-to-inspect.txt"), "signed permission to inspect the local workspace\n");
	const digestOf = (file: string): string => createHash("sha256").update(readFileSync(join(directory, file))).digest("hex");
	const digest = digestOf("inventory.csv");
	const permission = digestOf("permission-to-inspect.txt");
	writeFileSync(
		join(directory, "authority.yaml"),
		[
			"version: 1",
			"engagement: fixture-engagement",
			"principals:",
			"  - { id: grantor, kind: grantor }",
			"  - { id: operator, kind: operator }",
			"grants:",
			"  - id: g-workspace",
			// Not `from: operator`: a grant a principal issues to itself authorizes nothing, and the gate says so.
			"    from: grantor",
			"    to: operator",
			"    authorizes:",
			"      actions: [workspace.inspect]",
			"    targets: [t-workspace]",
			"    window:",
			'      from: "2020-01-01T00:00:00.000Z"',
			'      to: "2030-01-01T00:00:00.000Z"',
			"    constraints:",
			"      excluded_techniques: [dos]",
			"    evidence:",
			"      - kind: signed-permission",
			"        ref: engagements/fixture-engagement/permission-to-inspect.txt",
			'        sha256: "' + permission + '"',
			"        signed_by: grantor",
			"targets:",
			"  - id: t-workspace",
			"    address: local",
			"    owner: operator",
			"    ownership_evidence:",
			"      kind: asset-inventory-attestation",
			"      ref: engagements/fixture-engagement/inventory.csv",
			'      sha256: "' + digest + '"',
			"    requires_grants: [g-workspace]",
			"",
		].join("\n"),
	);
	return { document: "engagements/fixture-engagement/authority.yaml", target: "t-workspace" };
}

/** A conformance mode's authority document lives beside the modes, so copying a mode is not enough. */
function copyEngagements(root: string): void {
	cpSync(join(repoRoot, "engagements"), join(root, "engagements"), { recursive: true });
}

/**
 * Make the copied engagement pre-flightable: write the evidence files it names, match the document's digests to them,
 * and refresh its external approval. The shipped example carries placeholder digests (`"aaaa"`), so it can never
 * pre-flight - which is what the refusal test below asserts.
 */
function preflightableEngagement(root: string): void {
	const directory = join(root, "engagements", "example-engagement");
	writeFileSync(join(directory, "permission-to-test.pdf"), "signed permission to test");
	writeFileSync(join(directory, "inventory.csv"), "asset,owner\n10.0.0.5,client\n10.0.0.6,client\n");
	const digest = (file: string) => createHash("sha256").update(readFileSync(join(directory, file))).digest("hex");
	const path = join(directory, "authority.yaml");
	writeFileSync(
		path,
		readFileSync(path, "utf8")
			.replace('sha256: "aaaa"', 'sha256: "' + digest("permission-to-test.pdf") + '"')
			.replace(/sha256: "bbbb"/g, 'sha256: "' + digest("inventory.csv") + '"')
			.replace('checked_at: "2026-09-25T06:00:00.000Z"', 'checked_at: "' + new Date().toISOString() + '"')
			// **The shipped example's grant window is a fixed date pair, and a wall clock eventually walks past it.**
			// On 2026-10-01 the window closed and this test began failing with "Grant 'g-client-scope' is not
			// active at <now>" - at a pristine checkout too, which is how it was confirmed to be a time bomb
			// rather than a regression. The mechanism under test is the mode's `never_allow` reaching the action,
			// not the example's calendar, so the window moves with the clock.
			.replace('from: "2026-09-01T00:00:00.000Z"', 'from: "' + new Date(Date.now() - 86_400_000).toISOString() + '"')
			.replace('to: "2026-10-01T00:00:00.000Z"', 'to: "' + new Date(Date.now() + 86_400_000).toISOString() + '"'),
	);
}

async function callTool(host: ReturnType<typeof startHost>, toolName: string, input: unknown, toolCallId = "c-1"): Promise<{ block?: boolean; terminate?: boolean; reason?: string } | undefined> {
	const handler = host.events.get("tool_call");
	if (handler === undefined) throw new Error("the extension registered no tool_call handler, so this test would prove nothing");
	return handler({ type: "tool_call", toolCallId, toolName, input }, host.context);
}

describe("the host loads the work mode (design 5.4: 'loaded by the host' is the point)", () => {
	it("names the action a tool call is, so a capability invocation is not its tool name", () => {
		assert.deepEqual(resolveActionIdentity("bash", { command: "ls" }), { action: "bash", arguments: { command: "ls" }, viaCapability: false });
		assert.deepEqual(
			resolveActionIdentity("agent_run_capability", { name: "shell.exec", args: { target: "t-web" } }),
			{ action: "shell.exec", arguments: { target: "t-web" }, viaCapability: true },
			"a policy reads the capability's own arguments, not the envelope that carries them",
		);
		assert.deepEqual(
			resolveActionIdentity("agent_run_capability", {}),
			{ action: "agent_run_capability.<unnamed>", arguments: {}, viaCapability: true },
			"an unnameable capability call stays inside a namespace a mode can still deny",
		);
	});

	it("blocks every tool call when a declared mode cannot be read, instead of running without it", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		declareMode(root, "{ not json");
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(
				host.notifications.some((message) => /not "no mode declared"/.test(message)),
				"the operator is told the difference between a broken declaration and none: " + host.notifications.join(" | "),
			);
			const decision = await callTool(host, "bash", { command: "ls" });
			assert.equal(decision?.block, true, "an unreadable declaration stops the action rather than degrading to no mode");
			assert.match(decision?.reason ?? "", /\[Dove mode\]/);
		} finally {
			host.restoreCwd();
		}
	});

	it("shows the failed mode and its reason in /status, where the operator already looks", async () => {
		// The finding these two lines exist for: a mode that fails to load refuses **every** tool call - `tool_call`
		// refuses before the lease check - and the only notice was one session-start notification that scrolls away.
		// `/status` is what a user types when nothing runs, and until now it named nothing about the mode. The reason is
		// long and a single line cannot carry it, so the compact form marks the refusal and `full` carries the loader's
		// own words rather than a paraphrase of them.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		declareMode(root, "{ not json");
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);

			host.notifications.length = 0;
			await host.commands.get("status")?.handler("", host.context);
			const compact = host.notifications.at(-1) ?? "";
			assert.match(compact, /workMode=failed/, "the compact line says the mode did not load");
			assert.match(compact, /modeRefused/, "and marks it, rather than printing a mode id that is not in force");
			assert.doesNotMatch(compact, /LastPlan: /, "the ledger detail still waits for full, the way the goal line does");

			host.notifications.length = 0;
			await host.commands.get("status")?.handler("full", host.context);
			const full = host.notifications.at(-1) ?? "";
			assert.match(full, /Work mode failed to load, and every tool call is refused until the declaration is fixed:/, "full carries the whole reason");
			assert.match(full, /not "no mode declared"/, "and it is the loaders own message, not a summary of it");

			// Read-only, and asserted rather than assumed: a status command that wrote to the ledger would become
			// evidence about the thing it reports.
			const ledgerFile = join(stateDir, "execution.jsonl");
			const rows = () => (existsSync(ledgerFile) ? readFileSync(ledgerFile, "utf8").split("\n").filter((line) => line.trim() !== "").length : 0);
			const before = rows();
			host.notifications.length = 0;
			await host.commands.get("status")?.handler("full", host.context);
			assert.equal(rows(), before, "status is a reader");
		} finally {
			host.restoreCwd();
		}
	});

	it("enforces the loaded mode's never_allow against the action, and leaves an unlisted tool alone", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "pentest");
		copyEngagements(root);
		preflightableEngagement(root);
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "pentest" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(host.notifications.some((message) => /pentest loaded from modes\/pentest/.test(message)), host.notifications.join(" | "));
			assert.ok(
				host.notifications.some((message) => /conformance against engagement 'example-engagement'/.test(message)),
				"the operator is told which document bounds the run",
			);
			assert.ok(
				host.notifications.some((message) => /1 action\(s\) run only after you confirm them/.test(message)),
				"both live controls are counted out loud, rather than one being implied: " + host.notifications.join(" | "),
			);

			// pentest's never_allow names 'dos.*', a Dove action reached through the capability tool - which is exactly
			// why the action mapping exists: matched against the tool name it would never fire.
			const denied = await callTool(host, "agent_run_capability", { name: "dos.syn", args: {} });
			assert.equal(denied?.block, true, "the mode's deny list must actually fire");
			assert.match(denied?.reason ?? "", /never_allow/);
			assert.match(denied?.reason ?? "", /dos\.syn/);

			const bash = await callTool(host, "bash", { command: "git status --short" });
			assert.notEqual(bash?.block, true, "bash is not on this mode's deny list, and the mapping is what makes that distinguishable");
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses a conformance mode whose grant is not a document, and names both ways out", async () => {
		// The consequence of requiring a document, pinned as behaviour rather than discovered later. The shipped
		// code-audit no longer has this shape - it declares `none`, because an internal review has no third-party
		// grantor to write an ownership document with and declares no thresholds either - so the declaration is forced
		// back here. A mode that declares conformance and cannot check anything must not start, and that rule needs a
		// case even when no shipped mode exercises it today.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "code-audit");
		forceSemantics(root, "code-audit", "conformance");
		// **The name is supplied here, because the shipped mode no longer carries one.** A `conformance` mode must be able
		// to point at a document, and this case is about the mode that cannot - so it forces back both halves of that
		// shape rather than only the semantics. Without the name the refusal would be a different one, and the case would
		// pass while testing something else.
		const governancePath = join(root, "modes", "code-audit", "governance.yaml");
		writeFileSync(governancePath, readFileSync(governancePath, "utf8").replace("authority:", "authority:\n  grant: local-review"));
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "code-audit" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			const refusal = host.notifications.find((message) => /local-review/.test(message));
			assert.ok(refusal !== undefined, "the refusal names the grant that could not be resolved: " + host.notifications.join(" | "));
			assert.match(refusal, /authority\.grant/, "and the field to fix");
			assert.match(refusal, /Point it at a document, or drop the field/, "and the two ways out, so the operator is not left guessing");
			assert.match(refusal, /does not need to name an engagement/, "including the one for a mode that is bounded by its own permissions and scope");
			const decision = await callTool(host, "bash", { command: "ls" });
			assert.equal(decision?.block, true, "and no action runs while the mode is unresolved");
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses a mode that declares a threshold gate and no thresholds, and names both ways out", async () => {
		// The declaration that reads as a control and decides nothing. `none` is the value for a mode with no gate, so
		// the refusal has to offer it - otherwise the author is sent back to the value that caused the problem.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "code-audit");
		forceSemantics(root, "code-audit", "limit");
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "code-audit" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			const refusal = host.notifications.find((message) => /gate\.limits/.test(message));
			assert.ok(refusal !== undefined, "the refusal names the field that is missing: " + host.notifications.join(" | "));
			assert.match(refusal, /gate\.semantics: none/, "and the value that would fit a mode with no gate");
			assert.match(refusal, /Declare the limits/, "and the other way out");
			const decision = await callTool(host, "bash", { command: "ls" });
			assert.equal(decision?.block, true, "and no action runs while the mode is unresolved");
		} finally {
			host.restoreCwd();
		}
	});

	it("loads code-audit through the host, and refuses what it declares but nothing implements", async () => {
		// AC1, for the mode that had to change to be loadable at all: changing `modes/code-audit/` changes what the
		// running agent may do, observed through the host rather than through a unit test of the loader.
		//
		// **`repo.read` and `report.write` are refused, and that is the finding, not a regression.** The mode declares
		// them in `authority.capabilities` and nothing registers them: they are *specifications* of what an audit does,
		// performed with ordinary host tools, and `agent_run_capability` was never a route to them. Until the
		// registration check existed, a call would have been allowed by the permission list and then thrown. The mode's
		// permission list is therefore only observable through the actions that *are* invocable - the deny list, and
		// the raw tools it does not name.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "code-audit");
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "code-audit" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(host.notifications.some((message) => /code-audit loaded from modes\/code-audit/.test(message)), host.notifications.join(" | "));
			await host.events.get("input")?.({ type: "input", text: "audit the repository", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "audit the repository", systemPrompt: "" }, host.context);

			for (const name of ["repo.read", "report.write"]) {
				const declared = await callTool(host, "agent_run_capability", { name, args: {} }, "c-" + name);
				assert.equal(declared?.block, true, name + " is declared by the mode and implemented by nothing");
				assert.match(declared?.reason ?? "", /\[registered\]/, "and it is refused as that, not as something else");
			}
			assert.equal(host.confirmCalls.length, 0, "nothing unimplemented is put to the operator");

			// never_allow still wins, and it is matched against the action rather than the umbrella tool.
			const denied = await callTool(host, "agent_run_capability", { name: "network.fetch", args: {} }, "c-net");
			assert.equal(denied?.block, true);
			assert.match(denied?.reason ?? "", /never_allow/, "a denial is a policy decision and comes first");

			// A raw tool is not the registry's business, so the permission list still decides it - and this is the
			// assertion the whole task exists for. `bash` is what a shell call resolves to, so the mode's "no shell"
			// rule fires here, where the action-shaped name the file used to carry never could.
			const shell = await callTool(host, "bash", { command: "ls" }, "c-shell");
			assert.equal(shell?.block, true, "the mode forbids the shell, and the prohibition is now enforced");
			assert.match(shell?.reason ?? "", /never_allow/, "and the refusal names the list that decided it");
			assert.match(shell?.reason ?? "", /bash/, "and the action it decided about");
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses a declared mode when the framework version is unavailable, rather than comparing a different number", async () => {
		const root = freshRoot();
		delete process.env.DOVE_PI_FRAMEWORK_VERSION;
		copyMode(root, "code-audit");
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "code-audit" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(host.notifications.some((message) => /DOVE_PI_FRAMEWORK_VERSION is not set/.test(message)), host.notifications.join(" | "));
			const decision = await callTool(host, "bash", { command: "ls" });
			assert.equal(decision?.block, true, "a mode whose range cannot be checked must not start");
		} finally {
			host.restoreCwd();
		}
	});

	it("runs with no mode when nothing is declared, and does not report that as a problem", async () => {
		const root = freshRoot();
		delete process.env.DOVE_PI_FRAMEWORK_VERSION;
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.equal(
				host.notifications.some((message) => /\[Dove mode\]/.test(message)),
				false,
				"no declaration is a legitimate state and must not be announced as an error",
			);
			const decision = await callTool(host, "bash", { command: "ls" });
			assert.notEqual(decision?.block, true);
		} finally {
			host.restoreCwd();
		}
	});
	it("refuses a capability the mode grants and nothing registers, before the limit gate and before the operator", async () => {
		// `modes/trading` declares `market.read` and `order.submit`, and the framework registers neither - the mode
		// stating what its *deployment* must provide. Until 2026-09-27 the order got a confirmation prompt, the operator
		// confirmed, an effect claim was taken, and then `registry.require` threw: fail-closed, but the operator was
		// asked about an action that could not run.
		//
		// **The limit gate is not consulted, and that is the point of the position.** An action that cannot run has no
		// arguments worth judging, so this check sits immediately after the capability scope - the same reasoning that
		// puts `ask` last, where consent about an action everything else refused would be noise.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "trading");
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "trading" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(
				host.notifications.some((message) => /trading loaded from modes\/trading/.test(message)),
				"the mode still loads: a missing registration is a deployment fact, not a malformed mode: " + host.notifications.join(" | "),
			);
			await host.events.get("input")?.({ type: "input", text: "place one order", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "place one order", systemPrompt: "" }, host.context);

			// An order that is also over its declared notional, so the ordering is observed rather than assumed.
			for (const [index, name] of ["order.submit", "market.read"].entries()) {
				const decision = await callTool(host, "agent_run_capability", { name, args: { order: { notional: 250_000, quantity: 10 } } }, "c-unregistered-" + index);
				assert.equal(decision?.block, true, name + " is granted by the mode and registered by nothing");
				assert.match(decision?.reason ?? "", /\[registered\]/, "the reason says which check refused it, not only that something did");
				assert.match(decision?.reason ?? "", /nothing in this runtime registers it/);
				assert.match(decision?.reason ?? "", /Do this instead:/, "a refusal carries remediation, not only a reason");
			}
			assert.equal(host.confirmCalls.length, 0, "the operator is not asked about an action that cannot run");

			// No claim either: a claim is what makes a later attempt refuse, so one taken for an action that never ran
			// would block a future attempt for the wrong reason.
			const effectsDir = join(root, ".dove", "effects");
			const claimed = existsSync(effectsDir) ? readdirSync(effectsDir).filter((name) => name.endsWith(".json")) : [];
			assert.deepEqual(claimed, [], "no effect claim for an action that never reached dispatch");

			// The refusal is evidence, not only a message to the model: a blocked action that leaves no record is
			// indistinguishable from one that never happened, and the two need different responses later.
			const ledgerFile = join(stateDir, "execution.jsonl");
			const records = existsSync(ledgerFile)
				? readFileSync(ledgerFile, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as { kind?: string; details?: { action?: string; gate?: string } })
				: [];
			const recorded = records.find((record) => record.kind === "gate.refused" && record.details?.gate === "registered" && record.details?.action === "order.submit");
			assert.ok(recorded !== undefined, "the refusal is in the ledger with its gate and its action");
			// **AC1: the refusal names the request it refused.** The ledger contract always accepted this field at
			// `appendGateRefused` and no call site passed one, so a refusal could only be attributed by ledger
			// *position* - and position is wrong whenever a previous request settles late, which
			// `issueRequestHostAbort` does by design. The failure reading attributes by id and refuses to fall back to
			// position, so this assertion is what keeps that promise honest.
			const refusalCorrelations = readFileSync(ledgerFile, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as { kind?: string; correlation?: { requestId?: string }; details?: { logicalRequestId?: string; gate?: string } });
			// **Filtered by this test's gate**, because the ledger this harness writes accumulates across the tests in
			// this file: the first `gate.refused` record in it belongs to an earlier test that drove no request, and
			// asserting on that one would have accused the code of a defect the test had.
			const registeredRefusals = refusalCorrelations.filter((record) => record.kind === "gate.refused" && record.details?.gate === "registered");
			assert.ok(registeredRefusals.length > 0, "the refusal above is in the ledger");
			assert.ok(registeredRefusals.every((record) => typeof record.correlation?.requestId === "string"), "every refusal for this action names the request it belongs to");
			const requestIds = refusalCorrelations.filter((record) => record.kind === "request.received").map((record) => String(record.details?.logicalRequestId ?? ""));
			assert.ok(requestIds.includes(String(registeredRefusals[0]?.correlation?.requestId)), "and it names a request this ledger saw");
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses an over-threshold action at the boundary when the capability is registered", async () => {
		// **A fixture mode, because no shipped mode can exercise this.** `modes/trading` is the only mode with limits,
		// and its only limited action is unregistered - so the check above refuses it before the limit gate is reached.
		// This mode declares a capability the runtime *does* have, which leaves the threshold as the only thing between
		// the call and dispatch. Without it, the limit gate's host-level coverage would be lost with nothing replacing it.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "thresholds", { capability: "workspace.inspect", limit: { argument: "payload.bytes", max: 1_000 } });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "thresholds" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(host.notifications.some((message) => /thresholds loaded from modes\/thresholds/.test(message)), host.notifications.join(" | "));
			await host.events.get("input")?.({ type: "input", text: "inspect", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "inspect", systemPrompt: "" }, host.context);

			const over = await callTool(host, "agent_run_capability", { name: "workspace.inspect", args: { path: ".", payload: { bytes: 5_000 } } });
			assert.equal(over?.block, true, "the mode's declared threshold must fire at the host boundary");
			assert.match(over?.reason ?? "", /exceeds limit 'payload'/, "the reason names the limit that refused it");
			assert.match(over?.reason ?? "", /Do this instead:/, "a refusal carries remediation, not only a reason");

			const under = await callTool(host, "agent_run_capability", { name: "workspace.inspect", args: { path: ".", payload: { bytes: 10 } } });
			assert.notEqual(under?.block, true, "an action inside the declared bound is not refused");

			const unevaluable = await callTool(host, "agent_run_capability", { name: "workspace.inspect", args: { path: "." } });
			assert.equal(unevaluable?.block, true, "a limit that cannot find the argument it checks is a block, not a pass");
			assert.match(unevaluable?.reason ?? "", /could not be evaluated/);

			const ledgerFile = join(stateDir, "execution.jsonl");
			const records = existsSync(ledgerFile)
				? readFileSync(ledgerFile, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as { kind?: string; details?: { action?: string; gate?: string } })
				: [];
			const recorded = records.find((record) => record.kind === "gate.refused" && record.details?.gate === "limit" && record.details?.action === "workspace.inspect");
			assert.ok(recorded !== undefined, "and it is recorded with the gate that refused it");
		} finally {
			host.restoreCwd();
		}
	});
	it("asks the operator before an action the mode lists in ask_before, and runs it only on consent", async () => {
		// The fixture declares a capability the runtime has and puts it on `ask_before`, so the consent requirement is
		// the only thing between the call and dispatch. `modes/trading` used to carry this case and cannot any more:
		// its `order.submit` is refused by the registration check before the ask is reached.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "consent", { capability: "workspace.inspect", askBefore: true });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "consent" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(host.notifications.some((message) => /consent loaded from modes\/consent/.test(message)), host.notifications.join(" | "));
			await host.events.get("input")?.({ type: "input", text: "inspect the workspace", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "inspect the workspace", systemPrompt: "" }, host.context);

			const input = { name: "workspace.inspect", args: { path: "." } };
			const approved = await callTool(host, "agent_run_capability", input, "c-ask-1");
			assert.notEqual(approved?.block, true, "a confirmed action is not refused: " + (approved?.reason ?? "(no reason)"));
			assert.equal(host.confirmCalls.length, 1, "the operator is asked, exactly once");
			assert.match(host.confirmCalls[0]?.title ?? "", /workspace\.inspect/, "the question names the action, not the umbrella tool");
			assert.match(host.confirmCalls[0]?.message ?? "", /ask_before/, "and says why it is being asked");

			host.setConfirmAnswer(false);
			const declined = await callTool(host, "agent_run_capability", input, "c-ask-2");
			assert.equal(declined?.block, true, "declining must stop the action rather than be treated as consent");
			assert.match(declined?.reason ?? "", /operator declined/);
			assert.match(declined?.reason ?? "", /Do this instead:/, "a refusal carries the way out, like every other refusal here");

			// Both answers are evidence. An action that ran because someone agreed to it and one that ran unasked
			// otherwise leave the same trace, and the trace is the only thing a later reader can check.
			const ledgerFile = join(stateDir, "execution.jsonl");
			const records = existsSync(ledgerFile)
				? readFileSync(ledgerFile, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as { kind?: string; details?: { action?: string; gate?: string } })
				: [];
			const approvedRecord = records.find((record) => record.kind === "gate.approved" && record.details?.action === "workspace.inspect");
			assert.ok(approvedRecord !== undefined, "the consent is recorded, so the run is distinguishable from one that never asked");
			assert.equal(approvedRecord?.details?.gate, "ask");
			const declinedRecord = records.find((record) => record.kind === "gate.refused" && record.details?.gate === "ask" && record.details?.action === "workspace.inspect");
			assert.ok(declinedRecord !== undefined, "and so is the refusal");
		} finally {
			host.restoreCwd();
		}
	});

	it("asks about an action the mode did not list, and does not ask about the ones it did", async () => {
		// The stance and the list are one control seen from two sides: `unlisted: ask` is what makes the question
		// happen, and `always_allow` is what suppresses it for the actions the mode expects to use. Neither is
		// observable without the other, which is why the loader refuses the combination where `always_allow` could not
		// decide - and this is the host-level evidence that the pair works, not just the matcher's.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "strict", { capability: "workspace.inspect", unlisted: "ask", alwaysAllow: ["read"] });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "strict" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(host.notifications.some((message) => /strict loaded from modes\/strict/.test(message)), host.notifications.join(" | "));
			await host.events.get("input")?.({ type: "input", text: "look around", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "look around", systemPrompt: "" }, host.context);

			// Listed, so the stance never reaches it: it runs and the operator is not asked. That is what the list is for.
			const listed = await callTool(host, "read", { file_path: "AGENTS.md" }, "c-listed");
			assert.notEqual(listed?.block, true, "an always_allow action is not refused: " + (listed?.reason ?? "(no reason)"));
			assert.equal(host.confirmCalls.length, 0, "and it is not put to the operator");

			// Not listed, so the stance is the only thing that could stop it, and it asks.
			const unlisted = await callTool(host, "grep", { pattern: "x", path: "." }, "c-unlisted");
			assert.equal(host.confirmCalls.length, 1, "an action off every list is put to the operator under 'unlisted: ask'");
			assert.match(host.confirmCalls[0]?.message ?? "", /unlisted: ask/, "and the question names the line that decided");
			assert.notEqual(unlisted?.block, true, "while a confirmed action is not refused");
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses to load a mode whose sandbox claims isolation this runtime cannot honour", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "overpromise", { capability: "workspace.inspect" });
		let governance = readFileSync(join(root, "modes", "overpromise", "governance.yaml"), "utf8");
		governance = governance.replace("gate:", "sandbox:\n  isolation: container\n  network: allowlist\n  filesystem: ephemeral\n\ngate:");
		writeFileSync(join(root, "modes", "overpromise", "governance.yaml"), governance);
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "overpromise" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			const refusal = host.notifications.find((message: string) => /cannot honour/.test(message));
			assert.ok(refusal, "the run does not start under a claim the runtime cannot back: " + host.notifications.join(" | "));
			assert.match(refusal ?? "", /isolation: 'container'/, "and it names the claim it refuses");
			assert.match(refusal ?? "", /network: 'none'/, "and names an enforceable claim as the way out");
			const blocked = await callTool(host, "bash", { command: "ls" });
			assert.equal(blocked?.block, true, "with the mode refused, nothing runs unconstrained");
		} finally {
			host.restoreCwd();
		}
	});

	it("enforces the sandbox claims a mode can honour, at the tool boundary  [D1]", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "sealed", { capability: "workspace.inspect" });
		let governance = readFileSync(join(root, "modes", "sealed", "governance.yaml"), "utf8");
		governance = governance.replace("gate:", "sandbox:\n  network: none\n  filesystem: read-only-source\n\ngate:");
		writeFileSync(join(root, "modes", "sealed", "governance.yaml"), governance);
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "sealed" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "probe", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "probe", systemPrompt: "" }, host.context);
			const networked = await callTool(host, "web_search", { query: "local network probe" }, "c-net");
			assert.equal(networked?.block, true, "a network tool is refused under 'network: none'");
			assert.match(networked?.reason ?? "", /\[sandbox\]/, "and the refusal names the sandbox as the check that refused it");
			const mutating = await callTool(host, "write", { path: "nope.txt", content: "no" }, "c-write");
			assert.equal(mutating?.block, true, "a filesystem-mutating tool is refused under 'read-only-source'");
			assert.match(mutating?.reason ?? "", /\[sandbox\]/);
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses an action needing consent when the host has no dialog, instead of running it unasked", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "consent", { capability: "workspace.inspect", askBefore: true });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "consent" }));
		const host = startHost(root);
		try {
			// The host's own no-op UI context answers `false` for every confirmation, which is the same direction: a
			// requirement that cannot be put to the operator is refused, not waived.
			host.removeDialog();
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "inspect the workspace", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "inspect the workspace", systemPrompt: "" }, host.context);

			const decision = await callTool(host, "agent_run_capability", { name: "workspace.inspect", args: { path: "." } });
			assert.equal(decision?.block, true, "an action awaiting consent must not run just because nobody could be asked");
			assert.match(decision?.reason ?? "", /no confirmation dialog/);
			assert.equal(host.confirmCalls.length, 0, "and the harness must not call a dialog the host does not have");
		} finally {
			host.restoreCwd();
		}
	});

	it("does not ask about an action the mode says nothing about", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "trading");
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "trading" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "hi", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "hi", systemPrompt: "" }, host.context);

			// `bash` is on none of trading's permission lists, and trading declares `unlisted: allow`, so the stance is
			// the answer: it runs. The stance is the mode's own line rather than a constant in the policy, so a mode that
			// wanted to be asked would say so instead of being overruled by a default.
			const decision = await callTool(host, "bash", { command: "ls" });
			assert.notEqual(decision?.block, true, "an unlisted tool is not the mode's business, so it is not refused: " + (decision?.reason ?? "(no reason)"));
			assert.equal(host.confirmCalls.length, 0, "an ordinary tool must not put a prompt in front of the operator");
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses an action outside the authority document at the boundary, and records which check refused it", async () => {
		// The fixture declares a capability the runtime has and points at a document that authorizes it, so the contract
		// is the only thing between the call and dispatch. `modes/pentest` used to carry this case and cannot any more:
		// its `net.scan` is declared and implemented by nothing, so the registration check refuses it first.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		const engagement = writeFixtureEngagement(root);
		writeFixtureMode(root, "contract", { capability: "workspace.inspect", conformance: { targetArgument: "target", document: engagement.document } });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "contract" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(host.notifications.some((message) => /contract loaded from modes\/contract/.test(message)), host.notifications.join(" | "));
			await host.events.get("input")?.({ type: "input", text: "inspect the workspace", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "inspect the workspace", systemPrompt: "" }, host.context);

			// The document pre-flights clean, so the run starts - and an action against a target it does not name is still
			// refused, at the boundary, by name. The refusal that used to happen here was the *pre-flight* refusing to
			// start at all, which is a different (and earlier) fact.
			const covered = await callTool(host, "agent_run_capability", { name: "workspace.inspect", args: { target: engagement.target } }, "c-covered");
			assert.notEqual(covered?.block, true, "a target the document names is not refused: " + (covered?.reason ?? "(no reason)"));
			const scanned = await callTool(host, "agent_run_capability", { name: "workspace.inspect", args: { target: "t-elsewhere" } }, "c-elsewhere");
			assert.equal(scanned?.block, true, "a conformance mode must refuse an action against a target it does not cover");
			assert.match(scanned?.reason ?? "", /\[conformance\]/, "the reason names the check, not only the outcome");

			const ledgerFile = join(stateDir, "execution.jsonl");
			const records = existsSync(ledgerFile)
				? readFileSync(ledgerFile, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as { kind?: string; details?: { gate?: string; action?: string; reason?: string } })
				: [];
			const recorded = records.find((record) => record.kind === "gate.refused" && record.details?.gate === "conformance" && record.details?.action === "workspace.inspect");
			assert.ok(recorded !== undefined, "the conformance refusal is in the ledger with its gate and its action");
			assert.match(recorded?.details?.reason ?? "", /is not present in authority document/, "and its reason names the target and the document, which is what a reader needs in order to check it");
		} finally {
			host.restoreCwd();
		}
	});
	it("refuses a mode that declares an expiry the runtime cannot honour  [D4]", async () => {
		// **This case was inverted, as its own instruction said to.** It used to assert the defect: all three shipped
		// modes declared `authority.expires` and nothing compared it to now, so a time-bounded grant had no bound.
		//
		// The cure is refusal rather than enforcement, and this repository had already decided that shape for the same
		// concept: `governance.gate.windows` is refused outright, "not because it is unimplemented but because it is
		// unenforceable here" - the engagement document's grant carries the window and the pre-flight checks it. An
		// expiry is that same calendar idea, so a mode repeating it is a second and less verifiable copy.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "expired", { capability: "workspace.inspect", expires: "2020-01-01T00:00:00.000Z" });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "expired" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			const message = host.notifications.join(" | ");
			assert.equal(
				/expires/.test(message) && /not enforceable/u.test(message),
				true,
				"a mode declaring an expiry must be told by name that the runtime cannot honour it: " + message,
			);
			assert.equal(/expired loaded from modes\/expired/.test(message), false, "and it must not load as if the field meant something");
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses a mode whose forbidden technique this runtime cannot witness  [D4]", async () => {
		// The witness table in `argument-syntax.ts` reads a technique's *shape*; a name with no shape is a prohibition
		// prohibiting nothing - the same defect as the expiry above, and the same cure: say so, by name.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "unwitnessed", { capability: "workspace.inspect", excludedTechniques: ["dos", "social-engineering"] });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "unwitnessed" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			const message = host.notifications.join(" | ");
			assert.equal(/social-engineering/.test(message), true, "the name the runtime cannot witness is named back: " + message);
			assert.equal(/cannot witness|no witness/u.test(message), true, "and the reason given is that it has no shape to check: " + message);
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses a target the mode excludes, at the boundary  [D4]", async () => {
		// `scope.exclusions` used to be declared and unread: all three shipped modes carry one (`[t-payments]`,
		// `[production-venue]`, `[]`), so a mode could exclude **the very target its own authority document
		// authorizes** and reach it anyway - the strongest form of the claim, an exclusion that cannot refuse the
		// thing it names. This is the case the repository left with the instruction to invert when that changed.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		const engagement = writeFixtureEngagement(root);
		writeFixtureMode(root, "excluding", {
			capability: "workspace.inspect",
			conformance: { targetArgument: "target", document: engagement.document },
			exclusions: [engagement.target],
		});
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "excluding" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "inspect the workspace", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "inspect the workspace", systemPrompt: "" }, host.context);

			const excluded = await callTool(host, "agent_run_capability", { name: "workspace.inspect", args: { target: engagement.target } }, "c-excluded");
			// **Inverted, as this case's own instruction said to.** It used to assert the defect - a mode excluded a target
			// and the call ran anyway - which was the strongest form of the claim: an exclusion that cannot refuse the
			// thing it names. The case and the instruction stay; the enforcement is what changed.
			assert.equal(excluded?.block, true, "a target the mode excludes must be refused at the boundary: " + (excluded?.reason ?? "(no reason)"));
			assert.match(excluded?.reason ?? "", /exclude/iu, "and the refusal says the mode excludes it: " + (excluded?.reason ?? "(no reason)"));
		} finally {
			host.restoreCwd();
		}
	});
	it("refuses a technique the mode excludes, at the boundary, on a raw capability call  [D4]", async () => {
		// **Both declarations below forbid the technique `dos`**, and the third assertion set is what proves the
		// *weaker* of the two is not the one doing the work. The mode carries its own list (`work-mode.ts` validates
		// it) and the policy checks it **before anything that could allow the call**
		// (`src/core/action-policy.ts`), so the first call is refused and the refusal is labelled `[technique]`.
		//
		// **The second call is the point of the case**: it names no target, so no authority request can be built and
		// the engagement document's `constraints.excluded_techniques` never sees it. It is still refused - which is
		// why the mode carries its own list rather than relying on a grantor to have written one.
		//
		// This case was written to assert the *defect* - its original text said the call "is allowed, because … the
		// mode own `gate.excluded_techniques` is worse still: `src/` has no consumer for it at all" - with the
		// instruction to **invert it rather than delete it** once either half was wired. The inversion happened and
		// the assertions below are the inverted ones; this paragraph is what the inversion left behind, corrected
		// once somebody read it and found it describing a state that no longer exists. The neighbouring case - an
		// excluded *target* - still asserts its own gap, and that assertion is deliberate.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		const engagement = writeFixtureEngagement(root);
		writeFixtureMode(root, "contract", {
			capability: "workspace.inspect",
			conformance: { targetArgument: "target", document: engagement.document },
			excludedTechniques: ["dos"],
		});
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "contract" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "inspect the workspace", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "inspect the workspace", systemPrompt: "" }, host.context);

			// The mode excludes `dos`, and the call now carries the technique in its arguments - which is where
			// `resolveActionIdentity` leaves the action's own facts, and where the policy reads them from.
			const forbidden = await callTool(
				host,
				"agent_run_capability",
				{ name: "workspace.inspect", args: { target: engagement.target, technique: "dos", phase: "discovery", intensity: 99 } },
				"c-forbidden",
			);
			assert.equal(forbidden?.block, true, "a technique the mode excludes is refused, not waved through");
			assert.match(forbidden?.reason ?? "", /\[technique\]/, "and the refusal names the check that refused it");
			assert.match(forbidden?.reason ?? "", /dos/, "and the technique it refused");

			// **The mode's list decides on its own.** This call names no target, so no authority request can be built
			// and the document's constraint never sees it - which is exactly why the mode carries its own list rather
			// than relying on a grantor to have written one.
			const unverifiable = await callTool(
				host,
				"agent_run_capability",
				{ name: "workspace.inspect", args: { technique: "dos" } },
				"c-unverifiable",
			);
			assert.equal(unverifiable?.block, true, "a forbidden technique is refused even when no authority request can be built");
			assert.match(unverifiable?.reason ?? "", /\[technique\]/);
		} finally {
			host.restoreCwd();
		}
	});
	it("keeps the session's own judgement when the context is compacted  [D1]", async () => {
		// **The third measured evasion aims at the monitor's memory, not at its rules**: an agent retries until the
		// relevant context leaves the history. So the state that decides has to live where a retry cannot outlive
		// it, and this case is what holds that: it spends a ceiling, compacts the context, and asks again. A change
		// that rebuilds the policy on compaction, or that moves the accumulator into the context, turns it red.
		//
		// The middle assertion is what keeps this from passing vacuously: it only holds if the handler really
		// spends the ceiling when it permits an action, so a path that never records fails here rather than
		// quietly proving nothing.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "history", { capability: "workspace.inspect", limit: { argument: "count", max: 3 } });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "history" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "do the work", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "do the work", systemPrompt: "" }, host.context);

			const call = { name: "workspace.inspect", args: { count: 2 } };
			const first = await callTool(host, "agent_run_capability", call, "c-history-first");
			assert.notEqual(first?.block, true, `the first call is inside the ceiling: ${first?.reason ?? ""}`);
			const second = await callTool(host, "agent_run_capability", call, "c-history-second");
			assert.equal(second?.block, true, "2 + 2 crosses a ceiling of 3, and the sequence is what the mode forbade");

			// The evasion itself: rewrite the surrounding context, then ask once more. Both hooks are fired, because
			// the pair is the path that replaces the history rather than the one that only announces it.
			await host.events.get("session_before_compact")?.({ type: "session_before_compact", willRetry: true }, host.context);
			await host.events.get("session_compact")?.({ type: "session_compact", willRetry: true }, host.context);
			const compacted = await callTool(host, "agent_run_capability", call, "c-history-compacted");
			assert.equal(compacted?.block, true, "the compaction changed the judgement, so the decision depends on the history");
			assert.match(compacted?.reason ?? "", /ceiling per call and per session|total/iu, "and it is still the accumulation refusing it, not some other rule arriving after the compaction");
		} finally {
			host.restoreCwd();
		}
	});
	it("claims an effect at the boundary and records its outcome when the result arrives", async () => {
		// The fixture declares a capability the runtime has and needs no consent, so the claim is the only thing this
		// case is about. `modes/trading` used to carry it: its `order.submit` is refused by the registration check.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "effects", { capability: "workspace.inspect" });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "effects" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "inspect the workspace", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "inspect the workspace", systemPrompt: "" }, host.context);

			const input = { name: "workspace.inspect", args: { path: "." } };
			const decision = await callTool(host, "agent_run_capability", input);
			assert.notEqual(decision?.block, true, "an action nothing refuses is not refused: " + (decision?.reason ?? "(no reason)"));

			// The claim is the file's existence, taken before dispatch, and it reads as in flight until a result
			// arrives - which is what an interrupted dispatch actually is.
			const effectsDir = join(root, ".dove", "effects");
			const claimed = existsSync(effectsDir) ? readdirSync(effectsDir).filter((name) => name.endsWith(".json")) : [];
			assert.equal(claimed.length, 1, "one claim, taken at the boundary");
			const inFlight = JSON.parse(readFileSync(join(effectsDir, claimed[0] as string), "utf8")) as { tool?: string; outcome?: string };
			assert.equal(inFlight.tool, "workspace.inspect", "the record names the action, not the umbrella tool that carried it");
			assert.equal(inFlight.outcome, undefined, "and it has no outcome yet");

			const toolResult = (await host.events.get("tool_result")?.({ type: "tool_result", toolCallId: "c-1", toolName: "agent_run_capability", input, content: [], isError: false }, host.context)) as { content?: Array<{ text?: string }> } | undefined;
			const completed = JSON.parse(readFileSync(join(effectsDir, claimed[0] as string), "utf8")) as { outcome?: string; completedAt?: string };
			assert.equal(completed.outcome, "completed", "the result completes the claim");
			assert.ok(completed.completedAt !== undefined, "with the time it completed");

			// **The citable observable.** A record the harness wrote, named in the result so the agent can cite it: the
			// agent can write a sentence claiming a criterion passed, but it cannot make this record exist.
			const marker = (toolResult?.content ?? []).map((part) => part.text ?? "").join("\n");
			assert.match(marker, /\[Dove observable: ledger:tool:c-1\]/, "a successful result names the observable it created");
			const ledgerFile = join(stateDir, "execution.jsonl");
			const observedRecords = existsSync(ledgerFile)
				? readFileSync(ledgerFile, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as { kind?: string; stepId?: string; details?: { tool?: string } })
				: [];
			const observed = observedRecords.find((record) => record.kind === "tool.observed" && record.stepId === "tool:c-1");
			assert.ok(observed !== undefined, "and the record it names exists, which is what makes the citation worth anything");
			assert.equal(observed?.details?.tool, "agent_run_capability");

			// A failure is not a pass-observable, so it is offered no citation: one would let an agent cite a result it
			// could not pass on.
			const failed = (await host.events.get("tool_result")?.({ type: "tool_result", toolCallId: "c-2", toolName: "bash", input: { command: "npm test" }, content: [], isError: true }, host.context)) as { content?: Array<{ text?: string }> } | undefined;
			const failedText = (failed?.content ?? []).map((part) => part.text ?? "").join("\n");
			assert.ok(!failedText.includes("Dove observable"), "a failed result is not offered as an observable");
		} finally {
			host.restoreCwd();
		}
	});
	it("names the claims a refused replay leaves unresolved, including the record it cannot read", async () => {
		// **The work-mode branch of the refusal, which had no test at all.** With no mode the message says so in words;
		// with a mode it has to read the claim store, and a reader is only worth what its reading is worth. The fixture
		// declares `dev.project_test`, which is registered with a `workspace_write` side effect and `idempotent: false`,
		// so it is exactly the non-idempotent effect the overflow guard keys on.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "replay", { capability: "dev.project_test" });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "replay" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "inspect the workspace", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "inspect the workspace", systemPrompt: "" }, host.context);

			// A claim taken at the boundary and left unresolved: the dispatch happened and no result arrived, which is
			// what an interrupted dispatch actually is.
			const decision = await callTool(host, "agent_run_capability", { name: "dev.project_test", args: {} }, "c-unresolved");
			assert.notEqual(decision?.block, true, "an action nothing refuses is not refused: " + (decision?.reason ?? "(no reason)"));

			const effectsDir = join(root, ".dove", "effects");
			const claimed = existsSync(effectsDir) ? readdirSync(effectsDir).filter((name) => name.endsWith(".json")) : [];
			assert.equal(claimed.length, 1, "the effect is claimed and no result has completed it");

			// The store's second hazard, staged rather than described: a claim created with exclusive create whose
			// record never landed. The store refuses to resolve it in either direction, and a reader that skipped it
			// would undo that refusal by omission - so it is asserted here, not left to the message's prose.
			writeFileSync(join(effectsDir, "crashed-before-record.json"), "");

			const refusal = await host.events.get("session_before_compact")?.({ type: "session_before_compact", reason: "overflow", willRetry: true }, host.context);
			assert.deepEqual(refusal, { cancel: true }, "the overflow replay after a non-idempotent effect is cancelled before anything is re-sent");

			const refusalTerminals = readFileSync(join(stateDir, "execution.jsonl"), "utf8")
				.trim().split(/\r?\n/).filter(Boolean)
				.map((line) => JSON.parse(line) as { kind?: string; details?: { terminal?: { code?: string; nextAction?: string } } })
				.filter((record) => record.kind === "request.terminal" && record.details?.terminal?.code === "retry-refused-after-effect");
			const refusalTerminal = refusalTerminals.at(-1);
			assert.ok(refusalTerminal !== undefined, "the refusal reaches the ledger, so the operator can read it after the session");
			const nextAction = refusalTerminal?.details?.terminal?.nextAction ?? "";
			assert.match(nextAction, /dev\.project_test/, "the operator is told which effect to reconcile, not merely that one is open");
			assert.match(nextAction, /crashed-before-record/, "and the claim whose record cannot be read is named rather than skipped");
			assert.match(nextAction, /record unreadable/, "and marked as unreadable, which is the state the store refuses to resolve");
			assert.match(nextAction, /new request is allowed/i, "and says how to continue, because the refusal is per attempt");
		} finally {
			host.restoreCwd();
		}
	});
	it("admits an undeclared tool in the formal lane and names it, instead of admitting it in silence", async () => {
		// **The gate's half of the one classification.** The replay path refuses an undeclared tool; the freeze gate
		// admits it, because it is a workflow gate over a formal task rather than a second Pi tool permission firewall.
		// Both readings are deliberate, and what this case pins is that the admission stopped being silent: an
		// undeclared tool is now recorded and named, so "nothing declared this" cannot be read as "reviewed and found
		// harmless" - which is the state the two-table arrangement used to produce.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "undetermined", { capability: "workspace.inspect" });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "undetermined" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			// The wording measured to reach the formal lane (`pi-adapter.test.ts` asserts the same phrase does), because
			// the gate only asks this question of a formal request.
			await host.events.get("input")?.({ type: "input", text: "设计一下这个模块", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "设计一下这个模块", systemPrompt: "" }, host.context);

			const decision = await callTool(host, "mcp_some_server_write", { path: "src/a.ts" }, "c-undetermined");
			assert.notEqual(decision?.block, true, "the gate admits an undeclared tool, and this is the default it was chosen to keep: " + (decision?.reason ?? "(no reason)"));
			assert.ok(
				host.notifications.some((message) => /is not declared as a product mutation or as read-only/.test(message)),
				"the operator is told the admission was undetermined, rather than left to infer that the tool was reviewed: " + host.notifications.join(" | "),
			);

			const approved = readFileSync(join(stateDir, "execution.jsonl"), "utf8")
				.trim().split(/\r?\n/).filter(Boolean)
				.map((line) => JSON.parse(line) as { kind?: string; details?: { gate?: string; action?: string; reason?: string; viaCapability?: boolean } })
				.find((record) => record.kind === "gate.approved" && record.details?.gate === "undetermined-disposition");
			assert.ok(approved !== undefined, "the admission is recorded, so a later reader can tell it from a reviewed decision");
			assert.equal(approved?.details?.action, "mcp_some_server_write", "and the record names the action rather than only the umbrella tool");
			assert.match(approved?.details?.reason ?? "", /No declaration covers/, "and says why the gate could not decide");
		} finally {
			host.restoreCwd();
		}
	});
	it("admits a non-conversational message in the provider payload, and leaves the conversation alone", async () => {
		// The channel the recorded incident used: a background/extension message that never passed the tool-result
		// guard. The deep marker sits in the middle, so its absence proves the payload is out rather than truncated.
		const body = "y".repeat(20_000) + "DEEP-MARKER-9f3a" + "z".repeat(20_000);
		const payload = {
			messages: [
				{ role: "user", content: "review this" },
				{ role: "custom", customType: "pi-lens-diagnostics", content: [{ type: "text", text: body }] },
				{ role: "toolResult", content: [{ type: "text", text: body }] },
			],
		};
		const result = await admitNonConversationalMessages(payload, 8_000);
		const messages = (result.payload as { messages: Array<{ role: string; content: unknown }> }).messages;
		assert.equal(messages[0]?.content, "review this", "a user message is the conversation and is never rewritten");
		const extensionText = (messages[1]?.content as Array<{ text: string }>)[0]?.text ?? "";
		assert.ok(extensionText.length <= 8_000, "the extension message is compacted into the budget");
		assert.match(extensionText, /channel: extension_message/, "and the marker says which channel it came through");
		assert.ok(!extensionText.includes("DEEP-MARKER-9f3a"), "the payload is absent from model-visible content, not truncated into it");
		assert.equal(((messages[2]?.content as Array<{ text: string }>)[0]?.text ?? "").length, body.length, "a tool result is admitted at its own hook, not twice");
		assert.equal(result.leftAlone, 0, "nothing was skipped in silence");
	});
	it("refuses a pass that cites a label, and one whose record does not exist", async () => {
		// Two layers, and neither is sufficient alone: the shape rule refuses a ref the agent could have authored, and
		// the resolution rule refuses a well-shaped ref to a record the harness never wrote. A pass is what an agent
		// most wants and the harness can least check, so both are needed - and with the observable now recorded per tool
		// call (and named in the result), a citation the agent can actually produce exists, which is what the earlier
		// attempt at this rule lacked.
		assert.throws(
			() => convergenceOperationFromPiInput({ operation: "progress", acceptanceId: "AC-001", status: "passed" }),
			/requires at least one evidenceRef/,
		);
		assert.throws(
			() => convergenceOperationFromPiInput({ operation: "progress", acceptanceId: "AC-001", status: "passed", evidenceRefs: ["evidence:formal-pass"] }),
			/refuses evidence:formal-pass/,
			"a label is something the agent can write, so it cannot decide whether the criterion passed",
		);
		const shaped = convergenceOperationFromPiInput({ operation: "progress", acceptanceId: "AC-001", status: "passed", evidenceRefs: ["ledger:tool:suite-run"] });
		assert.equal(shaped.action, "progress", "a ref naming a ledger step passes the shape rule");

		const effectsDirectory = join(freshRoot(), ".dove", "effects");
		assert.deepEqual(
			await unresolvedAcceptanceEvidence(["ledger:tool:suite-run", "ledger:tool:never-ran", "effect:missing"], { readLedger: async () => [{ stepId: "tool:suite-run" }], effectsDirectory }),
			["ledger:tool:never-ran", "effect:missing"],
			"a well-shaped ref is not a record",
		);
	});
	it("stops a run that cannot make progress, and says so with a typed reason", async () => {
		// The most-reported production failure in this repository's own history: one request issued 63 shell calls,
		// including fourteen identical ones in a single assistant message, and kept going. A guard that only warns
		// leaves the loop running; what M7 asks for is a run that **stops and says why**.
		const root = freshRoot();
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "inspect the workspace", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "inspect the workspace", systemPrompt: "" }, host.context);

			let terminated: { block?: boolean; terminate?: boolean; reason?: string } | undefined;
			for (let attempt = 1; attempt <= 8 && terminated === undefined; attempt += 1) {
				const callId = "ls-" + attempt;
				const input = { path: "." };
				// A turn boundary per attempt, because that is what separates the two answers the guard gives: identical
				// reads inside one batch are **coalesced** (the duplicate is answered with the first one's call id), and
				// identical reads across batches are what eventually **terminates** the run. Driving eight calls in one
				// batch tests coalescing and never reaches the stop.
				await host.events.get("turn_start")?.({ type: "turn_start" }, host.context);
				const decision = await callTool(host, "ls", input, callId);
				if (decision?.terminate === true) terminated = decision;
				// The same observation every time: a read that returns what the last one returned is not progress, which
				// is exactly the shape the recorded failure had.
				await host.events.get("tool_result")?.({ type: "tool_result", toolCallId: callId, toolName: "ls", input, content: [{ type: "text", text: "unchanged listing" }], isError: false }, host.context);
			}
			assert.ok(terminated !== undefined, "a loop that cannot progress must stop, not run to the turn limit");
			assert.equal(terminated?.block, true, "and the action that would continue it is refused");
			assert.match(terminated?.reason ?? "", /\[Dove progress guard\]/, "the refusal names the guard, not only the outcome");
			assert.match(terminated?.reason ?? "", /stop and change/i, "and tells the operator what to do instead");

			// Visible to the operator means recorded, not merely returned: a typed reason that leaves no trace is
			// indistinguishable later from a run that simply ended.
			await host.events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "completed", content: [] }] }, host.context);
			const ledgerFile = join(stateDir, "execution.jsonl");
			const records = existsSync(ledgerFile) ? readFileSync(ledgerFile, "utf8").split("\n").filter((line) => line.trim() !== "") : [];
			const terminal = records.find((line) => line.includes("\"request.terminal\"") && line.includes("progress-guard"));
			assert.ok(terminal !== undefined, "the typed reason reaches the ledger, where a later reader can find it");
		} finally {
			host.restoreCwd();
		}
	});
	it("coalesces an identical read inside one turn instead of stopping the run", async () => {
		// The distinction that made the test above wrong on its first attempt, pinned so it is not re-learned: a
		// duplicate read-only call **inside one batch** is answered with the first call's id, because repeating yourself
		// within a turn is not the same failure as a run that cannot progress across turns. Only the latter stops.
		const root = freshRoot();
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "inspect", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "inspect", systemPrompt: "" }, host.context);
			await host.events.get("turn_start")?.({ type: "turn_start" }, host.context);
			const first = await callTool(host, "ls", { path: "." }, "ls-a");
			assert.notEqual(first?.block, true, "the first read runs");
			const duplicate = await callTool(host, "ls", { path: "." }, "ls-b");
			assert.equal(duplicate?.block, true, "the duplicate is refused");
			assert.notEqual(duplicate?.terminate, true, "but it does not stop the run: it is a repeat, not stagnation");
			assert.match(duplicate?.reason ?? "", /coalesced/, "and the reason says which of the two happened");
		} finally {
			host.restoreCwd();
		}
	});
	it("refuses to start a conformance run whose engagement does not pre-flight clean", async () => {
		// The shipped example engagement names evidence digests no file can match ("aaaa"), which is exactly the state a
		// reader of modes/pentest/MODE.md is promised the harness refuses. Before this, the promise was prose with no
		// caller behind it.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "pentest");
		copyEngagements(root);
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "pentest" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			const refusal = host.notifications.find((message) => /does not pre-flight clean/.test(message));
			assert.ok(refusal !== undefined, "the run must not start: " + host.notifications.join(" | "));
			assert.match(refusal, /cannot start/, "and the reason says what could not be established");
			const decision = await callTool(host, "bash", { command: "ls" });
			assert.equal(decision?.block, true, "and no action runs under an engagement that did not pre-flight");
		} finally {
			host.restoreCwd();
		}
	});
});

describe("the fence at the host boundary  [D8]", () => {
	it("announces the protected surface and the shell stance, and refuses a write into it", async () => {
		// The announcement is part of the control, not decoration: a fence the operator cannot see is a restriction
		// nobody can review, and `shell: denied` is what makes the path check the whole story rather than half of it.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "fenced", { capability: "workspace.inspect", fence: { paths: ["modes", "tests"], shell: "denied" } });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "fenced" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			// **A request lease is required for the argument-reading half of the policy to run at all**
			// (`extension.ts`, without an active lease the handler returns after the name-only denial). So a case
			// about a control that reads arguments opens a request the way the host does, or it would be asserting
			// against a call path the fence never sees.
			await host.events.get("input")?.({ type: "input", text: "review the harness", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "review the harness", systemPrompt: "" }, host.context);
			const banner = host.notifications.find((message) => /fenced loaded from modes\/fenced/.test(message));
			assert.ok(banner !== undefined, host.notifications.join(" | "));
			assert.match(banner ?? "", /fence protects 2 workspace path\(s\) \(modes, tests\)/, "the operator is told which paths");
			assert.match(banner ?? "", /refuses bash and powershell/, "and that the one route the fence cannot see is closed");

			const inside = await callTool(host, "write", { path: "modes/fenced/governance.yaml", content: "x" }, "c-fence-in");
			assert.equal(inside?.block, true, "a write into the mode's own governance file is refused");
			// The host prefixes the mode id, so the policy's own label is inside the reason rather than at its head - and
			// it is that label the ledger records as the gate that refused the action.
			assert.match(inside?.reason ?? "", /\[fence\]/, "and the reason names the control that refused it");
			assert.match(inside?.reason ?? "", /'modes'/);

			const outside = await callTool(host, "write", { path: "src/notes.md", content: "x" }, "c-fence-out");
			assert.notEqual(outside?.block, true, "a write outside every prefix is not the fence's business: " + (outside?.reason ?? "(no reason)"));
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses a mutation it cannot classify, and names the declaration that would allow it", async () => {
		// `mkdir` mutates and is not in the verified target map, so the fence has no route to its target. This is the
		// host-level half of the fail-closed rule: the mode can allow it, by declaring where that tool's target lives.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "fenced", { capability: "workspace.inspect", fence: { paths: ["modes"], shell: "denied" } });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "fenced" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			// **A request lease is required for the argument-reading half of the policy to run at all**
			// (`extension.ts`, without an active lease the handler returns after the name-only denial). So a case
			// about a control that reads arguments opens a request the way the host does, or it would be asserting
			// against a call path the fence never sees.
			await host.events.get("input")?.({ type: "input", text: "review the harness", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "review the harness", systemPrompt: "" }, host.context);
			const decision = await callTool(host, "mkdir", { path: "new-dir" }, "c-fence-unmapped");
			assert.equal(decision?.block, true, "a mutation the fence cannot read does not run inside a fence");
			assert.match(decision?.reason ?? "", /route the fence cannot read/);
			assert.match(decision?.reason ?? "", /fence\.targets\.mkdir/, "and the reason names the declaration that would change the answer");
		} finally {
			host.restoreCwd();
		}
	});

	it("refuses a hidden write: one unreadable entry in a batched patch makes the whole call unreadable", async () => {
		// `agent_workspace_patch` names a list. The first entry alone would pass, so a fence that classified the batch
		// by its first entry would refuse nothing here while reporting that it had checked.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "fenced", { capability: "workspace.inspect", fence: { paths: ["tests"], shell: "denied" } });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "fenced" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			// **A request lease is required for the argument-reading half of the policy to run at all**
			// (`extension.ts`, without an active lease the handler returns after the name-only denial). So a case
			// about a control that reads arguments opens a request the way the host does, or it would be asserting
			// against a call path the fence never sees.
			await host.events.get("input")?.({ type: "input", text: "review the harness", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "review the harness", systemPrompt: "" }, host.context);
			const hidden = await callTool(
				host,
				"agent_workspace_patch",
				{ operations: [{ kind: "write", path: "src/a.ts", content: "x" }, { kind: "delete", path: "tests/old.test.ts" }] },
				"c-fence-batch",
			);
			assert.equal(hidden?.block, true, "the second operation is the one the fence exists for");
			assert.match(hidden?.reason ?? "", /'tests'/);
			const clean = await callTool(host, "agent_workspace_patch", { operations: [{ kind: "write", path: "src/a.ts", content: "x" }] }, "c-fence-clean");
			assert.notEqual(clean?.block, true, "while a batch entirely outside the fence is allowed: " + (clean?.reason ?? "(no reason)"));
		} finally {
			host.restoreCwd();
		}
	});

	it("declares the shell route open rather than leaving it unsaid, and the banner says so", async () => {
		// `uncovered` is legal because a mode may genuinely need the shell. What is not legal is silence: the fence
		// cannot see through the shell, so the gap is stated at load where the operator is already reading.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		writeFixtureMode(root, "open", { capability: "workspace.inspect", fence: { paths: ["modes"], shell: "uncovered" } });
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "open" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			// **A request lease is required for the argument-reading half of the policy to run at all**
			// (`extension.ts`, without an active lease the handler returns after the name-only denial). So a case
			// about a control that reads arguments opens a request the way the host does, or it would be asserting
			// against a call path the fence never sees.
			await host.events.get("input")?.({ type: "input", text: "review the harness", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "review the harness", systemPrompt: "" }, host.context);
			const banner = host.notifications.find((message) => /open loaded from modes\/open/.test(message));
			assert.match(banner ?? "", /shell: 'uncovered'/, "the banner names the stance in force");
			assert.match(banner ?? "", /can still write into those paths/, "and says what it means for the fence");
			const shell = await callTool(host, "bash", { command: "echo x > modes/open/governance.yaml" }, "c-fence-shell");
			assert.notEqual(shell?.block, true, "so the shell is not refused by the fence: " + (shell?.reason ?? "(no reason)"));
			const write = await callTool(host, "write", { path: "modes/open/governance.yaml", content: "x" }, "c-fence-still");
			assert.equal(write?.block, true, "while the path check still applies to the tools it can read");
		} finally {
			host.restoreCwd();
		}
	});
});





