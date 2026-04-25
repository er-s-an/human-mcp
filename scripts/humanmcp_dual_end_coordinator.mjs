#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const host = argValue("--host", process.env.HOST || "127.0.0.1");
const port = Number(argValue("--port", process.env.PORT || "4180"));
const humanId = argValue("--human-id", process.env.HUMANMCP_HUMAN_ID || "lindsay");
const humanName = argValue("--human-name", process.env.HUMANMCP_HUMAN_NAME || "Lindsay");
const endpoint = argValue(
  "--endpoint",
  process.env.HUMANMCP_ENDPOINT || "/lindsay/business_judgement",
);
const stageSource = argValue(
  "--source",
  process.env.HUMANMCP_STAGE_SOURCE || "windows-openclaw",
);
const question = argValue(
  "--question",
  process.env.HUMANMCP_QUESTION ||
    "Can you understand this product in 10 seconds, and would you click Join Waitlist?",
);
const token = argValue("--token", process.env.HUMANMCP_BRIDGE_TOKEN || "");
const allowUnauthenticatedLan =
  args.includes("--allow-unauthenticated-lan") ||
  process.env.HUMANMCP_ALLOW_UNAUTHENTICATED_LAN === "1";
const stateFile = argValue(
  "--state-file",
  process.env.HUMANMCP_BRIDGE_STATE_FILE ||
    path.join(
      rootSafeCwd(),
      ".omx",
      "state",
      `humanmcp-dual-end-${port}.json`,
    ),
);

const localHostnames = new Set(["127.0.0.1", "localhost", "::1", "::ffff:127.0.0.1"]);
const taskId = "openclaw_live_demo";
const subtaskId = "airjelly-dual-end";
const now = () => new Date().toISOString();
const terminalStatuses = new Set(["complete"]);
const answeredStatuses = new Set(["answered", "verified", "complete"]);
const privacyBudgets = {
  P0: "P0 · internal only",
  P1: "P1 · redacted artifact slice",
  P2: "P2 · limited workflow context with explicit approval",
  P3: "P3 · sensitive review with operator approval",
  P4: "P4 · blocked private material",
};

let taskCounter = 1;
let proofCounter = 1;
const tasks = new Map();
const helperProfiles = new Map();
let auditEvents = [];
let activeTaskId = null;
let lastBlockedDispatch = null;

function rootSafeCwd() {
  return process.cwd();
}

function saveState() {
  if (!stateFile) {
    return;
  }

  const state = {
    taskCounter,
    proofCounter,
    activeTaskId,
    auditEvents,
    lastBlockedDispatch,
    helperProfiles: [...helperProfiles.values()],
    tasks: [...tasks.values()],
    savedAt: now(),
  };
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

function loadState() {
  if (!stateFile || !fs.existsSync(stateFile)) {
    return;
  }

  const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  taskCounter = Number(state.taskCounter || taskCounter);
  proofCounter = Number(state.proofCounter || proofCounter);
  activeTaskId = state.activeTaskId || null;
  auditEvents = Array.isArray(state.auditEvents) ? state.auditEvents : [];
  lastBlockedDispatch = state.lastBlockedDispatch || null;
  helperProfiles.clear();
  for (const profile of state.helperProfiles || []) {
    if (profile?.humanId) {
      helperProfiles.set(profile.humanId, profile);
    }
  }
  tasks.clear();
  for (const task of state.tasks || []) {
    if (task?.id) {
      normalizeTaskAudit(task);
      tasks.set(task.id, task);
    }
  }
  if (activeTaskId && !tasks.has(activeTaskId)) {
    activeTaskId = null;
  }
}

function normalizeTaskAudit(task) {
  if (!Array.isArray(task.auditEvents)) {
    task.auditEvents = [];
  }
  task.taskPacket ||= normalizeTaskPacket(task, {});
  task.privacyGate ||= privacyGateFor(task.taskPacket);
  if (!task.auditEvents.some((event) => event?.type === "task_created")) {
    const timestamp = task.createdAt || now();
    const event = auditEvent(task, "task_created", timestamp);
    task.auditEvents.unshift(event);
    auditEvents.unshift(event);
  }
  if (task.status !== "complete" && task.completedAt && !task.auditEvents.some((event) => event?.type === "completed")) {
    task.completedAt = null;
  }
}

function auditEvent(task, type, timestamp, details = {}) {
  return {
    sequence: auditEvents.length + 1,
    taskSequence: (task.auditEvents || []).length + 1,
    type,
    taskId: task.id,
    assignmentId: task.assignmentId,
    proofId: task.proofId,
    status: task.status,
    timestamp,
    source: "humanmcp-dual-end-coordinator",
    ...details,
  };
}

function appendAuditEvent(task, type, timestamp = now(), details = {}) {
  task.auditEvents ||= [];
  const event = auditEvent(task, type, timestamp, details);
  task.auditEvents.push(event);
  auditEvents.push(event);
  return event;
}

function normalizePrivacyLevel(value) {
  const level = String(value || "P1").trim().toUpperCase();
  return privacyBudgets[level] ? level : "P1";
}

function objectValue(source, names, fallback = undefined) {
  for (const name of names) {
    if (source && Object.prototype.hasOwnProperty.call(source, name)) {
      return source[name];
    }
  }
  return fallback;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "yes", "approved", "confirmed"].includes(value.toLowerCase());
  return Boolean(value);
}

