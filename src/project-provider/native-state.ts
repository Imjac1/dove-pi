import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { TaskConvergenceSnapshot, TaskRunState } from "../core/task-convergence.ts";
import { withProjectMutationLock } from "./lock.ts";

export const NATIVE_PROJECT_STATE_VERSION = 1 as const;
export const MAX_NATIVE_GOALS = 100;
const MAX_GOAL_ID_CHARS = 160;
const MAX_GOAL_TITLE_CHARS = 240;
const MAX_GOAL_DESCRIPTION_CHARS = 2_000;
const MAX_GOAL_DETAIL_ITEMS = 20;
const MAX_GOAL_DETAIL_CHARS = 1_000;

export type NativeGoalStatus = "active" | "completed" | "archived";
export type NativeTaskPhase = "intake" | "planning" | "designed" | "implementing" | "verifying" | "completed" | "blocked" | "archived";
export type NativeTaskSource = "native" | "legacy-trellis";

export interface NativeGoalConvergenceProjection {
	readonly schemaVersion: 1;
	readonly snapshotRevision: number;
	readonly acceptanceRevision: string;
	readonly state: TaskRunState;
	readonly activeAcceptanceId?: string;
	readonly openFindingIds: readonly string[];
	readonly openBlockingFindingIds: readonly string[];
	readonly nextAction?: string;
	readonly stateReason?: string;
	readonly unblockCondition?: string;
}

export interface NativeGoal {
	readonly id: string;
	readonly title: string;
	readonly description?: string;
	readonly status: NativeGoalStatus;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly nextStep?: string;
	readonly decisions: readonly string[];
	readonly verification: readonly string[];
	readonly formal?: boolean;
	readonly phase?: NativeTaskPhase;
	readonly source?: NativeTaskSource;
	readonly sourceRef?: string;
	readonly convergence?: NativeGoalConvergenceProjection;
}

export interface NativeProjectState {
	readonly schemaVersion: typeof NATIVE_PROJECT_STATE_VERSION;
	readonly revision: number;
	readonly currentGoalId?: string;
	readonly goals: readonly NativeGoal[];
}

export type NativeStateRead =
	| { readonly kind: "missing"; readonly state: NativeProjectState }
	| { readonly kind: "valid"; readonly state: NativeProjectState }
	| { readonly kind: "invalid"; readonly state: NativeProjectState; readonly issue: string };

export function nativeProjectStatePath(projectRoot: string): string {
	return join(resolve(projectRoot), ".dove", "state.json");
}

export function emptyNativeProjectState(): NativeProjectState {
	return Object.freeze({ schemaVersion: NATIVE_PROJECT_STATE_VERSION, revision: 0, goals: [] });
}

export function readNativeProjectState(projectRoot: string): NativeStateRead {
	const path = nativeProjectStatePath(projectRoot);
	if (!existsSync(path)) return { kind: "missing", state: emptyNativeProjectState() };
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		const state = normalizeNativeProjectState(parsed);
		return state ? { kind: "valid", state } : { kind: "invalid", state: emptyNativeProjectState(), issue: "Dove native project state is malformed." };
	} catch (error) {
		return { kind: "invalid", state: emptyNativeProjectState(), issue: `Dove native project state could not be read: ${error instanceof Error ? error.message : String(error)}` };
	}
}

export async function writeNativeProjectState(projectRoot: string, state: NativeProjectState): Promise<string> {
	const path = nativeProjectStatePath(projectRoot);
	await mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
	try {
		await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
		await rename(temporary, path);
	} finally {
		await rm(temporary, { force: true });
	}
	return path;
}

export async function initializeNativeProject(projectRoot: string): Promise<string> {
	return withProjectMutationLock(projectRoot, async () => {
		const read = readNativeProjectState(projectRoot);
		if (read.kind === "invalid") throw new Error(read.issue);
		if (read.kind === "valid") return nativeProjectStatePath(projectRoot);
		return writeNativeProjectState(projectRoot, emptyNativeProjectState());
	});
}

