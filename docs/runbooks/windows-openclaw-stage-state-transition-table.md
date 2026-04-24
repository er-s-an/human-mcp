# Windows OpenClaw Stage-State Transition Table

This table is the operator-facing quick reference for how the Windows/OpenClaw controller should move the shared stage-state snapshot during the demo.

| Situation | `stage` | `expressionState` | `stampStatus` | Operator note |
| --- | --- | --- | --- | --- |
| Surface B booted, auth missing or invalid | `auth_blocked` | `needs_help` | `null` | Fix auth before assigning any task |
| Auth works but no online humans/capabilities | `no_humans` | `thinking` | `null` | Wait for humans list to recover or switch to rehearsal seed data |
| Task assigned and waiting for human action | `assigned` | `calling` | `null` | Surface B is live; Mac should mirror only the Windows feed |
| Proof list shows pending work | `proof_pending` | `proof_verifying` | `null` | Keep polling from Windows only |
| Verify rejected the proof | `verify_failed` | `needs_help` | `null` | Retry, skip, or operator-manual recovery |
| Verify passed and stamp is allowed | `stamp_ready` | `verified` | `requested` | Choose robot, virtual, or manual branch |
| Robot branch started | `stamp_ready` | `verified` | `robot_inflight` | Do not claim success until robot finishes |
| Virtual fallback selected | `virtual_stamp` | `verified` | `requested` | Audience-visible fallback moment |
| Virtual fallback completed | `stamped` | `stamped` | `virtual_done` | Use if robot or cloud writeback is unavailable |
| Manual operator fallback selected | `manual_override` | `needs_help` | `requested` | Operator takes control of the beat |
| Manual fallback completed | `complete` | `stamped` | `manual_done` | Record proof id for reconciliation if needed |
| Physical robot stamp completed | `stamped` | `stamped` | `hardware_done` | Preferred happy path |
| Cloud writeback still missing after fallback | `complete` | `stamped` | `reconciliation_pending` | Demo can finish, but website truth still needs post-demo repair |
| Mac has not received a fresh snapshot for >5 seconds | `fallback_scripted` | `needs_help` | keep last known value | Say `operator sync mode` and continue from Surface B |

## Brownfield mapping from current OpenClaw MVP

| Current OpenClaw MVP signal | Demo contract mapping |
| --- | --- |
| `rejected` stage in `humanmcp.ts` | `verify_failed` |
| local `virtual_done` stamp fallback | `stage=stamped`, `stampStatus=virtual_done` |
| local operator fallback sets `requested` | `stage=manual_override` first, then `complete` with `manual_done` |
| stage display `needs_help` AI state | use for `auth_blocked`, `verify_failed`, `manual_override`, `fallback_scripted` |
