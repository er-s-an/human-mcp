#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const DEFAULT_QUESTION =
  "Can you understand this product in 10 seconds, and would you click Join Waitlist?";
const DEFAULT_CANDIDATE_NAME = "Lindsay";
const DEFAULT_CANDIDATE_ENDPOINT = "/lindsay/business_judgement";
const ADAPTER_NAME = "airjelly_local_match_adapter";
const RUNTIME_PATH = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "AirJelly",
  "runtime.json",
);

const args = process.argv.slice(2);

function argValue(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

const question = argValue("--question", DEFAULT_QUESTION);
const candidateName = argValue("--candidate-name", DEFAULT_CANDIDATE_NAME);
const candidateEndpoint = argValue("--candidate-endpoint", DEFAULT_CANDIDATE_ENDPOINT);
const strictLive = args.includes("--strict-live");

function readRuntime() {
  const runtime = JSON.parse(fs.readFileSync(RUNTIME_PATH, "utf8"));
  if (!runtime.port || !runtime.token) {
    throw new Error("AirJelly runtime.json is missing port or token.");
  }
  return runtime;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`AirJelly returned non-JSON HTTP ${response.status}`);
  }
}

function createAirJellyClient(runtime) {
  const baseUrl = `http://127.0.0.1:${runtime.port}`;
  const headers = {
    Authorization: `Bearer ${runtime.token}`,
  };

  return {
    async get(pathname) {
      const response = await fetch(`${baseUrl}${pathname}`, { headers });
      const payload = await readJson(response);
      if (!response.ok || payload.ok === false) {
        throw new Error(`AirJelly ${pathname} failed with HTTP ${response.status}`);
      }
      return payload.data ?? payload;
    },
    async rpc(method, rpcArgs = []) {
      const response = await fetch(`${baseUrl}/rpc`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ method, args: rpcArgs }),
      });
      const payload = await readJson(response);
      if (!response.ok || payload.ok === false) {
        const message =
          payload.error?.message || payload.error || `HTTP ${response.status}`;
        throw new Error(`AirJelly RPC ${method} failed: ${message}`);
      }
      return payload.data;
    },
  };
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/u)
    .filter((token) => token.length >= 3)
    .slice(0, 12);
}

function textOf(value) {
  if (!value || typeof value !== "object") {
    return String(value || "");
  }
  return Object.values(value)
    .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
    .filter((entry) => typeof entry === "string" || typeof entry === "number")
    .join(" ");
}

function countKeywordMatches(items, keywords) {
  if (!Array.isArray(items) || keywords.length === 0) {
    return 0;
  }

  return items.reduce((count, item) => {
    const haystack = textOf(item).toLowerCase();
    return count + (keywords.some((keyword) => haystack.includes(keyword)) ? 1 : 0);
  }, 0);
}

function findCandidateEntity(persons, name) {
  const target = String(name || "").toLowerCase();
  if (!target || !Array.isArray(persons)) {
    return null;
  }

  return (
    persons.find((person) => {
      const names = [
        person.entity_name,
        person.name,
        ...(Array.isArray(person.entity_aliases) ? person.entity_aliases : []),
      ]
        .filter(Boolean)
        .map((entry) => String(entry).toLowerCase());
      return names.some((entry) => entry.includes(target) || target.includes(entry));
    }) || null
  );
}

function clampScore(value) {
  return Math.max(0, Math.min(0.99, Number(value.toFixed(2))));
}

