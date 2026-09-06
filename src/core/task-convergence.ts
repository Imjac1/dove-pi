import { createHash } from "node:crypto";

export type AcceptanceStatus = "pending" | "in_progress" | "passed" | "failed" | "waived";
export type FindingKind = "blocking" | "regression" | "follow_up" | "scope_change" | "serious_unexpected_risk";
export type TaskRunState = "working" | "verifying" | "ready_to_finish" | "checkpointed" | "blocked";

export interface AcceptanceCriterionDefinition {
	readonly id: string;
	readonly text: string;
}

export interface AcceptanceCriterionState extends AcceptanceCriterionDefinition {
	readonly status: AcceptanceStatus;
	readonly evidenceRefs: readonly string[];
}

export interface TaskFinding {
	readonly id: string;
	readonly kind: FindingKind;
	readonly discoveredFromAcceptanceId: string;
	readonly summary: string;
	readonly open: boolean;
	readonly evidenceRefs: readonly string[];
	readonly nextAction?: string;
}

export interface TaskResourceObservation {
	readonly toolCalls: number;
	readonly providerRounds: number;
	readonly elapsedMs: number;
	readonly inputTokens?: number;
	readonly cacheReadTokens?: number;
	readonly cacheWriteTokens?: number;
	readonly outputTokens?: number;
	readonly reasoningTokens?: number;
}

export interface TaskCheckpoint {
	readonly acceptanceRevision: string;
	readonly acceptanceVector: Readonly<Record<string, AcceptanceStatus>>;
	readonly openFindingIds: readonly string[];
	readonly nextAcceptanceId: string;
	readonly nextAction: string;
	readonly unblockCondition?: string;
}

export interface TaskCorrectiveAction {
	readonly acceptanceId: string;
	readonly nextAction: string;
}

export interface TaskConvergenceSnapshot {
	readonly schemaVersion: 1;
	readonly taskId: string;
	readonly revision: number;
	readonly acceptanceRevision: string;
	readonly state: TaskRunState;
	readonly criteria: readonly AcceptanceCriterionState[];
	readonly findings: readonly TaskFinding[];
	readonly completedStepIds: readonly string[];
	readonly consecutiveNoProgress: number;
	readonly meaningfulProgressSinceReview: boolean;
	readonly checkpoint?: TaskCheckpoint;
	readonly correctiveAction?: TaskCorrectiveAction;
	readonly observedResources: TaskResourceObservation;
}

interface VersionedEvent {
	readonly schemaVersion: 1;
	readonly kind: string;
}

export type TaskConvergenceEvent =
	| (VersionedEvent & {
		readonly kind: "acceptance.frozen";
		readonly taskId: string;
		readonly criteria: readonly AcceptanceCriterionDefinition[];
		readonly acceptanceRevision: string;
		readonly acceptanceId?: string;
	})
	| (VersionedEvent & { readonly kind: "acceptance.started"; readonly acceptanceId: string })
	| (VersionedEvent & { readonly kind: "acceptance.evidence_attached"; readonly acceptanceId: string; readonly evidenceRef: string })
	| (VersionedEvent & { readonly kind: "acceptance.passed"; readonly acceptanceId: string; readonly evidenceRefs?: readonly string[] })
	| (VersionedEvent & { readonly kind: "acceptance.failed"; readonly acceptanceId: string; readonly evidenceRefs?: readonly string[] })
	| (VersionedEvent & { readonly kind: "acceptance.waived"; readonly acceptanceId: string; readonly evidenceRef: string })
	| (VersionedEvent & { readonly kind: "planned_step.completed"; readonly acceptanceId: string; readonly stepId: string })
	| (VersionedEvent & {
		readonly kind: "finding.recorded";
		readonly acceptanceId: string;
		readonly finding: Omit<TaskFinding, "discoveredFromAcceptanceId" | "open">;
		readonly nextAction?: string;
	})
	| (VersionedEvent & { readonly kind: "finding.updated"; readonly acceptanceId: string; readonly findingId: string; readonly evidenceRefs?: readonly string[]; readonly summary?: string; readonly nextAction?: string })
	| (VersionedEvent & { readonly kind: "finding.resolved"; readonly acceptanceId: string; readonly findingId: string; readonly evidenceRefs?: readonly string[] })
	| (VersionedEvent & { readonly kind: "task.verification_started"; readonly acceptanceId: string })
	| (VersionedEvent & { readonly kind: "task.progress_reviewed"; readonly acceptanceId: string; readonly nextAction: string })
	| (VersionedEvent & { readonly kind: "task.checkpointed"; readonly acceptanceId: string; readonly nextAction: string })
	| (VersionedEvent & { readonly kind: "task.blocked"; readonly acceptanceId: string; readonly nextAction: string; readonly unblockCondition: string })
	| (VersionedEvent & { readonly kind: "task.resumed"; readonly acceptanceId: string; readonly acceptanceRevision: string })
	| (VersionedEvent & { readonly kind: "request.observed"; readonly acceptanceId: string; readonly resources: TaskResourceObservation });

export class TaskConvergenceValidationError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "TaskConvergenceValidationError";
	}
}

const ACCEPTANCE_ID_PATTERN = /^AC-[A-Z0-9][A-Z0-9_-]{0,31}$/;
const GENERIC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ACCEPTANCE_STATUSES = new Set<AcceptanceStatus>(["pending", "in_progress", "passed", "failed", "waived"]);
const FINDING_KINDS = new Set<FindingKind>(["blocking", "regression", "follow_up", "scope_change", "serious_unexpected_risk"]);
const RUN_STATES = new Set<TaskRunState>(["working", "verifying", "ready_to_finish", "checkpointed", "blocked"]);
const MAX_CRITERIA = 100;
const MAX_FINDINGS = 100;
const MAX_COMPLETED_STEPS = 200;
const MAX_EVIDENCE_REFS = 32;
const MAX_TEXT = 2_000;

