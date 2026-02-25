"use strict";

/**
 * Natural language intent recognition and task delegation for OpenClaw workflows.
 * Uses keyword-based matching with weighted scoring - no external NLP dependencies needed.
 */

const INTENT_DEFINITIONS = [
  {
    id: "code_review",
    label: "Code Review",
    keywords: ["review", "code review", "pull request", "pr", "merge request", "diff"],
    agent: "reviewer",
    priority: 2,
  },
  {
    id: "deploy",
    label: "Deployment",
    keywords: ["deploy", "deployment", "release", "ship", "publish", "rollout"],
    agent: "deployer",
    priority: 1,
  },
  {
    id: "test",
    label: "Testing",
    keywords: ["test", "testing", "spec", "unit test", "integration test", "e2e", "coverage"],
    agent: "tester",
    priority: 2,
  },
  {
    id: "refactor",
    label: "Refactoring",
    keywords: ["refactor", "restructure", "clean up", "optimize", "simplify", "reorganize"],
    agent: "refactorer",
    priority: 3,
  },
  {
    id: "debug",
    label: "Debugging",
    keywords: ["debug", "bug", "fix", "error", "issue", "crash", "broken", "failing"],
    agent: "debugger",
    priority: 1,
  },
  {
    id: "document",
    label: "Documentation",
    keywords: ["document", "docs", "readme", "documentation", "comment", "jsdoc", "explain"],
    agent: "documenter",
    priority: 3,
  },
  {
    id: "scaffold",
    label: "Scaffolding",
    keywords: ["scaffold", "generate", "create", "init", "bootstrap", "setup", "new project"],
    agent: "scaffolder",
    priority: 2,
  },
  {
    id: "monitor",
    label: "Monitoring",
    keywords: ["monitor", "watch", "log", "alert", "health", "status", "metrics"],
    agent: "monitor",
    priority: 2,
  },
];

class IntentProcessor {
  constructor(options) {
    const opts = options || {};
    this.intents = opts.intents || INTENT_DEFINITIONS;
    this.confidenceThreshold = opts.confidenceThreshold || 0.15;
  }

  process(input) {
    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return {
        input: input || "",
        matches: [],
        bestMatch: null,
        confidence: 0,
      };
    }

    const normalized = input.toLowerCase().trim();
    const scored = [];

    for (const intent of this.intents) {
      const score = this._scoreIntent(normalized, intent);
      if (score > 0) {
        scored.push({
          intentId: intent.id,
          label: intent.label,
          agent: intent.agent,
          priority: intent.priority,
          confidence: score,
        });
      }
    }

    scored.sort((a, b) => b.confidence - a.confidence || a.priority - b.priority);

    const bestMatch = scored.length > 0 && scored[0].confidence >= this.confidenceThreshold
      ? scored[0]
      : null;

    return {
      input: input,
      matches: scored,
      bestMatch: bestMatch,
      confidence: bestMatch ? bestMatch.confidence : 0,
    };
  }

  processMultiple(inputs) {
    return inputs.map((input) => this.process(input));
  }

  createTask(intentResult) {
    if (!intentResult.bestMatch) {
      return null;
    }

    const match = intentResult.bestMatch;
    return {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      input: intentResult.input,
      intentId: match.intentId,
      label: match.label,
      agentId: match.agent,
      priority: match.priority,
      confidence: match.confidence,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  }

  addIntent(definition) {
    if (!definition.id || !definition.keywords || !definition.agent) {
      throw new Error("Intent definition requires id, keywords, and agent fields");
    }
    this.intents.push({
      id: definition.id,
      label: definition.label || definition.id,
      keywords: definition.keywords,
      agent: definition.agent,
      priority: definition.priority || 3,
    });
  }

  listIntents() {
    return this.intents.map((i) => ({
      id: i.id,
      label: i.label,
      agent: i.agent,
      priority: i.priority,
      keywordCount: i.keywords.length,
    }));
  }

  _scoreIntent(normalized, intent) {
    let score = 0;
    let matchedKeywords = 0;

    for (const keyword of intent.keywords) {
      const kw = keyword.toLowerCase();
      if (normalized.includes(kw)) {
        matchedKeywords++;
        // Longer keyword matches are weighted more heavily
        score += kw.length / normalized.length;
        // Bonus for exact word boundary matches
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
        if (regex.test(normalized)) {
          score += 0.15;
        }
      }
    }

    if (matchedKeywords > 1) {
      score *= 1 + (matchedKeywords - 1) * 0.2;
    }

    return Math.min(score, 1.0);
  }
}

module.exports = { IntentProcessor, INTENT_DEFINITIONS };
