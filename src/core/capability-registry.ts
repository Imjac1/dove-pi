import type { CapabilityDefinition } from "./contracts.ts";

export class CapabilityRegistry {
	private readonly capabilities = new Map<string, CapabilityDefinition>();

	public register<TArgs, TResult>(capability: CapabilityDefinition<TArgs, TResult>): void {
		if (this.capabilities.has(capability.name)) {
			throw new Error(`Capability already registered: ${capability.name}`);
		}
		this.capabilities.set(capability.name, capability as CapabilityDefinition);
	}

	public get(name: string): CapabilityDefinition | undefined {
		return this.capabilities.get(name);
	}

	public list(): readonly CapabilityDefinition[] {
		return [...this.capabilities.values()];
	}

	public require(name: string): CapabilityDefinition {
		const capability = this.get(name);
		if (!capability) throw new Error(`Unknown capability: ${name}`);
		return capability;
	}
}
