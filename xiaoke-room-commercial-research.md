# xiaoke-room 商业场景研究与投资人叙事

更新时间：2026-04-23

> 修订提醒：这份是偏“市场/硬件/商业场景”的宽口径研究。当前路演主叙事应以 [xiaoke-room-room-emotion-positioning.md](</Users/xiejiachen/Documents/New project/xiaoke-room-room-emotion-positioning.md>) 为准：OpenClaw / AirJelly 做能力底座，小可的核心差异化是小房间、情绪表达、生活感和关系留存。

## 0. 结论先行

小可不要被讲成“AI 陪聊”或“桌宠”。更有投资价值的讲法是：

> 我们在做下一代个人 AI 的角色化入口：一个能看见用户上下文、有长期情绪和记忆、能从电脑屏幕迁移到智能硬件的 Companion Agent。

对 M5Stack 投资人尤其要这样讲：

> M5Stack 已经证明了“模块化硬件 + 开源社区”能快速放大硬件生态；但 StackChan、AI Pyramid、CoreS3 这类硬件真正要长期留在用户桌面上，缺的是一个有生命感、能持续进化的角色人格层。xiaoke-room 先在 PC 上验证角色、上下文和留存，再把同一套情绪协议迁移到 M5Stack 硬件。

一句话：

> AirJelly 让她看见你在做什么；xiaoke-room 让她有情绪、有生活；M5Stack 让她真正走出屏幕。

## 1. 为什么这是一个投资故事，不只是黑客松作品

### 1.1 AI Companion 已经有需求，但大多还困在聊天框

Sensor Tower 的 2024 AI Apps 报告显示，AI App 在 2024 年前 8 个月全球收入超过 20 亿美元，全年预计 33 亿美元；AI+Chatbot 类应用前 8 个月内购收入接近 5.8 亿美元，并已经超过 2023 全年 1.5 倍。报告还指出，Character AI 在 2024 年 8 月 MAU 达到 2200 万，且 Character AI、Talkie、Linky、HiWaifu 等伴侣类 AI 应用的 18-35 岁用户占比超过 70%，Character AI 用户中 18-24 岁占 66%。

这说明两件事：

1. 陪伴式 AI 已经不是伪需求。
2. 年轻用户愿意和虚拟角色建立持续关系。

但现有产品多是“聊天列表 + 头像 + 订阅”。它们缺的是：用户正在做什么、角色在一个空间里做什么、角色是否能主动行动。

xiaoke-room 的切入点正好是“聊天框之后的陪伴形态”：上下文感知 + 屏幕房间 + 主动式情绪反应。

### 1.2 桌面 AI Companion 正在从概念进入硬件周期

2026 年的外部信号非常明显：

- M5Stack 推出 StackChan，定位为社区共创、开源、可黑客化的 AI 桌面机器人。
- M5Stack 推出 AI Pyramid，定位为本地 AI、边缘智能终端、Home Assistant、AIGC、语音克隆、会议转写、视觉网关等场景。
- Razer 在 CES 2026 公布 Project AVA，直接定义为 3D hologram AI desk companion，强调屏幕视觉、摄像头、远场麦克风、眼动、表情、唇形和 PC Vision Mode。
- Napster View 也在做夹在 MacBook 上方的 3D holographic AI device，让 AI 角色有独立的视觉窗口。
- LOOI 以“把手机变成桌面机器人”的方式验证了轻量桌面机器人需求，说明用户对低成本、近距离、常驻桌面的 AI 形态有兴趣。

结论：AI Companion 正在从 app 走向“桌面存在感”。小可的 2D 房间是低成本、快速验证的第一步；M5Stack 硬件是下一步实体化。

### 1.3 M5Stack 这条线很关键

M5Stack 官方数据：

- 300 万+ M5 产品全球销量
- 110+ 国家覆盖
- 50+ 全球经销商
- 400+ SKU
- 181,000+ 全球 maker & developer community
- 2024 年推出 LLM Series
- 2024 年被 Espressif 收购控股

Espressif 在收购公告里明确提到，M5Stack 是模块化、开源的 IoT/嵌入式平台，硬件上有传感器、摄像头、GPS 等扩展模块，软件上支持 ESP-IDF、Arduino、UIFlow、EZData，并拥有强开发者影响力。M5Stack 的核心价值不是单品，而是“让创意快速变成可部署硬件”。

这正是 xiaoke-room 可以借势的地方：不要和 M5Stack 做硬件竞争，而是把小可定位成“让这些硬件有灵魂的角色层/场景层/开发者模板”。

