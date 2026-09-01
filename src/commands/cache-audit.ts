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
	readonly warmHitRate: number | undefined;
	readonly recentRequestHitRate: number | undefined;
	readonly recentRequestHits: number;
	readonly recentRequestCount: number;
	readonly lastHitRate: number | undefined;
	readonly warmups: number;
	readonly fullMisses: number;
	readonly lastMissReason: CacheDiagnostics["lastMissReason"];
	readonly promptTokens: number;
	readonly uncachedTokens: number;
	readonly warmPromptTokens: number;
	readonly warmCacheReadTokens: number;
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
	let latest: { epoch?: string; schemaVersion?: number; cachePolicyVersion?: number } | undefined;
	for (const entry of entries) {
		if (!entry || typeof entry !== "object") continue;
		const e = entry as { type?: string; customType?: string; details?: { epoch?: unknown; schemaVersion?: unknown; cachePolicyVersion?: unknown } };
		if (e.type !== "custom_message" || e.customType !== "personal-agent-context") continue;
		latest = {
			...(typeof e.details?.epoch === "string" ? { epoch: e.details.epoch } : {}),
			...(typeof e.details?.schemaVersion === "number" ? { schemaVersion: e.details.schemaVersion } : {}),
			...(typeof e.details?.cachePolicyVersion === "number" ? { cachePolicyVersion: e.details.cachePolicyVersion } : {}),
		};
	}
	if (!latest) return "no-context";
	if (latest.cachePolicyVersion !== undefined) return `v${latest.cachePolicyVersion}`;
	// Existing v2 sessions already carry the versioned append-only message
	// schema. Epoch is opaque and may contain provider revisions/request IDs
	// with any number of colons, so never infer v2 from segment count.
	if (latest.schemaVersion === 2) return "v2";
	return latest.epoch ? "v1" : "n/a";
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
				warmHitRate: diag.warmHitRate,
				recentRequestHitRate: diag.recentRequestHitRate,
				recentRequestHits: diag.recentRequestHits,
				recentRequestCount: diag.recentRequestCount,
				lastHitRate: diag.lastHitRate,
				warmups: diag.warmupRequests,
				fullMisses: diag.fullMisses,
				lastMissReason: diag.lastMissReason,
				promptTokens: diag.promptTokens,
				uncachedTokens: diag.inputTokens,
				warmPromptTokens: diag.warmPromptTokens,
				warmCacheReadTokens: diag.warmCacheReadTokens,
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
			warmPrompt: acc.warmPrompt + row.warmPromptTokens,
			warmRead: acc.warmRead + row.warmCacheReadTokens,
			recentHits: acc.recentHits + row.recentRequestHits,
			recentRequests: acc.recentRequests + row.recentRequestCount,
		}),
		{ requests: 0, prompt: 0, uncached: 0, misses: 0, warmPrompt: 0, warmRead: 0, recentHits: 0, recentRequests: 0 },
	);

	lines.push(
		"| 会话 | 项目 | 策略 | 请求 | 累计命中% | 热态命中% | 近5次请求命中% | 末次命中% | warmup | 全MISS | 末次miss原因 | 未缓存input |",
	);
	lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
	for (const r of rows) {
		lines.push(
			`| ${r.session} | ${r.project} | ${r.cachePolicy} | ${r.requests} | ${r.sessionHitRate === undefined ? "n/a" : r.sessionHitRate.toFixed(1)}% | ${r.warmHitRate === undefined ? "n/a" : r.warmHitRate.toFixed(1)}% | ${r.recentRequestHitRate === undefined ? "n/a" : r.recentRequestHitRate.toFixed(1)}% | ${r.lastHitRate === undefined ? "n/a" : r.lastHitRate.toFixed(1)}% | ${r.warmups} | ${r.fullMisses} | ${r.lastMissReason ?? "n/a"} | ${r.uncachedTokens.toLocaleString()} |`,
		);
	}
	lines.push("");
	lines.push(
		`**汇总**(${rows.length} 会话): 请求 ${totals.requests.toLocaleString()} · prompt ${totals.prompt.toLocaleString()} · 累计未缓存 input ${totals.uncached.toLocaleString()} · 热态命中 ${totals.warmPrompt > 0 ? `${(totals.warmRead / totals.warmPrompt * 100).toFixed(1)}%` : "n/a"} · 近5次请求命中 ${totals.recentRequests > 0 ? `${(totals.recentHits / totals.recentRequests * 100).toFixed(1)}%` : "n/a"} · 全MISS ${totals.misses} 次。`,
	);
	lines.push(
		"miss 原因: warmup=会话首个请求(预期) · provider-miss-or-expiry=提供商未命中或缓存过期(仅凭 usage 无法进一步归因) · idle=空闲超时 · model-change=换模型",
	);
	lines.push(
		"策略: no-context=未额外注入 Dove 快照(最小前缀路径) · v2=稳定 epoch · v1=旧版易变 epoch",
	);
	return lines.join("\n");
}