export function computeAcceptanceRevision(criteria: readonly AcceptanceCriterionDefinition[]): string {
	const normalized = normalizeCriterionDefinitions(criteria);
	const payload = normalized.map((criterion) => `${criterion.id}\0${criterion.text}`).join("\n");
	return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function decodeTaskConvergenceEvent(value: unknown): TaskConvergenceEvent {
	const event = requireRecord(value, "event");
	requireExactInteger(event.schemaVersion, "event.schemaVersion", 1, 1);
	const kind = requireString(event.kind, "event.kind", 64);
	const base = { schemaVersion: 1 as const };
	if (kind === "acceptance.frozen") {
		const criteria = decodeCriterionDefinitions(event.criteria);
		const acceptanceRevision = requirePattern(event.acceptanceRevision, "event.acceptanceRevision", SHA256_PATTERN, 64);
		if (computeAcceptanceRevision(criteria) !== acceptanceRevision) throw invalid("event.acceptanceRevision does not match criteria");
		return { ...base, kind, taskId: requirePattern(event.taskId, "event.taskId", GENERIC_ID_PATTERN, 128), criteria, acceptanceRevision, ...optionalAcceptanceId(event) };
	}
	if (kind === "acceptance.started" || kind === "task.verification_started") return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId) };
	if (kind === "acceptance.evidence_attached") return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), evidenceRef: requireEvidenceRef(event.evidenceRef, "event.evidenceRef") };
	if (kind === "acceptance.passed" || kind === "acceptance.failed") return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), ...optionalEvidenceRefs(event.evidenceRefs, "event.evidenceRefs") };
	if (kind === "acceptance.waived") return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), evidenceRef: requireEvidenceRef(event.evidenceRef, "event.evidenceRef") };
	if (kind === "planned_step.completed") return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), stepId: requirePattern(event.stepId, "event.stepId", GENERIC_ID_PATTERN, 128) };
	if (kind === "finding.recorded") {
		const finding = requireRecord(event.finding, "event.finding");
		const findingKind = requireEnum(finding.kind, "event.finding.kind", FINDING_KINDS);
		const nextAction = optionalString(event.nextAction, "event.nextAction", MAX_TEXT);
		if ((findingKind === "scope_change" || findingKind === "serious_unexpected_risk") && !nextAction) throw invalid(`event.nextAction is required for ${findingKind}`);
		return {
			...base,
			kind,
			acceptanceId: requireAcceptanceId(event.acceptanceId),
			finding: {
				id: requirePattern(finding.id, "event.finding.id", GENERIC_ID_PATTERN, 128),
				kind: findingKind,
				 summary: requireString(finding.summary, "event.finding.summary", MAX_TEXT),
				evidenceRefs: decodeEvidenceRefs(finding.evidenceRefs, "event.finding.evidenceRefs"),
				...(optionalString(finding.nextAction, "event.finding.nextAction", MAX_TEXT) ? { nextAction: optionalString(finding.nextAction, "event.finding.nextAction", MAX_TEXT) } : {}),
			},
			...(nextAction ? { nextAction } : {}),
		};
	}
	if (kind === "finding.updated") {
		const evidenceRefs = event.evidenceRefs === undefined ? undefined : decodeEvidenceRefs(event.evidenceRefs, "event.evidenceRefs");
		const summary = optionalString(event.summary, "event.summary", MAX_TEXT);
		const nextAction = optionalString(event.nextAction, "event.nextAction", MAX_TEXT);
		if ((!evidenceRefs || evidenceRefs.length === 0) && !summary && !nextAction) throw invalid("finding.updated requires evidenceRefs, summary, or nextAction");
		return {
			...base,
			kind,
			acceptanceId: requireAcceptanceId(event.acceptanceId),
			findingId: requirePattern(event.findingId, "event.findingId", GENERIC_ID_PATTERN, 128),
			...(evidenceRefs ? { evidenceRefs } : {}),
			...(summary ? { summary } : {}),
			...(nextAction ? { nextAction } : {}),
		};
	}
	if (kind === "finding.resolved") return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), findingId: requirePattern(event.findingId, "event.findingId", GENERIC_ID_PATTERN, 128), ...optionalEvidenceRefs(event.evidenceRefs, "event.evidenceRefs") };
	if (kind === "task.progress_reviewed" || kind === "task.checkpointed") return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), nextAction: requireString(event.nextAction, "event.nextAction", MAX_TEXT) };
	if (kind === "task.blocked") return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), nextAction: requireString(event.nextAction, "event.nextAction", MAX_TEXT), unblockCondition: requireString(event.unblockCondition, "event.unblockCondition", MAX_TEXT) };
	if (kind === "task.resumed") return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), acceptanceRevision: requirePattern(event.acceptanceRevision, "event.acceptanceRevision", SHA256_PATTERN, 64) };
	if (kind === "request.observed") return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), resources: decodeResources(event.resources, "event.resources") };
	throw invalid(`Unsupported convergence event kind: ${kind}`);
}

