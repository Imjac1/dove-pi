import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface DiscoveredSkill {
	readonly name: string;
	readonly path: string;
	readonly sourceRoot: string;
	readonly description?: string;
}

/**
 * Discover project skills using the same .agents/skills convention as Pi.
 * Discovery is read-only and walks from the current directory to the
 * filesystem root, allowing a project to inherit skills from a parent.
 */
export function discoverSkills(startPath = process.cwd()): readonly DiscoveredSkill[] {
	const discovered = new Map<string, DiscoveredSkill>();
	let current = resolve(startPath);
	while (true) {
		const skillsRoot = join(current, ".agents", "skills");
		collectSkillFiles(skillsRoot, skillsRoot, discovered);
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return [...discovered.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function collectSkillFiles(root: string, sourceRoot: string, discovered: Map<string, DiscoveredSkill>): void {
	if (!isDirectory(root)) return;
	let entries: string[];
	try {
		entries = readdirSync(root);
	} catch {
		return;
	}
	for (const entry of entries) {
		const path = join(root, entry);
		if (entry.toLowerCase() === "skill.md" && isFile(path)) {
			const skill = readSkill(path, sourceRoot);
			if (skill && !discovered.has(skill.name)) discovered.set(skill.name, skill);
			continue;
		}
		if (isDirectory(path)) collectSkillFiles(path, sourceRoot, discovered);
	}
}

function readSkill(path: string, sourceRoot: string): DiscoveredSkill | undefined {
	const relativePath = path.slice(sourceRoot.length + 1);
	const name = relativePath.slice(0, -"skill.md".length).replace(/[\\/]+$/, "").replace(/[\\/]/g, ":");
	if (!name) return undefined;
	try {
		const content = readFileSync(path, "utf8");
		const description = /^description:\s*["']?(.+?)["']?\s*$/mu.exec(content)?.[1]?.trim();
		return { name, path, sourceRoot, ...(description ? { description } : {}) };
	} catch {
		return { name, path, sourceRoot };
	}
}

function isDirectory(path: string): boolean {
	try { return statSync(path).isDirectory(); } catch { return false; }
}

function isFile(path: string): boolean {
	try { return statSync(path).isFile(); } catch { return false; }
}