function normalizeApproval(input = {}) {
  return {
    required: normalizeBoolean(objectValue(input, ["required", "approvalRequired"], false)),
    confirmed: normalizeBoolean(objectValue(input, ["confirmed", "approved", "approvalConfirmed"], false)),
    actor: objectValue(input, ["actor", "approvedBy", "confirmedBy"], null),
    confirmedAt: objectValue(input, ["confirmedAt", "approvedAt"], null),
    note: objectValue(input, ["note", "reason"], null),
  };
}

function normalizeOperatorReview(input = {}) {
  const status = String(objectValue(input, ["status", "reviewStatus"], "missing")).toLowerCase();
  return {
    required: normalizeBoolean(objectValue(input, ["required", "operatorReviewRequired"], false)),
    status,
    reviewer: objectValue(input, ["reviewer", "reviewedBy"], null),
    reviewedAt: objectValue(input, ["reviewedAt"], null),
    note: objectValue(input, ["note", "reason"], null),
  };
}

function normalizeTaskPacket(task, overrides = {}) {
  const incoming =
    overrides.taskPacket ||
    overrides.task_packet ||
    overrides.metadata?.taskPacket ||
    overrides.metadata?.task_packet ||
    {};
  const privacyLevel = normalizePrivacyLevel(
    objectValue(incoming, ["privacyLevel", "privacy_level"], overrides.privacyLevel || overrides.privacy_level),
  );
  const visibleContext = objectValue(
    incoming,
    ["visibleContext", "visible_context"],
    undefined,
  ) || {
    productSummary: "An AI assistant for indie developers to debug and ship faster.",
    targetUser: "solo founder / indie developer",
    currentArtifact: "hero copy and call-to-action copy only",
  };
  const hiddenContext = objectValue(
    incoming,
    ["hiddenContext", "hidden_context", "redactedContext", "redacted_context"],
    [
      "founder identity",
      "raw AirJelly memory",
      "full screen",
      "private messages",
      "revenue data",
      "credentials",
      "unrelated tabs",
    ],
  );

  return {
    taskType: objectValue(incoming, ["taskType", "task_type"], "feedback / judgment"),
    privacyLevel,
    privacyBudget: objectValue(
      incoming,
      ["privacyBudget", "privacy_budget"],
      privacyBudgets[privacyLevel],
    ),
    role: objectValue(incoming, ["role"], "target-user reviewer"),
    goal: objectValue(
      incoming,
      ["goal"],
      "Help a one-person company founder improve landing-page clarity and waitlist conversion.",
    ),
    visibleContext,
    hiddenContext: Array.isArray(hiddenContext) ? hiddenContext : [String(hiddenContext)],
    singleQuestion: objectValue(
      incoming,
      ["singleQuestion", "single_question", "question", "task"],
      task.question,
    ),
    outputSchema: objectValue(incoming, ["outputSchema", "output_schema"], {
      understood_in_10s: "boolean",
      click_intent: "yes | maybe | no",
      main_confusion: "string",
      suggested_change: "string",
    }),
    guardrails: objectValue(
      incoming,
      ["guardrails"],
      "Suggestion only; do not infer private identity, pricing, legal, finance, medical, or employment decisions.",
    ),
    approval: normalizeApproval(overrides.approval || incoming.approval || overrides.metadata?.approval),
    operatorReview: normalizeOperatorReview(
      overrides.operatorReview ||
        overrides.operator_review ||
        incoming.operatorReview ||
        incoming.operator_review ||
        overrides.metadata?.operatorReview ||
        overrides.metadata?.operator_review,
    ),
  };
}

