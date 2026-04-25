#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");
const serverPath = path.join(rootDir, "scripts", "airjelly_humanmcp_mcp_server.mjs");
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function encode(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function createClient() {
  const child = spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      HUMANMCP_COORDINATOR_URL: "http://127.0.0.1:4199",
      HUMANMCP_HUMAN_ID: "alice",
      HUMANMCP_HUMAN_NAME: "Alice",
      HUMANMCP_ENDPOINT: "/alice/product_judgement",
      HUMANMCP_TARGET_HUMAN_ID: "bob",
      HUMANMCP_TARGET_HUMAN_NAME: "Bob",
      HUMANMCP_TARGET_ENDPOINT: "/bob/business_judgement",
    },
  });
  let buffer = Buffer.alloc(0);
  const pending = new Map();

  child.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = buffer.slice(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) throw new Error("missing Content-Length in MCP response");
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const payload = JSON.parse(buffer.slice(start, start + length).toString("utf8"));
      buffer = buffer.slice(start + length);
      const waiter = pending.get(payload.id);
      if (waiter) {
        pending.delete(payload.id);
        waiter(payload);
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  let id = 1;
  function request(method, params = {}) {
    const requestId = id++;
    const message = { jsonrpc: "2.0", id: requestId, method, params };
    return new Promise((resolve) => {
      pending.set(requestId, resolve);
      child.stdin.write(encode(message));
    });
  }

  return { child, request };
}

const client = createClient();
try {
  const initialized = await client.request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "verification", version: "0.0.0" },
  });
  assert(initialized.result?.serverInfo?.name === "airjelly-humanmcp", "initialize should return server info");

  const listed = await client.request("tools/list");
  const toolNames = new Set((listed.result?.tools || []).map((tool) => tool.name));
  const dispatchTool = (listed.result?.tools || []).find((tool) => tool.name === "humanmcp_dispatch_task");
  const classifyTool = (listed.result?.tools || []).find((tool) => tool.name === "humanmcp_classify_intent");
  for (const name of [
    "airjelly_status",
    "airjelly_profile_tag",
    "humanmcp_classify_intent",
    "humanmcp_dispatch_task",
    "humanmcp_get_inbox",
    "humanmcp_answer_task",
    "humanmcp_get_stage_state",
    "airjelly_create_local_task",
  ]) {
    assert(toolNames.has(name), `tools/list missing ${name}`);
  }
  assert(
    Boolean(dispatchTool?.inputSchema?.properties?.targetHumanId),
    "dispatch tool should expose targetHumanId for bidirectional routing",
  );
  assert(
    Boolean(classifyTool?.inputSchema?.properties?.targetHumanId),
    "classify tool should expose targetHumanId for bidirectional routing",
  );

  const classified = await client.request("tools/call", {
    name: "humanmcp_classify_intent",
    arguments: {
      mock: true,
      intent: "I need feedback on whether the HumanMCP AirJelly demo is understandable and would get waitlist clicks.",
    },
  });
  const classifiedPayload = JSON.parse(classified.result.content[0].text);
  assert(classifiedPayload.ok === true, "classify intent should return ok=true");
  assert(classifiedPayload.inferredIntentType === "product_clarity", "intent should classify as product_clarity");
  assert(classifiedPayload.payload?.humanId === "bob", "classified payload should default to peer targetHumanId");
  assert(classifiedPayload.payload?.endpoint === "/bob/business_judgement", "classified payload should default to peer targetEndpoint");
  assert(classifiedPayload.payload?.taskPacket?.privacyLevel === "P1", "classified payload should stay P1");
  assert(
    classifiedPayload.payload?.taskPacket?.hiddenContext?.includes("raw AirJelly memories"),
    "classified payload should preserve raw AirJelly memory boundary",
  );

  const profile = await client.request("tools/call", {
    name: "airjelly_profile_tag",
    arguments: { mock: true, publish: false, humanId: "lindsay" },
  });
  const profilePayload = JSON.parse(profile.result.content[0].text);
  assert(profilePayload.ok === true, "profile tag should return ok=true");
  assert(profilePayload.profile?.primaryTag === "product-feedback", "mock profile should choose product-feedback");
  assert(profilePayload.profile?.evidenceCounts?.memories === 1, "profile should expose evidence counts only");

  const dryRunDispatch = await client.request("tools/call", {
    name: "humanmcp_dispatch_task",
    arguments: {
      dryRun: true,
      mock: true,
      targetHumanId: "alice",
      targetHumanName: "Alice",
      targetEndpoint: "/alice/product_judgement",
      intent: "Should I show the AirJelly profile tag before or after the consent popup?",
    },
  });
  const dryRunPayload = JSON.parse(dryRunDispatch.result.content[0].text);
  assert(dryRunPayload.ok === true && dryRunPayload.dryRun === true, "dispatch dry-run should not call coordinator");
  assert(Boolean(dryRunPayload.payload?.question), "dispatch dry-run should include generated question");
  assert(dryRunPayload.payload?.humanId === "alice", "dispatch dry-run should honor per-call targetHumanId override");
  assert(dryRunPayload.payload?.endpoint === "/alice/product_judgement", "dispatch dry-run should honor per-call targetEndpoint override");

  console.log("AirJelly HumanMCP MCP verification");
  if (errors.length) {
    for (const error of errors) {
      console.log(`- FAIL ${error}`);
    }
    process.exit(1);
  }
  console.log("- PASS MCP initialize/tools/list/tools/call");
  console.log("- PASS intent and profile tools preserve P1 privacy boundary");
  console.log("- PASS bidirectional target identity defaults and overrides");
} finally {
  client.child.kill();
}
