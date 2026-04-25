#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const runtimePath = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "AirJelly",
  "runtime.json",
);

function argValue(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

const coordinator = argValue("--coordinator", process.env.HUMANMCP_COORDINATOR_URL || "http://127.0.0.1:4180");
const humanId = argValue("--human-id", process.env.HUMANMCP_HUMAN_ID || "lindsay");
const humanName = argValue("--human-name", process.env.HUMANMCP_HUMAN_NAME || "Lindsay");
const endpoint = argValue("--endpoint", process.env.HUMANMCP_ENDPOINT || "/lindsay/business_judgement");
const intent = argValue("--intent", process.env.HUMANMCP_INTENT || "");
const token = argValue("--token", process.env.HUMANMCP_BRIDGE_TOKEN || "");
const dryRun = args.includes("--dry-run");
const mock = args.includes("--mock");
const minScore = Number(argValue("--min-score", process.env.HUMANMCP_INTENT_MIN_SCORE || "0.45"));

if (!intent.trim()) {
  console.error("Missing --intent \"what the user is trying to decide\"");
  process.exit(2);
}

function headers(extra = {}) {
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
  return payload.data ?? payload;
}

function readRuntime() {
  const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
  if (!runtime.port || !runtime.token) {
    throw new Error("AirJelly runtime.json is missing port or token");
  }
  return runtime;
}

function createAirJellyClient(runtime) {
  const baseUrl = `http://127.0.0.1:${runtime.port}`;
  const authHeaders = { Authorization: `Bearer ${runtime.token}` };
  return {
    async get(pathname) {
      const response = await fetch(`${baseUrl}${pathname}`, { headers: authHeaders });
      return readJson(response, `AirJelly ${pathname}`);
    },
    async rpc(method, rpcArgs = []) {
      const response = await fetch(`${baseUrl}/rpc`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
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

async function collectSignals() {
  if (mock) {
    return {
      adapterMode: "Mock Mode",
      health: { ok: true, version: "mock" },
      capabilities: { methods: [] },
      tasks: [],
      memories: [],
      persons: [],
      appUsage: [],
    };
  }

  const runtime = readRuntime();
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
  const value = rawIntent.toLowerCase();
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
        keywords: [],
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

function buildDispatch({ signals, intentType, rawIntent }) {
  const tokens = tokenize(rawIntent);
  const taskHits = keywordHits(signals.tasks, tokens);
  const memoryHits = keywordHits(signals.memories, tokens);
  const methodCount = Array.isArray(signals.capabilities?.methods) ? signals.capabilities.methods.length : 0;
  const liveBonus = signals.adapterMode === "AirJelly Connected" ? 0.28 : 0.12;
  const score = Math.min(0.99, Number((liveBonus + Math.min(taskHits, 3) * 0.12 + Math.min(memoryHits, 3) * 0.1 + (methodCount ? 0.12 : 0.04) + 0.18).toFixed(2)));
  const visibleIntent = rawIntent.trim().slice(0, 600);
  const question = `${intentType.question}\n\nUser intent: ${visibleIntent}`;

  return {
    score,
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
              source: "local dispatcher",
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

async function postTask(payload) {
  const response = await fetch(`${coordinator.replace(/\/$/, "")}/humanmcp/tasks`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return readJson(response, "HumanMCP task dispatch");
}

async function main() {
  const signals = await collectSignals();
  const intentType = classifyIntent(intent);
  const dispatch = buildDispatch({ signals, intentType, rawIntent: intent });

  if (dispatch.score < minScore) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: "intent score below threshold",
          score: dispatch.score,
          minScore,
          inferredIntentType: intentType.type,
          dryRun: true,
          payload: dispatch.payload,
        },
        null,
        2,
      ),
    );
    process.exit(3);
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          score: dispatch.score,
          inferredIntentType: intentType.type,
          payload: dispatch.payload,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await postTask(dispatch.payload);
  console.log(
    JSON.stringify(
      {
        ok: true,
        score: dispatch.score,
        inferredIntentType: intentType.type,
        taskId: result.task?.id,
        assignmentId: result.task?.assignmentId,
        inboxUrl: result.inboxUrl,
        question: result.task?.question,
        privacyGate: result.task?.privacyGate,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
