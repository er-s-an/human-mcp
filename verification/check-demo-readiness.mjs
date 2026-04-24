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

if (reportFlagIndex >= 0 && !reportPath) {
  console.error('Missing value for --report');
  process.exit(2);
}

const requirements = JSON.parse(
  fs.readFileSync(path.join(verificationDir, 'demo-requirements.json'), 'utf8')
);
const fixtures = JSON.parse(
  fs.readFileSync(path.join(verificationDir, 'stage-state-fixtures.json'), 'utf8')
);

const filesToScan = ['index.html', 'script.js', 'styles.css'];
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
];

const checks = [requiredStateCheck, happyPathCheck, ...signalChecks, ...fixtureChecks];
const failedChecks = checks.filter((check) => !check.pass);
const summary = {
  ready: failedChecks.length === 0,
  failedChecks: failedChecks.map((check) => check.name),
  sourceFiles: filesToScan,
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
