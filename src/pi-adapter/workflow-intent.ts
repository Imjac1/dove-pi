export type SuggestedWorkflowSkill =
	| "trellis-start"
	| "trellis-continue"
	| "trellis-brainstorm"
	| "trellis-before-dev"
	| "trellis-check"
	| "trellis-finish-work";

export interface WorkflowSuggestion {
	readonly skill: SuggestedWorkflowSkill;
	readonly reason: string;
}

/** Return an advisory workflow skill for explicit user intent. */
export function suggestWorkflowSkill(prompt: string): WorkflowSuggestion | undefined {
	const value = prompt.trim().toLowerCase();
	if (!value || value.startsWith("/skill:")) return undefined;
	if (isExplicitReadOnlyRequest(value)) return undefined;
	if (isTaskInventoryRequest(value)) return undefined;

	if (matches(value, ["trellis-start", "开始会话", "开始工作", "初始化开发", "start session"])) {
		return { skill: "trellis-start", reason: "会话初始化或重新建立项目上下文" };
	}
	if (matches(value, ["trellis-continue", "继续当前任务", "继续工作", "恢复任务", "resume", "continue"])) {
		return { skill: "trellis-continue", reason: "恢复已有任务或跨会话继续工作" };
	}
	if (matches(value, ["trellis-brainstorm", "头脑风暴", "需求分析", "规划", "设计方案", "brainstorm", "design"])) {
		return { skill: "trellis-brainstorm", reason: "需求仍需探索或存在多种设计方案" };
	}
	if (matches(value, ["trellis-check", "检查", "验证", "审查", "review", "test", "verify"])) {
		return { skill: "trellis-check", reason: "用户请求质量检查、测试或审查" };
	}
	if (matches(value, ["trellis-finish-work", "收尾", "完成任务", "归档任务", "finish", "archive"])) {
		return { skill: "trellis-finish-work", reason: "用户请求结束、归档或记录本次工作" };
	}
	if (matches(value, ["trellis-before-dev", "实现", "修复", "修改代码", "新增功能", "implement", "fix", "refactor"])) {
		return { skill: "trellis-before-dev", reason: "用户请求实现、修复或修改代码" };
	}
	return undefined;
}

function isExplicitReadOnlyRequest(value: string): boolean {
	if (/(?:只读|仅查看|只做查看|不要|禁止|无需|不用|别|勿)\s*(?:修改|写入|运行|执行|调用|变更)/i.test(value)) return true;
	if (/\b(?:read[- ]only|without)\b.{0,80}\b(?:modif\w*|writ\w*|runn?\w*|execut\w*|chang\w*)\b/i.test(value)) return true;
	if (/\b(?:do not|don't)\b.{0,80}\b(?:modif\w*|writ\w*|runn?\w*|execut\w*|chang\w*)\b/i.test(value)) return true;
	return false;
}

function matches(value: string, terms: readonly string[]): boolean {
	return terms.some((term) => value.includes(term));
}
import { isTaskInventoryRequest } from "../core/request-plan.ts";
