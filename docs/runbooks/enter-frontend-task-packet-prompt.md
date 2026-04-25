# Enter Frontend Prompt: Task Packet Preview + Privacy Budget

Use this prompt for the Enter frontend / OpenClaw Surface B implementation lane.

```text
请实现 HumanMCP Task Packet Preview + Privacy Budget P0-P4 + QR 网站访问后分配任务。目标是把“扫码进入网站 → 展示 Task Packet Preview → 分配/复用任务 → 提交 proof → 进入 verify/stamp”这条链路做成前端可用、后端兼容、数据不泄露的稳定流程。

请优先沿用现有 `humanmcp.ts` / `stage-panel` 的职责边界；如果当前仓库里文件名不同，请按同等职责的模块/组件落地，不要重写整条链路。

必须严格遵守：
- `secret_phrase + narrative + proof_text` 只属于 proof submission payload，不属于 Task Packet 本身。
- Task Packet Preview 只展示任务包、隐私预算和可见上下文，不展示原始 proof 内容。
- 前端必须兼容 snake_case 和 camelCase 两种响应字段。
- 缺字段时要安全降级，不要白屏，不要阻断任务流。
- 任何输入、默认值、日志、埋点、调试面板都不能泄露 canonical `secret_phrase`。
- 不要新增依赖；优先复用现有组件、样式、normalizer、API client。

需要支持的数据结构：
- `HumanMcpSnapshot`: `stage`, `expressionState`, `assignmentId`, `taskId`, `subtaskId`, `humanId`, `humanName`, `endpoint`, `proofId`, `verified`, `rewardDelta`, `stampStatus`, `message`, `updatedAt`, `mode`, `currentGoal`, `nextAction`, `operatorActions`, `taskPacket`, `smartAssignment`
- `TaskPacket`: `taskType`, `privacyBudget`, `privacyLevel`, `role`, `goal`, `visibleContext`, `hiddenContext`, `singleQuestion`, `outputSchema`, `guardrails`
- `PrivacyBudgetLevel`: `P0` internal only, `P1` redacted artifact slice, `P2` workflow context, `P3` sensitive review, `P4` blocked
- `SmartAssignment`: `status`, `selectedHuman`, `selectedEndpoint`, `rationale`, `confidence`, `policy`, `fallback`, `candidates`, `responsibility`
- `ProofSubmissionPayload`: `assignment_id`, `task_id`, `subtask_id`, `narrative`, `secret_phrase`, `proof_text`

Task Packet Preview UI 必须出现为分配前门禁：
- 标题文案：`AI wants to call a human reviewer.`
- 两列：
  - `Human will see`: product category, current headline/artifact slice, one screenshot or bounded artifact excerpt, target user, single question, output schema。
  - `Human will NOT see`: user name, full browser screen, raw AirJelly memory, private messages, credentials, revenue data, unrelated tabs。
- 隐私预算 rail：展示 `P0`, `P1`, `P2`, `P3`, `P4`；默认 `P1 · redacted artifact slice`；`P4` 必须阻断 Confirm。
- 展示任务卡摘要、可见上下文、单问题、输出结构和 guardrails。
- hidden/redacted context 只展示脱敏类别或折叠摘要，不允许直接渲染敏感原文。
- `Confirm` 才能创建/复用 assignment；`Cancel` 不得创建 assignment。

QR / assignment 行为：
- 用户扫码是打开 Enter 网站，不是 OpenClaw 扫码。
- 如果 URL 已携带预创建 assignment 线索，必须解析并复用同一个 `assignmentId`，不能重复创建。
- 如果扫码即分配，必须先展示 Task Packet Preview，再在 Confirm 后调用/replay `POST /tasks/assign`。
- 扫码后页面应能看到 `assignmentId`, `taskId`, `subtaskId`, 当前任务状态，以及 Task Packet summary。
- `POST /tasks/assign` 必须按业务键幂等；重复扫码或刷新应得到同一个 assignment 结果或安全 replay 结果。

API 兼容策略：
- `GET /humans?online=true&skill=...` 继续作为可调用人/能力卡入口，前端不得假设一定存在单一格式字段。
- `POST /tasks/assign` 若后端支持 metadata，则带上 `task_packet` 或 `metadata.task_packet`；若后端不支持，则前端按 `assignmentId` 保存 Task Packet preview state 用于 demo 展示和 audit，不破坏现有 API。
- `GET /proofs?status=pending`, `POST /proofs/{proof_id}/verify`, `POST /stamps/{proof_id}/complete` 的现有 contract 不要被前端破坏。
- 请求/响应归一化要同时接受 `human_id/humanId`, `assignment_id/assignmentId`, `task_packet/taskPacket`, `privacy_budget/privacyBudget`, `privacy_level/privacyLevel`, `reward_delta/rewardDelta`, `stamp_status/stampStatus`, `updated_at/updatedAt`。
- 不要要求后端一次性补齐所有新字段；前端必须能用已有字段安全降级。
- `secret_phrase` 不应出现在 `GET /humans` 返回里，也不应被 Task Packet Preview 引用为任务包字段。

stage-panel / humanmcp.ts 需要补齐：
- `humanmcp.ts` 增加 Task Packet / Privacy Budget / responsibility normalizer，并覆盖 snake_case + camelCase。
- `stage-panel` 或同等组件展示 assignment、proof、verify、stamp 的完整状态链路：`proofId`, `verified`, `rewardDelta`, `stampStatus`, `message`, `updatedAt`。
- smart assignment 区可展示选中人/能力卡、候选项、rationale、confidence、fallback，但不要混入 proof submission 字段。
- 状态变化时要给明确操作反馈：pending、verified、stamp_ready、stamped、fallback。

OPC 叙事要求：
- 页面/文案要把链路说清楚：AirJelly 提供一人公司的本地工作上下文 → OpenClaw 判断需要人类协作 → HumanMCP 打包最小化任务包 → Enter 派发给许可的人类 reviewer → founder 保持最终控制。
- 不要把 HumanMCP 讲成随机互助社区；它是 AI Operating Team for One-Person Companies 的 permissioned human escalation layer。

验收清单：
- QR 访问能展示 Task Packet Preview，Confirm 后创建或复用 assignment，并在页面上显示同一个 `assignmentId`。
- Task Packet Preview 正确渲染 P0-P4 隐私预算和任务摘要。
- `secret_phrase + narrative + proof_text` 只出现在 proof 提交 payload 中，不出现在 Task Packet Preview 或 Task Packet state 中。
- `humanmcp.ts` 能同时兼容 snake_case 和 camelCase。
- `stage-panel` 能展示 assignment、proof、verify、stamp 的完整状态链路。
- 重复扫码、重复进入、重复提交不会制造重复 assignment，也不会把 proof 字段混进任务包。
- 页面、日志、默认 state、调试信息里都看不到 canonical `secret_phrase`。
- P4 case 会阻断 dispatch，并显示明确原因。

测试点：
- 给 `humanmcp.ts` 增加归一化测试，覆盖 snake_case / camelCase / 缺字段降级。
- 给 Task Packet Preview 增加组件测试，覆盖 P0-P4 展示、P4 blocked、redacted 文案、hiddenContext 折叠。
- 给 QR landing page 增加流程测试，覆盖 create/replay assignment、assignmentId 复用、seen 标记。
- 给 proof 提交表单增加测试，确认 `narrative`, `secret_phrase`, `proof_text` 只进 proof payload，不进 Task Packet state。
- 给 `stage-panel` 增加状态测试，确认 `proof_pending`, `verified`, `stamp_ready`, `stamped` 等状态展示正确。
- 增加回归测试，确保 canonical `secret_phrase` 不会出现在任何预览、卡片、状态字符串、日志里。
- 如果有 E2E 测试，至少覆盖“扫码进入 → Task Packet Preview → Confirm 分配任务 → 查看任务 → 提交 proof”主路径。

交付标准：
- 代码、类型、测试一起落地。
- 只做前端兼容扩展，不破坏现有 API contract。
- 最终请附上实际改动点、兼容策略和已验证的测试结果。
```
