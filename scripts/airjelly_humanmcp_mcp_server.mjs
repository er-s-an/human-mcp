#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const runtimePath = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "AirJelly",
  "runtime.json",
);

const defaults = {
  coordinatorUrl: process.env.HUMANMCP_COORDINATOR_URL || "http://127.0.0.1:4180",
  humanId: process.env.HUMANMCP_HUMAN_ID || "lindsay",
  humanName: process.env.HUMANMCP_HUMAN_NAME || "Lindsay",
  endpoint: process.env.HUMANMCP_ENDPOINT || "/lindsay/business_judgement",
  targetHumanId: process.env.HUMANMCP_TARGET_HUMAN_ID || process.env.HUMANMCP_HUMAN_ID || "lindsay",
  targetHumanName: process.env.HUMANMCP_TARGET_HUMAN_NAME || process.env.HUMANMCP_HUMAN_NAME || "Lindsay",
  targetEndpoint: process.env.HUMANMCP_TARGET_ENDPOINT || process.env.HUMANMCP_ENDPOINT || "/lindsay/business_judgement",
  token: process.env.HUMANMCP_BRIDGE_TOKEN || "",
};

function jsonText(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function authHeaders(token = defaults.token, extra = {}) {
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}`, "X-HumanMCP-Token": token } : {}),
  };
}

async function readJson(response, label) {
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} returned non-JSON HTTP ${response.status}`);
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message || payload?.error || `${label} failed with HTTP ${response.status}`);
  }
  return payload?.data ?? payload;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: authHeaders(options.token, options.headers || {}),
  });
  return readJson(response, url);
}

function readAirJellyRuntime({ required = true } = {}) {
  try {
    const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
    if (!runtime.port || !runtime.token) {
      throw new Error("runtime missing port or token");
    }
    return runtime;
  } catch (error) {
    if (required) {
      throw new Error(`AirJelly runtime unavailable at ${runtimePath}: ${error.message || error}`);
    }
    return null;
  }
}

function createAirJellyClient(runtime) {
  const baseUrl = `http://127.0.0.1:${runtime.port}`;
  const headers = { Authorization: `Bearer ${runtime.token}` };
  return {
    async get(pathname) {
      const response = await fetch(`${baseUrl}${pathname}`, { headers });
      return readJson(response, `AirJelly ${pathname}`);
    },
    async rpc(method, rpcArgs = []) {
      const response = await fetch(`${baseUrl}/rpc`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ method, args: rpcArgs }),
      });
      return readJson(response, `AirJelly RPC ${method}`);
    },
  };
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/u)
    .filter((token) => token.length >= 2)
    .slice(0, 30);
}

function textOf(value) {
  if (!value || typeof value !== "object") return String(value || "");
  return Object.values(value)
    .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
    .filter((entry) => ["string", "number", "boolean"].includes(typeof entry))
    .join(" ");
}

function keywordHits(items, tokens) {
  if (!Array.isArray(items) || tokens.length === 0) return 0;
  return items.reduce((count, item) => {
    const haystack = textOf(item).toLowerCase();
    return count + (tokens.some((token) => haystack.includes(token)) ? 1 : 0);
  }, 0);
}

async function collectAirJellySignals({ mock = false } = {}) {
  if (mock) {
    return {
      adapterMode: "Mock Mode",
      health: { ok: true, version: "mock" },
      capabilities: { methods: ["listOpenTasks", "listMemories", "listPersons", "getDailyAppUsage"] },
      tasks: [{ title: "Review product demo and waitlist copy" }],
      memories: [{ summary: "Often gives product feedback, UX clarity notes, and technical review." }],
      persons: [{ name: defaults.humanId }],
      appUsage: [{ app: "AirJelly" }],
    };
  }

  const runtime = readAirJellyRuntime();
  const client = createAirJellyClient(runtime);
  const [health, capabilities] = await Promise.all([client.get("/health"), client.get("/capabilities")]);
  const methods = new Set(capabilities?.methods || []);
  const [tasks, memories, persons, appUsage] = await Promise.all([
    methods.has("listOpenTasks") ? client.rpc("listOpenTasks", [20]) : [],
    methods.has("listMemories") ? client.rpc("listMemories", [{ limit: 50 }]) : [],
    methods.has("listPersons") ? client.rpc("listPersons") : [],
    methods.has("getDailyAppUsage") ? client.rpc("getDailyAppUsage", [new Date().toISOString().slice(0, 10)]) : [],
  ]);
  return {
    adapterMode: "AirJelly Connected",
    health,
    capabilities,
    tasks,
    memories,
    persons,
    appUsage,
  };
}

