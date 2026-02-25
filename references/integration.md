# Integration Patterns

## Using openclaw-intelligence with OpenClaw Agents

### Direct Engine Usage

```js
const { AutomationEngine } = require('./scripts/openclaw-intelligence');

const engine = new AutomationEngine();
engine.loadConfig('assets/config-template.json');

// Submit natural language intents
const result = engine.submitInput("Review the auth module");
if (result.accepted) {
  console.log(`Task created: ${result.task.id}`);
}

// Process all queued tasks
const run = await engine.run();
console.log(`Completed: ${run.succeeded}/${run.processed}`);
```

### Workflow-Based Automation

Create a workflow JSON file with steps:

```json
{
  "name": "my-workflow",
  "steps": [
    { "input": "Review the code" },
    { "input": "Run tests" },
    { "input": "Deploy to staging" }
  ]
}
```

Load and execute:

```js
const engine = new AutomationEngine();
engine.loadConfig('assets/config-template.json');
engine.loadWorkflow('path/to/workflow.json');
await engine.run();
```

### Custom Agents

Register additional agents beyond the defaults:

```js
engine.registerAgent('my-agent', {
  name: 'Custom Agent',
  capabilities: ['special-task']
});
```

### Custom Intents

Add intents for domain-specific tasks:

```js
const { IntentProcessor } = require('./scripts/intent-processor');
const processor = new IntentProcessor();
processor.addIntent({
  id: 'security_scan',
  label: 'Security Scan',
  keywords: ['security', 'vulnerability', 'scan', 'audit'],
  agent: 'security-agent',
  priority: 1
});
```

### Error Handling Integration

```js
const { ErrorHandler } = require('./scripts/error-handler');
const handler = new ErrorHandler({
  maxRetries: 5,
  fallbackAgents: { 'primary': 'backup' }
});

const result = await handler.withRetry(async (attempt) => {
  return await riskyOperation();
}, 'my-operation');
```
