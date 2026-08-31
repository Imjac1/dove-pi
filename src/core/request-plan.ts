import { normalizeAgentMode, type AgentMode } from "./contracts.ts";

/** The four intentionally distinct interaction classes understood by Dove Kernel. */
export type RequestIntent = "chat" | "lookup" | "project-work" | "execution";

export type RequestApproval = "none" | "confirm" | "elevated";

/** Provider-neutral workflow action that requires request-specific handling. */
export type WorkflowAction = "continue" | "create-task" | "start-task" | "finish-task" | "archive-task";

/** @deprecated Use WorkflowAction. Kept for ledger/session compatibility. */
export type ProjectAction = "continue";

export interface RequestPlanInput {
	readonly message: string;
	readonly requestId?: string;
	readonly mode?: AgentMode;
	readonly projectAvailable?: boolean;
	readonly explicitIntent?: RequestIntent;
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
	readonly contextClasses: readonly string[];
	readonly capabilityIds: readonly string[];
	readonly approval: RequestApproval;
	readonly deadlineMs?: number;
	readonly outputBudget: number;
	readonly projectAvailable: boolean;
	readonly workflowAction?: WorkflowAction;
	/** @deprecated Use workflowAction. */
	readonly projectAction?: ProjectAction;
}

const EXECUTION_ACTION_PATTERN = /\b(run|execute|launch|start|stop|deploy|install|uninstall|delete|remove|write|edit|modify|change|create|apply|commit|push|fix|repair|implement|shell|command|powershell|script)\b|运行|执行|启动|停止|部署|安装|卸载|删除|移除|写入|编辑|修改|变更|创建|应用|提交|推送|修复|修理|解决|实现|脚本/gi;
const PROJECT_PATTERN = /\b(project|task|prd|design|implementation|code|repository|repo|workspace|file|bug|feature|develop|development|build|test|fix|repair)\b|项目|任务|需求|设计|代码|仓库|工作区|文件|缺陷|功能|开发|构建|测试|修复|修理|解决/i;
const LOOKUP_PATTERN = /\b(show|read|find|search|list|status|inspect|lookup|look\s+up|what|where|which|how|explain|describe|summarize|summary|read-only)\b|查看|读取|查找|搜索|列出|状态|检查|查询|什么|哪里|哪个|如何|怎么|怎样|解释|描述|说明|总结|分析|只读|打开网页|网页|截图|浏览器|浏览/i;
const RESPONSE_ONLY_PATTERN = /\b(?:only|just)\s+(?:reply|respond|answer)\b|只(?:需|要)?回复|仅回复/i;
const CONVERSATION_SUMMARY_PATTERN = /(?:一句话|简短|简单)?总结(?:一下)?(?:我们)?(?:刚才|刚刚|方才|这次|本次)(?:完成|做|讨论|处理|修改)|\b(?:briefly\s+|in\s+one\s+sentence\s+)?summari[sz]e\s+(?:what\s+)?we\s+(?:just\s+)?(?:did|completed|discussed|changed)\b/i;
const PROJECT_CONTINUATION_PATTERN = /^\s*(?:(?:请(?:帮我)?|帮我)\s*)?(?:(?:继续|恢复)(?:一下)?(?:当前|这个|该|本)?(?:项目)?(?:任务|工作)|(?:(?:please\s+)?(?:help\s+me\s+)?)?(?:continue|resume)(?:\s+(?:the|this|that))?\s+(?:(?:current|existing)\s+)?(?:project\s+)?(?:task|work))(?=\s|[，。！？；,;.!?]|$)/i;
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
	for (const [action, pattern] of WORKFLOW_ACTION_PATTERNS) if (pattern.test(message)) return action;
	return undefined;
}

function classifyIntent(message: string, explicitIntent?: RequestIntent): RequestIntent {
	// Mutating/executing language wins over project/lookup words ("show how to
	// run and then run it" retains the second imperative after meta-language is
	// removed). Negated or explanatory mentions do not request execution.
	if (hasActionableExecution(message)) return "execution";
	if (explicitIntent) return explicitIntent;
	if (RESPONSE_ONLY_PATTERN.test(message)) return "chat";
	if (CONVERSATION_SUMMARY_PATTERN.test(message)) return "chat";
	// A leading, explicit continuation request owns the turn even when a later
	// fallback clause asks "how to start". The anchored pattern does not match
	// explanatory lookups such as "查看如何继续当前任务".
	if (PROJECT_CONTINUATION_PATTERN.test(message)) return "project-work";
	if (BROWSER_LOOKUP_PATTERN.test(message)) return "lookup";
	if (LOOKUP_PATTERN.test(message)) return "lookup";
	if (PROJECT_PATTERN.test(message)) return "project-work";
	return "chat";
}

