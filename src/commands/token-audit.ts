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
}

export interface TokenAuditResult {
	readonly projects: ProjectSummary[];
	readonly totalPrompt: number;
	readonly totalInput: number;
	readonly totalCacheRead: number;
	readonly totalCacheWrite: number;
	readonly totalOutput: number;
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
	timestamp: number | undefined,
): boolean {
	if (sinceHours === undefined || timestamp === undefined) return true;
	return timestamp >= Date.now() - sinceHours * 3_600_000;
}

function outputTokensOf(entries: readonly unknown[]): number {
	let total = 0;
	for (const entry of entries) {
		const message = (
			entry as {
				type?: string;
				message?: { role?: string; usage?: { output?: number } };
			}
		)?.message;
		if (
			(entry as { type?: string })?.type !== "message" ||
			message?.role !== "assistant"
		)
			continue;
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
		};
	}

	const totals = {
		input: 0,
		cacheRead: 0,
		cacheWrite: 0,
		output: 0,
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

		for (const sessionFile of sessionFiles) {
			const entries = await readSessionEntries(sessionFile);
			const samples = collectCacheUsageSamples(entries);
			if (samples.length === 0) continue;
			sessionCount++;
			for (const sample of samples) {
				if (!isFresh(options.sinceHours, sample.timestamp)) continue;
				input += sample.input;
				cacheRead += sample.cacheRead;
				cacheWrite += sample.cacheWrite;
				messageCount++;
			}
			output += outputTokensOf(entries);
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
		});
		totals.input += input;
		totals.cacheRead += cacheRead;
		totals.cacheWrite += cacheWrite;
		totals.output += output;
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
	};
}

export function formatTokenAudit(result: TokenAuditResult): string {
	const lines: string[] = [];
	lines.push(
		"| 项目 | 会话 | 消息 | input | cacheRead | cacheWrite | output | prompt合计 |",
	);
	lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
	for (const p of result.projects) {
		const prompt = p.inputTokens + p.cacheReadTokens + p.cacheWriteTokens;
		lines.push(
			`| ${p.project} | ${p.sessionCount} | ${p.messageCount} | ${p.inputTokens.toLocaleString()} | ${p.cacheReadTokens.toLocaleString()} | ${p.cacheWriteTokens.toLocaleString()} | ${p.outputTokens.toLocaleString()} | ${prompt.toLocaleString()} |`,
		);
	}
	lines.push("");
	lines.push(
		`**合计**: ${result.projects.length} 个项目 · prompt ${result.totalPrompt.toLocaleString()} · input ${result.totalInput.toLocaleString()} · cacheRead ${result.totalCacheRead.toLocaleString()} · output ${result.totalOutput.toLocaleString()}`,
	);
	return lines.join("\n");
}
