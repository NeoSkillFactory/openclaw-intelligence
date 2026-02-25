"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { AutomationEngine } = require("../scripts/openclaw-intelligence");

const CONFIG_PATH = path.join(__dirname, "..", "assets", "config-template.json");
const WORKFLOW_PATH = path.join(__dirname, "..", "assets", "workflow-examples", "basic-routing.json");

describe("AutomationEngine", () => {
  let engine;

  beforeEach(() => {
    engine = new AutomationEngine();
    engine.loadConfig(CONFIG_PATH);
  });

  it("should load config and register agents", () => {
    const agents = engine.listAgents();
    assert.equal(agents.length, 8);
    const ids = agents.map((a) => a.id);
    assert.ok(ids.includes("reviewer"));
    assert.ok(ids.includes("deployer"));
    assert.ok(ids.includes("tester"));
  });

  it("should get a specific agent", () => {
    const agent = engine.getAgent("reviewer");
    assert.ok(agent);
    assert.equal(agent.name, "Code Reviewer");
  });

  it("should return null for unknown agent", () => {
    assert.equal(engine.getAgent("nonexistent"), null);
  });

  it("should submit input and create task", () => {
    const result = engine.submitInput("Review the code");
    assert.ok(result.accepted);
    assert.ok(result.task);
    assert.equal(result.task.agentId, "reviewer");
    assert.equal(engine.taskQueue.length, 1);
  });

  it("should reject unrecognized input", () => {
    const result = engine.submitInput("make me a sandwich");
    assert.equal(result.accepted, false);
    assert.ok(result.reason);
  });

  it("should submit a manual task", () => {
    const task = engine.submitTask({
      intentId: "custom",
      label: "Custom Task",
      agentId: "reviewer",
      priority: 1,
    });
    assert.ok(task.id);
    assert.equal(task.status, "pending");
    assert.equal(engine.taskQueue.length, 1);
  });

  it("should process a task successfully", async () => {
    engine.submitInput("Deploy to production");
    const result = await engine.processNextTask();
    assert.ok(result);
    assert.equal(result.status, "completed");
    assert.ok(result.result.message.includes("Deployment Agent"));
  });

  it("should handle task for unknown agent with fallback", async () => {
    engine.submitTask({
      intentId: "test",
      label: "Test Task",
      agentId: "nonexistent-agent",
      priority: 1,
    });
    const result = await engine.processNextTask();
    assert.ok(result);
    // No fallback for nonexistent-agent, so it should fail
    assert.equal(result.status, "failed");
  });

  it("should process all tasks", async () => {
    engine.submitInput("Review the code");
    engine.submitInput("Run tests");
    engine.submitInput("Deploy to staging");
    const results = await engine.processAll();
    assert.equal(results.length, 3);
    assert.ok(results.every((r) => r.status === "completed"));
  });

  it("should sort queue by priority", () => {
    engine.submitTask({ intentId: "low", label: "Low", agentId: "reviewer", priority: 3 });
    engine.submitTask({ intentId: "high", label: "High", agentId: "deployer", priority: 1 });
    engine.submitTask({ intentId: "mid", label: "Mid", agentId: "tester", priority: 2 });
    assert.equal(engine.taskQueue[0].priority, 1);
    assert.equal(engine.taskQueue[1].priority, 2);
    assert.equal(engine.taskQueue[2].priority, 3);
  });

  it("should run and return summary", async () => {
    engine.submitInput("Review the code");
    engine.submitInput("Deploy to staging");
    const runResult = await engine.run();
    assert.equal(runResult.processed, 2);
    assert.equal(runResult.succeeded, 2);
    assert.equal(runResult.failed, 0);
    assert.ok(runResult.errorReport);
  });

  it("should load and process a workflow", async () => {
    const wf = engine.loadWorkflow(WORKFLOW_PATH);
    assert.equal(wf.name, "basic-routing");
    assert.equal(wf.tasksCreated, 3);
    const runResult = await engine.run();
    assert.equal(runResult.processed, 3);
    assert.equal(runResult.succeeded, 3);
  });

  it("should return engine status", () => {
    engine.submitInput("Run tests");
    const status = engine.getStatus();
    assert.equal(status.queueLength, 1);
    assert.equal(status.completedCount, 0);
    assert.ok(Array.isArray(status.agents));
    assert.equal(status.agents.length, 8);
  });

  it("should register custom agents", () => {
    engine.registerAgent("custom", { name: "Custom Agent", capabilities: ["stuff"] });
    const agent = engine.getAgent("custom");
    assert.ok(agent);
    assert.equal(agent.name, "Custom Agent");
    assert.deepEqual(agent.capabilities, ["stuff"]);
  });

  it("should return null when processing empty queue", async () => {
    const result = await engine.processNextTask();
    assert.equal(result, null);
  });
});
