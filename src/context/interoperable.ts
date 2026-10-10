import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import type { AgentMode } from "../core/contracts.ts";
import type { CompiledContext, ContextCompileOptions, ContextDocument } from "../core/context-compiler.ts";
import type { ProjectProvider } from "../project-provider/index.ts";
import { discoverAllSkills } from "../skills/discovery.ts";
import { isSensitiveProjectPath } from "../trellis-adapter/index.ts";
import { buildProjectContext } from "../trellis-adapter/context.ts";

const MAX_SOURCE_CHARS = 256_000;

/**
 * The one document a general question about skills receives.
 *
 * A skill body is a procedure, and a procedure handed over unasked is context spent on work the request did not ask
 * for. The index is what lets a request discover that a skill exists without paying for every body it might want, and
 * it is a document rather than a diagnostic field so that the model can actually see it - `projection.index` had carried
 * the same names since the beginning, and nothing ever put one in front of a reader.
 */
const SKILL_INDEX_ID = "skills/index";
const SKILL_INDEX_TITLE = "# Agent Skills index (技能索引)";
const SKILL_INDEX_NOTE = "Each entry is a skill in `.agents/skills/<name>/SKILL.md`; name one to receive its full text.";

export interface McpContextResource {
	readonly uri: string;
	readonly text: string;
	readonly title?: string;
}

export interface ContextAuthority {
	readonly id: string;
	readonly kind: "project-provider" | "instruction" | "skill" | "mcp-resource";
	readonly sourceRef: string;
}

export interface InteroperableContextProjection {
	readonly projectRoot: string;
	readonly provider: string;
	readonly revision: string;
	readonly authorities: readonly ContextAuthority[];
	readonly conflicts: readonly string[];
	readonly documents: readonly ContextDocument[];
	readonly index: readonly { id: string; kind: ContextDocument["kind"]; sourceRef?: string; estimatedChars: number }[];
}

export function readInteroperableContextProjection(provider: ProjectProvider, mcpResources: readonly McpContextResource[] = []): InteroperableContextProjection {
	const snapshot = provider.getContext();
	const documents: ContextDocument[] = [];
	const authorities: ContextAuthority[] = [{ id: `provider:${snapshot.provider}`, kind: "project-provider", sourceRef: snapshot.projectRoot }];
	const conflicts: string[] = [];
	const instructionSources: string[] = [];

	for (const name of ["AGENTS.md", "CLAUDE.md"] as const) {
		const path = join(snapshot.projectRoot, name);
		const content = readBoundedText(path);
		if (content === undefined) continue;
		instructionSources.push(name);
		authorities.push({ id: `instruction:${name.toLowerCase()}`, kind: "instruction", sourceRef: path });
		documents.push({ id: `instruction/${name}`, kind: "instruction", content, sourceRef: path, priority: 70 });
	}
	if (instructionSources.length > 1) conflicts.push(`Multiple project instruction authorities are present: ${instructionSources.join(", ")}. They remain separately labeled and are not silently merged.`);

	const skillIndex: string[] = [];
	for (const skill of discoverAllSkills(snapshot.projectRoot)) {
		const content = readBoundedText(skill.path);
		if (content === undefined) continue;
		skillIndex.push(`- ${skill.name}${skill.description ? `: ${skill.description}` : ""}`);
		const id = `skill/${skill.name}`;
		authorities.push({ id, kind: "skill", sourceRef: skill.path });
		documents.push({ id, kind: "skill", content, sourceRef: skill.path, priority: 40 });
	}
	// Built here rather than in the selector because a description is known here and gone by then: the selector sees
	// documents, and a document carries its own text and nothing else.
	if (skillIndex.length > 0) {
		documents.push({ id: SKILL_INDEX_ID, kind: "skill", sourceRef: snapshot.projectRoot, priority: 40, content: `${SKILL_INDEX_TITLE}\n\n${SKILL_INDEX_NOTE}\n\n${skillIndex.join("\n")}\n` });
	}

	const seenResources = new Set<string>();
	for (const resource of mcpResources) {
		if (!resource.uri.trim()) continue;
		if (seenResources.has(resource.uri)) {
			conflicts.push(`Duplicate MCP resource authority: ${resource.uri}.`);
			continue;
		}
		seenResources.add(resource.uri);
		const content = resource.text.slice(0, MAX_SOURCE_CHARS);
		const id = `mcp/${resource.title?.trim() || resource.uri}`;
		authorities.push({ id, kind: "mcp-resource", sourceRef: resource.uri });
		documents.push({ id, kind: "resource", content, sourceRef: resource.uri, priority: 30 });
	}

	return Object.freeze({
		projectRoot: snapshot.projectRoot,
		provider: snapshot.provider,
		revision: snapshot.revision,
		authorities: Object.freeze(authorities),
		conflicts: Object.freeze(conflicts),
		documents: Object.freeze(documents),
		index: Object.freeze(documents.map((document) => Object.freeze({ id: document.id, kind: document.kind, sourceRef: document.sourceRef, estimatedChars: document.content.length }))),
	});
}

