import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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
}

const MAX_ARTIFACT_CHARS = 16_000;
const MAX_EVIDENCE_RECORD_CHARS = 4_000;
const MAX_EVIDENCE_FILE_CHARS = 32_000;
const MAX_EVIDENCE_RECORDS = 100;

export function nativeTaskDirectory(projectRoot: string, taskId: string): string {
	return join(resolve(projectRoot), ".dove", "tasks", taskId);
}

export function nativeTaskArtifactPath(projectRoot: string, taskId: string, artifact: NativeFormalArtifact): string {
	return join(nativeTaskDirectory(projectRoot, taskId), artifact);
}

export function nativeTaskArtifactPaths(projectRoot: string, taskId: string): readonly string[] {
	return NATIVE_FORMAL_ARTIFACTS.map((artifact) => nativeTaskArtifactPath(projectRoot, taskId, artifact));
}

export function nativeTaskFiles(projectRoot: string, goal: NativeGoal): readonly string[] {
	return [join(nativeTaskDirectory(projectRoot, goal.id), "task.json"), nativeTaskArtifactPath(projectRoot, goal.id, "prd.md"), nativeTaskArtifactPath(projectRoot, goal.id, "design.md"), nativeTaskArtifactPath(projectRoot, goal.id, "implement.md"), nativeTaskArtifactPath(projectRoot, goal.id, "acceptance.md"), join(nativeTaskDirectory(projectRoot, goal.id), "evidence.jsonl")];
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
	const manifest: NativeTaskManifest = { schemaVersion: 1, id: goal.id, title: goal.title, status: goal.status, ...(goal.phase ? { phase: goal.phase } : {}), source: goal.source ?? "native", ...(goal.sourceRef ? { sourceRef: goal.sourceRef } : {}), createdAt: goal.createdAt, updatedAt: goal.updatedAt, artifacts: NATIVE_FORMAL_ARTIFACTS };
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
	const retained: string[] = [];
	let retainedChars = 0;
	for (let index = lines.length - 1; index >= 0 && retained.length < MAX_EVIDENCE_RECORDS; index--) {
		const line = lines[index];
		if (retainedChars + line.length + 1 > MAX_EVIDENCE_FILE_CHARS) break;
		retained.unshift(line);
		retainedChars += line.length + 1;
	}
	await writeNativeArtifact(path, `${retained.join("\n")}\n`, MAX_EVIDENCE_FILE_CHARS);
	return path;
}

export async function updateNativeAcceptanceProjection(projectRoot: string, goal: NativeGoal, evidence: Readonly<Record<string, unknown>>): Promise<void> {
	const path = nativeTaskArtifactPath(projectRoot, goal.id, "acceptance.md");
	if (!existsSync(path)) return;
	const existing = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
	const base = existing.replace(/\n*## Dove Evidence Projection[\s\S]*$/i, "").trimEnd();
	const timestamp = typeof evidence.timestamp === "string" ? evidence.timestamp : new Date().toISOString();
	const phase = typeof evidence.phase === "string" ? evidence.phase : goal.phase ?? "unknown";
	const outcome = typeof evidence.outcome === "string" ? evidence.outcome : "unknown";
	const verification = typeof evidence.verification === "string" ? evidence.verification : "No verification summary recorded.";
	await writeNativeArtifact(path, `${base}\n\n## Dove Evidence Projection\n\n- ${timestamp} | phase: ${phase} | observed outcome: ${outcome}\n- ${verification}\n`);
}

async function writeNativeArtifact(path: string, content: string, maxChars = MAX_ARTIFACT_CHARS): Promise<void> {
	const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
	try {
		await writeFile(temporary, content.slice(0, maxChars), "utf8");
		await rename(temporary, path);
	} finally {
		await rm(temporary, { force: true });
	}
}
