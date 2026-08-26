# Logging Guidelines

## Overview

The runtime is local-first and currently uses structured JSONL ledger records plus concise CLI/UI messages. Logs are evidence and diagnostics, not a second state store.

## Log Levels

- `info`: lifecycle milestones and successful operations.
- `warn`: degraded provider, missing optional extension, fallback, or recoverable conflict.
- `error`: failed command, mutation, verification, or health gate.
- `debug`: only for local troubleshooting; never required for normal correctness.

## Structured Logging

Ledger records include `kind`, timestamp, task/step identity, mode, and boundary-specific details. Include provider, revision, dispatch ID, or artifact references when relevant.

## What to Log

Log provider selection, health transitions, mode changes, capability identity, predicted/actual dispatch costs, mutation intent/completion, and verification results.

## What NOT to Log

Never log credentials, tokens, full environment dumps, private target data, or raw sensitive files. Hash parameters instead of storing their values in the execution ledger.
