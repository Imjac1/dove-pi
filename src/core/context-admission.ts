import { createHash } from "node:crypto";

/**
 * The context admission boundary (design section 7).
 *
 * **One boundary, every channel.** The failure this exists to prevent is recorded in this repository's
 * own history: a September 6 authorized security-testing session admitted a **2,865,326-character**
 * diagnostic result for a downloaded third-party tool tree - roughly 95% of that session's tool-result
 * text - and it reached the model through a **background/custom-message path that bypassed the
 * existing tool-result compaction**. A boundary that only guards `tool_result` is a boundary with a
 * documented way around it, so this one guards all three channels and has no exemption.
 *
 * Two properties are non-negotiable:
 *
 * 1. **The raw payload never appears in model-visible content.** Not truncated-and-included - absent.
 *    The compacted form carries a digest and an artifact reference so the full text remains reachable
 *    without being *in* the transcript.
 * 2. **Generated and dependency trees are not actionable context.** A diagnostic for a downloaded tool
 *    tree is a fact about the tree, not an instruction about the task, and delivering it as actionable
 *    content is how a scan of `node_modules` becomes the model's problem.
 */

export type AdmissionChannel = "tool_result" | "extension_message" | "background_notification";

export interface AdmissionRequest {
	readonly channel: AdmissionChannel;
	/** What produced this: a tool name, an extension id, a command. Named in the compacted form. */
	readonly source: string;
	readonly content: string;
	/** Optional path the content describes, used for the non-actionable classification. */
	readonly path?: string;
}

/** Where the full payload goes. Supplied by the caller; the boundary never keeps it in the transcript. */
export interface ArtifactSink {
	write(input: { readonly source: string; readonly channel: AdmissionChannel; readonly content: string; readonly digest: string }): Promise<string>;
}

export interface AdmittedContent {
	/** What may enter model-visible content. Never the raw payload when anything was omitted. */
	readonly admitted: string;
	readonly channel: AdmissionChannel;
	readonly source: string;
	readonly digest: string;
	readonly originalCharacters: number;
	readonly admittedCharacters: number;
	readonly omittedCharacters: number;
	readonly artifactRef?: string;
	/** True when the content was classified as generated/dependency material rather than task material. */
	readonly nonActionable: boolean;
}

export interface ContextAdmissionOptions {
	readonly sink?: ArtifactSink;
	/** Above this, content is compacted. Default 8000. */
	readonly maxCharacters?: number;
	/** How much of the head survives compaction, for orientation. Default 1200. */
	readonly headCharacters?: number;
}

/**
 * Paths whose contents are generated, vendored, or downloaded rather than authored for this task.
 * Kept deliberately broad: a false positive costs a summarised diagnostic, a false negative costs the
 * transcript.
 */
const NON_ACTIONABLE_SEGMENT = /^(?:node_modules|vendor|vendors|third_party|third-party|site-packages|dist|build|out|target|coverage|\.venv|venv|__pycache__|\.git|\.cache|tmp|\.tmp)$/i;

export function isNonActionablePath(path: string): boolean {
	return path.split(/[\\/]+/).some((segment) => NON_ACTIONABLE_SEGMENT.test(segment));
}

function digestOf(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

function compact(request: AdmissionRequest, omittedCharacters: number, digest: string, artifactRef: string | undefined, headCharacters: number, nonActionable: boolean): string {
	const head = request.content.slice(0, headCharacters);
	const lines = request.content.split(/\r?\n/).length;
	return [
		`[admitted content compacted - ${request.channel} from ${request.source}]`,
		`source: ${request.source}`,
		`channel: ${request.channel}`,
		`digest: sha256:${digest}`,
		`omitted: ${omittedCharacters} characters (${lines} lines total)`,
		...(artifactRef === undefined ? [] : [`artifact: ${artifactRef}`]),
		...(nonActionable
			? ["classification: generated/dependency content - not delivered as actionable task context"]
			: []),
		"",
		"--- head of the omitted content ---",
		head,
	].join("\n");
}

/**
 * Admit content into model-visible context.
 *
 * Every channel goes through here. There is no parameter that turns it off, because the recorded
 * incident was caused by a path that had one.
 */
export async function admit(request: AdmissionRequest, options: ContextAdmissionOptions = {}): Promise<AdmittedContent> {
	const maxCharacters = options.maxCharacters ?? 8000;
	const headCharacters = options.headCharacters ?? 1200;
	const digest = digestOf(request.content);
	const nonActionable = request.path !== undefined && isNonActionablePath(request.path);
	const oversized = request.content.length > maxCharacters;

	if (!oversized && !nonActionable) {
		return {
			admitted: request.content,
			channel: request.channel,
			source: request.source,
			digest,
			originalCharacters: request.content.length,
			admittedCharacters: request.content.length,
			omittedCharacters: 0,
			nonActionable: false,
		};
	}

	let artifactRef: string | undefined;
	if (options.sink !== undefined) {
		artifactRef = await options.sink.write({ source: request.source, channel: request.channel, content: request.content, digest });
	}

	const admitted = compact(request, request.content.length, digest, artifactRef, oversized ? headCharacters : 0, nonActionable);
	return {
		admitted,
		channel: request.channel,
		source: request.source,
		digest,
		originalCharacters: request.content.length,
		admittedCharacters: admitted.length,
		omittedCharacters: request.content.length,
		...(artifactRef === undefined ? {} : { artifactRef }),
		nonActionable,
	};
}
