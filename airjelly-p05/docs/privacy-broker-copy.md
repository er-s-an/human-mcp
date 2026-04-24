# AirJelly P0.5 Privacy Broker Copy

Use this copy for sponsor-facing rehearsal, operator narration, and any lane that needs to render the AirJelly P0.5 story without inventing new privacy claims.

## Approved headline
**Capability Invitation**

## Approved adapter labels
- Primary mock fallback: `AirJelly Adapter: Mock Mode`
- Optional live variant: `AirJelly Connected`

## Approved short narration
> AirJelly suggests a capability locally. The user approves it. HumanMCP only receives the approved capability card.

## Approved source attribution
`Source: AirJelly Suggested, User Approved`

## Approved privacy line
`Local-first suggestion. User approval required. Capability card only.`

## What the audience should understand
1. AirJelly is a P0.5 sponsor-story insert, not a hard dependency for the main demo.
2. Mock Mode is acceptable because it preserves the exact same invitation, approval, and source-attribution flow.
3. The private layer stays local. The exported artifact is the approved capability card, not raw personal context.
4. The invitation is reversible: the user can decline, and no endpoint is created.

## Safe talk track
- "AirJelly can notice a pattern locally and suggest a helper."
- "The user still has to approve the capability before it becomes callable."
- "What leaves the privacy layer is just the capability card that the user approved."
- "That is why the endpoint can honestly say `Source: AirJelly Suggested, User Approved`."

## Claims to avoid
Do **not** say any of the following:
- "We export your AirJelly memory to HumanMCP."
- "We export raw AirJelly memory to HumanMCP."
- "We stream screenshots or app history into HumanMCP."
- "HumanMCP can inspect raw AirJelly context in the cloud."
- "The user is automatically converted into a tool."
- "Mock Mode is a different privacy model from live mode."

## Demo-safe Q&A
### Why is Mock Mode okay?
Because the sponsor story depends on the invitation/approval/privacy contract, not on live transport. Mock Mode keeps the same contract and avoids live integration risk during rehearsal.

### What exactly is exported?
Only the approved capability card: identifier, display name, short summary, approval state, and source attribution.

### What stays local?
Raw memories, screenshots, contacts, clipboard contents, private notes, detailed activity history, and any unapproved inferred labels.