## 2. 对 M5Stack 投资人的核心叙事

公开资料核查注意：

> 目前最稳定、可引用的 M5Stack 资本事件是 2024 年 Espressif 收购 M5Stack 控股权。若现场要说“某位投资人投过 M5Stack”，最好拿活动方材料或对方公开履历再确认一次；路演里更稳的讲法是“面向 M5Stack 生态/AIoT 硬件投资人”。

### 2.1 最强版本

> M5Stack 解决的是 AIoT 的身体和手脚；xiaoke-room 解决的是 AIoT 的人格和长期关系。

M5Stack 的 StackChan、CoreS3、AI Pyramid 都有屏幕、麦克风、摄像头、传感器、扬声器、Wi-Fi/BLE、扩展接口，但这些能力通常被开发者当成“功能模块”。小可提供另一层抽象：

- 角色状态：happy / sleepy / curious / shy / worried / neutral
- 行为动作：睡觉、走动、打哈欠、敲键盘、提醒休息
- 上下文感知：知道用户在写代码、开会、刷帖子、连续工作
- 主动式任务：不是等命令，而是在对的时间出现
- 情绪记忆：不是一次性问答，而是持续关系

讲给投资人听时，重点不是“我们能做一个 cute demo”，而是：

> 我们定义了一套跨设备的 Companion Agent Protocol。今天它驱动 Godot 2D 房间，明天可以驱动 StackChan 的舵机、LED、屏幕表情和扬声器。

### 2.2 用 M5Stack 现有产品讲未来路线

可以直接用这条路线：

1. PC 屏幕角色：低成本验证角色吸引力、触发机制、日活和留存。
2. M5Stack CoreS3 / StackChan：把 mood/action/text/audio 协议映射到屏幕表情、舵机、LED、TTS。
3. AI Pyramid：把本地 ASR/TTS/VLM/小模型跑在边缘设备上，解决隐私和低延迟。
4. Home Assistant：小可从“陪伴角色”升级为“有性格的家庭智能体”，能控制灯、提醒、看护、安防。
5. Maker marketplace：开发者发布角色动作包、皮肤、房间、M5Stack 硬件行为脚本。

投资人会听懂的是：这不是单点应用，而是从软件验证到硬件生态的路径。

### 2.3 现场可以直接说的 30 秒话术

> 我们不是想再做一个 Replika，也不是做一个桌宠。聊天型 AI 的问题是没有身体，智能硬件的问题是有身体但没有灵魂。小可先住在电脑房间里，通过 AirJelly 看见用户真实上下文，再用情绪和动作主动反应。更重要的是，我们的 act 协议天然可以映射到 M5Stack 的 StackChan：mood 控制屏幕表情，action 控制舵机和 LED，text/audio 控制语音。这让小可从一个黑客松 demo，变成 M5Stack 开源 AI 机器人生态里的角色引擎。

## 3. 商业场景地图

### 场景 A：开发者/创作者的屏幕陪伴 Agent

目标人群：

- 程序员
- 独立开发者
- 设计师
- 内容创作者
- 远程办公人群
- AI 工具重度使用者

痛点：

- 长时间独自面对屏幕
- 任务切换、拖延、疲劳、缺少反馈
- AI 工具很强，但冷冰冰，没有持续陪伴感

小可的价值：

- 通过 AirJelly 识别用户工作状态
- 在连续工作、卡住、熬夜、刷短视频时主动出现
- 用角色化方式提醒，而不是 productivity app 的警告
- 情绪反应让用户更愿意接受提醒

商业模式：

- 免费基础版
- Pro 订阅：长期记忆、更多语音、更多动作、更多上下文连接、跨设备同步
- 角色/房间/动作包内购

Demo 要强化：

- 连续工作 4 小时，小可从日常状态切到 worried，并主动建议休息。
- 用户问天气，小可不是回答完就结束，而是结合上下文说“你都坐四小时了，晴天，出去走走”。

### 场景 B：M5Stack StackChan 的人格 OS

目标人群：

- M5Stack 开发者
- StackChan 购买者
- 开源硬件爱好者
- AIoT maker
- STEM 教育机构

痛点：

- 硬件很强，但缺可复用的角色逻辑
- 每个 maker 都在重复写表情、动作、对话、TTS、状态机
- 桌面机器人容易停留在“玩两天吃灰”

小可的价值：

- 提供可移植的 mood/action 协议
- 提供可复用人格 prompt、情绪状态机和 demo 剧本
- PC 和硬件可以共享同一个“角色”
- 让 maker 先从“能玩”开始，再二次开发

