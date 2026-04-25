#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");
const files = [
  "scripts/humanmcp_dual_end_coordinator.mjs",
  "scripts/humanmcp_airjelly_inbox_notifier.mjs",
  "docs/runbooks/airjelly-dual-end-test.md",
];
const requiredMarkers = [
  "HumanMCP dual-end coordinator",
  "/humanmcp/inbox/",
  "/humanmcp/stage-state",
  "HUMANMCP_BRIDGE_TOKEN",
  "--allow-unauthenticated-lan",
  "normalizeEvidenceCounts",
  "normalizeAirJellyMatchSummary",
  "AirJelly notification",
  "askForConsent(task)",
  "Task Packet Preview",
  "另一台电脑",
];

const errors = [];
const combined = files
  .map((file) => {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) {
      errors.push(`missing ${file}`);
      return "";
    }
    return fs.readFileSync(fullPath, "utf8");
  })
  .join("\n");

for (const marker of requiredMarkers) {
  if (!combined.includes(marker)) {
    errors.push(`missing marker: ${marker}`);
  }
}

console.log("Dual-end bridge verification");
for (const file of files) {
  console.log(`- checked ${file}`);
}

if (errors.length) {
  for (const error of errors) {
    console.log(`- FAIL ${error}`);
  }
  process.exit(1);
}

console.log("- PASS dual-end coordinator/notifier/runbook markers");
