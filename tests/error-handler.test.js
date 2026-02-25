"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { ErrorHandler, AutomationError } = require("../scripts/error-handler");

describe("AutomationError", () => {
  it("should create error with message, code, and context", () => {
    const err = new AutomationError("something failed", "TEST_FAIL", { key: "val" });
    assert.equal(err.message, "something failed");
    assert.equal(err.code, "TEST_FAIL");
    assert.deepEqual(err.context, { key: "val" });
    assert.ok(err.timestamp);
    assert.equal(err.name, "AutomationError");
  });

  it("should serialize to JSON", () => {
    const err = new AutomationError("fail", "ERR1");
    const json = err.toJSON();
    assert.equal(json.name, "AutomationError");
    assert.equal(json.message, "fail");
    assert.equal(json.code, "ERR1");
  });

  it("should default code to UNKNOWN", () => {
    const err = new AutomationError("oops");
    assert.equal(err.code, "UNKNOWN");
  });
});

describe("ErrorHandler", () => {
  it("should record errors and return log", () => {
    const handler = new ErrorHandler();
    const err = new AutomationError("test error", "TEST");
    handler.record(err);
    const log = handler.getLog();
    assert.equal(log.length, 1);
    assert.equal(log[0].message, "test error");
    assert.equal(log[0].code, "TEST");
  });

  it("should clear log", () => {
    const handler = new ErrorHandler();
    handler.record(new AutomationError("err1", "E1"));
    handler.record(new AutomationError("err2", "E2"));
    assert.equal(handler.getLog().length, 2);
    handler.clearLog();
    assert.equal(handler.getLog().length, 0);
  });

  it("should retry and succeed on later attempt", async () => {
    const handler = new ErrorHandler({ maxRetries: 3, retryDelayMs: 10 });
    let calls = 0;
    const result = await handler.withRetry(async (attempt) => {
      calls++;
      if (attempt < 3) throw new Error("not yet");
      return "success";
    }, "test-op");
    assert.equal(result, "success");
    assert.equal(calls, 3);
  });

  it("should exhaust retries and throw", async () => {
    const handler = new ErrorHandler({ maxRetries: 2, retryDelayMs: 10 });
    await assert.rejects(
      () => handler.withRetry(async () => { throw new Error("always fail"); }, "failing-op"),
      (err) => {
        assert.ok(err instanceof AutomationError);
        assert.equal(err.code, "RETRIES_EXHAUSTED");
        return true;
      }
    );
  });

  it("should resolve fallback agent", () => {
    const handler = new ErrorHandler({
      fallbackAgents: { reviewer: "documenter", deployer: "monitor" },
    });
    assert.equal(handler.resolveFallbackAgent("reviewer"), "documenter");
    assert.equal(handler.resolveFallbackAgent("deployer"), "monitor");
    assert.equal(handler.resolveFallbackAgent("unknown"), null);
  });

  it("should handle task failure with reroute", () => {
    const handler = new ErrorHandler({
      fallbackAgents: { reviewer: "documenter" },
    });
    const task = { id: "t1", agentId: "reviewer" };
    const result = handler.handleTaskFailure(task, new Error("agent down"));
    assert.equal(result.action, "reroute");
    assert.equal(result.fallbackAgent, "documenter");
    assert.equal(result.originalAgent, "reviewer");
  });

  it("should handle task failure with abort when no fallback", () => {
    const handler = new ErrorHandler();
    const task = { id: "t2", agentId: "nonexistent" };
    const result = handler.handleTaskFailure(task, new Error("no agent"));
    assert.equal(result.action, "abort");
    assert.equal(result.fallbackAgent, null);
  });

  it("should format an error report", () => {
    const handler = new ErrorHandler();
    handler.record(new AutomationError("err1", "E1"));
    handler.record(new AutomationError("err2", "E2", { detail: "info" }));
    const report = handler.formatReport();
    assert.ok(report.includes("Error Report"));
    assert.ok(report.includes("E1: err1"));
    assert.ok(report.includes("E2: err2"));
    assert.ok(report.includes("Total errors: 2"));
  });

  it("should return empty report when no errors", () => {
    const handler = new ErrorHandler();
    assert.equal(handler.formatReport(), "No errors recorded.");
  });
});
