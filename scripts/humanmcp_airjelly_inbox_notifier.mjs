#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const coordinator = argValue("--coordinator", process.env.HUMANMCP_COORDINATOR_URL);
const humanId = argValue("--human-id", process.env.HUMANMCP_HUMAN_ID || "lindsay");
const token = argValue("--token", process.env.HUMANMCP_BRIDGE_TOKEN || "");
const intervalMs = Number(argValue("--interval-ms", process.env.HUMANMCP_POLL_MS || "3000"));
const openOnNotify = args.includes("--open") || process.env.HUMANMCP_OPEN_ON_NOTIFY === "1";
const askBeforeOpen =
  args.includes("--ask-before-open") ||
  args.includes("--consent-dialog") ||
  process.env.HUMANMCP_ASK_BEFORE_OPEN === "1";
const createAirJellyTask =
  args.includes("--create-airjelly-task") ||
  process.env.HUMANMCP_CREATE_AIRJELLY_TASK === "1";
const publishProfileTag =
  args.includes("--profile-tag") ||
  args.includes("--publish-profile-tag") ||
  process.env.HUMANMCP_PUBLISH_PROFILE_TAG === "1";
const mockProfile = args.includes("--mock-profile");
const once = args.includes("--once");
const runtimePath = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "AirJelly",
  "runtime.json",
);
const seenTaskIds = new Set();

if (!coordinator) {
  console.error("Missing --coordinator http://<host>:4180");
  process.exit(2);
}

function headers(extra = {}) {
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}`, "X-HumanMCP-Token": token } : {}),
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: headers(options.headers || {}),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`non-JSON response from ${url}: HTTP ${response.status}`);
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `HTTP ${response.status} from ${url}`);
  }
  return payload;
}

function readAirJellyRuntime() {
  try {
    const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
    if (!runtime.port || !runtime.token) return null;
    return runtime;
  } catch {
    return null;
  }
}

async function callAirJelly(runtime, method, rpcArgs = []) {
  const response = await fetch(`http://127.0.0.1:${runtime.port}/rpc`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ method, args: rpcArgs }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message || payload?.error || `AirJelly RPC ${method} failed`);
  }
  return payload?.data ?? payload;
}

function textOf(value) {
  if (!value || typeof value !== "object") return String(value || "");
  return Object.values(value)
    .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
    .filter((entry) => ["string", "number", "boolean"].includes(typeof entry))
    .join(" ");
}

function scoreTag(corpus, keywords) {
  const haystack = corpus.toLowerCase();
  return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0);
}

function buildProfileTag({ capabilities = {}, tasks = [], memories = [], persons = [], appUsage = [] }) {
  const corpus = [tasks, memories, persons, appUsage].flat().map(textOf).join(" ");
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
    .map((tag) => ({ label: tag.label, score: scoreTag(corpus, tag.keywords) }))
    .sort((a, b) => b.score - a.score);
  const topScore = scored[0]?.score || 0;
  const tags = scored
    .filter((tag) => tag.score > 0)
    .slice(0, 3)
    .map((tag) => ({
      label: tag.label,
      score: Math.min(0.99, Number((0.45 + tag.score / Math.max(topScore + 3, 6)).toFixed(2))),
    }));
  if (!tags.length) {
    tags.push({ label: "general-judgment", score: 0.42 });
  }
  return {
    humanId,
    primaryTag: tags[0].label,
    tags,
    confidence: tags[0].score,
    evidenceCounts: {
      memories: Array.isArray(memories) ? memories.length : 0,
      openTasks: Array.isArray(tasks) ? tasks.length : 0,
      persons: Array.isArray(persons) ? persons.length : 0,
      appBuckets: Array.isArray(appUsage) ? appUsage.length : 0,
      airjellyMethods: Array.isArray(capabilities?.methods) ? capabilities.methods.length : 0,
      matchedKeywordScore: topScore,
    },
    privacy:
      "Profile tag only; raw AirJelly memories, screenshots, people graph, task text, and app usage stay local.",
    source: "helper-airjelly-local-profile-tagger",
  };
}

