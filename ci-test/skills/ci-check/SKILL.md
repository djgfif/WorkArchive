---
name: ci-check
description: >
  This skill should be used when the user asks to "run the ci check",
  "verify the plugin is working", "confirm the plugin installed", or
  otherwise wants a quick health check that the ci-test plugin loaded
  and its skill triggers correctly.
metadata:
  version: "0.1.0"
---

# CI Check

Confirm that the `ci-test` plugin installed and this skill loaded successfully.

When this skill triggers:

1. Report a clear success confirmation, e.g. "ci-test plugin is installed and the ci-check skill loaded successfully."
2. State the plugin version by reading it from the manifest at `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` if the user asks for details.
3. Keep the response to one or two sentences — this is a health check, not a task.

Do not perform any other actions, file writes, or external calls. This skill exists solely to verify plugin loading in CI.
