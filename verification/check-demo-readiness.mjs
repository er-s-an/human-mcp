#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const verificationDir = path.dirname(__filename);
const rootDir = path.resolve(verificationDir, '..');

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const reportFlagIndex = args.indexOf('--report');
const reportPath = reportFlagIndex >= 0 ? args[reportFlagIndex + 1] : null;
const remoteFeedFlagIndex = args.indexOf('--remote-feed');
const remoteFeedUrl =
  remoteFeedFlagIndex >= 0 ? args[remoteFeedFlagIndex + 1] : null;
const expectLiveEnter = args.includes('--expect-live-enter');

if (reportFlagIndex >= 0 && !reportPath) {
  console.error('Missing value for --report');
  process.exit(2);
}

if (remoteFeedFlagIndex >= 0 && !remoteFeedUrl) {
  console.error('Missing value for --remote-feed');
  process.exit(2);
}

const requirements = JSON.parse(
  fs.readFileSync(path.join(verificationDir, 'demo-requirements.json'), 'utf8')
);
const fixtures = JSON.parse(
  fs.readFileSync(path.join(verificationDir, 'stage-state-fixtures.json'), 'utf8')
);

const filesToScan = [
  'index.html',
  'script.js',
  'styles.css',
  'scripts/stage_state_rehearsal_server.mjs',
];
const sourceByFile = Object.fromEntries(
  filesToScan.map((name) => [name, fs.readFileSync(path.join(rootDir, name), 'utf8')])
);
const combinedSource = Object.values(sourceByFile).join('\n');
const stageOrderMatch = sourceByFile['script.js'].match(/const\s+STAGE_ORDER\s*=\s*\[([\s\S]*?)\];/);
const currentStates = stageOrderMatch
  ? [...stageOrderMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])
  : [...sourceByFile['script.js'].matchAll(/mood:\s*"([^"]+)"/g)].map((match) => match[1]);

function unique(values) {
  return [...new Set(values)];
}

function containsInOrder(haystack, sequence) {
  let cursor = 0;
  for (const item of haystack) {
    if (item === sequence[cursor]) cursor += 1;
    if (cursor === sequence.length) return true;
  }
  return false;
}

function evaluateSignal(signal, haystack) {
  const matches = signal.patterns.filter((pattern) => haystack.includes(pattern));
  const pass = signal.mode === 'allOf' ? matches.length === signal.patterns.length : matches.length > 0;
  return {
    name: signal.name,
    pass,
    details: {
      mode: signal.mode,
      matches,
      missing: signal.patterns.filter((pattern) => !matches.includes(pattern)),
    },
  };
}

function validateFixturePath(name, snapshots, expectedStages) {
  const errors = [];
  for (const [index, snapshot] of snapshots.entries()) {
    const missingKeys = requirements.requiredSnapshotKeys.filter((key) => !(key in snapshot));
    if (missingKeys.length) {
      errors.push(`${name}[${index}] missing keys: ${missingKeys.join(', ')}`);
    }
  }

  const actualStages = snapshots.map((snapshot) => snapshot.stage);
  if (!containsInOrder(actualStages, expectedStages)) {
    errors.push(
      `${name} stages out of order. expected subsequence: ${expectedStages.join(' -> ')}; actual: ${actualStages.join(' -> ')}`
    );
  }

  return {
    name,
    pass: errors.length === 0,
    details: errors.length === 0 ? `${name} fixture matches required stage sequence.` : errors,
  };
}

function validateEnterDatabaseHandoff(requirementsConfig) {
  const config = requirementsConfig.enterDatabaseHandoff || {};
  const docPath = config.docPath || 'docs/runbooks/enter-database-handoff-inventory.md';
  const requiredMarkers = config.requiredMarkers || [];
  const resolvedDocPath = path.join(rootDir, docPath);

  if (!fs.existsSync(resolvedDocPath)) {
    return {
      name: 'enter_database_handoff_inventory',
      pass: false,
      details: [`missing handoff inventory doc: ${docPath}`],
    };
  }

  const source = fs.readFileSync(resolvedDocPath, 'utf8');
  const missing = requiredMarkers.filter((marker) => !source.includes(marker));

  return {
    name: 'enter_database_handoff_inventory',
    pass: missing.length === 0,
    details:
      missing.length === 0
        ? {
            path: docPath,
            markers: requiredMarkers,
          }
        : {
            path: docPath,
            missing,
          },
  };
}

