---
name: titan-validation
description: Use to validate JARVIS/TITAN changes and diagnose failures without weakening checks.
---

# TITAN Validation

Run checks in this order:
1. Syntax checks for changed runtime modules.
2. Focused tests for changed behavior.
3. npm run lint.
4. npm run build.
5. Inspect git diff/status.

For integration work, also verify configuration loading and safe behavior when optional providers are unavailable.

A warning is not a pass. A successful build is not proof of live external connectivity. State exactly what was verified.