export function decodeTaskConvergenceSnapshot(value: unknown): TaskConvergenceSnapshot {
	const snapshot = requireRecord(value, "snapshot");
	requireExactInteger(snapshot.schemaVersion, "snapshot.schemaVersion", 1, 1);
	const criteria = decodeCriterionStates(snapshot.criteria);
	const acceptanceRevision = requirePattern(snapshot.acceptanceRevision, "snapshot.acceptanceRevision", SHA256_PATTERN, 64);
	if (computeAcceptanceRevision(criteria) !== acceptanceRevision) throw invalid("snapshot.acceptanceRevision does not match criteria");
	const findings = decodeFindings(snapshot.findings, criteria);
	const completedStepIds = decodeUniqueIds(snapshot.completedStepIds, "snapshot.completedStepIds", MAX_COMPLETED_STEPS);
	const state = requireEnum(snapshot.state, "snapshot.state", RUN_STATES);
	const checkpoint = snapshot.checkpoint === undefined ? undefined : decodeCheckpoint(snapshot.checkpoint, criteria, findings, acceptanceRevision, state);
	const correctiveAction = snapshot.correctiveAction === undefined ? undefined : decodeCorrectiveAction(snapshot.correctiveAction, criteria);
	if ((state === "checkpointed" || state === "blocked") !== Boolean(checkpoint)) throw invalid(`snapshot.checkpoint must match terminal state ${state}`);
	if (state === "blocked" && !checkpoint?.unblockCondition) throw invalid("blocked snapshot requires an unblock condition");
	if (correctiveAction && (state !== "working" || snapshot.consecutiveNoProgress !== 1)) throw invalid("corrective action requires working state at the first no-progress decision");
	if (state === "ready_to_finish" && !isReady(criteria, findings)) throw invalid("ready_to_finish snapshot has unmet acceptance work");
	return freezeSnapshot({
		schemaVersion: 1,
		taskId: requirePattern(snapshot.taskId, "snapshot.taskId", GENERIC_ID_PATTERN, 128),
		revision: requireExactInteger(snapshot.revision, "snapshot.revision", 1, Number.MAX_SAFE_INTEGER),
		acceptanceRevision,
		state,
		criteria,
		findings,
		completedStepIds,
		consecutiveNoProgress: requireExactInteger(snapshot.consecutiveNoProgress, "snapshot.consecutiveNoProgress", 0, 2),
		meaningfulProgressSinceReview: requireBoolean(snapshot.meaningfulProgressSinceReview, "snapshot.meaningfulProgressSinceReview"),
		...(checkpoint ? { checkpoint } : {}),
		...(correctiveAction ? { correctiveAction } : {}),
		observedResources: decodeResources(snapshot.observedResources, "snapshot.observedResources"),
	});
}

export function reduceTaskConvergence(current: TaskConvergenceSnapshot | undefined, input: TaskConvergenceEvent | unknown): TaskConvergenceSnapshot {
	const event = decodeTaskConvergenceEvent(input);
	if (!current) {
		if (event.kind !== "acceptance.frozen") throw invalid("acceptance.frozen must be the first convergence event");
		return freezeSnapshot({
			schemaVersion: 1,
			taskId: event.taskId,
			revision: 1,
			acceptanceRevision: event.acceptanceRevision,
			state: "working",
			criteria: event.criteria.map((criterion) => ({ ...criterion, status: "pending" as const, evidenceRefs: [] })),
			findings: [],
			completedStepIds: [],
			consecutiveNoProgress: 0,
			meaningfulProgressSinceReview: false,
			observedResources: emptyResources(),
		});
	}
	const snapshot = decodeTaskConvergenceSnapshot(current);
	if (event.kind === "acceptance.frozen") return reduceRefreeze(snapshot, event);
	requireKnownAcceptance(snapshot, event.acceptanceId);
	if (event.kind === "request.observed") {
		return freezeSnapshot({ ...snapshot, revision: snapshot.revision + 1, observedResources: addResources(snapshot.observedResources, event.resources) });
	}
	if ((snapshot.state === "checkpointed" || snapshot.state === "blocked") && event.kind !== "task.resumed") throw invalid(`Cannot apply ${event.kind} while task is ${snapshot.state}`);
	if (snapshot.state === "ready_to_finish") throw invalid(`Cannot apply ${event.kind} after ready_to_finish`);

	switch (event.kind) {
		case "acceptance.started":
			return updateCriterion(snapshot, event.acceptanceId, (criterion) => criterion.status === "pending" ? { ...criterion, status: "in_progress" } : criterion, true);
		case "acceptance.evidence_attached":
			return updateCriterion(snapshot, event.acceptanceId, (criterion) => ({ ...criterion, evidenceRefs: appendUnique(criterion.evidenceRefs, event.evidenceRef, MAX_EVIDENCE_REFS, "criterion evidence") }), true);
		case "acceptance.passed":
			return updateCriterion(snapshot, event.acceptanceId, (criterion) => ({ ...criterion, status: "passed", evidenceRefs: appendManyUnique(criterion.evidenceRefs, event.evidenceRefs ?? [], MAX_EVIDENCE_REFS, "criterion evidence") }), true);
		case "acceptance.failed":
			return updateCriterion(snapshot, event.acceptanceId, (criterion) => ({ ...criterion, status: "failed", evidenceRefs: appendManyUnique(criterion.evidenceRefs, event.evidenceRefs ?? [], MAX_EVIDENCE_REFS, "criterion evidence") }), "evidence_only");
		case "acceptance.waived":
			return updateCriterion(snapshot, event.acceptanceId, (criterion) => ({ ...criterion, status: "waived", evidenceRefs: appendUnique(criterion.evidenceRefs, event.evidenceRef, MAX_EVIDENCE_REFS, "criterion evidence") }), true);
		case "planned_step.completed": {
			const completedStepIds = appendUnique(snapshot.completedStepIds, `${event.acceptanceId}:${event.stepId}`, MAX_COMPLETED_STEPS, "completed steps");
			const meaningful = completedStepIds !== snapshot.completedStepIds;
			return nextSnapshot(snapshot, {
				completedStepIds,
				meaningfulProgressSinceReview: meaningful || snapshot.meaningfulProgressSinceReview,
				...(meaningful ? { consecutiveNoProgress: 0, correctiveAction: undefined } : {}),
			});
		}
		case "finding.recorded":
			return recordFinding(snapshot, event);
		case "finding.updated":
			return updateFinding(snapshot, event);
		case "finding.resolved":
			return resolveFinding(snapshot, event);
		case "task.verification_started":
			return nextSnapshot(snapshot, { state: "verifying" });
		case "task.progress_reviewed":
			return reviewProgress(snapshot, event.acceptanceId, event.nextAction);
		case "task.checkpointed":
			return nextSnapshot(snapshot, { state: "checkpointed", checkpoint: makeCheckpoint(snapshot, event.acceptanceId, event.nextAction), correctiveAction: undefined });
		case "task.blocked":
			return nextSnapshot(snapshot, { state: "blocked", checkpoint: makeCheckpoint(snapshot, event.acceptanceId, event.nextAction, event.unblockCondition), correctiveAction: undefined });
		case "task.resumed":
			return resumeTask(snapshot, event);
		default:
			return assertNever(event);
	}
}

