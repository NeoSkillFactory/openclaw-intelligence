"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { IntentProcessor, INTENT_DEFINITIONS } = require("../scripts/intent-processor");

describe("IntentProcessor", () => {
  it("should detect code review intent", () => {
    const processor = new IntentProcessor();
    const result = processor.process("Review the authentication module code");
    assert.ok(result.bestMatch, "should have a best match");
    assert.equal(result.bestMatch.intentId, "code_review");
    assert.equal(result.bestMatch.agent, "reviewer");
  });

  it("should detect deploy intent", () => {
    const processor = new IntentProcessor();
    const result = processor.process("Deploy the latest release to staging");
    assert.ok(result.bestMatch);
    assert.equal(result.bestMatch.intentId, "deploy");
    assert.equal(result.bestMatch.agent, "deployer");
  });

  it("should detect testing intent", () => {
    const processor = new IntentProcessor();
    const result = processor.process("Run unit tests for the user service");
    assert.ok(result.bestMatch);
    assert.equal(result.bestMatch.intentId, "test");
    assert.equal(result.bestMatch.agent, "tester");
  });

  it("should detect debug intent", () => {
    const processor = new IntentProcessor();
    const result = processor.process("Fix the bug in the login module");
    assert.ok(result.bestMatch);
    assert.equal(result.bestMatch.intentId, "debug");
    assert.equal(result.bestMatch.agent, "debugger");
  });

  it("should detect refactor intent", () => {
    const processor = new IntentProcessor();
    const result = processor.process("Refactor the database access layer to simplify it");
    assert.ok(result.bestMatch);
    assert.equal(result.bestMatch.intentId, "refactor");
  });

  it("should detect documentation intent", () => {
    const processor = new IntentProcessor();
    const result = processor.process("Update the API documentation and readme");
    assert.ok(result.bestMatch);
    assert.equal(result.bestMatch.intentId, "document");
  });

  it("should detect scaffold intent", () => {
    const processor = new IntentProcessor();
    const result = processor.process("Generate a new project scaffold");
    assert.ok(result.bestMatch);
    assert.equal(result.bestMatch.intentId, "scaffold");
  });

  it("should detect monitor intent", () => {
    const processor = new IntentProcessor();
    const result = processor.process("Monitor the health status and metrics");
    assert.ok(result.bestMatch);
    assert.equal(result.bestMatch.intentId, "monitor");
  });

  it("should return null bestMatch for unrecognizable input", () => {
    const processor = new IntentProcessor();
    const result = processor.process("make me a sandwich");
    assert.equal(result.bestMatch, null);
    assert.equal(result.confidence, 0);
  });

  it("should handle empty input", () => {
    const processor = new IntentProcessor();
    const result = processor.process("");
    assert.equal(result.bestMatch, null);
    assert.equal(result.matches.length, 0);
  });

  it("should handle null input", () => {
    const processor = new IntentProcessor();
    const result = processor.process(null);
    assert.equal(result.bestMatch, null);
  });

  it("should create a task from intent result", () => {
    const processor = new IntentProcessor();
    const result = processor.process("Deploy to production");
    const task = processor.createTask(result);
    assert.ok(task);
    assert.ok(task.id.startsWith("task-"));
    assert.equal(task.intentId, "deploy");
    assert.equal(task.agentId, "deployer");
    assert.equal(task.status, "pending");
    assert.ok(task.createdAt);
  });

  it("should return null task for no match", () => {
    const processor = new IntentProcessor();
    const result = processor.process("random unrelated text xyz");
    const task = processor.createTask(result);
    assert.equal(task, null);
  });

  it("should process multiple inputs", () => {
    const processor = new IntentProcessor();
    const results = processor.processMultiple([
      "Review the code",
      "Run tests",
      "Deploy to staging",
    ]);
    assert.equal(results.length, 3);
    assert.equal(results[0].bestMatch.intentId, "code_review");
    assert.equal(results[1].bestMatch.intentId, "test");
    assert.equal(results[2].bestMatch.intentId, "deploy");
  });

  it("should list all intents", () => {
    const processor = new IntentProcessor();
    const intents = processor.listIntents();
    assert.equal(intents.length, INTENT_DEFINITIONS.length);
    for (const intent of intents) {
      assert.ok(intent.id);
      assert.ok(intent.label);
      assert.ok(intent.agent);
      assert.ok(typeof intent.priority === "number");
      assert.ok(typeof intent.keywordCount === "number");
    }
  });

  it("should allow adding custom intents", () => {
    const processor = new IntentProcessor();
    const before = processor.listIntents().length;
    processor.addIntent({
      id: "security_scan",
      label: "Security Scan",
      keywords: ["security", "vulnerability", "scan"],
      agent: "security-agent",
      priority: 1,
    });
    assert.equal(processor.listIntents().length, before + 1);
    const result = processor.process("Run a security vulnerability scan");
    assert.ok(result.bestMatch);
    assert.equal(result.bestMatch.intentId, "security_scan");
  });

  it("should throw when adding invalid intent", () => {
    const processor = new IntentProcessor();
    assert.throws(() => processor.addIntent({ id: "bad" }), /requires id, keywords, and agent/);
  });
});
