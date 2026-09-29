# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

This directory contains the backend guidelines for this project.

**Pre-Development Checklist**: read the guideline files below that apply to your task, and the router
(`./personal-agent-runtime.md`) for the subject-scoped specifications. This index is the list, not the guideline.

**Quality Check**: `quality-guidelines.md` holds the forbidden patterns, the required patterns and the review checklist this
repository enforces.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Active |
| [Database Guidelines](./database-guidelines.md) | Persistence boundary and migration rules | Active |
| [Error Handling](./error-handling.md) | Error types, handling strategies | Active |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Active |
| [Logging Guidelines](./logging-guidelines.md) | Structured logging, log levels | Active |
| [Personal Agent Runtime](./personal-agent-runtime.md) | Stable router for ownership-scoped Agent runtime specifications | Active |
| [Personal Agent Request Runtime](./personal-agent-request-runtime.md) | Core, Pi adapter, request planning, and provider-budget contracts | Active |
| [Personal Agent Capability Runtime](./personal-agent-capability-runtime.md) | Capability Protocol, adapters, dispatch, and workspace contracts | Active |
| [Personal Agent Project Context](./personal-agent-project-context.md) | Trellis context, project-provider, and skill-discovery contracts | Active |
| [Personal Agent Extension Runtime](./personal-agent-extension-runtime.md) | Pi extension profiles, doctor, identity, and authority contracts | Active |
| [Personal Agent Managed Installation](./personal-agent-managed-install.md) | Managed install, release, launcher, update, and repair contracts | Active |
| [Personal Agent Code Audit Vertical](./personal-agent-audit-vertical.md) | Deterministic seed scanning, coverage receipt, and the finding claim schema | Active |
| [Personal Agent Framework Core](./personal-agent-framework-core.md) | Loop ownership, gate boundary, work modes, authority graph, effect identity, evidence, admission, capability scoping | Active |
| [Personal Agent Mode Format](./personal-agent-mode-format.md) | Work-mode layout and validation, the fields a mode declares, and the refusals for the rest | Active |
| [Bounded Harness Improvement](./personal-agent-harness-loop.md) | The instruments the harness uses to improve itself from its own evidence, and the boundaries that keep that improvement bounded | Active |
| [Convergence Record](./personal-agent-convergence-record.md) | The convergence contract for a formal native task, and the records around it: observations, manifests, terminal classification, decisions and applied commits | Active |
| [Field Run](./personal-agent-field-run.md) | Running Dove against a real provider on purpose: the invocation, the reading it records, and what such a run does and does not prove | Active |

---

**Language**: All documentation should be written in **English**.