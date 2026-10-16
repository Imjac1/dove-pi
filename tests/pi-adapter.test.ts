import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";
import extension, { accumulateRequestUsage, applyAdaptiveShellTimeout, classifyAssistantProviderFailure, compactModelPayload, admitToolResult, emptyRequestResourceSnapshot, formatTaskInventoryGuidance, getLsObservationMetadata, getProjectContextBudget, getToolResultCharBudget, normalizeLsToolInput, readOnlyToolBudget, readProjectContinuationForPlan } from "../src/pi-adapter/extension.ts";
// The shell predicate moved to the one classifier module with the rest of the mutation/replay question; it is the
// gate's reading of a command's text, and it is asserted there rather than through the adapter that consumes it.
import { isReadOnlyShellCommand } from "../src/core/invocation-disposition.ts";
import { createRequestPlan } from "../src/core/request-plan.ts";
import { createStrategySnapshot } from "../src/core/strategy-snapshot.ts";
import { ExecutionLedger } from "../src/core/execution-ledger.ts";
import { hasHashlineEditTools, selectDoveToolNames } from "../src/pi-adapter/tool-profile.ts";
import { formatProgressSnapshot, progressFingerprint, ProgressGuard } from "../src/pi-adapter/progress-guard.ts";
import { representativeTools } from "./fixtures/representative-tool-catalog.ts";
import { createProjectProvider, nativeProjectStatePath, nativeTaskConvergencePath, type ProjectContextSnapshot, type ProjectProvider, type ProjectTask } from "../src/project-provider/index.ts";
import { SEPT1_QUESTION_VARIANTS, sept1QuestionInput } from "./fixtures/sept1-question-loop.ts";
import { restoreLatestContextSnapshot } from "../src/pi-adapter/context-snapshot.ts";

const adapterStateDir = mkdtempSync(join(tmpdir(), "pi-adapter-state-"));
const previousStateDir = process.env.DOVE_PI_STATE_DIR;
const repositoryNativeStatePath = join(process.cwd(), ".dove", "state.json");
const previousRepositoryNativeState = existsSync(repositoryNativeStatePath) ? readFileSync(repositoryNativeStatePath, "utf8") : undefined;
process.env.DOVE_PI_STATE_DIR = adapterStateDir;
after(() => {
	if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
	else process.env.DOVE_PI_STATE_DIR = previousStateDir;
	rmSync(adapterStateDir, { recursive: true, force: true });
	if (previousRepositoryNativeState === undefined) rmSync(repositoryNativeStatePath, { force: true });
	else writeFileSync(repositoryNativeStatePath, previousRepositoryNativeState, "utf8");
});

