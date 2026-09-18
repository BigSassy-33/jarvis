---
name: titan-workflow
description: Use for production-oriented TITAN/JARVIS implementation work requiring inspect-plan-implement-validate-diff discipline.
---

# TITAN Workflow

Use this skill for substantive repository changes.

1. Read AGENTS.md.
2. Inspect the current implementation and related configuration.
3. Identify the smallest complete change.
4. Implement without duplicating existing abstractions.
5. Validate syntax, tests, lint, and build as appropriate.
6. Inspect the diff for unintended changes.
7. Report evidence, not assumptions.

If an external service is unavailable, keep the adapter explicit and fail safely. Never fake health or connectivity.
