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
	/**
	 * The changes recorded against this task, each with the prediction it has to earn.
	 *
	 * **Optional on purpose.** The snapshot is `schemaVersion: 1` and records written before this field existed are
	 * on disk, so an absent value means "none recorded" - which is true of every one of them.
	 */
	readonly changes?: readonly TaskChange[];
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
	| (VersionedEvent & {
		readonly kind: "change.recorded";
		readonly acceptanceId: string;
		/** Everything but the revision, which the reducer sets from the revision the event produces. */
		readonly change: Omit<TaskChange, "recordedAtRevision">;
	})
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
	if (kind === "acceptance.passed") {
		// **A pass requires an observable, and this is where it is refused if it has none.** `acceptance.passed` used
		// to take evidence refs optionally, so a criterion could be marked passed with nothing behind it - which is the
		// shape of a claim the harness cannot check and the agent can author. A failure keeps its refs optional: a
		// failure is not a claim of success, and refusing to record one for lack of evidence would lose the failure.
		const evidenceRefs = event.evidenceRefs === undefined ? [] : decodeEvidenceRefs(event.evidenceRefs, "event.evidenceRefs");
		if (evidenceRefs.length === 0) {
			throw invalid(
				"acceptance.passed requires at least one evidence reference: a pass with nothing behind it is the assertion this reducer exists to refuse. Attach the observable that decided it - a ledger record, a command exit status, an artifact - and pass with it.",
			);
		}
		return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), evidenceRefs };
	}
	if (kind === "acceptance.failed") return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), ...optionalEvidenceRefs(event.evidenceRefs, "event.evidenceRefs") };
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
	if (kind === "change.recorded") {
		return { ...base, kind, acceptanceId: requireAcceptanceId(event.acceptanceId), change: decodeChange(event.change, "event.change", storedMovements) };
	}
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
		...(snapshot.changes === undefined ? {} : { changes: decodeChanges(snapshot.changes) }),
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
		case "change.recorded":
			return recordChange(snapshot, event);
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

/**
 * Record a change and the prediction it has to earn.
 *
 * `recordedAtRevision` is set here rather than accepted from the caller: it is the revision this event produces
 * (`nextSnapshot` bumps by one), and a caller-chosen value would let a manifest claim it was written in a round that
 * already ended - which is the difference between a pre-registered prediction and a post-hoc one.
 */
