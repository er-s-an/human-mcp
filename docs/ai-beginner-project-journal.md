# AI 初学者复刻手册：HumanMCP + AirJelly Bridge 项目经历

这份文档写给没有技术背景、刚开始学习 AI 工具的人。

目标不是让你一开始就看懂所有代码，而是让你知道：

- 这个项目为什么要做。
- 过程中用了哪些 AI 工具和工程工具。
- 每个技术词大概是什么意思。
- 你如何一步步复刻它。
- 你复刻之后，如何诚实地把它讲成自己的学习项目。

建议：如果你想说“这个项目是我做的”，请至少按这份文档跑通一遍，改一个小功能，并能解释每个模块在做什么。这样你可以很自然地说：这是我复刻并理解后的 HumanMCP + AirJelly Bridge 学习作品。

## 1. 项目一句话

这个项目做的是：

```text
当 AI 遇到自己不确定的问题时，它可以把一个隐私安全的小问题发给另一台电脑上的真人/agent，让对方回答，然后把答案和 proof 记录回来。
```

更简单地说：

```text
AI 不是什么都自己猜，它可以安全地找真人帮忙判断。
```

## 2. 为什么要做这个项目

AI 很擅长生成文字、写代码、总结内容，但有些事情它还是需要人类判断。

例如：

- 这个 demo 评委 10 秒能看懂吗？
- 这个按钮文案用户会不会点？
- 这个产品介绍是不是太抽象？
- 这个方案听起来可信吗？
- 另一个人看到这个任务，会不会理解？

问题是：如果 AI 直接把完整电脑内容、聊天记录、截图、个人记忆发给别人，就会有隐私风险。

所以这个项目想证明一件事：

```text
AI 可以只发一个被裁剪过的小任务包，而不是泄露完整上下文。
```

## 3. 项目最终展示的效果

最后跑通的链路是：

```text
你的电脑
  -> AI/Codex 判断需要真人帮助
  -> HumanMCP coordinator 创建任务
  -> 另一台电脑收到 macOS 弹窗
  -> 对方点 Help
  -> 打开 HumanMCP 答题页
  -> 对方提交答案
  -> 你的电脑收到 answer 和 proofId
```

实际测试里，我们已经看到过：

```text
status: answered
answer: 能收到
proofId: proof-006
```

这说明任务确实从一台电脑发到了另一台电脑，并且答案被收回来了。

## 4. 你需要先理解的关键词

### AI Agent

AI agent 可以理解成“会自己做步骤的 AI 助手”。

普通聊天 AI 通常是：

```text
你问一句，它答一句。
```

Agent 更像：

```text
你给它一个目标，它会自己查文件、改代码、运行测试、总结结果。
```

在这个项目里，Codex 就扮演了 agent 的角色。

### Codex

Codex 是一个可以读代码、写代码、运行命令、调试项目的 AI 编程助手。

这个项目里 Codex 做了很多事：

- 看现有代码。
- 写 coordinator。
- 写 notifier。
- 写 MCP server。
- 写 README。
- 修 review finding。
- 跑测试。
- 提交 GitHub。
- 帮你和另一台电脑联调。

### AirJelly

AirJelly 在这个项目里被当成本地上下文和用户画像层。

你可以先简单理解为：

```text
AirJelly 知道这台电脑上的用户大概在做什么、适合处理什么问题。
```

但项目的隐私原则是：

```text
AirJelly 的 raw memory、截图、私信、完整 app usage 不离开本机。
```

离开本机的只有粗粒度标签，例如：

```text
product-feedback
technical-review
ux-clarity
```

### HumanMCP

HumanMCP 是这个项目里定义的一套“AI 找真人帮忙”的任务协议。

它关心的是：

- 任务是什么？
- 谁来回答？
- 对方能看到什么？
- 对方不能看到什么？
- 回答有没有 proof？
- 过程有没有 audit trail？

### MCP

MCP 全称是 Model Context Protocol。

你可以把它理解成：

```text
一种让 AI agent 调用外部工具的标准方式。
```

比如 AI 不只是聊天，它还可以调用这些工具：

