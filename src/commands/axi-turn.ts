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
 * `createScriptedProvider`, and the only tool reads one file inside the workspace. Writing and the improvement
 * loop belong to later milestones; this one exists to show that every proposed action passes the gate *by
 * construction* and that the turn leaves a ledger behind.
 *
 * **Isolation is no longer one of the deferred ones.** When a caller supplies `boundary`, this command is also the
 * consumer that `tests/harness-reachability.test.ts` said would arrive: it sets and re-reads the two ACL
 * invariants, verifies the restricted token's list, and starts the improver's work through `src/jailer/`'s helper -
 * which is why the six `src/jailer/` entries left the allow-list. Something reaches them now rather than intending to.
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
import { ensureBoundary, launchJailed, probeToken, type LaunchRequest } from "../jailer/index.ts";
import type { BoundarySpec, SelfCheck } from "../jailer/types.ts";

/**
 * **The boundary, as three readings the host refuses to run without.**
 *
 * The mechanism is `src/jailer/` - `ensureBoundary` sets the two ACL invariants and *re-reads* them, `probeToken`
 * creates the restricted token and *verifies* its restricting list, `launchJailed` starts the child under that
 * token. This port is what a caller asks for, and it exists for one reason beyond naming: **a case must be able to
 * drive a boundary that is not as declared**, and the real one can only be made wrong by changing the machine's
 * ACLs. So the readings travel as narrow shapes here, and the real implementation is the default.
 */
export interface BoundaryPort {
	readonly ensure: (spec: BoundarySpec) => { readonly violations: readonly string[]; readonly missing: readonly string[] };
	readonly probe: (spec: BoundarySpec) => { readonly selfCheck: SelfCheck };
	readonly launch: (spec: BoundarySpec, request: LaunchRequest) => {
		readonly selfCheck: SelfCheck;
		readonly exitCode: number;
		/**
		 * **The field that keeps "the child was refused" apart from "the child never ran."** Zero on success; a Win32
		 * error code when `CreateProcessAsUser` refused. A port that dropped it would make a launch that failed in
		 * `PATH` lookup read exactly like a blocked write, which is the confusion this whole reading exists to end -
		 * measured: the first run of this host passed `echo probe> ...`, which is a `cmd` builtin rather than an
		 * executable, and the dropped field hid that behind `exitCode: -1` on both sides.
		 */
		readonly createProcessError: number;
		/** The helper's own diagnostic text, carried through rather than summarised. */
		readonly diag: string;
	};
}

/** The default port: the real mechanism, unchanged. */
export const realBoundaryPort: BoundaryPort = {
	ensure: (spec) => {
		const report = ensureBoundary(spec);
		return { violations: report.violations, missing: report.missing };
	},
	probe: (spec) => ({ selfCheck: probeToken(spec).selfCheck }),
	launch: (spec, request) => {
		const report = launchJailed(spec, request);
		return { selfCheck: report.selfCheck, exitCode: report.exitCode, createProcessError: report.createProcessError, diag: report.diag };
	},
};

/** What a caller must decide for a turn to run under the boundary, and what it wants run there. */
export interface BoundaryRequest {
	/**
	 * The paths the improver must not reach (no grant for the work SID) and the ones it works in (one,
	 * explicitly) - `BoundarySpec`'s own two invariants. **The lists are the caller's policy**, not this
	 * command's: which side is held out is a decision about the project, not about the turn.
	 */
	readonly spec: BoundarySpec;
	/** The command the constrained child runs. `cmd.exe`-style, as the helper takes it. */
	readonly command: string;
	readonly cwd?: string;
	readonly port?: BoundaryPort;
}

/** The boundary's readings for one turn, recorded so a reader can tell "refused" from "never asked". */
export interface BoundaryReading {
	readonly aclInvariants: "as-declared";
	readonly tokenSelfCheck: SelfCheck;
	/** The child's own exit code. **A non-zero code is not a failure here**: a blocked write is criterion 1 succeeding. */
	readonly childExitCode: number;
	/** 0 when the constrained child was actually created. Non-zero is refused, not recorded - see the startup. */
	readonly childCreateProcessError: number;
	readonly childDiag: string;
}

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
	/**
	 * **When present, this turn runs under the Plane B boundary** - established first, and the improver's work
	 * dispatched through the helper rather than in this process. Absent, this stays the diagnostic turn it was:
	 * no ACL work, no child, one read. The two are not a mode switch for convenience; setting ACLs is a change to
	 * the machine, and a turn that only reads the notes has no business making one.
	 */
	readonly boundary?: BoundaryRequest;
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
	/** Present exactly when this turn ran under the boundary - absent is "never asked", not "held". */
	readonly boundary?: BoundaryReading;
}