export function replayTaskConvergence(events: readonly unknown[]): TaskConvergenceSnapshot {
	let snapshot: TaskConvergenceSnapshot | undefined;
	for (const event of events) snapshot = reduceTaskConvergence(snapshot, event);
	if (!snapshot) throw invalid("At least one convergence event is required");
	return snapshot;
}

function reduceRefreeze(snapshot: TaskConvergenceSnapshot, event: Extract<TaskConvergenceEvent, { kind: "acceptance.frozen" }>): TaskConvergenceSnapshot {
	if (event.taskId !== snapshot.taskId) throw invalid(`Task identity changed from ${snapshot.taskId} to ${event.taskId}`);
	if (event.acceptanceRevision === snapshot.acceptanceRevision) return nextSnapshot(snapshot, {});
	const acceptanceId = event.acceptanceId ?? snapshot.criteria[0]?.id;
	if (!acceptanceId) throw invalid("Scope drift requires an existing acceptance ID");
	requireKnownAcceptance(snapshot, acceptanceId);
	const findingId = `scope-change:${event.acceptanceRevision.slice(0, 12)}`;
	const findings = appendFinding(snapshot.findings, {
		id: findingId,
		kind: "scope_change",
		discoveredFromAcceptanceId: acceptanceId,
		summary: `Acceptance revision changed from ${snapshot.acceptanceRevision} to ${event.acceptanceRevision}`,
		open: true,
		evidenceRefs: [],
	});
	return nextSnapshot(snapshot, {
		state: "checkpointed",
		findings,
		checkpoint: makeCheckpoint({ ...snapshot, findings }, acceptanceId, `Return to planning for ${acceptanceId}`),
		correctiveAction: undefined,
	});
}

function recordFinding(snapshot: TaskConvergenceSnapshot, event: Extract<TaskConvergenceEvent, { kind: "finding.recorded" }>): TaskConvergenceSnapshot {
	const finding: TaskFinding = { ...event.finding, discoveredFromAcceptanceId: event.acceptanceId, open: true };
	const findings = appendFinding(snapshot.findings, finding);
	if (finding.kind === "scope_change" || finding.kind === "serious_unexpected_risk") {
		return nextSnapshot(snapshot, {
			findings,
			state: "checkpointed",
			checkpoint: makeCheckpoint({ ...snapshot, findings }, event.acceptanceId, event.nextAction ?? `Review ${finding.id}`),
			correctiveAction: undefined,
		});
	}
	return nextSnapshot(snapshot, { findings });
}

function updateFinding(snapshot: TaskConvergenceSnapshot, event: Extract<TaskConvergenceEvent, { kind: "finding.updated" }>): TaskConvergenceSnapshot {
	const index = snapshot.findings.findIndex((finding) => finding.id === event.findingId);
	if (index < 0) throw invalid(`Unknown finding ID: ${event.findingId}`);
	const existing = snapshot.findings[index]!;
	if (existing.discoveredFromAcceptanceId !== event.acceptanceId) throw invalid(`Finding ${event.findingId} is not attributed to ${event.acceptanceId}`);
	const updated = {
		...existing,
		...(event.summary ? { summary: event.summary } : {}),
		...(event.nextAction ? { nextAction: event.nextAction } : {}),
		evidenceRefs: appendManyUnique(existing.evidenceRefs, event.evidenceRefs ?? [], MAX_EVIDENCE_REFS, "finding evidence"),
	};
	return nextSnapshot(snapshot, { findings: snapshot.findings.map((finding, findingIndex) => findingIndex === index ? updated : finding) });
}

