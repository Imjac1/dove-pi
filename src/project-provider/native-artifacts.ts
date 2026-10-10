import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { decodeTaskConvergenceSnapshot, type TaskConvergenceSnapshot } from "../core/task-convergence.ts";
import type { ProjectTaskConvergenceRead } from "./contracts.ts";
import type { NativeGoal, NativeTaskSource } from "./native-state.ts";

export const NATIVE_FORMAL_ARTIFACTS = ["prd.md", "design.md", "implement.md", "acceptance.md"] as const;
export type NativeFormalArtifact = (typeof NATIVE_FORMAL_ARTIFACTS)[number];
export interface NativeTaskManifest {
	readonly schemaVersion: 1;
	readonly id: string;
	readonly title: string;
	readonly status: NativeGoal["status"];
	readonly phase?: NativeGoal["phase"];
	readonly source: NativeTaskSource;
	readonly sourceRef?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly artifacts: readonly NativeFormalArtifact[];
	readonly convergence?: NativeGoal["convergence"];
}

const MAX_ARTIFACT_CHARS = 16_000;
const MAX_EVIDENCE_RECORD_CHARS = 4_000;
const MAX_EVIDENCE_FILE_CHARS = 32_000;
const MAX_EVIDENCE_RECORDS = 100;
const MAX_CONVERGENCE_FILE_CHARS = 2_000_000;
const MAX_CONVERGENCE_FILE_BYTES = 6_000_000;

/**
 * The generated section of `acceptance.md`, delimited by markers of its own rather than by its heading.
 *
 * A heading is a string a person can write. The first version of this section was found again by matching its heading
 * to the end of the file, so a document whose own prose contained that heading had everything after it deleted by the
 * next progress record - and nothing said so. The markers are what makes "the section this module wrote" a fact rather
 * than a guess.
 */
const PROJECTION_HEADING = "## Dove Evidence Projection";
const PROJECTION_START = "<!-- dove:evidence-projection:start -->";
const PROJECTION_END = "<!-- dove:evidence-projection:end -->";
const LEGACY_PROJECTION_TAIL = /\n*## Dove Evidence Projection\n+- \d{4}-\d{2}-\d{2}T[^\n]*\n[\s\S]*$/u;

export function nativeTaskDirectory(projectRoot: string, taskId: string): string {
	if (!taskId.trim() || taskId === "." || taskId === ".." || /[\\/\0]/.test(taskId)) throw new Error("Native formal task ID cannot be used as a task directory name.");
	return join(resolve(projectRoot), ".dove", "tasks", taskId);
}

export function nativeTaskArtifactPath(projectRoot: string, taskId: string, artifact: NativeFormalArtifact): string {
	return join(nativeTaskDirectory(projectRoot, taskId), artifact);
}

export function nativeTaskArtifactPaths(projectRoot: string, taskId: string): readonly string[] {
	return NATIVE_FORMAL_ARTIFACTS.map((artifact) => nativeTaskArtifactPath(projectRoot, taskId, artifact));
}

export function nativeTaskConvergencePath(projectRoot: string, taskId: string): string {
	return join(nativeTaskDirectory(projectRoot, taskId), "convergence.json");
}

export function nativeTaskFiles(projectRoot: string, goal: NativeGoal): readonly string[] {
	const convergencePath = nativeTaskConvergencePath(projectRoot, goal.id);
	return [join(nativeTaskDirectory(projectRoot, goal.id), "task.json"), nativeTaskArtifactPath(projectRoot, goal.id, "prd.md"), nativeTaskArtifactPath(projectRoot, goal.id, "design.md"), nativeTaskArtifactPath(projectRoot, goal.id, "implement.md"), nativeTaskArtifactPath(projectRoot, goal.id, "acceptance.md"), join(nativeTaskDirectory(projectRoot, goal.id), "evidence.jsonl"), ...(existsSync(convergencePath) ? [convergencePath] : [])];
}

export function readNativeTaskConvergence(projectRoot: string, taskId: string): ProjectTaskConvergenceRead {
	const path = nativeTaskConvergencePath(projectRoot, taskId);
	if (!existsSync(path)) return { kind: "missing" };
	try {
		if (statSync(path).size > MAX_CONVERGENCE_FILE_BYTES) return { kind: "invalid", issue: "Dove task convergence state exceeds its size bound." };
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		return { kind: "valid", snapshot: decodeTaskConvergenceSnapshot(parsed) };
	} catch (error) {
		return { kind: "invalid", issue: `Dove task convergence state could not be read: ${error instanceof Error ? error.message : String(error)}` };
	}
}

