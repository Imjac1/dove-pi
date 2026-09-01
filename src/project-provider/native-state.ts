import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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
	});
}

function isNativeTaskPhase(value: unknown): value is NativeTaskPhase {
	return value === "intake" || value === "planning" || value === "designed" || value === "implementing" || value === "verifying" || value === "completed" || value === "blocked" || value === "archived";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.length <= MAX_GOAL_DETAIL_ITEMS && value.every((item) => typeof item === "string" && item.length <= MAX_GOAL_DETAIL_CHARS);
}
