# Design: Dove Pi runtime reliability and synchronization

## Architecture

Four boundaries remain separate:

1. **Extension resolver** selects one Dove authority before tool registration.
2. **Request lifecycle controller** assigns logical identity and retry terminal states.
3. **Tool progress controller** fingerprints calls/observations and owns stagnation decisions.
4. **Evidence projection** correlates and redacts without becoming a state authority.

Pi owns host/session/UI state. Dove core owns typed identity, lifecycle, and policy. The Pi adapter wires callbacks. Python owns managed release transactions but does not duplicate TypeScript extension metadata.

```text
launcher -> extension resolution -> Pi normal plugin discovery
         -> input logicalRequestId -> RequestPlan -> provider attempt
         -> tool coalescing/progress -> terminal reason -> redacted evidence
```

## Extension Contract

Identity contains `extensionId`, `version`, `implementationDigest`, `entryPath`, `origin`, and `trust`. Canonical paths collapse aliases; digest/version distinguish physical copies. Managed explicit load precedes project discovery. A process-global registration guard protects against two legitimate Dove wrappers but never replaces trust checks.

## Request Contract

Pi `input` creates a request lease; `before_agent_start` consumes it instead of generating a random ID; `agent_settled` closes it. In-flight redelivery is handled/coalesced. Content hashes are evidence, not sole identity.

## Tool Contract

`callFingerprint = toolName + normalized input`. `observationFingerprint` adds error class and bounded result digest. Same-batch duplicates are blocked/coalesced. Unchanged cross-turn observations checkpoint then terminate. Changed observations reset stagnation. Mutation results are never replayed.

## Synchronization

- Startup compares/selects and never writes a checkout.
- `update` synchronizes immutable release assets.
- `install <source>` creates a managed immutable release from an explicit source.
- `repair` reconciles active release, manifest, launcher, and managed components.
- The existing lock spans activation through logging; doctor/status projects sync state.

## Compatibility and Rollout

- Replace unsafe existence suppression only after registration and regression tests exist.
- Add fields to sessions/ledgers; never rewrite historical files.
- Audit readers accept legacy maintenance records.
- Prove Pi callback and plugin load ordering in fixtures before relying on it.

## Rollback

Children land independently. Remove the launcher workaround only after source, untrusted-project, and third-party-plugin tests pass.
