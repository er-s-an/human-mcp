# HumanMCP AirJelly Bridge

`#AttraX_Spring_Hackathon`

HumanMCP AirJelly Bridge is a hackathon prototype that lets an AI agent ask a bounded question to a real human on another AirJelly-enabled computer, while keeping local AirJelly memory and private screen context on the original machine.

This is intentionally not presented as a finished commercial product. The hackathon scope proves the core interaction: AirJelly-aware agents can route privacy-scoped questions to another human/agent, collect a reply, and keep an auditable HumanMCP state trail. Production-grade identity, cloud persistence, marketplace distribution, billing, and polished native AirJelly UX are future work.

The project demonstrates this loop:

1. A local agent detects user intent and decides that a human answer would help.
2. AirJelly is used as the local context and capability layer.
3. HumanMCP packages only a redacted task packet and match summary.
4. A helper computer receives a consent prompt, optional AirJelly task, and task page.
5. The helper submits an answer.
6. The coordinator records proof, audit events, and a stage-state feed for the demo UI.

## Current Status

This repository is ready for GitHub submission as a local/LAN demo prototype.

Implemented:

- Dual-end HumanMCP coordinator with task lifecycle, proof ids, audit trail, stage-state feed, and persisted state.
- AirJelly helper notifier with macOS consent prompt, optional AirJelly task creation, and browser task page fallback.
- Intent dispatcher that turns local AirJelly intent signals into HumanMCP tasks.
- Helper profile tag publisher that exports only coarse tags and numeric evidence counts.
- Stdio MCP server so AirJelly-side agents and local Codex agents can call the bridge as tools.
- Privacy gates for P0/P1/P2/P3/P4 task packets.
- Verification scripts for dual-end flow, privacy gates, profile tags, intent dispatch, and MCP tools.

Prototype limits:

- This is not a production auth system. Use `HUMANMCP_BRIDGE_TOKEN` for LAN testing.
- AirJelly native APIs are used opportunistically; the browser task page remains the reliable fallback.
- The helper's raw AirJelly memories, screenshots, people graph, and app usage are intentionally not exported.
- The coordinator is a repo-local Node.js demo service, not a hosted multi-tenant backend.
- The notifier is a local macOS helper script, not a packaged AirJelly-native extension.
- The MCP server is usable by local agents, but it is not yet distributed through an installable registry.

## What This Proves

- AirJelly can act as a local context and capability layer without leaking raw private context.
- HumanMCP can package an AI's uncertainty into a bounded human task.
- Another computer can receive the task, ask for consent, answer, and produce proof/audit state.
- The same MCP tools can support bidirectional agent-to-agent/human routing between two AirJelly machines.

## What Is Not Finished Yet

The hackathon version does not try to complete the whole product. Missing production work includes:

- Hosted coordinator service with durable database, accounts, teams, and revocable credentials.
- Real AirJelly-native install flow instead of local scripts and manual MCP config.
- Rich helper availability, routing, scheduling, and reputation.
- End-to-end encrypted payloads and stricter per-field data retention policy.
- Native notification/task UI inside AirJelly, beyond the current consent prompt plus browser fallback.
- Payment, quota, abuse prevention, admin moderation, and rate limits.
- Cross-platform packaging for Windows/Linux helper machines.
- Formal security review, threat model, and external penetration testing.

## Future Direction

The intended product path is:

1. Replace the local coordinator with a hosted HumanMCP/OpenCloud coordinator.
2. Turn the helper notifier into an AirJelly-native app/plugin experience.
3. Make the MCP server installable so any AirJelly-enabled agent can both ask and answer HumanMCP tasks.
4. Add identity, trust, availability, and proof policies for real multi-user deployments.
5. Keep the privacy contract: local AirJelly memory stays local; only approved task packets, match summaries, coarse tags, and answers leave the machine.

## Architecture

```text
Local computer
  AirJelly local context
        |
        v
  humanmcp_airjelly_intent_dispatcher.mjs
        |
        v
  humanmcp_dual_end_coordinator.mjs
        |  redacted task packet + match summary
        v
Helper computer
  humanmcp_airjelly_inbox_notifier.mjs
        |
        +--> consent prompt
        +--> optional AirJelly task
        +--> HumanMCP task page
        |
        v
  answer / verify / complete
```

The browser UI reads:

```text
http://127.0.0.1:4174/?feed=http://127.0.0.1:4180/humanmcp/stage-state
```

## Requirements

- Node.js 18 or newer.
- macOS for the helper notifier consent prompt and notification path.
- AirJelly installed on computers where you want AirJelly task/profile integration.
- Both computers on the same LAN for dual-computer testing.

No npm install is required for the core scripts.

## Quick Start: Local Demo

Start the coordinator:

```bash
node scripts/humanmcp_dual_end_coordinator.mjs --host 127.0.0.1 --port 4180
```

Create a task:

```bash
node scripts/humanmcp_airjelly_intent_dispatcher.mjs \
  --coordinator http://127.0.0.1:4180 \
  --intent "I need a real person to judge whether this landing page is clear"
```

Open the helper inbox locally:

```text
http://127.0.0.1:4180/humanmcp/inbox/lindsay
```

Open the stage-state feed:

```text
http://127.0.0.1:4180/humanmcp/stage-state
```

