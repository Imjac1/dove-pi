import { registerDevelopmentCapabilities } from "./capabilities/development.ts";
import { registerRuntimeCapabilities } from "./capabilities/runtime.ts";
import { registerWebAccessCapabilities } from "./capabilities/web-access.ts";
import { CapabilityRegistry } from "./core/capability-registry.ts";
import { RecipeRegistry } from "./core/recipe-registry.ts";

export interface DoveRuntime {
	readonly capabilities: CapabilityRegistry;
	readonly recipes: RecipeRegistry;
}

/** Single composition root shared by every host adapter. */
export function createDoveRuntime(): DoveRuntime {
	const capabilities = new CapabilityRegistry();
	const recipes = new RecipeRegistry();
	registerDevelopmentCapabilities(capabilities);
	registerWebAccessCapabilities(capabilities);
	registerRuntimeCapabilities(capabilities);
	recipes.register({
		name: "dev.validate_project",
		version: "0.1.0",
		description: "Run the reusable project typecheck and test workflow in order.",
		status: "stable",
		steps: [{ capability: "dev.typecheck" }, { capability: "dev.project_test" }],
	});
	recipes.register({
		name: "windows.readonly_baseline",
		version: "0.1.0",
		description: "Collect basic PowerShell host information and inspect the current workspace.",
		status: "stable",
		steps: [{ capability: "windows.host_info" }, { capability: "workspace.inspect", args: { path: "." } }],
	});
	return Object.freeze({ capabilities, recipes });
}
