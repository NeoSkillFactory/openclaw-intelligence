#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { AutomationEngine } = require("./openclaw-intelligence");
const { IntentProcessor } = require("./intent-processor");

const SKILL_ROOT = path.resolve(__dirname, "..");
const DEFAULT_CONFIG = path.join(SKILL_ROOT, "assets", "config-template.json");

function loadEngine(configPath) {
  const engine = new AutomationEngine();
  const cfgPath = configPath || DEFAULT_CONFIG;
  try {
    engine.loadConfig(cfgPath);
  } catch (err) {
    console.error(`Error loading config: ${err.message}`);
    process.exit(1);
  }
  return engine;
}

function printHelp() {
  console.log(`openclaw-intelligence CLI

Usage:
  node cli.js <command> [options]

Commands:
  run [--workflow <path>] [--config <path>]   Run a workflow or demo mode
  status [--config <path>]                    Show engine status
  list-agents [--config <path>]               List registered agents
  list-intents                                List recognized intents
  process <text> [--config <path>]            Process a natural language input
  help                                        Show this help message

Options:
  --config <path>    Path to config file (default: assets/config-template.json)
  --workflow <path>  Path to workflow JSON file
`);
}

function parseArgs(args) {
  const result = { command: null, positional: [], flags: {} };
  let i = 0;

  if (args.length > 0 && !args[0].startsWith("--")) {
    result.command = args[0];
    i = 1;
  }

  while (i < args.length) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result.flags[key] = args[i + 1];
        i += 2;
      } else {
        result.flags[key] = true;
        i++;
      }
    } else {
      result.positional.push(args[i]);
      i++;
    }
  }

  return result;
}

async function cmdRun(parsed) {
  const engine = loadEngine(parsed.flags.config);
  const workflowPath = parsed.flags.workflow;

  if (workflowPath) {
    try {
      const wf = engine.loadWorkflow(workflowPath);
      console.log(`Loaded workflow: ${wf.name} (${wf.tasksCreated} tasks)`);
    } catch (err) {
      console.error(`Error loading workflow: ${err.message}`);
      process.exit(1);
    }
  }

  const runResult = await engine.run();
  console.log(`Processed: ${runResult.processed}, Succeeded: ${runResult.succeeded}, Failed: ${runResult.failed}`);

  for (const task of runResult.results) {
    const status = task.status === "completed" ? "OK" : "FAIL";
    const msg = task.result ? task.result.message : (task.error ? task.error.message : "unknown");
    console.log(`  [${status}] ${task.label || task.intentId}: ${msg}`);
  }

  if (runResult.failed > 0) {
    process.exit(1);
  }
}

function cmdStatus(parsed) {
  const engine = loadEngine(parsed.flags.config);
  const status = engine.getStatus();
  console.log(JSON.stringify(status, null, 2));
}

function cmdListAgents(parsed) {
  const engine = loadEngine(parsed.flags.config);
  const agents = engine.listAgents();

  if (agents.length === 0) {
    console.log("No agents registered.");
    return;
  }

  console.log("Registered agents:");
  for (const agent of agents) {
    console.log(`  ${agent.id}: ${agent.name} [${agent.status}] (capabilities: ${agent.capabilities.join(", ") || "none"})`);
  }
}

function cmdListIntents() {
  const processor = new IntentProcessor();
  const intents = processor.listIntents();

  console.log("Recognized intents:");
  for (const intent of intents) {
    console.log(`  ${intent.id}: ${intent.label} -> agent:${intent.agent} (priority: ${intent.priority}, keywords: ${intent.keywordCount})`);
  }
}

async function cmdProcess(parsed) {
  const text = parsed.positional.join(" ");
  if (!text) {
    console.error("Error: No input text provided. Usage: process <text>");
    process.exit(1);
  }

  const engine = loadEngine(parsed.flags.config);
  const submission = engine.submitInput(text);

  if (!submission.accepted) {
    console.log(`No matching intent for: "${text}"`);
    console.log(`Reason: ${submission.reason}`);
    if (submission.intentResult.matches.length > 0) {
      console.log("Partial matches:");
      for (const m of submission.intentResult.matches) {
        console.log(`  ${m.intentId}: confidence=${m.confidence.toFixed(3)}`);
      }
    }
    return;
  }

  console.log(`Intent: ${submission.task.label} (confidence: ${submission.task.confidence.toFixed(3)})`);
  console.log(`Agent: ${submission.task.agentId}, Priority: ${submission.task.priority}`);

  const runResult = await engine.run();
  for (const task of runResult.results) {
    const status = task.status === "completed" ? "OK" : "FAIL";
    const msg = task.result ? task.result.message : "failed";
    console.log(`[${status}] ${msg}`);
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  switch (parsed.command) {
    case "run":
      await cmdRun(parsed);
      break;
    case "status":
      cmdStatus(parsed);
      break;
    case "list-agents":
      cmdListAgents(parsed);
      break;
    case "list-intents":
      cmdListIntents();
      break;
    case "process":
      await cmdProcess(parsed);
      break;
    case "help":
    case null:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${parsed.command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
