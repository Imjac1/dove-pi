import { normalizeAgentMode, normalizeInteractionMode, type AgentMode, type InteractionMode } from "./contracts.ts";

/** The four intentionally distinct interaction classes understood by Dove Kernel. */
export type RequestIntent = "chat" | "lookup" | "project-work" | "execution";
export type RequestLane = "fast" | "formal";

/** Provider-neutral workflow action that requires request-specific handling. */
export type WorkflowAction = "continue" | "create-task" | "start-task" | "finish-task" | "archive-task";

/** @deprecated Use WorkflowAction. Kept for ledger/session compatibility. */
export type ProjectAction = "continue";

export interface RequestPlanInput {
	readonly message: string;
	readonly requestId?: string;
	readonly mode?: AgentMode;
	readonly interactionMode?: InteractionMode;
	readonly projectAvailable?: boolean;
	readonly explicitIntent?: RequestIntent;
	/** A one-shot pending plan that stopped for user confirmation. It is consulted
	 * only for a short affirmative follow-up. Completed work must not be passed. */
	readonly pendingPlan?: Pick<RequestPlan, "requestId" | "intent" | "lane">;
	readonly deadlineMs?: number;
	readonly outputBudget?: number;
}

/**
 * Immutable, host-independent description of one user turn. Prompt text is a
 * derived artifact; this plan is the source of truth for context and policy.
 */
export interface RequestPlan {
	readonly requestId: string;
	readonly intent: RequestIntent;
	readonly mode: AgentMode;
	readonly interactionMode: InteractionMode;
	readonly contextClasses: readonly string[];
	readonly deadlineMs?: number;
	readonly outputBudget: number;
	readonly projectAvailable: boolean;
	readonly lane: RequestLane;
	readonly taskSelector?: string;
	readonly continuedFromRequestId?: string;
	readonly workflowAction?: WorkflowAction;
	/** @deprecated Use workflowAction. */
	readonly projectAction?: ProjectAction;
}

