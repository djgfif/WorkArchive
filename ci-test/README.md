# ci-test

A minimal Cowork plugin used to verify that plugin installation and skill loading work end-to-end in CI.

## Components

- **Skill: `ci-check`** — Responds with a simple confirmation so you can verify the plugin installed and its skill triggers correctly.

## Setup

No configuration or external connectors required. Install the plugin and the skill is available immediately.

## Usage

Ask Claude to "run the ci check" or "verify the plugin is working." The `ci-check` skill loads and returns a confirmation message.
