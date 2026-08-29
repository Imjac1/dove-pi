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

const EXECUTION_PATTERN = /\b(run|execute|launch|start|stop|deploy|install|uninstall|delete|remove|write|edit|modify|change|create|apply|commit|push|shell|command|powershell|script)\b|运行|执行|启动|停止|部署|安装|卸载|删除|移除|写入|编辑|修改|变更|创建|应用|提交|推送|脚本/i;
const PROJECT_PATTERN = /\b(project|task|prd|design|implementation|code|repository|repo|workspace|file|bug|feature|develop|development|build|test|fix|repair)\b|项目|任务|需求|设计|代码|仓库|工作区|文件|缺陷|功能|开发|构建|测试|修复|修理|解决/i;
const LOOKUP_PATTERN = /\b(show|read|find|search|list|status|inspect|lookup|look\s+up|what|where|which|how|explain|describe|summarize|summary)\b|查看|读取|查找|搜索|列出|状态|检查|查询|什么|哪里|哪个|如何|解释|描述|总结|打开网页|网页|截图|浏览器|浏览/i;

function classifyIntent(message: string, explicitIntent?: RequestIntent): RequestIntent {
	// Mutating/executing language wins over project/lookup words ("show how to
	// run" is still an execution request and must not be treated as chat).
	if (EXECUTION_PATTERN.test(message)) return "execution";
	if (explicitIntent) return explicitIntent;
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
