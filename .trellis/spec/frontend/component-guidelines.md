# Component Guidelines

## Overview

This project does not use React or browser components. UI is composed from Pi commands, tools, notifications, and extension status text.

## Component Structure

Keep each Pi registration close to its handler and delegate domain behavior to core/provider modules. Do not embed Trellis parsing or PowerShell execution in a UI callback.

## Props Conventions

Pi callback inputs should be validated by the host API/typebox schema. Normalize values before passing them into core contracts.

## Styling Patterns

Use Pi's native UI and the optional `pi-open-tui` renderer. Dove publishes one compact mode/operation status and does not create a competing telemetry collector.

## Accessibility

Every important action must have a command equivalent. Keyboard operation must work without color or Nerd Font; status text needs an ASCII-readable fallback.

## Common Mistakes

- Duplicating Pi's model picker or exit behavior.
- Rendering provider telemetry from Dove when Pi is already the source of truth.
- Hiding an approval or degraded-provider state behind color only.