async function collectProfileSignals() {
  if (mockProfile) {
    return {
      capabilities: { methods: ["listOpenTasks", "listMemories", "listPersons", "getDailyAppUsage"] },
      tasks: [{ title: "Review product demo and waitlist copy" }],
      memories: [{ summary: "Often gives product feedback, UX clarity notes, and technical review." }],
      persons: [{ name: humanId }],
      appUsage: [{ app: "AirJelly" }],
    };
  }

  const runtime = readAirJellyRuntime();
  if (!runtime) {
    throw new Error("AirJelly runtime not found; cannot publish profile tag");
  }

  const capabilitiesResponse = await fetch(`http://127.0.0.1:${runtime.port}/capabilities`, {
    headers: { Authorization: `Bearer ${runtime.token}` },
  });
  const capabilitiesPayload = await capabilitiesResponse.json();
  const capabilities = capabilitiesPayload?.data || capabilitiesPayload || {};
  const methods = new Set(capabilities?.methods || []);
  const [tasks, memories, persons, appUsage] = await Promise.all([
    methods.has("listOpenTasks") ? callAirJelly(runtime, "listOpenTasks", [20]) : [],
    methods.has("listMemories") ? callAirJelly(runtime, "listMemories", [{ limit: 50, types: ["profile", "preference", "entity", "case", "procedure"] }]) : [],
    methods.has("listPersons") ? callAirJelly(runtime, "listPersons") : [],
    methods.has("getDailyAppUsage") ? callAirJelly(runtime, "getDailyAppUsage", [new Date().toISOString().slice(0, 10)]) : [],
  ]);
  return { capabilities, tasks, memories, persons, appUsage };
}

async function publishLocalProfileTag() {
  if (!publishProfileTag) {
    return null;
  }

  const signals = await collectProfileSignals();
  const profile = buildProfileTag(signals);
  const payload = await fetchJson(
    `${coordinator.replace(/\/$/, "")}/humanmcp/helpers/${encodeURIComponent(humanId)}/profile-tag`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    },
  );
  return payload.profile;
}

async function callAirJellyNotification(task) {
  const runtime = readAirJellyRuntime();
  if (!runtime) {
    return false;
  }

  const baseUrl = `http://127.0.0.1:${runtime.port}`;
  const authHeaders = {
    Authorization: `Bearer ${runtime.token}`,
    "Content-Type": "application/json",
  };
  const candidates = [
    "createNotification",
    "showNotification",
    "notify",
    "pushNotification",
    "openInboxNotification",
  ];
  const body = {
    title: "HumanMCP task",
    message: task.question,
    body: task.question,
    url: `${coordinator.replace(/\/$/, "")}/humanmcp/tasks/${encodeURIComponent(task.id)}`,
    source: "HumanMCP",
    task,
  };

  try {
    const capabilitiesResponse = await fetch(`${baseUrl}/capabilities`, {
      headers: { Authorization: `Bearer ${runtime.token}` },
    });
    const capabilities = await capabilitiesResponse.json();
    const methods = new Set(capabilities?.data?.methods || capabilities?.methods || []);
    for (const method of candidates) {
      if (!methods.has(method)) continue;
      const response = await fetch(`${baseUrl}/rpc`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ method, args: [body] }),
      });
      if (response.ok) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

async function createTaskInAirJelly(task) {
  if (!createAirJellyTask) {
    return false;
  }

  const runtime = readAirJellyRuntime();
  if (!runtime) {
    return false;
  }

  const taskUrl = `${coordinator.replace(/\/$/, "")}/humanmcp/tasks/${encodeURIComponent(task.id)}?view=ask`;
  const response = await fetch(`http://127.0.0.1:${runtime.port}/rpc`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method: "createTask",
      args: [
        {
          title: `HumanMCP: ${task.question}`,
          description: [
            "AirJelly-approved HumanMCP task.",
            `Question: ${task.question}`,
            `Open: ${taskUrl}`,
            "Privacy: only the task packet and match summary were sent; raw AirJelly memory stays local.",
          ].join("\n"),
          l1_scene: "connect",
          next_steps: ["Open the HumanMCP task page", "Answer the scoped question"],
        },
      ],
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message || payload?.error || "AirJelly createTask failed");
  }
  return true;
}

