import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension from "../src/pi-adapter/extension.ts";
import { admitNonConversationalMessages, convergenceOperationFromPiInput, unresolvedAcceptanceEvidence } from "../src/pi-adapter/extension.ts";
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
	ui: { theme: { fg: (color: string, value: string) => string }; setStatus: (key: string, value: string | undefined) => void; notify: (message: string, level?: string) => void };
	sessionManager: { getEntries: () => unknown[]; getBranch?: () => unknown[]; getSessionId?: () => string };
}

/** A host that records what the extension registers, so the handlers can be invoked the way Pi invokes them. */
function startHost(root: string) {
	const previousCwd = process.cwd();
	process.chdir(root);
	const events = new Map<string, (event: any, ctx: any) => Promise<any>>();
	const notifications: string[] = [];
	const tools = new Map<string, { name: string }>();
	const api = {
		registerCommand() {},
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
	const context: FakeContext = {
		hasUI: true,
		ui: { theme: { fg: (_color, value) => value }, setStatus() {}, notify: (message: string) => { notifications.push(message); } },
		sessionManager: { getEntries: () => [], getBranch: () => [], getSessionId: () => "work-mode-test" },
	};
	return { events, notifications, context, tools, restoreCwd: () => process.chdir(previousCwd) };
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

/** A conformance mode's authority document lives beside the modes, so copying a mode is not enough. */
function copyEngagements(root: string): void {
	cpSync(join(repoRoot, "engagements"), join(root, "engagements"), { recursive: true });
}

async function callTool(host: ReturnType<typeof startHost>, toolName: string, input: unknown): Promise<{ block?: boolean; reason?: string } | undefined> {
	const handler = host.events.get("tool_call");
	if (handler === undefined) throw new Error("the extension registered no tool_call handler, so this test would prove nothing");
	return handler({ type: "tool_call", toolCallId: "c-1", toolName, input }, host.context);
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

	it("enforces the loaded mode's never_allow against the action, and leaves an unlisted tool alone", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "pentest");
		copyEngagements(root);
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
				host.notifications.some((message) => /ask_before is not consumed yet/.test(message)),
				"the half that is not enforced is stated rather than implied",
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
		// This is the consequence of requiring a document, pinned as behaviour rather than discovered later:
		// code-audit declares `gate.semantics: conformance` and its authority.grant is the bare name
		// 'local-review', so there is no document for an action to be checked against. It refuses to load, and the
		// refusal names the two fixes, because a conformance mode that cannot check anything must not start.
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "code-audit");
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "code-audit" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			const refusal = host.notifications.find((message) => /local-review/.test(message));
			assert.ok(refusal !== undefined, "the refusal names the grant that could not be resolved: " + host.notifications.join(" | "));
			assert.match(refusal, /authority\.grant/, "and the field to fix");
			assert.match(refusal, /gate\.semantics: limit/, "and the alternative, so the operator is not left guessing");
			const decision = await callTool(host, "bash", { command: "ls" });
			assert.equal(decision?.block, true, "and no action runs while the mode is unresolved");
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
	it("refuses an over-limit action at the tool-call boundary, and records the refusal in the ledger", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "trading");
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "trading" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			assert.ok(host.notifications.some((message) => /trading loaded from modes\/trading/.test(message)), "the mode must load before its limits can fire: " + host.notifications.join(" | "));
			// A request, because the gate sits where the input is final, and that is inside a Dove-managed request.
			await host.events.get("input")?.({ type: "input", text: "place one order", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "place one order", systemPrompt: "" }, host.context);

			const over = await callTool(host, "agent_run_capability", { name: "order.submit", args: { order: { notional: 250_000, quantity: 10 } } });
			assert.equal(over?.block, true, "the mode's declared limit must fire at the host boundary");
			assert.match(over?.reason ?? "", /exceeds limit 'notional'/, "the reason names the limit that refused it");
			assert.match(over?.reason ?? "", /Do this instead:/, "a refusal carries remediation, not only a reason");

			const under = await callTool(host, "agent_run_capability", { name: "order.submit", args: { order: { notional: 50_000, quantity: 10 } } });
			assert.notEqual(under?.block, true, "an order inside the declared bounds is not refused by the limit gate");

			const unevaluable = await callTool(host, "agent_run_capability", { name: "order.submit", args: { order: { quantity: 10 } } });
			assert.equal(unevaluable?.block, true, "a limit that cannot find the argument it checks is a block, not a pass");
			assert.match(unevaluable?.reason ?? "", /could not be evaluated/);

			// The refusal is evidence, not only a message to the model: a blocked action that leaves no record is
			// indistinguishable from one that never happened, and the two need different responses later.
			const ledgerFile = join(stateDir, "execution.jsonl");
			const records = existsSync(ledgerFile)
				? readFileSync(ledgerFile, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as { kind?: string; details?: { reason?: string; action?: string; gate?: string } })
				: [];
			const recorded = records.find((record) => record.kind === "gate.refused" && /exceeds limit 'notional'/.test(record.details?.reason ?? ""));
			assert.ok(recorded !== undefined, "the refusal is in the ledger with its reason");
			assert.equal(recorded?.details?.action, "order.submit", "and it names the action rather than only the tool");
			assert.equal(recorded?.details?.gate, "limit");
		} finally {
			host.restoreCwd();
		}
	});
	it("refuses an action outside the authority document at the boundary, and records which check refused it", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "pentest");
		copyEngagements(root);
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "pentest" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "scan the target", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "scan the target", systemPrompt: "" }, host.context);

			// The shipped example engagement names evidence digests ("aaaa"/"bbbb") that are placeholders, so no
			// grant in it can resolve. That is the honest end-to-end demonstration: conformance refuses, and the
			// refusal says which check it was rather than only that something went wrong.
			const scanned = await callTool(host, "agent_run_capability", { name: "net.scan", args: { target: "t-web" } });
			assert.equal(scanned?.block, true, "a conformance mode must refuse an action whose grant cannot resolve");
			assert.match(scanned?.reason ?? "", /\[conformance\]/, "the reason names the check, not only the outcome");

			const ledgerFile = join(stateDir, "execution.jsonl");
			const records = existsSync(ledgerFile)
				? readFileSync(ledgerFile, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as { kind?: string; details?: { gate?: string; action?: string; reason?: string } })
				: [];
			const recorded = records.find((record) => record.kind === "gate.refused" && record.details?.gate === "conformance" && record.details?.action === "net.scan");
			assert.ok(recorded !== undefined, "the conformance refusal is in the ledger with its gate and its action");
			assert.match(recorded?.details?.reason ?? "", /evidence|digest/, "and its reason names what could not be verified");
		} finally {
			host.restoreCwd();
		}
	});
	it("claims an effect at the boundary and records its outcome when the result arrives", async () => {
		const root = freshRoot();
		process.env.DOVE_PI_FRAMEWORK_VERSION = "0.2.0";
		copyMode(root, "trading");
		declareMode(root, JSON.stringify({ schemaVersion: 1, mode: "trading" }));
		const host = startHost(root);
		try {
			await host.events.get("session_start")?.({ type: "session_start" }, host.context);
			await host.events.get("input")?.({ type: "input", text: "submit one order", source: "interactive" }, host.context);
			await host.events.get("before_agent_start")?.({ type: "before_agent_start", prompt: "submit one order", systemPrompt: "" }, host.context);

			const input = { name: "order.submit", args: { order: { notional: 100, quantity: 1 } } };
			const decision = await callTool(host, "agent_run_capability", input);
			assert.notEqual(decision?.block, true, "an order inside the declared limits is not refused");

			// The claim is the file's existence, taken before dispatch, and it reads as in flight until a result
			// arrives - which is what an interrupted dispatch actually is.
			const effectsDir = join(root, ".dove", "effects");
			const claimed = existsSync(effectsDir) ? readdirSync(effectsDir).filter((name) => name.endsWith(".json")) : [];
			assert.equal(claimed.length, 1, "one claim, taken at the boundary");
			const inFlight = JSON.parse(readFileSync(join(effectsDir, claimed[0] as string), "utf8")) as { tool?: string; outcome?: string };
			assert.equal(inFlight.tool, "order.submit", "the record names the action, not the umbrella tool that carried it");
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
});