商业模式：

- 官方/半官方 M5Stack 插件
- StackChan personality pack
- 开源核心 + 付费角色内容
- 和 M5Stack 做 bundle 或开发者活动
- 企业版 SDK：品牌角色、展会互动、教育课程

Demo 要强化：

- 加一个“Hardware Mode”按钮：当小可 worried 时，同时发出一条 `{"mood":"worried","action":"look_up","led":"warm_yellow"}` 给模拟硬件窗口。
- 没有实体 StackChan 也可以用一个 M5Stack CoreS3/StackChan mock 面板显示：屏幕表情、舵机角度、LED 状态。

### 场景 C：智能家居里的有性格 Agent

目标人群：

- Home Assistant 用户
- 智能家居发烧友
- 家庭自动化用户
- M5Stack CoreS3 / AI Pyramid 用户

外部趋势：

Home Assistant 2025 年明确提出构建本地、开放、隐私优先的 AI 智能家居；M5Stack 也发布了 CoreS3 连接 Home Assistant 语音助手的教程，强调本地 AI 交互、安全、可靠、快速。

小可的机会：

- 不是又一个智能音箱，而是“有角色的家庭自动化中枢”
- 小可在房间里睡觉、看书、提醒、看家
- 用户不只说“开灯”，而是和一个熟悉角色互动
- 对老人/孩子/宠物/门口访客等场景，可以做轻量看护提醒

商业模式：

- Home Assistant 插件
- M5Stack 硬件套件
- 家庭 Agent 订阅：本地优先 + 云端增强
- 养老/陪伴场景需要谨慎合规，不作为黑客松主叙事，但可作为远期方向

Demo 要强化：

- 小可看到你要睡觉，说“我把灯调暗了”，同时房间灯光变暗。
- 如果接上 Home Assistant mock，显示一个虚拟灯泡状态变化。

### 场景 D：IP / 虚拟偶像 / VTuber 的 Agent 化

目标人群：

- VTuber
- 虚拟偶像团队
- 游戏 IP
- 二创社区
- 粉丝运营团队

痛点：

- IP 角色通常只能在视频/直播/周边里出现
- 粉丝互动成本高，真人主播不可能 24 小时在线
- 现有 AI 角色多数只是聊天 bot，缺少空间和生活感

小可的价值：

- 角色有自己的房间、作息、情绪和动作
- 可以形成“她在生活”的连续感
- 粉丝可以定制房间、服装、动作、声音
- 角色可以在 PC、网页、硬件设备上出现

商业模式：

- 角色授权 SDK
- 粉丝订阅
- 皮肤/服装/房间资产
- 虚拟活动互动装置

Demo 要强化：

- 强调小可不是 assistant，而是 character。
- 给她一个“离屏生活”：用户没说话时，她会看书、弹 MIDI、睡觉、走到窗边。

### 场景 E：教育和 maker 课程

目标人群：

- STEM 教育
- 高校 AIoT 课程
- 创客空间
- 黑客松组织者
- 中小学生编程硬件课程

小可的价值：

- 把 LLM、TTS、WebSocket、Godot、传感器、M5Stack、情绪状态机串成一个可见项目
- 比普通“智能小车/语音助手”更有情感和展示效果
- 学生能改人格、表情、动作、硬件行为，成就感强

商业模式：

- 课程包
- 硬件套件
- 学校/机构授权
- Hackathon template

Demo 要强化：

- GitHub repo 结构清楚
- 协议简单
- 现场能展示“改一行 personality，小可行为改变”

### 场景 F：品牌 mascot / 智能零售 / 展会互动

目标人群：

- 展会展台
- 新消费品牌
- 科技品牌
- 零售门店
- 企业前台/接待

小可的价值：

- 品牌可以拥有一个会说话、会动、会记住上下文的角色
- 比普通大屏客服更有记忆点
- M5Stack 硬件可以快速做成低成本互动装置

商业模式：

- B2B 项目制
- 品牌定制角色
- 展会互动套件
- 软硬件一体租赁

Demo 要强化：

- 可以给小可一个“黑客松主持人/展台讲解员”模式，证明可迁移到品牌场景。

## 4. 目标人群优先级

### 第一优先级：AI 重度使用的年轻桌面用户

为什么优先：

- 与 AirJelly 赛道最贴合
- 最容易用 PC demo 打动
- 他们已经接受 AI 工具，也接受虚拟角色
- 适合做早期社群和留存验证

