import type { ContextSegment } from "../core/context-compiler.ts";

const CONTEXT_KINDS = new Set<ContextSegment["kind"]>(["task", "spec", "memory", "journal", "workflow", "evidence", "runtime", "instruction", "skill", "resource"]);
const CONTEXT_REASONS = new Set<ContextSegment["reason"]>(["included", "duplicate", "irrelevant", "budget", "empty"]);

export interface RestoredContextSnapshot {
	readonly content: string;
	readonly epoch: string;
	readonly revision: string;
	readonly segments: readonly ContextSegment[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): value is string {
	return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function validSegment(value: unknown): value is ContextSegment {
	if (!isRecord(value)) return false;
	return boundedString(value.id, 256)
		&& typeof value.kind === "string" && CONTEXT_KINDS.has(value.kind as ContextSegment["kind"])
		&& value.trust === "untrusted"
		&& typeof value.included === "boolean"
		&& typeof value.estimatedChars === "number" && Number.isSafeInteger(value.estimatedChars) && value.estimatedChars >= 0
		&& typeof value.estimatedTokens === "number" && Number.isSafeInteger(value.estimatedTokens) && value.estimatedTokens >= 0
		&& typeof value.reason === "string" && CONTEXT_REASONS.has(value.reason as ContextSegment["reason"])
		&& (value.sourceRef === undefined || boundedString(value.sourceRef, 512));
}

function messageParts(entry: unknown): { content: unknown; customType: unknown; details: unknown } | undefined {
	if (!isRecord(entry)) return undefined;
	if (entry.type === "custom_message") return { content: entry.content, customType: entry.customType, details: entry.details };
	if (entry.type !== "message" || !isRecord(entry.message) || entry.message.role !== "custom") return undefined;
	return { content: entry.message.content, customType: entry.message.customType, details: entry.message.details };
}

function contentText(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map((item) => contentText(item)).filter(Boolean).join("\n");
	if (!isRecord(value)) return "";
	for (const key of ["text", "content", "value"]) {
		if (key in value) {
			const text = contentText(value[key]);
			if (text) return text;
		}
	}
	return "";
}

function decodeSnapshot(entry: unknown): RestoredContextSnapshot | undefined {
	const parts = messageParts(entry);
	if (!parts || parts.customType !== "personal-agent-context" || !isRecord(parts.details)) return undefined;
	if (parts.details.schemaVersion !== 2 || !boundedString(parts.details.epoch, 512) || !boundedString(parts.details.revision, 512)) return undefined;
	if (!Array.isArray(parts.details.segments) || parts.details.segments.length === 0 || !parts.details.segments.every(validSegment)) return undefined;
	const content = contentText(parts.content);
	if (!content.trim()) return undefined;
	return {
		content,
		epoch: parts.details.epoch,
		revision: parts.details.revision,
		segments: parts.details.segments,
	};
}

export function restoreLatestContextSnapshot(entries: readonly unknown[]): RestoredContextSnapshot | undefined {
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const snapshot = decodeSnapshot(entries[index]);
		if (snapshot) return snapshot;
	}
	return undefined;
}