export function buildInteroperableProjectContext(
	provider: ProjectProvider,
	query: string,
	mode: AgentMode,
	options: ContextCompileOptions & { readonly mcpResources?: readonly McpContextResource[]; readonly includeFormalArtifacts?: boolean } = {},
): { readonly projection: InteroperableContextProjection; readonly context: CompiledContext } {
	const projection = readInteroperableContextProjection(provider, options.mcpResources);
	const additionalDocuments = selectExternalDocuments(projection.documents, query);
	return {
		projection,
		context: buildProjectContext(provider, query, mode, { maxChars: options.maxChars, additionalDocuments, includeFormalArtifacts: options.includeFormalArtifacts }),
	};
}

/**
 * Which external documents a request asks for, in the two orders the contract names: "Ordinary context requests receive
 * the index and estimates. Full external text is added only for a targeted instruction, skill, or MCP-resource query,
 * then remains subject to the shared context compiler's relevance and size bounds."
 *
 * - A request that **names** a skill gets that skill's body, and only that one. It travels marked `required` so the
 *   compiler's bag of words does not decide the same question a second time. Measured before this: a real `SKILL.md`
 *   whose prose never contains the string `skill` was selected here and then dropped by `score()` as irrelevant, and a
 *   document that did survive was rendered through the 4,000-character optional ceiling - "full external text" cut to
 *   its first lines and its last, with the middle of the procedure gone.
 * - A request that uses a **generic word** ("skills", "技能", "SKILL.md") gets the index: the names and the
 *   descriptions. A body waits for a request that names one. Handing over every body on a generic word was what made
 *   the order nominal - the whole corpus went in, and the compiler then kept whichever documents happened to contain
 *   that word, which is a property of the writing rather than of the request.
 */
function selectExternalDocuments(documents: readonly ContextDocument[], query: string): readonly ContextDocument[] {
	const normalized = query.toLowerCase();
	const wantsInstructions = /agents\.md|claude\.md|project instruction|项目指令|项目规则/.test(normalized);
	const wantsSkills = /\bskills?\b|skill\.md|技能/.test(normalized);
	const wantsResources = /mcp resource|resource uri|mcp 资源|资源地址/.test(normalized);
	const namedSkills = documents.filter((document) => document.kind === "skill" && document.id !== SKILL_INDEX_ID && mentionsSkillName(normalized, document.id));
	if (namedSkills.length > 0) return namedSkills.map((document) => ({ ...document, required: true }));
	return documents.filter((document) =>
		(document.kind === "instruction" && wantsInstructions)
		|| (document.id === SKILL_INDEX_ID && wantsSkills)
		|| (document.kind === "resource" && wantsResources));
}

/**
 * True when the request names this skill, on a boundary a hyphenated or nested name still satisfies.
 *
 * A bare substring test would let a two-letter skill name fire inside an ordinary word, and `\b` is not enough on its
 * own here: a skill may be called `trellis-check` or `nested:custom`, and neither hyphen nor colon is a word boundary.
 */
function mentionsSkillName(query: string, documentId: string): boolean {
	const name = documentId.startsWith("skill/") ? documentId.slice("skill/".length) : "";
	if (!name) return false;
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(^|[^\\p{L}\\p{N}_.:-])${escaped}([^\\p{L}\\p{N}_.:-]|$)`, "iu").test(query);
}

function readBoundedText(path: string): string | undefined {
	const absolute = resolve(path);
	if (!existsSync(absolute) || isSensitiveProjectPath(absolute)) return undefined;
	try {
		if (!statSync(absolute).isFile()) return undefined;
		return readFileSync(absolute, "utf8").slice(0, MAX_SOURCE_CHARS);
	} catch {
		return undefined;
	}
}