const EXECUTION_ACTION_PATTERN = /\b(run|execute|launch|start|stop|deploy|install|uninstall|delete|remove|write|edit|modify|change|create|apply|commit|push|fix|repair|implement|shell|command|powershell|script)\b|运行|执行|启动|停止|部署|安装|卸载|删除|移除|写入|编辑|修改|变更|创建|应用|提交|推送|修复|修理|解决|实现|脚本/gi;
const PROJECT_PATTERN = /\b(project|task|prd|design|implementation|code|repository|repo|workspace|file|bug|feature|develop|development|build|test|fix|repair)\b|项目|任务|需求|设计|代码|仓库|工作区|文件|缺陷|功能|开发|构建|测试|修复|修理|解决/i;
const LOOKUP_PATTERN = /\b(show|read|find|search|list|status|inspect|lookup|look\s+up|what|where|which|how|explain|describe|summarize|summary|read-only)\b|查看|读取|查找|搜索|列出|状态|检查|查询|什么|哪里|哪个|如何|怎么|怎样|解释|描述|说明|总结|分析|只读|打开网页|网页|截图|浏览器|浏览/i;
const RESPONSE_ONLY_PATTERN = /\b(?:only|just)\s+(?:reply|respond|answer)\b|只(?:需|要)?回复|仅回复/i;
const CONVERSATION_SUMMARY_PATTERN = /(?:一句话|简短|简单)?总结(?:一下)?(?:我们)?(?:刚才|刚刚|方才|这次|本次)(?:完成|做|讨论|处理|修改)|(?:总结|概括)(?:一下)?(?:我们|本次|当前)?的?(?:对话|会话|聊天)|\b(?:briefly\s+|in\s+one\s+sentence\s+)?summari[sz]e\s+(?:what\s+)?we\s+(?:just\s+)?(?:did|completed|discussed|changed)\b|\b(?:generate|create|provide|give)\s+(?:me\s+)?(?:a\s+)?summary\s+of\s+(?:our|the|this)\s+(?:conversation|session|chat)\b|\bsummari[sz]e\s+(?:our|the|this)\s+(?:conversation|session|chat)\b/i;
const PROJECT_CONTINUATION_PATTERN = /^\s*(?:(?:请(?:帮我)?|帮我)\s*)?(?:(?:继续|恢复)(?:一下)?(?:(?:当前|这个|该|本)\s*)?(?:项目\s*)?(?:任务|工作)|(?:(?:please\s+)?(?:help\s+me\s+)?)?(?:continue|resume)(?:\s+(?:the|this|that))?\s+(?:(?:current|existing)\s+)?(?:project\s+)?(?:task|work))(?=\s|[，。！？；,;.!?]|$)/i;
const CONTINUATION_SELECTOR_PATTERN = /^\s*(?:(?:请(?:帮我)?|帮我)\s*)?(?:继续|恢复)(?:一下)?(?:(?:当前|这个|该|本)\s*)?(?:项目\s*)?(?:任务|工作)(?:\s*[:：]\s*(.+?)|\s+(.+?))?\s*$/i;
const ENGLISH_CONTINUATION_SELECTOR_PATTERN = /^\s*(?:(?:please\s+)?(?:help\s+me\s+)?)?(?:continue|resume)(?:\s+(?:the|this|that))?\s+(?:(?:current|existing)\s+)?(?:project\s+)?(?:task|work)(?:\s*[:：]\s*(.+?)|\s+(.+?))?\s*$/i;
const TEST_IMPERATIVE_PATTERN = /(?:^|[.!?;,，。！？；\n])\s*(?:(?:please\s+)?(?:help\s+me\s+)?)?test\s+(?:(?:the|this|that|current)\s+)*(?:project|code|build|suite|application|app|feature|login|fix)\b|(?:^|[.!?;,，。！？；\n])\s*(?:(?:请(?:帮我)?|帮我)\s*)?测试(?:一下|下)?\s*(?:当前|这个|该|本)?\s*(?:项目|代码|构建|功能|应用|登录|修复|测试套件)/i;
const BROWSER_INTERACTION_IMPERATIVE_PATTERN = /(?:^|[.!?;,，。！？；\n])\s*(?:(?:please\s+)?(?:help\s+me\s+)?)?(?:click|tap|submit|log\s+in|sign\s+in)\b|(?:^|[.!?;,，。！？；\n])\s*(?:请(?:帮我)?|帮我)?(?:点击|点一下|轻触|提交|登录)(?:这个|该|当前)?/i;
const BROWSER_LOOKUP_PATTERN = /\b(?:open|browse|view)\s+(?:(?:the|this|that|current)\s+)?(?:website|web\s*page|page|browser)\b|\b(?:take\s+)?(?:a\s+)?screenshot\b|打开(?:这个|该|当前)?(?:登录)?页面|查看(?:这个|该|当前)?(?:网页|页面)|网页|浏览器|截图/i;
const WORKFLOW_ACTION_PATTERNS: readonly [WorkflowAction, RegExp][] = [
	["continue", /(?:继续|恢复)(?:一下)?(?:当前|这个|该|本)?(?:项目)?(?:任务|工作)|\b(?:continue|resume)(?:\s+(?:the|this|that))?\s+(?:(?:current|existing)\s+)?(?:project\s+)?(?:task|work)\b/i],
	["create-task", /(?:创建|新建|建立)(?:一个)?(?:Trellis)?(?:项目)?任务|\b(?:create|new)\s+(?:a\s+)?(?:Trellis\s+)?task\b|\btask\s+(?:create|new)\b/i],
	["start-task", /(?:开始|启动)(?:当前|这个|该)?(?:项目)?任务|\b(?:start|begin)\s+(?:(?:the|a)\s+)?(?:current\s+)?task\b/i],
	["finish-task", /(?:完成|结束)(?:当前|这个|该)?(?:项目)?任务|\bfinish\s+(?:(?:the|a)\s+)?(?:current\s+)?task\b/i],
	["archive-task", /(?:归档)(?:当前|这个|该)?(?:项目)?任务|\barchive\s+(?:(?:the|a)\s+)?(?:current\s+)?task\b/i],
];
const FORMAL_TASK_PATTERN = /(?:正式(?:任务|流程|工作)|规划|制定|生成|编写|保留|落盘).{0,48}(?:任务|工作|方案|prd|设计|实现计划|验收|阶段产物|文档|产物)|(?:多文件|跨层|跨模块|系统性|重构).{0,32}(?:修改|改造|实现|优化|开发|迁移)|\b(?:prd|design document|implementation plan|acceptance criteria|formal task|multi[- ]file|cross[- ]layer|refactor)\b/i;
const ARCHITECTURE_TASK_PATTERN = /(?:设计|规划|制定|重构|改造|实现|文档化).{0,48}(?:架构|方案|系统|模块)|(?:架构|系统|模块).{0,48}(?:设计|方案|重构)|\b(?:design|define|redesign|document|implement|plan)\b.{0,48}\b(?:architecture|system design|module)\b|\b(?:architecture|system design|module)\b.{0,48}\b(?:design|plan|refactor)\b/i;
const FORMAL_ACTION_PATTERN = /(?:正式|规划|制定|生成|编写|保留|落盘|设计|重构|改造|文档化|plan|define|design|redesign|document|implement|refactor|formal|multi[- ]file|cross[- ]layer)/i;

