import type { ProjectProvider } from "./project-provider/contracts.ts";
import { discoverSkills } from "./skills/discovery.ts";

export interface ProjectStatusReport {
	readonly ready: boolean;
	readonly provider: string;
	readonly status: string;
	readonly projectRoot: string;
	readonly taskLifecycle: boolean;
	readonly currentTask?: string;
	readonly projectSkills: number;
	readonly skillsReloadRequired: boolean;
	readonly issues: readonly string[];
}

export function inspectProjectStatus(provider: ProjectProvider, skillsReloadRequired = false): ProjectStatusReport {
	const health = provider.getHealth();
	const projectSkills = discoverSkills(provider.projectRoot).length;
	const currentTask = provider.getCurrentTask()?.stableId;
	const issues = [...health.issues];
	return {
		ready: health.status === "healthy" && health.capabilities.taskLifecycle,
		provider: health.provider,
		status: health.status,
		projectRoot: health.projectRoot,
		taskLifecycle: health.capabilities.taskLifecycle,
		...(currentTask ? { currentTask } : {}),
		projectSkills,
		skillsReloadRequired,
		issues,
	};
}

export function formatProjectStatus(report: ProjectStatusReport): string {
	const lines = [
		`Project: ${report.ready ? "ready" : report.status}`,
		`Root: ${report.projectRoot}`,
		`Provider: ${report.provider}`,
		`Tasks: ${report.taskLifecycle ? "available" : "unavailable"}`,
		`Skills: ${report.projectSkills} discovered${report.skillsReloadRequired ? " / reload required" : ""}`,
	];
	if (report.currentTask) lines.push(`Current task: ${report.currentTask}`);
	if (report.issues.length > 0) lines.push(...report.issues.map((issue) => `Issue: ${issue}`));
	return lines.join("\n");
}