async function macNotification(task) {
  const title = "HumanMCP task";
  const subtitle = task.humanName ? `For ${task.humanName}` : "AirJelly suggested";
  const message = task.question;
  const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(
    title,
  )} subtitle ${JSON.stringify(subtitle)}`;

  try {
    await execFileAsync("osascript", ["-e", script]);
    return true;
  } catch {
    return false;
  }
}

async function askForConsent(task) {
  if (!askBeforeOpen) {
    return true;
  }

  const prompt = [
    "HumanMCP wants your help with one bounded AirJelly-approved task.",
    "",
    task.question,
    "",
    "Only the task packet and match summary are shared. Raw AirJelly memory stays local.",
  ].join("\n");
  const script = [
    `set dialogResult to display dialog ${JSON.stringify(prompt)}`,
    `with title "HumanMCP task request"`,
    `buttons {"Not now", "Help"}`,
    `default button "Help"`,
    `cancel button "Not now"`,
    `with icon note`,
    `return button returned of dialogResult`,
  ].join(" ");

  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    return stdout.trim() === "Help";
  } catch {
    return false;
  }
}

async function openTask(task) {
  const url = `${coordinator.replace(/\/$/, "")}/humanmcp/tasks/${encodeURIComponent(task.id)}?view=ask`;
  try {
    await execFileAsync("open", [url]);
  } catch {
    console.log(`Open task manually: ${url}`);
  }
}

async function markSeen(task) {
  await fetchJson(`${coordinator.replace(/\/$/, "")}/humanmcp/tasks/${encodeURIComponent(task.id)}/seen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

async function pollOnce() {
  const inboxUrl = `${coordinator.replace(/\/$/, "")}/humanmcp/inbox/${encodeURIComponent(humanId)}`;
  const inbox = await fetchJson(inboxUrl);
  const tasks = Array.isArray(inbox.tasks) ? inbox.tasks : [];
  for (const task of tasks) {
    if (seenTaskIds.has(task.id)) continue;
    seenTaskIds.add(task.id);

    const accepted = await askForConsent(task);
    console.log(`[humanmcp-notifier] human ${accepted ? "accepted" : "declined"} ${task.id}`);
    if (!accepted) {
      continue;
    }

    const notifiedByAirJelly = await callAirJellyNotification(task);
    const createdAirJellyTask = await createTaskInAirJelly(task).catch((error) => {
      console.error(`[humanmcp-notifier] AirJelly task create failed: ${error.message || error}`);
      return false;
    });
    const notified = notifiedByAirJelly || (await macNotification(task));
    console.log(
      `[humanmcp-notifier] ${notifiedByAirJelly ? "AirJelly" : notified ? "macOS" : "console"} notification: ${task.id} ${task.question}`,
    );
    if (createdAirJellyTask) {
      console.log(`[humanmcp-notifier] AirJelly task created for ${task.id}`);
    }
    console.log(
      `[humanmcp-notifier] open ${coordinator.replace(/\/$/, "")}/humanmcp/tasks/${encodeURIComponent(task.id)}?view=ask`,
    );
    await markSeen(task);
    if (openOnNotify) {
      await openTask(task);
    }
  }
  return tasks.length;
}

async function main() {
  console.log(`[humanmcp-notifier] coordinator=${coordinator}`);
  console.log(`[humanmcp-notifier] humanId=${humanId}`);
  console.log(`[humanmcp-notifier] airjellyRuntime=${fs.existsSync(runtimePath) ? runtimePath : "not found"}`);
  console.log(
    `[humanmcp-notifier] airjellyCreateTask=${createAirJellyTask ? "enabled" : "disabled"}`,
  );
  console.log(`[humanmcp-notifier] askBeforeOpen=${askBeforeOpen ? "enabled" : "disabled"}`);
  console.log(`[humanmcp-notifier] profileTag=${publishProfileTag ? "enabled" : "disabled"}`);

  if (publishProfileTag) {
    const profile = await publishLocalProfileTag().catch((error) => {
      console.error(`[humanmcp-notifier] profile tag publish failed: ${error.message || error}`);
      return null;
    });
    if (profile) {
      console.log(
        `[humanmcp-notifier] profile tag published: ${profile.primaryTag} confidence=${profile.confidence}`,
      );
    }
  }

  do {
    try {
      await pollOnce();
    } catch (error) {
      console.error(`[humanmcp-notifier] ${error.message || error}`);
    }

    if (once) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
