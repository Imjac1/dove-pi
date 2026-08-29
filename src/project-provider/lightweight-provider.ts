import { resolve } from "node:path";
import { PROJECT_PROVIDER_CONTRACT, type ProjectContextSnapshot, type ProjectProvider, type ProviderHealth, type TrellisTaskOperation } from "./contracts.ts";

/** Safe fallback: Dove remains usable without inventing a second task database. */
export class LightweightProvider implements ProjectProvider {
	public readonly kind = "lightweight" as const;
	public readonly projectRoot: string;

	public constructor(projectRoot: string) { this.projectRoot = resolve(projectRoot); }

	public getHealth(): ProviderHealth {
		return {
			provider: this.kind,
			status: "lightweight",
			projectRoot: this.projectRoot,
			trellisCompatibility: "unknown",
			adapterContract: PROJECT_PROVIDER_CONTRACT,
			capabilities: { readContext: false, readTasks: false, readMemory: false, taskLifecycle: false, mutations: false, atomicMutations: false },
			issues: ["No Trellis project is configured; project-management features are unavailable."],
		};
	}

	public getContext(): ProjectContextSnapshot {
		return { provider: this.kind, projectRoot: this.projectRoot, revision: "lightweight", tasks: [], documents: [] };
	}

	public getCurrentTask() { return undefined; }
	public readMemory() { return []; }
	public async runTaskOperation(_operation: TrellisTaskOperation, _args: readonly string[]): Promise<string> {
		throw new Error("Trellis is not initialized for this project");
	}
	public async reconcileTaskOperation(): Promise<"unknown"> { return "unknown"; }
}
