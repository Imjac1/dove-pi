# Directory Structure

## Overview

There is no browser frontend in this repository. The frontend layer is the Pi terminal extension and its status/command surface.

## Directory Layout

```text
src/pi-adapter/       # Pi commands, tools, shortcuts, status
src/extensions/       # optional renderer/profile catalog and diagnostics
.pi/extensions/       # project-local Pi entrypoint
```

## Module Organization

Keep Pi API calls in `src/pi-adapter`. Keep mode and domain state in `src/core`; the adapter translates it into Pi UI notifications, commands, and `setStatus` updates.

## Naming Conventions

Use descriptive command names (`project`, `task`, `memory`, `status`) and tool names prefixed with `agent_`. Dove mode names are exactly `fast`, `standard`, and `ultra`; Pi thinking levels and extension profiles are separate settings.

## Examples

- [src/pi-adapter/extension.ts](../../../src/pi-adapter/extension.ts)
- [src/extensions/catalog.ts](../../../src/extensions/catalog.ts)
