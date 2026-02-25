"use strict";

/**
 * Error recovery and graceful degradation for OpenClaw automation workflows.
 */

class AutomationError extends Error {
  constructor(message, code, context) {
    super(message);
    this.name = "AutomationError";
    this.code = code || "UNKNOWN";
    this.context = context || {};
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
    };
  }
}

class ErrorHandler {
  constructor(options) {
    const opts = options || {};
    this.maxRetries = opts.maxRetries || 3;
    this.retryDelayMs = opts.retryDelayMs || 1000;
    this.fallbackAgents = opts.fallbackAgents || {};
    this.log = [];
  }

  record(error) {
    const entry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      code: error.code || "UNKNOWN",
      context: error.context || {},
    };
    this.log.push(entry);
    return entry;
  }

  getLog() {
    return this.log.slice();
  }

  clearLog() {
    this.log = [];
  }

  async withRetry(fn, label) {
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastError = err instanceof AutomationError
          ? err
          : new AutomationError(err.message, "RETRY_FAILED", { label, attempt });
        this.record(lastError);
        if (attempt < this.maxRetries) {
          await this._delay(this.retryDelayMs * attempt);
        }
      }
    }
    throw new AutomationError(
      `All ${this.maxRetries} retries exhausted for: ${label || "operation"}`,
      "RETRIES_EXHAUSTED",
      { label, lastError: lastError.message }
    );
  }

  resolveFallbackAgent(agentId) {
    return this.fallbackAgents[agentId] || null;
  }

  handleTaskFailure(task, error) {
    const automationErr = error instanceof AutomationError
      ? error
      : new AutomationError(error.message, "TASK_FAILED", { taskId: task.id });
    this.record(automationErr);

    const fallback = this.resolveFallbackAgent(task.agentId);
    if (fallback) {
      return {
        action: "reroute",
        originalAgent: task.agentId,
        fallbackAgent: fallback,
        task: task,
        error: automationErr.toJSON(),
      };
    }

    return {
      action: "abort",
      originalAgent: task.agentId,
      fallbackAgent: null,
      task: task,
      error: automationErr.toJSON(),
    };
  }

  formatReport() {
    if (this.log.length === 0) {
      return "No errors recorded.";
    }
    const lines = ["Error Report", "============", ""];
    for (const entry of this.log) {
      lines.push(`[${entry.timestamp}] ${entry.code}: ${entry.message}`);
      if (Object.keys(entry.context).length > 0) {
        lines.push(`  Context: ${JSON.stringify(entry.context)}`);
      }
    }
    lines.push("", `Total errors: ${this.log.length}`);
    return lines.join("\n");
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { ErrorHandler, AutomationError };
