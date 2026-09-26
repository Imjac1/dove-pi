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
	/**
	 * Which slice was retained. Present only when something was omitted: unchanged content has no strategy, and
	 * reporting one would describe a choice that was never made.
	 */
	readonly strategy?: "head" | "head-tail";
}

export interface ContextAdmissionOptions {
	readonly sink?: ArtifactSink;
	/** Above this, content is compacted. Default 8000. */
	readonly maxCharacters?: number;
	/**
	 * What to retain. Default `head-tail`, not `head`.
	 *
	 * The tail is where a failure is reported - a stack trace, an exit status, a `FAIL` line - so a boundary that
	 * keeps only the head compacts away the part a reader most needs. The host's own compaction chose head-and-tail
	 * for exactly that reason, and this policy should not be a regression against the thing it replaces.
	 */
	readonly strategy?: "head" | "head-tail";
	/**
	 * A line of guidance for the model, rendered into the marker. Supplied by the caller because it is
	 * channel-specific: a tool result can be re-queried more narrowly, a background diagnostic cannot.
	 */
	readonly continuation?: string;
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

/**
 * Render the compacted form, **fitting inside the budget the caller gave**.
 *
 * The fixed part of the marker is rendered first so its length is known, and the retained slice takes what is
 * left. The alternative - treating the budget as the retention size - makes "compacted to N characters" a claim
 * the output does not keep, because the marker is added on top of it. A budget that is not a bound is not a
 * budget.
 */
function compact(request: AdmissionRequest, digest: string, artifactRef: string | undefined, maxCharacters: number, nonActionable: boolean, options: ContextAdmissionOptions): string {
	const strategy = options.strategy ?? "head-tail";
	const lines = request.content.split(/\r?\n/).length;
	const fixed = [
		`[admitted content compacted - ${request.channel} from ${request.source}]`,
		`source: ${request.source}`,
		`channel: ${request.channel}`,
		`digest: sha256:${digest}`,
		`omitted: ${request.content.length} characters (${lines} lines total)`,
		...(artifactRef === undefined ? [] : [`artifact: ${artifactRef}`]),
		...(nonActionable
			? ["classification: generated/dependency content - not delivered as actionable task context"]
			: []),
		...(options.continuation === undefined ? [] : [`continuation: ${options.continuation}`]),
	].join("\n");
	const heading = "--- head of the omitted content ---";
	const tailHeading = "--- tail of the omitted content ---";
	// Two blank-line separators, plus the tail heading when there is a tail to label.
	const overhead = fixed.length + heading.length + tailHeading.length + (strategy === "head-tail" ? 8 : 4);
	const retain = Math.max(0, maxCharacters - overhead);
	const headCharacters = strategy === "head-tail" ? Math.floor(retain * 0.75) : retain;
	const tailCharacters = strategy === "head-tail" ? retain - headCharacters : 0;
	const head = request.content.slice(0, headCharacters);
	// The tail always ends at the end, and never overlaps the head.
	const tail = tailCharacters > 0 && request.content.length > headCharacters ? request.content.slice(-tailCharacters) : "";
	return [
		fixed,
		"",
		heading,
		head,
		...(tail === "" ? [] : ["", tailHeading, tail]),
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

	const strategy = options.strategy ?? "head-tail";
	const admitted = compact(request, digest, artifactRef, maxCharacters, nonActionable, options);
	return {
		admitted,
		strategy,
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