const NEGATED_WORKFLOW_ACTION_PATTERN = /(?:不要|别|无需|不需要|不必|无须|don't|do\s+not|without|no\s+need\s+to)[^，。！？；,;.!?\n]{0,24}(?:创建|新建|建立|开始|启动|完成|结束|归档|create|new|start|begin|finish|archive)/i;

const EXPLANATORY_QUERY_PATTERN = /(?:解释|说明|分析|总结|描述|什么是|如何|怎么|怎样|为什么|explain|describe|summari[sz]e|how|what|why)/i;

function actionClauses(message: string): string[] {
	const independentActions = message
		.replace(/\b(?:but|and\s+then|then)\s+(?=(?:(?:please\s+)?(?:help\s+me\s+)?)?(?:run|execute|launch|start|stop|deploy|install|uninstall|delete|remove|write|edit|modify|change|create|apply|commit|push|fix|repair|implement|test|click|tap|submit|log\s+in|sign\s+in)\b)/gi, "; ")
		.replace(/(?:但是|但|然后|并且|并|再)(?=(?:(?:请(?:帮我)?|帮我))?(?:运行|执行|启动|停止|部署|安装|卸载|删除|移除|写入|编辑|修改|变更|创建|应用|提交|推送|修复|修理|解决|实现|测试|点击|点一下|轻触|提交|登录))/gi, "；");
	return independentActions.split(/[.!?;,，。！？；\n]+/).map((clause) => clause.trim()).filter(Boolean);
}

function actionIsNegatedOrDescriptive(clause: string, index: number, length: number): boolean {
	const prefix = clause.slice(0, index);
	const localPrefix = prefix.slice(-80);
	const suffix = clause.slice(index + length);
	if (/(?:不要|别|无需|不需要|禁止|不得|无须|不必|不)[^，。！？；,;.!?\n]{0,24}$/i.test(localPrefix)) return true;
	if (/\b(?:do\s+not|don't|never|without|no\s+need\s+to)(?:\s+[\w'-]+){0,6}\s*$/i.test(localPrefix)) return true;
	if (/(?:^|\s)(?:只读|仅查看|只做查看|只做分析|只分析)/i.test(prefix)) return true;
	if (/(?:怎么|如何|怎样)[^，。！？；,;.!?\n]{0,30}$/i.test(localPrefix)) return true;
	if (/\bhow\b[^.!?;,]{0,40}(?:\bto\b\s*)?$/i.test(localPrefix)) return true;
	if (/^(?:后(?:的)?|计划|方案|方法|步骤|建议|说明|结果|状态|记录)/i.test(suffix.trimStart())) return true;
	if (/^\s+(?:plan|proposal|method|steps?|instructions?|result|status|record)\b/i.test(suffix)) return true;
	return false;
}

function hasActionableExecution(message: string): boolean {
	for (const clause of actionClauses(message)) {
		if (TEST_IMPERATIVE_PATTERN.test(clause) || BROWSER_INTERACTION_IMPERATIVE_PATTERN.test(clause)) return true;
		for (const match of clause.matchAll(EXECUTION_ACTION_PATTERN)) {
			// Task lifecycle requests are handled by the restricted workflow tool;
			// they must not promote a planning turn into the full execution tier.
			if (WORKFLOW_ACTION_PATTERNS.some(([action, pattern]) => action !== "continue" && pattern.test(clause)) && /创建|新建|建立|开始|启动|完成|结束|归档|\b(?:create|new|start|begin|finish|archive)\b/i.test(match[0])) continue;
			if (!actionIsNegatedOrDescriptive(clause, match.index, match[0].length)) return true;
		}
	}
	return false;
}

function classifyWorkflowAction(message: string): WorkflowAction | undefined {
	if (NEGATED_WORKFLOW_ACTION_PATTERN.test(message)) return undefined;
	for (const [action, pattern] of WORKFLOW_ACTION_PATTERNS) if (pattern.test(message)) return action;
	return undefined;
}

