const facePatterns = {
  idle: [
    "...................",
    "..222.......222....",
    ".21112.....21112...",
    "..111.......111....",
    "...................",
    "...................",
    ".....22.....22.....",
    "......1111111......",
    ".....111...111.....",
    "....11.......11....",
    "...................",
    "...................",
  ],
  thinking: [
    "...................",
    "..22.........22....",
    ".2112.......2112...",
    "..111.......111....",
    "....2.........2....",
    "...................",
    "......22...22......",
    ".....111...111.....",
    "......1111111......",
    ".......11111.......",
    "......11...11......",
    "...................",
  ],
  calling: [
    ".2222.......2222...",
    "211112.....211112..",
    ".1111.......1111...",
    "...................",
    ".........2.........",
    ".....22.....22.....",
    "....11111111111....",
    ".....111...111.....",
    ".....11.....11.....",
    "...................",
    "..2.............2..",
    "...................",
  ],
  waiting: [
    "...................",
    "...222.......222...",
    "..21112.....21112..",
    "...111.......111...",
    "...................",
    "...................",
    "......22...22......",
    "......111.111......",
    ".....111...111.....",
    ".....11.....11.....",
    "...................",
    "...................",
  ],
  useful: [
    "...................",
    "..222.......222....",
    ".21112.....21112...",
    "..1112.....2111....",
    "...................",
    ".....11.....11.....",
    "....111.....111....",
    ".....111111111.....",
    "......1111111......",
    "....11.......11....",
    "...................",
    "...................",
  ],
  conflict: [
    "2.................2",
    ".2222..2...2..2222.",
    "2111....2.2....1112",
    ".1112...222...2111.",
    "......2.....2......",
    ".........2.........",
    "....22.......22....",
    ".....111...111.....",
    "......111.111......",
    "....11.......11....",
    "...................",
    "2.................2",
  ],
  complete: [
    "...................",
    "..222.......222....",
    ".21112.....21112...",
    "..1112.....2111....",
    "...................",
    "...22.........22...",
    "....11111111111....",
    "...1111111111111...",
    ".....111111111.....",
    "...11.........11...",
    "...................",
    "...................",
  ],
};

const baseTools = [
  "/ziven/viral_hook",
  "/lindsay/business_judgement",
  "/engineer/demo_risk",
  "/random/understand_test",
  "/human/final_judge",
];

const states = [
  {
    mood: "idle",
    label: "WAITING FOR GOAL",
    title: "AGI 加速核心待命",
    detail: "HumanMCP 已接入人类端点，AI 正在监听新的传播目标。",
    progress: 0,
    activeTool: -1,
    statuses: ["ready", "ready", "ready", "ready", "ready"],
    logs: [
      ["info", "SYSTEM", "HumanMCP live display initialized."],
      ["info", "TOOLBOX", "5 human endpoints online."],
    ],
  },
  {
    mood: "thinking",
    label: "THINKING",
    title: "解析任务：把 AI 的伟大翻译成人话",
    detail: "Router 正在拆分传播钩子、商业判断、demo 风险和路人理解测试。",
    progress: 18,
    activeTool: -1,
    statuses: ["ready", "ready", "ready", "ready", "ready"],
    logs: [
      ["info", "TASK", "NEW GOAL: publish a Xiaohongshu post about AI greatness."],
      ["info", "ROUTER", "Split into 4 human-callable subtasks."],
    ],
  },
  {
    mood: "calling",
    label: "CALLING HUMAN",
    title: "调用人类端点：验证传播钩子",
    detail: "AI 正在把第一轮判断交给 /ziven/viral_hook，筛掉没有传播力的表达。",
    progress: 36,
    activeTool: 0,
    statuses: ["calling", "ready", "ready", "ready", "ready"],
    logs: [
      ["call", "CALL", "/ziven/viral_hook"],
      ["info", "STATUS", "PENDING... latency target: 20s"],
    ],
  },
  {
    mood: "waiting",
    label: "WAITING RESPONSE",
    title: "等待回传：保持主链路运行",
    detail: "请求已发送到人类端点，AI 维持任务上下文并准备合并反馈。",
    progress: 52,
    activeTool: 1,
    statuses: ["done", "waiting", "ready", "ready", "ready"],
    logs: [
      ["done", "DONE", "/ziven/viral_hook completed, latency: 11s"],
      ["call", "CALL", "/lindsay/business_judgement"],
    ],
  },
  {
    mood: "useful",
    label: "USEFUL REPLY",
    title: "吸收反馈：重写成更锋利的表达",
    detail: "反馈可用度 82%，AI 正在强化标题冲突、具体场景和转发理由。",
    progress: 68,
    activeTool: 2,
    statuses: ["done", "done", "calling", "ready", "ready"],
    logs: [
      ["done", "VERDICT", "\"钩子太技术，需要更像人话。\""],
      ["call", "CALL", "/engineer/demo_risk"],
    ],
  },
  {
    mood: "conflict",
    label: "CONFLICT DETECTED",
    title: "观点冲突：压缩噪声，保留张力",
    detail: "creator 认为足够 viral，business_judgement 认为商业价值偏弱，AI 正在裁决取舍。",
    progress: 82,
    activeTool: 4,
    statuses: ["done", "conflict", "done", "done", "waiting"],
    logs: [
      ["warn", "CONFLICT", "/ziven: viral enough"],
      ["warn", "CONFLICT", "/lindsay: business value weak"],
      ["info", "AI", "Need human final judgement."],
    ],
  },
  {
    mood: "complete",
    label: "GOAL COMPLETE",
    title: "输出完成：小红书发布包就绪",
    detail: "AI 已汇总人类反馈，生成标题、正文、标签和发布节奏。",
    progress: 100,
    activeTool: -1,
    statuses: ["done", "done", "done", "done", "done"],
    logs: [
      ["done", "SUMMARY", "Title, body, tags and posting rhythm generated."],
      ["done", "GOAL", "Xiaohongshu promotion package ready."],
    ],
  },
];