function privacyGateFor(taskPacket) {
  const level = normalizePrivacyLevel(taskPacket.privacyLevel);
  const approval = normalizeApproval(taskPacket.approval);
  const operatorReview = normalizeOperatorReview(taskPacket.operatorReview);
  const blockedReasons = [];

  if (level === "P0") {
    blockedReasons.push("P0 is internal only and cannot dispatch to a human helper.");
  }
  if (level === "P2" && !approval.confirmed) {
    blockedReasons.push("P2 requires explicit user approval before dispatch.");
  }
  if (level === "P3") {
    if (!approval.confirmed) {
      blockedReasons.push("P3 requires explicit user approval before dispatch.");
    }
    if (!operatorReview.required || !["approved", "complete", "completed"].includes(operatorReview.status)) {
      blockedReasons.push("P3 requires approved operator review before dispatch.");
    }
  }
  if (level === "P4") {
    blockedReasons.push("P4 content is blocked before dispatch.");
  }

  return {
    level,
    allowed: blockedReasons.length === 0,
    approvalRequired: ["P2", "P3"].includes(level),
    approvalStatus: approval.confirmed ? "confirmed" : "missing",
    operatorReviewRequired: level === "P3",
    operatorReviewStatus: operatorReview.status,
    blockedReasons,
  };
}

function rejectDispatch(overrides, taskPacket, privacyGate) {
  const timestamp = now();
  lastBlockedDispatch = {
    type: "dispatch_blocked",
    timestamp,
    humanId: overrides.humanId || humanId,
    endpoint: overrides.endpoint || endpoint,
    question: overrides.question || question,
    privacyGate,
    taskPacket,
    source: "humanmcp-dual-end-coordinator",
  };
  auditEvents.push({
    sequence: auditEvents.length + 1,
    type: "dispatch_blocked",
    taskId: null,
    assignmentId: null,
    proofId: null,
    status: "blocked",
    timestamp,
    source: "humanmcp-dual-end-coordinator",
    privacyGate,
  });
  saveState();
  const error = new Error(privacyGate.blockedReasons.join(" "));
  error.statusCode = 422;
  error.payload = {
    ok: false,
    error: error.message,
    privacyGate,
    taskPacket,
  };
  throw error;
}

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

function isLocalRequest(request) {
  const address = request.socket.remoteAddress || "";
  return localHostnames.has(address) || address.startsWith("::ffff:127.");
}

function requireToken(request, response) {
  if (isLocalRequest(request)) {
    return true;
  }

  const auth = request.headers.authorization || "";
  if (token && (auth === `Bearer ${token}` || request.headers["x-humanmcp-token"] === token)) {
    return true;
  }

  if (!token && allowUnauthenticatedLan) {
    return true;
  }

  writeJson(response, 401, {
    ok: false,
    error: token
      ? "missing or invalid bridge token"
      : "LAN write requires HUMANMCP_BRIDGE_TOKEN or --allow-unauthenticated-lan",
  });
  return false;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error(`invalid JSON body: ${error.message}`));
      }
    });
    request.on("error", reject);
  });
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-HumanMCP-Token",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

const evidenceCountKeys = [
  "memories",
  "openTasks",
  "persons",
  "appBuckets",
  "airjellyMethods",
  "matchedKeywordScore",
];

function boundedNumber(value, fallback = 0, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(max, Number(number.toFixed(2))));
}

function normalizeEvidenceCounts(input = {}) {
  const counts = {};
  for (const key of evidenceCountKeys) {
    counts[key] = boundedNumber(input?.[key], 0);
  }
  return counts;
}

function normalizeMatchSignal(signal = {}) {
  return {
    label: String(signal.label || "AirJelly signal").slice(0, 80),
    summary: String(signal.summary || "").slice(0, 220),
    source: String(signal.source || "AirJelly local broker").slice(0, 120),
  };
}

