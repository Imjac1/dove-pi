# Dove extension identity and synchronization

## Goal

Load exactly one authoritative Dove extension, report managed/project synchronization state, and keep normal third-party Pi plugin discovery.

## Requirements

- Define typed stable Dove extension identity and resolution results.
- Make managed Dove the default for the managed launcher.
- Preserve unrelated project/user Pi extensions.
- Remove filename-existence suppression after the replacement is proven.
- Collapse canonical aliases and legitimate duplicate Dove wrappers before duplicate tool registration.
- Treat different Dove versions/digests as a visible mismatch; managed wins by default.
- Permit project selection only through an explicit developer option and trust/authorization check.
- Compare only during startup; never write a checkout during launch.
- Project selected source and synchronization state through doctor and maintenance evidence.
- Reuse `install <source>`, `update`, and `repair` for atomic managed synchronization.

## Acceptance Criteria

- [x] Managed launch in the Dove source checkout registers every Dove tool once.
- [x] Normal user/project third-party extensions still load.
- [x] Missing, untrusted, unrelated, or maliciously named project files cannot suppress managed Dove.
- [x] Canonical aliases deduplicate; different digests produce actionable diagnostics.
- [x] Mismatch selects managed unless trusted developer override is explicit.
- [x] Startup performs no source writes; maintenance remains atomic under one lock.
- [x] Installer, launcher-routing, Pi smoke, and conflict tests pass in temporary roots.

## Out of Scope

- General package-manager replacement, broad Pi extension updates, or silent checkout mutation.
