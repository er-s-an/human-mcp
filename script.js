(() => {
  const STALE_AFTER_MS = 5000;
  const POLL_INTERVAL_MS = 1500;
  const DEFAULT_FEED_URL = "./stage-state.json";
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
        snapshot.mode?.includes("mock") ? "Mock Mode" : "Connected",
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

  function normalizeSnapshot(rawSnapshot = {}) {
    const stage = STAGE_META[rawSnapshot.stage] ? rawSnapshot.stage : "idle";
    const meta = getStageMeta(stage);

    return {
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

    return [
      `Authority: Windows/OpenClaw is the single live stage-state writer (${feedState.label}).`,
      `Current goal: ${snapshot.currentGoal}`,
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
      return { kind, label: "LIVE", detail: detail || "Live feed healthy" };
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
