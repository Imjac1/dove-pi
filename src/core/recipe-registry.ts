import type { CapabilityRegistry } from "./capability-registry.ts";
import type { AgentMode, CapabilityResult } from "./contracts.ts";
import { executeFastPath } from "./fast-path.ts";
import { ExecutionLedger } from "./execution-ledger.ts";

export interface RecipeStep {
	readonly capability: string;
	readonly args?: Record<string, unknown>;
}

export interface RecipeDefinition {
	readonly name: string;
	readonly version: string;
	readonly description: string;
	readonly status: "draft" | "verified" | "stable" | "deprecated";
	readonly steps: readonly RecipeStep[];
}

export class RecipeRegistry {
	private readonly recipes = new Map<string, RecipeDefinition>();

	public register(recipe: RecipeDefinition): void {
		if (this.recipes.has(recipe.name)) throw new Error(`Recipe already registered: ${recipe.name}`);
		this.recipes.set(recipe.name, recipe);
	}

	public list(): readonly RecipeDefinition[] {
		return [...this.recipes.values()];
	}

	public require(name: string): RecipeDefinition {
		const recipe = this.recipes.get(name);
		if (!recipe) throw new Error(`Unknown recipe: ${name}`);
		return recipe;
	}
}

export async function executeRecipe(
	recipes: RecipeRegistry,
	capabilities: CapabilityRegistry,
	ledger: ExecutionLedger,
	name: string,
	args: Record<string, unknown>,
	context: { cwd: string; mode: AgentMode; taskId: string; stepId: string; signal?: AbortSignal; requestId?: string; sessionId?: string; attemptId?: string; toolCallId?: string; ownerPid?: number },
): Promise<readonly CapabilityResult[]> {
	const recipe = recipes.require(name);
	const results: CapabilityResult[] = [];
	for (const [index, step] of recipe.steps.entries()) {
		const result = await executeFastPath(capabilities, ledger, step.capability, { ...args, ...step.args }, {
			...context,
			stepId: `${context.stepId}.${index + 1}`,
		});
		results.push(result);
		if (result.status !== "success") break;
	}
	return results;
}