function classifyIntent(rawIntent) {
  const value = String(rawIntent || "").toLowerCase();
  const categories = [
    {
      type: "product_clarity",
      keywords: ["demo", "product", "landing", "waitlist", "pitch", "copy", "用户", "产品", "演示", "转化", "文案"],
      question:
        "In 10 seconds, do you understand what this product/demo solves, would you click Join Waitlist, and what is the one biggest confusing part?",
      outputSchema: {
        understood_in_10s: "boolean",
        click_intent: "yes | maybe | no",
        main_confusion: "string",
        suggested_change: "string",
      },
    },
    {
      type: "decision_review",
      keywords: ["choose", "decision", "should i", "tradeoff", "option", "判断", "选择", "要不要", "决策"],
      question:
        "Given the visible context, which option would you choose, what is the main risk, and what one fact would change your mind?",
      outputSchema: {
        recommended_option: "string",
        main_risk: "string",
        confidence: "low | medium | high",
        missing_fact: "string",
      },
    },
    {
      type: "debug_triage",
      keywords: ["bug", "error", "debug", "crash", "broken", "报错", "调试", "坏了", "失败"],
      question:
        "From the visible symptom only, what is the most likely next debugging step and what information should be checked first?",
      outputSchema: {
        likely_next_step: "string",
        first_check: "string",
        confidence: "low | medium | high",
        risk: "string",
      },
    },
  ];
  const ranked = categories
    .map((category) => ({
      ...category,
      hits: category.keywords.filter((keyword) => value.includes(keyword)).length,
    }))
    .sort((a, b) => b.hits - a.hits);
  return ranked[0].hits > 0
    ? ranked[0]
    : {
        type: "general_judgment",
        hits: 0,
        question:
          "What is your quick human judgment on this request, what is unclear, and what should change next?",
        outputSchema: {
          judgment: "string",
          unclear_part: "string",
          suggested_next_step: "string",
          confidence: "low | medium | high",
        },
      };
}

function buildDispatch({ signals, intentType, rawIntent, humanId, humanName, endpoint, minScore = 0.45 }) {
  const tokens = tokenize(rawIntent);
  const taskHits = keywordHits(signals.tasks, tokens);
  const memoryHits = keywordHits(signals.memories, tokens);
  const methodCount = Array.isArray(signals.capabilities?.methods) ? signals.capabilities.methods.length : 0;
  const liveBonus = signals.adapterMode === "AirJelly Connected" ? 0.28 : 0.12;
  const score = Math.min(
    0.99,
    Number(
      (
        liveBonus +
        Math.min(taskHits, 3) * 0.12 +
        Math.min(memoryHits, 3) * 0.1 +
        (methodCount ? 0.12 : 0.04) +
        0.18
      ).toFixed(2),
    ),
  );
  const visibleIntent = String(rawIntent || "").trim().slice(0, 600);
  const question = `${intentType.question}\n\nUser intent: ${visibleIntent}`;
  return {
    score,
    matched: score >= minScore,
    payload: {
      humanId,
      humanName,
      endpoint,
      question,
      taskPacket: {
        taskType: "intent-routed human judgment",
        privacyLevel: "P1",
        privacyBudget: "P1 · intent summary only",
        role: "target-user reviewer",
        goal: "Answer one bounded question selected from local AirJelly intent/context signals.",
        visibleContext: {
          userIntent: visibleIntent,
          inferredIntentType: intentType.type,
          airjellySignalSummary: `${signals.adapterMode}; ${taskHits} open-task overlaps; ${memoryHits} memory-summary overlaps; ${methodCount} available AirJelly methods.`,
        },
        hiddenContext: [
          "raw AirJelly memories",
          "screenshots",
          "private messages",
          "credentials",
          "unrelated tabs",
          "full app usage history",
        ],
        singleQuestion: question,
        outputSchema: intentType.outputSchema,
        guardrails:
          "Use only the visible intent summary. Do not infer private identity, private history, legal, finance, medical, employment, or credential-sensitive decisions.",
      },
      airjellyMatchSummary: {
        source: "AirJelly Suggested, User Approved",
        adapterMode: signals.adapterMode,
        match: {
          status: score >= minScore ? "matched" : "low_confidence",
          need: {
            label: "AI needs human judgment",
            reason: `Local intent classified as ${intentType.type}.`,
            question,
          },
          candidate: { displayName: humanName, endpoint },
          signals: [
            {
              label: "Intent classifier",
              summary: `Intent type ${intentType.type}; keyword hits ${intentType.hits || 0}.`,
              source: "local MCP dispatcher",
            },
            {
              label: "Local AirJelly context",
              summary: `${taskHits} task overlaps and ${memoryHits} memory-summary overlaps were reduced to counts only.`,
              source: "local AirJelly broker",
            },
          ],
          score,
          exportedContext:
            "Only the intent summary and aggregate counts leave AirJelly; raw memories and screenshots stay local.",
        },
      },
    },
  };
}