function normalizeNativeProjectState(value: unknown): NativeProjectState | undefined {
	if (!isRecord(value) || value.schemaVersion !== NATIVE_PROJECT_STATE_VERSION || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !Array.isArray(value.goals) || value.goals.length > MAX_NATIVE_GOALS) return undefined;
	const goals = value.goals.map(normalizeGoal);
	if (goals.some((goal) => goal === undefined)) return undefined;
	const normalizedGoals = goals as NativeGoal[];
	const ids = new Set(normalizedGoals.map((goal) => goal.id));
	if (ids.size !== normalizedGoals.length) return undefined;
	const hasCurrentGoalId = Object.prototype.hasOwnProperty.call(value, "currentGoalId");
	if (hasCurrentGoalId && (typeof value.currentGoalId !== "string" || !ids.has(value.currentGoalId))) return undefined;
	const currentGoalId = typeof value.currentGoalId === "string" ? value.currentGoalId : undefined;
	if (currentGoalId && normalizedGoals.find((goal) => goal.id === currentGoalId)?.status !== "active") return undefined;
	return Object.freeze({
		schemaVersion: NATIVE_PROJECT_STATE_VERSION,
		revision: Number(value.revision),
		...(currentGoalId ? { currentGoalId } : {}),
		goals: Object.freeze(normalizedGoals),
	});
}

function normalizeGoal(value: unknown): NativeGoal | undefined {
	if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim() || value.id.length > MAX_GOAL_ID_CHARS || typeof value.title !== "string" || !value.title.trim() || value.title.length > MAX_GOAL_TITLE_CHARS) return undefined;
	if (value.status !== "active" && value.status !== "completed" && value.status !== "archived") return undefined;
	if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") return undefined;
	if (!isBoundedStringArray(value.decisions) || !isBoundedStringArray(value.verification)) return undefined;
	if (value.description !== undefined && (typeof value.description !== "string" || value.description.length > MAX_GOAL_DESCRIPTION_CHARS)) return undefined;
	if (value.nextStep !== undefined && (typeof value.nextStep !== "string" || value.nextStep.length > MAX_GOAL_DETAIL_CHARS)) return undefined;
	if (value.formal !== undefined && typeof value.formal !== "boolean") return undefined;
	if (value.phase !== undefined && !isNativeTaskPhase(value.phase)) return undefined;
	if (value.source !== undefined && value.source !== "native" && value.source !== "legacy-trellis") return undefined;
	if (value.sourceRef !== undefined && (typeof value.sourceRef !== "string" || value.sourceRef.length > MAX_GOAL_DESCRIPTION_CHARS)) return undefined;
	const convergence = value.convergence === undefined ? undefined : normalizeConvergenceProjection(value.convergence);
	if (value.convergence !== undefined && !convergence) return undefined;
	return Object.freeze({
		id: value.id,
		title: value.title.trim(),
		...(typeof value.description === "string" && value.description.trim() ? { description: value.description.trim() } : {}),
		status: value.status,
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
		...(typeof value.nextStep === "string" && value.nextStep.trim() ? { nextStep: value.nextStep.trim() } : {}),
		decisions: Object.freeze([...value.decisions]),
		verification: Object.freeze([...value.verification]),
		...(value.formal === true ? { formal: true } : {}),
		...(value.phase === undefined ? {} : { phase: value.phase }),
		...(value.source === undefined ? {} : { source: value.source }),
		...(typeof value.sourceRef === "string" && value.sourceRef.trim() ? { sourceRef: value.sourceRef.trim() } : {}),
		...(convergence ? { convergence } : {}),
	});
}

