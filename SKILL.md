---
name: openclaw-intelligence
description: Transforms OpenClaw into Apple Intelligence-like automation with seamless agent workflows, intelligent task routing, and error handling.
version: 1.0.0
triggers:
  - "set up Apple Intelligence-like automation in OpenClaw"
  - "automate task routing between OpenClaw agents"
  - "create intelligent workflows for OpenClaw"
  - "make OpenClaw work like Apple Intelligence"
  - "priority-based task automation in OpenClaw"
  - "configure error handling for automated agent workflows"
  - "CLI tool for OpenClaw automation"
---

# openclaw-intelligence

Transforms OpenClaw into an Apple Intelligence-like automation platform with seamless agent workflows, intelligent task routing, and robust error handling.

## What it does

This skill provides intelligent task routing and automation for OpenClaw agents. It recognizes natural language intents, delegates tasks to the appropriate agents based on priority and context, and handles errors gracefully with retry and fallback strategies.

## Usage

### CLI

```bash
# Run the main automation engine
node scripts/openclaw-intelligence.js --config assets/config-template.json

# Use the CLI interface
node scripts/cli.js run --workflow assets/workflow-examples/basic-routing.json
node scripts/cli.js status
node scripts/cli.js list-agents
node scripts/cli.js process "Schedule a code review for the auth module"
```

### Programmatic

```js
const { AutomationEngine } = require('./scripts/openclaw-intelligence');
const { IntentProcessor } = require('./scripts/intent-processor');

const engine = new AutomationEngine();
engine.loadConfig('assets/config-template.json');
await engine.run();
```

## Configuration

See `assets/config-template.json` for the default configuration. Customize agents, priorities, and error handling behavior to fit your workflow.

## Error Handling

The skill includes graceful degradation: if an agent is unavailable, tasks are re-routed to fallback agents. All failures are logged with actionable context for debugging.
