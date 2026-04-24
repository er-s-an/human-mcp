# Windows OpenClaw Handoff Packet Template

Use this exact packet when the Windows/OpenClaw machine is live and Surface A on the Mac needs to consume the feed.

## Copy/paste message template

```text
Windows/OpenClaw host: http://<windows-host>:4173
Surface B URL: http://<windows-host>:4173
Stage-state URL: http://<windows-host>:4173/humanmcp/stage-state
Fallback file URL (if needed): http://<windows-host>:4173/humanmcp/stage-state.json
Single writer confirmed: yes
Demo stamp mode: robot | virtual | manual
Latest proof id: <proof_id>
Latest stage: <stage>
Latest stamp status: <stamp_status>
Mac stale-feed phrase: operator sync mode
Reconciliation owner: <name>
Notes: <robot available / fallback only / website stamp endpoint unavailable>
```

## Must-be-true before sending the packet

- Windows/OpenClaw Surface B is already open and operator-visible
- `updatedAt` in the snapshot is fresh
- the Mac can reach either the HTTP feed or the contingency file URL
- the chosen stamp branch for the demo is final
- any missing cloud writeback is explicitly called out in `Notes`

## Launch-order reminder

1. Start the website/cloud services first.
2. Start Windows/OpenClaw Surface B second.
3. Confirm the stage-state feed is reachable from the Mac.
4. Start the Mac context screen last so it attaches to a live Windows writer.
5. If the Mac loses feed, continue the demo from Surface B and say `operator sync mode`.