## Quick Start: Two Computers

On the coordinator computer, prefer token auth:

```bash
export HUMANMCP_BRIDGE_TOKEN="change-this-demo-token"
node scripts/humanmcp_dual_end_coordinator.mjs --host 0.0.0.0 --port 4180
```

Find the LAN URL printed by the coordinator, for example:

```text
http://172.16.24.206:4180
```

On the helper computer:

```bash
export HUMANMCP_BRIDGE_TOKEN="change-this-demo-token"
node scripts/humanmcp_airjelly_inbox_notifier.mjs \
  --coordinator http://172.16.24.206:4180 \
  --human-id lindsay \
  --open \
  --create-airjelly-task \
  --ask-before-open \
  --profile-tag
```

For a time-boxed hackathon LAN demo without token auth, the coordinator must opt in explicitly:

```bash
node scripts/humanmcp_dual_end_coordinator.mjs \
  --host 0.0.0.0 \
  --port 4180 \
  --allow-unauthenticated-lan
```

Do not use unauthenticated LAN mode outside a controlled demo network.

## Bidirectional Use

The bridge supports two-way use. A single coordinator can route tasks in both directions as long as each computer has its own `humanId`.

Example:

```text
Computer A local inbox: alice
Computer B local inbox: bob
A sends to bob with targetHumanId=bob.
B sends to alice with targetHumanId=alice.
```

In MCP config, use:

```json
{
  "HUMANMCP_HUMAN_ID": "alice",
  "HUMANMCP_HUMAN_NAME": "Alice",
  "HUMANMCP_ENDPOINT": "/alice/product_judgement",
  "HUMANMCP_TARGET_HUMAN_ID": "bob",
  "HUMANMCP_TARGET_HUMAN_NAME": "Bob",
  "HUMANMCP_TARGET_ENDPOINT": "/bob/business_judgement"
}
```

On the other computer, swap the local and target identities. `humanmcp_get_inbox` reads the local inbox; `humanmcp_dispatch_task` sends to the default target, or to a per-call `targetHumanId`.

## MCP Server

The MCP server exposes HumanMCP and AirJelly bridge tools over stdio:

```bash
node scripts/airjelly_humanmcp_mcp_server.mjs
```

Main tools:

- `airjelly_status`
- `airjelly_profile_tag`
- `humanmcp_classify_intent`
- `humanmcp_dispatch_task`
- `humanmcp_get_inbox`
- `humanmcp_answer_task`
- `humanmcp_get_stage_state`
- `airjelly_create_local_task`

See [docs/runbooks/airjelly-humanmcp-mcp.md](docs/runbooks/airjelly-humanmcp-mcp.md) for Codex/AirJelly MCP configuration.

## Privacy Model

The bridge sends only:

- The explicit user-approved question.
- A redacted task packet.
- A match summary.
- Coarse helper profile tags.
- Numeric evidence counts such as `memories`, `openTasks`, and `airjellyMethods`.

The bridge does not send:

- Raw AirJelly memories.
- Screenshots.
- Private messages.
- Credentials.
- Full app usage history.
- Unrelated tabs or raw local files.

Task privacy gates:

- `P0`: internal only, blocked.
- `P1`: redacted artifact slice, allowed.
- `P2`: limited workflow context, requires explicit approval.
- `P3`: sensitive review, requires approval and operator review.
- `P4`: private material, blocked.

## Verification

Run the main checks:

```bash
node verification/check-dual-end-flow.mjs
node verification/check-dual-end-privacy-gates.mjs
node verification/check-helper-profile-tag.mjs
node verification/check-airjelly-intent-dispatcher.mjs
node verification/check-airjelly-humanmcp-mcp.mjs
node verification/check-airjelly-coordinator-protocol.mjs
node verification/check-dual-end-bridge.mjs
```

Expected result: each script prints `PASS`.

## Important Files

- [scripts/humanmcp_dual_end_coordinator.mjs](scripts/humanmcp_dual_end_coordinator.mjs): coordinator, task lifecycle, auth gate, privacy gate, stage-state.
- [scripts/humanmcp_airjelly_inbox_notifier.mjs](scripts/humanmcp_airjelly_inbox_notifier.mjs): helper-side polling, consent prompt, notifications, optional AirJelly task creation.
- [scripts/humanmcp_airjelly_intent_dispatcher.mjs](scripts/humanmcp_airjelly_intent_dispatcher.mjs): local intent classification and dispatch.
- [scripts/airjelly_humanmcp_mcp_server.mjs](scripts/airjelly_humanmcp_mcp_server.mjs): stdio MCP server.
- [docs/runbooks/helper-codex-airjelly-handoff.md](docs/runbooks/helper-codex-airjelly-handoff.md): what to send to the helper computer's Codex.
- [docs/runbooks/airjelly-dual-end-test.md](docs/runbooks/airjelly-dual-end-test.md): dual-computer test runbook.

## GitHub Submission Notes

Before publishing:

- Do not commit `.omx/`, `.DS_Store`, `.env`, tokens, or local AirJelly runtime files.
- Use `HUMANMCP_BRIDGE_TOKEN` for any LAN demo shared outside your own machine.
- Include screenshots or a short demo video of the stage-state UI if the hackathon submission form supports media.
