"use strict";

const fs = require("fs");
const path = require("path");
const { IntentProcessor } = require("./intent-processor");
const { ErrorHandler, AutomationError } = require("./error-handler");

class AutomationEngine {
  constructor(options) {
    const opts = options || {};
    this.intentProcessor = new IntentProcessor(opts.intentProcessor);
    this.errorHandler = new ErrorHandler(opts.errorHandler);
    this.agents = new Map();
    this.taskQueue = [];
    this.completedTasks = [];
    this.config = null;
    this.running = false;
  }

  loadConfig(configPath) {
    const resolved = path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);
    const raw = fs.readFileSync(resolved, "utf-8");
    this.config = JSON.parse(raw);

    if (this.config.agents) {
      for (const agent of this.config.agents) {
        this.registerAgent(agent.id, agent);
      }
    }

    if (this.config.errorHandler) {
      if (this.config.errorHandler.maxRetries) {
        this.errorHandler.maxRetries = this.config.errorHandler.maxRetries;
      }
      if (this.config.errorHandler.fallbackAgents) {
        this.errorHandler.fallbackAgents = this.config.errorHandler.fallbackAgents;
      }
    }

    return this.config;
  }

  registerAgent(id, definition) {
    this.agents.set(id, {
      id: id,
      name: definition.name || id,
      capabilities: definition.capabilities || [],
      status: "idle",
      tasksCompleted: 0,
    });
  }

  getAgent(id) {
    return this.agents.get(id) || null;
  }

  listAgents() {
    return Array.from(this.agents.values());
  }

  submitInput(input) {
    const result = this.intentProcessor.process(input);
    const task = this.intentProcessor.createTask(result);

    if (!task) {
      return {
        accepted: false,
        reason: "No matching intent found",
        intentResult: result,
      };
    }

    this.taskQueue.push(task);
    this._sortQueue();

    return {
      accepted: true,
      task: task,
      intentResult: result,
    };
  }

  submitTask(task) {
    if (!task.id) {
      task.id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    if (!task.status) {
      task.status = "pending";
    }
    if (!task.createdAt) {
      task.createdAt = new Date().toISOString();
    }
    this.taskQueue.push(task);
    this._sortQueue();
    return task;
  }

  async processNextTask() {
    if (this.taskQueue.length === 0) {
      return null;
    }

    const task = this.taskQueue.shift();
    task.status = "in_progress";
    task.startedAt = new Date().toISOString();

    const agent = this.agents.get(task.agentId);

    if (!agent) {
      const failureResult = this.errorHandler.handleTaskFailure(
        task,
        new AutomationError(`Agent not found: ${task.agentId}`, "AGENT_NOT_FOUND", { agentId: task.agentId })
      );

      if (failureResult.action === "reroute" && failureResult.fallbackAgent) {
        task.agentId = failureResult.fallbackAgent;
        task.rerouted = true;
        const fallbackAgent = this.agents.get(failureResult.fallbackAgent);
        if (fallbackAgent) {
          return this._executeTask(task, fallbackAgent);
        }
      }

      task.status = "failed";
      task.error = failureResult.error;
      task.completedAt = new Date().toISOString();
      this.completedTasks.push(task);
      return task;
    }

    return this._executeTask(task, agent);
  }

  async _executeTask(task, agent) {
    agent.status = "busy";
    try {
      // Simulate task execution - in a real system this would dispatch to the agent
      task.status = "completed";
      task.completedAt = new Date().toISOString();
      task.result = {
        agent: agent.id,
        message: `Task "${task.label || task.intentId}" processed by ${agent.name}`,
      };
      agent.tasksCompleted++;
    } catch (err) {
      const failureResult = this.errorHandler.handleTaskFailure(task, err);
      task.status = "failed";
      task.error = failureResult.error;
      task.completedAt = new Date().toISOString();
    } finally {
      agent.status = "idle";
    }

    this.completedTasks.push(task);
    return task;
  }

  async processAll() {
    const results = [];
    while (this.taskQueue.length > 0) {
      const result = await this.processNextTask();
      if (result) {
        results.push(result);
      }
    }
    return results;
  }

  loadWorkflow(workflowPath) {
    const resolved = path.isAbsolute(workflowPath)
      ? workflowPath
      : path.resolve(process.cwd(), workflowPath);
    const raw = fs.readFileSync(resolved, "utf-8");
    const workflow = JSON.parse(raw);

    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      throw new AutomationError("Invalid workflow: missing steps array", "INVALID_WORKFLOW");
    }

    const tasks = [];
    for (const step of workflow.steps) {
      if (step.input) {
        const submission = this.submitInput(step.input);
        if (submission.accepted) {
          tasks.push(submission.task);
        }
      } else if (step.agentId && step.intentId) {
        const task = this.submitTask({
          intentId: step.intentId,
          label: step.label || step.intentId,
          agentId: step.agentId,
          priority: step.priority || 3,
          input: step.description || "",
        });
        tasks.push(task);
      }
    }

    return {
      name: workflow.name || "unnamed",
      description: workflow.description || "",
      tasksCreated: tasks.length,
      tasks: tasks,
    };
  }

  getStatus() {
    return {
      running: this.running,
      agents: this.listAgents(),
      queueLength: this.taskQueue.length,
      completedCount: this.completedTasks.length,
      pendingTasks: this.taskQueue.map((t) => ({
        id: t.id,
        intentId: t.intentId,
        priority: t.priority,
        status: t.status,
      })),
      recentCompleted: this.completedTasks.slice(-5).map((t) => ({
        id: t.id,
        intentId: t.intentId,
        status: t.status,
        agent: t.result ? t.result.agent : null,
      })),
      errorCount: this.errorHandler.getLog().length,
    };
  }

  async run() {
    this.running = true;
    const results = await this.processAll();
    this.running = false;
    return {
      processed: results.length,
      succeeded: results.filter((t) => t.status === "completed").length,
      failed: results.filter((t) => t.status === "failed").length,
      results: results,
      errorReport: this.errorHandler.formatReport(),
    };
  }

  _sortQueue() {
    this.taskQueue.sort((a, b) => (a.priority || 3) - (b.priority || 3));
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const configIdx = args.indexOf("--config");
  const configPath = configIdx !== -1 && args[configIdx + 1]
    ? args[configIdx + 1]
    : path.join(__dirname, "..", "assets", "config-template.json");

  const engine = new AutomationEngine();

  try {
    engine.loadConfig(configPath);
  } catch (err) {
    console.error(`Failed to load config from ${configPath}: ${err.message}`);
    process.exit(1);
  }

  console.log(`OpenClaw Intelligence Engine started`);
  console.log(`Agents registered: ${engine.listAgents().length}`);
  console.log(`Config loaded from: ${configPath}`);

  // Process any input arguments as intents
  const inputs = args.filter((a, i) => a !== "--config" && i !== configIdx + 1);
  if (inputs.length > 0) {
    for (const input of inputs) {
      const result = engine.submitInput(input);
      if (result.accepted) {
        console.log(`Queued: "${input}" -> ${result.task.label} (agent: ${result.task.agentId})`);
      } else {
        console.log(`Skipped: "${input}" (no matching intent)`);
      }
    }
  } else {
    // Demo mode: run sample intents
    const sampleIntents = [
      "Review the authentication module code",
      "Deploy the latest release to staging",
      "Run integration tests for the API",
    ];
    console.log("\nDemo mode - processing sample intents:");
    for (const input of sampleIntents) {
      const result = engine.submitInput(input);
      if (result.accepted) {
        console.log(`  Queued: "${input}" -> ${result.task.label} (agent: ${result.task.agentId}, priority: ${result.task.priority})`);
      }
    }
  }

  const runResult = await engine.run();
  console.log(`\nProcessing complete:`);
  console.log(`  Processed: ${runResult.processed}`);
  console.log(`  Succeeded: ${runResult.succeeded}`);
  console.log(`  Failed: ${runResult.failed}`);

  if (runResult.failed > 0) {
    console.log(`\n${runResult.errorReport}`);
  }

  const status = engine.getStatus();
  console.log(`\nEngine status: queue=${status.queueLength}, completed=${status.completedCount}, errors=${status.errorCount}`);

  return runResult;
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error:", err.message);
    process.exit(1);
  });
}

module.exports = { AutomationEngine };
