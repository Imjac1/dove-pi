import { createHash } from "node:crypto";
import { basename } from "node:path";

const DEFAULT_MESSAGE_CHAR_LIMIT = 32_000;
const MAX_MARKER_CHARS = 2_000;

export interface ModelMessageLike {
	readonly role?: string;
	readonly content?: unknown;
	readonly customType?: string;
	readonly details?: unknown;
}

export interface ModelMessageProjectionMetadata {
	readonly source: string;
	readonly originalChars: number;
	readonly retainedChars: number;
	readonly omittedChars: number;
	readonly digest: string;
	readonly warningCount: number;
	readonly errorCount: number;
	readonly dependencyScope: boolean;
	readonly artifact?: string;
}

function textParts(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map((part) => {
		if (typeof part === "string") return part;
		if (typeof part === "object" && part !== null && "text" in part && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
		return "";
	}).join("\n");
}

function detailsArtifact(details: unknown): string | undefined {
	if (typeof details !== "object" || details === null) return undefined;
	const value = details as Record<string, unknown>;
	for (const key of ["outputPath", "artifactPath", "logPath", "path"]) {
		if (typeof value[key] === "string" && value[key].trim()) return basename(value[key]);
	}
	return undefined;
}

function isDependencyScope(text: string, details: unknown): boolean {
	const serialized = typeof details === "string" ? details : JSON.stringify(details ?? "");
	return /(?:^|[\\/])(?:node_modules|vendor|third[_-]?party|thirdparty|\.venv|__pycache__|tools)[\\/]/i.test(`${text}\n${serialized}`);
}

function countMatches(text: string, pattern: RegExp): number {
	return text.match(pattern)?.length ?? 0;
}

function compactText(text: string, source: string, details: unknown, limit: number): { text: string; metadata: ModelMessageProjectionMetadata } {
	const digest = createHash("sha256").update(text).digest("hex").slice(0, 24);
	const dependencyScope = isDependencyScope(text, details);
	const artifact = detailsArtifact(details);
	const warningCount = countMatches(text, /\b(?:warning|warn|blind write)\b/gi);
	const errorCount = countMatches(text, /\b(?:error|stop|failed|failure)\b/gi);
	const omittedChars = Math.max(0, text.length - Math.max(0, limit - MAX_MARKER_CHARS));
	const marker = `[Dove context compacted] source=${source}; omitted=${omittedChars}; digest=${digest}; warnings=${warningCount}; errors=${errorCount};${dependencyScope ? " scope=dependency-or-vendor;" : ""}${artifact ? ` artifact=${artifact};` : ""} full output remains in the original session artifact.`;
	const available = Math.max(0, limit - marker.length - 4);
	const head = Math.floor(available * 0.7);
	const tail = Math.max(0, available - head);
	const projected = `${text.slice(0, head)}\n\n${marker}\n\n${tail > 0 ? text.slice(-tail) : ""}`;
	return {
		text: projected,
		metadata: { source, originalChars: text.length, retainedChars: projected.length, omittedChars: Math.max(0, text.length - head - tail), digest, warningCount, errorCount, dependencyScope, ...(artifact ? { artifact } : {}) },
	};
}

function replaceContent(content: unknown, text: string): unknown {
	if (typeof content === "string") return text;
	if (!Array.isArray(content)) return content;
	const images = content.filter((part) => typeof part === "object" && part !== null && (part as { type?: unknown }).type === "image");
	return [{ type: "text", text }, ...images];
}

export function projectModelMessages<T extends ModelMessageLike>(messages: readonly T[], maxChars = DEFAULT_MESSAGE_CHAR_LIMIT): T[] {
	return messages.map((message) => {
		const text = textParts(message.content);
		if (text.length <= maxChars || text.includes("[Dove context compacted]")) return message;
		const source = [message.role ?? "message", message.customType].filter(Boolean).join(":");
		const compacted = compactText(text, source, message.details, maxChars);
		return { ...message, content: replaceContent(message.content, compacted.text), details: { doveContextProjection: compacted.metadata } } as T;
	});
}

export function modelMessageText(message: ModelMessageLike): string {
	return textParts(message.content);
}