const currentAction = document.querySelector("#currentAction");
const actionDetail = document.querySelector("#actionDetail");
const aiStateLabel = document.querySelector("#aiStateLabel");
const pixelFace = document.querySelector("#pixelFace");
const PROGRESS_CELL_COUNT = 24;
const progressCells = document.querySelector("#progressCells");
const progressValue = document.querySelector("#progressValue");
const toolboxList = document.querySelector("#toolboxList");
const logList = document.querySelector("#logList");
const taskCard = document.querySelector("#taskCard");
const runtime = document.querySelector("#runtime");
const onlineCount = document.querySelector("#onlineCount");
const footerToolCount = document.querySelector("#footerToolCount");

let index = 0;

function renderFace(mood) {
  pixelFace.className = `pixel-face ${mood}`;
  pixelFace.innerHTML = facePatterns[mood]
    .join("")
    .split("")
    .map((cell) => {
      if (cell === "1") return '<span class="pixel is-on"></span>';
      if (cell === "2") return '<span class="pixel is-accent"></span>';
      return '<span class="pixel"></span>';
    })
    .join("");
}

function renderToolbox(statuses, activeTool) {
  toolboxList.innerHTML = baseTools
    .map((tool, toolIndex) => {
      const status = statuses[toolIndex];
      const activeClass = activeTool === toolIndex ? " is-active" : "";
      return `
        <li class="tool-item${activeClass}">
          <span class="tool-name">${tool}</span>
          <span class="tool-status ${status}">${status.toUpperCase()}</span>
        </li>
      `;
    })
    .join("");
}

function renderProgress(progress) {
  const normalizedProgress = Math.max(0, Math.min(progress, 100));
  const activeCells = Math.round((normalizedProgress / 100) * PROGRESS_CELL_COUNT);
  progressCells.innerHTML = Array.from({ length: PROGRESS_CELL_COUNT }, (_, cellIndex) => {
    const isOn = cellIndex < activeCells ? " is-on" : "";
    return `<span class="progress-cell${isOn}"></span>`;
  }).join("");
  progressValue.textContent = `${normalizedProgress}%`;
}

function renderLogs(logs) {
  logList.innerHTML = logs
    .map(([type, label, text], logIndex) => {
      const cursorClass = logIndex === logs.length - 1 ? " cursor" : "";
      return `<div class="log-entry ${type}${cursorClass}"><strong>[${label}]</strong> ${text}</div>`;
    })
    .join("");
}

function setState(nextIndex) {
  const state = states[nextIndex];
  currentAction.textContent = state.title;
  actionDetail.textContent = state.detail;
  aiStateLabel.textContent = state.label;
  renderFace(state.mood);
  renderToolbox(state.statuses, state.activeTool);
  renderProgress(state.progress);
  renderLogs(state.logs);
  onlineCount.textContent = baseTools.length;
  footerToolCount.textContent = baseTools.length;
}

function showTaskCard() {
  taskCard.classList.remove("is-visible");
  void taskCard.offsetWidth;
  taskCard.classList.add("is-visible");
}

function tickClock() {
  runtime.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

setState(index);
showTaskCard();
tickClock();

setInterval(() => {
  index = (index + 1) % states.length;
  setState(index);
}, 3000);

setInterval(showTaskCard, 9000);
setInterval(tickClock, 1000);