function resolveFinding(snapshot: TaskConvergenceSnapshot, event: Extract<TaskConvergenceEvent, { kind: "finding.resolved" }>): TaskConvergenceSnapshot {
	const index = snapshot.findings.findIndex((finding) => finding.id === event.findingId);
	if (index < 0) throw invalid(`Unknown finding ID: ${event.findingId}`);
	const existing = snapshot.findings[index]!;
	if (existing.discoveredFromAcceptanceId !== event.acceptanceId) throw invalid(`Finding ${event.findingId} is not attributed to ${event.acceptanceId}`);
	const resolved = { ...existing, open: false, evidenceRefs: appendManyUnique(existing.evidenceRefs, event.evidenceRefs ?? [], MAX_EVIDENCE_REFS, "finding evidence") };
	const findings = snapshot.findings.map((finding, findingIndex) => findingIndex === index ? resolved : finding);
	const meaningful = existing.open && (existing.kind === "blocking" || existing.kind === "regression");
	return finalizeSemanticState(nextSnapshot(snapshot, {
		findings,
		meaningfulProgressSinceReview: meaningful || snapshot.meaningfulProgressSinceReview,
		...(meaningful ? { consecutiveNoProgress: 0, correctiveAction: undefined } : {}),
	}));
}

function reviewProgress(snapshot: TaskConvergenceSnapshot, acceptanceId: string, nextAction: string): TaskConvergenceSnapshot {
	if (snapshot.meaningfulProgressSinceReview) return nextSnapshot(snapshot, { consecutiveNoProgress: 0, meaningfulProgressSinceReview: false, correctiveAction: undefined });
	const consecutiveNoProgress = Math.min(2, snapshot.consecutiveNoProgress + 1);
	if (consecutiveNoProgress < 2) return nextSnapshot(snapshot, { consecutiveNoProgress, correctiveAction: { acceptanceId, nextAction } });
	return nextSnapshot(snapshot, {
		state: "checkpointed",
		consecutiveNoProgress,
		checkpoint: makeCheckpoint(snapshot, acceptanceId, nextAction),
		correctiveAction: undefined,
	});
}

function resumeTask(snapshot: TaskConvergenceSnapshot, event: Extract<TaskConvergenceEvent, { kind: "task.resumed" }>): TaskConvergenceSnapshot {
	if (event.acceptanceRevision !== snapshot.acceptanceRevision) {
		const findingId = `scope-change:${event.acceptanceRevision.slice(0, 12)}`;
		const findings = appendFinding(snapshot.findings, {
			id: findingId,
			kind: "scope_change",
			discoveredFromAcceptanceId: event.acceptanceId,
			summary: `Resume revision ${event.acceptanceRevision} does not match frozen revision ${snapshot.acceptanceRevision}`,
			open: true,
			evidenceRefs: [],
		});
		return nextSnapshot(snapshot, { findings, state: "checkpointed", checkpoint: makeCheckpoint({ ...snapshot, findings }, event.acceptanceId, `Return to planning for ${event.acceptanceId}`) });
	}
	if (snapshot.checkpoint?.nextAcceptanceId !== event.acceptanceId) throw invalid(`Resume must continue checkpoint acceptance ${snapshot.checkpoint?.nextAcceptanceId ?? "unknown"}`);
	return nextSnapshot(snapshot, { state: "working", checkpoint: undefined, correctiveAction: undefined, consecutiveNoProgress: 0, meaningfulProgressSinceReview: false });
}

function updateCriterion(snapshot: TaskConvergenceSnapshot, acceptanceId: string, update: (criterion: AcceptanceCriterionState) => AcceptanceCriterionState, progressMode: boolean | "evidence_only"): TaskConvergenceSnapshot {
	const index = snapshot.criteria.findIndex((criterion) => criterion.id === acceptanceId);
	const before = snapshot.criteria[index]!;
	const after = update(before);
	const changed = after.status !== before.status || after.evidenceRefs !== before.evidenceRefs;
	const criteria = changed ? snapshot.criteria.map((criterion, criterionIndex) => criterionIndex === index ? after : criterion) : snapshot.criteria;
	const evidenceAdded = after.evidenceRefs.length > before.evidenceRefs.length;
	const meaningful = progressMode === "evidence_only" ? evidenceAdded : progressMode && changed;
	return finalizeSemanticState(nextSnapshot(snapshot, {
		criteria,
		meaningfulProgressSinceReview: snapshot.meaningfulProgressSinceReview || meaningful,
		...(meaningful ? { consecutiveNoProgress: 0, correctiveAction: undefined } : {}),
	}));
}

function finalizeSemanticState(snapshot: TaskConvergenceSnapshot): TaskConvergenceSnapshot {
	if (!isReady(snapshot.criteria, snapshot.findings) || snapshot.state === "checkpointed" || snapshot.state === "blocked") return snapshot;
	return replaceSnapshot(snapshot, { state: "ready_to_finish", checkpoint: undefined, correctiveAction: undefined });
}

function isReady(criteria: readonly AcceptanceCriterionState[], findings: readonly TaskFinding[]): boolean {
	return criteria.every((criterion) => criterion.status === "passed" || criterion.status === "waived")
		&& !findings.some((finding) => finding.open && finding.kind !== "follow_up");
}

function makeCheckpoint(snapshot: Pick<TaskConvergenceSnapshot, "acceptanceRevision" | "criteria" | "findings">, acceptanceId: string, nextAction: string, unblockCondition?: string): TaskCheckpoint {
	return {
		acceptanceRevision: snapshot.acceptanceRevision,
		acceptanceVector: Object.fromEntries(snapshot.criteria.map((criterion) => [criterion.id, criterion.status])),
		openFindingIds: snapshot.findings.filter((finding) => finding.open).map((finding) => finding.id),
		nextAcceptanceId: acceptanceId,
		nextAction,
		...(unblockCondition ? { unblockCondition } : {}),
	};
}

