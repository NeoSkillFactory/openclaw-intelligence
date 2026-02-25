# Workflow Examples

## 1. Basic Code Review Pipeline

```bash
node scripts/cli.js process "Review the user authentication code"
```

Output:
```
Intent: Code Review (confidence: 0.450)
Agent: reviewer, Priority: 2
[OK] Task "Code Review" processed by Code Reviewer
```

## 2. Multi-Step Automation

```bash
node scripts/cli.js run --workflow assets/workflow-examples/basic-routing.json
```

This loads the basic routing workflow with three steps:
1. Code review of auth module -> routed to `reviewer` agent
2. Unit tests for user service -> routed to `tester` agent
3. Deploy to staging -> routed to `deployer` agent

## 3. Full CI/CD Pipeline

```bash
node scripts/cli.js run --workflow assets/workflow-examples/full-pipeline.json
```

Runs a complete pipeline: review, test, fix, refactor, document, deploy, monitor.

## 4. List Available Agents

```bash
node scripts/cli.js list-agents
```

Shows all registered agents with their capabilities and current status.

## 5. List Recognized Intents

```bash
node scripts/cli.js list-intents
```

Displays all intent patterns the system recognizes along with their target agents.

## 6. Check Engine Status

```bash
node scripts/cli.js status
```

Returns a JSON object with queue length, completed tasks, agent states, and error count.

## 7. Error Handling in Action

When an agent is unavailable, the engine automatically reroutes tasks to fallback agents:

- `reviewer` -> falls back to `documenter`
- `deployer` -> falls back to `monitor`
- `tester` -> falls back to `debugger`

This is configured in `assets/config-template.json` under `errorHandler.fallbackAgents`.
