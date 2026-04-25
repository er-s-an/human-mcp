#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const verificationDir = path.dirname(__filename);
const rootDir = path.resolve(verificationDir, '..');

const docPath = 'airjelly-p05/docs/match-summary-coordinator-protocol.md';
const fixturePath = 'airjelly-p05/demo-data/match-summary-coordinator.fixture.json';
const requiredMarkers = [
  'AIRJELLY_NO_DIRECT_NODE_COMMUNICATION',
  'COORDINATOR_OWNS_INVITE_RESPONSE',
  'MATCH_SUMMARY_ONLY_EXPORT',
  'RAW_AIRJELLY_CONTEXT_STAYS_LOCAL',
];

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

const errors = [];
const doc = readText(docPath);
const fixture = JSON.parse(readText(fixturePath));

for (const marker of requiredMarkers) {
  assert(doc.includes(marker), `${docPath} missing marker ${marker}`, errors);
  assert(
    Array.isArray(fixture.markers) && fixture.markers.includes(marker),
    `${fixturePath} missing marker ${marker}`,
    errors
  );
}

assert(
  doc.includes('AirJelly does not directly communicate across nodes'),
  `${docPath} must state AirJelly has no direct cross-node communication`,
  errors
);
assert(
  doc.includes('The HumanMCP/OpenCloud coordinator owns invite delivery'),
  `${docPath} must state coordinator invite ownership`,
  errors
);
assert(fixture.protocol === 'airjelly_match_summary_v0', 'protocol must be airjelly_match_summary_v0', errors);
assert(fixture.source === 'AirJelly Suggested, User Approved', 'source label must be preserved', errors);
assert(fixture.directNodeTransport === false, 'directNodeTransport must be false', errors);
assert(fixture.airjellyRole === 'local_match_summary_only', 'airjellyRole must stay summary-only', errors);
assert(
  fixture.coordinatorRole === 'invite_response_packager',
  'coordinatorRole must own invite/response packaging',
  errors
);
assert(Boolean(fixture.summary?.need?.question), 'summary.need.question is required', errors);
assert(Boolean(fixture.summary?.candidate?.endpoint), 'summary.candidate.endpoint is required', errors);
assert(
  Array.isArray(fixture.summary?.signals) && fixture.summary.signals.length > 0,
  'summary.signals must be non-empty',
  errors
);
assert(
  fixture.privacy?.exports?.includes('match_summary'),
  'privacy.exports must include match_summary',
  errors
);
assert(
  fixture.privacy?.neverExports?.some((item) => item.includes('raw AirJelly memories')),
  'privacy.neverExports must include raw AirJelly memories',
  errors
);
assert(
  fixture.inviteResponseBoundary?.inviteOwner === 'HumanMCP/OpenCloud coordinator',
  'invite owner must be HumanMCP/OpenCloud coordinator',
  errors
);
assert(
  fixture.inviteResponseBoundary?.responseOwner === 'HumanMCP/OpenCloud coordinator',
  'response owner must be HumanMCP/OpenCloud coordinator',
  errors
);
assert(
  fixture.inviteResponseBoundary?.airjellyMaySendInvite === false,
  'AirJelly must not send coordinator invites',
  errors
);
assert(
  fixture.inviteResponseBoundary?.airjellyMayCollectResponse === false,
  'AirJelly must not collect coordinator responses',
  errors
);

console.log('AirJelly coordinator protocol verification');
console.log(`- checked ${docPath}`);
console.log(`- checked ${fixturePath}`);

if (errors.length) {
  for (const error of errors) {
    console.log(`- FAIL ${error}`);
  }
  process.exit(1);
}

console.log('- PASS protocol markers and fixture boundary checks');
