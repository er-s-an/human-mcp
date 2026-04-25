#!/usr/bin/env node
import os from "node:os";
import process from "node:process";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const port = Number(argValue("--port", process.env.PORT || "4180"));
const humanId = argValue("--human-id", process.env.HUMANMCP_HUMAN_ID || "lindsay");
const host = argValue("--host", `http://127.0.0.1:${port}`);
const lanHost = argValue("--lan-host", null);

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${url} returned non-JSON HTTP ${response.status}`);
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `${url} failed with HTTP ${response.status}`);
  }
  return payload;
}

async function main() {
  const inferredLanHost =
    lanHost ||
    localAddresses()
      .map((address) => `http://${address}:${port}`)
      [0] ||
    host;
  const baseUrl = host.replace(/\/$/, "");
  const helperUrl = inferredLanHost.replace(/\/$/, "");

  const [health, stageState, inbox] = await Promise.all([
    fetchJson(`${baseUrl}/health`),
    fetchJson(`${baseUrl}/humanmcp/stage-state`),
    fetchJson(`${baseUrl}/humanmcp/inbox/${encodeURIComponent(humanId)}`),
  ]);

  console.log("HumanMCP + AirJelly hackathon status");
  console.log(`- coordinator: ${health.ok ? "OK" : "FAIL"}`);
  console.log(`- local feed: ${baseUrl}/humanmcp/stage-state`);
  console.log(`- helper coordinator: ${helperUrl}`);
  console.log(`- surface A: http://127.0.0.1:4174/?feed=${encodeURIComponent(`${baseUrl}/humanmcp/stage-state`)}`);
  console.log(`- stage: ${stageState.stage}`);
  console.log(`- assignmentId: ${stageState.assignmentId || "none"}`);
  console.log(`- proofId: ${stageState.proofId || "none"}`);
  console.log(`- stampStatus: ${stageState.stampStatus || "none"}`);
  console.log(`- inbox(${humanId}) open tasks: ${Array.isArray(inbox.tasks) ? inbox.tasks.length : 0}`);
  console.log("");
  console.log("Send this to the helper Codex:");
  console.log("```bash");
  console.log("node humanmcp_airjelly_inbox_notifier.mjs \\");
  console.log(`  --coordinator ${helperUrl} \\`);
  console.log(`  --human-id ${humanId} \\`);
  console.log("  --open \\");
  console.log("  --create-airjelly-task");
  console.log("```");
  console.log("");
  console.log("After helper is running, seed a task:");
  console.log("```bash");
  console.log(`curl -X POST ${baseUrl}/humanmcp/tasks/seed`);
  console.log("```");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
