/**
 * One narrow, offline turn of axi's own loop, assembled from parts the repository already had.
 *
 * **What this is for.** Until now the loop, the gate, the ledger and the scripted provider all existed and
 * nothing running in production reached them: `tests/harness-reachability.test.ts` carries them on its
 * allow-list, each with a reason saying nothing reaches it. This command is the consumer that changes that,
 * and it is a *diagnostic subcommand of the product CLI* rather than a test helper on purpose - `src/cli.ts`
 * is one of the four entry points that walk follows (the list at the top of
 * `tests/harness-reachability.test.ts`),
 * so an import from here is what makes a module reachable, and "removing the allow-list entry" becomes a
 * reading instead of an intention.
 *
 * **What it deliberately does not do.** No model, no network, no writes: the provider is
 * `createScriptedProvider`, and the only tool reads one file inside the workspace. Writing, isolation and the
 * improvement loop belong to later milestones; this one exists to show that every proposed action passes the
 * gate *by construction* and that the turn leaves a ledger behind.
 */

import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { createScriptedProvider, type ScriptedStep } from "../adapters/loop-scripted.ts";
import { createActionPolicy } from "../core/action-policy.ts";
import { ExecutionLedger } from "../core/execution-ledger.ts";
import { createAgentLoop } from "../core/loop-runner.ts";
import type { ActionGate, GateDecision, GateInvocation, LoopOutcome, LoopToolSpec, ToolCall, ToolResult } from "../core/loop.ts";
import { gateLabelOf } from "../core/loop.ts";
import { loadWorkModeFromDirectory } from "../core/work-mode.ts";

/** The one tool this turn has. Reading only: nothing here can change the workspace. */
export const READ_FILE_TOOL: LoopToolSpec = {
	name: "read_file",
	description: "Read a UTF-8 text file inside the workspace, and nothing outside it.",
	parameters: {
		type: "object",
		properties: { path: { type: "string", description: "Workspace-relative path." } },
		required: ["path"],
		additionalProperties: false,
	},
};

export interface AxiTurnOptions {
	readonly workspaceRoot: string;
	/** Mode directory name under `<workspaceRoot>/modes`, e.g. `code-audit`. */
	readonly modeName: string;
	readonly ledgerPath: string;
	readonly prompt: string;
	/** Defaults to one `read_file` call followed by a closing line of text. */
	readonly steps?: readonly ScriptedStep[];
	readonly maxTurns?: number;
}

export interface GateInvocationReading {
	readonly tool: string;
	readonly decision: GateDecision["outcome"];
	readonly reason?: string;
}

export interface AxiTurnReport {
	readonly modeId: string;
	readonly providerCalls: number;
	readonly outcome: LoopOutcome;
	/** Every consultation of the gate, allowed ones included - the point is that there were no others. */
	readonly gateInvocations: readonly GateInvocationReading[];
	/** Records this turn wrote. Read after the fact so a caller can compare it with the file. */
	readonly ledgerRecords: number;
}

function refusalReason(tool: string, reason: string | undefined): string {
	return reason === undefined || reason === "" ? tool : reason;
}

