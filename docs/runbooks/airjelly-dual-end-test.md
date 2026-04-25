# AirJelly Dual-End Test Runbook

目标：把“你的 AirJelly 识别到需要人类判断”推进到“双端可测试”：

```text
你的电脑 AirJelly / HumanMCP coordinator
-> 另一台电脑 inbox/notifier
-> 对方收到 AirJelly 小水母优先通知或系统通知
-> 对方打开 HumanMCP Task Packet Preview
-> 对方答题
-> 你的 stage-state 看到 proof/complete 状态
```

## 当前边界

- AirJelly 不直接跨电脑通信。
- 你的电脑运行 HumanMCP dual-end coordinator，负责任务、inbox、stage-state。
- coordinator 默认发布 `source=windows-openclaw`，这样能接入现有 Surface A 远端 feed 校验；真实桥接来源记录在 `bridgeSource=humanmcp-dual-end-coordinator`。
- 另一台电脑运行 inbox notifier，优先尝试本机 AirJelly notification RPC。
- 如果另一台电脑没有 AirJelly 或 AirJelly 没有通知 RPC，notifier 会退到 macOS 系统通知和浏览器 inbox。
- 既然当前 AirJelly SDK/CLI 暴露了 `createTask`，P3 联调推荐开启 `--create-airjelly-task`，让 HumanMCP 问题进入对方 AirJelly task 系统。
- 这个 runbook 是 P1 双端桥接测试，不是最终生产 OpenCloud coordinator。

## 另一台电脑需要做什么

1. 和你的电脑在同一个局域网，能访问你的电脑 IP 和端口 `4180`。
2. 安装 Node.js 18+。
3. 可选但推荐：安装并启动 AirJelly，让本机存在：

```text
~/Library/Application Support/AirJelly/runtime.json
```

4. 拿到你的 coordinator URL，例如：

```text
http://192.168.x.x:4180
```

5. 在另一台电脑运行 notifier。P3 推荐模式：

```bash
node scripts/humanmcp_airjelly_inbox_notifier.mjs \
  --coordinator http://192.168.x.x:4180 \
  --human-id lindsay \
  --open \
  --create-airjelly-task
```

安全回退模式是不写入 AirJelly task，只用系统通知和浏览器：

```bash
node scripts/humanmcp_airjelly_inbox_notifier.mjs \
  --coordinator http://192.168.x.x:4180 \
  --human-id lindsay \
  --open
```

注意：AirJelly 官方文档标注 `createTask` 会消耗 embedding credit。现在你已接受这个成本，所以 P3 推荐打开；如果只是安全 smoke test，可先不用。

如果另一台电脑没有这份 repo，把 `scripts/humanmcp_airjelly_inbox_notifier.mjs` 单文件拷过去即可；它没有 npm 依赖。

## 你的电脑启动 coordinator

推荐稳定模式：明天测试前固定一个 token，两台电脑都用同一个 token。这样不用依赖 `--allow-unauthenticated-lan`，也能避免同一局域网其他人写入任务。

```bash
export HUMANMCP_BRIDGE_TOKEN="change-this-demo-token"
node scripts/humanmcp_dual_end_coordinator.mjs --host 0.0.0.0 --port 4180
```

黑客松现场临时无 token 模式只作为回退：

```bash
node scripts/humanmcp_dual_end_coordinator.mjs --host 0.0.0.0 --port 4180 --allow-unauthenticated-lan
```

启动后记录终端输出里的 LAN URL，例如：

```text
LAN: http://192.168.x.x:4180
```

coordinator 默认会把状态保存到 `.omx/state/humanmcp-dual-end-4180.json`，所以重启后不会丢当前 `assignmentId` / `proofId` / stage-state。需要换位置时可加：

```bash
node scripts/humanmcp_dual_end_coordinator.mjs \
  --host 0.0.0.0 \
  --port 4180 \
  --state-file /tmp/humanmcp-dual-end.json
```

Surface A 可打开：

```text
http://127.0.0.1:4174/?feed=http://127.0.0.1:4180/humanmcp/stage-state
```

## 发一道题给另一台电脑

在你的电脑执行：