function nextSnapshot(snapshot: TaskConvergenceSnapshot, changes: Partial<TaskConvergenceSnapshot>): TaskConvergenceSnapshot {
	return finalizeIfReady(freezeSnapshot({ ...snapshot, ...changes, revision: snapshot.revision + 1 }));
}

function replaceSnapshot(snapshot: TaskConvergenceSnapshot, changes: Partial<TaskConvergenceSnapshot>): TaskConvergenceSnapshot {
	return freezeSnapshot({ ...snapshot, ...changes });
}

function finalizeIfReady(snapshot: TaskConvergenceSnapshot): TaskConvergenceSnapshot {
	if (snapshot.state === "checkpointed" || snapshot.state === "blocked" || !isReady(snapshot.criteria, snapshot.findings)) return snapshot;
	return replaceSnapshot(snapshot, { state: "ready_to_finish", checkpoint: undefined, correctiveAction: undefined });
}

function requireKnownAcceptance(snapshot: TaskConvergenceSnapshot, acceptanceId: string): void {
	if (!snapshot.criteria.some((criterion) => criterion.id === acceptanceId)) throw invalid(`Unknown acceptance ID: ${acceptanceId}`);
}

function appendFinding(findings: readonly TaskFinding[], finding: TaskFinding): readonly TaskFinding[] {
	if (findings.some((candidate) => candidate.id === finding.id)) throw invalid(`Duplicate finding ID: ${finding.id}`);
	if (findings.length >= MAX_FINDINGS) throw invalid(`findings exceeds ${MAX_FINDINGS}`);
	return [...findings, finding];
}

function addResources(current: TaskResourceObservation, sample: TaskResourceObservation): TaskResourceObservation {
	const add = (left: number, right: number, label: string): number => {
		const result = left + right;
		if (!Number.isSafeInteger(result)) throw invalid(`${label} aggregate exceeds a safe integer`);
		return result;
	};
	const addOptional = (key: "inputTokens" | "cacheReadTokens" | "cacheWriteTokens" | "outputTokens" | "reasoningTokens"): number | undefined => {
		const incoming = sample[key];
		if (incoming === undefined) return current[key];
		return add(current[key] ?? 0, incoming, key);
	};
	return {
		toolCalls: add(current.toolCalls, sample.toolCalls, "toolCalls"),
		providerRounds: add(current.providerRounds, sample.providerRounds, "providerRounds"),
		elapsedMs: add(current.elapsedMs, sample.elapsedMs, "elapsedMs"),
		...definedNumber("inputTokens", addOptional("inputTokens")),
		...definedNumber("cacheReadTokens", addOptional("cacheReadTokens")),
		...definedNumber("cacheWriteTokens", addOptional("cacheWriteTokens")),
		...definedNumber("outputTokens", addOptional("outputTokens")),
		...definedNumber("reasoningTokens", addOptional("reasoningTokens")),
	};
}

function emptyResources(): TaskResourceObservation {
	return { toolCalls: 0, providerRounds: 0, elapsedMs: 0 };
}

function freezeSnapshot(snapshot: TaskConvergenceSnapshot): TaskConvergenceSnapshot {
	const criteria = snapshot.criteria.map((criterion) => Object.freeze({ ...criterion, evidenceRefs: Object.freeze([...criterion.evidenceRefs]) }));
	const findings = snapshot.findings.map((finding) => Object.freeze({ ...finding, evidenceRefs: Object.freeze([...finding.evidenceRefs]) }));
	const checkpoint = snapshot.checkpoint ? Object.freeze({ ...snapshot.checkpoint, acceptanceVector: Object.freeze({ ...snapshot.checkpoint.acceptanceVector }), openFindingIds: Object.freeze([...snapshot.checkpoint.openFindingIds]) }) : undefined;
	return Object.freeze({
		...snapshot,
		criteria: Object.freeze(criteria),
		findings: Object.freeze(findings),
		completedStepIds: Object.freeze([...snapshot.completedStepIds]),
		...(checkpoint ? { checkpoint } : { checkpoint: undefined }),
		...(snapshot.correctiveAction ? { correctiveAction: Object.freeze({ ...snapshot.correctiveAction }) } : { correctiveAction: undefined }),
		observedResources: Object.freeze({ ...snapshot.observedResources }),
	});
}

function normalizeCriterionDefinitions(value: readonly AcceptanceCriterionDefinition[]): readonly AcceptanceCriterionDefinition[] {
	if (value.length < 1 || value.length > MAX_CRITERIA) throw invalid(`criteria must contain 1-${MAX_CRITERIA} entries`);
	const seen = new Set<string>();
	return value.map((criterion, index) => {
		const id = requireAcceptanceId(criterion.id, `criteria[${index}].id`);
		if (seen.has(id)) throw invalid(`Duplicate acceptance ID: ${id}`);
		seen.add(id);
		return { id, text: normalizeText(requireString(criterion.text, `criteria[${index}].text`, MAX_TEXT)) };
	});
}

function decodeCriterionDefinitions(value: unknown): readonly AcceptanceCriterionDefinition[] {
	if (!Array.isArray(value)) throw invalid("event.criteria must be an array");
	return normalizeCriterionDefinitions(value.map((entry, index) => {
		const criterion = requireRecord(entry, `event.criteria[${index}]`);
		return { id: criterion.id as string, text: criterion.text as string };
	}));
}

