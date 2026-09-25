import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export interface DiscoveredSkill {
	readonly name: string;
	readonly path: string;
	readonly sourceRoot: string;
	readonly description?: string;
}

/**
 * Discover project skills using the same `.agents/skills` convention as Pi.
 *
 * Pi discovers project `.agents/skills/` directories from the working directory
 * through its ancestors, stopping at the repository root when one exists, and
 * keeps the user-level `~/.agents/skills/` as a separate location. This function
 * returns the project scope only, so a project never inherits the user global
 * skills by accident of where it happens to live on disk.
 */
export function discoverSkills(startPath = process.cwd()): readonly DiscoveredSkill[] {
	const discovered = new Map<string, DiscoveredSkill>();
	const home = safeHomedir();
	const start = resolve(startPath);
	const boundAtHome = home !== undefined && isStrictlyBelow(start, home);
	let current = start;
	while (true) {
		const skillsRoot = join(current, ".agents", "skills");
		collectSkillFiles(skillsRoot, skillsRoot, discovered);
		if (hasRepositoryRoot(current)) break;
		const parent = dirname(current);
		if (parent === current) break;
		if (boundAtHome && samePath(parent, home)) break;
		current = parent;
	}
	return sortSkills(discovered);
}

/**
 * Discover user-level skills from `~/.agents/skills`, the location Pi keeps
 * separate from project discovery.
 */
export function discoverUserSkills(homeDir = safeHomedir()): readonly DiscoveredSkill[] {
	const discovered = new Map<string, DiscoveredSkill>();
	if (!homeDir) return [];
	const skillsRoot = join(homeDir, ".agents", "skills");
	collectSkillFiles(skillsRoot, skillsRoot, discovered);
	return sortSkills(discovered);
}

/**
 * Discover project skills plus user-level skills. A project skill wins when it
 * declares the same name as a user skill.
 */
export function discoverAllSkills(startPath = process.cwd()): readonly DiscoveredSkill[] {
	const discovered = new Map<string, DiscoveredSkill>();
	for (const skill of discoverSkills(startPath)) discovered.set(skill.name, skill);
	for (const skill of discoverUserSkills()) {
		if (!discovered.has(skill.name)) discovered.set(skill.name, skill);
	}
	return sortSkills(discovered);
}

function sortSkills(discovered: Map<string, DiscoveredSkill>): readonly DiscoveredSkill[] {
	return [...discovered.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function safeHomedir(): string | undefined {
	try {
		const home = homedir();
		return home && home.trim() ? resolve(home) : undefined;
	} catch {
		return undefined;
	}
}

function samePath(left: string, right: string): boolean {
	const a = resolve(left);
	const b = resolve(right);
	return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function isStrictlyBelow(candidate: string, ancestor: string): boolean {
	const a = resolve(candidate);
	const b = resolve(ancestor);
	if (samePath(a, b)) return false;
	const sep = process.platform === "win32" ? String.fromCharCode(92) : "/";
	const prefix = (process.platform === "win32" ? b.toLowerCase() : b) + sep;
	return (process.platform === "win32" ? a.toLowerCase() : a).startsWith(prefix);
}

function hasRepositoryRoot(directory: string): boolean {
	return isDirectory(join(directory, ".git")) || isFile(join(directory, ".git"));
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
