import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { withProjectMutationLock } from "./lock.ts";

export const NATIVE_SESSION_SCHEMA_VERSION = 1 as const;
const MAX_SESSION_TITLE_CHARS = 240;
const MAX_SESSION_SUMMARY_CHARS = 4_000;
const MAX_SESSION_DETAIL_CHARS = 1_000;
const MAX_SESSION_DETAILS = 20;
const MAX_SESSION_RECORDS = 100;
const MAX_SESSION_FILE_CHARS = 64_000;

export interface NativeSessionRecord {
	readonly schemaVersion: typeof NATIVE_SESSION_SCHEMA_VERSION;
	readonly id: string;
	readonly recordedAt: string;
	readonly title: string;
	readonly summary?: string;
	readonly changes: readonly string[];
	readonly tests: readonly string[];
	readonly nextSteps: readonly string[];
	readonly taskId?: string;
}

export interface NativeSessionInput {
	readonly title: string;
	readonly summary?: string;
	readonly changes?: readonly string[];
	readonly tests?: readonly string[];
	readonly nextSteps?: readonly string[];
	readonly taskId?: string;
}

export function nativeSessionPath(projectRoot: string): string {
	return join(resolve(projectRoot), ".dove", "sessions.jsonl");
}

export async function appendNativeSession(projectRoot: string, input: NativeSessionInput): Promise<NativeSessionRecord> {
	const title = input.title.trim();
	if (!title) throw new Error("session record requires a title.");
	if (title.length > MAX_SESSION_TITLE_CHARS) throw new Error("session title exceeds 240 characters.");
	const record: NativeSessionRecord = {
		schemaVersion: NATIVE_SESSION_SCHEMA_VERSION,
		id: `session-${randomUUID()}`,
		recordedAt: new Date().toISOString(),
		title,
		...(input.summary?.trim() ? { summary: input.summary.trim().slice(0, MAX_SESSION_SUMMARY_CHARS) } : {}),
		changes: normalizeDetails(input.changes),
		tests: normalizeDetails(input.tests),
		nextSteps: normalizeDetails(input.nextSteps),
		...(input.taskId?.trim() ? { taskId: input.taskId.trim().slice(0, 320) } : {}),
	};
	await withProjectMutationLock(projectRoot, async () => {
		const path = nativeSessionPath(projectRoot);
		await mkdir(dirname(path), { recursive: true });
		const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
		const lines = [...existing.split(/\r?\n/).filter(Boolean), JSON.stringify(record)];
		const retained: string[] = [];
		let retainedChars = 0;
		for (let index = lines.length - 1; index >= 0 && retained.length < MAX_SESSION_RECORDS; index--) {
			const line = lines[index];
			if (retainedChars + line.length + 1 > MAX_SESSION_FILE_CHARS) break;
			retained.unshift(line);
			retainedChars += line.length + 1;
		}
		await writeFile(path, `${retained.join("\n")}\n`, "utf8");
	});
	return record;
}

export function readNativeSessions(projectRoot: string): readonly NativeSessionRecord[] {
	const path = nativeSessionPath(projectRoot);
	if (!existsSync(path)) return [];
	try {
		return readFileSync(path, "utf8")
			.split(/\r?\n/)
			.filter(Boolean)
			.slice(-MAX_SESSION_RECORDS)
			.flatMap((line) => {
				try {
					const value = JSON.parse(line) as Partial<NativeSessionRecord>;
					return value.schemaVersion === NATIVE_SESSION_SCHEMA_VERSION && typeof value.id === "string" && typeof value.recordedAt === "string" && typeof value.title === "string"
						? [{ ...value, changes: Array.isArray(value.changes) ? value.changes : [], tests: Array.isArray(value.tests) ? value.tests : [], nextSteps: Array.isArray(value.nextSteps) ? value.nextSteps : [] } as NativeSessionRecord]
						: [];
				} catch {
					return [];
				}
			});
	} catch {
		return [];
	}
}

function normalizeDetails(values: readonly string[] | undefined): readonly string[] {
	return (values ?? []).map((value) => value.trim().slice(0, MAX_SESSION_DETAIL_CHARS)).filter(Boolean).slice(0, MAX_SESSION_DETAILS);
}
