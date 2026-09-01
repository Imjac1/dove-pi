import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import type { AgentMode } from "../core/contracts.ts";
import type { CompiledContext, ContextCompileOptions, ContextDocument } from "../core/context-compiler.ts";
import type { ProjectProvider } from "../project-provider/index.ts";
import { discoverSkills } from "../skills/discovery.ts";
import { isSensitiveProjectPath } from "../trellis-adapter/index.ts";
import { buildProjectContext } from "../trellis-adapter/context.ts";

const MAX_SOURCE_CHARS = 256_000;

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

	for (const skill of discoverSkills(snapshot.projectRoot)) {
		const content = readBoundedText(skill.path);
		if (content === undefined) continue;
		const id = `skill/${skill.name}`;
		authorities.push({ id, kind: "skill", sourceRef: skill.path });
		documents.push({ id, kind: "skill", content, sourceRef: skill.path, priority: 40 });
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

function selectExternalDocuments(documents: readonly ContextDocument[], query: string): readonly ContextDocument[] {
	const normalized = query.toLowerCase();
	const wantsInstructions = /agents\.md|claude\.md|project instruction|项目指令|项目规则/.test(normalized);
	const wantsSkills = /\bskills?\b|skill\.md|技能/.test(normalized);
	const wantsResources = /mcp resource|resource uri|mcp 资源|资源地址/.test(normalized);
	return documents.filter((document) =>
		(document.kind === "instruction" && wantsInstructions)
		|| (document.kind === "skill" && wantsSkills)
		|| (document.kind === "resource" && wantsResources));
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