function targetIdentity(args = {}) {
  return {
    humanId: args.targetHumanId || args.target_human_id || args.humanId || defaults.targetHumanId,
    humanName: args.targetHumanName || args.target_human_name || args.humanName || defaults.targetHumanName,
    endpoint: args.targetEndpoint || args.target_endpoint || args.endpoint || defaults.targetEndpoint,
  };
}

function buildProfileTag({ signals, humanId }) {
  const corpus = [signals.tasks, signals.memories, signals.persons, signals.appUsage].flat().map(textOf).join(" ");
  const catalog = [
    {
      label: "product-feedback",
      keywords: ["product", "用户", "user", "waitlist", "landing", "demo", "copy", "feedback", "产品", "转化", "文案"],
    },
    {
      label: "technical-review",
      keywords: ["code", "debug", "api", "sdk", "mcp", "github", "terminal", "error", "代码", "调试", "接口"],
    },
    {
      label: "founder-operator",
      keywords: ["founder", "startup", "business", "growth", "customer", "sales", "创始人", "商业", "增长", "客户"],
    },
    {
      label: "ux-clarity",
      keywords: ["ux", "ui", "design", "interface", "flow", "clarity", "页面", "设计", "体验", "清楚"],
    },
    {
      label: "research-synthesis",
      keywords: ["research", "summary", "compare", "analysis", "paper", "docs", "研究", "总结", "分析", "对比"],
    },
  ];
  const scored = catalog
    .map((tag) => ({
      label: tag.label,
      rawScore: tag.keywords.reduce((score, keyword) => score + (corpus.toLowerCase().includes(keyword) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.rawScore - a.rawScore);
  const topScore = scored[0]?.rawScore || 0;
  const tags = scored
    .filter((tag) => tag.rawScore > 0)
    .slice(0, 3)
    .map((tag) => ({
      label: tag.label,
      score: Math.min(0.99, Number((0.45 + tag.rawScore / Math.max(topScore + 3, 6)).toFixed(2))),
    }));
  if (!tags.length) tags.push({ label: "general-judgment", score: 0.42 });
  return {
    humanId,
    primaryTag: tags[0].label,
    tags,
    confidence: tags[0].score,
    evidenceCounts: {
      memories: Array.isArray(signals.memories) ? signals.memories.length : 0,
      openTasks: Array.isArray(signals.tasks) ? signals.tasks.length : 0,
      persons: Array.isArray(signals.persons) ? signals.persons.length : 0,
      appBuckets: Array.isArray(signals.appUsage) ? signals.appUsage.length : 0,
      airjellyMethods: Array.isArray(signals.capabilities?.methods) ? signals.capabilities.methods.length : 0,
      matchedKeywordScore: topScore,
    },
    privacy:
      "Profile tag only; raw AirJelly memories, screenshots, people graph, task text, and app usage stay local.",
    source: "airjelly-humanmcp-mcp-server",
  };
}

const tools = [
  {
    name: "airjelly_status",
    description: "Check local AirJelly runtime, health, and capability method count on this computer.",
    inputSchema: {
      type: "object",
      properties: {
        includeCapabilities: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "airjelly_profile_tag",
    description:
      "Generate a privacy-safe local helper profile tag from this computer's AirJelly signals; optionally publish it to the HumanMCP coordinator.",
    inputSchema: {
      type: "object",
      properties: {
        humanId: { type: "string" },
        coordinatorUrl: { type: "string" },
        publish: { type: "boolean", default: false },
        mock: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "humanmcp_classify_intent",
    description:
      "Classify a local user intent with AirJelly context and produce a P1 HumanMCP task payload without dispatching.",
    inputSchema: {
      type: "object",
      required: ["intent"],
      properties: {
        intent: { type: "string" },
        targetHumanId: { type: "string", description: "Peer/helper humanId to send the task to." },
        targetHumanName: { type: "string", description: "Peer/helper display name." },
        targetEndpoint: { type: "string", description: "Peer/helper endpoint label." },
        humanId: { type: "string", description: "Deprecated alias for targetHumanId." },
        humanName: { type: "string", description: "Deprecated alias for targetHumanName." },
        endpoint: { type: "string", description: "Deprecated alias for targetEndpoint." },
        minScore: { type: "number", default: 0.45 },
        mock: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "humanmcp_dispatch_task",
    description:
      "Dispatch a HumanMCP task to the coordinator from either a raw question or a locally classified user intent.",
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "string" },
        question: { type: "string" },
        coordinatorUrl: { type: "string" },
        targetHumanId: { type: "string", description: "Peer/helper humanId to send the task to." },
        targetHumanName: { type: "string", description: "Peer/helper display name." },
        targetEndpoint: { type: "string", description: "Peer/helper endpoint label." },
        humanId: { type: "string", description: "Deprecated alias for targetHumanId." },
        humanName: { type: "string", description: "Deprecated alias for targetHumanName." },
        endpoint: { type: "string", description: "Deprecated alias for targetEndpoint." },
        mock: { type: "boolean", default: false },
        dryRun: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "humanmcp_get_inbox",
    description: "Read open HumanMCP inbox tasks for a helper humanId.",
    inputSchema: {
      type: "object",
      properties: {
        coordinatorUrl: { type: "string" },
        humanId: { type: "string" },
      },
    },
  },
  {
    name: "humanmcp_answer_task",
    description: "Submit an answer for a HumanMCP task.",
    inputSchema: {
      type: "object",
      required: ["taskId", "answer"],
      properties: {
        coordinatorUrl: { type: "string" },
        taskId: { type: "string" },
        answer: { type: "string" },
      },
    },
  },
  {
    name: "humanmcp_get_stage_state",
    description: "Read the current HumanMCP coordinator stage-state.",
    inputSchema: {
      type: "object",
      properties: {
        coordinatorUrl: { type: "string" },
      },
    },
  },
  {
    name: "airjelly_create_local_task",
    description:
      "Create a local AirJelly task on this computer. This uses AirJelly createTask and may consume embedding credit.",
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        scene: { type: "string", default: "connect" },
        nextSteps: { type: "array", items: { type: "string" } },
      },
    },
  },
];

async function callTool(name, args = {}) {
  if (name === "airjelly_status") {
    const runtime = readAirJellyRuntime({ required: false });
    if (!runtime) {
      return jsonText({ ok: false, runtimeFound: false, runtimePath });
    }
    const client = createAirJellyClient(runtime);
    const [health, capabilities] = await Promise.all([client.get("/health"), client.get("/capabilities")]);
    return jsonText({
      ok: true,
      runtimeFound: true,
      runtimePath,
      port: runtime.port,
      healthOk: Boolean(health?.ok),
      version: health?.version || capabilities?.appVersion || null,
      methodCount: Array.isArray(capabilities?.methods) ? capabilities.methods.length : 0,
      methods: args.includeCapabilities ? capabilities?.methods || [] : undefined,
    });
  }

  if (name === "airjelly_profile_tag") {
    const humanId = args.humanId || defaults.humanId;
    const coordinatorUrl = (args.coordinatorUrl || defaults.coordinatorUrl).replace(/\/$/, "");
    const signals = await collectAirJellySignals({ mock: Boolean(args.mock) });
    const profile = buildProfileTag({ signals, humanId });
    if (!args.publish) {
      return jsonText({ ok: true, published: false, profile });
    }
    const result = await fetchJson(`${coordinatorUrl}/humanmcp/helpers/${encodeURIComponent(humanId)}/profile-tag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    return jsonText({ ok: true, published: true, profile: result.profile || profile });
  }

  if (name === "humanmcp_classify_intent") {
    if (!String(args.intent || "").trim()) throw new Error("intent is required");
    const signals = await collectAirJellySignals({ mock: Boolean(args.mock) });
    const intentType = classifyIntent(args.intent);
    const target = targetIdentity(args);
    const dispatch = buildDispatch({
      signals,
      intentType,
      rawIntent: args.intent,
      humanId: target.humanId,
      humanName: target.humanName,
      endpoint: target.endpoint,
      minScore: Number(args.minScore || 0.45),
    });
    return jsonText({ ok: true, inferredIntentType: intentType.type, ...dispatch });
  }

  if (name === "humanmcp_dispatch_task") {
    const coordinatorUrl = (args.coordinatorUrl || defaults.coordinatorUrl).replace(/\/$/, "");
    let payload = null;
    let score = null;
    let inferredIntentType = null;
    const target = targetIdentity(args);
    if (String(args.question || "").trim()) {
      payload = {
        humanId: target.humanId,
        humanName: target.humanName,
        endpoint: target.endpoint,
        question: String(args.question).trim(),
      };
    } else {
      if (!String(args.intent || "").trim()) throw new Error("intent or question is required");
      const signals = await collectAirJellySignals({ mock: Boolean(args.mock) });
      const intentType = classifyIntent(args.intent);
      const dispatch = buildDispatch({
        signals,
        intentType,
        rawIntent: args.intent,
        humanId: target.humanId,
        humanName: target.humanName,
        endpoint: target.endpoint,
      });
      payload = dispatch.payload;
      score = dispatch.score;
      inferredIntentType = intentType.type;
    }
    if (args.dryRun) return jsonText({ ok: true, dryRun: true, score, inferredIntentType, payload });
    const response = await fetchJson(`${coordinatorUrl}/humanmcp/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return jsonText({ ok: true, score, inferredIntentType, task: response.task, inboxUrl: response.inboxUrl });
  }

  if (name === "humanmcp_get_inbox") {
    const coordinatorUrl = (args.coordinatorUrl || defaults.coordinatorUrl).replace(/\/$/, "");
    const humanId = args.humanId || defaults.humanId;
    return jsonText(await fetchJson(`${coordinatorUrl}/humanmcp/inbox/${encodeURIComponent(humanId)}`));
  }

  if (name === "humanmcp_answer_task") {
    const coordinatorUrl = (args.coordinatorUrl || defaults.coordinatorUrl).replace(/\/$/, "");
    if (!args.taskId) throw new Error("taskId is required");
    if (!String(args.answer || "").trim()) throw new Error("answer is required");
    return jsonText(
      await fetchJson(`${coordinatorUrl}/humanmcp/tasks/${encodeURIComponent(args.taskId)}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: args.answer }),
      }),
    );
  }

  if (name === "humanmcp_get_stage_state") {
    const coordinatorUrl = (args.coordinatorUrl || defaults.coordinatorUrl).replace(/\/$/, "");
    return jsonText(await fetchJson(`${coordinatorUrl}/humanmcp/stage-state`));
  }

  if (name === "airjelly_create_local_task") {
    const runtime = readAirJellyRuntime();
    const client = createAirJellyClient(runtime);
    const result = await client.rpc("createTask", [
      {
        title: args.title,
        description: args.description || "",
        l1_scene: args.scene || "connect",
        next_steps: Array.isArray(args.nextSteps) ? args.nextSteps : [],
      },
    ]);
    return jsonText({ ok: true, result });
  }

  throw new Error(`unknown tool: ${name}`);
}

function responseMessage(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function errorMessage(id, error) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message: error.message || String(error),
    },
  };
}

async function handleMessage(message) {
  if (!message || typeof message !== "object") return null;
  const { id, method, params = {} } = message;
  if (!id && method?.startsWith("notifications/")) return null;
  if (method === "initialize") {
    return responseMessage(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "airjelly-humanmcp", version: "0.1.0" },
    });
  }
  if (method === "ping") return responseMessage(id, {});
  if (method === "tools/list") return responseMessage(id, { tools });
  if (method === "tools/call") {
    const result = await callTool(params.name, params.arguments || {});
    return responseMessage(id, result);
  }
  return errorMessage(id, new Error(`unsupported method: ${method}`));
}

function writeMessage(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

let buffer = Buffer.alloc(0);
function tryParseMessages() {
  while (buffer.length) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd >= 0) {
      const header = buffer.slice(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) throw new Error("missing Content-Length header");
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const body = buffer.slice(start, start + length).toString("utf8");
      buffer = buffer.slice(start + length);
      void handleMessage(JSON.parse(body))
        .then((reply) => {
          if (reply) writeMessage(reply);
        })
        .catch((error) => writeMessage(errorMessage(JSON.parse(body).id, error)));
      continue;
    }

    const newline = buffer.indexOf("\n");
    if (newline < 0) return;
    const line = buffer.slice(0, newline).toString("utf8").trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    void handleMessage(JSON.parse(line))
      .then((reply) => {
        if (reply) writeMessage(reply);
      })
      .catch((error) => writeMessage(errorMessage(null, error)));
  }
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  try {
    tryParseMessages();
  } catch (error) {
    writeMessage(errorMessage(null, error));
  }
});