function refusalReason(tool: string, reason: string | undefined): string {
	return reason === undefined || reason === "" ? tool : reason;
}

export async function runAxiTurn(options: AxiTurnOptions): Promise<AxiTurnReport> {
	// **The boundary is established before anything else, and it refuses rather than warns.** A turn that
	// dispatches work under a boundary it could not establish is a turn whose containment is a claim - the shape
	// this plane exists to end - so each of the three readings is checked here and a failure stops the turn
	// instead of being reported next to it. The order is the one the mechanism asks for: set and re-read the ACL
	// invariants, verify the token's restricting list, and only then start the child under it.
	let boundary: BoundaryReading | undefined;
	const ledger = new ExecutionLedger(options.ledgerPath);
	if (options.boundary !== undefined) {
		const boundaryStartedAt = Date.now();
		const port = options.boundary.port ?? realBoundaryPort;
		const { spec } = options.boundary;
		const acl = port.ensure(spec);
		if (acl.violations.length > 0 || acl.missing.length > 0) {
			throw new Error(
				`refusing to start: the boundary is not as declared (${String(acl.violations.length)} violation(s), ${String(acl.missing.length)} missing path(s))`,
			);
		}
		const token = port.probe(spec);
		if (token.selfCheck !== "pass") {
			throw new Error(`refusing to start: the restricted token self-check reported '${token.selfCheck}'`);
		}
		const launched = port.launch(spec, {
			command: options.boundary.command,
			cwd: options.boundary.cwd ?? options.workspaceRoot,
			tag: "axi-turn",
		});
		if (launched.selfCheck !== "pass") {
			throw new Error(`refusing to start: the launch self-check reported '${launched.selfCheck}'`);
		}
		// **A child that never ran is not a boundary that held.** `CreateProcessAsUser` refusing is a fact about the
		// command or the token rather than about the held-out side, and reporting it as `exitCode: -1` next to
		// "as-declared" would let a turn claim containment it never exercised. So it refuses, and it names the code
		// and the helper's own diagnostic rather than a summary of them.
		if (launched.createProcessError !== 0) {
			throw new Error(
				`refusing to start: the constrained child was not created (Win32 error ${String(launched.createProcessError)})${launched.diag === "" ? "" : `: ${launched.diag}`}`,
			);
		}
		// The child's exit code is recorded rather than judged: a blocked write is criterion 1 *succeeding*, and a
		// caller that read a non-zero code as "the turn failed" would turn every correct refusal into a failure.
		boundary = {
			aclInvariants: "as-declared",
			tokenSelfCheck: token.selfCheck,
			childExitCode: launched.exitCode,
			childCreateProcessError: launched.createProcessError,
			childDiag: launched.diag,
		};
		// **The readings go to the ledger, not only to the report.** A report is this call's return value and lives
		// until a person scrolls past it; the ledger is the record a later reader starts from, and "was a boundary
		// established for that turn, and what did it report" has to be answerable from the file rather than from a
		// transcript. The existing `request-prepare` phase carries it - establishing the boundary *is* preparation,
		// and `metrics` takes numbers and booleans, which is exactly what these codes are - so no record kind is
		// invented for it: the kind set is a closed vocabulary, and a new kind would owe a writer, a reader and a case.
		await ledger.appendRuntimePhase({
			taskId: "axi-turn",
			stepId: "boundary",
			mode: "standard",
			phase: "request-prepare",
			name: "plane-b-boundary",
			durationMs: Date.now() - boundaryStartedAt,
			metrics: {
				aclInvariantsAsDeclared: true,
				tokenSelfCheckPass: token.selfCheck === "pass",
				childExitCode: launched.exitCode,
				childCreateProcessError: launched.createProcessError,
			},
		});
	}

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
		// **The mode's own turn budget, when it declares one.** This is the loop the runtime owns, so it is the one a
		// mode's `session.budget.turns` can actually bound; the Pi host's loop belongs to the host, which is recorded
		// as a limitation rather than papered over. `options.maxTurns` still wins, because a caller that asked for a
		// specific bound is asking about this run rather than about the mode.
		maxTurns: options.maxTurns ?? mode.sessionTurns ?? 4,
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
		...(boundary === undefined ? {} : { boundary }),
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