/** The provider owns the project mutation lock around this atomic file replacement. */
export async function writeNativeTaskConvergence(projectRoot: string, taskId: string, snapshot: TaskConvergenceSnapshot): Promise<string> {
	const path = nativeTaskConvergencePath(projectRoot, taskId);
	const serialized = `${JSON.stringify(decodeTaskConvergenceSnapshot(snapshot), null, 2)}\n`;
	if (serialized.length > MAX_CONVERGENCE_FILE_CHARS) throw new Error("Dove task convergence state exceeds its size bound.");
	await mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
	try {
		await writeFile(temporary, serialized, "utf8");
		await rename(temporary, path);
	} finally {
		await rm(temporary, { force: true });
	}
	return path;
}

export function readNativeFormalDocuments(projectRoot: string, goal: NativeGoal): readonly { path: string; content: string; sourceRef: string }[] {
	return NATIVE_FORMAL_ARTIFACTS.flatMap((artifact) => {
		const path = nativeTaskArtifactPath(projectRoot, goal.id, artifact);
		if (!existsSync(path)) return [];
		try {
			return [{ path, content: readFileSync(path, "utf8").slice(0, MAX_ARTIFACT_CHARS), sourceRef: `native:${goal.id}:${artifact}` }];
		} catch {
			return [];
		}
	});
}

export async function ensureNativeFormalArtifacts(projectRoot: string, goal: NativeGoal, importedArtifacts: Partial<Record<NativeFormalArtifact, string>> = {}): Promise<void> {
	const directory = nativeTaskDirectory(projectRoot, goal.id);
	await mkdir(directory, { recursive: true });
	await writeNativeTaskManifest(projectRoot, goal);
	const documents: Record<NativeFormalArtifact, string> = {
		"prd.md": `# ${goal.title}\n\n## Goal\n\n${goal.description ?? "Describe the user outcome and why it matters."}\n\n## Scope\n\n- Define the smallest useful scope.\n\n## Acceptance Criteria\n\n- [ ] Add observable acceptance criteria.\n`,
		"design.md": `# Design: ${goal.title}\n\n## Boundary\n\nDescribe the affected modules and ownership boundaries.\n\n## Data Flow\n\nDescribe the important inputs, outputs, and state transitions.\n\n## Risks\n\nRecord compatibility, rollout, and rollback considerations.\n`,
		"implement.md": `# Implementation Plan: ${goal.title}\n\n## Steps\n\n- [ ] Inspect the affected code and existing tests.\n- [ ] Implement the smallest change that satisfies the PRD.\n- [ ] Run focused validation, then the relevant broader checks.\n\n## Evidence\n\nRecord commands and results in acceptance.md.\n`,
		"acceptance.md": `# Acceptance: ${goal.title}\n\n## Criteria\n\n- [ ] Pending: define and verify the acceptance criteria from prd.md.\n\n## Evidence\n\nNo verification has been recorded yet.\n`,
	};
	for (const artifact of NATIVE_FORMAL_ARTIFACTS) {
		const path = nativeTaskArtifactPath(projectRoot, goal.id, artifact);
		if (!existsSync(path)) await writeNativeArtifact(path, importedArtifacts[artifact] ?? documents[artifact]);
	}
}

