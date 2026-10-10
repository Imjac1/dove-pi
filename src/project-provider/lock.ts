import { mkdir, rm, stat } from "node:fs/promises";
import { AsyncLocalStorage } from "node:async_hooks";
import { dirname, join, resolve } from "node:path";

/**
 * Small cross-process lock for atomic Dove native project-state mutations.
 * The lock is recoverable after a stale process exits.
 *
 * **The exclusion is the existence of the directory, and one call stack may hold it more than once.** Re-entrancy is not
 * a convenience here: every writer in one process shares one `mkdir` call and one lock path, so a nested acquisition sees
 * its own directory. What makes the second acquisition a pass-through is an `AsyncLocalStorage` set of the paths the
 * **current asynchronous context** already holds - not a process-wide set of them, which was the first attempt and was
 * measured by the existing serialization case: with a process-wide set, two concurrent writers in one process each saw
 * the path as held and ran at once, which is the exclusion this function exists to provide.
 *
 * **What sits inside the `try` and what sits outside it is the whole of the first hazard, and it was measured.** The
 * acquisition is the only call that can report `EEXIST`; once the directory is ours, every error belongs to the action
 * and reaches the caller unchanged. An earlier shape wrapped the acquisition and the action in one `try`, and a probe
 * measured what that cost: an action whose own error carried `EEXIST` was read as contention, was handed the lock again,
 * and ran a second time - four runs in the measurement - while an error that kept carrying `EEXIST` never returned at
 * all, because the deleted lock directory reads as stale and the stale branch skipped the deadline.
 *
 * **The deadline is now unskippable.** Acting on a stale lock no longer `continue`s past the timeout check, so a lock
 * that keeps reappearing as stale cannot spin without end.
 */
const heldLocks = new AsyncLocalStorage<Set<string>>();

export async function withProjectMutationLock<TResult>(projectRoot: string, action: () => Promise<TResult>, options: { timeoutMs?: number; retryMs?: number; staleMs?: number } = {}): Promise<TResult> {
	const lockPath = resolve(join(projectRoot, ".dove", "project-mutation.lock"));
	const timeoutMs = options.timeoutMs ?? 30_000;
	const retryMs = options.retryMs ?? 100;
	const staleMs = options.staleMs ?? 10 * 60_000;
	const started = Date.now();
	const held = heldLocks.getStore();
	if (held?.has(lockPath)) return await action();
	await mkdir(dirname(lockPath), { recursive: true });
	while (true) {
		let acquired = false;
		try {
			await mkdir(lockPath, { recursive: false });
			acquired = true;
		} catch (error) {
			if (!isAlreadyExists(error)) throw error;
		}
		if (acquired) {
			const store = held ?? new Set<string>();
			store.add(lockPath);
			try {
				return await heldLocks.run(store, () => action());
			} finally {
				store.delete(lockPath);
				await rm(lockPath, { recursive: true, force: true });
			}
		}
		if (await isStale(lockPath, staleMs)) await rm(lockPath, { recursive: true, force: true });
		if (Date.now() - started >= timeoutMs) throw new Error(`Timed out waiting for project mutation lock: ${lockPath}`);
		await new Promise((resolve) => setTimeout(resolve, retryMs));
	}
}

async function isStale(path: string, staleMs: number): Promise<boolean> {
	try {
		const metadata = await stat(path);
		return Date.now() - metadata.mtimeMs >= staleMs;
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