function validateSmartAssignmentFixtures(fixturesByName) {
  const errors = [];
  const requiredKeys = requirements.requiredSmartAssignmentKeys || [];

  for (const [name, snapshots] of Object.entries(fixturesByName)) {
    for (const [index, snapshot] of snapshots.entries()) {
      const smartAssignment = snapshot.smartAssignment || snapshot.smart_assignment;

      if (!smartAssignment || typeof smartAssignment !== 'object') {
        errors.push(`${name}[${index}] missing smartAssignment`);
        continue;
      }

      const missingKeys = requiredKeys.filter((key) => !(key in smartAssignment));
      if (missingKeys.length) {
        errors.push(`${name}[${index}] smartAssignment missing keys: ${missingKeys.join(', ')}`);
      }

      if (!Array.isArray(smartAssignment.candidates) || smartAssignment.candidates.length === 0) {
        errors.push(`${name}[${index}] smartAssignment.candidates must be a non-empty array`);
      }

      if (!String(smartAssignment.policy || '').includes('proofability')) {
        errors.push(`${name}[${index}] smartAssignment.policy must mention proofability`);
      }
    }
  }

  return {
    name: 'smart_assignment_fixture_contract',
    pass: errors.length === 0,
    details:
      errors.length === 0
        ? 'All fixture snapshots include smart assignment routing, rationale, policy, fallback, and candidates.'
        : errors,
  };
}