画像：

- 18-35 岁
- 开发者、设计师、创作者、学生
- 每天长时间在电脑前
- 喜欢 AI 工具、桌面美化、虚拟角色、二次元/游戏/VTuber 文化

付费点：

- 角色陪伴和个性
- 更自然的语音
- 更丰富动作和房间
- 长期记忆
- 与本地工具/日历/浏览器/音乐/天气/代码仓库连接

### 第二优先级：M5Stack / maker / AIoT 开发者

为什么优先：

- 能打动 M5Stack 相关投资人
- 有硬件扩展想象力
- 社区传播强
- 可快速做出二创 demo

付费点：

- StackChan personality pack
- 开发者模板
- 硬件联动脚本
- 教程和课程
- 高级语音/本地模型适配

### 第三优先级：虚拟角色/IP 创作者

为什么优先：

- 变现空间大
- 与 2D 美术和角色设定天然匹配
- 资产市场可以形成飞轮

付费点：

- 角色 SDK
- 房间/服装/动作包
- 语音克隆
- 粉丝互动

### 第四优先级：智能家居和家庭场景

为什么先不放第一：

- 涉及隐私、安全、家庭成员、儿童老人，合规更复杂
- 硬件链路更长
- 黑客松现场不容易完全证明

但它是 M5Stack 投资人会关心的远期场景。

## 5. 竞品和差异化

| 类别 | 代表 | 强项 | 弱点 | 小可差异化 |
|---|---|---|---|---|
| AI 角色聊天 | Character AI, Talkie, Chai | UGC 角色多、聊天留存强 | 多数困在聊天框，对真实上下文弱 | 小可有房间、有动作、能看见工作上下文 |
| 情感陪伴 App | Replika | Avatar、关系、虚拟房间、订阅成熟 | 移动 app 为主，主动式桌面上下文弱 | 小可是 desktop-native context companion |
| 桌面机器人 | StackChan, LOOI, Eilik | 有实体、可展示、硬件新奇 | 常缺长期人格和真实上下文 | 小可可作为人格 OS/状态机/内容层 |
| 桌面 hologram | Razer AVA, Napster View, Gatebox | 强硬件视觉、桌面存在感 | 硬件成本高、生态封闭或早期 | 小可软件先行、开源友好、可接 M5Stack |
| 智能家居助手 | Home Assistant Assist, Alexa, Google Home | 控制设备成熟 | 多为命令式工具，角色感弱 | 小可是“有性格的家庭 Agent” |
| 生产力 Agent | ChatGPT, Claude, AirJelly | 工具能力强 | 情感和角色弱 | 小可是工具能力的情绪化入口 |

核心差异化一句话：

> 别人做“能聊天的角色”或“能动的硬件”，小可做“知道你此刻在干什么、并用角色身体主动回应你的 Agent”。

## 6. 投资人会问的问题与回答

### Q1：这是不是只是桌宠？

回答：

> 传统桌宠只是在桌面上动，小可是由上下文驱动的。她知道用户正在写代码、开会、刷网页、连续工作多久，并把这些上下文转化为情绪、动作和任务推进。桌宠是动画层，小可是 Companion Agent 层。

### Q2：为什么大模型公司不能直接做？

回答：

> 大模型公司会做通用助手，但不一定会做垂直角色体验、硬件联动和 maker 生态。我们的壁垒不是单次对话模型，而是角色状态机、长期记忆、跨设备动作协议、角色资产生态，以及和 AirJelly/M5Stack 这类上下文与硬件平台的集成。

### Q3：为什么先做软件，不直接做硬件？

回答：

> 硬件最大风险是供应链和库存，角色最大风险是留存。我们先用 PC 屏幕做最小身体，快速验证角色、语音、上下文触发和付费意愿；当数据证明用户愿意长期保留小可，再和 M5Stack 这种成熟硬件生态合作，把她迁移到 StackChan/CoreS3/AI Pyramid。

### Q4：商业化靠什么？

回答：

> 早期 B2C 订阅和角色资产，中期做 M5Stack/StackChan 插件和硬件 bundle，长期做角色 Agent SDK 和 marketplace。对开发者，卖的是能力；对消费者，卖的是陪伴和个性；对硬件厂商，卖的是让设备长期留在桌面上的人格层。

### Q5：AI 陪伴有未成年人和心理风险，怎么处理？

回答：

