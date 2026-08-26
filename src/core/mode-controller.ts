import type { AgentMode } from "./contracts.ts";

export interface ModeChange {
	readonly previous: AgentMode;
	readonly current: AgentMode;
	readonly effectiveFromStep: string;
	readonly changedAt: string;
}

export class ModeController {
	private mode: AgentMode;

	public constructor(initialMode: AgentMode = "standard") {
		this.mode = initialMode;
	}

	public get current(): AgentMode {
		return this.mode;
	}

	public change(next: AgentMode, effectiveFromStep: string): ModeChange {
		const change: ModeChange = {
			previous: this.mode,
			current: next,
			effectiveFromStep,
			changedAt: new Date().toISOString(),
		};
		this.mode = next;
		return change;
	}

	public snapshot(): AgentMode {
		return this.mode;
	}
}
