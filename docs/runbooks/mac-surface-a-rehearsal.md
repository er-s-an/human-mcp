# Mac Surface A Rehearsal Runbook

This is the Mac-side runbook for finishing our local responsibilities before the Windows/OpenClaw machine is ready. It does not replace the Windows single-writer rule for the live show; it gives Surface A a local rehearsal writer so the Mac screen can be tested end to end.

## 1. Start the local rehearsal feed

```bash
node scripts/stage_state_rehearsal_server.mjs --port 4173 --scenario happyPath
```

Open the printed Surface A URL:

```text
http://127.0.0.1:4173/?feed=http://127.0.0.1:4173/humanmcp/stage-state
```

The server exposes:

- `GET /humanmcp/stage-state` — current rehearsal snapshot, same shape Surface A expects from Windows.
- `GET /humanmcp/rehearsal/status` — current scenario, step, and useful links.
- `POST /humanmcp/rehearsal/next` — move one step forward.
- `POST /humanmcp/rehearsal/reset` — return to step 0.
- `POST /humanmcp/rehearsal/set` — set `{ "scenario": "...", "index": 0 }`.

## 2. Rehearse the happy path

```bash
curl -X POST http://127.0.0.1:4173/humanmcp/rehearsal/reset
curl -X POST http://127.0.0.1:4173/humanmcp/rehearsal/next
curl -X POST http://127.0.0.1:4173/humanmcp/rehearsal/next
curl -X POST http://127.0.0.1:4173/humanmcp/rehearsal/next
curl -X POST http://127.0.0.1:4173/humanmcp/rehearsal/next
curl -X POST http://127.0.0.1:4173/humanmcp/rehearsal/next
curl -X POST http://127.0.0.1:4173/humanmcp/rehearsal/next
curl -X POST http://127.0.0.1:4173/humanmcp/rehearsal/next
```

Expected visible sequence:

```text
idle -> assigned -> calling -> proof_pending -> verified -> stamp_ready -> stamped -> complete
```

During `assigned` or `calling`, Surface A must show the Task Packet Preview
summary: `Human will see`, `Human will NOT see`, Privacy Budget `P0` to `P4`,
and the single question. This rehearses the same privacy boundary that Enter /
Surface B must enforce with a blocking modal before assignment dispatch.

## 3. Rehearse the virtual stamp fallback

```bash
curl -X POST http://127.0.0.1:4173/humanmcp/rehearsal/set \
  -H 'Content-Type: application/json' \
  --data '{"scenario":"virtualStampPath","index":0}'
```

Then call `/humanmcp/rehearsal/next` until Surface A shows:

```text
stamp_ready -> virtual_stamp -> stamped -> complete
```

This is the default Mac-side proof that the demo can still finish if the hardware branch is not ready.

## 4. Rehearse operator sync mode

```bash
curl -X POST http://127.0.0.1:4173/humanmcp/rehearsal/set \
  -H 'Content-Type: application/json' \
  --data '{"scenario":"fallbackPath","index":0}'
```

Move forward until Surface A shows `fallback_scripted`. The operator phrase is:

```text
operator sync mode
```

In the real show, this phrase means Surface B on Windows remains authoritative and the Mac context screen is only holding the audience narrative.

## 5. Switch to the real Windows feed

When the Windows owner sends the final feed URL, open Surface A with that URL:

```text
http://127.0.0.1:4173/?feed=http://<windows-host>:4173/humanmcp/stage-state
```

Do not run the local rehearsal server as the stage-state authority during the live show unless Windows explicitly falls back to a Mac-hosted contingency feed.

## 6. Mac-side done criteria

- Surface A loads from the rehearsal server.
- Happy path reaches `complete`.
- Task Packet Preview summary is visible with two columns and Privacy Budget `P0` to `P4`.
- Virtual stamp path reaches `complete` with `virtual_done`.
- Fallback path reaches `fallback_scripted` and the operator banner is visible.
- `node verification/check-demo-readiness.mjs --strict` passes.
- The final live feed URL from Windows is reachable from the Mac before show time.