export async function writeNativeTaskManifest(projectRoot: string, goal: NativeGoal): Promise<void> {
	const manifest: NativeTaskManifest = { schemaVersion: 1, id: goal.id, title: goal.title, status: goal.status, ...(goal.phase ? { phase: goal.phase } : {}), source: goal.source ?? "native", ...(goal.sourceRef ? { sourceRef: goal.sourceRef } : {}), createdAt: goal.createdAt, updatedAt: goal.updatedAt, artifacts: NATIVE_FORMAL_ARTIFACTS, ...(goal.convergence ? { convergence: goal.convergence } : {}) };
	await writeNativeArtifact(join(nativeTaskDirectory(projectRoot, goal.id), "task.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function appendNativeTaskEvidence(projectRoot: string, goalId: string, evidence: Readonly<Record<string, unknown>>): Promise<string> {
	const path = join(nativeTaskDirectory(projectRoot, goalId), "evidence.jsonl");
	await mkdir(dirname(path), { recursive: true });
	const serialized = JSON.stringify(evidence);
	const record = serialized.length <= MAX_EVIDENCE_RECORD_CHARS
		? { schemaVersion: 1, timestamp: new Date().toISOString(), ...evidence }
		: { schemaVersion: 1, timestamp: new Date().toISOString(), truncated: true, details: serialized.slice(0, MAX_EVIDENCE_RECORD_CHARS - 80) };
	const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
	const lines = [...existing.split(/\r?\n/).filter(Boolean), JSON.stringify(record)];
	// Written without the artifact bound: the selection below already decided the content, and slicing JSONL afterwards
	// would leave a half-written line rather than a smaller file.
	await writeNativeArtifact(path, `${selectEvidenceRecords(lines).join("\n")}\n`, null);
	return path;
}

/**
 * Which evidence records survive, and why the rule has two halves.
 *
 * **The newest records, bounded by count and characters** - what a reader wants when they ask what happened lately.
 *
 * **Plus one record per acceptance id the newest window would otherwise drop.** `findUnsupportedCriteria` asks whether a
 * ticked criterion is named anywhere in this file, so a criterion whose only mention aged out of the window read as
 * unsupported *although it had been supported* - and a check that starts reporting backed work as unbacked whenever a
 * task runs long enough is a check people stop reading, which is the failure that check exists to prevent. The
 * comparison is on the id, so the id is reserved for.
 *
 * The count bound is the hard one: the reservation is computed first, so reserved and newest records together cannot
 * exceed it. The character bound applies to the newest-first fill alone, because a reservation that did not fit would
 * defeat the rule it exists for, and the count bound already caps how large the file can get.
 */
function selectEvidenceRecords(lines: readonly string[]): readonly string[] {
	const reserved = new Set<number>();
	const reservedIds = new Set<string>();
	for (let index = lines.length - 1; index >= 0 && reserved.size < MAX_EVIDENCE_RECORDS; index--) {
		const id = acceptanceIdOf(lines[index]!);
		if (id === undefined || reservedIds.has(id)) continue;
		reservedIds.add(id);
		reserved.add(index);
	}
	const selected = new Set<number>(reserved);
	let selectedChars = [...reserved].reduce((total, index) => total + lines[index]!.length + 1, 0);
	for (let index = lines.length - 1; index >= 0 && selected.size < MAX_EVIDENCE_RECORDS; index--) {
		if (selected.has(index)) continue;
		const length = lines[index]!.length + 1;
		if (selectedChars + length > MAX_EVIDENCE_FILE_CHARS) break;
		selected.add(index);
		selectedChars += length;
	}
	return [...selected].sort((left, right) => left - right).map((index) => lines[index]!);
}

function acceptanceIdOf(line: string): string | undefined {
	return /"acceptanceId"\s*:\s*"([^"]+)"/u.exec(line)?.[1];
}

export async function updateNativeAcceptanceProjection(projectRoot: string, goal: NativeGoal, evidence: Readonly<Record<string, unknown>>): Promise<void> {
	const path = nativeTaskArtifactPath(projectRoot, goal.id, "acceptance.md");
	if (!existsSync(path)) return;
	const existing = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
	const base = withoutEvidenceProjection(existing);
	const timestamp = typeof evidence.timestamp === "string" ? evidence.timestamp : new Date().toISOString();
	const phase = typeof evidence.phase === "string" ? evidence.phase : goal.phase ?? "unknown";
	const outcome = typeof evidence.outcome === "string" ? evidence.outcome : "unknown";
	const verification = typeof evidence.verification === "string" ? evidence.verification : "No verification summary recorded.";
	// **Two ways this one call used to delete a person's writing, both measured.**
	//
	// The write went through `writeNativeArtifact`'s artifact ceiling, so a 20,056-character `acceptance.md` came back
	// as 16,000: the file's own criteria, cut off by an action named "record progress". The artifact bound belongs where
	// a document is first generated from a template; rewriting one section this module owns is no reason to shorten the
	// rest of the file, so the bound is passed as `null` here and stays where it was.
	//
	// And the section was found again by matching its heading to the end of the file. A heading is a string a person may
	// write, and everything after theirs went with it. The markers are the fix; `withoutEvidenceProjection` migrates a
	// document written before them exactly once, by the trailing shape this module used to produce.
	await writeNativeArtifact(path, `${base}\n\n${PROJECTION_START}\n${PROJECTION_HEADING}\n\n- ${timestamp} | phase: ${phase} | observed outcome: ${outcome}\n- ${verification}\n${PROJECTION_END}\n`, null);
}

/** The document without the generated section: by its markers when they are there, by the old trailing shape when they are not. */
function withoutEvidenceProjection(existing: string): string {
	const marked = existing.indexOf(PROJECTION_START);
	if (marked >= 0) return existing.slice(0, marked).trimEnd();
	return existing.replace(LEGACY_PROJECTION_TAIL, "").trimEnd();
}

/**
 * Write one artifact through a temporary file and a rename.
 *
 * `maxChars` bounds the payload, and `null` means the caller owns the document's length rather than this module: that is
 * the case for a rewrite of a section inside a file a person maintains, where a bound would silently shorten their text.
 */
async function writeNativeArtifact(path: string, content: string, maxChars: number | null = MAX_ARTIFACT_CHARS): Promise<void> {
	const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
	try {
		await writeFile(temporary, maxChars === null ? content : content.slice(0, maxChars), "utf8");
		await rename(temporary, path);
	} finally {
		await rm(temporary, { force: true });
	}
}