async function fetchRemoteSnapshot(feedUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(feedUrl, {
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await response.text();
    let snapshot = null;

    try {
      snapshot = JSON.parse(text);
    } catch (error) {
      throw new Error(`Remote feed did not return JSON: ${error.message}`);
    }

    return {
      ok: response.ok,
      status: response.status,
      headers: {
        contentType: response.headers.get('content-type') || '',
        cors: response.headers.get('access-control-allow-origin') || '',
        cacheControl: response.headers.get('cache-control') || '',
      },
      snapshot,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function validateRemoteSnapshot(feedUrl, remoteResult) {
  const errors = [];
  const { ok, status, headers, snapshot } = remoteResult;
  const requiredRemoteKeys = [
    'source',
    'mode',
    'stage',
    'expressionState',
    'stampStatus',
    'message',
    'updatedAt',
    'operatorActions',
  ];

  if (!ok) {
    errors.push(`HTTP status was ${status}`);
  }

  if (!headers.contentType.includes('application/json')) {
    errors.push(`content-type is not JSON: ${headers.contentType || 'missing'}`);
  }

  if (!headers.cors) {
    errors.push('missing Access-Control-Allow-Origin header');
  }

  const missingKeys = requiredRemoteKeys.filter((key) => !(key in snapshot));
  if (missingKeys.length) {
    errors.push(`missing remote keys: ${missingKeys.join(', ')}`);
  }

  if (snapshot.source !== 'windows-openclaw') {
    errors.push(`source must be windows-openclaw; got ${snapshot.source}`);
  }

  if (!requirements.requiredStageStates.includes(snapshot.stage)) {
    errors.push(`stage is not in approved vocabulary: ${snapshot.stage}`);
  }

  const parsedUpdatedAt = new Date(snapshot.updatedAt);
  if (Number.isNaN(parsedUpdatedAt.getTime())) {
    errors.push(`updatedAt is not parseable: ${snapshot.updatedAt}`);
  } else {
    const ageMs = Date.now() - parsedUpdatedAt.getTime();
    if (Math.abs(ageMs) > 15000) {
      errors.push(`updatedAt is not fresh enough: ageMs=${ageMs}`);
    }
  }

  if (!snapshot.operatorActions || typeof snapshot.operatorActions !== 'object') {
    errors.push('operatorActions must be an object');
  }

  if (expectLiveEnter) {
    const enterRequirements = requirements.enterBackedStageRequirements || {};
    const assignmentStages = enterRequirements.assignmentIdFromStages || [];
    const proofStages = enterRequirements.proofIdFromStages || [];
    const verifiedStages = enterRequirements.verifiedTrueFromStages || [];
    const terminalStages = enterRequirements.terminalStampStages || [];
    const terminalStatuses = enterRequirements.terminalStampStatuses || [];

    if (snapshot.mode !== 'live') {
      errors.push(`mode must be live for Enter-backed validation; got ${snapshot.mode}`);
    }

    if (assignmentStages.includes(snapshot.stage) && !snapshot.assignmentId) {
      errors.push(`assignmentId is required for Enter-backed stage ${snapshot.stage}`);
    }

    if (proofStages.includes(snapshot.stage) && !snapshot.proofId) {
      errors.push(`proofId is required for Enter-backed stage ${snapshot.stage}`);
    }

    if (verifiedStages.includes(snapshot.stage) && snapshot.verified !== true) {
      errors.push(`verified must be true for Enter-backed stage ${snapshot.stage}`);
    }

    if (
      terminalStages.includes(snapshot.stage) &&
      !terminalStatuses.includes(snapshot.stampStatus)
    ) {
      errors.push(
        `stampStatus must be terminal for ${snapshot.stage}; got ${snapshot.stampStatus}`
      );
    }
  }

  return {
    name: 'remote_windows_stage_state_feed',
    pass: errors.length === 0,
    details:
      errors.length === 0
        ? {
            feedUrl,
            status,
            cors: headers.cors,
            cacheControl: headers.cacheControl,
            source: snapshot.source,
            mode: snapshot.mode,
            stage: snapshot.stage,
            assignmentId: snapshot.assignmentId || null,
            proofId: snapshot.proofId || null,
            expressionState: snapshot.expressionState,
            stampStatus: snapshot.stampStatus,
            updatedAt: snapshot.updatedAt,
          }
        : errors,
  };
}

const requiredStateCheck = {
  name: 'required_stage_states_present_in_script',
  pass: requirements.requiredStageStates.every((state) => currentStates.includes(state)),
  details: {
    present: unique(currentStates),
    missing: requirements.requiredStageStates.filter((state) => !currentStates.includes(state)),
  },
};

const happyPathCheck = {
  name: 'happy_path_sequence_present_in_script',
  pass: containsInOrder(currentStates, requirements.happyPathStages),
  details: {
    expected: requirements.happyPathStages,
    actual: unique(currentStates),
  },
};

const signalChecks = requirements.requiredSignals.map((signal) => evaluateSignal(signal, combinedSource));
const fixtureChecks = [
  validateFixturePath('happyPath', fixtures.happyPath, requirements.happyPathStages),
  validateFixturePath('fallbackPath', fixtures.fallbackPath, requirements.fallbackPathStages),
  validateFixturePath(
    'virtualStampPath',
    fixtures.virtualStampPath,
    requirements.virtualStampPathStages
  ),
  validateSmartAssignmentFixtures(fixtures),
  validateEnterDatabaseHandoff(requirements),
];

const rehearsalServerPath = path.join(rootDir, 'scripts', 'stage_state_rehearsal_server.mjs');
const rehearsalServerSource = fs.existsSync(rehearsalServerPath)
  ? fs.readFileSync(rehearsalServerPath, 'utf8')
  : '';
const rehearsalServerMarkers = [
  '/humanmcp/stage-state',
  '/humanmcp/rehearsal/status',
  '/humanmcp/rehearsal/next',
  'virtualStampPath',
];
const rehearsalServerCheck = {
  name: 'local_rehearsal_server_present',
  pass:
    fs.existsSync(rehearsalServerPath) &&
    rehearsalServerMarkers.every((marker) => rehearsalServerSource.includes(marker)),
  details: {
    path: 'scripts/stage_state_rehearsal_server.mjs',
    markers: rehearsalServerMarkers.filter((marker) => rehearsalServerSource.includes(marker)),
    missing: rehearsalServerMarkers.filter((marker) => !rehearsalServerSource.includes(marker)),
  },
};

const remoteFeedChecks = [];
if (remoteFeedUrl) {
  try {
    const remoteResult = await fetchRemoteSnapshot(remoteFeedUrl);
    remoteFeedChecks.push(validateRemoteSnapshot(remoteFeedUrl, remoteResult));
  } catch (error) {
    remoteFeedChecks.push({
      name: 'remote_windows_stage_state_feed',
      pass: false,
      details: [String(error.message || error)],
    });
  }
}

const checks = [
  requiredStateCheck,
  happyPathCheck,
  ...signalChecks,
  ...fixtureChecks,
  rehearsalServerCheck,
  ...remoteFeedChecks,
];
const failedChecks = checks.filter((check) => !check.pass);
const summary = {
  ready: failedChecks.length === 0,
  failedChecks: failedChecks.map((check) => check.name),
  sourceFiles: filesToScan,
  remoteFeedUrl,
  expectLiveEnter,
};

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  checks,
};

if (reportPath) {
  const resolvedReportPath = path.resolve(rootDir, reportPath);
  fs.mkdirSync(path.dirname(resolvedReportPath), { recursive: true });
  fs.writeFileSync(resolvedReportPath, JSON.stringify(report, null, 2) + '\n');
}

console.log('Demo readiness verification report');
console.log(`Generated: ${report.generatedAt}`);
for (const check of checks) {
  const marker = check.pass ? 'PASS' : 'FAIL';
  const detail = typeof check.details === 'string' ? check.details : JSON.stringify(check.details);
  console.log(`- ${marker} ${check.name}: ${detail}`);
}
console.log(`Summary: ready=${summary.ready} failed=${summary.failedChecks.length}`);

if (strict && failedChecks.length > 0) {
  process.exit(1);
}
