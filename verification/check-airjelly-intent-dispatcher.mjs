#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: process.cwd(),
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

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

const errors = [];
const result = await run("node", [
  "scripts/humanmcp_airjelly_intent_dispatcher.mjs",
  "--mock",
  "--dry-run",
  "--min-score",
  "0.1",
  "--intent",
  "I need to know whether this HumanMCP + AirJelly demo pitch is understandable and whether users would click Join Waitlist.",
]);

assert(result.code === 0, `dispatcher dry-run exited ${result.code}: ${result.stderr}`, errors);

let payload = null;
try {
  payload = JSON.parse(result.stdout);
} catch (error) {
  errors.push(`dispatcher did not return JSON: ${error.message}`);
}

assert(payload?.ok === true, "dispatcher dry-run must return ok=true", errors);
assert(payload?.dryRun === true, "dispatcher must stay dry-run in this verification", errors);
assert(payload?.inferredIntentType === "product_clarity", "product pitch intent must classify as product_clarity", errors);
assert(payload?.payload?.humanId === "lindsay", "default humanId should be lindsay", errors);
assert(payload?.payload?.taskPacket?.privacyLevel === "P1", "dispatcher task packet must stay P1", errors);
assert(
  String(payload?.payload?.taskPacket?.privacyBudget || "").includes("intent summary only"),
  "privacy budget must say intent summary only",
  errors,
);
assert(
  Array.isArray(payload?.payload?.taskPacket?.hiddenContext) &&
    payload.payload.taskPacket.hiddenContext.includes("raw AirJelly memories"),
  "hiddenContext must keep raw AirJelly memories out of export",
  errors,
);
assert(
  String(payload?.payload?.question || "").includes("Join Waitlist"),
  "generated question should preserve Join Waitlist decision",
  errors,
);
assert(
  String(payload?.payload?.airjellyMatchSummary?.match?.exportedContext || "").includes("raw memories"),
  "match summary must state raw memories stay local",
  errors,
);

console.log("AirJelly intent dispatcher verification");
if (errors.length) {
  for (const error of errors) {
    console.log(`- FAIL ${error}`);
  }
  process.exit(1);
}

console.log("- PASS intent classification -> P1 HumanMCP payload");
console.log("- PASS raw AirJelly context stays local");
