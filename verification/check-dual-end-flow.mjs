#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const port = Number(argValue("--port", "4190"));
const baseUrl = `http://127.0.0.1:${port}`;
const coordinatorPath = path.join(rootDir, "scripts", "humanmcp_dual_end_coordinator.mjs");
const stateFile = path.join(
  rootDir,
  ".omx",
  "state",
  `humanmcp-dual-end-flow-test-${process.pid}.json`,
);
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function auditTypes(payload) {
  return (payload.auditEvents || payload.task?.auditEvents || []).map((event) => event.type);
}

function assertAuditOrder(events, expected, label) {
  let cursor = -1;
  for (const type of expected) {
    const nextIndex = events.findIndex((event, index) => index > cursor && event.type === type);
    assert(nextIndex > cursor, `${label} should include ${type} after prior audit events`);
    cursor = nextIndex;
  }
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${pathname} returned non-JSON HTTP ${response.status}`);
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `${pathname} failed with HTTP ${response.status}`);
  }
  return payload;
}

async function waitForHealth() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    try {
      const health = await fetchJson("/health");
      if (health.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("coordinator did not become healthy");
}

function startCoordinator() {
  const child = spawn(process.execPath, [
    coordinatorPath,
    "--host",
    "127.0.0.1",
    "--port",
      String(port),
      "--state-file",
      stateFile,
  ], {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });
  return child;
}

async function main() {
  const child = startCoordinator();
  try {
    await waitForHealth();

    const matched = await fetchJson("/humanmcp/tasks", {
      method: "POST",
      body: JSON.stringify({
        question: "Match summary persistence check?",
        airjellyMatchSummary: {
          adapterMode: "AirJelly Test Adapter",
          match: {
            need: {
              reason: "Local AirJelly intent matched a publish-readiness question.",
              question: "Match summary persistence check?",
            },
            candidate: {
              displayName: "Lindsay",
              endpoint: "/lindsay/business_judgement",
            },
            signals: [
              {
                label: "Intent classifier",
                summary: "Reduced local context to an intent label and counts.",
                source: "verification",
              },
            ],
            score: 0.73,
          },
        },
      }),
    });
    assert(
      matched.task.airjellyMatchSummary?.match?.score === 0.73,
      "created task should persist AirJelly match summary score",
    );
    const matchedSnapshot = await fetchJson("/humanmcp/stage-state");
    assert(
      matchedSnapshot.airjelly.match.score === 0.73,
      "stage-state should expose persisted AirJelly match summary score",
    );
    assert(
      matchedSnapshot.smartAssignment.confidence === 0.73,
      "smart assignment confidence should use persisted AirJelly match score",
    );

    const created = await fetchJson("/humanmcp/tasks/seed", { method: "POST" });
    const taskId = created.task.id;
    assert(created.task.status === "queued", "seeded task should start queued");
    assert(Boolean(created.task.assignmentId), "seeded task should have assignmentId");
    assertAuditOrder(created.task.auditEvents || [], ["task_created"], "created task audit");

    const inbox = await fetchJson("/humanmcp/inbox/lindsay");
    assert(inbox.tasks.some((task) => task.id === taskId), "inbox should include seeded task");

    const seen = await fetchJson(`/humanmcp/tasks/${taskId}/seen`, { method: "POST" });
    assert(seen.task.status === "seen", "seen action should move queued task to seen");
    assert(Boolean(seen.task.seenAt), "seen action should set seenAt");
    assertAuditOrder(seen.task.auditEvents || [], ["task_created", "seen"], "seen task audit");

    const answerBody = JSON.stringify({
      answer:
        "Yes, the value is understandable in 10 seconds; I would maybe click Join Waitlist after clearer proof.",
    });
    const answered = await fetchJson(`/humanmcp/tasks/${taskId}/answer`, {
      method: "POST",
      body: answerBody,
    });
    const proofId = answered.task.proofId;
    assert(answered.snapshot.stage === "proof_pending", "answer should move stage to proof_pending");
    assert(Boolean(proofId), "answer should create proofId");
    assert(answered.task.completedAt === null, "answer should not set completedAt before complete");
    assertAuditOrder(
      answered.task.auditEvents || [],
      ["task_created", "seen", "answered"],
      "answered task audit",
    );

    const duplicateAnswer = await fetchJson(`/humanmcp/tasks/${taskId}/answer`, {
      method: "POST",
      body: answerBody,
    });
    assert(
      duplicateAnswer.task.proofId === proofId,
      "duplicate answer must not create a new proofId",
    );

    const verified = await fetchJson(`/humanmcp/tasks/${taskId}/verify`, { method: "POST" });
    assert(verified.task.proofId === proofId, "verify must preserve proofId");
    assert(verified.snapshot.stage === "stamp_ready", "verify should move stage to stamp_ready");
    assert(verified.snapshot.verified === true, "verify should set verified true");
    assert(verified.snapshot.stampStatus === "requested", "verify should request stamp");
    assertAuditOrder(
      verified.task.auditEvents || [],
      ["task_created", "seen", "answered", "verified"],
      "verified task audit",
    );

    const duplicateVerify = await fetchJson(`/humanmcp/tasks/${taskId}/verify`, { method: "POST" });
    assert(duplicateVerify.task.proofId === proofId, "duplicate verify must preserve proofId");

    const complete = await fetchJson(`/humanmcp/tasks/${taskId}/complete`, { method: "POST" });
    assert(complete.task.proofId === proofId, "complete must preserve proofId");
    assert(Boolean(complete.task.completedAt), "complete should set completedAt");
    assert(complete.snapshot.stage === "complete", "complete should move stage to complete");
    assert(
      complete.snapshot.stampStatus === "virtual_done",
      "complete should set virtual_done stampStatus",
    );
    const expectedAuditTypes = ["task_created", "seen", "answered", "verified", "completed"];
    assertAuditOrder(complete.task.auditEvents || [], expectedAuditTypes, "completed task audit");

    const finalSnapshot = await fetchJson("/humanmcp/stage-state");
    assert(finalSnapshot.proofId === proofId, "final snapshot should preserve proofId");
    assert(finalSnapshot.assignmentId === created.task.assignmentId, "final snapshot should preserve assignmentId");
    assert(finalSnapshot.airjelly.source === "AirJelly Suggested, User Approved", "AirJelly source label should stay stable");
    assert(
      finalSnapshot.smartAssignment.taskPacket.hiddenContext.includes("raw AirJelly memory"),
      "task packet should preserve hidden raw AirJelly memory boundary",
    );
    assertAuditOrder(finalSnapshot.auditEvents || [], expectedAuditTypes, "stage snapshot audit");
    assertAuditOrder(
      finalSnapshot.smartAssignment.auditEvents || [],
      expectedAuditTypes,
      "smart assignment audit",
    );

    const taskList = await fetchJson("/humanmcp/tasks?format=json");
    const listedTask = taskList.tasks.find((task) => task.id === taskId);
    assert(Boolean(listedTask), "task list JSON should include completed task");
    assertAuditOrder(listedTask?.auditEvents || [], expectedAuditTypes, "task list audit");
    assertAuditOrder(taskList.auditEvents || [], expectedAuditTypes, "coordinator audit list");
    assert(
      auditTypes({ task: listedTask }).includes("completed"),
      "public task audit should expose completed event",
    );

    const persistedState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const persistedTask = persistedState.tasks.find((task) => task.id === taskId);
    assertAuditOrder(persistedTask?.auditEvents || [], expectedAuditTypes, "persisted task audit");
    assertAuditOrder(persistedState.auditEvents || [], expectedAuditTypes, "persisted coordinator audit");

    child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 150));

    const restarted = startCoordinator();
    try {
      await waitForHealth();
      const restoredSnapshot = await fetchJson("/humanmcp/stage-state");
      assert(restoredSnapshot.stage === "complete", "restored snapshot should keep complete stage");
      assert(restoredSnapshot.proofId === proofId, "restored snapshot should preserve proofId");
      assert(
        restoredSnapshot.assignmentId === created.task.assignmentId,
        "restored snapshot should preserve assignmentId",
      );
      assertAuditOrder(
        restoredSnapshot.auditEvents || [],
        expectedAuditTypes,
        "restored snapshot audit",
      );
      const restoredTasks = await fetchJson("/humanmcp/tasks?format=json");
      const restoredTask = restoredTasks.tasks.find((task) => task.id === taskId);
      assertAuditOrder(restoredTask?.auditEvents || [], expectedAuditTypes, "restored task audit");
    } finally {
      restarted.kill("SIGTERM");
    }
  } finally {
    child.kill("SIGTERM");
    if (fs.existsSync(stateFile)) {
      fs.unlinkSync(stateFile);
    }
  }

  console.log("Dual-end flow verification");
  if (errors.length) {
    for (const error of errors) {
      console.log(`- FAIL ${error}`);
    }
    process.exit(1);
  }
  console.log("- PASS seed -> inbox -> seen -> answer -> verify -> complete");
  console.log("- PASS proofId and assignmentId remain stable across repeated actions");
  console.log("- PASS audit events are exposed in stage-state and task JSON in lifecycle order");
  console.log("- PASS persisted state restores complete task after restart");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
