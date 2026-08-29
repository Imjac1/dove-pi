import { normalizeAgentMode, type AgentMode } from "./contracts.ts";

/** The four intentionally distinct interaction classes understood by Dove Kernel. */
export type RequestIntent = "chat" | "lookup" | "project-work" | "execution";

export type RequestApproval = "none" | "confirm" | "elevated";

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
}

const EXECUTION_PATTERN = /\b(run|execute|launch|start|stop|deploy|install|uninstall|delete|remove|write|edit|modify|change|create|apply|commit|push|fix|repair|implement|shell|command|powershell|script)\b|运行|执行|启动|停止|部署|安装|卸载|删除|移除|写入|编辑|修改|变更|创建|应用|提交|推送|修复|修理|解决|实现|脚本/i;
const PROJECT_PATTERN = /\b(project|task|prd|design|implementation|code|repository|repo|workspace|file|bug|feature|develop|development|build|test|fix|repair)\b|项目|任务|需求|设计|代码|仓库|工作区|文件|缺陷|功能|开发|构建|测试|修复|修理|解决/i;
const LOOKUP_PATTERN = /\b(show|read|find|search|list|status|inspect|lookup|look\s+up|what|where|which|how|explain|describe|summarize|summary)\b|查看|读取|查找|搜索|列出|状态|检查|查询|什么|哪里|哪个|如何|怎么|怎样|解释|描述|总结|分析|打开网页|网页|截图|浏览器|浏览/i;
const RESPONSE_ONLY_PATTERN = /\b(?:only|just)\s+(?:reply|respond|answer)\b|只(?:需|要)?回复|仅回复/i;
const TEST_IMPERATIVE_PATTERN = /(?:^|[.!?;,，。！？；\n])\s*(?:(?:please\s+)?(?:help\s+me\s+)?)?test\s+(?:(?:the|this|that|current)\s+)*(?:project|code|build|suite|application|app|feature|login|fix)\b|(?:^|[.!?;,，。！？；\n])\s*(?:(?:请(?:帮我)?|帮我)\s*)?测试(?:一下|下)?\s*(?:当前|这个|该|本)?\s*(?:项目|代码|构建|功能|应用|登录|修复|测试套件)/i;
const BROWSER_INTERACTION_IMPERATIVE_PATTERN = /(?:^|[.!?;,，。！？；\n])\s*(?:(?:please\s+)?(?:help\s+me\s+)?)?(?:click|tap|submit|log\s+in|sign\s+in)\b|(?:^|[.!?;,，。！？；\n])\s*(?:请(?:帮我)?|帮我)?(?:点击|点一下|轻触|提交|登录)(?:这个|该|当前)?/i;
const BROWSER_LOOKUP_PATTERN = /\b(?:open|browse|view)\s+(?:(?:the|this|that|current)\s+)?(?:website|web\s*page|page|browser)\b|\b(?:take\s+)?(?:a\s+)?screenshot\b|打开(?:这个|该|当前)?(?:登录)?页面|查看(?:这个|该|当前)?(?:网页|页面)|网页|浏览器|截图/i;

/**
 * Remove clauses that mention an execution verb only to negate it or ask how
 * it would be done. The remaining text is still checked for an independent
 * imperative, so "do not wait; run it" cannot downgrade to lookup.
 */
function actionableExecutionText(message: string): string {
	// Establish a boundary before a later independent action so the preceding
	// negation cannot swallow it ("do not edit and then test this project").
	const independentActions = message
		.replace(/\b(?:but|and\s+then|then)\s+(?=(?:(?:please\s+)?(?:help\s+me\s+)?)?(?:run|execute|launch|start|stop|deploy|install|uninstall|delete|remove|write|edit|modify|change|create|apply|commit|push|fix|repair|implement|test|click|tap|submit|log\s+in|sign\s+in)\b)/gi, "; ")
		.replace(/(?:但是|但|然后|并且|并|再)(?=(?:(?:请(?:帮我)?|帮我))?(?:运行|执行|启动|停止|部署|安装|卸载|删除|移除|写入|编辑|修改|变更|创建|应用|提交|推送|修复|修理|解决|实现|测试|点击|点一下|轻触|提交|登录))/gi, "；");
	return independentActions
		.replace(/\b(?:do\s+not|don't|never|without)\b[^.!?;,，。！？；\n]{0,80}/gi, " ")
		.replace(/(?:不要|别|无需|不需要|禁止)[^.!?;,，。！？；\n]{0,40}/gi, " ")
		.replace(/(?:不(?:要|需|需要)?|无须|不得)(?:进行|去|再)?(?:运行|执行|启动|停止|部署|安装|卸载|删除|移除|写入|编辑|修改|变更|创建|应用|提交|推送|修复|修理|解决|实现)[^.!?;,，。！？；\n]{0,40}/gi, " ")
		.replace(/\b(?:(?:show|tell)\s+me\s+|explain\s+)?how\s+(?:do\s+i\s+|to\s+)(?:actually\s+)?(?:run|execute|launch|start|stop|deploy|install|uninstall|delete|remove|write|edit|modify|change|create|apply|commit|push|fix|repair|implement)\b/gi, " ")
		.replace(/(?:怎么|如何|怎样)(?:去|来|才能|可以)?(?:运行|执行|启动|停止|部署|安装|卸载|删除|移除|写入|编辑|修改|变更|创建|应用|提交|推送|修复|修理|解决|实现)/gi, " ");
}

function classifyIntent(message: string, explicitIntent?: RequestIntent): RequestIntent {
	// Mutating/executing language wins over project/lookup words ("show how to
	// run and then run it" retains the second imperative after meta-language is
	// removed). Negated or explanatory mentions do not request execution.
	const actionable = actionableExecutionText(message);
	if (EXECUTION_PATTERN.test(actionable) || TEST_IMPERATIVE_PATTERN.test(actionable) || BROWSER_INTERACTION_IMPERATIVE_PATTERN.test(actionable)) return "execution";
	if (explicitIntent) return explicitIntent;
	if (RESPONSE_ONLY_PATTERN.test(message)) return "chat";
	if (BROWSER_LOOKUP_PATTERN.test(message)) return "lookup";
	if (LOOKUP_PATTERN.test(message)) return "lookup";
	if (PROJECT_PATTERN.test(message)) return "project-work";
	return "chat";
}

function defaultsForIntent(intent: RequestIntent, projectAvailable: boolean): Pick<RequestPlan, "contextClasses" | "capabilityIds" | "approval"> {
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
				approval: "confirm",
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
	const intent = classifyIntent(message, isRequestIntent(input.explicitIntent) ? input.explicitIntent : undefined);
	const defaults = defaultsForIntent(intent, projectAvailable);
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
	});
}

export function isRequestIntent(value: unknown): value is RequestIntent {
	return value === "chat" || value === "lookup" || value === "project-work" || value === "execution";
}