> 我们不会把黑客松 demo 定义成恋爱陪伴，也不主打未成年人。默认定位是工作陪伴、创作陪伴和 maker companion。产品上要做年龄分级、敏感话题边界、危机干预转接、隐私透明、本地优先、可导出/删除记忆。安全不是附加项，而是 companion 产品能否长期存在的前提。

### Q6：M5Stack 投资人为什么该在意？

回答：

> 因为 M5Stack 的增长靠开发者社区和可复制的硬件场景。StackChan 证明了市场喜欢开源 AI 桌面机器人，但硬件要持续使用，必须有可持续生成内容和关系的角色层。小可可以成为 M5Stack AI hardware 的示范应用：一套协议连接屏幕角色、舵机、LED、TTS、摄像头、Home Assistant 和本地模型。

## 7. Pitch Deck 建议结构

### Slide 1：开场画面

标题：

> 你的屏幕是一面透明墙。墙那边有人在生活。

副标题：

> AirJelly lets her see. xiaoke-room lets her live.

画面：

- 小可在房间里睡觉
- 用户打开电脑，她醒来

### Slide 2：问题

标题：

> AI 很聪明，但没有存在感；硬件会动，但没有灵魂。

三个点：

- Chatbot 只会等你输入
- 智能硬件大多是命令式工具
- 长时间屏幕工作的人需要的是有温度的主动陪伴

### Slide 3：产品

标题：

> 一个住在你电脑里的上下文感知 Companion Agent

展示：

- AirJelly context
- Emotion Engine
- Godot Room
- WebSocket act protocol

### Slide 4：Demo

标题：

> 她不是回答你，她在观察、反应、行动。

演示三个场景：

1. 用户回来，小可醒来
2. 检测连续工作 4 小时，小可担心
3. 小可查天气，并建议出门

### Slide 5：为什么现在

标题：

> Companion AI 正在从聊天框走向桌面和硬件

证据：

- Sensor Tower：AI App 与 companion app 高速增长
- M5Stack StackChan：开源 AI 桌面机器人
- Razer AVA / Napster View：桌面 AI hologram
- Home Assistant：本地、开放、隐私优先的智能家居 AI

### Slide 6：商业场景

标题：

> 从桌面陪伴，到硬件人格 OS

四格：

- 开发者/创作者屏幕陪伴
- StackChan personality OS
- Home Assistant 家庭角色 Agent
- IP/VTuber 角色 Agent SDK

### Slide 7：M5Stack 路线

标题：

> M5Stack gives AI a body. Xiaoke gives that body a soul.

架构：

PC 小可 → StackChan/CoreS3 → AI Pyramid → Home Assistant → Marketplace

### Slide 8：商业模式

标题：

> Subscription + Assets + Hardware Bundle + SDK

内容：

- B2C Pro subscription
- 角色/房间/动作/语音资产
- M5Stack 插件/bundle
- 教育课程
- IP/品牌 SDK

### Slide 9：护城河

标题：

> Context + Character + Cross-device protocol

四点：

- 上下文触发数据
- 长期角色记忆
- 情绪状态机和动作协议
- 开源硬件/creator 生态

### Slide 10：Ask

标题：

> We want to pilot Xiaoke on M5Stack hardware.

具体 ask：

- 20-50 台 StackChan/CoreS3/AI Pyramid beta hardware
- M5Stack 社区内测入口
- 官方 Discord/Hackster/Newsletter 联合活动
- 技术对接：屏幕、舵机、LED、TTS、摄像头 API
- 两周内交付 StackChan personality demo

## 8. 黑客松 Demo 应该立刻加的“商业钩子”

### 8.1 加 Hardware Mode

即使没有实体硬件，也要有一个模拟窗口：

```json
{
  "device": "stackchan",
  "mood": "worried",
  "face": "concerned",
  "servo": {"pan": 12, "tilt": -8},
  "led": "warm_yellow",
  "speech": "都四个小时了...该休息了吧"
}
```

画面上显示：

- StackChan face preview
- servo pan/tilt 数值
- LED color
- TTS text

这样投资人会立刻理解：这套东西不是只能在 Godot 里跑。

### 8.2 加“离屏生活”

小可要有不依赖用户输入的行为：

- 看书
- 打哈欠
- 走到窗边
- 弹 MIDI
- 看到用户回来才抬头

这解决 AI 角色常见问题：只有聊天时才存在。投资人会更相信这是“关系型产品”。

### 8.3 加“一键迁移到硬件”的架构图

在 pitch 里展示：

```text
Emotion Engine
  -> Godot Driver: 2D body / room / TTS
  -> StackChan Driver: screen face / servo / LED / speaker
  -> Home Driver: lights / weather / reminders
```