function normalizeAirJellyMatchSummary(input = {}, task = {}) {
  const match = input.match || {};
  const candidate = match.candidate || input.candidate || {};
  const need = match.need || input.need || {};
  const signals = Array.isArray(match.signals || input.signals)
    ? (match.signals || input.signals).map(normalizeMatchSignal).slice(0, 4)
    : [];
  const score = boundedNumber(match.score ?? input.score, task.id ? 0.92 : 0, 1);

  return {
    source: String(input.source || "AirJelly Suggested, User Approved").slice(0, 120),
    adapterMode: String(input.adapterMode || input.adapter_mode || "AirJelly Connected").slice(0, 120),
    capability: String(input.capability || task.endpoint || endpoint).slice(0, 160),
    approvalStatus: String(input.approvalStatus || input.approval_status || (task.id ? "approved" : "pending")).slice(0, 80),
    privacy: String(
      input.privacy ||
        "No raw AirJelly memories, screenshots, app usage, or private context leave the local broker.",
    ).slice(0, 260),
    match: {
      status: String(match.status || (task.id ? "matched" : "waiting")).slice(0, 80),
      need: {
        label: String(need.label || "AI needs human judgment").slice(0, 120),
        reason: String(
          need.reason ||
            "The AI has a direction-level uncertainty that benefits from one human answer.",
        ).slice(0, 260),
        question: String(need.question || task.question || question).slice(0, 500),
      },
      candidate: {
        displayName: String(candidate.displayName || candidate.display_name || task.humanName || humanName).slice(0, 120),
        endpoint: String(candidate.endpoint || task.endpoint || endpoint).slice(0, 180),
      },
      signals: signals.length
        ? signals
        : [
            {
              label: "Coordinator route",
              summary: "HumanMCP created one permissioned inbox item for the selected helper.",
              source: "HumanMCP coordinator",
            },
            {
              label: "Privacy boundary",
              summary: "Only the task packet and match summary are sent to the helper machine.",
              source: "AirJelly local broker",
            },
          ],
      score,
      invite: {
        text: String(match.invite?.text || input.invite?.text || "Willing to help AI with one 30-second question?").slice(0, 180),
        status: String(match.invite?.status || input.invite?.status || (task.id ? "ready" : "waiting")).slice(0, 80),
      },
      exportedContext: String(
        match.exportedContext ||
          match.exported_context ||
          input.exportedContext ||
          input.exported_context ||
          "Only the match summary leaves AirJelly; raw memories and screenshots stay local.",
      ).slice(0, 260),
    },
  };
}

function normalizeHelperProfileTag(input = {}) {
  const human = String(input.humanId || input.human_id || humanId).trim() || humanId;
  const tags = Array.isArray(input.tags)
    ? input.tags
        .map((tag) => ({
          label: String(tag.label || tag.name || tag).slice(0, 80),
          score: Number.isFinite(Number(tag.score)) ? Number(Number(tag.score).toFixed(2)) : null,
        }))
        .filter((tag) => tag.label)
        .slice(0, 5)
    : [];
  const primaryTag = String(input.primaryTag || input.primary_tag || tags[0]?.label || "general-judgment").slice(0, 80);
  return {
    humanId: human,
    humanName: String(input.humanName || input.human_name || humanName).slice(0, 80),
    primaryTag,
    tags: tags.length ? tags : [{ label: primaryTag, score: null }],
    confidence: Math.max(0, Math.min(0.99, Number(Number(input.confidence || 0).toFixed(2)))),
    evidenceCounts: normalizeEvidenceCounts(input.evidenceCounts || input.evidence_counts || {}),
    privacy: String(
      input.privacy ||
        "Profile tag only; raw AirJelly memories, screenshots, people graph, and app usage stay local.",
    ).slice(0, 240),
    source: String(input.source || "helper-airjelly-local-profile-tagger").slice(0, 120),
    updatedAt: now(),
  };
}

function registerHelperProfileTag(input = {}) {
  const profile = normalizeHelperProfileTag(input);
  helperProfiles.set(profile.humanId, profile);
  auditEvents.push({
    sequence: auditEvents.length + 1,
    type: "helper_profile_tag_registered",
    taskId: null,
    assignmentId: null,
    proofId: null,
    status: "registered",
    timestamp: profile.updatedAt,
    source: "humanmcp-dual-end-coordinator",
    humanId: profile.humanId,
    primaryTag: profile.primaryTag,
    confidence: profile.confidence,
  });
  saveState();
  return profile;
}

function createTask(overrides = {}) {
  const id = `hmcp-task-${Date.now().toString(36)}-${String(taskCounter++).padStart(3, "0")}`;
  const timestamp = now();
  const task = {
    id,
    assignmentId: `assign-${id}`,
    proofId: null,
    taskId,
    subtaskId,
    humanId: overrides.humanId || humanId,
    humanName: overrides.humanName || humanName,
    endpoint: overrides.endpoint || endpoint,
    question: overrides.question || question,
    source: "AirJelly Suggested, User Approved",
    status: "queued",
    answer: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    seenAt: null,
    answeredAt: null,
    verifiedAt: null,
    completedAt: null,
    auditEvents: [],
  };
  task.taskPacket = normalizeTaskPacket(task, overrides);
  task.privacyGate = privacyGateFor(task.taskPacket);
  task.airjellyMatchSummary = normalizeAirJellyMatchSummary(
    overrides.airjellyMatchSummary ||
      overrides.airjelly_match_summary ||
      overrides.airjelly ||
      {},
    task,
  );
  if (!task.privacyGate.allowed) {
    rejectDispatch(overrides, task.taskPacket, task.privacyGate);
  }
  appendAuditEvent(task, "task_created", timestamp, { action: "create" });
  tasks.set(id, task);
  activeTaskId = id;
  saveState();
  return task;
}