function buildMatchSummary({
  adapterMode,
  candidateEntity,
  candidateName,
  candidateEndpoint,
  question,
  health,
  capabilities,
  tasks,
  memories,
  appUsage,
  recordingStatus,
  error,
}) {
  const keywords = tokenize(`${question} business judgement product copy founder`);
  const relevantTaskCount = countKeywordMatches(tasks, keywords);
  const relevantMemoryCount = countKeywordMatches(memories, keywords);
  const openTaskCount = Array.isArray(tasks) ? tasks.length : 0;
  const appCount = Array.isArray(appUsage) ? appUsage.length : 0;
  const matchedEntity = Boolean(candidateEntity);
  const live = adapterMode === "AirJelly Connected";
  const score = clampScore(
    (live ? 0.28 : 0.12) +
      (matchedEntity ? 0.22 : 0.08) +
      (relevantTaskCount > 0 ? 0.16 : 0.04) +
      (relevantMemoryCount > 0 ? 0.18 : 0.06) +
      (openTaskCount <= 20 ? 0.1 : 0.06) +
      (appCount > 0 ? 0.05 : 0),
  );

  return {
    source: "AirJelly Suggested, User Approved",
    adapterMode,
    capability: candidateEndpoint,
    approvalStatus: live ? "approved" : "pending",
    privacy:
      "No raw AirJelly memories, screenshots, app usage, or private context leave the local broker.",
    match: {
      status: live ? "matched" : "waiting",
      need: {
        label: "AI needs human judgment",
        reason:
          "The AI has a direction-level uncertainty that benefits from one human answer.",
        question,
      },
      candidate: {
        displayName: candidateName,
        endpoint: candidateEndpoint,
      },
      signals: [
        {
          label: "Relevant experience",
          summary: matchedEntity
            ? `Local people graph contains a candidate entity and ${relevantMemoryCount} relevant memory summaries.`
            : `No named person entity was exported; ${relevantMemoryCount} relevant memory summaries still support the capability fit.`,
          source: "local AirJelly people/memory index",
        },
        {
          label: "Current work context",
          summary: `${relevantTaskCount} open task summaries overlap with the requested question.`,
          source: "local AirJelly task index",
        },
        {
          label: "Availability proxy",
          summary: `${openTaskCount} open tasks and ${appCount} active app buckets were reduced to a coarse availability signal.`,
          source: "local AirJelly task/app state",
        },
        {
          label: "Low interruption",
          summary: "HumanMCP will send one scoped 30-second question.",
          source: "HumanMCP task packet",
        },
      ],
      score,
      invite: {
        text: "Willing to help AI with one 30-second question?",
        status: live ? "ready" : "waiting",
      },
      exportedContext:
        "Only the match summary leaves AirJelly; raw memories and screenshots stay local.",
      liveEvidence: {
        adapter: ADAPTER_NAME,
        healthOk: Boolean(health?.ok),
        appVersion: health?.version || capabilities?.appVersion || null,
        methodCount: Array.isArray(capabilities?.methods)
          ? capabilities.methods.length
          : null,
        recordingStatusType: typeof recordingStatus,
        rawPayloadsExported: false,
      },
      error: error || null,
    },
  };
}

async function collectLiveSignals() {
  const runtime = readRuntime();
  const client = createAirJellyClient(runtime);
  const [health, capabilities] = await Promise.all([
    client.get("/health"),
    client.get("/capabilities"),
  ]);
  const methods = new Set(capabilities?.methods || []);
  const [
    tasks,
    persons,
    memories,
    appUsage,
    recordingStatus,
  ] = await Promise.all([
    methods.has("listOpenTasks") ? client.rpc("listOpenTasks", [20]) : [],
    methods.has("listPersons") ? client.rpc("listPersons") : [],
    methods.has("listMemories")
      ? client.rpc("listMemories", [{ limit: 50 }])
      : [],
    methods.has("getDailyAppUsage")
      ? client.rpc("getDailyAppUsage", [new Date().toISOString().slice(0, 10)])
      : [],
    methods.has("getRecordingStatus") ? client.rpc("getRecordingStatus") : null,
  ]);

  return {
    health,
    capabilities,
    tasks,
    persons,
    memories,
    appUsage,
    recordingStatus,
  };
}

async function main() {
  try {
    const signals = await collectLiveSignals();
    const candidateEntity = findCandidateEntity(signals.persons, candidateName);
    const output = buildMatchSummary({
      adapterMode: "AirJelly Connected",
      candidateEntity,
      candidateName,
      candidateEndpoint,
      question,
      ...signals,
    });
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } catch (error) {
    if (strictLive) {
      throw error;
    }
    const output = buildMatchSummary({
      adapterMode: "Mock Mode",
      candidateEntity: null,
      candidateName,
      candidateEndpoint,
      question,
      health: null,
      capabilities: null,
      tasks: [],
      memories: [],
      appUsage: [],
      recordingStatus: null,
      error: String(error.message || error),
    });
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
