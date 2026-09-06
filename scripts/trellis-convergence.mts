import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { decodeTaskConvergenceSnapshot, replayTaskConvergence, reduceTaskConvergence, type TaskConvergenceSnapshot } from "../src/core/task-convergence.ts";

type TraceFixture = {
	readonly schemaVersion: number;
	readonly traces: readonly { readonly name: string; readonly steps: readonly { readonly event: unknown; readonly expected: unknown }[] }[];
};

function usage(): never {
	throw new Error("Usage: trellis-convergence.mts apply <snapshot> <event-json> | status <snapshot> | replay <fixture> [trace]");
}

function comparable(snapshot: TaskConvergenceSnapshot): Record<string, unknown> {
	return {
		revision: snapshot.revision,
		state: snapshot.state,
		criteria: Object.fromEntries(snapshot.criteria.map((criterion) => [criterion.id, criterion.status])),
		openFindings: snapshot.findings.filter((finding) => finding.open).map((finding) => ({ id: finding.id, kind: finding.kind })),
		consecutiveNoProgress: snapshot.consecutiveNoProgress,
		meaningfulProgressSinceReview: snapshot.meaningfulProgressSinceReview,
		...(snapshot.correctiveAction ? { correctiveAction: snapshot.correctiveAction } : {}),
		...(snapshot.checkpoint ? { checkpoint: { nextAcceptanceId: snapshot.checkpoint.nextAcceptanceId, nextAction: snapshot.checkpoint.nextAction, openFindingIds: snapshot.checkpoint.openFindingIds } } : {}),
		observedResources: snapshot.observedResources,
	};
}

async function readSnapshot(path: string): Promise<TaskConvergenceSnapshot | undefined> {
	try {
		return decodeTaskConvergenceSnapshot(JSON.parse(await readFile(path, "utf8")));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

async function apply(snapshotPath: string, eventJson: string): Promise<void> {
	const event = JSON.parse(eventJson) as unknown;
	await mkdir(dirname(snapshotPath), { recursive: true });
	await withSnapshotLock(snapshotPath, async () => {
		const next = reduceTaskConvergence(await readSnapshot(snapshotPath), event);
		const tempPath = `${snapshotPath}.tmp-${process.pid}-${Date.now()}`;
		try {
			await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
			await rename(tempPath, snapshotPath);
		} finally {
			await rm(tempPath, { force: true });
		}
		process.stdout.write(`${JSON.stringify(next, null, 2)}\n`);
	});
}

async function withSnapshotLock<TResult>(snapshotPath: string, action: () => Promise<TResult>): Promise<TResult> {
	const lockPath = `${snapshotPath}.lock`;
	const started = Date.now();
	const timeoutMs = 30_000;
	const staleMs = 10 * 60_000;
	while (true) {
		try {
			await mkdir(lockPath);
			try {
				return await action();
			} finally {
				await rm(lockPath, { recursive: true, force: true });
			}
		} catch (error) {
			if (!isAlreadyExists(error)) throw error;
			if (await isStale(lockPath, staleMs)) {
				await rm(lockPath, { recursive: true, force: true });
				continue;
			}
			if (Date.now() - started >= timeoutMs) throw new Error(`Timed out waiting for convergence snapshot lock: ${lockPath}`);
			await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
		}
	}
}

async function isStale(path: string, staleMs: number): Promise<boolean> {
	try {
		return Date.now() - (await stat(path)).mtimeMs >= staleMs;
	} catch (error) {
		return isMissing(error);
	}
}

function isAlreadyExists(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "EEXIST";
}

function isMissing(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}

async function status(snapshotPath: string): Promise<void> {
	const snapshot = await readSnapshot(snapshotPath);
	process.stdout.write(`${JSON.stringify(snapshot ?? { kind: "missing" }, null, 2)}\n`);
}

async function replay(fixturePath: string, traceName?: string): Promise<void> {
	const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as TraceFixture;
	if (fixture.schemaVersion !== 1 || !Array.isArray(fixture.traces)) throw new Error("Invalid convergence fixture.");
	const traces = traceName ? fixture.traces.filter((trace) => trace.name === traceName) : fixture.traces;
	if (traces.length === 0) throw new Error(`Unknown convergence trace: ${traceName}`);
	for (const trace of traces) {
		let snapshot: TaskConvergenceSnapshot | undefined;
		for (const step of trace.steps) {
			snapshot = reduceTaskConvergence(snapshot, step.event);
			if (JSON.stringify(comparable(snapshot)) !== JSON.stringify(step.expected)) throw new Error(`Fixture mismatch in ${trace.name} at revision ${snapshot.revision}`);
		}
		// Keep the full replay path exercised as well as the incremental path.
		replayTaskConvergence(trace.steps.map((step) => step.event));
	}
	process.stdout.write(`${JSON.stringify({ ok: true, fixture: resolve(fixturePath), traces: traces.map((trace) => trace.name) }, null, 2)}\n`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "apply") {
	const [snapshotPath, eventJson] = args;
	if (!snapshotPath || !eventJson) usage();
	await apply(resolve(snapshotPath), eventJson);
} else if (command === "status") {
	const [snapshotPath] = args;
	if (!snapshotPath) usage();
	await status(resolve(snapshotPath));
} else if (command === "replay") {
	const [fixturePath, traceName] = args;
	if (!fixturePath) usage();
	await replay(resolve(fixturePath), traceName);
} else usage();
