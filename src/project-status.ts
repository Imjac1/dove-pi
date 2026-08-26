import type { ProjectProvider } from "./project-provider/contracts.ts";
import { discoverSkills } from "./skills/discovery.ts";

export interface ProjectStatusReport {
	readonly ready: boolean;
	readonly provider: string;
	readonly status: string;
	readonly projectRoot: string;
	readonly trellisVersion?: string;
	readonly taskLifecycle: boolean;
	readonly currentTask?: string;
	readonly trellisSkills: number;
	readonly skillsReloadRequired: boolean;
	readonly issues: readonly string[];
}

export function inspectProjectStatus(provider: ProjectProvider, skillsReloadRequired = false): ProjectStatusReport {
	const health = provider.getHealth();
	const trellisSkills = discoverSkills(provider.projectRoot).filter((skill) => skill.name.startsWith("trellis-")).length;
	const currentTask = provider.getCurrentTask()?.stableId;
	const issues = [...health.issues];
	if (health.status === "healthy" && trellisSkills === 0) issues.push("No Trellis skills were discovered; run /reload or inspect the project skill directory.");
	return {
		ready: health.status === "healthy" && health.capabilities.taskLifecycle,
		provider: health.provider,
		status: health.status,
		projectRoot: health.projectRoot,
		...(health.trellisVersion ? { trellisVersion: health.trellisVersion } : {}),
		taskLifecycle: health.capabilities.taskLifecycle,
		...(currentTask ? { currentTask } : {}),
		trellisSkills,
		skillsReloadRequired,
		issues,
	};
}

export function formatProjectStatus(report: ProjectStatusReport): string {
	const lines = [
		`Project: ${report.ready ? "ready" : report.status}`,
		`Root: ${report.projectRoot}`,
		`Provider: ${report.provider}`,
		`Trellis: ${report.trellisVersion ?? "unknown"}`,
		`Tasks: ${report.taskLifecycle ? "available" : "unavailable"}`,
		`Skills: ${report.trellisSkills} discovered${report.skillsReloadRequired ? " / reload required" : ""}`,
	];
	if (report.currentTask) lines.push(`Current task: ${report.currentTask}`);
	if (report.issues.length > 0) lines.push(...report.issues.map((issue) => `Issue: ${issue}`));
	return lines.join("\n");
}
