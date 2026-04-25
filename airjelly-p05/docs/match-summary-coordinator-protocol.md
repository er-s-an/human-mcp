# AirJelly Match Summary Coordinator Protocol

This local protocol artifact defines the middle-layer handoff between AirJelly local match discovery and a future HumanMCP/OpenCloud coordinator package.

## Boundary

- AirJelly does not directly communicate across nodes.
- AirJelly only produces a local match summary after local user approval.
- The HumanMCP/OpenCloud coordinator owns invite delivery, response collection, retries, and audit packaging.
- Raw AirJelly memories, screenshots, contacts, clipboard contents, app history, and private notes stay local.
- The exported artifact is the approved match summary, not a live AirJelly session or raw context stream.

## Local Artifact

`airjelly_match_summary_v0` is the only AirJelly-originated payload that can leave the local broker.

Required fields:

- `protocol`: must be `airjelly_match_summary_v0`.
- `source`: must preserve `AirJelly Suggested, User Approved`.
- `directNodeTransport`: must be `false`.
- `airjellyRole`: must be `local_match_summary_only`.
- `coordinatorRole`: must be `invite_response_packager`.
- `summary.need`: the single human-facing need or question.
- `summary.candidate`: the selected HumanMCP capability endpoint candidate.
- `summary.signals`: redacted, user-visible matching reasons.
- `privacy.exports`: must include `match_summary`.
- `privacy.neverExports`: must include raw local context classes.
- `inviteResponseBoundary.inviteOwner`: must be `HumanMCP/OpenCloud coordinator`.
- `inviteResponseBoundary.responseOwner`: must be `HumanMCP/OpenCloud coordinator`.

## Coordinator Packaging Contract

The coordinator receives the match summary and creates its own package:

1. Build one scoped invite from `summary.need`.
2. Deliver the invite to the selected HumanMCP endpoint or approved fallback.
3. Collect a structured response.
4. Attach audit metadata: caller, helper, shared packet, response, user decision.
5. Return a coordinator package for Surface B / Surface A feeds.

The coordinator must not ask AirJelly to contact another node directly. If the invite fails, the coordinator performs retry, fallback, or manual override.

## Verification Markers

These markers are intentionally stable for lightweight verification:

- `AIRJELLY_NO_DIRECT_NODE_COMMUNICATION`
- `COORDINATOR_OWNS_INVITE_RESPONSE`
- `MATCH_SUMMARY_ONLY_EXPORT`
- `RAW_AIRJELLY_CONTEXT_STAYS_LOCAL`

