# AirJelly P0.5 Capability Invitation Pack

Self-contained mock-mode assets for the AirJelly sponsor story. This pack stays outside the shared stage UI so other lanes can import the copy, data, and visuals without blocking on shared files.

## Included
- `demo-data/capability-invitation.mock.json` — demo-safe mock payload for Capability Invitation, approval, toolbox endpoint source attribution, and privacy boundaries.
- `docs/privacy-broker-copy.md` — operator/runbook copy for Mock Mode, Capability Invitation, and banned privacy claims.
- `assets/capability-invitation-panel.svg` — stage-ready visual showing suggestion -> approval -> endpoint creation.
- `assets/privacy-broker-flow.svg` — visual for the Local Privacy Broker boundary and the “capability card only” export rule.

## Locked copy
- Adapter status: `AirJelly Adapter: Mock Mode`
- Live status fallback: `AirJelly Connected`
- Source label: `Source: AirJelly Suggested, User Approved`
- Privacy line: `Local-first suggestion. User approval required. Capability card only.`

## Demo intent
1. AirJelly can suggest a capability from local context without turning that local context into a cloud export.
2. The user must explicitly approve the suggested capability before a HumanMCP endpoint appears.
3. The endpoint card shows `Source: AirJelly Suggested, User Approved`.
4. The story never claims raw-memory export, screenshot export, or any other sensitive-data export.

## Integration notes
- Treat the JSON file as the single mock payload for sponsor-facing rehearsal.
- The SVG files are static drop-in visuals for stage decks, browser tabs, or operator notes.
- The wording in `docs/privacy-broker-copy.md` is the approved narration baseline for Mock Mode and privacy Q&A.
