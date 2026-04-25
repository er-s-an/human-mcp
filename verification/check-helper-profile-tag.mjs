#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");
const port = 4192;
const baseUrl = `http://127.0.0.1:${port}`;
const stateFile = path.join(rootDir, ".omx", "state", `humanmcp-helper-profile-test-${process.pid}.json`);
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
  const text = await response.text();
  const payload = JSON.parse(text);
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

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

const coordinator = spawn(process.execPath, [
  "scripts/humanmcp_dual_end_coordinator.mjs",
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

try {
  await waitForHealth();
  const notifier = await run(process.execPath, [
    "scripts/humanmcp_airjelly_inbox_notifier.mjs",
    "--coordinator",
    baseUrl,
    "--human-id",
    "lindsay",
    "--profile-tag",
    "--mock-profile",
    "--once",
  ]);
  assert(notifier.code === 0, `notifier exited ${notifier.code}: ${notifier.stderr}`);
  assert(
    notifier.stdout.includes("profile tag published: product-feedback"),
    "notifier should publish product-feedback profile tag",
  );

  const profileResponse = await fetchJson("/humanmcp/helpers/lindsay/profile-tag");
  assert(profileResponse.profile?.primaryTag === "product-feedback", "coordinator should store primary profile tag");
  assert(profileResponse.profile?.privacy?.includes("raw AirJelly memories"), "profile privacy statement must mention raw memories");
  assert(profileResponse.profile?.evidenceCounts?.memories === 1, "profile should expose only evidence counts");
  assert(
    profileResponse.profile?.evidenceCounts?.rawMemory === undefined,
    "profile evidence counts must drop non-whitelisted keys",
  );

  const maliciousProfile = await fetchJson("/humanmcp/helpers/lindsay/profile-tag", {
    method: "POST",
    body: JSON.stringify({
      primaryTag: "security-review",
      evidenceCounts: {
        memories: "2",
        rawMemory: "private raw memory should not persist",
        openTasks: { raw: "task body" },
      },
    }),
  });
  assert(maliciousProfile.profile?.evidenceCounts?.memories === 2, "numeric evidence count should be normalized");
  assert(maliciousProfile.profile?.evidenceCounts?.rawMemory === undefined, "raw evidence payload should not persist");
  assert(maliciousProfile.profile?.evidenceCounts?.openTasks === 0, "object evidence payload should normalize to zero");

  const task = await fetchJson("/humanmcp/tasks/seed", { method: "POST" });
  assert(
    task.task?.helperProfileTag?.primaryTag === "security-review",
    "new public task should include helperProfileTag",
  );
  const stage = await fetchJson("/humanmcp/stage-state");
  assert(stage.helperProfileTag?.primaryTag === "security-review", "stage-state should include helperProfileTag");

  console.log("Helper profile tag verification");
  if (errors.length) {
    for (const error of errors) {
      console.log(`- FAIL ${error}`);
    }
    process.exit(1);
  }
  console.log("- PASS helper AirJelly profile signals reduce to coarse tag");
  console.log("- PASS coordinator stores tag without raw profile payloads");
} finally {
  coordinator.kill();
  if (fs.existsSync(stateFile)) {
    fs.rmSync(stateFile, { force: true });
  }
}
