import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import type { EffectRecord, EffectStore } from "./effect-ledger.ts";

/**
 * A claim store in a directory, for concurrent processes on one host.
 *
 * **The atomicity this can honestly offer, stated rather than implied:** between processes on **one host
 * with a local filesystem**. No filesystem primitive is safe across a network mount - exclusive create is
 * unverified by vendors whose locks are documented broken, `flock` is absent over NFS before Linux 2.6.11
 * and non-advisory over SMB since 5.5, `O_APPEND` is documented racy on NFS, and SQLite is documented to
 * corrupt. Cross-host exclusion is the backend's, through the key the tool forwards.
 *
 * **The claim is the existence of the file.** It is created with exclusive create - `O_CREAT|O_EXCL` on
 * POSIX, `CREATE_NEW` on Windows, which is `openSync(path, "wx")` here - and never `exists()` followed by
 * a write, because the window between those two calls is exactly where the duplicate lands.
 *
 * **Two hazards this implementation names instead of hiding.**
 *
 * 1. Exclusive create and the record write are two steps, so a crash between them leaves a claim whose
 *    content cannot be read. That is reported as {@link ClaimResult.unreadable} and must be refused, never
 *    resolved in either direction: reading it as unclaimed re-runs the effect, and reading it as completed
 *    invents a result. (The alternative that closes the window is `linkSync` of a pre-written temp file,
 *    which is atomic and content-complete - but hard links are not universal, and this store would then fail
 *    outright on a filesystem like exFAT rather than degrade with a stated refusal.)
 * 2. The claim is `fsync`ed before it is returned. A claim that is visible but not durable is worse than no
 *    claim: the process crashes, the effect ran, and the record is gone - the late-commit window that makes
 *    exactly-once impossible at this layer.
 *
 * **A claim whose owner died is never reclaimed.** This is deliberately the opposite of
 * `project-provider/lock.ts`, which deletes a lock older than ten minutes and retries. That is right for a
 * mutex and wrong here: reclaiming an effect claim means re-running something whose outcome is unknown,
 * which is the duplicate. Readers see `unknown` and the operator decides.
 */
export interface FileEffectStoreOptions {
	/** The directory claim records live in. Created on demand. */
	readonly directory: string;
}

/** Raised when a claim exists but its record cannot be read. Refusing is the only safe answer. */
export class UnreadableClaimError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UnreadableClaimError";
	}
}

export function createFileEffectStore(options: FileEffectStoreOptions): EffectStore {
	const directory = options.directory;

	const pathOf = (effectKey: string): string => {
		if (effectKey.length === 0 || /[\\/]/.test(effectKey) || effectKey.includes("..")) {
			throw new Error(`Refusing effect key '${effectKey}': an effect key names one claim file and must not carry a path.`);
		}
		return join(directory, `${effectKey}.json`);
	};

	/** Read a claim file's text. `undefined` means it does not exist; any other failure is unreadable. */
	const readText = (path: string, effectKey: string): string | undefined => {
		try {
			return readFileSync(path, "utf8");
		} catch (error) {
			if (isMissing(error)) return undefined;
			throw new UnreadableClaimError(
				`Claim file for effect '${effectKey}' could not be read: ${describe(error)}. It was created, so the effect may have run; the record is what cannot be established.`,
			);
		}
	};

	/**
	 * Parse a claim record. An empty or truncated file is a claim whose record had not landed yet - the one
	 * state that must not be resolved in either direction, so it is raised rather than defaulted.
	 */
	const parseRecord = (text: string | undefined, effectKey: string): EffectRecord => {
		if (text === undefined) {
			throw new UnreadableClaimError(`Claim file for effect '${effectKey}' vanished between the claim and the read.`);
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			throw new UnreadableClaimError(
				`Claim file for effect '${effectKey}' is not readable JSON (it is a claim written before its record landed, or it was truncated). The effect may have run, so this must be surfaced rather than resolved.`,
			);
		}
		if (typeof parsed !== "object" || parsed === null || (parsed as { effectKey?: unknown }).effectKey !== effectKey) {
			throw new UnreadableClaimError(
				`Claim file for effect '${effectKey}' does not carry that key. Refusing to report a record that belongs to a different effect.`,
			);
		}
		return parsed as EffectRecord;
	};

	return {
		async claim(record) {
			mkdirSync(directory, { recursive: true });
			const path = pathOf(record.effectKey);
			let handle: number;
			try {
				handle = openSync(path, "wx");
			} catch (error) {
				if (!isAlreadyExists(error)) throw error;
				// The claim exists. Either the record is readable or it is not - and "not" is not "unclaimed".
				try {
					return { claimed: false, existing: parseRecord(readText(path, record.effectKey), record.effectKey) };
				} catch (unreadable) {
					if (unreadable instanceof UnreadableClaimError) return { claimed: false, unreadable: true };
					throw unreadable;
				}
			}
			try {
				writeSync(handle, JSON.stringify(record));
				fsyncSync(handle);
			} finally {
				closeSync(handle);
			}
			return { claimed: true };
		},

		async get(effectKey) {
			const path = pathOf(effectKey);
			const text = readText(path, effectKey);
			if (text === undefined) return undefined;
			return parseRecord(text, effectKey);
		},

		async complete(effectKey, patch) {
			const path = pathOf(effectKey);
			// Parity with the in-memory store: completing a key that was never claimed is a no-op, not an error.
			const text = readText(path, effectKey);
			if (text === undefined) return;
			const existing = parseRecord(text, effectKey);
			const updated: EffectRecord = {
				...existing,
				completedAt: patch.completedAt,
				outcome: patch.outcome,
				...(patch.artifacts === undefined ? {} : { artifacts: patch.artifacts }),
			};
			// Write-then-rename: rename(2) replaces the target atomically within one filesystem, so a reader
			// sees either the old record or the new one and never a half-written one.
			const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
			try {
				writeFileSync(temporary, JSON.stringify(updated));
				renameSync(temporary, path);
			} catch (error) {
				rmSync(temporary, { force: true });
				throw error;
			}
		},
	};
}

function isAlreadyExists(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "EEXIST";
}

function isMissing(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