describe("Pi adapter", () => {
	it("bounds every shell command, tightly for aggregate verification and at a ceiling for the rest", () => {
		// **The ceiling is here because a run was lost without one.** Measured 2026-10-12, on the first of three
		// customer-path passes: the agent wanted to tell pre-existing lint errors from ones it had introduced, `git` was
		// unusable in the run's own copy, and it searched the whole filesystem for the project instead -
		// `find / -name "controller.py" -path "*cachecontrol*"`. Pi's bash tool has no default timeout, that command is
		// not shaped like aggregate verification, and `timeoutApplied: false` is what the ledger recorded while the run
		// sat there until the harness killed it at its budget. The record was right and the run was still lost.
		const aggregate: Record<string, unknown> = { command: "go test -count=1 ./server/... 2>&1 | tail -60" };
		assert.deepEqual(applyAdaptiveShellTimeout("bash", aggregate, {}), { applied: true, timeoutSeconds: 240, reason: "aggregate-verification" });
		assert.equal(aggregate.timeout, 240);
		const explicit: Record<string, unknown> = { command: "go test ./...", timeout: 900 };
		assert.deepEqual(applyAdaptiveShellTimeout("bash", explicit, {}), { applied: false, reason: "explicit-timeout" });
		assert.equal(explicit.timeout, 900);
		const ordinary: Record<string, unknown> = { command: "git status --short" };
		assert.deepEqual(applyAdaptiveShellTimeout("bash", ordinary, {}), { applied: true, timeoutSeconds: 900, reason: "command-ceiling" });
		assert.equal(ordinary.timeout, 900);
		// The command that hung that run, kept as a fixture so the ceiling is checked against the shape that needed it.
		const wholeDiskSearch: Record<string, unknown> = { command: 'find / -name "controller.py" -path "*cachecontrol*" -not -path "*/dove-check/*" 2>/dev/null | head' };
		assert.deepEqual(applyAdaptiveShellTimeout("bash", wholeDiskSearch, {}), { applied: true, timeoutSeconds: 900, reason: "command-ceiling" });
		assert.equal(wholeDiskSearch.timeout, 900);
		// **The control, and it is what keeps the old sentence true as an option rather than as a claim**: `0` turns the
		// ceiling off for an operator who wants ordinary commands untouched.
		const untouched: Record<string, unknown> = { command: "git status --short" };
		assert.deepEqual(applyAdaptiveShellTimeout("bash", untouched, { DOVE_PI_SHELL_CEILING_SECONDS: "0" }), { applied: false, reason: "ceiling-disabled" });
		assert.equal(untouched.timeout, undefined);
		// **Turning the aggregate rule off no longer means "unbounded".** The command falls to the ceiling, because the
		// reason the ceiling exists is that one command must not be able to hang a run, and that should not depend on
		// remembering a second variable. The opt-out is the ceiling's own knob, checked just above.
		const aggregateOff: Record<string, unknown> = { command: "npm test" };
		assert.deepEqual(applyAdaptiveShellTimeout("bash", aggregateOff, { DOVE_PI_SHELL_TIMEOUT_SECONDS: "0" }), { applied: true, timeoutSeconds: 900, reason: "command-ceiling" });
		assert.equal(aggregateOff.timeout, 900);
		const invalid: Record<string, unknown> = { command: "npm test" };
		assert.deepEqual(applyAdaptiveShellTimeout("bash", invalid, { DOVE_PI_SHELL_TIMEOUT_SECONDS: "not-a-number" }), { applied: true, timeoutSeconds: 240, reason: "invalid-configuration-defaulted" });
		assert.equal(invalid.timeout, 240);
	});

	it("forwards the adaptive timeout through Pi and preserves a structured timeout", async () => {
		let receivedTimeout: number | undefined;
		const bash = createBashTool(process.cwd(), {
			operations: {
				exec: async (_command, _cwd, options) => {
					receivedTimeout = options.timeout;
					throw new Error(`timeout:${options.timeout}`);
				},
			},
		});
		const input = { command: "npm test" } as { command: string; timeout?: number };
		applyAdaptiveShellTimeout("bash", input, { DOVE_PI_SHELL_TIMEOUT_SECONDS: "1" });
		await assert.rejects(() => bash.execute("adaptive-timeout", input, undefined, undefined), /Command timed out after 1 seconds/);
		assert.equal(receivedTimeout, 1);
	});

	it("reads the prompt from either shape the host gives it, including the one that carries no prompt field", async () => {
		// **The compatibility matrix's red, reproduced as a case.** Measured 2026-10-13: the latest Pi (1.2.0) split this
		// event into a union - the `user` variant carries `prompt`, the `custom` variant carries `message` and has no
		// `prompt` at all - where the pinned 1.0.0 had one interface with `prompt` on it. Dove read `event.prompt`
		// unconditionally, which is right for 1.0.0 and a typecheck failure against the latest channel. The read is
		// structural now, and this case is the claim rather than the spelling: **the same text through either shape must
		// reach the planner and produce the same plan.**
		//
		// Its own state directory and its own project, so the ledger it reads is only its own: the file-level fixture is
		// shared, and a case that leaves `request.planned` records in it changes what the cases after it are reading.
		const root = mkdtempSync(join(tmpdir(), "pi-either-shape-"));
		mkdirSync(join(root, ".dove"), { recursive: true });
		const goal = { id: "goal-either-shape", title: "Either shape", status: "active", formal: true, phase: "intake", createdAt: "2026-10-13T00:00:00.000Z", updatedAt: "2026-10-13T00:00:00.000Z", decisions: [], verification: [] };
		writeFileSync(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, currentGoalId: goal.id, goals: [goal] }), "utf8");
		const previousCwd = process.cwd();
		const previousStateDir = process.env.DOVE_PI_STATE_DIR;
		process.chdir(root);
		process.env.DOVE_PI_STATE_DIR = join(root, "state");
		try {
			const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
			const api = {
				registerCommand() {}, registerShortcut() {}, registerTool() {}, registerFlag() {}, appendEntry() {},
				getAllTools() { return representativeTools.map((name) => ({ name })); },
				setActiveTools() {}, getActiveTools() { return [...representativeTools]; },
				getThinkingLevel() { return "high"; },
				on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
			} as unknown as ExtensionAPI;
			extension(api);
			const context: FakeContext = {
				ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {} },
				sessionManager: { getEntries: () => [], getSessionId: () => "either-shape-session" },
			};
			const ledgerPath = join(root, "state", "execution.jsonl");
			const lastLane = (): string | undefined => readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean)
				.map((line) => JSON.parse(line) as { kind?: string; details?: { lane?: string } })
				.filter((record) => record.kind === "request.planned").at(-1)?.details?.lane;
			const text = "Implement the RFC 8246 immutable directive in the cache controller and freeze the acceptance criteria first";
			await events.get("before_agent_start")?.({ type: "before_agent_start", messageType: "user", prompt: text, systemPrompt: "" }, context);
			const userLane = lastLane();
			// The same text, carried the other way, with no `prompt` field for Dove to read.
			await events.get("before_agent_start")?.({ type: "before_agent_start", messageType: "custom", message: { content: text }, systemPrompt: "" }, context);
			const customLane = lastLane();
			assert.equal(userLane, "formal", `the user-shaped event reached the planner: ${String(userLane)}`);
			assert.equal(customLane, userLane, "and the custom-shaped one produced the same plan, which is the whole claim");
		} finally {
			process.chdir(previousCwd);
			if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
			else process.env.DOVE_PI_STATE_DIR = previousStateDir;
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("allows only explicitly read-only shell checks before formal acceptance freeze", () => {
		assert.equal(isReadOnlyShellCommand("bash", { command: "git -C /repo log --oneline -5; echo ---; git -C /repo status --porcelain" }), true);
		assert.equal(isReadOnlyShellCommand("bash", { command: "cd /repo && go vet ./... 2>&1 | head -40" }), true);
		assert.equal(isReadOnlyShellCommand("powershell", { command: "Get-ChildItem -Force; Get-Content README.md" }), true);
		assert.equal(isReadOnlyShellCommand("bash", { command: "go vet ./... > /tmp/vet.out 2>&1; rc=$?; echo vet-exit=$rc; wc -c < /tmp/vet.out" }), true);
		assert.equal(isReadOnlyShellCommand("bash", { command: "grep -n \"prof, err := listener.LoadProfile\\|operator.NewHandlers\" file.go; echo ---; git status --short" }), true);
		assert.equal(isReadOnlyShellCommand("bash", { command: "python -c \"open('file.txt','w').write('x')\"" }), false);
		assert.equal(isReadOnlyShellCommand("bash", { command: "git status > status.txt" }), false);
		assert.equal(isReadOnlyShellCommand("bash", { command: "sed -i 's/a/b/' file.go" }), false);
		assert.equal(isReadOnlyShellCommand("bash", { command: "git diff --output=patch.txt" }), false);
		assert.equal(isReadOnlyShellCommand("bash", { command: "go env -w GOPATH=/tmp" }), false);
		assert.equal(isReadOnlyShellCommand("bash", { command: "unknown-tool --inspect" }), false);
	});

	/**
	 * A session start over the tool surface the warning is about: the host's own `edit` is there, the hashline family is
	 * not. `representativeTools` cannot be used for this - it carries `replace`/`insert`, so `hasHashlineEditTools` reads
	 * the family as present and the warning never fires.
	 */
	async function sessionStartNotifications(agentDir?: string): Promise<string[]> {
		const toolNames = ["read", "grep", "find", "ls", "bash", "powershell", "edit", "write"];
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const notifications: string[] = [];
		const api = {
			registerCommand() {},
			registerShortcut() {},
			registerTool() {},
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return toolNames.map((name) => ({ name })); },
			setActiveTools() {},
			getActiveTools() { return [...toolNames]; },
			getThinkingLevel() { return "max"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		const context: FakeContext = {
			hasUI: true,
			// **A cwd, because a session has one.** `SettingsManager.create` normalises it, so a fixture without one makes
			// the declared-package check throw before it can report anything - measured 2026-10-14, on this case's first
			// version.
			cwd: agentDir ?? process.cwd(),
			ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify: (message) => notifications.push(message) },
			sessionManager: { getEntries: () => [], getSessionId: () => "declared-packages" },
			getContextUsage: () => ({ tokens: 0, contextWindow: 1_000_000 }),
		};
		await events.get("session_start")?.({ type: "session_start" }, context);
		return notifications;
	}

	it("names the declaration that has nothing behind it, instead of blaming the host", async () => {
		// **The message this repository wrote about its own tool surface, and the cause it got wrong.** It said the
		// current Pi host does not provide the hashline edit tools. Corrected by measurement on 2026-10-05: the host
		// provides them - what was missing was the agent directory's package store, because `settings.json` declares the
		// packages and Pi resolves them from that store, so a declaration that travels without the store loads nothing.
		// The message now names the declaration it can see is unsatisfied and says where it looked. Measured 2026-10-14:
		// with `npm:pi-hashline-edit-pro@2.7.0` declared and no store beside it, the old wording blamed the host.
		const agentDir = mkdtempSync(join(tmpdir(), "pi-adapter-declared-"));
		const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = agentDir;
		try {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ packages: ["npm:pi-hashline-edit-pro@2.7.0"] }), "utf8");
			const notifications = await sessionStartNotifications(agentDir);
			const warning = notifications.find((message) => /hashline/.test(message));
			assert.ok(warning, "the missing family is still announced: " + JSON.stringify(notifications));
			assert.match(warning, /pi-hashline-edit-pro/, "and the declaration the store does not satisfy is named: " + warning);
			assert.doesNotMatch(warning, /宿主未提供/, "instead of blaming the host for a declaration that never arrived: " + warning);
		} finally {
			if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
			rmSync(agentDir, { recursive: true, force: true });
		}
	});

	it("does not blame a declaration whose package the store has", async () => {
		// **The control, and it is what makes the sentence mean something.** Same declaration, same missing family, and
		// the only difference is that the store has the package - so nothing about the declaration may be named as the
		// cause. Without this, a message that named every declaration it could read would pass the case above.
		const agentDir = mkdtempSync(join(tmpdir(), "pi-adapter-declared-present-"));
		const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = agentDir;
		try {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ packages: ["npm:pi-hashline-edit-pro@2.7.0"] }), "utf8");
			mkdirSync(join(agentDir, "npm", "node_modules", "pi-hashline-edit-pro"), { recursive: true });
			const notifications = await sessionStartNotifications(agentDir);
			const warning = notifications.find((message) => /hashline/.test(message));
			assert.ok(warning, "the missing family is still announced: " + JSON.stringify(notifications));
			assert.doesNotMatch(warning, /pi-hashline-edit-pro/, "a declaration the store satisfies is not named as the cause: " + warning);
		} finally {
			if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
			rmSync(agentDir, { recursive: true, force: true });
		}
	});

	it("does not call a package missing while the project store has it", async () => {
		// **A verifier's counterexample, kept as a case.** The first version of this check searched one store - the managed
		// user one - while the host also resolves a project-scope declaration from the project's own store, so a person
		// whose package was installed there would have been told their declaration had nothing behind it. That is the exact
		// failure this message exists to remove, and it was measured on 2026-10-14 rather than imagined: the host's own
		// resolver is private, and it chooses between at least three stores.
		const agentDir = mkdtempSync(join(tmpdir(), "pi-adapter-project-store-"));
		const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = agentDir;
		try {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ packages: ["npm:pi-hashline-edit-pro@2.7.0"] }), "utf8");
			mkdirSync(join(agentDir, ".pi", "npm", "node_modules", "pi-hashline-edit-pro"), { recursive: true });
			const notifications = await sessionStartNotifications(agentDir);
			const warning = notifications.find((message) => /hashline/.test(message));
			assert.ok(warning, "the missing family is still announced: " + JSON.stringify(notifications));
			assert.doesNotMatch(warning, /pi-hashline-edit-pro/, "a package the project store has is not called missing: " + warning);
		} finally {
			if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
			rmSync(agentDir, { recursive: true, force: true });
		}
	});

	it("does not call a package missing while the legacy global store has it", async () => {
		// The host falls back to a legacy global store for a user-scope declaration whose managed path is empty
		// (`getNpmInstallPath`), and that is where a plain global npm install puts things - this machine has one and it is
		// not empty. The store is read from a configured prefix, and failing that from the platform's own location.
		const agentDir = mkdtempSync(join(tmpdir(), "pi-adapter-legacy-store-"));
		const prefix = mkdtempSync(join(tmpdir(), "pi-adapter-prefix-"));
		const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		const previousPrefix = process.env.npm_config_prefix;
		process.env.PI_CODING_AGENT_DIR = agentDir;
		process.env.npm_config_prefix = prefix;
		try {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ packages: ["npm:pi-hashline-edit-pro@2.7.0"] }), "utf8");
			mkdirSync(join(prefix, "node_modules", "pi-hashline-edit-pro"), { recursive: true });
			const notifications = await sessionStartNotifications(agentDir);
			const warning = notifications.find((message) => /hashline/.test(message));
			assert.ok(warning, "the missing family is still announced: " + JSON.stringify(notifications));
			assert.doesNotMatch(warning, /pi-hashline-edit-pro/, "a package the legacy global store has is not called missing: " + warning);
		} finally {
			if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
			if (previousPrefix === undefined) delete process.env.npm_config_prefix;
			else process.env.npm_config_prefix = previousPrefix;
			rmSync(agentDir, { recursive: true, force: true });
			rmSync(prefix, { recursive: true, force: true });
		}
	});

	it("advises on a long conversation through the handler, and only that guard fires", async () => {
		// **The turn cap is wired and this holds the wiring.** A case of its own, for the same reason as the one
		// below: every notice is one-shot per `extension(api)` call. And it stages a small prefix on purpose, so
		// the fraction and token guards stay silent and the assertion is about the cap rather than about whichever
		// adviser happened to speak first.
		const previousCap = process.env.DOVE_PI_MAX_MESSAGES;
		process.env.DOVE_PI_MAX_MESSAGES = "3";
		try {
			const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
			const notifications: string[] = [];
			let sessionEntries: unknown[] = [];
			const api = {
				registerCommand() {},
				registerShortcut() {},
				registerTool() {},
				registerFlag() {},
				appendEntry() {},
				getAllTools() { return representativeTools.map((name) => ({ name })); },
				setActiveTools() {},
				getActiveTools() { return [...representativeTools]; },
				getThinkingLevel() { return "max"; },
				on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
			} as unknown as ExtensionAPI;
			extension(api);
			const context: FakeContext = {
				hasUI: true,
				ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify: (message) => notifications.push(message) },
				sessionManager: { getEntries: () => sessionEntries, getSessionId: () => "cap-session" },
				// Deliberately small, so neither the fraction guard nor the absolute token guard can fire.
				getContextUsage: () => ({ tokens: 1_000, contextWindow: 1_000_000 }),
			};
			const turn = () => events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "turn", systemPrompt: "" }, context);
			const cap = () => notifications.filter((message) => /条对话/.test(message));
			const other = () => notifications.filter((message) => /通过率|已累积约/.test(message));
			// At the cap exactly: quiet. The comparison is `>`, so a session of three turns under a cap of three is fine.
			sessionEntries = [{ type: "message" }, { type: "message" }, { type: "message" }];
			notifications.length = 0;
			await turn();
			assert.equal(cap().length, 0, `the cap does not fire at three: ${JSON.stringify(notifications)}`);
			assert.equal(other().length, 0, "and nothing else did either, which is what makes the next step about the cap");
			// Past it: one notice, naming both ways out and claiming neither.
			sessionEntries = [...sessionEntries, { type: "message" }, { type: "message" }];
			notifications.length = 0;
			await turn();
			assert.equal(cap().length, 1, `the cap is reported once: ${JSON.stringify(notifications)}`);
			assert.match(cap()[0] ?? "", /\/compact/, "it names the first way out");
			assert.match(cap()[0] ?? "", /新的会话/, "and the second");
			assert.match(cap()[0] ?? "", /5 条对话/, "and the count it saw");
			assert.equal(other().length, 0, "still nothing else, so this notice is the cap and not a neighbour");
			// The control: the flag is one-shot, so an identical turn reports nothing at all.
			notifications.length = 0;
			await turn();
			assert.equal(notifications.length, 0, "the notice does not repeat");
		} finally {
			if (previousCap === undefined) delete process.env.DOVE_PI_MAX_MESSAGES;
			else process.env.DOVE_PI_MAX_MESSAGES = previousCap;
		}
	});

	it("reports a cold start and a growing prefix through the fuse, once each", async () => {
		// **A case of its own because the flags are closure state.** Every notice the adapter raises is one-shot per
		// `extension(api)` call, so a case asserting a notice has to own the handler that raises it - which is what
		// the fuse wiring round meant by a different harness. This is that harness, with only what the fuse path
		// touches.
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const notifications: string[] = [];
		let sessionEntries: unknown[] = [];
		const api = {
			registerCommand() {},
			registerShortcut() {},
			registerTool() {},
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return representativeTools.map((name) => ({ name })); },
			setActiveTools() {},
			getActiveTools() { return [...representativeTools]; },
			getThinkingLevel() { return "max"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		const context: FakeContext = {
			hasUI: true,
			ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify: (message) => notifications.push(message) },
			sessionManager: { getEntries: () => sessionEntries, getSessionId: () => "fuse-session" },
			// The type omits it because most cases never read it; the handler checks for it at runtime.
			getContextUsage: () => ({ tokens: 220_000, contextWindow: 128_000 }),
		};
		// The entry shape `inspectCacheDiagnostics` reads, taken from its own extraction rather than guessed: an
		// assistant message with a usage record, timestamps in milliseconds.
		const assistant = (timestamp: number, input: number, cacheRead: number) => ({
			type: "message",
			message: { role: "assistant", provider: "p", model: "m", timestamp, usage: { input, cacheRead, cacheWrite: 0 } },
		});
		const turn = () => events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "turn", systemPrompt: "" }, context);
		const coldStarts = () => notifications.filter((message) => /full miss/.test(message));
		const pressures = () => notifications.filter((message) => /prompt prefix is/.test(message));
		// **1. A billed cold start, which is the state this reading exists to add.** Two messages six minutes apart,
		// the second reading no cache: the idle case the derivation recognizes. It is staged first because the
		// notice is one-shot, and because it is the only state the wiring reports.
		sessionEntries = [assistant(1_000_000, 400, 39_600), assistant(1_000_000 + 6 * 60 * 1000, 180_000, 0)];
		notifications.length = 0;
		await turn();
		assert.equal(coldStarts().length, 1, `the billed cold start is reported: ${JSON.stringify(notifications)}`);
		assert.match(coldStarts()[0] ?? "", /idle/, "and it names the miss reason the entries carry");
		// **2. A grown prefix is *not* this reading business, and the case says so.** Every sample read its cache,
		// so the ratio is 140300 of a 128000 window and the guard raises its own hint - while the fuse stays quiet,
		// because wiring it to repeat what the guard already says would be the duplicate this session keeps
		// recording. The assertion is that no *fuse* notice appears, not that nothing does.
		sessionEntries = [assistant(2_000_000, 200, 19_800), assistant(2_000_100, 300, 120_000)];
		notifications.length = 0;
		await turn();
		assert.equal(pressures().length, 0, `the fuse leaves growth to the guard: ${JSON.stringify(notifications)}`);
		assert.equal(coldStarts().length, 0, "and there was no miss to report either");
		// **3. The control.** The flag is one-shot, so an identical turn reports nothing at all.
		notifications.length = 0;
		await turn();
		assert.equal(notifications.length, 0, "neither notice repeats");
	});

	it("registers modes, shortcuts, capabilities, and doctor", async () => {
		const commands = new Map<string, { handler: (args: string, ctx: FakeContext) => Promise<void> }>();
		const shortcuts = new Map<string, { handler: (ctx: FakeContext) => Promise<void> }>();
		const tools = new Map<string, unknown>();
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const statuses: string[] = [];
		const statusColors: string[] = [];
		const notifications: string[] = [];
		const activeToolSets: string[][] = [];
		let hostActiveTools: string[] = [...representativeTools];
		let sessionEntries: unknown[] = [];
		let fallbackSessionEntries: unknown[] = [];
		let providerAborted = false;
		const api = {
			registerCommand(name: string, definition: { handler: (args: string, ctx: FakeContext) => Promise<void> }) { commands.set(name, definition); },
			registerShortcut(key: string, definition: { handler: (ctx: FakeContext) => Promise<void> }) { shortcuts.set(key, definition); },
			registerTool(definition: { name: string }) { tools.set(definition.name, definition); },
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return representativeTools.map((name) => ({ name })); },
			setActiveTools(names: string[]) { hostActiveTools = [...names]; activeToolSets.push(names); },
			getActiveTools() { return hostActiveTools; },
			getThinkingLevel() { return "max"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;

		extension(api);
		assert.deepEqual([...commands.keys()], ["mode", "dove-mode", "dove-workspace", "status", "subagent", "sysprompt", "reasoning-voice", "dove-thinking", "dove-tools", "设置", "settings-zh", "capabilities", "web", "skills", "project", "task", "memory"]);
		assert.equal(commands.has("thinking"), false, "Dove must not shadow Pi's built-in /thinking command");
		assert.equal(shortcuts.size, 2);
		assert.ok(shortcuts.has("ctrl+shift+l"));
		assert.ok(shortcuts.has("ctrl+alt+m"));
		assert.ok(tools.has("agent_run_capability"));
		assert.ok(tools.has("agent_list_capabilities"));
		assert.ok(tools.has("agent_doctor"));
		assert.ok(tools.has("agent_project_status"));
		assert.ok(tools.has("agent_project_task"));
		assert.ok(tools.has("agent_task_convergence"));
		assert.ok(tools.has("agent_project_context"));
		assert.ok(tools.has("agent_workspace_snapshot"));
		assert.ok(tools.has("agent_workspace_verify"));
		assert.ok(tools.has("agent_workspace_restore"));
		assert.ok(tools.has("agent_workspace_patch"));
		assert.ok(tools.has("agent_subagent"));
		const subagentTool = tools.get("agent_subagent") as { execute: (...args: unknown[]) => Promise<{ content: Array<{ text?: string }>; details?: { available?: boolean } }> };
		const subagentResult = await subagentTool.execute("subagent-call", { name: "inspect", prompt: "Read the project" });
		assert.equal(subagentResult.details?.available, false);
		assert.match(subagentResult.content[0]?.text ?? "", /Subagent unavailable/);
		const projectContextTool = tools.get("agent_project_context") as { execute: (...args: unknown[]) => Promise<{ content: Array<{ text?: string }> }> };
		const projectContextResult = await projectContextTool.execute("test-call", {});
		const projectContextText = projectContextResult.content[0]?.text ?? "";
		assert.ok(projectContextText.length < 20_000, `project context without a query must remain an index, not a raw project dump (length ${projectContextText.length})`);
		assert.match(projectContextText, /intentionally an index/);
		assert.match(projectContextText, /"taskCount"/);
		const projectStatusTool = tools.get("agent_project_status") as { promptGuidelines?: string[]; execute: (...args: unknown[]) => Promise<{ content: Array<{ text?: string }> }> };
		const projectStatusText = (await projectStatusTool.execute("status-call", {})).content[0]?.text ?? "";
		assert.match(projectStatusText, /"tasks"/);
		assert.match(projectStatusText, /"tasksOmitted"/);
		assert.match(projectStatusTool.promptGuidelines?.[0] ?? "", /use one agent_project_status result/i);
		assert.ok(events.has("before_agent_start"));
		assert.ok(events.has("message_end"));
		assert.ok(events.has("tool_result"));
		assert.ok(events.has("thinking_level_select"));
		assert.ok(events.has("before_provider_headers"));
		assert.ok(events.has("before_provider_request"));
		assert.ok(events.has("after_provider_response"));
		const context: FakeContext = {
			ui: {
				theme: { fg: (color, value) => { statusColors.push(color); return value; } },
				setStatus: (_key, value) => { if (value) statuses.push(value); },
				notify: (message) => { notifications.push(message); },
			},
			sessionManager: { getEntries: () => fallbackSessionEntries, getBranch: () => sessionEntries, getSessionId: () => "session-test" },
			abort: () => { providerAborted = true; },
		};
		// **The status line, which four rounds of review pointed at and no test ever invoked.** The two halves of it
		// cost differently, so they are asserted separately: the cache text is formatted from diagnostics already
		// inspected in the handler, while the goal line needs a ledger read and stays behind `/status full`.
		notifications.length = 0;
		await commands.get("status")?.handler("", context);
		const plainStatus = notifications.at(-1) ?? "";
		assert.match(plainStatus, /Cache: /, "the cache line shows without asking for full");
		assert.doesNotMatch(plainStatus, /Goals: /, "the goal line costs a ledger read and waits for full");
		assert.doesNotMatch(plainStatus, /Use \/status full for cache diagnostics/, "the hint is gone because it is no longer true");
		notifications.length = 0;
		await commands.get("status")?.handler("full", context);
		const fullStatus = notifications.at(-1) ?? "";
		assert.match(fullStatus, /Cache: /, "full keeps the cache line rather than replacing it");
		assert.match(fullStatus, /Goals: /, "full adds the goal line");
		// The control: the two calls are not the same string, so the assertions above are about the flag.
		assert.notEqual(plainStatus, fullStatus, "full changes the line");
		// **The four facts a user needs after a request died, and none of them is written by this command.** The work mode is a
		// closure variable the handler already shares; the last plan, the last terminal and the refusals are read back from the
		// ledger, which the handler now reads once for both of its halves instead of twice.
		assert.match(plainStatus, /workMode=none/, "no mode is declared for this workspace, and the line says so rather than omitting the field");
		assert.doesNotMatch(plainStatus, /LastPlan: /, "the ledger detail waits for full, the same way the goal line does");
		assert.match(fullStatus, /LastPlan: not recorded for this session/, "an empty ledger is stated, not left blank");
		assert.match(fullStatus, /LastTerminal: none\./, "'none' here means the ledger holds no terminal record for this session");
		assert.match(fullStatus, /Refused: none recorded for this session/, "a session with no refusal and a session whose refusals were dropped must not read the same");
		// **The duplicate projection is gone, and the fields it used to crowd out are asserted above.** The strategy line
		// carried a whole `Snapshot={...}` dump of the same object the ledger already holds in `request.planned`; on a
		// real session that dump pushed the three ledger readings past the 2048-character evidence bound, so the only
		// copy of them was the copy that got cut. Reordering them treated the symptom. Asserting the dump's absence is
		// what holds the fix: the readings no longer share a notification with a copy of something already recorded.
		assert.doesNotMatch(fullStatus, /Snapshot=/, "the strategy projection lives in the ledger, not in a second dump");
		assert.match(fullStatus, /strategy=/, "and the short strategy line that is unique to this message stays");

		// The presence case, written through the real ledger writers rather than by hand. The prompt is the one measured to reach the
		// formal lane, because that lane is what gates product mutations and therefore what a user most needs to see named.
		const statusLedger = new ExecutionLedger(join(adapterStateDir, "execution.jsonl"));
		const statusPlan = createRequestPlan({ message: "设计一下这个模块", requestId: "req-status", mode: "standard", interactionMode: "auto", projectAvailable: true });
		assert.equal(statusPlan.lane, "formal", "the wording that reaches the formal lane is the one the gate acts on");
		await statusLedger.appendRequestPlan("pi-session", "request:req-status", statusPlan, "session-test", createStrategySnapshot({
			plan: statusPlan,
			interactionMode: "auto",
			executionMode: "standard",
			thinkingPolicy: "auto",
			toolProfile: "auto",
			activeToolCount: representativeTools.length,
			providerRound: { used: 0 },
			readOnlyBudget: { used: 0 },
		}));
		await statusLedger.appendGateRefused({
			taskId: "pi-session",
			stepId: "gate:status-refusal",
			mode: "standard",
			tool: "write",
			action: "write",
			viaCapability: false,
			gate: "deny",
			reason: "[Dove convergence] Freeze stable acceptance criteria before the first formal product mutation.",
			remediation: "Resume the active acceptance criterion before mutating product files.",
			requestId: "req-status",
			sessionId: "session-test",
			toolCallId: "call-status",
		});
		await statusLedger.appendRequestTerminal({
			taskId: "pi-session",
			stepId: "request:req-status",
			mode: "standard",
			requestId: "req-status",
			sessionId: "session-test",
			reason: "failed",
			detail: "convergence-missing",
			policyAbort: true,
			terminal: { origin: "convergence", code: "convergence-missing", summary: "The first formal product mutation needs frozen acceptance criteria.", retryable: false, nextAction: "Freeze criteria, then resume the active acceptance criterion." },
		});
		const rowsBeforeStatus = (await statusLedger.read()).length;
		notifications.length = 0;
		await commands.get("status")?.handler("full", context);
		const statusAfterRefusal = notifications.at(-1) ?? "";
		assert.match(statusAfterRefusal, /LastPlan: project-work\/formal@req-status/, "the lane is read back after the request that produced it has settled");
		assert.match(statusAfterRefusal, /LastTerminal: convergence-missing: The first formal product mutation needs frozen acceptance criteria\. -> Freeze criteria/, "the terminal envelope reaches the user, not only its code");
		assert.match(statusAfterRefusal, /Refused: write\/deny\/\[Dove convergence\]/, "the gate and the action that was refused are both named");
		// The read-only guarantee: the command read the ledger and wrote nothing to it, so a status call cannot become evidence about
		// the thing it reports.
		assert.equal((await statusLedger.read()).length, rowsBeforeStatus, "status is a reader");
		notifications.length = 0;
		const capabilityTool = tools.get("agent_run_capability") as { execute: (...args: unknown[]) => Promise<{ details?: { status?: string } }> };
		const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = join(adapterStateDir, "pi-capability-no-confirm");
		try {
			const result = await capabilityTool.execute("capability-call", { name: "web.real_user_setup", args: { hosts: ["example.com"] } }, undefined, undefined, context);
			assert.equal(result.details?.status, "success", "an accepted Pi tool call must not require a second Dove confirmation");
		} finally {
			if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		}
		const headers: Record<string, string> = {};
		await events.get("before_provider_headers")?.({ type: "before_provider_headers", headers }, { ...context, model: { provider: "cc-switch-open-router", baseUrl: "https://openrouter.ai/api" } });
		assert.equal(headers["x-session-affinity"], "session-test");
		const preservedHeaders = { "x-session-affinity": "existing" };
		await events.get("before_provider_headers")?.({ type: "before_provider_headers", headers: preservedHeaders }, { ...context, model: { provider: "cc-switch-open-router" } });
		assert.equal(preservedHeaders["x-session-affinity"], "existing");
		const beforeProviderRequest = events.get("before_provider_request");
		assert.ok(beforeProviderRequest);
		await beforeProviderRequest({ type: "before_provider_request", payload: { max_tokens: 20, messages: [{ role: "user", content: "x".repeat(2_000) }] } }, { ...context, model: { contextWindow: 100, maxTokens: 20 } });
		assert.equal(providerAborted, true, "an over-budget Pi request must abort the host operation instead of relying on a swallowed exception");
		await events.get("session_start")?.(undefined, context);
		const piSessionBaseline = [...representativeTools];
		assert.equal(activeToolSets.length, 0, "Auto must observe Pi's active tools without calling setActiveTools");
		const diagnosticLedger = new ExecutionLedger(join(adapterStateDir, "execution.jsonl"));
		await diagnosticLedger.appendRequestTerminal({
			taskId: "pi-session",
			stepId: "request:doctor-diagnostics",
			mode: "standard",
			requestId: "doctor-diagnostics",
			sessionId: "session-test",
			reason: "failed",
			detail: "provider-authorization-denied",
			policyAbort: true,
			terminal: { origin: "provider", code: "provider-authorization-denied", summary: "The provider rejected authentication or authorization.", retryable: false, nextAction: "Check provider credentials and retry." },
		});
		const doctorTool = tools.get("agent_doctor") as { execute: (...args: unknown[]) => Promise<{ details: { strategy: { schemaVersion: number; executionMode: string; toolProfile: string; activeToolCount: number; providerRound: { used: number } }; diagnostics: { lastTerminal?: { terminal?: { origin?: string; code?: string } } }; subagent: { provider: string; configured: boolean; available: boolean; reason?: string }; toolSchemaStability: { inSync: boolean; expectedCount: number; activeCount: number; missing: string[]; unexpected: string[] } } }> };
		const doctorResult = await doctorTool.execute("doctor-call", {}, undefined, undefined, context);
		assert.equal(doctorResult.details.strategy.schemaVersion, 1);
		assert.equal(doctorResult.details.strategy.executionMode, "standard");
		assert.equal(doctorResult.details.strategy.toolProfile, "auto");
		assert.equal(doctorResult.details.strategy.activeToolCount, piSessionBaseline.length);
		assert.ok(Number.isInteger(doctorResult.details.strategy.providerRound.used));
		assert.ok(doctorResult.details.strategy.providerRound.used >= 0);
		assert.equal(doctorResult.details.subagent.provider, "pi-child");
		assert.equal(doctorResult.details.subagent.configured, false);
		assert.equal(doctorResult.details.subagent.available, false);
		assert.match(doctorResult.details.subagent.reason ?? "", /not configured|invalid/i);
		assert.deepEqual(doctorResult.details.toolSchemaStability, {
			inSync: true,
			expectedCount: piSessionBaseline.length,
			activeCount: piSessionBaseline.length,
			missing: [],
			unexpected: [],
			finalProvider: undefined,
		});
		assert.deepEqual(doctorResult.details.diagnostics.lastTerminal?.terminal, {
			origin: "provider",
			code: "provider-authorization-denied",
			summary: "The provider rejected authentication or authorization.",
			retryable: false,
			nextAction: "Check provider credentials and retry.",
		});
		assert.ok(statuses.some((value) => value.includes("Dove ◆ Standard · development · Auto · Ready")));
		assert.ok(statuses.some((value) => value.includes("Pi max")));
		assert.ok(notifications.some((value) => value.includes("Ctrl+P 切换模型")));
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		await events.get("tool_result")?.({ type: "tool_result", toolName: "bash", toolCallId: "1", input: { command: "bad" }, content: [{ type: "text", text: "failed" }], isError: true }, { ...context, hasUI: true });
		const guardedResult = await events.get("tool_result")?.({ type: "tool_result", toolName: "bash", toolCallId: "2", input: { command: "bad" }, content: [{ type: "text", text: "failed" }], isError: true }, { ...context, hasUI: true }) as { content?: Array<{ type: string; text?: string }> } | undefined;
		assert.ok(notifications.some((value) => value.includes("同一个工具失败调用重复 2 次")));
		assert.match(notifications.find((value) => value.includes("同一个工具失败调用重复 2 次")) ?? "", /重新读取当前状态/);
		assert.match(guardedResult?.content?.map((part) => part.text ?? "").join("\n") ?? "", /Dove progress advisory/);
		await events.get("agent_end")?.({ type: "agent_end", messages: [] }, context);
		await shortcuts.get("ctrl+alt+m")?.handler(context);
		assert.ok(statuses.some((value) => value.includes("Dove ✦ Ultra · development · Auto · Ready")));
		assert.ok(statusColors.includes("thinkingMax"));
		providerAborted = false;
		const unknownProviderPayload = { messages: [{ role: "user", content: "ok" }] };
		const unknownProviderResult = await beforeProviderRequest({ type: "before_provider_request", payload: unknownProviderPayload }, { ...context, model: { contextWindow: 12_800, maxTokens: 16_384 } });
		assert.equal(providerAborted, true, "Dove must abort when an unknown provider field prevents a required safe clamp");
		assert.equal(unknownProviderResult, undefined, "Dove must not invent a provider-specific output field");
		providerAborted = false;
		const boundedProviderPayload = await beforeProviderRequest({ type: "before_provider_request", payload: { max_tokens: 16_384, messages: [{ role: "user", content: "ok" }] } }, { ...context, model: { contextWindow: 12_800, maxTokens: 16_384 } });
		assert.equal(providerAborted, false);
		assert.equal((boundedProviderPayload as { max_tokens?: number })?.max_tokens, 12_543, "the payload sent by Pi must use the larger safe output reservation Dove accounted for");
		providerAborted = false;
		await beforeProviderRequest({
			type: "before_provider_request",
			payload: { max_tokens: 20, messages: [{ role: "user", content: "ok" }], tools: [{ type: "function", function: { name: "large", description: "x".repeat(1_000), parameters: {} } }] },
		}, { ...context, model: { contextWindow: 400, maxTokens: 20 } });
		assert.equal(providerAborted, true, "the final Pi gate must reject the real serialized tool schema rather than a count-only estimate");
		const dsmlResult = await events.get("message_end")?.({
			message: {
				role: "assistant",
				content: [{ type: "thinking", thinking: '<｜DSML｜tool_calls><｜DSML｜invoke name="read"><｜DSML｜parameter name="path" string="true">README.md</｜DSML｜parameter></｜DSML｜invoke></｜DSML｜tool_calls>', thinkingSignature: "" }],
				stopReason: "toolUse",
			},
		}, context);
		const dsmlMessage = (dsmlResult as { message?: { content?: Array<{ type: string; name?: string }> } } | undefined)?.message;
		assert.equal(dsmlMessage?.content?.[0]?.type, "toolCall");
		assert.equal(dsmlMessage?.content?.[0]?.name, "read");
		const executionLog = readFileSync(join(adapterStateDir, "execution.jsonl"), "utf8");
		assert.match(executionLog, /"stopReason":"tool_call"/);
		assert.match(executionLog, /"cachePrefix":\{"sequence":1,"classification":"cold"/);
		assert.match(executionLog, /"cache":\{"classification":"cold"/);

		await commands.get("mode")?.handler("fast", context);
		assert.ok(statuses.some((value) => value.includes("Dove · Fast · development · Auto · Ready")));
		await commands.get("mode")?.handler("ultra", context);
		assert.ok(statuses.filter((value) => value.includes("Dove ✦ Ultra · development · Auto · Ready")).length >= 2);
		await commands.get("dove-mode")?.handler("chat", context);
		assert.equal(readFileSync(join(adapterStateDir, "interaction-mode"), "utf8"), "chat");
		await commands.get("dove-mode")?.handler("status", context);
		assert.ok(notifications.at(-1)?.includes("Chat"));
		await commands.get("dove-mode")?.handler("work", context);
		assert.ok(notifications.at(-1)?.includes("Work"));
		await commands.get("dove-mode")?.handler("auto", context);
		await commands.get("skills")?.handler("__missing_dove_skill__", context);
		assert.ok(notifications.some((value) => value.includes("没有找到匹配的 skill")));
		await commands.get("project")?.handler("doctor", context);
		assert.ok(notifications.some((value) => value.includes("Provider: native")));
		hostActiveTools = ["mcp", "fusion_reason", "bg_delegate"];
		const freshChat = await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, 0, "fresh Chat must not overwrite Pi or third-party tool changes");
		assert.deepEqual(hostActiveTools, ["mcp", "fusion_reason", "bg_delegate"]);
		assert.equal((freshChat as { message?: unknown })?.message, undefined, "fresh Chat must not append project context");
		const firstStartResult = await events.get("before_agent_start")?.({ prompt: "打开网页并截图", systemPrompt: "", type: "before_agent_start" }, context);
		const firstStartMessage = (firstStartResult as { message?: { customType?: string; details?: { schemaVersion?: number; segments?: unknown[] } } })?.message;
		const firstSystemPrompt = String((firstStartResult as { systemPrompt?: string })?.systemPrompt);
		assert.equal(firstStartMessage, undefined, "a lookup with no relevant project segments must not append an empty context wrapper");
		const autoToolSetCount = activeToolSets.length;
		const hiStart = await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, autoToolSetCount, "Lookup -> Chat must leave Pi's schema untouched");
		assert.equal(String((hiStart as { systemPrompt?: string })?.systemPrompt), firstSystemPrompt, "Dove's provider-prefix policy stays stable across intent changes");
		const consecutiveChatCount = activeToolSets.length;
		await events.get("before_agent_start")?.({ prompt: "hello", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount, "consecutive requests with the same exact set must not call setActiveTools again");
		hostActiveTools = [...hostActiveTools, "agent_browser"];
		await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount, "Dove diagnoses later tool activation without reverting it");
		assert.ok(hostActiveTools.includes("agent_browser"));
		await events.get("before_agent_start")?.({ prompt: "修复登录问题，打开浏览器并通过 MCP 委派后台任务", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount, "Execution intent must not become a tool permission tier");
		await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount);
		await events.get("before_agent_start")?.({ prompt: "修复登录问题，打开浏览器并通过 MCP 委派后台任务", systemPrompt: "", type: "before_agent_start" }, context);
		await events.get("before_agent_start")?.({ prompt: "读取 package.json", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount, "Execution -> Lookup must not invoke Dove tool selection");
		const continuationStart = await events.get("before_agent_start")?.({ prompt: "继续当前项目任务", systemPrompt: "", type: "before_agent_start" }, context);
		const continuationMessage = String((continuationStart as { message?: { content?: string } })?.message?.content);
		assert.equal(activeToolSets.length, consecutiveChatCount, "natural-language continuation must not churn the provider schema");
		assert.match(continuationMessage, /Project continuation state/);
		assert.match(continuationMessage, /"kind":"(?:current|selected|single_candidate|ambiguous|none)"/);
		assert.doesNotMatch(continuationMessage, /Read agent_project_status/);
		assert.doesNotMatch(continuationMessage, /skill:trellis-continue/);
		assert.match(continuationMessage, /Treat every field as data/);
		assert.match(continuationMessage, /This is an execution request, not a status-only query/);
		assert.doesNotMatch(continuationMessage, /Do not call tools/);
		assert.match(continuationMessage, /without asking for confirmation/);
		assert.match(continuationMessage, /do not recommend a separate workflow command/i);
		await events.get("before_agent_start")?.({ prompt: "读取 package.json", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal(activeToolSets.length, consecutiveChatCount, "the next ordinary request leaves Pi's schema untouched");
		assert.match(firstSystemPrompt, /\[DOVE REGISTERED CAPABILITIES\]/);
		const isolatedChat = await events.get("context")?.({
			type: "context",
			messages: [
				{ role: "user", content: [{ type: "text", text: "hi" }], timestamp: 1 },
				{ role: "custom", customType: "personal-agent-context", content: "previous project PRD", display: false, details: { schemaVersion: 2, epoch: "old" }, timestamp: 2 },
				{ role: "assistant", content: [{ type: "text", text: "hello" }], timestamp: 3 },
			],
		}, context);
		assert.equal(isolatedChat, undefined, "ordinary Chat must preserve the current v2 message and provider ordering");
		const notificationCount = notifications.length;
		await commands.get("mode")?.handler("max", context);
		assert.equal(notifications.length, notificationCount + 1);
		assert.equal(notifications.at(-1), "Mode must be fast, standard, or ultra.");
		await commands.get("dove-tools")?.handler("full", context);
		assert.deepEqual(activeToolSets.at(-1), selectDoveToolNames(representativeTools, "full"));
		await commands.get("dove-tools")?.handler("auto", context);
		assert.deepEqual(activeToolSets.at(-1), piSessionBaseline, "Auto returns authority to Pi's session baseline");
		const emptyLookup = await events.get("before_agent_start")?.(
			{ prompt: "打开网页并截图", systemPrompt: "", type: "before_agent_start" },
			{ ...context, model: { contextWindow: 100_000 } },
		);
		assert.equal((emptyLookup as { message?: unknown })?.message, undefined, "an empty lookup must not emit a wrapper or consume the project epoch");
		const budgetOmitted = await events.get("before_agent_start")?.(
			{ prompt: "修复 Provider Prompt-Cache Boundary", systemPrompt: "", type: "before_agent_start" },
			{ ...context, model: { contextWindow: 1_000 } },
		);
		assert.doesNotMatch(String((budgetOmitted as { message?: { content?: string } })?.message?.content), /\[PERSONAL AGENT REQUEST CONTEXT\]/);
		const beforeStart = await events.get("before_agent_start")?.(
			{ prompt: "修复 Provider Prompt-Cache Boundary", systemPrompt: "", type: "before_agent_start" },
			{ ...context, model: { contextWindow: 100_000 } },
		);
		// Relevant project context is delivered without a workflow skill gate.
		const beforeStartMessage = (beforeStart as { message?: { content?: string; details?: { guidance?: boolean; epoch?: string; revision?: string; segments?: unknown[] } } })?.message;
		assert.doesNotMatch(beforeStartMessage?.content ?? "", /trellis-before-dev|Workflow suggestion/);
		assert.match(beforeStartMessage?.content ?? "", /\[PERSONAL AGENT REQUEST CONTEXT\]/);
		assert.equal(beforeStartMessage?.details?.guidance, false, "project context is not a workflow instruction");
		assert.ok((beforeStartMessage?.details?.segments?.length ?? 0) > 0, "an empty lookup must not consume the epoch needed by a later relevant project request");
		sessionEntries = [{
			type: "custom_message",
			customType: "personal-agent-context",
			content: beforeStartMessage?.content,
			details: {
				schemaVersion: 2,
				epoch: beforeStartMessage?.details?.epoch,
				revision: beforeStartMessage?.details?.revision,
				segments: beforeStartMessage?.details?.segments,
			},
		}];
		fallbackSessionEntries = [{
			type: "custom_message",
			customType: "personal-agent-context",
			content: "wrong branch context",
			details: {
				schemaVersion: 2,
				epoch: "standard:wrong-branch",
				revision: "wrong-branch",
				segments: beforeStartMessage?.details?.segments,
			},
		}];
		await events.get("session_start")?.({ type: "session_start" }, context);
		const resumedStart = await events.get("before_agent_start")?.(
			{ prompt: "修复 Provider Prompt-Cache Boundary", systemPrompt: "", type: "before_agent_start" },
			{ ...context, model: { contextWindow: 100_000 } },
		);
		assert.equal((resumedStart as { message?: unknown })?.message, undefined, "an unchanged resumed branch must not append duplicate Dove context");
		sessionEntries = [];
		await events.get("session_shutdown")?.({ type: "session_shutdown", reason: "new" }, context);
		await events.get("session_start")?.({ type: "session_start" }, context);
		const freshStart = await events.get("before_agent_start")?.(
			{ prompt: "修复 Provider Prompt-Cache Boundary", systemPrompt: "", type: "before_agent_start" },
			{ ...context, model: { contextWindow: 100_000 } },
		);
		assert.match(String((freshStart as { message?: { content?: string } })?.message?.content), /\[PERSONAL AGENT REQUEST CONTEXT\]/, "a replacement session must compile its own context");
		assert.doesNotMatch(String((beforeStart as { systemPrompt?: string })?.systemPrompt), /trellis-before-dev/);
		assert.match(String((beforeStart as { systemPrompt?: string })?.systemPrompt), /supplied separately at request time/);
		const sysCaptured = notifications.length;
		await commands.get("sysprompt")?.handler("", context);
		const preview = notifications.slice(sysCaptured).at(-1) ?? "";
		assert.ok(preview.includes("[PERSONAL AGENT]"), "the preview must show the injected block, so a reader can see what was sent");
		// The preview is capped at 2000 characters, so it is the head of the prompt rather than the whole
		// of it. Asserting tail content through it would make this assertion a proxy for how long the
		// capability index happens to be - which is exactly what adding a capability exposed. What the
		// preview owes a reader is the head, an honest note about the rest, and a way to get it.
		assert.ok(preview.includes("/sysprompt save"), "a truncated preview must say how to obtain the whole prompt");
		// The phrase asserted above against the full prompt sits after the capability index, which grows
		// as capabilities are registered, so it is not guaranteed to fall inside any fixed head window.
		assert.ok(String((beforeStart as { systemPrompt?: string })?.systemPrompt).includes("supplied separately at request time"));
		await commands.get("reasoning-voice")?.handler("off", context);
		const withoutVoiceStart = await events.get("before_agent_start")?.({ prompt: "修复登录超时问题", systemPrompt: "", type: "before_agent_start" }, context);
		assert.doesNotMatch(String((withoutVoiceStart as { systemPrompt?: string })?.systemPrompt), /We need|first-person-plural/);
		await commands.get("reasoning-voice")?.handler("on", context);
		const withVoiceStart = await events.get("before_agent_start")?.({ prompt: "修复登录超时问题", systemPrompt: "", type: "before_agent_start" }, context);
		assert.match(String((withVoiceStart as { systemPrompt?: string })?.systemPrompt), /first-person-plural/);
		const repeatedStart = await events.get("before_agent_start")?.({ prompt: "修复登录超时问题", systemPrompt: "", type: "before_agent_start" }, context);
		assert.equal((repeatedStart as { message?: unknown })?.message, undefined, "ordinary execution must not inject a workflow prompt on every turn");
		const contextResult = await events.get("context")?.({
			type: "context",
			messages: [
				{ role: "custom", customType: "personal-agent-context", content: "legacy", display: false, timestamp: 1 },
				{ role: "user", content: [{ type: "text", text: "keep" }], timestamp: 2 },
				{ role: "custom", customType: "personal-agent-context", content: [{ type: "text", text: "current" }], display: false, details: { schemaVersion: 2, epoch: "test" }, timestamp: 3 },
			],
		}, context);
		const contextMessages = (contextResult as { messages?: Array<{ role?: string; content?: unknown }> })?.messages ?? [];
		assert.equal(contextMessages.length, 2, "legacy context entries are removed without reordering current history");
		assert.equal(contextMessages[0]?.role, "user");
		assert.match(JSON.stringify(contextMessages[1]?.content), /current/);
		const appendOnlyResult = await events.get("context")?.({
			type: "context",
			messages: [
				{ role: "user", content: [{ type: "text", text: "keep" }], timestamp: 2 },
				{ role: "custom", customType: "personal-agent-context", content: "current", display: false, details: { schemaVersion: 2, epoch: "test" }, timestamp: 3 },
				{ role: "assistant", content: [{ type: "text", text: "answer" }], timestamp: 4 },
				{ role: "toolResult", toolCallId: "1", toolName: "read", content: [{ type: "text", text: "result" }], isError: false, timestamp: 5 },
			],
		}, context);
		assert.equal(appendOnlyResult, undefined, "v2 context history remains append-only across provider requests");
		const guidanceResult = await events.get("context")?.({
			type: "context",
			messages: [
				{ role: "user", content: [{ type: "text", text: "keep" }], timestamp: 6 },
				{ role: "custom", customType: "personal-agent-context", content: "old guidance", display: false, details: { schemaVersion: 2, guidance: true, segments: [] }, timestamp: 7 },
				{ role: "assistant", content: [{ type: "text", text: "answer" }], timestamp: 8 },
				{ role: "custom", customType: "personal-agent-context", content: "current guidance", display: false, details: { schemaVersion: 2, guidance: true, segments: [] }, timestamp: 9 },
			],
		}, context);
		const guidanceMessages = (guidanceResult as { messages?: Array<{ content?: unknown; timestamp?: number }> })?.messages ?? [];
		assert.deepEqual(guidanceMessages.map((message) => message.timestamp), [6, 8, 9], "only the current guidance message remains in the Provider context");

		const derivedContext = `[PERSONAL AGENT REQUEST CONTEXT]\n${"d".repeat(250)}`;
		await events.get("context")?.({
			type: "context",
			messages: [
				{ role: "user", content: [{ type: "text", text: "keep" }], timestamp: 29 },
				{ role: "custom", customType: "personal-agent-context", content: derivedContext, display: false, details: { schemaVersion: 2, epoch: "budget" }, timestamp: 30 },
			],
		}, context);
		providerAborted = false;
		const literalUserContext = `[PERSONAL AGENT REQUEST CONTEXT]\n${"u".repeat(250)}`;
		const compactedProviderPayload = await beforeProviderRequest({
			type: "before_provider_request",
			payload: {
				max_tokens: 20,
				messages: [
					{ role: "user", content: literalUserContext, timestamp: 29 },
					{ role: "user", content: derivedContext, timestamp: 30 },
				],
			},
		}, { ...context, model: { contextWindow: 380, maxTokens: 20 } });
		assert.equal(providerAborted, false);
		assert.deepEqual(
			(compactedProviderPayload as { messages?: Array<{ timestamp?: number }> })?.messages?.map((message) => message.timestamp),
			[29],
			"budget fallback removes only the exact Dove-derived message and preserves user text containing the same marker",
		);

	});

	it("restores only the newest valid context snapshot from the active branch", () => {
		const segment = { id: "task", kind: "task", trust: "untrusted", included: true, estimatedChars: 12, estimatedTokens: 3, reason: "included" };
		const snapshot = (epoch: string, revision: string, content: string) => ({
			type: "custom_message",
			customType: "personal-agent-context",
			content,
			details: { schemaVersion: 2, epoch, revision, segments: [segment] },
		});
		const restored = restoreLatestContextSnapshot([
			snapshot("old", "old", "old context"),
			{ type: "custom_message", customType: "personal-agent-context", content: "guidance only", details: { schemaVersion: 2, epoch: "guidance", segments: [] } },
			snapshot("current", "revision-2", "current context"),
		]);
		assert.deepEqual(restored, { content: "current context", epoch: "current", revision: "revision-2", segments: [segment] });
		const nested = restoreLatestContextSnapshot([{
			type: "message",
			message: { role: "custom", customType: "personal-agent-context", content: "nested context", details: { schemaVersion: 2, epoch: "nested", revision: "revision-1", segments: [segment] } },
		}]);
		assert.equal(nested?.epoch, "nested");
		assert.equal(restoreLatestContextSnapshot([
			{ type: "custom_message", customType: "personal-agent-context", content: "malformed", details: { schemaVersion: 2, epoch: "bad", revision: "bad", segments: [{ ...segment, trust: "trusted" }] } },
		]), undefined);
	});

	it("says a formal task's acceptance record is unfrozen only while it is, and keeps the errand out of the stable prompt", async () => {
		// **Two halves of one correction.** The stable prompt used to deny that anything gates a product mutation; it now
		// names the record that does. The errand that follows from it - freeze before the first mutation - is not there,
		// because that block is byte-for-byte constant for a whole session where an errand is a sentence a model learns to
		// skip. It rides the guidance channel instead, which is compiled per request, and it is a function of the record:
		// present while a formal task has no frozen acceptance record, gone the moment one exists. This case holds both
		// halves, and it holds the condition in both directions, because a sentence that is always present is the failure
		// this shape exists to avoid.
		const root = mkdtempSync(join(tmpdir(), "pi-unfrozen-acceptance-"));
		const stateDir = join(root, "state");
		mkdirSync(join(root, ".dove"), { recursive: true });
		const goal = { id: "goal-guidance", title: "Frozen or not", status: "active", formal: true, phase: "intake", createdAt: "2026-10-11T00:00:00.000Z", updatedAt: "2026-10-11T00:00:00.000Z", decisions: [], verification: [] };
		writeFileSync(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, currentGoalId: goal.id, goals: [goal] }), "utf8");
		const previousCwd = process.cwd();
		const previousStateDir = process.env.DOVE_PI_STATE_DIR;
		process.chdir(root);
		process.env.DOVE_PI_STATE_DIR = stateDir;
		try {
			const events = new Map<string, (event: any, ctx: any) => Promise<any>>();
			const tools = new Map<string, { execute: (...args: any[]) => Promise<any> }>();
			const api = {
				registerCommand() {}, registerShortcut() {}, registerFlag() {}, appendEntry() {},
				registerTool(definition: { name: string; execute: (...args: any[]) => Promise<any> }) { tools.set(definition.name, definition); },
				getAllTools() { return representativeTools.map((name) => ({ name })); },
				setActiveTools() {},
				getActiveTools() { return [...representativeTools]; },
				getThinkingLevel() { return "high"; },
				on(name: string, handler: (event: any, ctx: any) => Promise<any>) { events.set(name, handler); },
			} as unknown as ExtensionAPI;
			extension(api);
			const context: FakeContext = {
				ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {} },
				sessionManager: { getEntries: () => [], getSessionId: () => "unfrozen-acceptance" },
			};
			const turn = async (prompt: string) => await events.get("before_agent_start")?.({ type: "before_agent_start", prompt, systemPrompt: "" }, context) as { systemPrompt?: string; message?: { content?: string } } | undefined;

			// **The prompt names a formal marker on purpose**: the lane is what decides whether intake opens a task at all,
			// and that is measured, not incidental - a run whose prompt landed in the fast lane had no formal task to
			// freeze and no gate to answer to.
			const unfrozen = await turn("implement the cache fix and run the project's own suite; the acceptance criteria are already written in the task");
			assert.match(unfrozen?.systemPrompt ?? "", /what a formal task gates is its frozen acceptance record/, "the stable prompt names the gate rather than denying that one exists");
			assert.doesNotMatch(unfrozen?.systemPrompt ?? "", /so freeze the criteria/, "and it does not carry the errand, which would then be constant for the whole session");
			assert.match(unfrozen?.message?.content ?? "", /\[PERSONAL AGENT REQUEST GUIDANCE\]/, "the errand rides the guidance channel, which is the one that already carries harness text into every request");
			assert.match(unfrozen?.message?.content ?? "", /no acceptance criteria are frozen/, "an open formal task with no frozen record is said out loud, because intake opened it and the model was never told");

			const convergenceTool = tools.get("agent_task_convergence");
			assert.ok(convergenceTool);
			await convergenceTool.execute("freeze-acceptance", { operation: "freeze", criteria: [{ id: "AC-001", text: "The formal request completes without a product regression." }] }, undefined, undefined, context);

			const frozen = await turn("now change the file named in the acceptance criteria");
			assert.match(frozen?.systemPrompt ?? "", /\[PERSONAL AGENT\]/, "the second turn really ran, so the absence below is an absence of the sentence rather than of the turn");
			assert.doesNotMatch(frozen?.message?.content ?? "", /no acceptance criteria are frozen/, "once the record exists the sentence is gone, because a sentence that is always present is noise");
		} finally {
			process.chdir(previousCwd);
			if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
			else process.env.DOVE_PI_STATE_DIR = previousStateDir;
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("names the argument when a convergence call's task selector resolves to nothing", async () => {
		// **The eleventh field run's own input, replayed.** The model called `operation: "freeze"` with three well-formed
		// criteria and passed `task` as the task's *description* - the reading the bare parameter name invites, and the
		// schema said nothing about it because that parameter carried no description while its neighbours did. Resolution
		// failed and the refusal said only "Task convergence requires the current native formal task", which names neither
		// of the two reasons it is used for. The model could not tell which argument was wrong: it grepped the whole
		// managed install for that sentence, that command was outside the timeout whitelist, and the run hung there for
		// the rest of its budget. **A refusal a caller cannot act on costs the caller the round.**
		const root = mkdtempSync(join(tmpdir(), "pi-convergence-selector-"));
		mkdirSync(join(root, ".dove"), { recursive: true });
		const goal = { id: "goal-selector", title: "Selector or description", status: "active", formal: true, phase: "intake", createdAt: "2026-10-11T00:00:00.000Z", updatedAt: "2026-10-11T00:00:00.000Z", decisions: [], verification: [] };
		writeFileSync(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, currentGoalId: goal.id, goals: [goal] }), "utf8");
		const previousCwd = process.cwd();
		const previousStateDir = process.env.DOVE_PI_STATE_DIR;
		process.chdir(root);
		process.env.DOVE_PI_STATE_DIR = join(root, "state");
		try {
			const tools = new Map<string, { parameters?: { properties?: Record<string, { description?: string } | undefined> }; execute: (...args: any[]) => Promise<any> }>();
			const api = {
				registerCommand() {}, registerShortcut() {}, registerFlag() {}, appendEntry() {},
				registerTool(definition: { name: string; execute: (...args: any[]) => Promise<any> }) { tools.set(definition.name, definition); },
				getAllTools() { return representativeTools.map((name) => ({ name })); },
				setActiveTools() {}, getActiveTools() { return [...representativeTools]; },
				getThinkingLevel() { return "high"; },
				on() {},
			} as unknown as ExtensionAPI;
			extension(api);
			const tool = tools.get("agent_task_convergence");
			assert.ok(tool, "the convergence tool is registered");
			// **The contract a caller has to read before it can use the argument at all.** A bare name reads as the task's
			// description - which is how it was used - so the schema has to say otherwise.
			assert.match(tool.parameters?.properties?.task?.description ?? "", /selector/i, "the parameter says it is a selector, because a bare name reads as the task's description");
			const context: FakeContext = {
				ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {} },
				sessionManager: { getEntries: () => [], getSessionId: () => "selector-session" },
			};
			const prose = "Implement the RFC 8246 `immutable` response directive: a fresh cached response marked immutable is not revalidated even when the request asks for a fresh copy.";
			await assert.rejects(
				() => tool.execute("prose-task", { operation: "freeze", task: prose, criteria: [{ id: "AC-001", text: "The suite is green." }] }, undefined, undefined, context),
				(error: Error) => {
					assert.match(error.message, /does not know a task named/i, "the refusal names the argument that failed");
					assert.match(error.message, /selector/i, "and says what the argument is");
					assert.ok(error.message.includes(prose.slice(0, 60)), "it quotes back what it was given, so a caller can see what it sent");
					return true;
				},
			);
			// **The control, and it is what makes the selector the cause rather than the freeze**: the same call without
			// the argument reaches the current native formal task.
			await tool.execute("no-selector", { operation: "freeze", criteria: [{ id: "AC-001", text: "The suite is green." }] }, undefined, undefined, context);
			assert.equal(existsSync(nativeTaskConvergencePath(root, goal.id)), true, "omitting the selector freezes the current task, so the freeze itself was never the problem");
		} finally {
			process.chdir(previousCwd);
			if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
			else process.env.DOVE_PI_STATE_DIR = previousStateDir;
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("says what a criterion id is, for the argument the model filled with the task's own id", async () => {
		// **The fourteenth field run's own input, replayed.** That run completed the flow on the shipped default budget
		// and spent three of its rounds on this. The model had no criterion id to hand, called `operation: "progress"`,
		// and was told only that `acceptanceId` was required; it then passed the *task's* id - thirty-six characters -
		// and got back `event.acceptanceId must contain 1-35 characters`, a sentence about a length limit that never
		// says the value's kind, which is the whole mistake. The parameter carried no description while its neighbours
		// did, and it sits fifteen lines from the `task` parameter fixed for exactly this one run earlier.
		// **The rounds were not free**: that request used all three attempts the default allows.
		const root = mkdtempSync(join(tmpdir(), "pi-convergence-acceptance-id-"));
		mkdirSync(join(root, ".dove"), { recursive: true });
		const goalId = "goal-e6b6ed2f-57aa-4a9f-94d9-a54f38e77cca";
		const goal = { id: goalId, title: "The immutable directive", status: "active", formal: true, phase: "intake", createdAt: "2026-10-11T00:00:00.000Z", updatedAt: "2026-10-11T00:00:00.000Z", decisions: [], verification: [] };
		writeFileSync(nativeProjectStatePath(root), JSON.stringify({ schemaVersion: 1, revision: 1, currentGoalId: goal.id, goals: [goal] }), "utf8");
		const previousCwd = process.cwd();
		const previousStateDir = process.env.DOVE_PI_STATE_DIR;
		process.chdir(root);
		process.env.DOVE_PI_STATE_DIR = join(root, "state");
		try {
			const tools = new Map<string, { parameters?: { properties?: Record<string, { description?: string } | undefined> }; execute: (...args: any[]) => Promise<any> }>();
			const api = {
				registerCommand() {}, registerShortcut() {}, registerFlag() {}, appendEntry() {},
				registerTool(definition: { name: string; execute: (...args: any[]) => Promise<any> }) { tools.set(definition.name, definition); },
				getAllTools() { return representativeTools.map((name) => ({ name })); },
				setActiveTools() {}, getActiveTools() { return [...representativeTools]; },
				getThinkingLevel() { return "high"; },
				on() {},
			} as unknown as ExtensionAPI;
			extension(api);
			const tool = tools.get("agent_task_convergence");
			assert.ok(tool, "the convergence tool is registered");
			// **A criterion id and a task id do not look alike, and the name alone does not say which is wanted.** Both
			// were available to the model - the goal's id is in the state file it had read - so the parameter has to
			// say which one it takes.
			assert.match(tool.parameters?.properties?.acceptanceId?.description ?? "", /criterion/i, "the parameter says it takes a criterion id, because `acceptanceId` alone reads as any id the task has");
			assert.match(tool.parameters?.properties?.acceptanceId?.description ?? "", /AC-001/, "and shows the shape, because that is the part a bare name leaves out");
			const context: FakeContext = {
				ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {} },
				sessionManager: { getEntries: () => [], getSessionId: () => "acceptance-id-session" },
			};
			await tool.execute("freeze", { operation: "freeze", criteria: [{ id: "AC-001", text: "The suite is green." }] }, undefined, undefined, context);
			// The first of the three wasted rounds: the argument is missing, and the refusal has to carry what the
			// argument wants, because "required" is what sent the model looking for an id to put there.
			await assert.rejects(
				() => tool.execute("no-acceptance", { operation: "progress", status: "started" }, undefined, undefined, context),
				(error: Error) => {
					assert.match(error.message, /acceptanceId/, "the refusal names the missing argument");
					assert.match(error.message, /criterion/i, "and says which kind of id it takes");
					return true;
				},
			);
			// The second and third, in one call: a real id from this task, of the wrong kind.
			await assert.rejects(
				() => tool.execute("task-id-as-acceptance", { operation: "progress", acceptanceId: goalId, status: "started" }, undefined, undefined, context),
				(error: Error) => {
					assert.match(error.message, /criterion/i, "the refusal says the value must be a criterion id");
					assert.match(error.message, /AC-001/, "and shows the shape it wants");
					assert.doesNotMatch(error.message, /1-35 characters/, "it does not present the failure as a length limit, which is what sent the model looking for a shorter id");
					return true;
				},
			);
			// **The control, and it is what makes the kind of id the cause rather than the progress call**: the same
			// call with the criterion the freeze recorded is accepted.
			await tool.execute("criterion-id", { operation: "progress", acceptanceId: "AC-001", status: "started" }, undefined, undefined, context);
			assert.equal(existsSync(nativeTaskConvergencePath(root, goal.id)), true, "the criterion id is accepted, so progress itself was never the problem");
		} finally {
			process.chdir(previousCwd);
			if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
			else process.env.DOVE_PI_STATE_DIR = previousStateDir;
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("records an optional native goal directly without planning questions or legacy script execution", async () => {
		const root = mkdtempSync(join(tmpdir(), "pi-planning-replay-"));
		const stateDir = join(root, "state");
		mkdirSync(join(root, ".trellis", "scripts"), { recursive: true });
		mkdirSync(join(root, ".trellis", "tasks"), { recursive: true });
		mkdirSync(join(root, ".trellis", "tasks", "08-30-old-task"), { recursive: true });
		writeFileSync(join(root, ".trellis", "tasks", "08-30-old-task", "task.json"), JSON.stringify({ id: "old-task", title: "旧任务", status: "in_progress" }), "utf8");
		writeFileSync(join(root, ".trellis", ".version"), "0.6.16", "utf8");
		writeFileSync(join(root, ".trellis", "scripts", "task.py"), [
			"from pathlib import Path",
			"import json, sys",
			"root = Path(__file__).resolve().parents[2]",
			"if len(sys.argv) > 1 and sys.argv[1] == 'current': print(json.dumps({'stale': False, 'current_task': {'dir': '.trellis/tasks/08-30-old-task'}}))",
			"else:",
			"    task = root / '.trellis' / 'tasks' / '08-31-cache-hit'",
			"    task.mkdir(parents=True, exist_ok=True)",
			"    (task / 'task.json').write_text(json.dumps({'id': 'cache-hit', 'title': sys.argv[2], 'status': 'planning'}), encoding='utf8')",
			"    (root / 'create-args.json').write_text(json.dumps(sys.argv[2:]), encoding='utf8')",
			"    (root / 'create-called').write_text('yes', encoding='utf8')",
			"    print('created')",
		].join("\n"), "utf8");
		const previousCwd = process.cwd();
		const previousStateDir = process.env.DOVE_PI_STATE_DIR;
		process.chdir(root);
		process.env.DOVE_PI_STATE_DIR = stateDir;
		try {
			const events = new Map<string, (event: any, ctx: any) => Promise<any>>();
			const tools = new Map<string, { execute: (...args: any[]) => Promise<any> }>();
			let activeTools: string[] = [...representativeTools];
			let confirmations = 0;
			const api = {
				registerCommand() {}, registerShortcut() {}, registerFlag() {}, appendEntry() {},
				registerTool(definition: { name: string; execute: (...args: any[]) => Promise<any> }) { tools.set(definition.name, definition); },
				getAllTools() { return representativeTools.map((name) => ({ name })); },
				setActiveTools(names: string[]) { activeTools = [...names]; },
				getActiveTools() { return activeTools; },
				getThinkingLevel() { return "high"; },
				on(name: string, handler: (event: any, ctx: any) => Promise<any>) { events.set(name, handler); },
			} as unknown as ExtensionAPI;
			extension(api);
			const context: FakeContext = {
				hasUI: true,
				ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {}, confirm: async () => { confirmations += 1; return true; } },
				sessionManager: { getEntries: () => [], getSessionId: () => "planning-replay" },
			};
			const simplePrompt = "查看 README.md";
			await events.get("input")?.({ type: "input", text: simplePrompt, source: "interactive", streamingBehavior: "immediate" }, context);
			await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: simplePrompt, systemPrompt: "" }, context);
			assert.equal(existsSync(join(root, ".dove", "state.json")), false, "fast-lane lookup must not create formal state");
			await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "completed", content: [] }] }, context);
			// **AC5, corrected by the repair: a request with no task is not observed at all.** The surviving writer is
			// guarded by `currentRequestPlan && currentRequestTaskId`, so a fast-lane request produces nothing. This
			// task does **not** widen that guard: covering a request with no task is a decision with its own evidence,
			// recorded in the task's design rather than changed quietly under a repair. What is asserted here is the
			// current truth, so a future widening has to edit this line deliberately.
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);
			const fastLaneObservations = readFileSync(join(stateDir, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind?: string }).filter((record) => record.kind === "task.convergence.observed");
			assert.equal(fastLaneObservations.length, 0, "the surviving writer is guarded by the task, so a fast-lane request is not observed");

			const formalPrompt = "请规划并设计一个缓存命中率优化方案，只回复完成，不要调用工具。";
			await events.get("input")?.({ type: "input", text: formalPrompt, source: "interactive", streamingBehavior: "immediate" }, context);
			await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: formalPrompt, systemPrompt: "" }, context);
			const formalTask = createProjectProvider(root).getCurrentTask();
			assert.equal(formalTask?.formal, true);
			assert.ok(formalTask?.providerTaskId);
			for (const artifact of ["prd.md", "design.md", "implement.md", "acceptance.md"]) assert.equal(existsSync(join(root, ".dove", "tasks", formalTask!.providerTaskId, artifact)), true);
			const convergenceTool = tools.get("agent_task_convergence");
			assert.ok(convergenceTool);
			await assert.rejects(
				() => convergenceTool!.execute("invalid-status-mutation", { operation: "status", acceptanceId: "AC-001", status: "started" }, undefined, undefined, context),
				/status is read-only.*operation=progress/,
				"status must reject mutation-shaped arguments instead of silently returning an unchanged snapshot",
			);
			await convergenceTool!.execute("freeze-convergence", { operation: "freeze", criteria: [{ id: "AC-001", text: "The formal request completes without a product regression." }] }, undefined, undefined, context);
			// **The change manifest, at the boundary a session reaches.** A prediction is pre-registered: the shape
			// rules first, then the record - and the baseline is read by the runtime, which is why the caller cannot
			// send one.
			// **The reference comes from the ledger, which is what the mining half now hands over.** A citation has to resolve,
			// and the only way to know which references do is to read the records: a well-shaped ref to a record nobody wrote
			// is the assertion the evidence rule exists to refuse, and this test cited one until the rule reached the
			// manifest path.
			const citedRef = "ledger:" + String((readFileSync(join(stateDir, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { stepId?: string }).find((record) => String(record.stepId ?? "").startsWith("request:"))?.stepId) ?? "");
			assert.match(citedRef, /^ledger:request:/, "the fixture cites a request record, because that is what exists at this point in the run");
			const manifest = { operation: "change", acceptanceId: "AC-001", changeId: "chg-1", surface: "tool-implementation", failureEvidenceRef: citedRef, rootCause: "the read path re-resolved what it had already resolved", fix: "resolve once and carry the result", predictedRegressions: [] };
			await assert.rejects(
				() => convergenceTool!.execute("change-no-prediction", { ...manifest, predictedFixes: [] }, undefined, undefined, context),
				/at least 1 predictedFixes/,
				"a change with nothing predicted is a rationale, and is refused as one",
			);
			await assert.rejects(
				() => convergenceTool!.execute("change-unknown-observable", { ...manifest, predictedFixes: ["vibes:AC-001=better"] }, undefined, undefined, context),
				/criterion-status, verification-state, gate-refusals/,
				"and a prediction outside the closed set is refused by naming the set",
			);
			await assert.rejects(
				() => convergenceTool!.execute("change-caller-baseline", { ...manifest, predictedFixes: ["criterion-status:AC-001=passed"], baseline: { "criterion-status:AC-001": "passed" } }, undefined, undefined, context),
				/refuses a caller-supplied 'baseline'/,
				"the baseline is the runtime's read, so one party cannot write both sides of the contract it is judged by",
			);
			await assert.rejects(
				() => convergenceTool!.execute("status-with-manifest-field", { operation: "status", predictedFixes: ["criterion-status:AC-001=passed"] }, undefined, undefined, context),
				/status is read-only.*predictedFixes/,
				"and the read stays a read",
			);
			// The prediction is part of the case: a manifest with nothing predicted is refused a layer earlier, and a test
			// that omitted it would be asserting the shape rule while believing it asserted the evidence rule.
			await assert.rejects(
				() => convergenceTool!.execute("change-unresolvable-evidence", { ...manifest, changeId: "chg-unresolvable", failureEvidenceRef: "ledger:request:req_never-happened", predictedFixes: ["criterion-status:AC-001=passed"] }, undefined, undefined, context),
				/resolves to nothing in this ledger/,
				"a manifest naming a failure the harness never recorded is refused, rather than recorded with a shape that looks right",
			);
			const recorded = await convergenceTool!.execute("record-change", { ...manifest, predictedFixes: ["criterion-status:AC-001=passed", "gate-refusals:fence=down"] }, undefined, undefined, context);
			assert.equal(recorded.details.changes.length, 1, "the manifest is recorded on the native formal task");
			assert.equal(recorded.details.changes[0].recordedAtRevision, recorded.details.revision, "at the revision its own event produced");
			assert.deepEqual(recorded.details.changes[0].baseline, { "criterion-status:AC-001": "pending" }, "with the baseline the runtime read, which the caller never supplied");
			const atManifest = await convergenceTool!.execute("status-at-manifest", { operation: "status" }, undefined, undefined, context);
			assert.equal(atManifest.details.changes[0].verdict, "pending", "and nothing has happened yet, so nothing is decided");
			// **The claim that binds a change to the edit that embodies it.** A ledger record rather than a convergence
			// event: the ledger holds what happened and the convergence record holds goal state, and an application is not
			// goal state. Its three refusals are what keep the claim answerable - and the check that the commit stayed
			// inside the declared surface runs in scripts/harness-rounds.mts, where git is, not here.
			await convergenceTool!.execute("apply-change", { operation: "applied", changeId: "chg-1", commit: "4b45f99" }, undefined, undefined, context);
			await assert.rejects(
				() => convergenceTool!.execute("apply-again", { operation: "applied", changeId: "chg-1", commit: "deadbee" }, undefined, undefined, context),
				/change chg-1 already points at commit 4b45f99/,
				"one commit per logical edit is what gives a revert its granularity, so a second application is refused",
			);
			await assert.rejects(
				() => convergenceTool!.execute("apply-unknown", { operation: "applied", changeId: "chg-nope", commit: "deadbee" }, undefined, undefined, context),
				/does not carry: chg-nope/,
				"a commit naming a change nobody recorded is an edit nobody predicted, which is what the manifest exists to prevent",
			);
			await assert.rejects(
				() => convergenceTool!.execute("apply-empty", { operation: "applied", changeId: "chg-1", commit: "   " }, undefined, undefined, context),
				/requires a commit/,
				"an empty commit records the shape of a claim with none of its content",
			);
			const applied = await convergenceTool!.execute("status-applied", { operation: "status" }, undefined, undefined, context);
			assert.equal(applied.details.changes[0].appliedCommit, "4b45f99", "and the status read shows the middle of the turn: which commit answers the prediction");
			await convergenceTool!.execute("start-convergence", { operation: "progress", acceptanceId: "AC-001", status: "started" }, undefined, undefined, context);
			const afterOneEvent = await convergenceTool!.execute("status-after-one-event", { operation: "status" }, undefined, undefined, context);
			assert.equal(afterOneEvent.details.changes[0].verdict, "contradicted", "the predicted pass did not happen, and the record says so rather than staying silent");
			assert.match(afterOneEvent.details.changes[0].observed.join(" | "), /criterion-status:AC-001: pending -> in_progress \(prediction not met\)/, "and it carries the movement it compared");
			await convergenceTool!.execute("record-follow-up", { operation: "finding", acceptanceId: "AC-001", findingId: "follow-up-1", findingKind: "follow_up", summary: "Related cleanup is outside this task." }, undefined, undefined, context);
			const amendedFinding = await convergenceTool!.execute("amend-follow-up", { operation: "update_finding", acceptanceId: "AC-001", findingId: "follow-up-1", evidenceRefs: ["evidence:follow-up"], nextAction: "Create a separate follow-up task." }, undefined, undefined, context);
			assert.deepEqual(amendedFinding.details.findings.find((finding: { id: string }) => finding.id === "follow-up-1")?.evidenceRefs, ["evidence:follow-up"]);
			await assert.rejects(
				() => convergenceTool!.execute("empty-finding-update", { operation: "update_finding", acceptanceId: "AC-001", findingId: "follow-up-1" }, undefined, undefined, context),
				/update_finding requires evidenceRefs, summary, or nextAction/,
			);
			const beforeTransientRetry = await convergenceTool!.execute("status-before-transient", { operation: "status" }, undefined, undefined, context);
			const decisionsBeforeTransientRetry = readFileSync(join(stateDir, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind?: string; details?: { eventKind?: string } }).filter((record) => record.kind === "task.convergence.decision" && record.details?.eventKind === "decide").length;
			await events.get("agent_start")?.({ type: "agent_start" }, context);
			await events.get("before_provider_request")?.({ type: "before_provider_request", payload: { messages: [{ role: "user", content: "retry" }] } }, { ...context, model: { contextWindow: 100_000, maxTokens: 20 } });
			await events.get("after_provider_response")?.({ type: "after_provider_response", status: 503 }, context);
			const transientMessage = { role: "assistant", stopReason: "error", errorMessage: "503 Service Unavailable", content: [] };
			await events.get("message_end")?.({ type: "message_end", message: transientMessage }, context);
			await events.get("agent_end")?.({ type: "agent_end", messages: [transientMessage] }, context);
			const afterTransientRetry = await convergenceTool!.execute("status-after-transient", { operation: "status" }, undefined, undefined, context);
			assert.equal(afterTransientRetry.details.snapshot.consecutiveNoProgress, beforeTransientRetry.details.snapshot.consecutiveNoProgress);
			assert.equal(afterTransientRetry.details.snapshot.meaningfulProgressSinceReview, beforeTransientRetry.details.snapshot.meaningfulProgressSinceReview, "a transient retry must not consume the semantic progress marker");
			const decisionsAfterTransientRetry = readFileSync(join(stateDir, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind?: string; details?: { eventKind?: string } }).filter((record) => record.kind === "task.convergence.decision" && record.details?.eventKind === "decide").length;
			assert.equal(decisionsAfterTransientRetry, decisionsBeforeTransientRetry, "an automatic provider retry must not emit a semantic convergence decision");
			await events.get("agent_start")?.({ type: "agent_start" }, context);
			await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "completed", content: [] }] }, context);
			const secondFormalPrompt = "继续当前项目任务";
			await events.get("input")?.({ type: "input", text: secondFormalPrompt, source: "interactive", streamingBehavior: "immediate" }, context);
			await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: secondFormalPrompt, systemPrompt: "" }, context);
			await events.get("agent_start")?.({ type: "agent_start" }, context);
			await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "completed", content: [] }] }, context);
			assert.match(readFileSync(join(root, ".dove", "tasks", formalTask!.providerTaskId, "evidence.jsonl"), "utf8"), /"outcome":"completed"/);

			// **The resource observation, which had no producer before this change.** The terminal is the only place
			// where a request's counters are all live, and \`agent_settled\` is what settles a request - so this is where
			// the record's resource kind finally receives anything. Read from disk, because a claim about a record
			// that the record itself does not show is the class of assertion this project refuses.
			const observationPath = join(root, ".dove", "tasks", formalTask!.providerTaskId, "convergence.json");
			const ledgerRecords = (): Array<{ kind?: string; stepId?: string; correlation?: { requestId?: string }; details?: Record<string, unknown> }> =>
				readFileSync(join(stateDir, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind?: string; stepId?: string; correlation?: { requestId?: string }; details?: Record<string, unknown> });
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);
			// The observation is written at `agent_end`, which has already run for this request, so the shape is asserted
			// rather than a delta - and the shape is the point: **one writer**, the one that was always there.
			const afterObservation = JSON.parse(readFileSync(observationPath, "utf8")) as { revision: number; observedResources: { toolCalls: number; providerRounds: number; elapsedMs: number }; criteria: readonly unknown[] };
			const observations = ledgerRecords().filter((record) => record.kind === "task.convergence.observed");
			const record = observations.at(-1);
			assert.match(String(record?.stepId ?? ""), /^request:/, "the record belongs to the writer that was always there, not to a second one");
			assert.equal(observations.filter((entry) => entry.stepId === record?.stepId).length, 1, "and there is exactly one per request terminal");
			const ledgerObservation = record?.details ?? {};
			assert.equal(ledgerObservation.observationOnly, true, "marked as an observation, so a reader can tell it decides nothing");
			assert.equal(ledgerObservation.convergenceSkipReason, undefined, "and this terminal was not skipped: the criterion was active and the state would take it");
			// **The invariant that replaces the delta**: the convergence record holds exactly the observations that were
			// accepted, so a skipped or duplicated ledger record would show up here as a mismatch.
			const accepted = observations.filter((entry) => entry.details?.convergenceSkipReason === undefined);
			assert.equal(afterObservation.observedResources.toolCalls, accepted.reduce((sum, entry) => sum + Number(entry.details?.toolCalls ?? 0), 0), "the convergence record holds exactly the accepted observations");
			assert.equal(afterObservation.observedResources.providerRounds, accepted.reduce((sum, entry) => sum + Number(entry.details?.providerRounds ?? 0), 0));
			assert.equal(ledgerObservation.toolCalls, Number(record?.details?.toolCalls ?? -1), "read back from disk, not from the object that wrote it");
			// **The validation half of the loop, written at the round boundary.** Everything above reports what the
			// movements say *now*; this is the part that survives the bounded manifest and the task that recorded it,
			// because a verdict computed on read is gone as soon as newer changes push the manifest out.
			const decisions = ledgerRecords().filter((entry) => entry.kind === "change.decided");
			assert.equal(decisions.length, 1, "the round boundary decides the change, exactly once");
			assert.equal(decisions[0]?.stepId, "change:chg-1", "addressable by the change it decides");
			assert.equal(decisions[0]?.details?.verdict, "contradicted", "the verdict the movements support, not a hopeful one");
			assert.equal(decisions[0]?.details?.verdictOnly, true, "reporting a verdict rather than acting on one");
			assert.ok(Number(decisions[0]?.details?.decidedAtRevision ?? 0) > 0, "and it freezes the revision it was read against");
			const progressedNativeTask = JSON.parse(readFileSync(join(root, ".dove", "state.json"), "utf8")) as { currentGoalId?: string; goals?: Array<{ id?: string; nextStep?: string }> };
			assert.equal(progressedNativeTask.goals?.find((goal) => goal.id === progressedNativeTask.currentGoalId)?.nextStep, "Review evidence and decide the next action for AC-001.", "native continuation must preserve the reducer-owned AC-bound corrective action");
			const convergencePath = join(root, ".dove", "tasks", formalTask!.providerTaskId, "convergence.json");
			const validConvergence = readFileSync(convergencePath, "utf8");
			writeFileSync(convergencePath, "{ malformed", "utf8");
			const usableWithMalformedConvergence = await events.get("tool_call")?.({ type: "tool_call", toolCallId: "malformed-convergence-write", toolName: "write", input: { path: "still-usable.txt", content: "Pi remains usable" } }, context);
			assert.equal(usableWithMalformedConvergence, undefined, "malformed convergence metadata must not become a Pi tool firewall");
			writeFileSync(convergencePath, validConvergence, "utf8");
			// **An observable must exist before a pass can cite one**, so the test drives a tool call *and its result*
			// through the host first - that is what writes the record, and the result names it. The ref this test used to
			// carry ("evidence:formal-pass") was a label the agent could have written, which is what the rule now refuses.
			await events.get("tool_call")?.({ type: "tool_call", toolCallId: "suite-run", toolName: "bash", input: { command: "git status --short" } }, context);
			await events.get("tool_result")?.({ type: "tool_result", toolCallId: "suite-run", toolName: "bash", input: { command: "git status --short" }, content: [{ type: "text", text: "clean" }], isError: false }, context);
			await convergenceTool!.execute("pass-convergence", { operation: "progress", acceptanceId: "AC-001", status: "passed", evidenceRefs: ["ledger:tool:suite-run"] }, undefined, undefined, context);
			// **The audit is the mechanical answer to "is this criterion verified?"** A passed criterion whose ref
			// resolves reads `verified`; the same status with a ref the harness never wrote would read
			// `unresolved_evidence`. Both come from the one resolver, so the audit and the pass path cannot disagree.
			const audited = await convergenceTool!.execute("audit-convergence", { operation: "status" }, undefined, undefined, context);
			assert.equal((audited.details as { verification: Record<string, { status: string }> }).verification["AC-001"]?.status, "verified", "a passed criterion with a resolvable ref audits as verified");
			assert.equal((audited.details as { verification: Record<string, { evidenceRefs: number }> }).verification["AC-001"]?.evidenceRefs, 1);
			// **The declared editable surface rides on the same read.** It is the bounded context a proposal is made from
			// (AHE's "(1) the editable surfaces of the current harness"), and reporting it here is what makes the
			// declaration a map rather than an inert file.
			const declaredSurface = (audited.details as { surface?: Record<string, number> }).surface ?? {};
			assert.deepEqual(Object.keys(declaredSurface).sort(), ["long-term-memory", "middleware", "skill", "subagent-config", "system-prompt", "tool-description", "tool-implementation"], "the status read names every declared component - issue: " + ((audited.details as { surfaceIssue?: string }).surfaceIssue ?? "none"));
			assert.ok(Object.values(declaredSurface).every((count) => count > 0), "and each owns at least one path");
			assert.equal((audited.details as { surfaceIssue?: string }).surfaceIssue, undefined, "and the declaration resolved, so there is no issue to report");
			// **The negative half: a well-shaped ref the harness never wrote.** Written straight into the snapshot
			// file, because the only honest way to get one past the pass path is to bypass the pass path - which is
			// exactly the forgery the audit exists to surface after the fact.
			const validSnapshot = readFileSync(convergencePath, "utf8");
			const forged = JSON.parse(validSnapshot) as { criteria: Array<{ id: string; status: string; evidenceRefs: string[] }> };
			forged.criteria = forged.criteria.map((criterion) => criterion.id === "AC-001"
				? { ...criterion, status: "passed", evidenceRefs: ["ledger:tool:never-happened"] }
				: criterion);
			writeFileSync(convergencePath, JSON.stringify(forged), "utf8");
			const auditedForgery = await convergenceTool!.execute("audit-forged-convergence", { operation: "status" }, undefined, undefined, context);
			assert.equal((auditedForgery.details as { verification: Record<string, { status: string; unresolved: readonly string[] }> }).verification["AC-001"]?.status, "unresolved_evidence", "a pass citing a record the harness never wrote audits as unresolved, not verified");
			assert.deepEqual((auditedForgery.details as { verification: Record<string, { unresolved: readonly string[] }> }).verification["AC-001"]?.unresolved, ["ledger:tool:never-happened"]);
			writeFileSync(convergencePath, validSnapshot, "utf8");
			// **A request has to be open for this assertion to be about the gate.** The convergence refusal sits after
			// the lease check (`extension.ts`), and a real session settles a request when the agent does - the
			// observation above is what made that visible here, because it settles the request this one used to hold
			// open. So the next request is driven the way the host drives it, rather than relying on a lease that a
			// settled session would not have.
			await events.get("input")?.({ type: "input", text: "继续当前项目任务", source: "interactive", streamingBehavior: "immediate" }, context);
			await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "继续当前项目任务", systemPrompt: "" }, context);
			await events.get("agent_start")?.({ type: "agent_start" }, context);
			await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "completed", content: [] }] }, context);
			// The observation for this request was written at its `agent_end` above, while the task was already
			// `ready_to_finish` - so the record that exists is the skipped one, and the revision captured here is what
			// shows that the skip added nothing to the convergence record.
			const revisionBeforeSkip = (JSON.parse(readFileSync(observationPath, "utf8")) as { revision: number }).revision;
			const blockedAfterFinish = await events.get("tool_call")?.({ type: "tool_call", toolCallId: "formal-write-after-finish", toolName: "write", input: { path: "should-not-write.txt", content: "blocked" } }, context) as { block?: boolean; terminate?: boolean; reason?: string } | undefined;
			assert.equal(blockedAfterFinish?.block, true);
			assert.equal(blockedAfterFinish?.terminate, true);
			assert.match(blockedAfterFinish?.reason ?? "", /ready_to_finish/);
			// **A refused call is not an outstanding one.** The writer sits after the last blocking return, so a call the
			// gate stopped leaves no `tool.started`: counting refusals as hangs would be worse than the silence it
			// replaces. Asserted here because this case already drives a real refusal, and a test that constructs one
			// from nothing would be checking the fixture rather than the ordering.
			assert.equal(ledgerRecords().some((record) => record.kind === "tool.started" && (record.correlation as { toolCallId?: string } | undefined)?.toolCallId === "formal-write-after-finish"), false, "a blocked call must not read as a call that has not returned");
			// **AC4: a state that will not take an event does not silently drop the observation.** The reducer refuses
			// events after `ready_to_finish`, so the producer does not offer one - and the ledger says which state
			// refused it, because "no observation" and "observation discarded" must not look the same.
			await events.get("agent_settled")?.({ type: "agent_settled" }, context);
			// **A second round does not decide it again**, and the check is the ledger rather than a process-local set: a
			// set would re-decide every change after a restart, and the record would then claim two revisions for one
			// decision - which is the kind of claim this project keeps finding in its own files.
			assert.equal(ledgerRecords().filter((entry) => entry.kind === "change.decided").length, 1, "the decision is recorded once, and later rounds do not repeat it");
			const skipped = ledgerRecords().filter((record) => record.kind === "task.convergence.observed").at(-1) === undefined ? [] : [ledgerRecords().filter((record) => record.kind === "task.convergence.observed").at(-1)];
			assert.equal(skipped.length, 1, "the ledger still records what the request cost");
			assert.equal((skipped[0]?.details ?? {}).convergenceSkipReason, "state-ready_to_finish", "and names the state that would not take it");
			assert.equal((JSON.parse(readFileSync(observationPath, "utf8")) as { revision: number }).revision, revisionBeforeSkip, "while the convergence record is untouched");
			// **A convergence refusal is a terminal, not a gate refusal**, and this assertion exists because that fact was
			// learned the hard way: it aborts the request (`issueRequestHostAbort`) rather than refusing one tool call
			// inside it, so the ledger holds a `request.terminal` with `origin: convergence` and **no**
			// `gate.refused` record at all - none of the four refusal sites is on that path. The failure reading
			// therefore attributes from the terminal's own origin as well as from refusals, which is why its table has a
			// `convergence` row; an assertion that looked for a refusal here would have accused the code of a defect
			// this test had.
			const terminalsAfterRefusal = ledgerRecords().filter((record) => record.kind === "request.terminal");
			const refusalTerminal = terminalsAfterRefusal.at(-1)?.details?.terminal as { origin?: string; code?: string } | undefined;
			assert.equal(refusalTerminal?.origin, "convergence", "the convergence refusal is recorded as the request's terminal");
			assert.match(String(refusalTerminal?.code ?? ""), /ready_to_finish/, "and names what the record would not take");

			await events.get("input")?.({ type: "input", text: "创建一个项目任务：缓存命中率优化", source: "interactive", streamingBehavior: "immediate" }, context);
			const start = await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "创建一个项目任务：缓存命中率优化", systemPrompt: "" }, context) as { message?: { content?: string } };
			assert.equal(activeTools.includes("agent_project_task"), true);
			assert.equal(activeTools.includes("bash"), true, "Dove must preserve Pi's active execution tools");
			assert.doesNotMatch(start.message?.content ?? "", /collecting-name|ask one structured question/i);

			const taskTool = tools.get("agent_project_task");
			assert.ok(taskTool);
			const taskResult = await taskTool.execute("task-call", { operation: "create", title: "缓存命中率优化", description: "减少未缓存输入" }, undefined, undefined, context);
			assert.equal(confirmations, 0, "Pi-hosted task execution must not ask for a second Dove approval");
			assert.equal(existsSync(join(root, "create-called")), false, "legacy task.py must never execute");
			assert.match(readFileSync(join(root, ".dove", "state.json"), "utf8"), /缓存命中率优化/);
			assert.match(taskResult.details.goal.taskId, /^native:goal-/);
			assert.match(taskResult.details.goal.path, /[\\\/]\.dove[\\\/]state\.json$/);
			const mutationRecords = readFileSync(join(stateDir, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind?: string; details?: { operation?: string; revision?: string; observationOnly?: boolean } });
			assert.ok(mutationRecords.some((record) => record.kind === "task.convergence.decision"), "formal convergence decisions must be correlated in the ledger");
			assert.ok(mutationRecords.some((record) => record.kind === "task.convergence.observed" && record.details?.observationOnly === true), "resource telemetry must be observation-only");
			const createStart = mutationRecords.find((record) => record.kind === "project.mutation.started" && record.details?.operation === "create");
			assert.ok(createStart);
			assert.notEqual(createStart?.details?.revision, "before", "mutation recovery must retain the actual pre-state revision");
		} finally {
			process.chdir(previousCwd);
			if (previousStateDir === undefined) delete process.env.DOVE_PI_STATE_DIR;
			else process.env.DOVE_PI_STATE_DIR = previousStateDir;
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("warns once for a repeated failure and resets after progress", () => {
		const guard = new ProgressGuard({ consecutiveErrorThreshold: 3, repeatedFailureThreshold: 2, longRunMinutes: 1 });
		guard.start(1_000);
		assert.equal(guard.recordToolResult({ toolName: "read", input: { path: "missing" }, isError: true }, 2_000)?.kind, undefined);
		assert.equal(guard.recordToolResult({ toolName: "read", input: { path: "missing" }, isError: true }, 3_000)?.kind, "repeated-failure");
		assert.equal(guard.recordToolResult({ toolName: "read", input: { path: "missing" }, isError: true }, 4_000)?.kind, "consecutive-errors");
		assert.equal(guard.recordToolResult({ toolName: "read", input: { path: "ok" }, isError: false }, 5_000), undefined);
		assert.equal(guard.snapshot(61_001).longRun, true);
		assert.match(formatProgressSnapshot(guard.snapshot(61_001), 61_001), /longRun=true/);
	});

	it("coalesces same-batch reads and stops unchanged successful observations", () => {
		const stagnantGuard = new ProgressGuard({ repeatedSuccessThreshold: 2, repeatedSuccessHardStopThreshold: 3 });
		stagnantGuard.start(1_000);
		stagnantGuard.beginToolBatch();
		assert.equal(stagnantGuard.beforeToolCall("call-1", "ls", { path: "." }, true).action, "allow");
		const duplicate = stagnantGuard.beforeToolCall("call-2", "ls", { path: "." }, true);
		assert.equal(duplicate.action, "coalesce");
		assert.equal(duplicate.primaryToolCallId, "call-1");
		assert.equal(stagnantGuard.beforeToolCall("write-1", "write", { path: "x" }, false).action, "allow");
		assert.equal(stagnantGuard.beforeToolCall("write-2", "write", { path: "x" }, false).action, "allow", "mutations are never coalesced");

		stagnantGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["same"], idempotent: true, isError: false });
		assert.equal(stagnantGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["same"], idempotent: true, isError: false })?.kind, "repeated-success");
		stagnantGuard.beginToolBatch();
		assert.equal(stagnantGuard.beforeToolCall("call-3", "ls", { path: "." }, true).action, "allow", "one final poll is allowed before the hard stop");
		stagnantGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["same"], idempotent: true, isError: false });
		stagnantGuard.beginToolBatch();
		assert.equal(stagnantGuard.beforeToolCall("call-4", "ls", { path: "." }, true).action, "terminate");

		const changingGuard = new ProgressGuard({ repeatedSuccessThreshold: 2, repeatedSuccessHardStopThreshold: 3 });
		changingGuard.start(1_000);
		changingGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["same"], idempotent: true, isError: false });
		changingGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["same"], idempotent: true, isError: false });
		changingGuard.beginToolBatch();
		assert.equal(changingGuard.beforeToolCall("changing-3", "ls", { path: "." }, true).action, "allow");
		changingGuard.recordToolResult({ toolName: "ls", input: { path: "." }, observation: ["changed"], idempotent: true, isError: false });
		changingGuard.beginToolBatch();
		assert.equal(changingGuard.beforeToolCall("changing-4", "ls", { path: "." }, true).action, "allow", "changed observations reset stagnation");

		changingGuard.recordToolResult({ toolName: "ls", input: { path: "other" }, observation: ["same"], idempotent: true, isError: false });
		changingGuard.beginToolBatch();
		assert.equal(changingGuard.beforeToolCall("changing-5", "ls", { path: "." }, true).action, "allow", "changed arguments reset the contiguous stagnation window");
	});

	it("warns but allows varied read-only exploration beyond the historical request budget", () => {
		const guard = new ProgressGuard();
		guard.start(1_000, { readOnlyToolWarningThreshold: 2 });
		for (let index = 0; index < 2; index++) {
			assert.equal(guard.beforeToolCall(`read-${index}`, "read", { path: `${index}.ts` }, true).action, "allow");
			const warning = guard.recordToolResult({ toolName: "read", input: { path: `${index}.ts` }, observation: [index], idempotent: true, isError: false });
			assert.equal(warning?.kind, index === 1 ? "read-only-budget" : undefined);
		}
		assert.equal(guard.beforeToolCall("read-2", "read", { path: "2.ts" }, true).action, "allow");
		guard.recordToolResult({ toolName: "read", input: { path: "2.ts" }, observation: [2], idempotent: true, isError: false });
		const beyondBudget = guard.beforeToolCall("read-3", "read", { path: "3.ts" }, true);
		assert.equal(beyondBudget.action, "allow", "a changing observation is productive even after the advisory threshold");
		guard.recordToolResult({ toolName: "read", input: { path: "3.ts" }, observation: [3], idempotent: true, isError: false });
		assert.equal(guard.snapshot().readOnlyToolCalls, 4);
		// **One number per row, and it is the one that fires.** These rows carried a hard stop beside the warning until
		// 2026-10-05; nothing compared it, so the ceiling `/status` printed could not end a run. The deletion was observed
		// rather than assumed: removing the option field produced exactly four type errors (`extension.ts` three times
		// through the projection and this table, and this line), which is every referent in the tree.
		assert.deepEqual(readOnlyToolBudget({ intent: "lookup", mode: "standard" }), { readOnlyToolWarningThreshold: 6 });
		assert.deepEqual(readOnlyToolBudget({ intent: "project-work", mode: "standard" }, true), { readOnlyToolWarningThreshold: 1 });
		assert.deepEqual(readOnlyToolBudget({ intent: "execution", mode: "ultra" }), { readOnlyToolWarningThreshold: 32 });
	});

	it("accumulates usage across provider rounds using Pi usage field names", () => {
		const snapshot = emptyRequestResourceSnapshot();
		accumulateRequestUsage(snapshot, { input: 100, cacheRead: 200, cacheWrite: 3, output: 40, reasoning: 5 });
		accumulateRequestUsage(snapshot, { input: 7, cacheRead: 11, output: 13, reasoning: 2 });
		assert.deepEqual(snapshot, { inputTokens: 107, cacheReadTokens: 211, cacheWriteTokens: 3, outputTokens: 53, reasoningTokens: 7 });
	});

	it("prioritizes provider status over abort wording in assistant failures", () => {
		assert.deepEqual(classifyAssistantProviderFailure({ errorMessage: "HTTP 401: request aborted" }), { kind: "terminal", reason: "authorization-denied" });
		assert.deepEqual(classifyAssistantProviderFailure({ errorMessage: "HTTP 429: operation aborted" }), { kind: "transient", reason: "http_429" });
		assert.deepEqual(classifyAssistantProviderFailure({ errorMessage: "Request was aborted by the user" }), { kind: "terminal", reason: "cancelled" });
	});

	it("reads the host's own aborted token, which no error-message word could supply", () => {
		// **The defect this case exists for, measured 2026-10-05 in a whole-flow field run.** The host ended a provider
		// stream early and recorded `stopReason: "aborted"` with `errorMessage: "terminated"`. Only the text was read, no
		// rule matched that word, and the classification fell through to `unknown` - so the ledger's terminal said
		// `provider-unknown` and told the operator to inspect a provider error the ledger did not hold. **The same host
		// event was `transient-failure` on the first attempt and `unknown` on the second**, so what the reading said about
		// one event came down to which word the provider happened to send. The host's word for the event is the event.
		assert.deepEqual(classifyAssistantProviderFailure({ stopReason: "aborted", errorMessage: "terminated" }), { kind: "transient", reason: "reviewed-provider-message" });
		// The text still wins where it says something: a person's cancellation is not this, and it is matched above.
		assert.deepEqual(classifyAssistantProviderFailure({ stopReason: "aborted", errorMessage: "Request was aborted by the user" }), { kind: "terminal", reason: "cancelled" });
	});

	it("reads the host's failed-stream token, which the aborted spelling never reached", () => {
		// **The defect the neighbouring case aimed at, and it stayed open.** Both call sites classify an assistant message
		// only when `normalizeStopReason` reports `error`, and that normalizer maps `aborted` to `cancelled` - so the raw
		// token handed to this function is always from the failed set, and the neighbouring case's `aborted` comparison
		// could never be true. It read as a control while nothing reached it.
		// **Measured 2026-10-11, tenth whole-flow run**: a provider round lasted 176 s, ended with the bare token and no
		// message text, and was classified `unknown`. The ledger holds `failureKind: "terminal"`, `failureReason:
		// "unknown"`, and the terminal says `retryable: false` with `nextAction: "Inspect the provider error and adjust
		// the request."` against a ledger that holds no provider error. A stream that ends before its response is the
		// transient class whether the host spells the event `aborted`, `error`, `failed` or `failure`.
		assert.deepEqual(classifyAssistantProviderFailure({ stopReason: "error" }), { kind: "transient", reason: "reviewed-provider-message" });
		assert.deepEqual(classifyAssistantProviderFailure({ stopReason: "failed" }), { kind: "transient", reason: "reviewed-provider-message" });
		assert.deepEqual(classifyAssistantProviderFailure({ stopReason: "failure", errorMessage: "   " }), { kind: "transient", reason: "reviewed-provider-message" });
		// The spelling the neighbouring case names is kept, for a caller that hands over a message it did not normalize.
		assert.deepEqual(classifyAssistantProviderFailure({ stopReason: "aborted", errorMessage: "terminated" }), { kind: "transient", reason: "reviewed-provider-message" });
		// **The text still wins where there is text**, which is what keeps a bare token from swallowing a real cause.
		assert.deepEqual(classifyAssistantProviderFailure({ stopReason: "error", errorMessage: "HTTP 503" }), { kind: "transient", reason: "http_503" });
		assert.deepEqual(classifyAssistantProviderFailure({ stopReason: "error", errorMessage: "Request was aborted by the user" }), { kind: "terminal", reason: "cancelled" });
	});

	it("records why a provider round failed, because the retry was decided from that classification", async () => {
		// **The defect this case exists for.** The `message_end` handler wrote the provider record and classified the failure
		// eight lines later, so the record could not carry the cause by construction: a ledger holding `stopReason: "error"`
		// said nothing about what happened, while the classification - the thing that decided between a retry and a terminal -
		// was in hand. Measured before the change: across every ledger on this machine, six errored provider records and not
		// one of them named a cause, one of them after a five-minute round.
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const api = {
			registerCommand() {},
			registerShortcut() {},
			registerTool() {},
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return representativeTools.map((name) => ({ name })); },
			setActiveTools() {},
			getActiveTools() { return [...representativeTools]; },
			getThinkingLevel() { return "max"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		const context: FakeContext = {
			hasUI: true,
			ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {} },
			sessionManager: { getEntries: () => [], getSessionId: () => "provider-cause-session" },
			getContextUsage: () => ({ tokens: 1_000, contextWindow: 1_000_000 }),
			// The provider-request handler returns before recording anything when the model's window is unknown, which is
			// why this case supplies one: the record it asserts only exists for a call the runtime was willing to make.
			model: { contextWindow: 200_000, maxTokens: 16_384, provider: "test", id: "test-model" },
		} as FakeContext;
		const ledgerPath = join(adapterStateDir, "execution.jsonl");
		const before = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean).length;
		// A request has to exist before a provider call does: the plan comes from `before_agent_start`, and the call record
		// from `before_provider_request`, which is why the pair is staged rather than assumed.
		await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "go", systemPrompt: "" }, context);
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		await events.get("before_provider_request")?.({ type: "before_provider_request", payload: { messages: [{ role: "user", content: "go" }] } }, context);
		// The provider's own words, which is all the adapter has when the failure arrives as a message rather than as an
		// `after_provider_response` status - the shape the field run's errored round had.
		const failure = { role: "assistant", stopReason: "error", errorMessage: "429 Too Many Requests", content: [] };
		await events.get("message_end")?.({ type: "message_end", message: failure }, context);
		await events.get("agent_end")?.({ type: "agent_end", messages: [failure] }, context);
		const written = readFileSync(ledgerPath, "utf8")
			.split(/\r?\n/)
			.filter(Boolean)
			.slice(before)
			.map((line) => JSON.parse(line) as { kind?: string; details?: Record<string, unknown> });
		const errored = written.find((record) => record.kind === "provider.request.completed" && record.details?.stopReason === "error");
		assert.ok(errored, `the errored round is recorded: ${JSON.stringify(written.map((record) => record.kind))}`);
		assert.equal(errored.details?.failureKind, "transient", "the record names the kind, which is what made the retry happen");
		assert.equal(errored.details?.failureReason, "http_429", "and why Dove called it that, in the vocabulary the classifier already owns");
	});

	it("turns the run's bare failed-stream token into a retry rather than a terminal", async () => {
		// **The field run's own shape, driven through the handler rather than asserted on the classifier.** The tenth
		// whole-flow run's failing round ended with `stopReason: "error"` and **no message text at all** - not the `429`
		// the case above stages, and not the `aborted` the fix before that one reads - and it was classified `unknown`,
		// which ended the request with `provider-unknown`, `retryable: false`, and a next action pointing at a provider
		// error the ledger does not hold. What this case holds is the behaviour, not only the classification: the same
		// round is now a transient failure, so the attempt closes `transient-failure` and the request is retried.
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const api = {
			registerCommand() {},
			registerShortcut() {},
			registerTool() {},
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return representativeTools.map((name) => ({ name })); },
			setActiveTools() {},
			getActiveTools() { return [...representativeTools]; },
			getThinkingLevel() { return "max"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		let aborted = 0;
		const context: FakeContext = {
			hasUI: true,
			ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {} },
			sessionManager: { getEntries: () => [], getSessionId: () => "bare-failed-stream-session" },
			getContextUsage: () => ({ tokens: 1_000, contextWindow: 1_000_000 }),
			model: { contextWindow: 200_000, maxTokens: 16_384, provider: "test", id: "test-model" },
			// A retried attempt must not abort the request; a terminal one does, and counting the calls keeps that
			// difference visible instead of letting an optional field swallow it.
			abort: () => { aborted += 1; },
		} as FakeContext;
		const ledgerPath = join(adapterStateDir, "execution.jsonl");
		const before = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean).length;
		await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "go", systemPrompt: "" }, context);
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		await events.get("before_provider_request")?.({ type: "before_provider_request", payload: { messages: [{ role: "user", content: "go" }] } }, context);
		const failure = { role: "assistant", stopReason: "error", content: [] };
		await events.get("message_end")?.({ type: "message_end", message: failure }, context);
		await events.get("agent_end")?.({ type: "agent_end", messages: [failure] }, context);
		const written = readFileSync(ledgerPath, "utf8")
			.split(/\r?\n/)
			.filter(Boolean)
			.slice(before)
			.map((line) => JSON.parse(line) as { kind?: string; details?: Record<string, unknown> });
		const errored = written.find((record) => record.kind === "provider.request.completed" && record.details?.stopReason === "error");
		assert.ok(errored, `the errored round is recorded: ${JSON.stringify(written.map((record) => record.kind))}`);
		assert.equal(errored.details?.failureKind, "transient", "a bare failed-stream token is the transient class, not `unknown`");
		assert.equal(errored.details?.failureReason, "reviewed-provider-message", "and it is named by the rule that reads the host's own token");
		const attempt = written.find((record) => record.kind === "request.attempt.completed");
		assert.ok(attempt, "the attempt is closed");
		assert.equal(attempt.details?.outcome, "transient-failure", "and it is retried, which is the whole point of the classification");
		assert.equal(written.some((record) => record.kind === "request.terminal"), false, "a retried attempt reaches no terminal");
		assert.equal(aborted, 0, "and it does not abort the request, which is what the terminal it used to produce did");
	});

	it("writes down that a tool call started, and whether the whitelist gave it a timeout", async () => {
		// **The defect this case exists for.** A call that never returned wrote nothing at all: `tool.observed` is written
		// at `tool_result`, and only when the call did not error, so the ledger stopped one millisecond after the call
		// began - measured twice, six and a half minutes in one run and forty-five in another, with the outer watchdog as
		// the only record of either. A reader could not tell a slow command from one that would never come back, and
		// could not tell whether the whitelist had covered the command at all.
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const api = {
			registerCommand() {},
			registerShortcut() {},
			registerTool() {},
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return representativeTools.map((name) => ({ name })); },
			setActiveTools() {},
			getActiveTools() { return [...representativeTools]; },
			getThinkingLevel() { return "max"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		const context: FakeContext = {
			hasUI: true,
			ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {} },
			sessionManager: { getEntries: () => [], getSessionId: () => "tool-start-session" },
			getContextUsage: () => ({ tokens: 1_000, contextWindow: 1_000_000 }),
			model: { contextWindow: 200_000, maxTokens: 16_384, provider: "test", id: "test-model" },
		} as FakeContext;
		const ledgerPath = join(adapterStateDir, "execution.jsonl");
		await events.get("session_start")?.({ type: "session_start" }, context);
		// **A tool call has to belong to a request, or it writes nothing at all.** `tool_call` returns before doing
		// anything when no lease is active - the `activeLease` guard at the top of that handler - and the writer this case
		// asserts sits behind every check in that handler, which is what the case found when it first ran: two calls, an
		// empty ledger slice, and no error, because the handler had returned long before the record could be written.
		await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "go", systemPrompt: "" }, context);
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		const before = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean).length;
		// One command the aggregate rule covers, and the whole-disk search that actually hung a run.
		// The covered one is spelled the way the field run spelled it: **`pytest -q` alone does not match the regex**,
		// because the trailing `\b` fails after the space it consumed, while `pytest <path>` does. That is the rule being
		// narrower than it reads, and this record is where the difference shows - as two different reasons now, rather
		// than as bounded and unbounded.
		await events.get("tool_call")?.({ type: "tool_call", toolCallId: "listed-call", toolName: "bash", input: { command: "python -m pytest tests/test_immutable.py -q" } }, context);
		await events.get("tool_call")?.({ type: "tool_call", toolCallId: "unlisted-call", toolName: "bash", input: { command: "find / -name dove-pi.cmd -maxdepth 6 | head" } }, context);
		const written = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean).slice(before)
			.map((line) => JSON.parse(line) as { kind?: string; correlation?: { toolCallId?: string }; details?: Record<string, unknown> });
		const started = written.filter((record) => record.kind === "tool.started");
		const listed = started.find((record) => record.correlation?.toolCallId === "listed-call");
		const unlisted = started.find((record) => record.correlation?.toolCallId === "unlisted-call");
		assert.ok(listed, `the call's start is recorded, and the ledger says what it holds: ${JSON.stringify(written.map((record) => record.kind))}`);
		assert.ok(unlisted, "both calls are recorded, not only the one the aggregate rule matched");
		assert.equal(listed.details?.timeoutApplied, true);
		assert.equal(listed.details?.timeoutSeconds, 240, "the aggregate command says it got the tight bound");
		assert.equal(listed.details?.timeoutReason, "aggregate-verification");
		// **This assertion used to read `false`, and the run it described is the reason the ceiling exists.** The record
		// was honest - the command really had no timeout - and the run was still lost to it. Now the case outside the
		// aggregate rule is bounded too, and the two rules are told apart by the reason rather than by one of them having
		// no bound at all.
		assert.equal(unlisted.details?.timeoutApplied, true, "the command outside the aggregate rule is bounded as well, at the ceiling");
		assert.equal(unlisted.details?.timeoutSeconds, 900, "the ceiling, which is generous on purpose");
		assert.equal(unlisted.details?.timeoutReason, "command-ceiling", "and the record says which of the two rules answered");
		// **The command travels as a digest and a length, never raw.** `quality-guidelines.md` requires evidence to hold
		// digests and bounded counters and never tool arguments, so this asserts both halves: the digest exists, and the
		// command it describes is nowhere in what was written.
		assert.equal(typeof unlisted.details?.commandDigest, "string");
		assert.equal(unlisted.details?.commandLength, "find / -name dove-pi.cmd -maxdepth 6 | head".length);
		assert.equal(JSON.stringify(written).includes("dove-pi.cmd"), false, "the command itself is nowhere in the ledger");
	});

	it("formats task inventory as a bounded no-tool projection", () => {
		const guidance = formatTaskInventoryGuidance({
			provider: "trellis",
			projectRoot: "C:/project",
			revision: "rev-1",
			tasks: [{ stableId: "trellis:a", provider: "trellis", providerTaskId: "a", path: ".trellis/tasks/a", title: "A", status: "in_progress", files: [] }],
			documents: [],
		});
		assert.match(guidance, /already resolved locally/);
		assert.match(guidance, /\"taskCount\":1/);
		assert.match(guidance, /Do not call tools/);
	});

	it("bounds repeated confirmation questions after affirmative answers", () => {
		const guard = new ProgressGuard({ interactiveQuestionThreshold: 2, interactiveQuestionHardStopThreshold: 3 });
		guard.start(1_000);
		const firstQuestion = {
			questions: [{
				question: "确认创建 S7 任务并进入规划？",
				header: "确认创建",
				options: [{ label: "确认创建" }, { label: "取消创建" }],
			}],
		};
		const rewrittenQuestion = {
			questions: [{
				question: "S7 创建前最后确认，之后进入规划并直接执行？",
				header: "创建确认",
				options: [{ label: "确认，执行创建" }, { label: "取消" }],
			}],
		};
		assert.equal(guard.beforeToolCall("question-1", "ask_user_question", firstQuestion, false).action, "allow");
		guard.recordToolResult({ toolName: "ask_user_question", input: firstQuestion, details: { answers: [{ answer: "确认创建" }] }, isError: false });
		assert.equal(guard.beforeToolCall("question-2", "ask_user_question", rewrittenQuestion, false).action, "terminate");
		assert.equal(guard.beforeToolCall("question-3", "ask_user_question", firstQuestion, false).action, "terminate");
		assert.match(guard.beforeToolCall("question-4", "ask_user_question", firstQuestion, false).reason ?? "", /不要再次提问/);

		guard.recordToolResult({ toolName: "write", input: { path: "task.md" }, isError: false });
		assert.equal(guard.beforeToolCall("question-5", "ask_user_question", firstQuestion, false).action, "terminate", "progress does not reset the per-goal question budget");
		const distinctQuestion = {
			questions: [{ question: "确认删除 README？", header: "确认删除", options: [{ label: "确认删除" }, { label: "取消" }] }],
		};
		assert.equal(guard.beforeToolCall("question-6", "ask_user_question", distinctQuestion, false).action, "terminate", "different wording cannot bypass the per-goal limit");
		guard.start(2_000);
		assert.equal(guard.beforeToolCall("question-new-goal", "ask_user_question", distinctQuestion, false).action, "allow", "a new goal gets a fresh question budget");
	});

	it("stops all September 1 wording variants before question two", () => {
		const guard = new ProgressGuard();
		guard.start(1_000);
		for (let index = 0; index < SEPT1_QUESTION_VARIANTS.length; index += 1) {
			const decision = guard.beforeToolCall(`sept1-question-${index + 1}`, "ask_user_question", sept1QuestionInput(index), false);
			assert.equal(decision.action, index === 0 ? "allow" : "terminate", `question ${index + 1} must not bypass the per-goal limit`);
		}
		assert.equal(guard.snapshot().interactiveQuestionCalls, 1);
	});

	it("normalizes opaque tool fingerprints without retaining sensitive input", () => {
		const ordered = progressFingerprint("read", { path: "README.md", token: "fixture-secret" });
		const reordered = progressFingerprint("read", { token: "fixture-secret", path: "README.md" });
		assert.equal(ordered, reordered);
		assert.equal(ordered.includes("fixture-secret"), false);
		assert.equal(progressFingerprint("ls", {}), progressFingerprint("ls", { path: "." }));
	});

	it("normalizes ls defaults and exposes completion without claiming cursor support", () => {
		const input: Record<string, unknown> = {};
		assert.equal(normalizeLsToolInput("ls", input), true);
		assert.deepEqual(input, { path: "." });
		assert.equal(normalizeLsToolInput("ls", input), false);
		assert.deepEqual(getLsObservationMetadata(input, undefined, [{ type: "text", text: "a.txt\ndir/" }]), {
			schemaVersion: 1,
			path: ".",
			returnedEntries: 2,
			complete: true,
			cursor: { supported: false },
		});
		assert.deepEqual(getLsObservationMetadata({ path: ".", limit: 2 }, { entryLimitReached: 2 }, [{ type: "text", text: "a.txt\ndir/\n\n[2 entries limit reached. Use limit=4 for more]" }]), {
			schemaVersion: 1,
			path: ".",
			returnedEntries: 2,
			complete: false,
			cursor: { supported: false },
			continuation: { kind: "increase-limit", nextLimit: 4 },
		});
	});

	it("blocks duplicate read-only Pi tool calls before execution but never coalesces mutations", async () => {
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const api = {
			registerCommand() {},
			registerShortcut() {},
			registerTool() {},
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return [{ name: "ls" }, { name: "write" }]; },
			setActiveTools() {},
			getActiveTools() { return ["read", "write"]; },
			getThinkingLevel() { return "high"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		const context: FakeContext = {
			ui: { theme: { fg: (_color, value) => value }, setStatus: () => {}, notify: () => {} },
			sessionManager: { getEntries: () => [], getSessionId: () => "tool-loop-session" },
		};
		await events.get("input")?.({ type: "input", text: "读取同一个文件", source: "interactive", streamingBehavior: "immediate" }, context);
		await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "读取同一个文件", systemPrompt: "" }, context);
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		await events.get("turn_start")?.({ type: "turn_start" }, context);

		const firstInput: Record<string, unknown> = {};
		const firstRead = await events.get("tool_call")?.({ type: "tool_call", toolCallId: "read-1", toolName: "ls", input: firstInput }, context);
		const duplicateReads = await Promise.all(Array.from({ length: 13 }, (_, index) => events.get("tool_call")?.({
			type: "tool_call",
			toolCallId: `read-${index + 2}`,
			toolName: "ls",
			input: {},
		}, context))) as Array<{ block?: boolean; terminate?: boolean } | undefined>;
		assert.equal(firstRead, undefined, "the first read remains executable");
		assert.deepEqual(firstInput, { path: "." }, "ls receives an explicit default path before execution");
		assert.equal(duplicateReads.length, 13);
		assert.equal(duplicateReads.every((result) => result?.block === true), true, "all 13 duplicates are stopped before the underlying operation can run");
		assert.equal(duplicateReads.every((result) => result?.terminate === false), true);

		const firstWrite = await events.get("tool_call")?.({ type: "tool_call", toolCallId: "write-1", toolName: "write", input: { path: "tmp.txt", content: "x" } }, context);
		const secondWrite = await events.get("tool_call")?.({ type: "tool_call", toolCallId: "write-2", toolName: "write", input: { path: "tmp.txt", content: "x" } }, context);
		assert.equal(firstWrite, undefined);
		assert.equal(secondWrite, undefined, "mutations must never be result-coalesced or replayed");
	});

	it("stops the Pi tool loop when confirmation answers are repeatedly affirmative", async () => {
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const notifications: string[] = [];
		const api = {
			registerCommand() {},
			registerShortcut() {},
			registerTool() {},
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return [{ name: "ask_user_question" }, { name: "write" }]; },
			setActiveTools() {},
			getActiveTools() { return ["ask_user_question", "write"]; },
			getThinkingLevel() { return "high"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		const context: FakeContext = {
			hasUI: true,
			ui: { theme: { fg: (_color, value) => value }, setStatus: () => {}, notify: (message) => notifications.push(message) },
			sessionManager: { getEntries: () => [], getSessionId: () => "interactive-loop-session" },
		};
		await events.get("input")?.({ type: "input", text: "确认问题重复处理", source: "interactive", streamingBehavior: "immediate" }, context);
		await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "确认问题重复处理", systemPrompt: "" }, context);
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		await events.get("turn_start")?.({ type: "turn_start" }, context);
		const question = (text: string) => ({
			type: "tool_call",
			toolName: "ask_user_question",
			input: { questions: [{ question: text, header: "确认创建", options: [{ label: "确认创建" }, { label: "取消" }] }] },
		});
		const answer = (input: unknown) => ({ type: "tool_result", toolName: "ask_user_question", input, content: [{ type: "text", text: "User answered: 确认创建" }], details: { answers: [{ answer: "确认创建" }] }, isError: false });
		const first = question("确认创建 S7 任务并进入规划？");
		const second = question("S7 创建前最后确认，之后进入规划并执行？");
		assert.equal(await events.get("tool_call")?.({ ...first, toolCallId: "question-1" }, context), undefined);
		await events.get("tool_result")?.({ ...answer(first.input), toolCallId: "question-1" }, context);
		const blocked = await events.get("tool_call")?.({ ...second, toolCallId: "question-2" }, context) as { block?: boolean; terminate?: boolean; reason?: string } | undefined;
		assert.equal(blocked?.block, true);
		assert.equal(blocked?.terminate, true);
		assert.match(blocked?.reason ?? "", /不要再次提问/);
	});

	it("continues a pending execution once without restricting Pi tools", async () => {
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		let activeTools: string[] = [];
		const api = {
			registerCommand() {}, registerShortcut() {}, registerTool() {}, registerFlag() {}, appendEntry() {},
			getAllTools() { return [{ name: "ask_user_question" }, { name: "write" }]; },
			setActiveTools(names: string[]) { activeTools = [...names]; },
			getActiveTools() { return activeTools; },
			getThinkingLevel() { return "high"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		const context: FakeContext = {
			ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {} },
			sessionManager: { getEntries: () => [], getSessionId: () => "pending-continuation-session" },
		};
		const firstPrompt = "先保存一下现在的上下文我记录一下用来审计优化agent流程";
		await events.get("input")?.({ type: "input", text: firstPrompt, source: "interactive", streamingBehavior: "immediate" }, context);
		await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: firstPrompt, systemPrompt: "" }, context);
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		const questionInput = { questions: [{ question: "确认保存？", header: "保存", options: [{ label: "可以" }, { label: "取消" }] }] };
		assert.equal(await events.get("tool_call")?.({ type: "tool_call", toolCallId: "pending-question", toolName: "ask_user_question", input: questionInput }, context), undefined);
		await events.get("tool_result")?.({ type: "tool_result", toolCallId: "pending-question", toolName: "ask_user_question", input: questionInput, content: [{ type: "text", text: "可以" }], details: { answers: [{ answer: "可以" }] }, isError: false }, context);
		await events.get("agent_end")?.({ type: "agent_end", messages: [{ role: "assistant", stopReason: "completed", content: [] }] }, context);
		await events.get("agent_settled")?.({ type: "agent_settled" }, context);

		const beforeRecords = readFileSync(join(adapterStateDir, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind?: string; details?: { requestId?: string; continuedFromRequestId?: string } });
		const sourceRequestId = beforeRecords.filter((record) => record.kind === "request.planned").at(-1)?.details?.requestId;
		assert.ok(sourceRequestId);

		await events.get("input")?.({ type: "input", text: "可以", source: "interactive", streamingBehavior: "immediate" }, context);
		await events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "可以", systemPrompt: "" }, context);
		await events.get("agent_start")?.({ type: "agent_start" }, context);
		const repeatedQuestion = await events.get("tool_call")?.({ type: "tool_call", toolCallId: "repeated-question", toolName: "ask_user_question", input: questionInput }, context) as { block?: boolean; terminate?: boolean; reason?: string } | undefined;
		assert.equal(repeatedQuestion?.block, true);
		assert.equal(repeatedQuestion?.terminate, true);
		assert.match(repeatedQuestion?.reason ?? "", /already confirmed/);
		assert.equal(await events.get("tool_call")?.({ type: "tool_call", toolCallId: "write-log", toolName: "write", input: { path: "audit.log", content: "ok" } }, context), undefined, "Dove must leave Pi's valid tools usable");
		assert.equal(await events.get("tool_call")?.({ type: "tool_call", toolCallId: "host-tool", toolName: "third_party_write", input: {} }, context), undefined, "Dove must not add an intent-derived tool firewall on top of Pi");

		const afterRecords = readFileSync(join(adapterStateDir, "execution.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { kind?: string; details?: { continuedFromRequestId?: string } });
		assert.equal(afterRecords.filter((record) => record.kind === "request.planned").at(-1)?.details?.continuedFromRequestId, sourceRequestId);
	});

	it("keeps Auto unrestricted while retaining explicit compatibility profiles", () => {
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser", "web_search"], "core"), ["read", "agent_doctor"]);
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser", "web_search"], "auto", "lookup", "打开网页并截图"), ["read", "agent_doctor", "agent_browser", "web_search"]);
		assert.deepEqual(selectDoveToolNames(["read", "plan_mode_question"], "auto", "chat", "hi"), ["read", "plan_mode_question"]);
		assert.deepEqual(selectDoveToolNames(["read", "agent_doctor", "agent_browser"], "full"), ["read", "agent_doctor", "agent_browser"]);
		assert.equal(hasHashlineEditTools(["read", "replace", "insert", "grep"]), true);
		assert.deepEqual(selectDoveToolNames(["read", "edit", "grep", "replace", "insert"], "core"), ["read", "grep"]);
		assert.deepEqual(selectDoveToolNames(["read", "edit", "grep", "replace", "insert"], "auto", "execution"), ["read", "edit", "grep", "replace", "insert"]);
		assert.deepEqual(selectDoveToolNames(["read", "edit", "grep", "replace", "insert"], "full"), ["read", "edit", "grep", "replace", "insert"]);
	});

	it("keeps large execution logs out of model-facing tool results", () => {
		const payload = compactModelPayload({ stdout: "x".repeat(10_000), nested: [{ stderr: "y".repeat(9_000) }] }) as { stdout: string; nested: Array<{ stderr: string }> };
		assert.ok(payload.stdout.length < 8_500);
		assert.match(payload.stdout, /truncated/);
		assert.ok(payload.nested[0].stderr.length < 8_500);
	});

	it("preserves an explicit Pi tool selection for continuation", async () => {
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const selected = ["read", "ls", "bash"];
		let hostActiveTools = [...selected];
		const api = {
			registerCommand() {}, registerShortcut() {}, registerTool() {}, registerFlag() {}, appendEntry() {},
			getAllTools() { return representativeTools.map((name) => ({ name })); },
			setActiveTools(names: string[]) { hostActiveTools = [...names]; },
			getActiveTools() { return hostActiveTools; },
			getThinkingLevel() { return "max"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		process.argv.push("--tools");
		try { extension(api); } finally { process.argv.pop(); }
		const context: FakeContext = {
			ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify() {} },
			sessionManager: { getEntries: () => [], getSessionId: () => "explicit-tools" },
		};
		await events.get("session_start")?.({ type: "session_start" }, context);
		assert.deepEqual(hostActiveTools, selected);
		await events.get("before_agent_start")?.({ prompt: "继续当前项目任务", systemPrompt: "", type: "before_agent_start" }, context);
		assert.deepEqual(hostActiveTools, selected);
		await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
		assert.deepEqual(hostActiveTools, selected);
	});

	it("reads ProjectProvider context exactly once for every continuation outcome", () => {
		const task = (id: string, status: string): ProjectTask => ({ stableId: `trellis:${id}`, provider: "trellis", providerTaskId: id, path: `C:/project/.trellis/tasks/${id}`, title: id, status, files: [] });
		const current = task("current", "in_progress");
		const snapshots: Array<{ expected: "current" | "single_candidate" | "ambiguous" | "none"; context: ProjectContextSnapshot }> = [
			{ expected: "current", context: { provider: "trellis", projectRoot: "C:/project", revision: "1", currentTask: current, tasks: [current], documents: [] } },
			{ expected: "single_candidate", context: { provider: "trellis", projectRoot: "C:/project", revision: "2", tasks: [task("only", "started")], documents: [] } },
			{ expected: "ambiguous", context: { provider: "trellis", projectRoot: "C:/project", revision: "3", tasks: [task("a", "active"), task("b", "working")], documents: [] } },
			{ expected: "none", context: { provider: "trellis", projectRoot: "C:/project", revision: "4", tasks: [task("done", "completed")], documents: [] } },
		];
		const plan = createRequestPlan({ message: "继续当前项目任务", projectAvailable: true });
		for (const fixture of snapshots) {
			let calls = 0;
			const provider = { getContext() { calls += 1; return fixture.context; } } as ProjectProvider;
			assert.equal(readProjectContinuationForPlan(provider, plan)?.projection.kind, fixture.expected);
			assert.equal(calls, 1, `${fixture.expected} must use one public ProjectProvider read`);
		}
		let nonContinuationCalls = 0;
		const provider = { getContext() { nonContinuationCalls += 1; return snapshots[0].context; } } as ProjectProvider;
		assert.equal(readProjectContinuationForPlan(provider, createRequestPlan({ message: "读取 package.json", projectAvailable: true })), undefined);
		assert.equal(nonContinuationCalls, 0);
	});

	it("enforces read-only mode across project, workspace, and side-effect capability paths", async () => {
		const tools = new Map<string, { execute: (...args: any[]) => Promise<any> }>();
		const api = {
			registerCommand() {},
			registerShortcut() {},
			registerTool(definition: { name: string; execute: (...args: any[]) => Promise<any> }) { tools.set(definition.name, definition); },
			registerFlag() {},
			appendEntry() {},
			getAllTools() { return [{ name: "read" }, { name: "agent_doctor" }]; },
			setActiveTools() {},
			getActiveTools() { return []; },
			getThinkingLevel() { return "medium"; },
			on() {},
		} as unknown as ExtensionAPI;
		const confirmations: string[] = [];
		const context: FakeContext = {
			hasUI: true,
			ui: {
				theme: { fg: (_color, value) => value },
				setStatus: () => {},
				notify: () => {},
				confirm: async (message: string) => { confirmations.push(message); return true; },
			},
			sessionManager: { getEntries: () => [], getSessionId: () => "read-only-test" },
		};
		const previous = process.env.DOVE_PI_READ_ONLY;
		process.env.DOVE_PI_READ_ONLY = "1";
		try {
			extension(api);
			const projectTask = await tools.get("agent_project_task")?.execute("call", { operation: "finish" }, undefined, undefined, context);
			assert.equal(projectTask?.details?.blocked, true);
			const restore = await tools.get("agent_workspace_restore")?.execute("call", { snapshotId: "missing" }, undefined, undefined, context);
			assert.equal(restore?.details?.ok, false);
			const patch = await tools.get("agent_workspace_patch")?.execute("call", { operations: [] }, undefined, undefined, context);
			assert.equal(patch?.details?.appliedOperations, 0);
			const capability = await tools.get("agent_run_capability")?.execute("call", { name: "dev.project_test" }, undefined, undefined, context);
			assert.equal(capability?.details?.status, "approval_denied");
			assert.equal(confirmations.length, 0, "read-only mode must not surface an approval that can re-enable side effects");
		} finally {
			if (previous === undefined) delete process.env.DOVE_PI_READ_ONLY;
			else process.env.DOVE_PI_READ_ONLY = previous;
		}
	});

		it("bounds oversized built-in tool results through the admission policy, and leaves small results alone", async () => {
		assert.equal(await admitToolResult([{ type: "text", text: "small" }]), undefined);
		const compacted = await admitToolResult([{ type: "text", text: "x".repeat(40_000) }], 1_000, "bash");
		assert.ok(compacted);
		const text = (compacted?.content[0] as { text: string }).text;
		assert.ok(text.length <= 1_000, `the admitted form fits the budget it was given, was ${text.length}`);
		assert.match(text, /admitted content compacted/);
		assert.match(text, /channel: tool_result/, "the marker says which channel the content came through");
		assert.match(text, /continuation: request a narrower range/, "and how the model gets at the rest");
		const withImage = await admitToolResult([{ type: "text", text: "x".repeat(40_000) }, { type: "image", data: "abc", mimeType: "image/png" }], 1_000, "bash");
		assert.equal(withImage?.content.some((part) => part.type === "image"), true);
		// The classification the recorded incident needed: a diagnostic for a downloaded tree is a fact about the
		// tree, not an instruction about the task.
		const generated = await admitToolResult([{ type: "text", text: "x".repeat(40_000) }], 1_000, "read", "project/node_modules/left-pad/index.js");
		assert.match((generated?.content[0] as { text: string }).text, /not delivered as actionable task context/);
		const metadata = (await admitToolResult([{ type: "text", text: "z".repeat(20_000) }], 1_000, "bash"))?.metadata;
		assert.equal(metadata?.originalChars, 20_000);
		assert.ok((metadata?.retainedChars ?? 0) <= 1_000);
		assert.equal(metadata?.contentDigest.length, 64, "the whole digest: nothing here forces a truncation, and a truncated identifier collides");
		assert.equal(getToolResultCharBudget("read", "lookup"), 8_000);
		assert.equal(getToolResultCharBudget("read", "project-work"), 12_000);
		assert.equal(getToolResultCharBudget("bash", "project-work"), 32_000);
	});
	it("does not guess a first-request budget when usage is unknown", () => {
		assert.equal(getProjectContextBudget({ contextWindow: 12_800 }), undefined);
		const observed = getProjectContextBudget({ tokens: 23_218, contextWindow: 12_800 });
		assert.equal(observed, undefined);
		assert.equal(getProjectContextBudget({}), undefined);
	});

	it("does not apply a percentage share cap when provider capacity is known", () => {
		const budget = getProjectContextBudget({ tokens: 10_000, contextWindow: 200_000 });
		assert.equal(budget, (200_000 - 10_000 - 8_192) * 3);
	});

	it("settles from lifecycle state without reading a stale Pi context", async () => {
		const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
		const api = {
			registerCommand() {}, registerShortcut() {}, registerTool() {}, registerFlag() {}, appendEntry() {},
			getAllTools() { return []; }, setActiveTools() {}, getActiveTools() { return []; }, getThinkingLevel() { return "medium"; },
			on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
		} as unknown as ExtensionAPI;
		extension(api);
		const staleContext = new Proxy({} as FakeContext, {
			get() { throw new Error("stale ctx must not be read after session replacement"); },
		});
		await events.get("agent_settled")?.({ type: "agent_settled" }, staleContext);
	});

	it("auto policy respects explicit per-model thinking level from settings", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "pi-adapter-fix1-"));
		const agentDir = join(tmpDir, "agent");
		mkdirSync(agentDir, { recursive: true });
		writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ defaultThinkingLevel: "max", modelThinkingLevels: { "cc-switch-open-router/deepseek-v4-flash-0731": "max" } }), "utf8");
		const prevEnv = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = agentDir;
		try {
			const commands = new Map<string, { handler: (args: string, ctx: FakeContext) => Promise<void> }>();
			const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
			const sets: string[] = [];
			const api = {
				registerCommand(name: string, definition: { handler: (args: string, ctx: FakeContext) => Promise<void> }) { commands.set(name, definition); },
				registerShortcut() {},
				registerTool() {},
				registerFlag() {},
				appendEntry() {},
				getAllTools() { return [{ name: "read" }, { name: "agent_doctor" }]; },
				setActiveTools() {},
				getActiveTools() { return []; },
				getThinkingLevel() { return "max"; },
				setThinkingLevel(level: string) { sets.push(level); },
				on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
			} as unknown as ExtensionAPI;
			extension(api);
			const context: FakeContext = {
				model: { provider: "cc-switch-open-router", id: "deepseek-v4-flash-0731" },
				ui: { theme: { fg: (c, v) => v }, setStatus: () => {}, notify: () => {} },
				sessionManager: { getEntries: () => [] },
			};
			// Auto policy + explicit per-model max -> must NOT override with mode level
			await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
			assert.deepEqual(sets, [], "explicit per-model level must be respected by auto policy");
		} finally {
			if (prevEnv === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = prevEnv;
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("auto policy asserts mode level when no explicit thinking level configured", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "pi-adapter-fix1b-"));
		const agentDir = join(tmpDir, "agent");
		mkdirSync(agentDir, { recursive: true });
		writeFileSync(join(agentDir, "settings.json"), JSON.stringify({}), "utf8");
		const prevEnv = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = agentDir;
		try {
			const commands = new Map<string, { handler: (args: string, ctx: FakeContext) => Promise<void> }>();
			const events = new Map<string, (event: unknown, ctx: FakeContext) => Promise<unknown>>();
			const sets: string[] = [];
			const api = {
				registerCommand(name: string, definition: { handler: (args: string, ctx: FakeContext) => Promise<void> }) { commands.set(name, definition); },
				registerShortcut() {},
				registerTool() {},
				registerFlag() {},
				appendEntry() {},
				getAllTools() { return [{ name: "read" }, { name: "agent_doctor" }]; },
				setActiveTools() {},
				getActiveTools() { return []; },
				getThinkingLevel() { return "medium"; },
				setThinkingLevel(level: string) { sets.push(level); },
				on(name: string, handler: (event: unknown, ctx: FakeContext) => Promise<unknown>) { events.set(name, handler); },
			} as unknown as ExtensionAPI;
			extension(api);
			const context: FakeContext = {
				model: { provider: "some-provider", id: "some-model" },
				ui: { theme: { fg: (c, v) => v }, setStatus: () => {}, notify: () => {} },
				sessionManager: { getEntries: () => [] },
			};
			// No explicit config -> auto derives standard->high and asserts it
			await events.get("before_agent_start")?.({ prompt: "hi", systemPrompt: "", type: "before_agent_start" }, context);
			assert.deepEqual(sets, ["high"], "auto policy must assert mode-derived level when no explicit config");
		} finally {
			if (prevEnv === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = prevEnv;
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	/**
	 * Wait until `count` children of the batch case have written their started markers, or fail loudly.
	 *
	 * A bounded wait for an observable state, not a fence: it returns the moment the state holds, and it fails with the
	 * count it actually reached when it does not - so a mistake reads as a number rather than as a timeout. It polls with
	 * `timers/promises` so the suite's scan, which forbids the awaited-promise form, has nothing to except here.
	 */
	async function waitForStartedChildren(root: string, count: number): Promise<void> {
		const deadline = Date.now() + 20_000;
		for (;;) {
			const started = readdirSync(root).filter((name) => name.startsWith("started-")).length;
			if (started >= count) return;
			if (Date.now() > deadline) assert.fail(`only ${started} of ${count} children reported that they started`);
			await delay(10);
		}
	}

	it("keeps every child of a parallel batch visible while the batch is in flight", async () => {
		// **Pi runs the tool calls of one assistant message in parallel** (`pi-agent-core/dist/agent-loop.js:411-453`),
		// so two dispatches interleave at their await points. A single last-state binding can describe only one of
		// them, and the doctor projection has no `activeRuns` field at all - which is what this case fails on.
		const root = mkdtempSync(join(tmpdir(), "pi-subagent-batch-"));
		const childScript = join(root, "fake-pi-child.mjs");
		// **The child holds itself in flight, so the case does not have to hope.** It reports that it started, waits for
		// the case to open the gate, and only then answers - three steps the case can see, instead of a window it hopes is
		// wide enough. The first version of this case wrote a 2500 ms delay here and slept 600 ms below, which is a race:
		// measured on CI 2026-10-15 as `0 !== 2` in 2807 ms, on a commit that only changed a task status.
		//
		// Two details that are not style. The marker is named from the child's own pid, because both dispatches are
		// launched with the **same** argv (`DOVE_PI_SUBAGENT_PREFIX_ARGS` is process-wide), so a per-child name cannot be
		// passed in. And the poll uses `timers/promises`, not the awaited-promise form, because that form is exactly what
		// the suite's own scan forbids - a sleep standing where a state should be - and a rule the case itself breaks is
		// not a rule.
		writeFileSync(childScript, [
			'import { writeFileSync, existsSync } from "node:fs";',
			'import { dirname, join } from "node:path";',
			'import { fileURLToPath } from "node:url";',
			'import { setTimeout as delay } from "node:timers/promises";',
			"const dir = dirname(fileURLToPath(import.meta.url));",
			'writeFileSync(join(dir, "started-" + process.pid), "");',
			"const deadline = Date.now() + 30000;",
			'while (!existsSync(join(dir, "release"))) {',
			'	if (Date.now() > deadline) { process.stderr.write("the release gate never opened\\n"); process.exit(3); }',
			"	await delay(10);",
			"}",
			'process.stdout.write("child answer");',
			"process.exit(0);",
			"",
		].join("\n"), "utf8");
		const previousExecutable = process.env.DOVE_PI_SUBAGENT_EXECUTABLE;
		const previousPrefixArgs = process.env.DOVE_PI_SUBAGENT_PREFIX_ARGS;
		process.env.DOVE_PI_SUBAGENT_EXECUTABLE = process.execPath;
		process.env.DOVE_PI_SUBAGENT_PREFIX_ARGS = JSON.stringify([childScript]);
		try {
			// The provider is constructed once, at registration, so the environment must be set before `extension(api)`.
			const tools = new Map<string, unknown>();
			const api = {
				registerCommand() {},
				registerShortcut() {},
				registerTool(definition: { name: string }) { tools.set(definition.name, definition); },
				registerFlag() {},
				appendEntry() {},
				getAllTools() { return []; },
				setActiveTools() {},
				getActiveTools() { return []; },
				getThinkingLevel() { return "max"; },
				on() {},
			} as unknown as ExtensionAPI;
			extension(api);
			const subagent = tools.get("agent_subagent") as { execute: (...args: unknown[]) => Promise<{ content: Array<{ text?: string }>; details?: { runId?: string } }> };
			const doctor = tools.get("agent_doctor") as { execute: (...args: unknown[]) => Promise<{ details: { subagent: { activeRuns?: Array<{ runId?: string }>; lastTerminal?: { state?: string; runId?: string } } } }> };
			const context: FakeContext = {
				ui: { theme: { fg: (c, v) => v }, setStatus: () => {}, notify: () => {} },
				sessionManager: { getEntries: () => [], getBranch: () => [], getSessionId: () => "session-batch" },
			};
			const first = subagent.execute("batch-call-1", { name: "one", prompt: "Read the first area" });
			const second = subagent.execute("batch-call-2", { name: "two", prompt: "Read the second area" });
			// **Wait for the state, do not sleep into it.** Both children are in flight exactly when both have written
			// their started marker, which is a fact this case can see rather than a window it hopes is wide enough.
			await waitForStartedChildren(root, 2);
			const doctorResult = await doctor.execute("doctor-call", {}, undefined, undefined, context);
			assert.equal(doctorResult.details.subagent.activeRuns?.length, 2, "a batch in flight must be reported as two runs, not one overwritten slot");
			// Now let them finish: the gate is the thing that was holding them.
			writeFileSync(join(root, "release"), "");
			const [a, b] = await Promise.all([first, second]);
			assert.match(a.content[0]?.text ?? "", /child answer/, "each dispatch keeps its own answer");
			assert.match(b.content[0]?.text ?? "", /child answer/);
			assert.notEqual(a.details?.runId, b.details?.runId, "and each keeps its own run id");
			// **The other half of the same state**: a settled child leaves the in-flight set, and the terminal that
			// survives names a run that really completed. Reading only the in-flight half would pass for a map that is
			// never emptied, and a `lastTerminal` no child ever wrote would go unnoticed.
			const settled = await doctor.execute("doctor-settled", {}, undefined, undefined, context);
			assert.equal(settled.details.subagent.activeRuns?.length, 0, "a settled batch leaves nothing in flight");
			assert.equal(settled.details.subagent.lastTerminal?.state, "succeeded");
			assert.ok(
				[a.details?.runId, b.details?.runId].includes(settled.details.subagent.lastTerminal?.runId ?? ""),
				"and the terminal belongs to one of the two children rather than to a third",
			);
		} finally {
			if (previousExecutable === undefined) delete process.env.DOVE_PI_SUBAGENT_EXECUTABLE; else process.env.DOVE_PI_SUBAGENT_EXECUTABLE = previousExecutable;
			if (previousPrefixArgs === undefined) delete process.env.DOVE_PI_SUBAGENT_PREFIX_ARGS; else process.env.DOVE_PI_SUBAGENT_PREFIX_ARGS = previousPrefixArgs;
			rmSync(root, { recursive: true, force: true });
		}
	});
});

interface FakeContext {
	hasUI?: boolean;
	model?: unknown;
	/** Present where the handler resolves settings against a directory; a session always has one. */
	cwd?: string;
	/** Present where the handler reads it; most cases never do, which is why it is optional. */
	getContextUsage?: () => { tokens?: number; contextWindow?: number };
	ui: {
		theme: { fg: (color: string, value: string) => string };
		setStatus: (key: string, value: string | undefined) => void;
		notify: (message: string, level?: string) => void;
		confirm?: (message: string, detail?: string) => Promise<boolean>;
	};
	sessionManager: { getEntries: () => unknown[]; getBranch?: () => unknown[]; getSessionId?: () => string };
	abort?: () => void;
}
