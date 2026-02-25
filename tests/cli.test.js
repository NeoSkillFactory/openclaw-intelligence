"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("path");

const CLI_PATH = path.join(__dirname, "..", "scripts", "cli.js");
const SKILL_ROOT = path.join(__dirname, "..");

function runCli(args) {
  return execFileSync("node", [CLI_PATH, ...args], {
    cwd: SKILL_ROOT,
    encoding: "utf-8",
    timeout: 10000,
  });
}

describe("CLI", () => {
  it("should show help when no command given", () => {
    const output = runCli(["help"]);
    assert.ok(output.includes("Usage:"));
    assert.ok(output.includes("Commands:"));
  });

  it("should list agents", () => {
    const output = runCli(["list-agents"]);
    assert.ok(output.includes("Registered agents:"));
    assert.ok(output.includes("reviewer"));
    assert.ok(output.includes("deployer"));
    assert.ok(output.includes("tester"));
  });

  it("should list intents", () => {
    const output = runCli(["list-intents"]);
    assert.ok(output.includes("Recognized intents:"));
    assert.ok(output.includes("code_review"));
    assert.ok(output.includes("deploy"));
    assert.ok(output.includes("test"));
  });

  it("should process a natural language input", () => {
    const output = runCli(["process", "Fix the bug in authentication"]);
    assert.ok(output.includes("Intent:"));
    assert.ok(output.includes("[OK]"));
  });

  it("should run a workflow file", () => {
    const output = runCli(["run", "--workflow", "assets/workflow-examples/basic-routing.json"]);
    assert.ok(output.includes("Loaded workflow: basic-routing"));
    assert.ok(output.includes("Succeeded: 3"));
  });

  it("should show status as JSON", () => {
    const output = runCli(["status"]);
    const parsed = JSON.parse(output);
    assert.ok(Array.isArray(parsed.agents));
    assert.equal(typeof parsed.queueLength, "number");
    assert.equal(typeof parsed.completedCount, "number");
  });

  it("should exit with error for unknown command", () => {
    assert.throws(() => runCli(["unknown-command"]), (err) => {
      assert.ok(err.status !== 0);
      return true;
    });
  });
});
