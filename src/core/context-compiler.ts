import type { AgentMode } from "./contracts.ts";

export interface ContextDocument {
	readonly id: string;
	readonly kind: "task" | "spec" | "memory" | "journal" | "workflow" | "evidence" | "runtime";
	readonly content: string;
	readonly priority?: number;
	readonly required?: boolean;
	readonly sourceRef?: string;
}

export interface ContextItem extends ContextDocument {
	readonly relevance: number;
}

export interface CompiledContext {
	readonly mode: AgentMode;
	readonly query: string;
	readonly items: readonly ContextItem[];
	readonly text: string;
	/** Character count of the final prompt fragment (useful for diagnostics). */
	readonly charCount: number;
	/** Conservative estimate; provider-reported usage remains authoritative. */
	readonly estimatedTokens: number;
}

export interface ContextCompileOptions {
	/** Optional remaining model-context budget in characters. */
	readonly maxChars?: number;
}

export class ContextCompiler {
	private readonly documents: ContextDocument[] = [];

	public add(document: ContextDocument): void {
		if (this.documents.some((existing) => existing.id === document.id)) return;
		this.documents.push(document);
	}

	public compile(query: string, mode: AgentMode, options: ContextCompileOptions = {}): CompiledContext {
		const terms = tokenize(query);
		const contextBudget = contextBudgetChars(mode, options.maxChars);
		const scored = this.documents
			.map((document) => ({ ...document, relevance: score(document, terms) }))
			.filter((document) => document.required || document.relevance > 0)
			.sort((left, right) => right.relevance - left.relevance || (right.priority ?? 0) - (left.priority ?? 0));

		const deduped: ContextItem[] = [];
		const seenContent = new Set<string>();
		let usedChars = 0;
		let omittedItems = 0;
		for (const item of scored) {
			const content = compactContent(item.content, query, mode, item.required === true);
			const normalized = content.replace(/\s+/g, " ").trim();
			if (!normalized || seenContent.has(normalized)) continue;
			seenContent.add(normalized);
			const renderedLength = content.length + item.id.length + (item.sourceRef?.length ?? 0) + 96;
			// Required contracts are allowed through even when they exceed the soft
			// budget. Optional retrieval must have a hard upper bound so a broad query
			// (for example "spec") cannot dump an entire large repository.
			if (!item.required && Number.isFinite(contextBudget) && usedChars > 0 && usedChars + renderedLength > contextBudget) {
				omittedItems++;
				continue;
			}
			deduped.push({ ...item, content });
			usedChars += renderedLength;
		}

		const text = deduped.map((item) => {
			const source = formatSource(item.sourceRef ?? item.id);
			return `## ${formatSource(item.id)}\n[PROJECT_CONTEXT trust=untrusted kind=${item.kind} source=${source}]\n${item.content}\n[/PROJECT_CONTEXT]`;
		}).join("\n\n") + (omittedItems > 0 ? `\n\n[PROJECT_CONTEXT budget: omitted ${omittedItems} lower-ranked document(s)]` : "");

		return {
			mode,
			query,
			items: deduped,
			text,
			charCount: text.length,
			estimatedTokens: estimateTokens(text),
		};
	}
}

function contextBudgetChars(mode: AgentMode, maxChars?: number): number {
	// Ultra deliberately has no fixed application token cap. Pi/provider model
	// limits, relevance scoring, deduplication, and per-document compaction remain
	// the protection there; Fast/Standard keep explicit latency-oriented budgets.
	const modeBudget = mode === "fast" ? 16_000 : mode === "standard" ? 24_000 : Number.POSITIVE_INFINITY;
	if (maxChars === undefined || !Number.isFinite(maxChars) || maxChars <= 0) return modeBudget;
	return Math.min(modeBudget, Math.floor(maxChars));
}

/** Source labels are metadata, but file names are project-controlled input.
 * Keep control characters and bracket delimiters from forging context markers
 * while preserving ordinary paths for readable diagnostics. */
function formatSource(source: string): string {
	return source.replace(/[\r\n\[\]]/g, (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

function tokenize(value: string): readonly string[] {
	return value.toLowerCase().split(/[^\p{L}\p{N}_./-]+/u).filter((term) => term.length >= 2);
}

function score(document: ContextDocument, terms: readonly string[]): number {
	if (document.required) return 1000 + (document.priority ?? 0);
	// An empty/unsupported query is not a request to dump the whole project.
	// Required documents still pass through; optional documents wait for a
	// meaningful retrieval signal or an explicit memory/workflow query.
	if (terms.length === 0) return 0;
	const haystack = `${document.id} ${document.kind} ${document.content}`.toLowerCase();
	return terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
}

function compactContent(content: string, query: string, mode: AgentMode, required: boolean): string {
	const limit = required
		? mode === "fast" ? 6_000 : 10_000
		: mode === "ultra" ? 6_000 : 4_000;
	if (content.length <= limit) return content;

	const terms = tokenize(query);
	const lines = content.split(/\r?\n/);
	const selected: string[] = [];
	const selectedIndexes = new Set<number>();
	const addRange = (start: number, end: number): void => {
		for (let index = Math.max(0, start); index <= Math.min(lines.length - 1, end); index++) selectedIndexes.add(index);
	};

	// Keep the document's identity and opening contract sections.
	addRange(0, Math.min(lines.length - 1, 24));
	if (terms.length > 0) {
		for (let index = 0; index < lines.length; index++) {
			const line = lines[index]?.toLowerCase() ?? "";
			if (terms.some((term) => line.includes(term))) addRange(index - 2, index + 2);
		}
	}
	// The end often contains acceptance criteria, validation, or caveats.
	addRange(Math.max(0, lines.length - 12), lines.length - 1);

	for (let index = 0; index < lines.length; index++) {
		if (selectedIndexes.has(index)) selected.push(lines[index] ?? "");
	}
	const excerpt = selected.join("\n");
	if (excerpt.length <= limit) return `${excerpt}\n\n[context compacted from ${content.length} characters]`;
	return `${excerpt.slice(0, Math.max(0, limit - 64)).trimEnd()}\n\n[context compacted from ${content.length} characters]`;
}

function estimateTokens(value: string): number {
	// Local estimate only: CJK characters are usually closer to one token while
	// ASCII prose averages roughly four characters per token. Pi/provider usage
	// remains the source of truth for billing and cache accounting.
	let estimate = 0;
	for (const character of value) estimate += /[\u0000-\u007f]/.test(character) ? 0.25 : 1;
	return Math.ceil(estimate);
}
