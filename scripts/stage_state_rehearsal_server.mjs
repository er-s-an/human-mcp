#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");
const fixturePath = path.join(rootDir, "verification", "stage-state-fixtures.json");
const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const port = Number(argValue("--port", process.env.PORT || "4173"));
const host = argValue("--host", process.env.HOST || "127.0.0.1");
const initialScenario = argValue("--scenario", "happyPath");

const scenarios = {
  happyPath: fixtures.happyPath,
  fallbackPath: fixtures.fallbackPath,
  virtualStampPath: fixtures.virtualStampPath,
};

let activeScenarioName = scenarios[initialScenario] ? initialScenario : "happyPath";
let activeIndex = 0;

function withLiveFields(snapshot) {
  return {
    currentGoal:
      snapshot.currentGoal ||
      "Turn AirJelly capability discovery into a stage-safe verified HumanMCP call.",
    nextAction: snapshot.nextAction || undefined,
    airjelly: {
      source: "AirJelly Suggested, User Approved",
      adapterMode: "Mock Mode",
      capability: snapshot.endpoint || "/lindsay/business_judgement",
      approvalStatus: snapshot.endpoint ? "approved" : "pending",
      privacy: "No raw AirJelly memories or private context leave the local broker.",
    },
    proofState: snapshot.proofId ? (snapshot.verified ? "accepted" : "submitted") : "pending",
    verifyState: snapshot.verified ? "passed" : snapshot.proofId ? "pending" : "waiting",
    ...snapshot,
    mode: snapshot.mode || "mock_live_feed",
    updatedAt: new Date().toISOString(),
  };
}

function currentScenario() {
  return scenarios[activeScenarioName];
}

function currentSnapshot() {
  return withLiveFields(currentScenario()[activeIndex] || currentScenario()[0]);
}

function setScenario(name) {
  if (!scenarios[name]) {
    return false;
  }

  activeScenarioName = name;
  activeIndex = 0;
  return true;
}

function writeJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2) + "\n";
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(body);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function staticResponse(requestPath, response) {
  const cleanPath = requestPath === "/" ? "/index.html" : requestPath;
  const resolvedPath = path.resolve(rootDir, `.${decodeURIComponent(cleanPath)}`);

  if (!resolvedPath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const ext = path.extname(resolvedPath);
  const contentType =
    ext === ".html"
      ? "text/html; charset=utf-8"
      : ext === ".css"
        ? "text/css; charset=utf-8"
        : ext === ".js"
          ? "application/javascript; charset=utf-8"
          : ext === ".json"
            ? "application/json; charset=utf-8"
            : ext === ".svg"
              ? "image/svg+xml; charset=utf-8"
              : "application/octet-stream";

  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  fs.createReadStream(resolvedPath).pipe(response);
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

  if (request.method === "OPTIONS") {
    writeJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === "/humanmcp/stage-state") {
    const scenario = url.searchParams.get("scenario");
    const step = url.searchParams.get("step");

    if (scenario && !scenarios[scenario]) {
      writeJson(response, 404, {
        error: "unknown_scenario",
        availableScenarios: Object.keys(scenarios),
      });
      return;
    }

    const snapshots = scenario ? scenarios[scenario] : currentScenario();
    const index = step === null ? activeIndex : Number(step);
    const snapshot = snapshots[index] || snapshots[0];
    writeJson(response, 200, withLiveFields(snapshot));
    return;
  }

  if (url.pathname === "/humanmcp/rehearsal/status") {
    writeJson(response, 200, {
      activeScenario: activeScenarioName,
      activeIndex,
      availableScenarios: Object.keys(scenarios),
      current: currentSnapshot(),
      links: {
        surfaceA: `http://${host}:${port}/?feed=http://${host}:${port}/humanmcp/stage-state`,
        feed: `http://${host}:${port}/humanmcp/stage-state`,
        next: `curl -X POST http://${host}:${port}/humanmcp/rehearsal/next`,
        reset: `curl -X POST http://${host}:${port}/humanmcp/rehearsal/reset`,
      },
    });
    return;
  }

  if (url.pathname === "/humanmcp/rehearsal/next" && request.method === "POST") {
    activeIndex = Math.min(activeIndex + 1, currentScenario().length - 1);
    writeJson(response, 200, {
      ok: true,
      activeScenario: activeScenarioName,
      activeIndex,
      current: currentSnapshot(),
    });
    return;
  }

  if (url.pathname === "/humanmcp/rehearsal/reset" && request.method === "POST") {
    activeIndex = 0;
    writeJson(response, 200, {
      ok: true,
      activeScenario: activeScenarioName,
      activeIndex,
      current: currentSnapshot(),
    });
    return;
  }

  if (url.pathname === "/humanmcp/rehearsal/set" && request.method === "POST") {
    const body = await readRequestBody(request);
    if (body.scenario && !setScenario(body.scenario)) {
      writeJson(response, 404, {
        error: "unknown_scenario",
        availableScenarios: Object.keys(scenarios),
      });
      return;
    }

    if (Number.isInteger(body.index)) {
      activeIndex = Math.max(0, Math.min(body.index, currentScenario().length - 1));
    }

    writeJson(response, 200, {
      ok: true,
      activeScenario: activeScenarioName,
      activeIndex,
      current: currentSnapshot(),
    });
    return;
  }

  staticResponse(url.pathname, response);
}

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    writeJson(response, 500, {
      error: "rehearsal_server_error",
      message: String(error.message || error),
    });
  });
});

server.listen(port, host, () => {
  const feedUrl = `http://${host}:${port}/humanmcp/stage-state`;
  console.log("HumanMCP stage-state rehearsal server");
  console.log(`Surface A: http://${host}:${port}/?feed=${feedUrl}`);
  console.log(`Feed:      ${feedUrl}`);
  console.log(`Status:    http://${host}:${port}/humanmcp/rehearsal/status`);
  console.log(`Scenario:  ${activeScenarioName}`);
});