这会把项目从 demo 拉到平台叙事。

### 8.4 加安全边界一句话

现场不要逃避 AI companion 的风险。可以说：

> 小可默认不是恋爱 AI，也不面向未成年人。我们从工作陪伴和 maker companion 开始，所有记忆透明可删，敏感话题有边界，本地优先是未来硬件路线的一部分。

## 9. 可量化验证指标

黑客松之后如果继续做，投资人会想看这些：

- D1 / D7 / D30 retention
- 每日主动触发次数
- 用户是否保留桌面常驻
- 用户是否愿意打开 TTS
- 平均会话时长
- 用户修改人格/房间/动作的比例
- 角色资产下载/购买率
- M5Stack 硬件联动 demo 数量
- 社区二创数量
- 用户是否愿意为 Pro 记忆/语音/角色包付费

最关键的不是下载量，而是：

> 用户是否愿意让她长期住在自己的屏幕上。

## 10. 一页纸版本

项目：

> xiaoke-room：一个住在电脑里的上下文感知 Companion Agent。

问题：

> Chatbot 没有身体，智能硬件没有人格，远程/桌面用户缺少温度反馈。

解决方案：

> AirJelly 获取用户上下文，小可用情绪状态机、2D 房间、语音和动作主动回应，并通过 act 协议迁移到硬件。

为什么现在：

> AI companion 已有高增长；桌面 AI companion 硬件开始出现；M5Stack 正在推 StackChan 和 AI Pyramid；Home Assistant 推本地 AI 智能家居。

市场切入：

> AI 重度桌面用户和 maker 社区。

M5Stack 关联：

> xiaoke-room 可以成为 StackChan/CoreS3/AI Pyramid 的人格 OS 和示范应用。

商业模式：

> B2C subscription + 角色资产 + M5Stack bundle/plugin + creator SDK + 教育课程。

护城河：

> 角色上下文数据、情绪状态机、跨设备动作协议、creator/maker 生态。

Demo 必杀：

> 她看到我连续工作 4 小时，不是弹通知，而是从床上起来、皱眉、走到桌边说：“都四个小时了...该休息了吧。” 同一条 mood/action 指令还能驱动 StackChan 的表情、舵机和 LED。

## 11. 资料来源

- M5Stack About Us：https://m5stack.com/about-us
- Espressif 收购 M5Stack 控股权：https://www.espressif.com/en/news/Espressif_Acquires_M5Stack
- M5Stack StackChan Kickstarter 公告：https://shop.m5stack.com/blogs/news/stackchan-by-m5stack-now-available-on-kickstarter
- M5Stack StackChan 产品页：https://shop.m5stack.com/products/stackchan-kawaii-co-created-open-source-ai-desktop-robot
- M5Stack AI Pyramid 公告：https://shop.m5stack.com/blogs/news/m5stack-releases-ai-pyramid-high-performance-edge-ai-pc-for-developers-and-makers
- M5Stack LLM630 Compute Kit 文档：https://docs.m5stack.com/en/Core/LLM630%20Compute%20Kit
- M5Stack Home Assistant CoreS3 教程：https://shop.m5stack.com/blogs/blog/from-hardware-to-voice-intelligence-building-your-own-home-assistant-voice-assistant-with-m5stack-cores3
- Sensor Tower 2024 AI Apps Market Insights：https://sensortower.com/blog/state-of-ai-apps-2024
- Sensor Tower 2025 State of Mobile AI：https://sensortower.com/blog/2025-state-of-mobile-ai-is-everywhere-on-mobile
- Common Sense Media teen AI companions report：https://www.commonsensemedia.org/press-releases/nearly-3-in-4-teens-have-used-ai-companions-new-national-survey-finds
- Razer Project AVA：https://www.razer.com/newsroom/product-news/project-ava/
- Razer Project AVA concept page：https://www.razer.com/concepts/project-ava
- Napster View help page：https://help.napster.ai/hc/en-us/articles/33255612030615-What-is-Napster-View
- LOOI Robot：https://looirobot.com/products/looi-robot
- Home Assistant AI-powered local smart home：https://www.home-assistant.io/blog/2025/09/11/ai-in-home-assistant/
- Gallup State of the Global Workplace 2026 data：https://www.gallup.com/workplace/697904/state-of-the-global-workplace-global-data.aspx
- a16z Top 100 Gen AI Consumer Apps, 6th edition：https://a16z.com/100-gen-ai-apps-6/
