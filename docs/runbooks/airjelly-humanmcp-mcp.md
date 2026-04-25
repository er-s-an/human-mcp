# AirJelly HumanMCP MCP Server

目标：让安装了 AirJelly 的电脑上的 agent 可以通过 MCP 使用 HumanMCP + AirJelly 能力。

```text
Agent / Codex / Claude
-> local MCP server over stdio
-> local AirJelly runtime.json + RPC
-> HumanMCP coordinator over HTTP
-> another helper agent / human
```

## Bidirectional Mode

可以双向用。每台电脑都配置同一个 coordinator，同时拥有两个身份概念：

- `HUMANMCP_HUMAN_ID`: 本机收件箱身份，也就是别人发给这台电脑时用的 id。
- `HUMANMCP_TARGET_HUMAN_ID`: 本机默认要发给谁，也就是 peer/helper 的 id。

如果 A 和 B 要互相发题：

```text
A local id = alice     A default target = bob
B local id = bob       B default target = alice
```

两边都可以：

- 用 `humanmcp_get_inbox` 读取自己的 inbox。
- 用 `humanmcp_answer_task` 回答别人发来的任务。
- 用 `humanmcp_dispatch_task` 发任务给默认 peer。
- 在单次调用里传 `targetHumanId` 覆盖默认 peer。

## Server

```bash
node scripts/airjelly_humanmcp_mcp_server.mjs
```

这个 server 无 npm 依赖，读取本机：

```text
~/Library/Application Support/AirJelly/runtime.json
```

## Tools

| Tool | 用途 |
| --- | --- |
| `airjelly_status` | 检查本机 AirJelly runtime/health/capabilities |
| `airjelly_profile_tag` | 在本机从 AirJelly 信号生成粗粒度画像标签，可选择发布到 coordinator |
| `humanmcp_classify_intent` | 把用户意图 + 本机 AirJelly aggregate signals 转成 P1 task payload，不发送 |
| `humanmcp_dispatch_task` | 根据 intent 或 question 创建 HumanMCP task |
| `humanmcp_get_inbox` | 读取某个 helper 的 inbox |
| `humanmcp_answer_task` | 提交 HumanMCP task answer |
| `humanmcp_get_stage_state` | 读取 coordinator stage-state |
| `airjelly_create_local_task` | 在本机 AirJelly 创建 task，可能消耗 embedding credit |

## Privacy Boundary

MCP tools 只把这些内容给 coordinator：

- intent summary
- inferred intent type
- AirJelly overlap counts
- helper coarse tags
- task packet
- answer/proof state

不会导出：

- raw AirJelly memories
- screenshots
- private messages
- credentials
- unrelated tabs
- full app usage history
- people graph 原文

## Codex App / Local Agent Config

把下面这段加到本机 agent 的 MCP 配置中，路径按实际项目位置替换。

主机电脑：

```json
{
  "mcpServers": {
    "airjelly-humanmcp": {
      "command": "node",
      "args": [
        "/Users/xiejiachen/Documents/New project/scripts/airjelly_humanmcp_mcp_server.mjs"
      ],
      "env": {
        "HUMANMCP_COORDINATOR_URL": "http://127.0.0.1:4180",
        "HUMANMCP_HUMAN_ID": "alice",
        "HUMANMCP_HUMAN_NAME": "Alice",
        "HUMANMCP_ENDPOINT": "/alice/product_judgement",
        "HUMANMCP_TARGET_HUMAN_ID": "bob",
        "HUMANMCP_TARGET_HUMAN_NAME": "Bob",
        "HUMANMCP_TARGET_ENDPOINT": "/bob/business_judgement"
      }
    }
  }
}
```

另一台 helper 电脑：

```json
{
  "mcpServers": {
    "airjelly-humanmcp": {
      "command": "node",
      "args": [
        "/path/to/scripts/airjelly_humanmcp_mcp_server.mjs"
      ],
      "env": {
        "HUMANMCP_COORDINATOR_URL": "http://172.16.24.206:4180",
        "HUMANMCP_HUMAN_ID": "bob",
        "HUMANMCP_HUMAN_NAME": "Bob",
        "HUMANMCP_ENDPOINT": "/bob/business_judgement",
        "HUMANMCP_TARGET_HUMAN_ID": "alice",
        "HUMANMCP_TARGET_HUMAN_NAME": "Alice",
        "HUMANMCP_TARGET_ENDPOINT": "/alice/product_judgement"
      }
    }
  }
}
```

如果 coordinator 开启 token：

```json
{
  "HUMANMCP_BRIDGE_TOKEN": "<shared-token>"
}
```

## Expected Agent Workflows

主机 agent 自动发题：

```text
Call humanmcp_dispatch_task with:
{
  "intent": "我想知道这个 demo 10 秒内能不能被理解，用户会不会点 Join Waitlist",
  "coordinatorUrl": "http://127.0.0.1:4180",
  "targetHumanId": "bob"
}
```

Helper agent 先注册标签：

```text
Call airjelly_profile_tag with:
{
  "humanId": "lindsay",
  "coordinatorUrl": "http://172.16.24.206:4180",
  "publish": true
}
```

Helper agent 查 inbox：

```text
Call humanmcp_get_inbox with:
{
  "humanId": "bob",
  "coordinatorUrl": "http://172.16.24.206:4180"
}
```

Helper agent 答题：

```text
Call humanmcp_answer_task with:
{
  "taskId": "hmcp-task-...",
  "answer": "..."
}
```

## Verification

```bash
node --check scripts/airjelly_humanmcp_mcp_server.mjs
node verification/check-airjelly-humanmcp-mcp.mjs
```