function decodeCriterionStates(value: unknown): readonly AcceptanceCriterionState[] {
	if (!Array.isArray(value)) throw invalid("snapshot.criteria must be an array");
	const definitions = normalizeCriterionDefinitions(value.map((entry, index) => {
		const criterion = requireRecord(entry, `snapshot.criteria[${index}]`);
		return { id: criterion.id as string, text: criterion.text as string };
	}));
	return value.map((entry, index) => {
		const criterion = requireRecord(entry, `snapshot.criteria[${index}]`);
		return { ...definitions[index]!, status: requireEnum(criterion.status, `snapshot.criteria[${index}].status`, ACCEPTANCE_STATUSES), evidenceRefs: decodeEvidenceRefs(criterion.evidenceRefs, `snapshot.criteria[${index}].evidenceRefs`) };
	});
}

function decodeFindings(value: unknown, criteria: readonly AcceptanceCriterionDefinition[]): readonly TaskFinding[] {
	if (!Array.isArray(value) || value.length > MAX_FINDINGS) throw invalid(`snapshot.findings must contain at most ${MAX_FINDINGS} entries`);
	const acceptanceIds = new Set(criteria.map((criterion) => criterion.id));
	const findingIds = new Set<string>();
	return value.map((entry, index) => {
		const finding = requireRecord(entry, `snapshot.findings[${index}]`);
		const id = requirePattern(finding.id, `snapshot.findings[${index}].id`, GENERIC_ID_PATTERN, 128);
		if (findingIds.has(id)) throw invalid(`Duplicate finding ID: ${id}`);
		findingIds.add(id);
		const discoveredFromAcceptanceId = requireAcceptanceId(finding.discoveredFromAcceptanceId, `snapshot.findings[${index}].discoveredFromAcceptanceId`);
		if (!acceptanceIds.has(discoveredFromAcceptanceId)) throw invalid(`Unknown acceptance ID: ${discoveredFromAcceptanceId}`);
		return {
			id,
			kind: requireEnum(finding.kind, `snapshot.findings[${index}].kind`, FINDING_KINDS),
			discoveredFromAcceptanceId,
			summary: requireString(finding.summary, `snapshot.findings[${index}].summary`, MAX_TEXT),
			open: requireBoolean(finding.open, `snapshot.findings[${index}].open`),
			evidenceRefs: decodeEvidenceRefs(finding.evidenceRefs, `snapshot.findings[${index}].evidenceRefs`),
			...(optionalString(finding.nextAction, `snapshot.findings[${index}].nextAction`, MAX_TEXT) ? { nextAction: optionalString(finding.nextAction, `snapshot.findings[${index}].nextAction`, MAX_TEXT) } : {}),
		};
	});
}

function decodeCheckpoint(value: unknown, criteria: readonly AcceptanceCriterionState[], findings: readonly TaskFinding[], acceptanceRevision: string, state: TaskRunState): TaskCheckpoint {
	const checkpoint = requireRecord(value, "snapshot.checkpoint");
	if (checkpoint.acceptanceRevision !== acceptanceRevision) throw invalid("checkpoint acceptance revision does not match snapshot");
	const vector = requireRecord(checkpoint.acceptanceVector, "snapshot.checkpoint.acceptanceVector");
	const acceptanceVector: Record<string, AcceptanceStatus> = {};
	for (const criterion of criteria) {
		acceptanceVector[criterion.id] = requireEnum(vector[criterion.id], `snapshot.checkpoint.acceptanceVector.${criterion.id}`, ACCEPTANCE_STATUSES);
		if (acceptanceVector[criterion.id] !== criterion.status) throw invalid(`checkpoint acceptance vector for ${criterion.id} does not match snapshot`);
	}
	if (Object.keys(vector).length !== criteria.length) throw invalid("checkpoint acceptance vector must contain exactly the frozen acceptance IDs");
	const openFindingIds = decodeUniqueIds(checkpoint.openFindingIds, "snapshot.checkpoint.openFindingIds", MAX_FINDINGS);
	const expectedOpen = findings.filter((finding) => finding.open).map((finding) => finding.id);
	if (openFindingIds.join("\0") !== expectedOpen.join("\0")) throw invalid("checkpoint open findings do not match snapshot");
	const nextAcceptanceId = requireAcceptanceId(checkpoint.nextAcceptanceId, "snapshot.checkpoint.nextAcceptanceId");
	if (!criteria.some((criterion) => criterion.id === nextAcceptanceId)) throw invalid(`Unknown acceptance ID: ${nextAcceptanceId}`);
	const unblockCondition = optionalString(checkpoint.unblockCondition, "snapshot.checkpoint.unblockCondition", MAX_TEXT);
	if (state === "blocked" && !unblockCondition) throw invalid("blocked checkpoint requires an unblock condition");
	return { acceptanceRevision, acceptanceVector, openFindingIds, nextAcceptanceId, nextAction: requireString(checkpoint.nextAction, "snapshot.checkpoint.nextAction", MAX_TEXT), ...(unblockCondition ? { unblockCondition } : {}) };
}

function decodeCorrectiveAction(value: unknown, criteria: readonly AcceptanceCriterionState[]): TaskCorrectiveAction {
	const action = requireRecord(value, "snapshot.correctiveAction");
	const acceptanceId = requireAcceptanceId(action.acceptanceId, "snapshot.correctiveAction.acceptanceId");
	if (!criteria.some((criterion) => criterion.id === acceptanceId)) throw invalid(`Unknown acceptance ID: ${acceptanceId}`);
	return { acceptanceId, nextAction: requireString(action.nextAction, "snapshot.correctiveAction.nextAction", MAX_TEXT) };
}

