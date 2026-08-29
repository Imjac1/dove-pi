import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface DoveStateDirOptions {
	readonly env?: NodeJS.ProcessEnv;
	readonly agentDir?: string;
	readonly homeDir?: string;
	readonly platform?: NodeJS.Platform;
}

const LEGACY_STATE_FILES = ["execution.jsonl", "reasoning-voice", "thinking-policy"] as const;

function workspaceIdentity(workspace: string, platform: NodeJS.Platform): string {
	const resolved = resolve(workspace);
	let physical = resolved;
	try {
		physical = realpathSync.native(resolved);
	} catch {
		// A not-yet-created workspace still gets a deterministic lexical identity.
	}
	const normalized = physical.replace(/\\/g, "/").replace(/\/+$/, "");
	return platform === "win32" ? normalized.toLowerCase() : normalized;
}

/** Resolve non-project Dove runtime state without creating any directories. */
export function resolveDoveStateDir(workspace: string, options: DoveStateDirOptions = {}): string {
	const env = options.env ?? process.env;
	const override = env.DOVE_PI_STATE_DIR?.trim();
	if (override) return resolve(override);
	const agentDir = options.agentDir?.trim() || env.PI_CODING_AGENT_DIR?.trim() || join(options.homeDir ?? homedir(), ".pi", "agent");
	const identity = workspaceIdentity(workspace, options.platform ?? process.platform);
	const workspaceHash = createHash("sha256").update(identity).digest("hex").slice(0, 16);
	return join(resolve(agentDir), "dove", "workspaces", workspaceHash);
}

export function legacyDoveStateDir(workspace: string): string {
	return join(resolve(workspace), ".agent-data");
}

/**
 * Copy the bounded legacy state set once. Existing destination files win and
 * legacy files are never deleted or written again.
 */
export function migrateLegacyDoveState(workspace: string, stateDir: string): readonly string[] {
	const legacyDir = legacyDoveStateDir(workspace);
	if (resolve(legacyDir) === resolve(stateDir) || !existsSync(legacyDir)) return [];
	const pending = LEGACY_STATE_FILES.filter((name) => {
		const source = join(legacyDir, name);
		const destination = join(stateDir, name);
		try { return statSync(source).isFile() && !existsSync(destination); } catch { return false; }
	});
	if (pending.length === 0) return [];
	mkdirSync(stateDir, { recursive: true });
	const copied: string[] = [];
	for (const name of pending) {
		try {
			copyFileSync(join(legacyDir, name), join(stateDir, name));
			copied.push(name);
		} catch {
			// Compatibility migration is best effort. The legacy source remains
			// untouched and normal operation continues with the new state root.
		}
	}
	return copied;
}
