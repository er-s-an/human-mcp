#!/usr/bin/env node
import os from "node:os";
import process from "node:process";

const args = process.argv.slice(2);
const argValue = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const coordinator = String(
  argValue("--coordinator", process.env.HUMANMCP_COORDINATOR_URL || "http://127.0.0.1:4180"),
).replace(/\/$/, "");
const humanId = argValue("--human-id", process.env.HUMANMCP_HUMAN_ID || "lindsay");
const humanName = argValue("--human-name", process.env.HUMANMCP_HUMAN_NAME || "Lindsay");
const endpoint = argValue("--endpoint", process.env.HUMANMCP_ENDPOINT || `/${humanId}/business_judgement`);
const token = argValue("--token", process.env.HUMANMCP_BRIDGE_TOKEN || "");
const sendCanary = args.includes("--send-canary");
const waitAnswer = args.includes("--wait-answer");
const waitMs = Number(argValue("--wait-ms", "60000"));
const pollMs = Number(argValue("--poll-ms", "2000"));

function headers(extra = {}) {
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}`, "X-HumanMCP-Token": token } : {}),
  };
}

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

async function fetchJson(pathname, options = {}) {
  const url = pathname.startsWith("http") ? pathname : `${coordinator}${pathname}`;
  const response = await fetch(url, {
    ...options,
    headers: headers(options.headers || {}),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `${url} failed with HTTP ${response.status}`);
  }
  return payload;
}

async function maybeCheckWriteAuth() {
  try {
    const payload = await fetchJson("/humanmcp/tasks", { method: "GET" });
    return { ok: true, activeTaskId: payload.activeTaskId || null };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

async function createCanaryTask() {
  const created = await fetchJson("/humanmcp/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      humanId,
      humanName,
      endpoint,
      question:
        "Canary stability check: please answer with one sentence confirming you received tomorrow's HumanMCP + AirJelly bridge test.",
      taskPacket: {
        taskType: "stability canary",
        privacyLevel: "P1",
        privacyBudget: "P1 · canary only",
        role: "bridge test helper",
        goal: "Confirm the dual-end notification path is live before the demo.",
        visibleContext: {
          test: "HumanMCP + AirJelly dual-end canary",
          expectedAction: "Accept the task and answer one sentence.",
        },
        hiddenContext: [
          "raw AirJelly memories",
          "screenshots",
          "private messages",
          "credentials",
          "unrelated local files",
        ],
        singleQuestion: "Did you receive this canary task?",
        outputSchema: {
          received: "boolean",
          note: "string",
        },
        guardrails: "Do not include private local context. This is only a bridge liveness check.",
      },
      airjellyMatchSummary: {
        source: "AirJelly Suggested, User Approved",
        adapterMode: "AirJelly Connected",
        match: {
          status: "matched",
          need: {
            label: "Bridge stability canary",
            reason: "Tomorrow's demo needs a known-good dual-end notification path.",
            question: "Can the helper receive and answer a canary task?",
          },
          candidate: { displayName: humanName, endpoint },
          signals: [
            {
              label: "Day-of-demo check",
              summary: "This canary verifies coordinator, inbox, notifier, and answer path.",
              source: "humanmcp_dual_end_doctor",
            },
          ],
          score: 0.99,
          invite: {
            text: "Can you confirm tomorrow's HumanMCP bridge test is live?",
            status: "ready",
          },
          exportedContext: "Only canary text is exported; raw AirJelly context stays local.",
        },
      },
    }),
  });
  return created.task;
}

async function waitForTask(taskId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= waitMs) {
    const payload = await fetchJson(`/humanmcp/tasks/${encodeURIComponent(taskId)}?format=json`);
    const task = payload.task;
    if (task?.status === "answered" || task?.status === "verified" || task?.status === "complete") {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return null;
}

async function main() {
  const errors = [];
  console.log("HumanMCP dual-end doctor");
  console.log(`- coordinator: ${coordinator}`);
  console.log(`- humanId: ${humanId}`);
  console.log(`- token: ${token ? "set" : "not set"}`);
  for (const address of lanAddresses()) {
    console.log(`- local LAN candidate: http://${address}:4180`);
  }

  let health = null;
  try {
    health = await fetchJson("/health");
    console.log(`- PASS health: activeTaskId=${health.activeTaskId || "none"}`);
  } catch (error) {
    errors.push(`health failed: ${error.message || error}`);
  }

  if (health) {
    const writeAuth = await maybeCheckWriteAuth();
    if (writeAuth.ok) {
      console.log(`- PASS write/list auth: activeTaskId=${writeAuth.activeTaskId || "none"}`);
    } else {
      errors.push(`write/list auth failed: ${writeAuth.error}`);
    }
  }

  try {
    const inbox = await fetchJson(`/humanmcp/inbox/${encodeURIComponent(humanId)}`);
    console.log(`- PASS inbox: ${inbox.tasks.length} open task(s) for ${humanId}`);
  } catch (error) {
    errors.push(`inbox failed: ${error.message || error}`);
  }

  let canary = null;
  if (sendCanary) {
    try {
      canary = await createCanaryTask();
      console.log(`- PASS canary created: ${canary.id}`);
      console.log(`- task URL: ${coordinator}/humanmcp/tasks/${encodeURIComponent(canary.id)}`);
    } catch (error) {
      errors.push(`canary create failed: ${error.message || error}`);
    }
  }

  if (canary && waitAnswer) {
    const answered = await waitForTask(canary.id);
    if (answered) {
      console.log(`- PASS canary answered: status=${answered.status} proofId=${answered.proofId || "none"}`);
      console.log(`- answer: ${answered.answer}`);
    } else {
      errors.push(`canary was not answered within ${waitMs}ms; check helper notifier`);
    }
  }

  if (errors.length) {
    console.log("Result: NOT READY");
    for (const error of errors) {
      console.log(`- FAIL ${error}`);
    }
    console.log("Helper notifier command:");
    console.log(
      `node scripts/humanmcp_airjelly_inbox_notifier.mjs --coordinator ${coordinator} --human-id ${humanId} --open --create-airjelly-task --ask-before-open --profile-tag`,
    );
    process.exit(1);
  }

  console.log("Result: READY");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
