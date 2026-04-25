(() => {
  const STALE_AFTER_MS = 5000;
  const POLL_INTERVAL_MS = 1500;
  const DEFAULT_FEED_URL = "./stage-state.json";
  const SMART_ASSIGNMENT_POLICY =
    "Rank approved capability cards by skill match, availability, proofability, and demo safety.";
  const SMART_ASSIGNMENT_FALLBACK =
    "If routing fails, Surface B can choose manual_override or fallback_scripted while Mac remains read-only.";
  const STAGE_ORDER = [
    "idle",
    "auth_blocked",
    "no_humans",
    "assigned",
    "calling",
    "proof_pending",
    "verify_failed",
    "verified",
    "stamp_ready",
    "virtual_stamp",
    "manual_override",
    "stamped",
    "complete",
    "fallback_scripted",
  ];

  const STAGE_META = {
    idle: {
      tone: "idle",
      title: "Idle · Waiting for the next live task",
      description:
        "Surface A is online and waiting for Windows/OpenClaw to publish the next assignment.",
      nextAction:
        "Hold the stage. Wait for an operator or live assignment to arrive.",
    },
    auth_blocked: {
      tone: "warning",
      title: "Auth blocked · Controller cannot advance",
      description:
        "The Windows/OpenClaw controller is blocked on auth or env injection before it can call HumanMCP.",
      nextAction:
        "Fix token/base URL on Windows/OpenClaw, then retry the stage action.",
    },
    no_humans: {
      tone: "warning",
      title: "No humans online · No approved endpoint is callable",
      description:
        "HumanMCP has no approved humans or endpoints ready for this moment.",
      nextAction:
        "Seed a demo human or approve a capability card before continuing.",
    },
    assigned: {
      tone: "active",
      title: "Assigned · Goal and endpoint have been selected",
      description:
        "The controller has assigned the current task and is preparing the active endpoint call.",
      nextAction: "Confirm the human endpoint and move into the live call.",
    },
    calling: {
      tone: "active",
      title: "Calling · Human endpoint is live",
      description:
        "Windows/OpenClaw is actively driving a HumanMCP invocation and waiting for response.",
      nextAction:
        "Keep Surface A focused on the active endpoint until proof or reply arrives.",
    },
    proof_pending: {
      tone: "pending",
      title: "Proof pending · Waiting for verify decision",
      description:
        "Proof exists but still needs a verify decision before the stage can stamp or advance.",
      nextAction:
        "Review the proof on Windows/OpenClaw and verify or reject it.",
    },
    verify_failed: {
      tone: "danger",
      title: "Verify failed · Evidence did not pass",
      description:
        "The submitted proof failed verification and the controller is waiting on a recovery path.",
      nextAction:
        "Explain the failure, request a retry, or switch to manual operator recovery.",
    },
    verified: {
      tone: "success",
      title: "Verified · Proof accepted",
      description:
        "Verification passed and the system can advance to stamp orchestration or celebration.",
      nextAction:
        "Prime the stamp branch and prepare the visible stage reaction.",
    },
    stamp_ready: {
      tone: "success",
      title: "Stamp ready · Robot or fallback branch armed",
      description:
        "The proof is verified and Windows/OpenClaw is ready to stamp or reconcile.",
      nextAction: "Trigger the physical, virtual, or manual stamp path.",
    },
    virtual_stamp: {
      tone: "pending",
      title: "Virtual stamp · Hardware fallback in use",
      description:
        "The controller is using the virtual/manual stamp branch while keeping the stage story intact.",
      nextAction:
        "Complete the virtual stamp and sync the stage outcome back to the audience.",
    },
    manual_override: {
      tone: "warning",
      title: "Manual override · Operator is steering",
      description:
        "An operator has stepped in to keep the demo safe while preserving the stage story.",
      nextAction:
        "Follow the operator script and reconcile state before resuming automation.",
    },
    stamped: {
      tone: "success",
      title: "Stamped · Reward branch completed",
      description:
        "The stamp/reward branch has completed and Surface A can hold the success context.",
      nextAction:
        "Hold celebration state, then prepare for the next participant or scene.",
    },
    complete: {
      tone: "success",
      title: "Complete · Demo loop closed",
      description:
        "Registration, proof, verify, and stage reaction have all completed successfully.",
      nextAction:
        "Reset or start the next scripted task when the operator is ready.",
    },
    fallback_scripted: {
      tone: "fallback",
      title: "Fallback scripted · Operator sync mode",
      description:
        "The Mac surface lost the Windows feed and switched to a scripted holding pattern.",
      nextAction:
        "Keep Surface B authoritative and use the scripted Mac cues until feed returns.",
    },
  };

  const EMBEDDED_SNAPSHOT = {
    stage: "proof_pending",
    humanName: "Lindsay",
    endpoint: "/lindsay/business_judgement",
    taskId: "task-demo-014",
    subtaskId: "subtask-02",
    proofId: "proof-117",
    verified: false,
    level: "L2",
    rewardDelta: "+5",
    stampStatus: "awaiting_verification",
    message:
      "Lindsay submitted judgement notes. Waiting for operator verify on Windows/OpenClaw.",
    updatedAt: "2026-04-24T10:58:40.000Z",
    mode: "preview_bootstrap",
    currentGoal:
      "Turn AirJelly capability discovery into a stage-safe verified HumanMCP call.",
    nextAction:
      "Review the submitted proof on Windows and verify once evidence is clearly visible.",
    proofState: "submitted",
    verifyState: "pending",
    airjelly: {
      source: "AirJelly Suggested, User Approved",
      adapterMode: "Mock Mode",
      capability: "/lindsay/business_judgement",
      approvalStatus: "approved",
      privacy:
        "No raw AirJelly memories or private context leave the local broker.",
    },
    smartAssignment: {
      status: "proof_wait",
      selectedHuman: "Lindsay",
      selectedEndpoint: "/lindsay/business_judgement",
      rationale:
        "Matched business-judgement skill, approved AirJelly capability card, and live demo availability.",
      confidence: 0.92,
      policy: SMART_ASSIGNMENT_POLICY,
      fallback:
        "If Lindsay is unavailable, Surface B can route to Operator manual_override without changing Surface A authority.",
      candidates: [
        {
          name: "Lindsay",
          endpoint: "/lindsay/business_judgement",
          score: 0.92,
          status: "selected",
        },
        {
          name: "Operator",
          endpoint: "manual_override",
          score: "fallback",
          status: "fallback",
        },
      ],
    },
  };

  function resolveFeedUrl(locationLike = globalThis.location) {
    const params = new URLSearchParams(locationLike?.search || "");
    const explicitFeed =
      params.get("feed") || globalThis.HUMANMCP_STAGE_STATE_URL || "";

    if (explicitFeed) {
      return explicitFeed;
    }

    return DEFAULT_FEED_URL;
  }

  function formatStampStatus(value) {
    if (!value) {
      return "stamp idle";
    }

    return String(value).replace(/[_-]+/g, " ");
  }

  function toDisplayText(value, fallback = "—") {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    return String(value);
  }

  function formatConfidence(value) {
    if (value === undefined || value === null || value === "") {
      return "—";
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      const normalized = value <= 1 ? value * 100 : value;
      return `${Math.round(normalized)}%`;
    }

    return String(value);
  }

  function escapeHtml(value) {
    return toDisplayText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getStageMeta(stage) {
    return STAGE_META[stage] || STAGE_META.idle;
  }

  function deriveProofState(snapshot) {
    if (snapshot.proofState) {
      return snapshot.proofState;
    }

    if (snapshot.stage === "verify_failed") {
      return "rejected";
    }

    if (snapshot.verified) {
      return "accepted";
    }

    if (snapshot.proofId) {
      return "submitted";
    }

    return "pending";
  }

  function deriveVerifyState(snapshot) {
    if (snapshot.verifyState) {
      return snapshot.verifyState;
    }

    if (snapshot.stage === "verify_failed") {
      return "failed";
    }

    if (snapshot.verified) {
      return "passed";
    }

    if (snapshot.proofId) {
      return "pending";
    }

    return "waiting";
  }

  function normalizeAirJelly(snapshot) {
    const airjelly = snapshot.airjelly || {};

    return {
      source: toDisplayText(
        airjelly.source,
        "AirJelly Suggested, User Approved",
      ),
      adapterMode: toDisplayText(
        airjelly.adapterMode,
        "Mock Mode",
      ),
      capability: toDisplayText(
        airjelly.capability,
        snapshot.endpoint || "Capability waiting for approval",
      ),
      approvalStatus: toDisplayText(
        airjelly.approvalStatus,
        snapshot.endpoint ? "approved" : "pending",
      ),
      privacy: toDisplayText(
        airjelly.privacy,
        "No raw AirJelly memories, screenshots, app usage, or contacts leave the local layer.",
      ),
    };
  }

  function deriveSmartAssignmentStatus(stage) {
    if (stage === "auth_blocked") {
      return "blocked_auth";
    }

    if (stage === "no_humans") {
      return "no_candidate";
    }

    if (stage === "assigned") {
      return "selected";
    }

    if (stage === "calling") {
      return "dispatching";
    }

    if (stage === "proof_pending") {
      return "proof_wait";
    }

    if (stage === "verify_failed") {
      return "needs_retry";
    }

    if (
      stage === "verified" ||
      stage === "stamp_ready" ||
      stage === "virtual_stamp" ||
      stage === "stamped" ||
      stage === "complete"
    ) {
      return "completed";
    }

    if (stage === "manual_override" || stage === "fallback_scripted") {
      return "operator_sync";
    }

    return "waiting";
  }

  function defaultAssignmentRationale(stage) {
    if (stage === "auth_blocked") {
      return "Assignment is paused until the Windows/OpenClaw auth and API base URL are fixed.";
    }

    if (stage === "no_humans") {
      return "No approved human/capability is currently online, so assignment must wait or fall back to operator control.";
    }

    if (stage === "manual_override" || stage === "fallback_scripted") {
      return "Operator owns the recovery path while Surface A keeps the audience narrative synchronized.";
    }

    if (stage === "idle") {
      return "Waiting for Windows/OpenClaw to rank approved capability cards and publish the next assignment.";
    }

    return "Matched skill intent, approved AirJelly capability source, live availability, proofability, and stage safety.";
  }

  function normalizeCandidates(rawCandidates, selectedHuman, selectedEndpoint, active) {
    const sourceCandidates = Array.isArray(rawCandidates) && rawCandidates.length
      ? rawCandidates
      : [
          {
            name: selectedHuman,
            endpoint: selectedEndpoint,
            score: active ? 0.92 : 0,
            status: active ? "selected" : "waiting",
          },
          {
            name: "Operator",
            endpoint: "manual_override",
            score: "fallback",
            status: "fallback",
          },
        ];
    const seen = new Set();
    const candidates = [];

    for (const candidate of sourceCandidates) {
      const name = toDisplayText(candidate.name, `Candidate ${candidates.length + 1}`);
      const endpoint = toDisplayText(candidate.endpoint, "No endpoint");
      const key = `${name}::${endpoint}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push({ ...candidate, name, endpoint });
    }

    return candidates.slice(0, 4).map((candidate, index) => ({
      name: candidate.name,
      endpoint: candidate.endpoint,
      score: formatConfidence(candidate.score),
      status: toDisplayText(candidate.status, index === 0 ? "selected" : "backup"),
    }));
  }

  function normalizeSmartAssignment(rawSnapshot, baseSnapshot) {
    const smartAssignment =
      rawSnapshot.smartAssignment || rawSnapshot.smart_assignment || {};
    const active = ![
      "idle",
      "auth_blocked",
      "no_humans",
      "fallback_scripted",
    ].includes(baseSnapshot.stage);
    const selectedHuman = toDisplayText(
      smartAssignment.selectedHuman || smartAssignment.humanName,
      baseSnapshot.stage === "no_humans"
        ? "No eligible human"
        : baseSnapshot.humanName,
    );
    const selectedEndpoint = toDisplayText(
      smartAssignment.selectedEndpoint ||
        smartAssignment.endpoint ||
        rawSnapshot.endpoint,
      baseSnapshot.stage === "no_humans"
        ? "No callable endpoint"
        : "Awaiting endpoint",
    );

    return {
      status: toDisplayText(
        smartAssignment.status,
        deriveSmartAssignmentStatus(baseSnapshot.stage),
      ),
      selectedHuman,
      selectedEndpoint,
      selectedLabel:
        selectedEndpoint === "Awaiting endpoint"
          ? selectedHuman
          : `${selectedHuman} · ${selectedEndpoint}`,
      rationale: toDisplayText(
        smartAssignment.rationale || smartAssignment.reason,
        defaultAssignmentRationale(baseSnapshot.stage),
      ),
      confidence: formatConfidence(
        smartAssignment.confidence ?? (active ? 0.92 : undefined),
      ),
      policy: toDisplayText(
        smartAssignment.policy,
        `${SMART_ASSIGNMENT_POLICY} Surface A mirrors only.`,
      ),
      fallback: toDisplayText(
        smartAssignment.fallback,
        `Fallback: ${SMART_ASSIGNMENT_FALLBACK}`,
      ),
      candidates: normalizeCandidates(
        smartAssignment.candidates,
        selectedHuman,
        selectedEndpoint,
        active,
      ),
    };
  }

  function normalizeSnapshot(rawSnapshot = {}) {
    const stage = STAGE_META[rawSnapshot.stage] ? rawSnapshot.stage : "idle";
    const meta = getStageMeta(stage);
    const baseSnapshot = {
      stage,
      humanName: toDisplayText(
        rawSnapshot.humanName,
        stage === "no_humans"
          ? "No approved human online"
          : "Awaiting active human",
      ),
      endpoint: toDisplayText(
        rawSnapshot.endpoint,
        stage === "no_humans" ? "No callable endpoint" : "No active endpoint",
      ),
      taskId: toDisplayText(rawSnapshot.taskId),
      subtaskId: toDisplayText(rawSnapshot.subtaskId),
      proofId: toDisplayText(rawSnapshot.proofId),
      verified: Boolean(rawSnapshot.verified),
      level: toDisplayText(rawSnapshot.level),
      rewardDelta: toDisplayText(rawSnapshot.rewardDelta, "0"),
      stampStatus: formatStampStatus(rawSnapshot.stampStatus),
      message: toDisplayText(rawSnapshot.message, meta.description),
      updatedAt: rawSnapshot.updatedAt || new Date().toISOString(),
      mode: toDisplayText(rawSnapshot.mode, "live_feed"),
      currentGoal: toDisplayText(
        rawSnapshot.currentGoal,
        "Waiting for the current goal from the controller snapshot.",
      ),
      nextAction: toDisplayText(rawSnapshot.nextAction, meta.nextAction),
      proofState: deriveProofState(rawSnapshot),
      verifyState: deriveVerifyState(rawSnapshot),
      airjelly: normalizeAirJelly(rawSnapshot),
    };

    return {
      ...baseSnapshot,
      smartAssignment: normalizeSmartAssignment(rawSnapshot, baseSnapshot),
    };
  }

  function buildFallbackSnapshot(lastSnapshot, now = new Date()) {
    const base = normalizeSnapshot(lastSnapshot || EMBEDDED_SNAPSHOT);

    return {
      ...base,
      stage: "fallback_scripted",
      mode: "operator_sync_mode",
      message:
        "Windows/OpenClaw feed unavailable for more than 5 seconds. Surface B remains authoritative.",
      nextAction:
        "Use scripted operator cues on Mac while Windows/OpenClaw continues the live demo.",
      updatedAt: now.toISOString(),
    };
  }

  function buildActivityList(snapshot, feedState) {
    const adapterSummary =
      snapshot.airjelly.adapterMode === "Mock Mode"
        ? "AirJelly Adapter: Mock Mode"
        : `AirJelly Adapter: ${snapshot.airjelly.adapterMode}`;
    const assignment = snapshot.smartAssignment;

    return [
      `Authority: Windows/OpenClaw is the single live stage-state writer (${feedState.label}).`,
      `Current goal: ${snapshot.currentGoal}`,
      `Smart assignment: ${assignment.selectedLabel}; rationale: ${assignment.rationale}`,
      `Active endpoint: ${snapshot.endpoint} · human: ${snapshot.humanName}`,
      `Proof ${snapshot.proofId}: ${snapshot.proofState}; verify: ${snapshot.verifyState}; stamped: ${snapshot.stampStatus}.`,
      `AirJelly source: ${snapshot.airjelly.source} · ${adapterSummary}.`,
      `Next action: ${snapshot.nextAction}`,
    ];
  }

  function formatTimestamp(value) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return toDisplayText(value, "Unknown update time");
    }

    return parsed.toLocaleString("zh-CN", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function createFeedState(kind, detail) {
    if (kind === "live") {
      return {
        kind,
        label: "CONNECTED",
        detail: detail || "Controller feed healthy",
      };
    }

    if (kind === "degraded") {
      return {
        kind,
        label: "DEGRADED",
        detail: detail || "Holding last good snapshot",
      };
    }

    if (kind === "fallback") {
      return {
        kind,
        label: "FALLBACK_SCRIPTED",
        detail: detail || "Operator sync mode engaged",
      };
    }

    return {
      kind: "connecting",
      label: "CONNECTING",
      detail: detail || "Waiting for first controller snapshot",
    };
  }

  function deriveViewModel(snapshot, feedState, feedUrl) {
    const meta = getStageMeta(snapshot.stage);
    const activity = buildActivityList(snapshot, feedState);

    return {
      tone: meta.tone,
      stageBadge: snapshot.stage.toUpperCase(),
      stageTitle: meta.title,
      stageDescription: snapshot.message || meta.description,
      updatedAtLabel: `Updated ${formatTimestamp(snapshot.updatedAt)}`,
      currentGoal: snapshot.currentGoal,
      nextAction: snapshot.nextAction || meta.nextAction,
      showOperatorBanner:
        snapshot.stage === "fallback_scripted" || feedState.kind === "fallback",
      feedLabel: feedState.label,
      feedDetail: feedState.detail,
      feedUrl: feedUrl || "embedded preview / awaiting explicit feed",
      mode: snapshot.mode,
      message: snapshot.message,
      humanName: snapshot.humanName,
      endpoint: snapshot.endpoint,
      taskId: snapshot.taskId,
      subtaskId: snapshot.subtaskId,
      assignmentState: snapshot.smartAssignment.status,
      assignmentSelected: snapshot.smartAssignment.selectedLabel,
      assignmentRationale: snapshot.smartAssignment.rationale,
      assignmentConfidence: snapshot.smartAssignment.confidence,
      assignmentPolicy: snapshot.smartAssignment.policy,
      assignmentFallback: snapshot.smartAssignment.fallback,
      assignmentCandidates: snapshot.smartAssignment.candidates,
      sourceLabel: snapshot.airjelly.source,
      capability: snapshot.airjelly.capability,
      adapterMode: snapshot.airjelly.adapterMode,
      approvalStatus: snapshot.airjelly.approvalStatus,
      privacy: snapshot.airjelly.privacy,
      proofState: snapshot.proofState,
      verifyState: snapshot.verifyState,
      stampStatus: snapshot.stampStatus,
      proofId: snapshot.proofId,
      verified: snapshot.verified ? "true" : "false",
      level: snapshot.level,
      rewardDelta: snapshot.rewardDelta,
      activity,
      stage: snapshot.stage,
    };
  }

  const api = {
    STAGE_ORDER,
    STAGE_META,
    EMBEDDED_SNAPSHOT,
    resolveFeedUrl,
    normalizeSnapshot,
    buildFallbackSnapshot,
    deriveViewModel,
    createFeedState,
  };

  globalThis.__humanMcpMacContext = api;

  if (typeof document === "undefined") {
    return;
  }

  const elements = {
    authorityLabel: document.querySelector("#authorityLabel"),
    feedStatusLabel: document.querySelector("#feedStatusLabel"),
    clock: document.querySelector("#clock"),
    updatedAtLabel: document.querySelector("#updatedAtLabel"),
    stageBadge: document.querySelector("#stageBadge"),
    stageTitle: document.querySelector("#stageTitle"),
    stageDescription: document.querySelector("#stageDescription"),
    currentGoal: document.querySelector("#currentGoal"),
    nextAction: document.querySelector("#nextAction"),
    operatorBanner: document.querySelector("#operatorBanner"),
    stageRail: document.querySelector("#stageRail"),
    feedUrlValue: document.querySelector("#feedUrlValue"),
    modeValue: document.querySelector("#modeValue"),
    messageValue: document.querySelector("#messageValue"),
    humanNameValue: document.querySelector("#humanNameValue"),
    endpointValue: document.querySelector("#endpointValue"),
    taskIdValue: document.querySelector("#taskIdValue"),
    subtaskIdValue: document.querySelector("#subtaskIdValue"),
    assignmentStateValue: document.querySelector("#assignmentStateValue"),
    assignmentSelectedValue: document.querySelector("#assignmentSelectedValue"),
    assignmentRationaleValue: document.querySelector("#assignmentRationaleValue"),
    assignmentConfidenceValue: document.querySelector(
      "#assignmentConfidenceValue",
    ),
    assignmentPolicyValue: document.querySelector("#assignmentPolicyValue"),
    assignmentFallbackValue: document.querySelector("#assignmentFallbackValue"),
    candidateListValue: document.querySelector("#candidateListValue"),
    sourceLabelValue: document.querySelector("#sourceLabelValue"),
    capabilityValue: document.querySelector("#capabilityValue"),
    adapterModeValue: document.querySelector("#adapterModeValue"),
    approvalStatusValue: document.querySelector("#approvalStatusValue"),
    privacyValue: document.querySelector("#privacyValue"),
    proofStateValue: document.querySelector("#proofStateValue"),
    verifyStateValue: document.querySelector("#verifyStateValue"),
    stampStatusValue: document.querySelector("#stampStatusValue"),
    proofIdValue: document.querySelector("#proofIdValue"),
    verifiedValue: document.querySelector("#verifiedValue"),
    levelValue: document.querySelector("#levelValue"),
    rewardValue: document.querySelector("#rewardValue"),
    activityList: document.querySelector("#activityList"),
    controlFeedback: document.querySelector("#controlFeedback"),
    controlButtons: document.querySelectorAll("[data-demo-action]"),
    shell: document.querySelector(".context-shell"),
  };

  const feedUrl = resolveFeedUrl();
  const bootstrapSnapshot = normalizeSnapshot(EMBEDDED_SNAPSHOT);
  const sessionStartedAt = Date.now();
  let lastSuccessfulFetchAt = 0;
  let lastLiveSnapshot = null;

  function renderStageRail(currentStage) {
    elements.stageRail.innerHTML = STAGE_ORDER.map((stage) => {
      const isActive = stage === currentStage ? " is-active" : "";
      return `<span class="rail-chip${isActive}">${stage}</span>`;
    }).join("");
  }

  function render(viewModel) {
    elements.shell.dataset.tone = viewModel.tone;
    elements.authorityLabel.textContent = "Windows/OpenClaw";
    elements.feedStatusLabel.textContent = viewModel.feedLabel;
    elements.updatedAtLabel.textContent = viewModel.updatedAtLabel;
    elements.stageBadge.textContent = viewModel.stageBadge;
    elements.stageTitle.textContent = viewModel.stageTitle;
    elements.stageDescription.textContent = viewModel.stageDescription;
    elements.currentGoal.textContent = viewModel.currentGoal;
    elements.nextAction.textContent = viewModel.nextAction;
    elements.feedUrlValue.textContent = viewModel.feedUrl;
    elements.modeValue.textContent = viewModel.mode;
    elements.messageValue.textContent = viewModel.message;
    elements.humanNameValue.textContent = viewModel.humanName;
    elements.endpointValue.textContent = viewModel.endpoint;
    elements.taskIdValue.textContent = viewModel.taskId;
    elements.subtaskIdValue.textContent = viewModel.subtaskId;
    elements.assignmentStateValue.textContent = viewModel.assignmentState;
    elements.assignmentSelectedValue.textContent = viewModel.assignmentSelected;
    elements.assignmentRationaleValue.textContent =
      viewModel.assignmentRationale;
    elements.assignmentConfidenceValue.textContent =
      viewModel.assignmentConfidence;
    elements.assignmentPolicyValue.textContent = viewModel.assignmentPolicy;
    elements.assignmentFallbackValue.textContent = viewModel.assignmentFallback;
    elements.candidateListValue.innerHTML = viewModel.assignmentCandidates
      .map(
        (candidate) =>
          `<li><strong>${escapeHtml(candidate.name)}</strong><span>${escapeHtml(
            candidate.endpoint,
          )}</span><em>${escapeHtml(candidate.score)} · ${escapeHtml(
            candidate.status,
          )}</em></li>`,
      )
      .join("");
    elements.sourceLabelValue.textContent = viewModel.sourceLabel;
    elements.capabilityValue.textContent = viewModel.capability;
    elements.adapterModeValue.textContent = viewModel.adapterMode;
    elements.approvalStatusValue.textContent = viewModel.approvalStatus;
    elements.privacyValue.textContent = viewModel.privacy;
    elements.proofStateValue.textContent = viewModel.proofState;
    elements.verifyStateValue.textContent = viewModel.verifyState;
    elements.stampStatusValue.textContent = viewModel.stampStatus;
    elements.proofIdValue.textContent = viewModel.proofId;
    elements.verifiedValue.textContent = viewModel.verified;
    elements.levelValue.textContent = viewModel.level;
    elements.rewardValue.textContent = viewModel.rewardDelta;
    elements.activityList.innerHTML = viewModel.activity
      .map((item) => `<li>${item}</li>`)
      .join("");
    elements.operatorBanner.hidden = !viewModel.showOperatorBanner;
    renderStageRail(viewModel.stage);
  }

  function feedUrlObject() {
    try {
      return new URL(feedUrl, globalThis.location?.href || "http://127.0.0.1/");
    } catch {
      return null;
    }
  }

  function rehearsalUrl(pathname) {
    const url = feedUrlObject();

    if (!url) {
      return null;
    }

    url.pathname = pathname;
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  function setControlFeedback(message) {
    if (elements.controlFeedback) {
      elements.controlFeedback.textContent = message;
    }
  }

  async function copyFeedUrl() {
    const resolvedFeed = feedUrlObject()?.toString() || feedUrl;

    try {
      await navigator.clipboard.writeText(resolvedFeed);
      setControlFeedback(`Copied feed URL: ${resolvedFeed}`);
    } catch {
      setControlFeedback(`Feed URL: ${resolvedFeed}`);
    }
  }

  function openRehearsalStatus() {
    const statusUrl = rehearsalUrl("/humanmcp/rehearsal/status");

    if (!statusUrl) {
      setControlFeedback("No rehearsal status URL is available for this feed.");
      return;
    }

    globalThis.open(statusUrl, "_blank", "noopener,noreferrer");
    setControlFeedback(`Opened rehearsal status: ${statusUrl}`);
  }

  async function postRehearsal(pathname, body) {
    const target = rehearsalUrl(pathname);

    if (!target) {
      throw new Error("No rehearsal endpoint is available for this feed.");
    }

    const response = await fetch(target, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  async function runDemoAction(action) {
    if (action === "copy-feed") {
      await copyFeedUrl();
      return;
    }

    if (action === "open-status") {
      openRehearsalStatus();
      return;
    }

    try {
      if (action === "next-rehearsal") {
        const result = await postRehearsal("/humanmcp/rehearsal/next");
        setControlFeedback(
          `Advanced ${result.activeScenario} to step ${result.activeIndex}.`,
        );
        await pollFeed();
        return;
      }

      if (action === "show-fallback") {
        const result = await postRehearsal("/humanmcp/rehearsal/set", {
          scenario: "fallbackPath",
          index: 3,
        });
        setControlFeedback(
          `Fallback cue ready: ${result.current?.stage || "fallback_scripted"} · operator sync mode.`,
        );
        await pollFeed();
      }
    } catch (error) {
      setControlFeedback(
        `Rehearsal shortcut unavailable on this feed: ${String(
          error.message || error,
        )}`,
      );
    }
  }

  elements.controlButtons.forEach((button) => {
    button.addEventListener("click", () => {
      runDemoAction(button.dataset.demoAction);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const actionByKey = {
      c: "copy-feed",
      s: "open-status",
      n: "next-rehearsal",
      f: "show-fallback",
    };
    const action = actionByKey[event.key.toLowerCase()];

    if (action) {
      event.preventDefault();
      runDemoAction(action);
    }
  });

  async function pollFeed() {
    if (!feedUrl) {
      const connectingState = createFeedState(
        "connecting",
        "No explicit feed configured; showing embedded preview.",
      );
      render(deriveViewModel(bootstrapSnapshot, connectingState, feedUrl));
      return;
    }

    try {
      const response = await fetch(feedUrl, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rawSnapshot = await response.json();
      const snapshot = normalizeSnapshot(rawSnapshot);
      lastLiveSnapshot = snapshot;
      lastSuccessfulFetchAt = Date.now();

      render(
        deriveViewModel(
          snapshot,
          createFeedState("live", "Windows/OpenClaw feed healthy."),
          feedUrl,
        ),
      );
    } catch (error) {
      const elapsedSinceHealthy =
        Date.now() - Math.max(lastSuccessfulFetchAt || 0, sessionStartedAt);

      if (elapsedSinceHealthy >= STALE_AFTER_MS) {
        const fallbackSnapshot = buildFallbackSnapshot(
          lastLiveSnapshot || bootstrapSnapshot,
        );
        render(
          deriveViewModel(
            fallbackSnapshot,
            createFeedState("fallback", String(error.message || error)),
            feedUrl,
          ),
        );
        return;
      }

      const heldSnapshot = lastLiveSnapshot || bootstrapSnapshot;
      render(
        deriveViewModel(
          heldSnapshot,
          createFeedState("degraded", String(error.message || error)),
          feedUrl,
        ),
      );
    }
  }

  function tickClock() {
    elements.clock.textContent = new Date().toLocaleTimeString("zh-CN", {
      hour12: false,
    });
  }

  tickClock();
  render(
    deriveViewModel(bootstrapSnapshot, createFeedState("connecting"), feedUrl),
  );
  pollFeed();

  setInterval(tickClock, 1000);
  setInterval(pollFeed, POLL_INTERVAL_MS);
})();
