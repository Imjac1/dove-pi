import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { collectCacheUsageSamples } from "../pi-adapter/cache-diagnostics.ts";

export interface TokenAuditOptions {
	/** Only count usage newer than this many hours. Omit for all. */
	readonly sinceHours?: number;
	/** Optional cwd substring filter (`--filter=Desktop`). */
	readonly filter?: string;
}

export interface ProjectSummary {
	readonly project: string;
	readonly sessionCount: number;
	readonly messageCount: number;
	readonly inputTokens: number;
	readonly cacheReadTokens: number;
	readonly cacheWriteTokens: number;
	readonly outputTokens: number;
	readonly reasoningTokens: number;
}

export interface TokenAuditResult {
	readonly projects: ProjectSummary[];
	readonly totalPrompt: number;
	readonly totalInput: number;
	readonly totalCacheRead: number;
	readonly totalCacheWrite: number;
	readonly totalOutput: number;
	readonly totalReasoning: number;
}

export function sessionBaseDir(): string {
	const configured = process.env.PI_CODING_AGENT_DIR;
	return configured
		? join(configured, "sessions")
		: join(homedir(), ".pi", "agent", "sessions");
}

/** Pi encodes the working directory as `--C--Users-rebot-Desktop-code--`; recover a readable label. */
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

function isFresh(
	sinceHours: number | undefined,
	timestamp: number | string | undefined,
): boolean {
	if (sinceHours === undefined) return true;
	if (timestamp === undefined) return false;
	const milliseconds = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
	return Number.isFinite(milliseconds) && milliseconds >= Date.now() - sinceHours * 3_600_000;
}

function outputTokensOf(entries: readonly unknown[], sinceHours?: number): number {
	let total = 0;
	for (const entry of entries) {
		const message = (
			entry as {
				type?: string;
				timestamp?: number | string;
				message?: { role?: string; timestamp?: number | string; usage?: { output?: number } };
			}
		)?.message;
		if (
			(entry as { type?: string })?.type !== "message" ||
			message?.role !== "assistant"
		)
			continue;
		const entryTimestamp = (entry as { timestamp?: unknown })?.timestamp;
		const timestamp = typeof entryTimestamp === "number" || typeof entryTimestamp === "string" ? entryTimestamp : typeof message.timestamp === "number" || typeof message.timestamp === "string" ? message.timestamp : undefined;
		if (!isFresh(sinceHours, timestamp)) continue;
		total += message.usage?.output ?? 0;
	}
	return total;
}

export async function runTokenAudit(
	options: TokenAuditOptions = {},
): Promise<TokenAuditResult> {
	const base = sessionBaseDir();
	let projectDirs: string[];
	try {
		projectDirs = await readdir(base);
	} catch {
		return {
			projects: [],
			totalPrompt: 0,
			totalInput: 0,
			totalCacheRead: 0,
			totalCacheWrite: 0,
			totalOutput: 0,
			totalReasoning: 0,
		};
	}

	const totals = {
		input: 0,
		cacheRead: 0,
		cacheWrite: 0,
		output: 0,
		reasoning: 0,
		messages: 0,
	};
	const projects: ProjectSummary[] = [];

	for (const dir of projectDirs) {
		const projectPath = join(base, dir);
		const stat = await import("node:fs/promises").then((fs) =>
			fs.stat(projectPath).catch(() => undefined),
		);
		if (!stat?.isDirectory()) continue;

		let sessionFiles: string[] = [];
		try {
			sessionFiles = (await readdir(projectPath))
				.filter((file) => file.endsWith(".jsonl"))
				.map((file) => join(projectPath, file));
		} catch {
			continue;
		}

		let sessionCount = 0;
		let messageCount = 0;
		let input = 0;
		let cacheRead = 0;
		let cacheWrite = 0;
		let output = 0;
		let reasoning = 0;
		for (const sessionFile of sessionFiles) {
			const entries = await readSessionEntries(sessionFile);
			const samples = collectCacheUsageSamples(entries);
			const freshSamples = samples.filter((sample) => isFresh(options.sinceHours, sample.timestamp));
			if (freshSamples.length === 0) continue;
			sessionCount++;
			for (const sample of freshSamples) {
				input += sample.input;
				cacheRead += sample.cacheRead;
				cacheWrite += sample.cacheWrite;
				reasoning += sample.reasoning ?? 0;
				messageCount++;
			}
			output += outputTokensOf(entries, options.sinceHours);
		}

		const label = decodeProjectName(dir);
		if (
			options.filter &&
			!label.toLowerCase().includes(options.filter.toLowerCase())
		)
			continue;

		projects.push({
			project: label,
			sessionCount,
			messageCount,
			inputTokens: input,
			cacheReadTokens: cacheRead,
			cacheWriteTokens: cacheWrite,
			outputTokens: output,
			reasoningTokens: reasoning,
		});
		totals.input += input;
		totals.cacheRead += cacheRead;
		totals.cacheWrite += cacheWrite;
		totals.output += output;
		totals.reasoning += reasoning;
		totals.messages += messageCount;
	}

	projects.sort(
		(a, b) =>
			b.inputTokens + b.cacheReadTokens - (a.inputTokens + a.cacheReadTokens),
	);
	return {
		projects,
		totalPrompt: totals.input + totals.cacheRead + totals.cacheWrite,
		totalInput: totals.input,
		totalCacheRead: totals.cacheRead,
		totalCacheWrite: totals.cacheWrite,
		totalOutput: totals.output,
		totalReasoning: totals.reasoning,
	};
}

export function formatTokenAudit(result: TokenAuditResult): string {
	const lines: string[] = [];
	lines.push(
		"| 项目 | 会话 | 消息 | input | cacheRead | cacheWrite | output | reasoning | reasoning% | prompt合计 |",
	);
	lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
	for (const p of result.projects) {
		const prompt = p.inputTokens + p.cacheReadTokens + p.cacheWriteTokens;
		const reasoningPct = p.outputTokens > 0 ? (p.reasoningTokens / p.outputTokens) * 100 : 0;
		lines.push(
			`| ${p.project} | ${p.sessionCount} | ${p.messageCount} | ${p.inputTokens.toLocaleString()} | ${p.cacheReadTokens.toLocaleString()} | ${p.cacheWriteTokens.toLocaleString()} | ${p.outputTokens.toLocaleString()} | ${p.reasoningTokens.toLocaleString()} | ${reasoningPct.toFixed(1)}% | ${prompt.toLocaleString()} |`,
		);
	}
	lines.push("");
	const totalReasoningPct = result.totalOutput > 0 ? (result.totalReasoning / result.totalOutput) * 100 : 0;
	lines.push(
		`**合计**: ${result.projects.length} 个项目 · prompt ${result.totalPrompt.toLocaleString()} · input ${result.totalInput.toLocaleString()} · cacheRead ${result.totalCacheRead.toLocaleString()} · output ${result.totalOutput.toLocaleString()} · reasoning ${result.totalReasoning.toLocaleString()} (${totalReasoningPct.toFixed(1)}% of output)`,
	);
	return lines.join("\n");
}
