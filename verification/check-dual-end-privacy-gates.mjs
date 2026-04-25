#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");
const port = 4191;
const baseUrl = `http://127.0.0.1:${port}`;
const coordinatorPath = path.join(rootDir, "scripts", "humanmcp_dual_end_coordinator.mjs");
const stateFile = path.join(rootDir, ".omx", "state", `humanmcp-privacy-gates-${process.pid}.json`);
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
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
  const payload = await response.json();
  return { response, payload };
}

async function expectPost(pathname, body, expectedStatus) {
  const result = await fetchJson(pathname, {
    method: "POST",
    body: JSON.stringify(body),
  });
  assert(
    result.response.status === expectedStatus,
    `${pathname} expected HTTP ${expectedStatus}, got ${result.response.status}`,
  );
  return result.payload;
}

function startCoordinator() {
  return spawn(process.execPath, [
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
}

async function waitForHealth() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    try {
      const { payload } = await fetchJson("/health");
      if (payload.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("coordinator did not become healthy");
}

async function main() {
  const child = startCoordinator();
  try {
    await waitForHealth();

    const p2Blocked = await expectPost("/humanmcp/tasks", {
      question: "P2 should require approval",
      privacyLevel: "P2",
    }, 422);
    assert(p2Blocked.privacyGate.level === "P2", "blocked P2 should report P2 gate");
    assert(p2Blocked.privacyGate.allowed === false, "blocked P2 should be disallowed");

    const p2Allowed = await expectPost("/humanmcp/tasks", {
      question: "P2 approved task",
      privacyLevel: "P2",
      approval: {
        confirmed: true,
        actor: "founder",
      },
    }, 201);
    assert(p2Allowed.task.privacyGate.allowed === true, "approved P2 should be allowed");
    assert(p2Allowed.task.taskPacket.privacyLevel === "P2", "approved P2 packet should stay P2");

    const p3Blocked = await expectPost("/humanmcp/tasks", {
      question: "P3 should require operator review",
      privacyLevel: "P3",
      approval: {
        confirmed: true,
        actor: "founder",
      },
    }, 422);
    assert(p3Blocked.privacyGate.level === "P3", "blocked P3 should report P3 gate");
    assert(
      p3Blocked.privacyGate.blockedReasons.some((reason) => reason.includes("operator review")),
      "blocked P3 should cite operator review",
    );

    const p3Allowed = await expectPost("/humanmcp/tasks", {
      question: "P3 approved sensitive review task",
      privacyLevel: "P3",
      approval: {
        confirmed: true,
        actor: "founder",
      },
      operatorReview: {
        required: true,
        status: "approved",
        reviewer: "operator",
      },
    }, 201);
    assert(p3Allowed.task.privacyGate.allowed === true, "approved P3 should be allowed");
    assert(p3Allowed.task.privacyGate.operatorReviewRequired === true, "P3 should require operator review");

    const p4Blocked = await expectPost("/humanmcp/tasks", {
      question: "P4 must never dispatch",
      privacyLevel: "P4",
      approval: {
        confirmed: true,
      },
      operatorReview: {
        required: true,
        status: "approved",
      },
    }, 422);
    assert(p4Blocked.privacyGate.level === "P4", "blocked P4 should report P4 gate");
    assert(p4Blocked.privacyGate.allowed === false, "P4 should be blocked");

    const { payload: tasksPayload } = await fetchJson("/humanmcp/tasks?format=json");
    assert(tasksPayload.tasks.length === 2, "only P2/P3 allowed tasks should be created");
    assert(
      tasksPayload.auditEvents.filter((event) => event.type === "dispatch_blocked").length === 3,
      "blocked P2/P3/P4 attempts should be audited",
    );

    const { payload: stageState } = await fetchJson("/humanmcp/stage-state");
    assert(stageState.privacyGate.level === "P3", "latest allowed task should expose P3 privacy gate");
    assert(stageState.blockedDispatch.privacyGate.level === "P4", "stage-state should retain latest blocked P4 dispatch");
  } finally {
    child.kill("SIGTERM");
    if (fs.existsSync(stateFile)) {
      fs.unlinkSync(stateFile);
    }
  }

  console.log("Dual-end privacy gate verification");
  if (errors.length) {
    for (const error of errors) {
      console.log(`- FAIL ${error}`);
    }
    process.exit(1);
  }
  console.log("- PASS P2 requires approval and approved P2 dispatches");
  console.log("- PASS P3 requires approved operator review and approved P3 dispatches");
  console.log("- PASS P4 is blocked before assignment creation");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
