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
}

export class ContextCompiler {
	private readonly documents: ContextDocument[] = [];

	public add(document: ContextDocument): void {
		if (this.documents.some((existing) => existing.id === document.id)) return;
		this.documents.push(document);
	}

	public compile(query: string, mode: AgentMode): CompiledContext {
		const terms = tokenize(query);
		const scored = this.documents
			.map((document) => ({ ...document, relevance: score(document, terms, mode) }))
			.filter((document) => document.required || document.relevance > 0)
			.sort((left, right) => right.relevance - left.relevance || (right.priority ?? 0) - (left.priority ?? 0));

		const deduped: ContextItem[] = [];
		const seenContent = new Set<string>();
		for (const item of scored) {
			const normalized = item.content.replace(/\s+/g, " ").trim();
			if (!normalized || seenContent.has(normalized)) continue;
			seenContent.add(normalized);
			deduped.push(item);
		}

		return {
			mode,
			query,
			items: deduped,
			text: deduped.map((item) => {
				const source = formatSource(item.sourceRef ?? item.id);
				return `## ${formatSource(item.id)}\n[PROJECT_CONTEXT trust=untrusted kind=${item.kind} source=${source}]\n${item.content}\n[/PROJECT_CONTEXT]`;
			}).join("\n\n"),
		};
	}
}

/** Source labels are metadata, but file names are project-controlled input.
 * Keep control characters and bracket delimiters from forging context markers
 * while preserving ordinary paths for readable diagnostics. */
function formatSource(source: string): string {
	return source.replace(/[\r\n\[\]]/g, (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

function tokenize(value: string): readonly string[] {
	return value.toLowerCase().split(/[^a-z0-9_./-]+/i).filter((term) => term.length >= 2);
}

function score(document: ContextDocument, terms: readonly string[], mode: AgentMode): number {
	if (document.required) return 1000 + (document.priority ?? 0);
	if (mode === "ultra" && terms.length === 0) return 1 + (document.priority ?? 0);
	const haystack = `${document.id} ${document.kind} ${document.content}`.toLowerCase();
	return terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
}