function decodeResources(value: unknown, path: string): TaskResourceObservation {
	const resources = requireRecord(value, path);
	return {
		toolCalls: requireExactInteger(resources.toolCalls, `${path}.toolCalls`, 0, Number.MAX_SAFE_INTEGER),
		providerRounds: requireExactInteger(resources.providerRounds, `${path}.providerRounds`, 0, Number.MAX_SAFE_INTEGER),
		elapsedMs: requireExactInteger(resources.elapsedMs, `${path}.elapsedMs`, 0, Number.MAX_SAFE_INTEGER),
		...optionalNonNegativeInteger(resources.inputTokens, `${path}.inputTokens`, "inputTokens"),
		...optionalNonNegativeInteger(resources.cacheReadTokens, `${path}.cacheReadTokens`, "cacheReadTokens"),
		...optionalNonNegativeInteger(resources.cacheWriteTokens, `${path}.cacheWriteTokens`, "cacheWriteTokens"),
		...optionalNonNegativeInteger(resources.outputTokens, `${path}.outputTokens`, "outputTokens"),
		...optionalNonNegativeInteger(resources.reasoningTokens, `${path}.reasoningTokens`, "reasoningTokens"),
	};
}

function decodeEvidenceRefs(value: unknown, path: string): readonly string[] {
	if (!Array.isArray(value) || value.length > MAX_EVIDENCE_REFS) throw invalid(`${path} must contain at most ${MAX_EVIDENCE_REFS} entries`);
	const refs = value.map((entry, index) => requireEvidenceRef(entry, `${path}[${index}]`));
	if (new Set(refs).size !== refs.length) throw invalid(`${path} contains duplicate entries`);
	return refs;
}

function decodeUniqueIds(value: unknown, path: string, maximum: number): readonly string[] {
	if (!Array.isArray(value) || value.length > maximum) throw invalid(`${path} must contain at most ${maximum} entries`);
	const ids = value.map((entry, index) => requirePattern(entry, `${path}[${index}]`, GENERIC_ID_PATTERN, 128));
	if (new Set(ids).size !== ids.length) throw invalid(`${path} contains duplicate entries`);
	return ids;
}

function appendUnique(values: readonly string[], value: string, maximum: number, label: string): readonly string[] {
	if (values.includes(value)) return values;
	if (values.length >= maximum) throw invalid(`${label} exceeds ${maximum}`);
	return [...values, value];
}

function appendManyUnique(values: readonly string[], additions: readonly string[], maximum: number, label: string): readonly string[] {
	let result = values;
	for (const addition of additions) result = appendUnique(result, addition, maximum, label);
	return result;
}

function optionalAcceptanceId(record: Record<string, unknown>): { readonly acceptanceId?: string } {
	return record.acceptanceId === undefined ? {} : { acceptanceId: requireAcceptanceId(record.acceptanceId) };
}

function optionalEvidenceRefs(value: unknown, path: string): { readonly evidenceRefs?: readonly string[] } {
	return value === undefined ? {} : { evidenceRefs: decodeEvidenceRefs(value, path) };
}

function optionalNonNegativeInteger(value: unknown, path: string, key: "inputTokens" | "cacheReadTokens" | "cacheWriteTokens" | "outputTokens" | "reasoningTokens"): Partial<Record<typeof key, number>> {
	return value === undefined ? {} : { [key]: requireExactInteger(value, path, 0, Number.MAX_SAFE_INTEGER) };
}

function definedNumber<Key extends string>(key: Key, value: number | undefined): Partial<Record<Key, number>> {
	return value === undefined ? {} : { [key]: value } as Partial<Record<Key, number>>;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(`${path} must be an object`);
	return value as Record<string, unknown>;
}

function requireString(value: unknown, path: string, maximum: number): string {
	if (typeof value !== "string") throw invalid(`${path} must be a string`);
	const normalized = normalizeText(value);
	if (!normalized || normalized.length > maximum) throw invalid(`${path} must contain 1-${maximum} characters`);
	return normalized;
}

function optionalString(value: unknown, path: string, maximum: number): string | undefined {
	return value === undefined ? undefined : requireString(value, path, maximum);
}

function requirePattern(value: unknown, path: string, pattern: RegExp, maximum: number): string {
	const text = requireString(value, path, maximum);
	if (!pattern.test(text)) throw invalid(`${path} has an invalid format`);
	return text;
}

function requireAcceptanceId(value: unknown, path = "event.acceptanceId"): string {
	return requirePattern(value, path, ACCEPTANCE_ID_PATTERN, 35);
}

function requireEvidenceRef(value: unknown, path: string): string {
	const reference = requireString(value, path, 128);
	if (/\p{Cc}/u.test(reference)) throw invalid(`${path} contains control characters`);
	return reference;
}

function requireExactInteger(value: unknown, path: string, minimum: number, maximum: number): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw invalid(`${path} must be an integer from ${minimum} to ${maximum}`);
	return value as number;
}

function requireBoolean(value: unknown, path: string): boolean {
	if (typeof value !== "boolean") throw invalid(`${path} must be a boolean`);
	return value;
}

function requireEnum<Value extends string>(value: unknown, path: string, values: ReadonlySet<Value>): Value {
	if (typeof value !== "string" || !values.has(value as Value)) throw invalid(`${path} is invalid`);
	return value as Value;
}

function normalizeText(value: string): string {
	return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function invalid(message: string): TaskConvergenceValidationError {
	return new TaskConvergenceValidationError(message);
}

function assertNever(value: never): never {
	throw invalid(`Unhandled convergence event: ${JSON.stringify(value)}`);
}