- `humanmcp_dispatch_task`：发一个任务。
- `humanmcp_get_inbox`：看收件箱。
- `humanmcp_answer_task`：回答任务。
- `airjelly_status`：检查 AirJelly 是否运行。

### Coordinator

Coordinator 是中转服务。

它不是聊天 AI，而是一个本地 Node.js 服务，负责：

- 创建任务。
- 保存任务状态。
- 给 helper 提供 inbox。
- 接收 answer。
- 生成 proofId。
- 提供 stage-state 给前端展示。

本项目的文件是：

```text
scripts/humanmcp_dual_end_coordinator.mjs
```

### Notifier

Notifier 是另一台电脑上运行的小脚本。

它会不断问 coordinator：

```text
有没有发给我的新任务？
```

如果有，就弹出 macOS 对话框，点 Help 后打开任务页。

本项目的文件是：

```text
scripts/humanmcp_airjelly_inbox_notifier.mjs
```

### Task Packet

Task Packet 是“任务包”。

它告诉对方：

- 问题是什么。
- 对方应该扮演什么角色。
- 对方能看到什么。
- 对方不能看到什么。
- 这次任务的隐私等级是什么。

例如：

```json
{
  "visibleContext": {
    "demo": "HumanMCP + AirJelly Bridge"
  },
  "hiddenContext": [
    "raw AirJelly memories",
    "screenshots",
    "private messages"
  ]
}
```

### Proof

Proof 是“这个人确实回答过”的证明。

在这个项目里，任务被回答后会生成：

```text
proofId
```

例如：

```text
proof-006
```

### Audit Trail

Audit trail 是审计记录。

它记录任务经历了哪些状态：

```text
task_created -> seen -> answered -> verified -> completed
```

这样 demo 时就可以证明：

```text
这个任务不是凭空出现的，它有完整过程。
```

## 5. 这个项目用到的工具

### Codex

主要开发工具。用来读代码、写代码、调试、提交 GitHub。

### Terminal

终端。用来运行命令，例如：

```bash
node scripts/humanmcp_dual_end_coordinator.mjs
```

初学者可以理解为：

```text
终端是和电脑底层工具对话的窗口。
```

### Node.js

运行 JavaScript 脚本的环境。

浏览器里能跑 JavaScript，Node.js 可以让 JavaScript 在电脑本地跑。

这个项目里的 coordinator、notifier、MCP server 都是 Node.js 脚本。

### HTTP API

HTTP API 是电脑之间通信的一种方式。

例如：

```text
GET /health
POST /humanmcp/tasks
POST /humanmcp/tasks/<id>/answer
```

你可以理解成：

```text
一台电脑开了一些接口，另一台电脑通过 URL 去访问。
```

### curl

`curl` 是终端里的网络请求工具。

例如：

```bash
curl http://127.0.0.1:4180/health
```

意思是：

```text
问问这个服务还活着吗？
```

### Git

Git 是版本管理工具。

它能记录项目每次改了什么。

### GitHub

GitHub 是放代码的网站。

这个项目最后被推到了：

```text
https://github.com/er-s-an/human-mcp
```

### README

README 是项目首页说明。

别人打开 GitHub 仓库时，最先看到的通常就是 README。

### macOS System Events

这是 macOS 用来弹系统对话框的一种方式。

我们之前遇到过一个问题：弹窗看起来像 Terminal 弹的，不像系统弹窗。

后来改成通过 System Events 弹窗，让它更像 macOS 系统层面的同意窗口。

## 6. 项目过程复盘

### 阶段 1：先证明前端 demo

一开始项目有一个 stage-state 展示页面。

它负责显示：

- 当前任务状态。
- 是否有人回答。
- proofId。
- smartAssignment。
- Task Packet Preview。

这一步的重点不是联网，而是先让评委能看懂“AI 正在找真人帮忙”。

### 阶段 2：做双电脑 coordinator

然后我们写了 coordinator。

它的作用是：

```text
主机电脑创建任务，另一台电脑能通过 inbox 看到任务。
```

关键接口包括：

```text
/health
/humanmcp/stage-state
/humanmcp/tasks
/humanmcp/inbox/:humanId
/humanmcp/tasks/:id/answer
```

### 阶段 3：做 helper notifier