```bash
curl -X POST http://127.0.0.1:4180/humanmcp/tasks/seed
```

或者自定义问题：

```bash
curl -X POST http://127.0.0.1:4180/humanmcp/tasks \
  -H 'Content-Type: application/json' \
  --data '{
    "humanId": "lindsay",
    "humanName": "Lindsay",
    "endpoint": "/lindsay/business_judgement",
    "question": "Can you understand this product in 10 seconds, and would you click Join Waitlist?"
  }'
```

## 从本机 AirJelly 意图自动发题

如果你想演示“我的本机 AirJelly 识别到当前需要人类判断，然后自动把问题推给另一台电脑”，用 intent dispatcher：

```bash
node scripts/humanmcp_airjelly_intent_dispatcher.mjs \
  --coordinator http://127.0.0.1:4180 \
  --intent "我想知道 HumanMCP + AirJelly 这个黑客松 demo 10 秒内能不能被理解，用户会不会点 Join Waitlist，最大困惑是什么"
```

它会读取本机 AirJelly runtime，只导出：

- 用户意图摘要
- intent 类型，例如 `product_clarity`
- AirJelly task/memory 的 overlap 计数
- P1 级别 Task Packet

它不会导出 raw AirJelly memory、截图、私信、credentials、完整 app usage history。

先预览不发送：

```bash
node scripts/humanmcp_airjelly_intent_dispatcher.mjs \
  --dry-run \
  --intent "我想知道这个 demo 是否足够清楚"
```

如果另一台电脑 notifier 带了 `--ask-before-open --create-airjelly-task`，对方会先看到接题小窗，接受后再打开紧凑答题页。

## 对方 AirJelly 本地画像标签

如果要演示“另一台电脑的 AirJelly 根据那个人的用户画像，给自己生成一个适合接题的标签”，让对方 notifier 加 `--profile-tag`：

```bash
node scripts/humanmcp_airjelly_inbox_notifier.mjs \
  --coordinator http://192.168.x.x:4180 \
  --human-id lindsay \
  --open \
  --create-airjelly-task \
  --ask-before-open \
  --profile-tag
```

对方电脑本地会读取 AirJelly 的：

- `listMemories`，限定 `profile, preference, entity, case, procedure`
- `listPersons`
- `listOpenTasks`
- `getDailyAppUsage`

然后只生成粗粒度标签，例如：

- `product-feedback`
- `technical-review`
- `founder-operator`
- `ux-clarity`
- `research-synthesis`

主机 coordinator 只收到：

- `primaryTag`
- top tags 和分数
- evidence counts，例如 memory 数、open task 数、AirJelly method 数
- privacy statement

主机不会收到 raw AirJelly memories、截图、私信、people graph 原文、task text、完整 app usage。

预期结果：

- 另一台电脑收到 AirJelly notification 或 macOS notification。
- 如果 notifier 加了 `--open`，浏览器会打开 `/humanmcp/tasks/<task_id>`。
- 页面展示 Task Packet Preview、Human will see、Human will NOT see、Privacy Budget。
- 对方提交答案后，你的 stage-state 进入 `proof_pending`。

## 完成验证

你的电脑查看 stage-state：

```bash
curl http://127.0.0.1:4180/humanmcp/stage-state
```

如果对方已经答题，继续推进验证和完成：

```bash
curl -X POST http://127.0.0.1:4180/humanmcp/tasks/<task_id>/verify
curl -X POST http://127.0.0.1:4180/humanmcp/tasks/<task_id>/complete
```

最终预期：

- `stage=complete`
- `stampStatus=virtual_done`
- `assignmentId` 非空
- `proofId` 非空
- `airjelly.source=AirJelly Suggested, User Approved`
- `smartAssignment.taskPacket` 仍然只包含最小任务包，不包含 raw AirJelly memory

本机回归验收：

```bash
node scripts/hackathon_airjelly_status.mjs
node verification/check-dual-end-flow.mjs
node verification/check-demo-readiness.mjs --strict --remote-feed http://127.0.0.1:4180/humanmcp/stage-state
```