function latestTask() {
  return activeTaskId ? tasks.get(activeTaskId) : null;
}

function publicTask(task) {
  return {
    id: task.id,
    assignmentId: task.assignmentId,
    taskId: task.taskId,
    subtaskId: task.subtaskId,
    humanId: task.humanId,
    humanName: task.humanName,
    endpoint: task.endpoint,
    question: task.question,
    source: task.source,
    status: task.status,
    answer: task.answer,
    proofId: task.proofId,
    taskPacket: task.taskPacket,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    seenAt: task.seenAt,
    answeredAt: task.answeredAt,
    verifiedAt: task.verifiedAt,
    completedAt: task.completedAt,
    auditEvents: task.auditEvents || [],
    privacyGate: task.privacyGate || privacyGateFor(task.taskPacket),
    helperProfileTag: helperProfiles.get(task.humanId) || null,
    airjellyMatchSummary: task.airjellyMatchSummary || normalizeAirJellyMatchSummary({}, task),
  };
}

function stageFor(task) {
  if (!task) return "idle";
  if (task.status === "queued") return "assigned";
  if (task.status === "seen") return "calling";
  if (task.status === "answered") return "proof_pending";
  if (task.status === "verified") return "stamp_ready";
  if (task.status === "complete") return "complete";
  return "assigned";
}

function expressionFor(stage) {
  const states = {
    idle: "idle",
    assigned: "calling",
    calling: "waiting",
    proof_pending: "proof_verifying",
    stamp_ready: "verified",
    complete: "stamped",
  };
  return states[stage] || "idle";
}

function snapshot() {
  const task = latestTask();
  const stage = stageFor(task);
  const helperProfileTag = task ? helperProfiles.get(task.humanId) || null : helperProfiles.get(humanId) || null;
  const airjelly = task
    ? normalizeAirJellyMatchSummary(task.airjellyMatchSummary || {}, task)
    : normalizeAirJellyMatchSummary({}, {});
  if (helperProfileTag) {
    airjelly.match.candidate.profileTag = helperProfileTag.primaryTag;
  }
  return {
    version: "2026-04-25",
    source: stageSource,
    bridgeSource: "humanmcp-dual-end-coordinator",
    mode: "dual_end_test",
    stage,
    expressionState: expressionFor(stage),
    currentGoal:
      "Route an AirJelly-approved HumanMCP question to another computer and collect a response.",
    humanId: task?.humanId || humanId,
    humanName: task?.humanName || null,
    endpoint: task?.endpoint || endpoint,
    helperProfileTag,
    assignmentId: task?.assignmentId || null,
    taskId: task?.taskId || taskId,
    subtaskId: task?.subtaskId || subtaskId,
    proofId: task?.proofId || null,
    auditEvents: task?.auditEvents || [],
    privacyGate: task?.privacyGate || lastBlockedDispatch?.privacyGate || null,
    blockedDispatch: lastBlockedDispatch,
    verified: task ? task.status === "verified" || task.status === "complete" : false,
    level: task ? 1 : 0,
    rewardDelta: task && ["verified", "complete"].includes(task.status) ? 10 : 0,
    stampStatus:
      task?.status === "complete"
        ? "virtual_done"
        : task?.status === "verified"
          ? "requested"
          : null,
    message: task
      ? `HumanMCP task ${task.status}: ${task.humanName} · ${task.question}`
      : "Waiting for an AirJelly-approved HumanMCP task.",
    updatedAt: now(),
    airjelly,
    smartAssignment: task
      ? {
          status: task.status,
          selectedHuman: task.humanName,
          selectedEndpoint: task.endpoint,
          rationale:
            airjelly.match.need.reason || "Matched approved AirJelly capability card to a permissioned HumanMCP inbox.",
          confidence: airjelly.match.score,
          policy:
            "Rank approved capability cards by skill match, availability, proofability, and demo safety.",
          fallback:
            "If the helper AirJelly notifier is unavailable, the browser inbox remains the fallback.",
          candidates: [
            {
              name: task.humanName,
              endpoint: task.endpoint,
              score: airjelly.match.score,
              status: task.status,
              profileTag: helperProfileTag,
            },
          ],
          taskPacket: task.taskPacket,
          auditEvents: task.auditEvents || [],
          privacyGate: task.privacyGate || privacyGateFor(task.taskPacket),
          responsibility: {
            consent: "User approved this human call before dispatch.",
            auditTrail:
              "Record caller, helper, shared task packet, structured response, and user decision.",
            finalControl:
              "User confirms before any external publish/send/apply action.",
          },
        }
      : null,
    operatorActions: {
      canRetry: Boolean(task),
      canManualAdvance: Boolean(task),
      canVirtualStamp: task?.status === "verified",
      canOperatorFallback: Boolean(task),
      canTriggerRobot: false,
    },
  };
}

