import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Small cross-process lock for atomic Dove native project-state mutations.
 * The lock is recoverable after a stale process exits.
 */
export async function withProjectMutationLock<TResult>(projectRoot: string, action: () => Promise<TResult>, options: { timeoutMs?: number; retryMs?: number; staleMs?: number } = {}): Promise<TResult> {
	const lockPath = join(projectRoot, ".dove", "project-mutation.lock");
	const timeoutMs = options.timeoutMs ?? 30_000;
	const retryMs = options.retryMs ?? 100;
	const staleMs = options.staleMs ?? 10 * 60_000;
	const started = Date.now();
	await mkdir(dirname(lockPath), { recursive: true });
	while (true) {
		try {
			await mkdir(lockPath, { recursive: false });
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
			if (Date.now() - started >= timeoutMs) throw new Error(`Timed out waiting for project mutation lock: ${lockPath}`);
			await new Promise((resolve) => setTimeout(resolve, retryMs));
		}
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