`check-dual-end-flow.mjs` 会启动临时 coordinator，模拟 helper 端完成 `seed -> inbox -> seen -> answer -> verify -> complete`，并确认重复 answer/verify 不会生成新的 `proofId`。
它还会重启临时 coordinator，确认最终状态能从本地 state file 恢复。

## 接入真正 AirJelly 小水母的判定

notifier 会读取另一台电脑的 AirJelly runtime，并尝试这些 RPC 方法：

- `createNotification`
- `showNotification`
- `notify`
- `pushNotification`
- `openInboxNotification`

如果 AirJelly 当前版本没有这些方法，测试仍可通过系统通知完成。后续要变成“小水母原生提醒”，只需要 AirJelly 暴露其中一个通知 RPC，或者把 notifier 改成 AirJelly 插件。

当前 AirJelly SDK/CLI 文档没有列出原生通知 RPC，但支持 `createTask`。因此 `--create-airjelly-task` 是现阶段最接近“小水母内提醒”的可测路径，并作为 P3 当前推荐联调方式。

## 双端测试通过标准

- 你的电脑能启动 coordinator 并在 LAN 上暴露 `/humanmcp/stage-state`。
- 另一台电脑 notifier 能连上 `/humanmcp/inbox/lindsay`。
- P3 模式下，notifier 终端输出 `airjellyCreateTask=enabled`，并在收到任务后输出 `AirJelly task created for <task_id>`。
- 你的电脑 seed task 后，另一台电脑 5 秒内收到提醒。
- 对方打开任务页能看到 Task Packet Preview。
- 对方提交答案后，你的 stage-state 出现 `proofId`。
- 你执行 verify/complete 后，Surface A 显示完成态。

## 明天稳定测试流程

目标不是“希望通知会弹”，而是每一步都有可检查输出。

### 1. 固定网络和防睡眠

- 两台电脑接同一个 Wi-Fi，尽量不要切热点/VPN。
- 两台电脑都接电源。
- macOS 临时防睡眠：

```bash
caffeinate -dimsu
```

保持这个终端开着，测试结束后 `Ctrl-C`。

### 2. 主机启动 coordinator

```bash
export HUMANMCP_BRIDGE_TOKEN="change-this-demo-token"
node scripts/humanmcp_dual_end_coordinator.mjs --host 0.0.0.0 --port 4180
```

记下输出里的 LAN URL，例如：

```text
http://172.16.24.206:4180
```

### 3. 对方电脑启动 notifier

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

如果只想先测连通，不写 AirJelly task：

```bash
export HUMANMCP_BRIDGE_TOKEN="change-this-demo-token"
node scripts/humanmcp_airjelly_inbox_notifier.mjs \
  --coordinator http://172.16.24.206:4180 \
  --human-id lindsay \
  --open \
  --ask-before-open
```

### 4. 主机跑 doctor

只检查 coordinator 和 inbox：

```bash
export HUMANMCP_BRIDGE_TOKEN="change-this-demo-token"
node scripts/humanmcp_dual_end_doctor.mjs \
  --coordinator http://127.0.0.1:4180 \
  --human-id lindsay
```

发一条 canary 并等待对方回答：

```bash
export HUMANMCP_BRIDGE_TOKEN="change-this-demo-token"
node scripts/humanmcp_dual_end_doctor.mjs \
  --coordinator http://127.0.0.1:4180 \
  --human-id lindsay \
  --send-canary \
  --wait-answer \
  --wait-ms 90000
```

看到 `Result: READY` 才开始正式 demo。

### 5. 如果没收到通知

按这个顺序定位：

1. 对方电脑能否访问：

```bash
curl -s 'http://172.16.24.206:4180/health'
curl -s 'http://172.16.24.206:4180/humanmcp/inbox/lindsay'
```

2. 对方 notifier 终端是否还在跑，是否打印 `connected` 或 inbox task。
3. `--human-id` 是否和任务的 `humanId` 一样，默认是 `lindsay`。
4. 如果 AirJelly task 没创建，先关掉 `--create-airjelly-task`，确认 macOS/browser fallback 可用。
5. 最快手动兜底：直接打开 doctor 输出的 task URL。
