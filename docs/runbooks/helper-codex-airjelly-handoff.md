# Helper Codex AirJelly Handoff

Send this packet to the Codex session on the helper computer.

## Goal

Run the helper-side HumanMCP notifier so AirJelly receives the task as a local AirJelly task, the browser opens the Task Packet Preview, and the helper can submit one answer.

## Assumptions

- AirJelly Desktop is already installed and running on the helper computer.
- Node.js 18+ is available.
- The helper computer can reach the coordinator URL from the organizer computer.
- The organizer has already started:

```bash
node scripts/humanmcp_dual_end_coordinator.mjs --host 0.0.0.0 --port 4180
```

## Helper Commands

Check AirJelly runtime:

```bash
ls -la "$HOME/Library/Application Support/AirJelly/runtime.json"
node -v
```

Run the notifier in P3 hackathon mode:

```bash
node humanmcp_airjelly_inbox_notifier.mjs \
  --coordinator http://172.16.24.206:4180 \
  --human-id lindsay \
  --open \
  --create-airjelly-task
```

Expected notifier output:

```text
airjellyCreateTask=enabled
AirJelly task created for <task_id>
open http://172.16.24.206:4180/humanmcp/tasks/<task_id>
```

## Helper Acceptance

Report these back to the organizer:

- AirJelly task appeared: yes/no
- Browser opened the HumanMCP task page: yes/no
- Page showed Task Packet Preview: yes/no
- Page showed Human will see / Human will NOT see: yes/no
- Page showed Privacy Budget: yes/no
- Answer submitted: yes/no
- Notifier output, especially any `AirJelly task create failed` line

## Fallback

If AirJelly task creation fails but the browser opens, submit the browser task anyway. The hackathon demo can still show the end-to-end HumanMCP flow, and the failure line becomes evidence for the next AirJelly-native iteration.