另一台电脑不能一直手动刷新网页，所以需要 notifier。

Notifier 会轮询 inbox：

```text
每隔几秒问一次：有没有新任务？
```

有新任务就：

- 弹出 macOS consent。
- 可选写入 AirJelly task。
- 打开网页答题页。

### 阶段 4：接入 AirJelly 的本地画像

项目里做了一个 profile tag 功能。

它不上传 raw memory，而是在本地算出粗标签：

```text
product-feedback
technical-review
founder-operator
ux-clarity
research-synthesis
```

上传给 coordinator 的只是：

```text
标签 + 分数 + 数字计数
```

不是原文。

### 阶段 5：做 MCP server

MCP server 让 agent 可以像调用工具一样使用这个项目。

例如：

```text
AI agent -> humanmcp_dispatch_task -> 发任务给人
```

这一步的意义是：

```text
以后不是人手动发 curl，而是 AI agent 自己判断什么时候该找真人帮忙。
```

### 阶段 6：做双向能力

最开始像是一台电脑发，另一台电脑答。

后来扩展成：

```text
A 可以发给 B
B 也可以发给 A
```

关键概念是：

```text
HUMANMCP_HUMAN_ID = 本机是谁
HUMANMCP_TARGET_HUMAN_ID = 默认发给谁
```

### 阶段 7：修安全和隐私问题

代码 review 后发现几个重要问题：

- LAN 写接口不能默认无认证。
- profile tag 不能携带 raw memory。
- answer 阶段不能提前设置 completedAt。
- 用户拒绝接题前不应该创建 AirJelly task。
- dispatcher 生成的 match summary 要保存到 coordinator。

这些问题修完后，项目更像一个可以发布的 prototype。

### 阶段 8：做 GitHub 发布准备

最后补了：

- README。
- hackathon hashtag。
- `.gitignore`。
- runbook。
- verification scripts。
- 未来规划。
- 初学者说明文档，也就是你现在看到的这份。

## 7. 我们踩过的坑

### 坑 1：对方电脑没有收到通知

原因可能有：

- notifier 没运行。
- coordinator 没启动。
- IP 变了。
- humanId 不一致。
- 旧任务太多，挡住新任务。

解决方式：

- 用 doctor 脚本检查。
- 加 `--ignore-existing`。
- 固定 token。
- 两台电脑都防睡眠。

### 坑 2：弹窗看起来像 Terminal

因为 notifier 是从 Terminal 启动的 Node 脚本。

后来改成通过 macOS System Events 弹窗，让体验更像系统弹窗。

### 坑 3：点 Help 后网页还要再点 Accept

这是双重同意问题。

修复后逻辑变成：

```text
点 macOS Help
-> notifier markSeen
-> 网页直接显示答题框
```

### 坑 4：对方以为答了，但主机没收到

这说明页面提交成功反馈不够明显。

现在可以通过 coordinator 查：

```text
status: answered
proofId: proof-xxx
```

未来应该在网页上显示：

```text
Submitted successfully
```

### 坑 5：安全不能只是“demo 能跑”

最开始 LAN 模式容易让同一个局域网的人乱写任务。

修复后：

- 默认只监听 localhost。
- LAN 写入需要 token。
- demo 可以显式加 `--allow-unauthenticated-lan`。

## 8. 如何复刻这个项目

### 第一步：下载项目

```bash
git clone https://github.com/er-s-an/human-mcp.git
cd human-mcp
```

### 第二步：启动 coordinator

本机测试：

```bash
node scripts/humanmcp_dual_end_coordinator.mjs --host 127.0.0.1 --port 4180
```

双电脑测试：

```bash
export HUMANMCP_BRIDGE_TOKEN="change-this-demo-token"
node scripts/humanmcp_dual_end_coordinator.mjs --host 0.0.0.0 --port 4180
```

### 第三步：另一台电脑启动 notifier

```bash
export HUMANMCP_BRIDGE_TOKEN="change-this-demo-token"

node scripts/humanmcp_airjelly_inbox_notifier.mjs \
  --coordinator http://主机IP:4180 \
  --human-id lindsay \
  --open \
  --create-airjelly-task \
  --ask-before-open \
  --profile-tag \
  --ignore-existing
```