export function extractProjectTaskSelector(message: string): string | undefined {
	const match = CONTINUATION_SELECTOR_PATTERN.exec(message) ?? ENGLISH_CONTINUATION_SELECTOR_PATTERN.exec(message);
	if (!match) return undefined;
	const selector = (match[1] ?? match[2])?.trim();
	return selector && !/^(?:当前|这个|该|本|current|existing|the|this|that)$/i.test(selector) ? selector : undefined;
}

function isProjectContinuationRequest(message: string): boolean {
	return PROJECT_CONTINUATION_PATTERN.test(message) || CONTINUATION_SELECTOR_PATTERN.test(message) || ENGLISH_CONTINUATION_SELECTOR_PATTERN.test(message);
}

export function isShortAffirmativeReply(message: string): boolean {
	const value = message.trim().replace(/[。！？.!?]+$/g, "").trim();
	if (!value || value.length > 24) return false;
	return /^(?:可以|行|好|好的|开始|继续|执行|确认|同意|没问题|就这样|按这个来|yes|yep|yeah|ok|okay|go ahead|proceed|do it)$/i.test(value);
}

function hasRequestedFileArtifact(message: string): boolean {
	return /(?:需要|要|给我|帮我|请).{0,24}(?:对话|会话|上下文|审计|记录|日志).{0,12}(?:文件|存档)|(?:保存|存档|导出|落盘).{0,24}(?:上下文|对话|会话|记录|日志|文件)|生成.{0,24}(?:文件|日志|存档)|\b(?:save|export|record|archive)\b.{0,40}\b(?:context|conversation|session|audit|log|file|artifact)\b|\b(?:generate|create)\b.{0,40}\b(?:file|artifact|archive|log)\b/i.test(message);
}

function classifyIntent(message: string, explicitIntent?: RequestIntent): RequestIntent {
	// Mutating/executing language wins over project/lookup words ("show how to
	// run and then run it" retains the second imperative after meta-language is
	// removed). Negated or explanatory mentions do not request execution.
	if (hasActionableExecution(message) || hasRequestedFileArtifact(message)) return "execution";
	if (explicitIntent) return explicitIntent;
	if (RESPONSE_ONLY_PATTERN.test(message)) return "chat";
	if (CONVERSATION_SUMMARY_PATTERN.test(message)) return "chat";
	// A leading, explicit continuation request owns the turn even when a later
	// fallback clause asks "how to start". The anchored pattern does not match
	// explanatory lookups such as "查看如何继续当前任务".
	if (isProjectContinuationRequest(message)) return "project-work";
	if (BROWSER_LOOKUP_PATTERN.test(message)) return "lookup";
	if (LOOKUP_PATTERN.test(message)) return "lookup";
	if (PROJECT_PATTERN.test(message)) return "project-work";
	return "chat";
}

function classifyProjectAction(message: string, intent: RequestIntent): ProjectAction | undefined {
	return intent === "project-work" && isProjectContinuationRequest(message) ? "continue" : undefined;
}

export function isFormalTaskRequest(message: string, intent: RequestIntent, workflowAction?: WorkflowAction): boolean {
	if (workflowAction === "create-task") return true;
	if (EXPLANATORY_QUERY_PATTERN.test(message) && !/(?:规划|制定|生成|编写|保留|落盘|重构|实现|迁移|plan|generate|write|refactor|implement)/i.test(message)) return false;
	if ((intent === "chat" || intent === "lookup") && !FORMAL_ACTION_PATTERN.test(message)) return false;
	return FORMAL_TASK_PATTERN.test(message) || ARCHITECTURE_TASK_PATTERN.test(message);
}

function contextClassesForIntent(intent: RequestIntent, projectAvailable: boolean): readonly string[] {
	switch (intent) {
		case "chat":
			return ["conversation"];
		case "lookup":
			return projectAvailable ? ["conversation", "project-index"] : ["conversation"];
		case "project-work":
			return projectAvailable ? ["conversation", "project-task", "project-spec"] : ["conversation", "workspace"];
		case "execution":
			return projectAvailable ? ["conversation", "project-task", "project-spec"] : ["conversation", "workspace"];
	}
}

function freezePlan(plan: RequestPlan): RequestPlan {
	Object.freeze(plan.contextClasses);
	return Object.freeze(plan);
}