function classifyProjectAction(message: string, intent: RequestIntent): ProjectAction | undefined {
	// An independent execution verb already promoted the request above. Only a
	// read-only Project Work turn receives the deterministic continuation path.
	return intent === "project-work" && PROJECT_CONTINUATION_PATTERN.test(message) ? "continue" : undefined;
}

function defaultsForIntent(intent: RequestIntent, projectAvailable: boolean, workflowAction?: WorkflowAction): Pick<RequestPlan, "contextClasses" | "capabilityIds" | "approval"> {
	switch (intent) {
		case "chat":
			return { contextClasses: ["conversation"], capabilityIds: [], approval: "none" };
		case "lookup":
			return {
				contextClasses: projectAvailable ? ["conversation", "project-index"] : ["conversation"],
				capabilityIds: [],
				approval: "none",
			};
		case "project-work":
			return {
				contextClasses: projectAvailable ? ["conversation", "project-task", "project-spec"] : ["conversation", "workspace"],
				capabilityIds: ["workspace.inspect"],
				approval: workflowAction && workflowAction !== "continue" ? "confirm" : "none",
			};
		case "execution":
			return {
				contextClasses: projectAvailable ? ["conversation", "project-task", "project-spec"] : ["conversation", "workspace"],
				capabilityIds: ["workspace.inspect"],
				approval: "elevated",
			};
	}
}

function freezePlan(plan: RequestPlan): RequestPlan {
	Object.freeze(plan.contextClasses);
	Object.freeze(plan.capabilityIds);
	return Object.freeze(plan);
}

/** Create a deterministic plan. No host/provider/project implementation is consulted. */
export function createRequestPlan(input: RequestPlanInput): RequestPlan {
	const message = input.message.trim();
	const projectAvailable = input.projectAvailable === true;
	const workflowAction = classifyWorkflowAction(message);
	const classifiedIntent = classifyIntent(message, isRequestIntent(input.explicitIntent) ? input.explicitIntent : undefined);
	// Lifecycle mutations have their own restricted authority tier. An explicit
	// caller hint may not downgrade them to Chat, just as it cannot downgrade a
	// shell/edit execution request.
	const intent = classifiedIntent === "execution" ? classifiedIntent : workflowAction && workflowAction !== "continue" ? "project-work" : classifiedIntent;
	const effectiveWorkflowAction = intent === "execution" ? undefined : workflowAction;
	const projectAction = classifyProjectAction(message, intent);
	const defaults = defaultsForIntent(intent, projectAvailable, effectiveWorkflowAction);
	const outputBudget = input.outputBudget ?? (intent === "chat" ? 1024 : intent === "lookup" ? 2048 : 4096);
	if (!Number.isInteger(outputBudget) || outputBudget <= 0) throw new RangeError("outputBudget must be a positive integer");
	if (input.deadlineMs !== undefined && (!Number.isInteger(input.deadlineMs) || input.deadlineMs <= 0)) {
		throw new RangeError("deadlineMs must be a positive integer when provided");
	}
	return freezePlan({
		requestId: input.requestId ?? `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
		intent,
		mode: normalizeAgentMode(input.mode) ?? "standard",
		contextClasses: defaults.contextClasses,
		capabilityIds: defaults.capabilityIds,
		approval: defaults.approval,
		deadlineMs: input.deadlineMs,
		outputBudget,
		projectAvailable,
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
	const withoutStatus = value.replace(/未完成|没完成|待办|遗留|剩余|进行中|unfinished|incomplete|pending|remaining|open/gi, " ");
	return !/(?:继续|恢复|修复|实现|执行|修改|编写|开发|处理|完成|删除|归档|提交|推送|开始|优化|解决|逐个|逐项|代码|源码|测试|文件|日志|历史)|\b(?:continue|resume|fix|implement|execute|modify|write|develop|handle|complete|finish|delete|archive|commit|push|start|optimi[sz]e|resolve|code|source|tests?|files?|logs?|history)\b/i.test(withoutStatus);
}