function htmlPage(task = latestTask(), options = {}) {
  const view = options.view || "full";
  const taskJson = task ? JSON.stringify(publicTask(task)) : "null";
  const viewJson = JSON.stringify(view);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HumanMCP Inbox</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f6f7f9; color: #14171f; }
    main { max-width: 760px; margin: 0 auto; padding: 32px 20px; }
    body.compact { background: #eef2f7; }
    body.compact main { max-width: 460px; padding: 18px 12px; }
    body.compact section { box-shadow: 0 18px 50px rgba(20, 23, 31, 0.16); }
    body.compact h1 { font-size: 18px; }
    body.compact .full-only { display: none; }
    section { background: white; border: 1px solid #d8dde8; border-radius: 8px; padding: 20px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    h2 { margin: 24px 0 8px; font-size: 15px; }
    p, li { line-height: 1.45; }
    textarea { width: 100%; min-height: 112px; box-sizing: border-box; font: inherit; padding: 10px; border: 1px solid #bac3d3; border-radius: 6px; }
    button { margin-top: 12px; border: 0; border-radius: 6px; background: #145db8; color: white; font: inherit; padding: 10px 14px; cursor: pointer; }
    button.secondary { background: #495469; }
    button.ghost { background: #e7ecf4; color: #1f2937; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .answer-panel { display: none; }
    .answer-panel.ready { display: block; }
    code { background: #eef1f5; padding: 2px 4px; border-radius: 4px; }
    .muted { color: #566277; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .panel { border: 1px solid #e0e5ee; border-radius: 6px; padding: 12px; background: #fbfcfe; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>HumanMCP Inbox</h1>
      <p class="muted">Permissioned 30-second task from AirJelly via HumanMCP.</p>
      <div id="content"></div>
    </section>
  </main>
  <script>
    const task = ${taskJson};
    const view = ${viewJson};
    const content = document.querySelector("#content");
    if (view === "ask") document.body.classList.add("compact");
    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[char]));
    }
    async function post(path, body) {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    }
    function render() {
      if (!task) {
        content.innerHTML = "<p>No active task.</p>";
        return;
      }
      const packet = task.taskPacket;
      const gate = task.privacyGate || { allowed: true, level: packet.privacyLevel, blockedReasons: [] };
      const visibleItems = Object.values(packet.visibleContext || {});
      const disabled = gate.allowed ? "" : "disabled";
      const answerReadyClass = view === "ask" ? "" : "ready";
      content.innerHTML = \`
        <p><strong>Status:</strong> <code>\${escapeHtml(task.status)}</code></p>
        <p><strong>Question:</strong> \${escapeHtml(task.question)}</p>
        <div class="actions">
          <button id="accept" \${disabled}>Accept</button>
          <button class="ghost" id="decline">Not now</button>
        </div>
        <div class="full-only">
        <h2>Task Packet Preview</h2>
        <p><strong>Privacy Gate:</strong> <code>\${escapeHtml(gate.level || packet.privacyLevel)} · \${escapeHtml(gate.allowed ? "allowed" : "blocked")}</code></p>
        \${gate.blockedReasons && gate.blockedReasons.length ? \`<p><strong>Blocked:</strong> \${gate.blockedReasons.map(escapeHtml).join("; ")}</p>\` : ""}
        <div class="grid">
          <div class="panel">
            <strong>Human will see</strong>
            <ul>\${visibleItems.map((item) => \`<li>\${escapeHtml(item)}</li>\`).join("")}</ul>
          </div>
          <div class="panel">
            <strong>Human will NOT see</strong>
            <ul>\${packet.hiddenContext.map((item) => \`<li>\${escapeHtml(item)}</li>\`).join("")}</ul>
          </div>
        </div>
      <p><strong>Privacy Budget:</strong> <code>\${escapeHtml(packet.privacyBudget)}</code></p>
      <p><strong>Approval:</strong> <code>\${escapeHtml(packet.approval && packet.approval.confirmed ? "confirmed" : "not confirmed")}</code></p>
      <p><strong>Operator Review:</strong> <code>\${escapeHtml(packet.operatorReview ? packet.operatorReview.status : "missing")}</code></p>
      </div>
      <div class="answer-panel \${answerReadyClass}" id="answerPanel">
        <textarea id="answer" placeholder="Write the answer here..."></textarea>
        <div class="actions">
          <button id="submit" \${disabled}>Submit Answer</button>
          <button class="secondary" id="seen">Mark Seen</button>
        </div>
      </div>
      \`;
      document.querySelector("#accept").addEventListener("click", async () => {
        await post("/humanmcp/tasks/" + task.id + "/seen");
        document.querySelector("#answerPanel").classList.add("ready");
      });
      document.querySelector("#decline").addEventListener("click", () => {
        content.innerHTML = "<p class='muted'>No problem. This HumanMCP request was not accepted on this device.</p>";
      });
      document.querySelector("#seen").addEventListener("click", async () => {
        await post("/humanmcp/tasks/" + task.id + "/seen");
        location.reload();
      });
      document.querySelector("#submit").addEventListener("click", async () => {
        const answer = document.querySelector("#answer").value.trim();
        if (!answer) {
          alert("Please write a short answer first.");
          return;
        }
        await post("/humanmcp/tasks/" + task.id + "/answer", { answer });
        location.reload();
      });
    }
    render();
  </script>
</body>
</html>`;
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    writeJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === "/health") {
    writeJson(response, 200, {
      ok: true,
      service: "humanmcp-dual-end-coordinator",
      activeTaskId,
      persisted: Boolean(stateFile),
      stateFile,
      updatedAt: now(),
    });
    return;
  }

  if (url.pathname === "/humanmcp/stage-state") {
    writeJson(response, 200, snapshot());
    return;
  }

  if (url.pathname === "/humanmcp/tasks" && request.method === "POST") {
    if (!requireToken(request, response)) return;
    const body = await readBody(request);
    const task = createTask(body);
    writeJson(response, 201, {
      ok: true,
      task: publicTask(task),
      inboxUrl: `/humanmcp/inbox/${encodeURIComponent(task.humanId)}`,
    });
    return;
  }

  if (url.pathname === "/humanmcp/tasks/seed" && request.method === "POST") {
    if (!requireToken(request, response)) return;
    const task = createTask({});
    writeJson(response, 201, {
      ok: true,
      task: publicTask(task),
      inboxUrl: `/humanmcp/inbox/${encodeURIComponent(task.humanId)}`,
    });
    return;
  }

  if (url.pathname === "/humanmcp/tasks" && request.method === "GET") {
    if (!requireToken(request, response)) return;
    writeJson(response, 200, {
      ok: true,
      activeTaskId,
      tasks: [...tasks.values()].map(publicTask),
      helperProfiles: [...helperProfiles.values()],
      auditEvents,
      updatedAt: now(),
    });
    return;
  }

  const helperProfileMatch = url.pathname.match(/^\/humanmcp\/helpers\/([^/]+)\/profile-tag$/);
  if (helperProfileMatch && request.method === "POST") {
    if (!requireToken(request, response)) return;
    const requestedHumanId = decodeURIComponent(helperProfileMatch[1]);
    const body = await readBody(request);
    const profile = registerHelperProfileTag({
      ...body,
      humanId: body.humanId || body.human_id || requestedHumanId,
    });
    writeJson(response, 200, { ok: true, profile });
    return;
  }

  if (helperProfileMatch && request.method === "GET") {
    if (!requireToken(request, response)) return;
    const requestedHumanId = decodeURIComponent(helperProfileMatch[1]);
    writeJson(response, 200, {
      ok: true,
      humanId: requestedHumanId,
      profile: helperProfiles.get(requestedHumanId) || null,
      updatedAt: now(),
    });
    return;
  }

  const inboxMatch = url.pathname.match(/^\/humanmcp\/inbox\/([^/]+)$/);
  if (inboxMatch && request.method === "GET") {
    const requestedHumanId = decodeURIComponent(inboxMatch[1]);
    const inboxTasks = [...tasks.values()]
      .filter((task) => task.humanId === requestedHumanId)
      .filter((task) => !["complete"].includes(task.status))
      .map(publicTask);
    writeJson(response, 200, {
      ok: true,
      humanId: requestedHumanId,
      tasks: inboxTasks,
      updatedAt: now(),
    });
    return;
  }

  const taskPageMatch = url.pathname.match(/^\/humanmcp\/tasks\/([^/]+)$/);
  if (taskPageMatch && request.method === "GET") {
    const task = tasks.get(decodeURIComponent(taskPageMatch[1]));
    if (!task) {
      if (url.searchParams.get("format") === "json") {
        writeJson(response, 404, { ok: false, error: "task not found" });
      } else {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Task not found");
      }
      return;
    }

    if (url.searchParams.get("format") === "json") {
      writeJson(response, 200, {
        ok: true,
        task: publicTask(task),
      });
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(htmlPage(task, { view: url.searchParams.get("view") || "full" }));
    return;
  }

  const taskActionMatch = url.pathname.match(/^\/humanmcp\/tasks\/([^/]+)\/(seen|answer|verify|complete)$/);
  if (taskActionMatch && request.method === "POST") {
    if (!requireToken(request, response)) return;
    const task = tasks.get(decodeURIComponent(taskActionMatch[1]));
    const action = taskActionMatch[2];
    if (!task) {
      writeJson(response, 404, { ok: false, error: "task not found" });
      return;
    }

    const body = await readBody(request);
    const timestamp = now();
    if (action === "answer") {
      const answer = String(body.answer || "").trim();
      if (!answer) {
        writeJson(response, 422, { ok: false, error: "answer is required" });
        return;
      }

      task.answer = answer;
      task.seenAt ||= timestamp;
      task.answeredAt ||= timestamp;
      task.proofId ||= `proof-${String(proofCounter++).padStart(3, "0")}`;
      if (!["verified", "complete"].includes(task.status)) {
        task.status = "answered";
      }
      appendAuditEvent(task, "answered", timestamp, { action });
    }
    if (action === "seen") {
      task.seenAt ||= timestamp;
      if (task.status === "queued") {
        task.status = "seen";
      }
      appendAuditEvent(task, "seen", timestamp, { action });
    }
    if (action === "verify") {
      if (!answeredStatuses.has(task.status)) {
        writeJson(response, 409, {
          ok: false,
          error: "task must be answered before verify",
          task: publicTask(task),
        });
        return;
      }

      task.proofId ||= `proof-${String(proofCounter++).padStart(3, "0")}`;
      task.verifiedAt ||= timestamp;
      if (!terminalStatuses.has(task.status)) {
        task.status = "verified";
      }
      appendAuditEvent(task, "verified", timestamp, { action });
    }
    if (action === "complete") {
      if (!["verified", "complete"].includes(task.status)) {
        writeJson(response, 409, {
          ok: false,
          error: "task must be verified before complete",
          task: publicTask(task),
        });
        return;
      }

      task.completedAt ||= timestamp;
      task.status = "complete";
      appendAuditEvent(task, "completed", timestamp, { action });
    }
    task.updatedAt = timestamp;
    saveState();

    writeJson(response, 200, {
      ok: true,
      task: publicTask(task),
      snapshot: snapshot(),
    });
    return;
  }

  if (url.pathname === "/" || url.pathname === "/humanmcp") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(htmlPage());
    return;
  }

  writeJson(response, 404, {
    ok: false,
    error: "not found",
  });
}

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    writeJson(response, error.statusCode || 500, error.payload || {
      ok: false,
      error: error.message || String(error),
    });
  });
});

loadState();

server.listen(port, host, () => {
  const addresses = localAddresses();
  console.log("HumanMCP dual-end coordinator");
  console.log(`Local:  http://127.0.0.1:${port}`);
  for (const address of addresses) {
    console.log(`LAN:    http://${address}:${port}`);
  }
  console.log(`Stage:  http://127.0.0.1:${port}/humanmcp/stage-state`);
  console.log(`Inbox:  http://127.0.0.1:${port}/humanmcp/inbox/${humanId}`);
  console.log(`Seed:   curl -X POST http://127.0.0.1:${port}/humanmcp/tasks/seed`);
  console.log(`State:  ${stateFile || "disabled"}`);
  if (!token) {
    console.log(
      `Auth:   ${allowUnauthenticatedLan ? "LAN writes allowed by explicit demo flag" : "local writes only; set HUMANMCP_BRIDGE_TOKEN for LAN writes"}`,
    );
  } else {
    console.log("Auth:   bearer/x-humanmcp-token required for LAN writes");
  }
});