export async function runAxiTurn(options: AxiTurnOptions): Promise<AxiTurnReport> {
	const { mode } = loadWorkModeFromDirectory(options.workspaceRoot, options.modeName, { frameworkVersion: "0.2.0" });

	// The policy is the repository's own name-and-argument layer. `registeredCapabilities` is empty because
	// this diagnostic registers none: a mode that grants a capability its deployment lacks is refused at the
	// boundary, which is the documented behaviour and not something this command should paper over.
	const policy = createActionPolicy({
		mode,
		workspaceRoot: options.workspaceRoot,
		registeredCapabilities: [],
	});

	// `ActionPolicy.evaluate` takes a second argument (whether the host's call path came through a capability)
	// while `ActionGate.evaluate` takes one, so this is the adapter between them - and the loop normalises what
	// comes back (`loop-runner.ts` applies `normalizeGateDecision`, so an unrecognised shape is a block and
	// `ask` is refused rather than treated as an allow).
	const gate: ActionGate = {
		id: "action-policy",
		evaluate: (invocation: GateInvocation): GateDecision => policy.evaluate(invocation, { viaCapability: false }),
	};

	const ledger = new ExecutionLedger(options.ledgerPath);
	const decisions: { tool: string; decision: GateDecision }[] = [];
	let ledgerRecords = 0;

	const provider = createScriptedProvider({
		id: "axi-turn",
		steps:
			options.steps ??
			([
				{ kind: "tools", calls: [{ name: READ_FILE_TOOL.name, arguments: { path: join("notes", "reading.txt") } }] },
				{ kind: "text", text: "read it" },
			] satisfies readonly ScriptedStep[]),
		onExhausted: "error",
	});

	const executeTool = async (call: ToolCall): Promise<ToolResult> => {
		const requested = (call.arguments as { path?: unknown } | undefined)?.path;
		if (typeof requested !== "string" || requested === "") {
			return { content: "read_file needs a path", isError: true };
		}
		const absolute = isAbsolute(requested) ? requested : resolve(options.workspaceRoot, requested);
		const inside = relative(options.workspaceRoot, absolute);
		if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) {
			return { content: `refused: ${requested} is outside the workspace`, isError: true };
		}
		try {
			return { content: await readFile(absolute, "utf8") };
		} catch (error) {
			return { content: `unreadable: ${(error as Error).message}`, isError: true };
		}
	};

	const loop = createAgentLoop({
		provider,
		model: "scripted",
		// A work mode carries one version, not two: `effect-boundary.ts` builds this same triple the same
		// way, and a second interpretation of `version` here would make two evidence records disagree.
		mode: { id: mode.id, version: mode.governanceVersion, governanceVersion: mode.governanceVersion },
		systemPrompt: "You are a narrow turn: you may read one file inside the workspace, and nothing else.",
		tools: [READ_FILE_TOOL],
		gate,
		executeTool,
		maxTurns: options.maxTurns ?? 4,
		onGateInvoked: (invocation: GateInvocation, decision: GateDecision): void => {
			decisions.push({ tool: invocation.tool, decision });
		},
	});

	const outcome = await loop.run(options.prompt);

	// One record per refused action, in the ledger's own format rather than a second log of our own. The
	// decisions are written here rather than inside the callback because the ledger append is asynchronous and
	// the callback is not, and a record written out of order would be worse than one written late.
	for (const { tool, decision } of decisions) {
		if (decision.outcome === "allow") continue;
		await ledger.appendGateRefused({
			taskId: "axi-turn",
			stepId: `gate:${tool}`,
			// The ledger's `mode` is the interaction mode (`AgentMode` in `contracts.ts`), which is what the
			// host's call site passes too: the work mode is elsewhere in the record.
			mode: "standard",
			tool,
			action: tool,
			viaCapability: false,
			// **The class, not the gate's name.** This field is read by `countGateRefusals`, which splits it on
			// `+` and counts refusal classes, and a convergence prediction may only name a label in `GATE_LABELS`.
			// A gate id here - `action-policy` - would be a class nobody can predict, which is the defect this
			// repository already states the rule against.
			gate: gateLabelOf(decision, policy.gates),
			reason: decision.reason,
			remediation: decision.remediation,
		});
		ledgerRecords += 1;
	}

	return {
		modeId: mode.id,
		providerCalls: provider.callCount,
		outcome,
		gateInvocations: decisions.map(({ tool, decision }) => ({
			tool,
			decision: decision.outcome,
			...(decision.outcome === "allow" ? {} : { reason: decision.reason }),
		})),
		ledgerRecords,
	};
}

/**
 * `dove-pi axi-turn [mode] [prompt]` - the diagnostic front.
 *
 * It defaults to a shipped mode and to a ledger under `.dove/`, so running it from a workspace leaves exactly
 * one artefact behind, and that artefact is the turn's own record.
 */
export async function runAxiTurnCommand(args: readonly string[]): Promise<void> {
	const positional = args.filter((arg) => !arg.startsWith("-"));
	const modeName = positional[0] ?? "code-audit";
	const prompt = positional.slice(1).join(" ").trim();
	const workspaceRoot = process.cwd();
	const report = await runAxiTurn({
		workspaceRoot,
		modeName,
		ledgerPath: join(workspaceRoot, ".dove", "axi-turn.jsonl"),
		prompt: prompt === "" ? "read the notes and stop" : prompt,
	});
	console.log(formatAxiTurn(report));
}

/** The reading, as a person would want to see it after running the command. */export function formatAxiTurn(report: AxiTurnReport): string {
	const lines: string[] = [];
	lines.push(`mode: ${report.modeId}   provider calls: ${String(report.providerCalls)}   stop: ${report.outcome.stopReason.kind}`);
	lines.push(`gate consultations: ${String(report.gateInvocations.length)}`);
	for (const invocation of report.gateInvocations) {
		lines.push(`  ${invocation.decision.padEnd(5)} ${invocation.tool}${invocation.reason === undefined ? "" : ` - ${refusalReason(invocation.tool, invocation.reason)}`}`);
	}
	lines.push(`executed actions: ${String(report.outcome.executedActions)}`);
	lines.push(`blocked actions: ${String(report.outcome.blockedActions.length)}`);
	for (const blocked of report.outcome.blockedActions) {
		lines.push(`  ${blocked.tool}: ${blocked.reason}`);
	}
	lines.push(`refused by the effect boundary: ${String(report.outcome.refusedEffects.length)}`);
	lines.push(`ledger records written: ${String(report.ledgerRecords)}`);
	return lines.join("\n");
}