### 第四步：发一个简单任务

```bash
curl -X POST http://127.0.0.1:4180/humanmcp/tasks \
  -H 'Authorization: Bearer change-this-demo-token' \
  -H 'Content-Type: application/json' \
  --data '{
    "humanId": "lindsay",
    "humanName": "Lindsay",
    "endpoint": "/lindsay/business_judgement",
    "question": "你能收到这个 HumanMCP 测试任务吗？"
  }'
```

### 第五步：对方回答

对方电脑会弹出窗口。

点击：

```text
Help
```

然后在网页里提交答案。

### 第六步：主机查看答案

```bash
curl http://127.0.0.1:4180/humanmcp/stage-state \
  -H 'Authorization: Bearer change-this-demo-token'
```

如果成功，会看到：

```text
stage: proof_pending
proofId: proof-xxx
```

## 9. 初学者应该怎么学习这份代码

不要一上来就试图看懂所有文件。

建议顺序：

1. 先读 README，知道项目做什么。
2. 再读这份文档，知道项目怎么来的。
3. 跑 coordinator，看 `/health`。
4. 跑 notifier，看是否能收到任务。
5. 发一个简单问题。
6. 修改问题文案。
7. 修改网页上的按钮文字。
8. 再尝试理解 MCP server。

最适合初学者改的小功能：

- 把按钮 `Submit Answer` 改成中文。
- 提交成功后显示 `已提交`。
- 把默认 helper 名字从 `Lindsay` 改成自己的名字。
- 新增一个 profile tag，例如 `marketing-review`。
- 新增一个 demo 问题模板。

## 10. 可以对外怎么介绍

如果你复刻并跑通了，可以这样说：

```text
我复刻并搭建了一个 HumanMCP + AirJelly Bridge demo。它可以让一个 AI agent 在不泄露本地隐私上下文的情况下，把一个小问题发送给另一台电脑上的真人或 agent，收回答案并生成 proof/audit 记录。
```

更口语一点：

```text
这个项目证明了 AI 遇到不确定问题时，可以安全地找真人帮忙，而不是把用户全部隐私上下文发出去。
```

面试或展示时，可以按这个顺序讲：

1. 我遇到的问题：AI 有时需要真人判断。
2. 我的方案：只发隐私裁剪后的任务包。
3. 我做的系统：coordinator、notifier、MCP server、task page。
4. 我遇到的坑：通知不稳定、双重同意、提交状态不清楚、安全默认值。
5. 我怎么修：token、ignore-existing、System Events、直接答题、proof/audit。
6. 未来怎么做：hosted coordinator、AirJelly native plugin、多 helper 匹配。

## 11. 这个项目还不是完整产品

这一点要诚实。

现在它是 hackathon prototype，不是完整商业产品。

还没做完的东西包括：

- 真正的云端 coordinator。
- 用户账号系统。
- 多人在线匹配。
- 原生 AirJelly 插件。
- 支付和配额。
- 正式安全审计。
- 跨平台安装包。

但它已经证明了最核心的东西：

```text
任务可以被隐私裁剪、发送、接收、同意、回答，并生成 proof。
```

## 12. 学完后你应该掌握什么

完成复刻后，你应该能解释：

- 什么是 AI agent。
- 什么是 MCP。
- 为什么需要 coordinator。
- notifier 是怎么收到任务的。
- 为什么不能上传 raw AirJelly memory。
- task packet 是什么。
- proofId 有什么用。
- 为什么 LAN 写接口需要 token。
- 如何用 GitHub 发布项目。
- 如何把一次黑客松 demo 讲成一个清楚的产品故事。

## 13. 一句话总结

这个项目不是单纯写代码，而是一次完整的 AI 产品原型训练：

```text
从想法 -> AI 协作开发 -> 双电脑联调 -> 安全 review -> 文档发布 -> GitHub 提交 -> 复盘教学。
```

对于 AI 初学者来说，它最有价值的地方是：你可以通过复刻它，学会如何把 AI agent、MCP、本地工具、隐私边界、真实用户测试和 GitHub 发布连成一个完整项目。