export function projectNativeGoalConvergence(snapshot: TaskConvergenceSnapshot): NativeGoalConvergenceProjection {
	const activeAcceptanceId = snapshot.checkpoint?.nextAcceptanceId
		?? snapshot.correctiveAction?.acceptanceId
		?? snapshot.criteria.find((criterion) => criterion.status !== "passed" && criterion.status !== "waived")?.id;
	const nextAction = snapshot.checkpoint?.nextAction ?? snapshot.correctiveAction?.nextAction;
	const openFindings = snapshot.findings.filter((finding) => finding.open);
	const stateReason = openFindings.find((finding) => finding.kind !== "follow_up")?.summary
		?? (snapshot.state === "checkpointed" ? "Task run checkpointed for resumable work." : undefined)
		?? snapshot.checkpoint?.unblockCondition;
	return Object.freeze({
		schemaVersion: 1,
		snapshotRevision: snapshot.revision,
		acceptanceRevision: snapshot.acceptanceRevision,
		state: snapshot.state,
		...(activeAcceptanceId ? { activeAcceptanceId } : {}),
		openFindingIds: Object.freeze(openFindings.map((finding) => finding.id)),
		openBlockingFindingIds: Object.freeze(openFindings.filter((finding) => finding.kind === "blocking" || finding.kind === "regression").map((finding) => finding.id)),
		...(nextAction ? { nextAction: nextAction.slice(0, MAX_GOAL_DETAIL_CHARS) } : {}),
		...(stateReason ? { stateReason: stateReason.slice(0, MAX_GOAL_DETAIL_CHARS) } : {}),
		...(snapshot.checkpoint?.unblockCondition ? { unblockCondition: snapshot.checkpoint.unblockCondition.slice(0, MAX_GOAL_DETAIL_CHARS) } : {}),
	});
}

function normalizeConvergenceProjection(value: unknown): NativeGoalConvergenceProjection | undefined {
	if (!isRecord(value) || value.schemaVersion !== 1 || !Number.isSafeInteger(value.snapshotRevision) || Number(value.snapshotRevision) < 1) return undefined;
	if (typeof value.acceptanceRevision !== "string" || !/^[a-f0-9]{64}$/.test(value.acceptanceRevision)) return undefined;
	if (!isTaskRunState(value.state)) return undefined;
	if (value.activeAcceptanceId !== undefined && (typeof value.activeAcceptanceId !== "string" || !/^AC-[A-Z0-9][A-Z0-9_-]{0,31}$/.test(value.activeAcceptanceId))) return undefined;
	const openFindingIds = value.openFindingIds;
	const openBlockingFindingIds = value.openBlockingFindingIds;
	if (!isBoundedIdArray(openFindingIds) || !isBoundedIdArray(openBlockingFindingIds)) return undefined;
	if (!openBlockingFindingIds.every((id) => openFindingIds.includes(id))) return undefined;
	if (value.nextAction !== undefined && (typeof value.nextAction !== "string" || !value.nextAction.trim() || value.nextAction.length > MAX_GOAL_DETAIL_CHARS)) return undefined;
	if (value.stateReason !== undefined && (typeof value.stateReason !== "string" || !value.stateReason.trim() || value.stateReason.length > MAX_GOAL_DETAIL_CHARS)) return undefined;
	if (value.unblockCondition !== undefined && (typeof value.unblockCondition !== "string" || !value.unblockCondition.trim() || value.unblockCondition.length > MAX_GOAL_DETAIL_CHARS)) return undefined;
	return Object.freeze({
		schemaVersion: 1,
		snapshotRevision: Number(value.snapshotRevision),
		acceptanceRevision: value.acceptanceRevision,
		state: value.state,
		...(typeof value.activeAcceptanceId === "string" ? { activeAcceptanceId: value.activeAcceptanceId } : {}),
		openFindingIds: Object.freeze([...openFindingIds]),
		openBlockingFindingIds: Object.freeze([...openBlockingFindingIds]),
		...(typeof value.nextAction === "string" ? { nextAction: value.nextAction.trim() } : {}),
		...(typeof value.stateReason === "string" ? { stateReason: value.stateReason.trim() } : {}),
		...(typeof value.unblockCondition === "string" ? { unblockCondition: value.unblockCondition.trim() } : {}),
	});
}

function isBoundedIdArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.length <= 100 && value.every((id) => typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) && new Set(value).size === value.length;
}

function isNativeTaskPhase(value: unknown): value is NativeTaskPhase {
	return value === "intake" || value === "planning" || value === "designed" || value === "implementing" || value === "verifying" || value === "completed" || value === "blocked" || value === "archived";
}

function isTaskRunState(value: unknown): value is TaskRunState {
	return value === "working" || value === "verifying" || value === "ready_to_finish" || value === "checkpointed" || value === "blocked";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.length <= MAX_GOAL_DETAIL_ITEMS && value.every((item) => typeof item === "string" && item.length <= MAX_GOAL_DETAIL_CHARS);
}