/** Create a deterministic plan. No host/provider/project implementation is consulted. */
export function createRequestPlan(input: RequestPlanInput): RequestPlan {
	const message = input.message.trim();
	const projectAvailable = input.projectAvailable === true;
	const interactionMode = normalizeInteractionMode(input.interactionMode) ?? "auto";
	const workflowAction = classifyWorkflowAction(message);
	const taskSelector = workflowAction === "continue" ? extractProjectTaskSelector(message) : undefined;
	const inheritedIntent = isShortAffirmativeReply(message) && input.pendingPlan
		? input.pendingPlan.intent
		: undefined;
	const inheritedLane = isShortAffirmativeReply(message) && input.pendingPlan?.lane === "formal" ? "formal" : undefined;
	const explicitIntent = isRequestIntent(input.explicitIntent) ? input.explicitIntent : inheritedIntent;
	const classifiedIntent = classifyIntent(message, explicitIntent);
	// Lifecycle wording still selects project context and workflow guidance. It
	// never grants or removes tools; Pi remains the execution authority.
	const intent = classifiedIntent === "execution" ? classifiedIntent : workflowAction && workflowAction !== "continue" ? "project-work" : classifiedIntent;
	const effectiveWorkflowAction = intent === "execution" ? undefined : workflowAction;
	const projectAction = classifyProjectAction(message, intent);
	const contextAvailable = projectAvailable && interactionMode !== "chat";
	const lane: RequestLane = interactionMode !== "chat" && projectAvailable && (inheritedLane === "formal" || isFormalTaskRequest(message, intent, effectiveWorkflowAction)) ? "formal" : "fast";
	const contextClasses = interactionMode === "chat" ? ["conversation"] : lane === "formal" ? ["conversation", "project-task", "project-spec"] : contextClassesForIntent(intent, contextAvailable);
	const outputBudget = input.outputBudget ?? (lane === "formal" ? 4096 : intent === "chat" ? 1024 : intent === "lookup" ? 2048 : 4096);
	if (!Number.isInteger(outputBudget) || outputBudget <= 0) throw new RangeError("outputBudget must be a positive integer");
	if (input.deadlineMs !== undefined && (!Number.isInteger(input.deadlineMs) || input.deadlineMs <= 0)) {
		throw new RangeError("deadlineMs must be a positive integer when provided");
	}
	return freezePlan({
		requestId: input.requestId ?? `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
		intent,
		mode: normalizeAgentMode(input.mode) ?? "standard",
		interactionMode,
		contextClasses,
		deadlineMs: input.deadlineMs,
		outputBudget,
		projectAvailable,
		lane,
		...(taskSelector ? { taskSelector } : {}),
		...(inheritedIntent && input.pendingPlan ? { continuedFromRequestId: input.pendingPlan.requestId } : {}),
		...(effectiveWorkflowAction ? { workflowAction: effectiveWorkflowAction } : {}),
		...(projectAction ? { projectAction } : {}),
	});
}

export function isRequestIntent(value: unknown): value is RequestIntent {
	return value === "chat" || value === "lookup" || value === "project-work" || value === "execution";
}

/** True when the user asks for the current unfinished-task inventory rather
 * than a broad filesystem or source-code investigation. */
export function isTaskInventoryRequest(message: string): boolean {
	const value = message.trim();
	const mentionsInventory = /(?:未完成|没完成|待办|遗留|剩余|进行中|还存在).{0,20}(?:任务|工作)|(?:任务|工作).{0,20}(?:未完成|没完成|待办|遗留|剩余|进行中)|\b(?:unfinished|incomplete|pending|remaining|open)\b.{0,40}\b(?:tasks?|work)\b|\b(?:tasks?|work)\b.{0,40}\b(?:unfinished|incomplete|pending|remaining|open)\b/i.test(value);
	if (!mentionsInventory) return false;
	const withoutStatus = value
		.replace(/(?:不要|别|无需|不需要|只读)[^，。！？；,;.!?\n]{0,24}(?:修改|编辑|写入|变更)[^，。！？；,;.!?\n]{0,12}(?:文件|代码)?/gi, " ")
		.replace(/\b(?:without|do\s+not|don't|never)\s+(?:modifying|editing|writing|changing)\s+(?:any\s+)?(?:files?|code)\b/gi, " ")
		.replace(/未完成|没完成|待办|遗留|剩余|进行中|unfinished|incomplete|pending|remaining|open/gi, " ");
	return !/(?:继续|恢复|修复|实现|执行|修改|编写|开发|处理|完成|删除|归档|提交|推送|开始|优化|解决|逐个|逐项|代码|源码|测试|文件|日志|历史)|\b(?:continue|resume|fix|implement|execute|modify|write|develop|handle|complete|finish|delete|archive|commit|push|start|optimi[sz]e|resolve|code|source|tests?|files?|logs?|history)\b/i.test(withoutStatus);
}
