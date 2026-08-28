import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	collectCacheUsageSamples,
	inspectCacheDiagnostics,
	type CacheDiagnostics,
} from "../pi-adapter/cache-diagnostics.ts";

export interface CacheAuditOptions {
	/** Only show sessions with at least this many requests. Default 2 (a 1-request session is pure warmup). */
	readonly minRequests?: number;
	/** Optional cwd substring filter (`--filter=Desktop`). */
	readonly filter?: string;
	/** Only show sessions whose hit rate falls below this (as 0..1). */
	readonly onlyBelow?: number;
}

interface SessionCacheRow {
	readonly session: string;
	readonly project: string;
	readonly requests: number;
	readonly sessionHitRate: number | undefined;
	readonly lastHitRate: number | undefined;
	readonly warmups: number;
	readonly fullMisses: number;
	readonly lastMissReason: CacheDiagnostics["lastMissReason"];
	readonly promptTokens: number;
	readonly uncachedTokens: number;
	/** Cache-stability policy the session ran under (how many segments its context epoch had). */
	readonly cachePolicy: string;
}

export function sessionBaseDir(): string {
	const configured = process.env.PI_CODING_AGENT_DIR;
	return configured
		? join(configured, "sessions")
		: join(homedir(), ".pi", "agent", "sessions");
}

function decodeProjectName(dirName: string): string {
	return dirName
		.replace(/^-+|-$/g, "")
		.split("--")
		.join("\\");
}

async function readSessionEntries(filePath: string): Promise<unknown[]> {
	const text = await readFile(filePath, "utf8");
	const entries: unknown[] = [];
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			entries.push(JSON.parse(trimmed) as unknown);
		} catch {
			/* skip malformed line */
		}
	}
	return entries;
}

/**
 * Cache-stability policy of the running extension, detected from the session's
 * context-snapshot epochs. v2 = 2-segment epoch (`mode:revision`, prompt- and
 * toolset-independent → stable prefix). v1 = legacy 6-segment epoch (mode:version:
 * revisionMs:project:skill:toolset → rebuilds the snapshot on every intent flip).
 */
function detectCachePolicy(entries: readonly unknown[]): string {
	const epochs: string[] = [];
	for (const entry of entries) {
		if (!entry || typeof entry !== "object") continue;
		const e = entry as { type?: string; customType?: string; details?: { epoch?: unknown } };
		if (e.type !== "custom_message" || e.customType !== "personal-agent-context") continue;
		if (typeof e.details?.epoch === "string") epochs.push(e.details.epoch);
	}
	const last = epochs.at(-1);
	if (!last) return "n/a";
	// v1 legacy epochs carry mode:version:revisionMs:project:skill:toolset (6 segments);
	// v2 uses mode:revision (2 segments). Anything else → unknown shape.
	return last.split(":").length === 2 ? "v2" : "v1";
}

export async function runCacheAudit(
	options: CacheAuditOptions = {},
): Promise<SessionCacheRow[]> {
	const base = sessionBaseDir();
	let projectDirs: string[];
	try {
		projectDirs = await readdir(base);
	} catch {
		return [];
	}

	const rows: SessionCacheRow[] = [];
	for (const dir of projectDirs) {
		const projectPath = join(base, dir);
		const stat = await import("node:fs/promises").then((fs) =>
			fs.stat(projectPath).catch(() => undefined),
		);
		if (!stat?.isDirectory()) continue;

		let files: string[] = [];
		try {
			files = (await readdir(projectPath))
				.filter((f) => f.endsWith(".jsonl"))
				.map((f) => join(projectPath, f));
		} catch {
			continue;
		}

		const project = decodeProjectName(dir);
		if (
			options.filter &&
			!project.toLowerCase().includes(options.filter.toLowerCase())
		)
			continue;

		for (const file of files) {
			const entries = await readSessionEntries(file);
			if (!collectCacheUsageSamples(entries).length) continue;
			const diag = inspectCacheDiagnostics(entries);
			if (diag.requestCount < (options.minRequests ?? 2)) continue;
			const row: SessionCacheRow = {
				session:
					file
						.split(/[\\/]/)
						.pop()
						?.replace(/\.jsonl$/, "")
						.slice(0, 21) ?? "",
				project,
				requests: diag.requestCount,
				sessionHitRate: diag.sessionHitRate,
				lastHitRate: diag.lastHitRate,
				warmups: diag.warmupRequests,
				fullMisses: diag.fullMisses,
				lastMissReason: diag.lastMissReason,
				promptTokens: diag.promptTokens,
				uncachedTokens: diag.inputTokens,
				cachePolicy: detectCachePolicy(entries),
			};
			if (options.onlyBelow !== undefined) {
				const rate = diag.sessionHitRate ?? 0;
				if (rate >= options.onlyBelow) continue;
			}
			rows.push(row);
		}
	}
	rows.sort((a, b) => (a.sessionHitRate ?? 0) - (b.sessionHitRate ?? 0));
	return rows;
}

export function formatCacheAudit(rows: readonly SessionCacheRow[]): string {
	if (rows.length === 0) return "（没有满足条件的会话记录）";

	const lines: string[] = [];
	const totals = rows.reduce(
		(acc, row) => ({
			requests: acc.requests + row.requests,
			prompt: acc.prompt + row.promptTokens,
			uncached: acc.uncached + row.uncachedTokens,
			misses: acc.misses + row.fullMisses,
		}),
		{ requests: 0, prompt: 0, uncached: 0, misses: 0 },
	);

	lines.push(
		"| 会话 | 项目 | 策略 | 请求 | 会话命中% | 末次命中% | warmup | 全MISS | 末次miss原因 | 未缓存input |",
	);
	lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
	for (const r of rows) {
		lines.push(
			`| ${r.session} | ${r.project} | ${r.cachePolicy} | ${r.requests} | ${r.sessionHitRate === undefined ? "n/a" : r.sessionHitRate.toFixed(1)}% | ${r.lastHitRate === undefined ? "n/a" : r.lastHitRate.toFixed(1)}% | ${r.warmups} | ${r.fullMisses} | ${r.lastMissReason ?? "n/a"} | ${r.uncachedTokens.toLocaleString()} |`,
		);
	}
	lines.push("");
	lines.push(
		`**汇总**(${rows.length} 会话): 请求 ${totals.requests.toLocaleString()} · prompt ${totals.prompt.toLocaleString()} · 未缓存 input ${totals.uncached.toLocaleString()} · 全MISS ${totals.misses} 次。`,
	);
	lines.push(
		"miss 原因: warmup=会话首个请求(预期) · prefix-change=前缀变动(应尽量消除) · idle=空闲超时 · model-change=换模型",
	);
	lines.push(
		"策略: v2=新缓存稳定 epoch(mode+revision,意图/工具变化不再重建前缀) · v1=旧版 6 段 epoch(每次意图翻转都重建,命中受损)",
	);
	return lines.join("\n");
}