function recordChange(snapshot: TaskConvergenceSnapshot, event: Extract<TaskConvergenceEvent, { kind: "change.recorded" }>): TaskConvergenceSnapshot {
	const changes = snapshot.changes ?? [];
	if (changes.some((change) => change.id === event.change.id)) throw invalid(`Change ${event.change.id} is already recorded on this task`);
	const recorded: TaskChange = { ...event.change, recordedAtRevision: snapshot.revision + 1 };
	// Oldest first out, so the newest manifests survive a bounded record rather than the record refusing to grow.
	return nextSnapshot(snapshot, { changes: [...changes, recorded].slice(-MAX_CHANGES) });
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
		// Frozen like every other collection here: a shallow spread would carry the manifests while leaving the array
		// that holds them mutable, which is the one thing a record a verdict reads should not be.
		...(snapshot.changes === undefined ? { changes: undefined } : {
			changes: Object.freeze(snapshot.changes.map((change) => Object.freeze({
				...change,
				predictedFixes: Object.freeze([...change.predictedFixes]),
				predictedRegressions: Object.freeze([...change.predictedRegressions]),
				baseline: Object.freeze({ ...change.baseline }),
			}))),
		}),
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

const MAX_BASELINE_KEYS = 32;

function requireMovementList(value: unknown, path: string, minimum: number): readonly unknown[] {
	if (!Array.isArray(value)) throw invalid(`${path} must be a list of predicted movements`);
	if (value.length < minimum) {
		throw invalid(`${path} needs at least ${minimum} predicted movement(s): a change with nothing predicted is a rationale rather than a contract. Write '<observable>:<subject>=<target>', where <observable> is one of: ${CHANGE_OBSERVABLES.join(", ")}.`);
	}
	if (value.length > MAX_PREDICTIONS) throw invalid(`${path} holds ${value.length} predictions; the maximum is ${MAX_PREDICTIONS}`);
	return value;
}

/**
 * The one door: everything that reaches a record has already been parsed, so this validates structure rather than text.
 *
 * The snapshot decoder and the event decoder both come through here, which is why a manifest round-trips: the same
 * validator reads back what the reducer wrote.
 */
function storedMovements(value: unknown, path: string, minimum: number): readonly PredictedMovement[] {
	return requireMovementList(value, path, minimum).map((entry, index) => {
		const movement = requireRecord(entry, `${path}[${index}]`);
		const observable = requireString(movement.observable, `${path}[${index}].observable`, 64);
		const subject = requireString(movement.subject, `${path}[${index}].subject`, 128);
		// `to` and `direction` are two shapes in the union and one place in the record, so read whichever the
		// observable takes and let the shared validator refuse a mismatch by naming what that observable accepts.
		const target = movement.to ?? movement.direction;
		if (typeof target !== "string") throw invalid(`${path}[${index}] needs 'to' or 'direction'.`);
		return movementFromParts(observable, subject, target);
	});
}

/**
 * The values a verdict compares against, as read by the harness when the manifest was recorded.
 *
 * Validated for shape only: this is the *harness's* read travelling with the record, and the refusal that matters -
 * a caller supplying one - happens at the tool boundary, where the caller is a model rather than the runtime.
 */
function decodeBaseline(value: unknown, path: string): Readonly<Record<string, string | number>> {
	const record = requireRecord(value, path);
	const keys = Object.keys(record);
	if (keys.length > MAX_BASELINE_KEYS) throw invalid(`${path} holds ${keys.length} entries; the maximum is ${MAX_BASELINE_KEYS}`);
	const baseline: Record<string, string | number> = {};
	for (const key of keys) {
		if (!/^[a-z-]+:.+$/u.test(key)) throw invalid(`${path}.${key} must be shaped '<observable>:<subject>'`);
		const entry = record[key];
		if (typeof entry === "string") {
			baseline[key] = requireString(entry, `${path}.${key}`, MAX_TEXT);
			continue;
		}
		if (typeof entry === "number" && Number.isFinite(entry)) {
			baseline[key] = entry;
			continue;
		}
		throw invalid(`${path}.${key} must be a string or a finite number`);
	}
	return baseline;
}

type MovementDecoder = (value: unknown, path: string, minimum: number) => readonly PredictedMovement[];

function decodeChange(value: unknown, path: string, movements: MovementDecoder): Omit<TaskChange, "recordedAtRevision"> {
	const change = requireRecord(value, path);
	const surface = requireString(change.surface, `${path}.surface`, 64);
	if (!CHANGE_SURFACES.has(surface as ChangeSurface)) {
		throw invalid(`${path}.surface must be one of: ${[...CHANGE_SURFACES].join(", ")} (got '${surface}'). A free string cannot be asked which mishap a change risks.`);
	}
	return {
		id: requirePattern(change.id, `${path}.id`, GENERIC_ID_PATTERN, 128),
		surface: surface as ChangeSurface,
		failureEvidenceRef: requireEvidenceRef(change.failureEvidenceRef, `${path}.failureEvidenceRef`),
		rootCause: requireString(change.rootCause, `${path}.rootCause`, MAX_TEXT),
		fix: requireString(change.fix, `${path}.fix`, MAX_TEXT),
		predictedFixes: movements(change.predictedFixes, `${path}.predictedFixes`, 1),
		predictedRegressions: movements(change.predictedRegressions, `${path}.predictedRegressions`, 0),
		baseline: decodeBaseline(change.baseline, `${path}.baseline`),
	};
}

function decodeChanges(value: unknown): readonly TaskChange[] {
	if (!Array.isArray(value)) throw invalid("snapshot.changes must be a list");
	if (value.length > MAX_CHANGES) throw invalid(`snapshot.changes holds ${value.length} changes; the maximum is ${MAX_CHANGES}`);
	return value.map((entry, index) => {
		const path = `snapshot.changes[${index}]`;
		const record = requireRecord(entry, path);
		return {
			...decodeChange(record, path, storedMovements),
			recordedAtRevision: requireExactInteger(record.recordedAtRevision, `${path}.recordedAtRevision`, 1, Number.MAX_SAFE_INTEGER),
		};
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

// ---------------------------------------------------------------------------------------------
// Change manifests: a two-sided prediction, and the verdict the next round earns it
// ---------------------------------------------------------------------------------------------

/**
 * The harness components a change may touch, from AHE's own enumeration (`2604.25850` §3.3) - which is also the
 * pathway list `2509.26354` measures misevolution along, and the reason this is a closed set: "which surface did
 * this touch" is the question a misevolution guard has to ask, and a free string cannot be asked it.
 */
export type ChangeSurface =
	| "system-prompt"
	| "tool-description"
	| "tool-implementation"
	| "middleware"
	| "skill"
	| "subagent-config"
	| "long-term-memory";
export const CHANGE_SURFACES: ReadonlySet<ChangeSurface> = new Set([
	"system-prompt", "tool-description", "tool-implementation", "middleware", "skill", "subagent-config", "long-term-memory",
]);

/** What the D3 audit reports per criterion (`extension.ts:1553-1558`), as a nameable target. */
export type VerificationState = "verified" | "unresolved_evidence" | "failed" | "waived" | "not_claimed";
export const VERIFICATION_STATES: ReadonlySet<VerificationState> = new Set([
	"verified", "unresolved_evidence", "failed", "waived", "not_claimed",
]);

/**
 * The gate labels the ledger actually records, verified against every writer rather than assumed.
 *
 * `deny` (`pi-adapter/extension.ts:2292`), the policy's own labels (`action-policy.ts:334-518`), `ask`
 * (`extension.ts:2412`) and `effect-claim` (`:2450`). Two of these were missing from the first draft of this
 * set - `ask` and `effect-claim` - which is exactly the class of error the closed set exists to make visible.
 *
 * **A recorded label may be composite.** `extension.ts:2377` falls back to `gates.join("+")` when a reason carries
 * no `[label]` prefix, so `deny+scope+registered+ask` is a legal ledger value. The read therefore splits on `+`
 * and counts atoms; the composite itself is not nameable here, because predicting a composite would be predicting
 * the absence of a label.
 */
export const GATE_LABELS: ReadonlySet<string> = new Set([
	"deny", "scope", "registered", "limit", "conformance", "sandbox", "technique", "fence", "ask", "effect-claim",
]);

/** The observables a prediction may name. Three, not four: `stop-reasons` is not a closed set yet (see design.md). */
export const CHANGE_OBSERVABLES = ["criterion-status", "verification-state", "gate-refusals"] as const;
export type ChangeObservable = (typeof CHANGE_OBSERVABLES)[number];

/**
 * One predicted movement: a subject that moves **into** a state, or a count that moves **down** or **up**.
 *
 * A movement rather than a sentence, because a sentence is checked by reading it and a movement is checked by
 * comparing two reads - which is the whole difference between a contract and a rationale.
 */
export type PredictedMovement =
	| { readonly observable: "criterion-status"; readonly subject: string; readonly to: AcceptanceStatus }
	| { readonly observable: "verification-state"; readonly subject: string; readonly to: VerificationState }
	| { readonly observable: "gate-refusals"; readonly subject: string; readonly direction: "down" | "up" };

/** A manifest entry: Self-Harness's failure record, plus a prediction. */
export interface TaskChange {
	readonly id: string;
	readonly surface: ChangeSurface;
	/** The failure this answers, resolvable like any other ref. */
	readonly failureEvidenceRef: string;
	/** The inferred cause, **distinct from the verifier-level one**: two runs can share an outcome and differ here. */
	readonly rootCause: string;
	readonly fix: string;
	/** At least one, enforced: a change with nothing predicted is a rationale. */
	readonly predictedFixes: readonly PredictedMovement[];
	/** May be empty, and an empty list is stored as an explicit claim of none rather than as a blank field. */
	readonly predictedRegressions: readonly PredictedMovement[];
	/** Read by the harness when the manifest was recorded. Never supplied by a caller - see `verdictFor`. */
	readonly baseline: Readonly<Record<string, string | number>>;
	readonly recordedAtRevision: number;
}

/**
 * **One shape, not two, and this is where that was decided.** The event union declares the *decoded* form, as every
 * other event kind does, so an event carries parsed movements and the reducer validates structure. Text arrives in
 * exactly one place - the tool input, through {@link parsePredictedMovement} - because that is the only door a model
 * or a person writes through. A wire form that also accepted text was tried and deleted: it had no producer, and an
 * inert path is the defect class this project keeps finding in itself.
 */

export const MAX_CHANGES = 50;
export const MAX_PREDICTIONS = 8;

/** The key a movement and its recorded baseline share. */
export function movementKey(movement: { readonly observable: ChangeObservable; readonly subject: string }): string {
	return movement.observable + ":" + movement.subject;
}

/**
 * Parse `<observable>:<subject>=<target>`, and refuse anything else **by naming the whole set**.
 *
 * The compact form exists because the schema bytes are measured: `agent_task_convergence` alone is 1,753 bytes,
 * 32% of every tool schema this extension registers into a prompt (Round 10). Four union variants on two array
 * fields would grow the largest schema again, for a shape this validates in one line - and a refusal teaches the
 * set only when someone gets it wrong, which is cheaper than teaching it to everyone on every request.
 */
export function parsePredictedMovement(text: string): PredictedMovement {
	const trimmed = String(text ?? "").trim();
	const match = /^([a-z-]+):([^=]+)=(.+)$/.exec(trimmed);
	if (match === null) {
		throw invalid(`'${trimmed}' is not a predicted movement. Write '<observable>:<subject>=<target>', where <observable> is one of: ${CHANGE_OBSERVABLES.join(", ")}.`);
	}
	return movementFromParts((match[1] ?? "").trim(), (match[2] ?? "").trim(), (match[3] ?? "").trim());
}

/**
 * The one validator both front doors share, because a movement has two shapes for a reason: the **event** carries
 * text (a model wrote it) and the **record** carries structure (the reducer wrote it). Two decoders would be two
 * vocabularies; one validator with two ways in is one vocabulary.
 */
function movementFromParts(observable: string, subject: string, target: string): PredictedMovement {
	if (subject === "") throw invalid(`${observable} needs a non-empty subject.`);
	switch (observable) {
		case "criterion-status": {
			if (!ACCEPTANCE_ID_PATTERN.test(subject)) throw invalid(`a criterion-status subject must be an AC-* id (got '${subject}').`);
			if (!ACCEPTANCE_STATUSES.has(target as AcceptanceStatus)) {
				throw invalid(`criterion-status targets must be one of: ${[...ACCEPTANCE_STATUSES].join(", ")} (got '${target}').`);
			}
			return { observable, subject, to: target as AcceptanceStatus };
		}
		case "verification-state": {
			if (!ACCEPTANCE_ID_PATTERN.test(subject)) throw invalid(`a verification-state subject must be an AC-* id (got '${subject}').`);
			if (!VERIFICATION_STATES.has(target as VerificationState)) {
				throw invalid(`verification-state targets must be one of: ${[...VERIFICATION_STATES].join(", ")} (got '${target}').`);
			}
			return { observable, subject, to: target as VerificationState };
		}
		case "gate-refusals": {
			if (!GATE_LABELS.has(subject)) {
				throw invalid(`a gate-refusals subject must be one of: ${[...GATE_LABELS].join(", ")} (got '${subject}'). A composite label is not a subject: the read counts its atoms separately.`);
			}
			if (target !== "down" && target !== "up") throw invalid(`gate-refusals targets must be one of: down, up (got '${target}').`);
			return { observable, subject, direction: target };
		}
		default:
			throw invalid(`unknown observable '${observable}'. Known observables: ${CHANGE_OBSERVABLES.join(", ")}.`);
	}
}

/**
 * The rule both readers apply, in one place: a passed criterion whose evidence refs all resolve is `verified`, and
 * anything else is what its own status says. The D3 audit (`extension.ts`) and the change baseline must not be able
 * to disagree about what a criterion's state is, so the derivation lives here rather than twice at the call sites.
 */
export function verificationStateOf(status: AcceptanceStatus, unresolvedEvidence: number): VerificationState {
	if (status === "passed") return unresolvedEvidence > 0 ? "unresolved_evidence" : "verified";
	if (status === "failed") return "failed";
	if (status === "waived") return "waived";
	return "not_claimed";
}

export type ChangeVerdict = "pending" | "confirmed" | "contradicted" | "unobserved";

/** The harness's own read, at the moment a verdict is asked for. A key that is absent could not be read. */
export interface ChangeObservables {
	/**
	 * The revision of the read itself. A verdict is available once **any** event has landed after the manifest's
	 * revision, which is the moment the comparison stops being a baseline compared with itself.
	 *
	 * A narrower boundary was designed first - the revision of the last `request.observed` event - and it was
	 * unreachable: that event kind has **no producer in this repository**, so the field would always be absent and
	 * every verdict would read `pending` forever. See the task's design.md; the missing producer is its own defect.
	 */
	readonly currentRevision: number;
	readonly criterionStatus: Readonly<Record<string, string>>;
	readonly verificationState: Readonly<Record<string, string>>;
	/** Counts **per atom**: a composite ledger label is split on `+` before it reaches here. */
	readonly gateRefusals: Readonly<Record<string, number>>;
}

export interface ChangeVerdictResult {
	readonly verdict: ChangeVerdict;
	readonly observed: readonly string[];
}

function readObservable(current: ChangeObservables, movement: PredictedMovement): string | number | undefined {
	if (movement.observable === "criterion-status") return current.criterionStatus[movement.subject];
	if (movement.observable === "verification-state") return current.verificationState[movement.subject];
	return current.gateRefusals[movement.subject];
}

/**
 * Whether the movement happened **between the baseline and this read**.
 *
 * A state movement requires the subject to be in the predicted state now **and not before**: a prediction of a
 * movement that had already happened is not evidence for the change, so it is refused rather than counted. That is
 * the cheap half of the gaming defence - the expensive half would be a read the predicting party cannot see, which
 * is D6's subject.
 */
function movementHeld(movement: PredictedMovement, before: string | number, after: string | number): boolean {
	if (movement.observable === "gate-refusals") {
		if (typeof before !== "number" || typeof after !== "number") return false;
		return movement.direction === "down" ? after < before : after > before;
	}
	return after === movement.to && before !== movement.to;
}

/**
 * The verdict a manifest has earned. Total by construction: anything unreadable is `unobserved`, never
 * `confirmed`, because a check that can throw is a check a run learns to avoid.
 *
 * `pending` until a `request.observed` event has landed after the manifest's revision. Without that boundary the
 * first read after recording would compare a baseline with itself and report `contradicted`, which is worse than
 * useless: it would teach the loop that every change fails.
 */
export function verdictFor(change: TaskChange, current: ChangeObservables): ChangeVerdictResult {
	if (current.currentRevision <= change.recordedAtRevision) {
		return { verdict: "pending", observed: [] };
	}
	const observed: string[] = [];
	let contradicted = false;
	let unobserved = false;
	for (const movement of change.predictedFixes) {
		const key = movementKey(movement);
		const before = change.baseline[key];
		const after = readObservable(current, movement);
		if (before === undefined || after === undefined) {
			unobserved = true;
			observed.push(key + ": unreadable (baseline " + String(before) + ", now " + String(after) + ")");
			continue;
		}
		const held = movementHeld(movement, before, after);
		observed.push(key + ": " + String(before) + " -> " + String(after) + (held ? " (predicted)" : " (prediction not met)"));
		if (!held) contradicted = true;
	}
	if (contradicted) return { verdict: "contradicted", observed };
	if (unobserved) return { verdict: "unobserved", observed };
	return { verdict: "confirmed", observed };
}

/** A verdict that has been read against a round and is worth keeping. */
export interface DecidedChange {
	readonly changeId: string;
	readonly verdict: Exclude<ChangeVerdict, "pending">;
	readonly observed: readonly string[];
	readonly revision: number;
}

/**
 * **The validation half, as memory.** A change is decidable once a later round has been observed, so this returns the
 * changes whose next read has happened and which carry no decision yet.
 *
 * **It never returns a `pending` verdict.** Pending means the next round has not happened, and writing "not yet" on
 * every round for every change would turn the record into noise. It **does** return `unobserved`, which is a real
 * answer - the prediction named something the record does not carry - and returning it is the difference between no
 * decision and a decision that reads `unobserved`.
 *
 * **Why a set of already-decided ids is passed in rather than derived here.** The caller owns the ledger, and the
 * ledger is the memory: a process-local set would re-decide every change on the next start.
 */
export function decidableChanges(snapshot: TaskConvergenceSnapshot, current: ChangeObservables, decided: ReadonlySet<string>): readonly DecidedChange[] {
	const out: DecidedChange[] = [];
	for (const change of snapshot.changes ?? []) {
		if (decided.has(change.id)) continue;
		// The verdict is `verdictFor` and never a second derivation, so a decision and the status read cannot disagree
		// about what a movement did.
		const result = verdictFor(change, current);
		if (result.verdict === "pending") continue;
		out.push({ changeId: change.id, verdict: result.verdict, observed: result.observed, revision: current.currentRevision });
	}
	return out;
}

