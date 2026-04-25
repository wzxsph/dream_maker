# 造梦 V1 实现方案：H5 + Node.js + AI 分段生成互动短剧

## 1. 项目目标

实现一个最小可用但完整的 AI 互动短剧产品。

用户输入一句脑洞，系统通过 AI 生成第一段互动剧情。用户通过二选一选项推进剧情。到达段落末尾时，用户可以选择：

1. 继续当前剧情
2. 用一句话改写接下来的剧情

后端根据当前故事状态、最近剧情、用户选择和可选剧情干预，调用大模型继续生成下一段剧情。

每局故事由 3 个剧情段落组成，每段 3-5 个节点，总体验时长约 3-5 分钟。中途插入一次预置广告卡点，不接真实广告 SDK。

核心卖点：

> 一句话开局，随时改写命运。

---

## 2. 技术栈

### 前端

使用原生 H5：

```txt
HTML + CSS + JavaScript
```

不使用 Vue、React、Angular 等框架。

前端职责：

```txt
1. 首页输入脑洞
2. 调用后端创建故事
3. 播放剧情节点
4. 展示二选一选项
5. 处理续写点
6. 处理可选剧情改写
7. 展示预置广告弹窗
8. 合并后端返回的新剧情 chunk
9. 支持刷新后从 story_id 恢复故事
```

---

### 后端

使用：

```txt
Node.js + Express
```

后端职责：

```txt
1. 提供 HTTP API
2. 调用大模型 API
3. 管理 story_session
4. 本地保存 JSON 文件
5. 校验 AI 返回格式
6. 校验剧情节点图
7. 插入预置广告节点
8. 提供 mock AI 兜底
```

---

### 存储

不使用数据库。

使用后端本地文件保存故事：

```txt
backend/stories/{story_id}.json
```

每个故事一个 JSON 文件。

---

## 3. 项目目录结构

```txt
dream/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   ├── global.css
│   │   └── effects.css
│   └── js/
│       ├── app.js
│       ├── api.js
│       ├── storyPlayer.js
│       ├── ui.js
│       └── utils.js
│
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── .env.example
│   ├── stories/
│   │   └── .gitkeep
│   ├── services/
│   │   ├── aiService.js
│   │   ├── initialStoryPipeline.js
│   │   ├── continueStoryPipeline.js
│   │   ├── storySessionService.js
│   │   ├── storyStateService.js
│   │   ├── storyValidator.js
│   │   ├── graphValidator.js
│   │   ├── paywallService.js
│   │   ├── moderationService.js
│   │   └── storageService.js
│   ├── prompts/
│   │   ├── initialStatePrompt.js
│   │   ├── initialChunkPrompt.js
│   │   ├── continueChunkPrompt.js
│   │   └── repairPrompt.js
│   ├── mock/
│   │   ├── mockInitial.js
│   │   └── mockContinue.js
│   ├── schemas/
│   │   ├── chunkSchema.js
│   │   └── storySessionSchema.js
│   └── utils/
│       ├── id.js
│       └── json.js
```

---

## 4. 核心产品规则

### 4.1 故事结构

每个故事最多 3 个 chunk：

```txt
chunk_1：开局冲突
chunk_2：中段反转，可体现用户改写
chunk_3：高潮与结局
```

每个 chunk 包含：

```txt
3-5 个剧情节点
每个非结局节点最多 2 个选项
每个节点 text 建议 60-180 字
```

---

### 4.2 用户输入

用户有两类输入。

#### 初始脑洞

必填。

示例：

```txt
我重生回到了假千金把我推下楼梯那天
```

#### 中途剧情干预

可选。

示例：

```txt
我要觉醒能听见所有人心声的系统
```

用户不输入中途干预时，系统根据当前剧情自然续写。

---

### 4.3 续写点规则

当当前节点的选项 `next_node` 为：

```txt
__GENERATE_NEXT__
```

前端不要直接跳转节点，而是展示续写面板：

```txt
下一幕即将展开

[继续当前剧情]
[改写接下来的剧情]
```

用户点击“继续当前剧情”：

```json
{
  "mode": "continue",
  "intervention": ""
}
```

用户点击“改写接下来的剧情”：

```json
{
  "mode": "rewrite",
  "intervention": "用户输入内容"
}
```

---

### 4.4 广告规则

不接真实广告 SDK。

只做预置广告弹窗。

规则：

```txt
每个故事只插入 1 个广告节点
广告节点出现在 chunk_2 末尾
广告节点 is_paywall = true
paywall_type = "preset_ad"
广告倒计时默认 5 秒
倒计时结束后用户可点击继续剧情
```

广告节点的选项指向：

```txt
__GENERATE_NEXT__
```

广告解锁后进入 chunk_3。

---

## 5. 数据结构

### 5.1 Story Session

每个故事保存为一个本地 JSON 文件。

文件路径：

```txt
backend/stories/{story_id}.json
```

结构：

```json
{
  "story_id": "story_xxxxxxxx",
  "title": "故事标题",
  "status": "playing",
  "max_chunks": 3,
  "current_chunk_index": 1,
  "story_state": {
    "genre": "",
    "tone": "",
    "current_phase": "",
    "protagonist": {
      "name": "",
      "identity": "",
      "goal": ""
    },
    "characters": [],
    "facts": [],
    "open_threads": [],
    "constraints": []
  },
  "chunks": [],
  "node_index": {},
  "player_path": [],
  "interventions": [],
  "created_at": "ISO_TIME",
  "updated_at": "ISO_TIME"
}
```

---

### 5.2 Story State

`story_state` 用于记录故事摘要，不保存完整正文。

```json
{
  "genre": "rebirth_revenge",
  "tone": "爽文，高反转，强情绪，短平快",
  "current_phase": "opening",
  "protagonist": {
    "name": "许晚",
    "identity": "被抱错的真千金",
    "goal": "夺回人生，揭穿假千金"
  },
  "characters": [
    {
      "name": "林婉儿",
      "role": "假千金",
      "status": "正在装可怜，试图陷害主角"
    }
  ],
  "facts": [
    "主角重生回到被假千金推下楼梯当天"
  ],
  "open_threads": [
    "假千金的谎言尚未公开"
  ],
  "constraints": [
    "不要推翻已发生事实",
    "不要突然引入过多新角色",
    "每段剧情保持高冲突和强反转"
  ]
}
```

---

### 5.3 Chunk

```json
{
  "chunk_id": "chunk_1",
  "chunk_index": 1,
  "type": "opening",
  "start_node": "node_0",
  "end_nodes": ["node_4_a", "node_4_b"],
  "nodes": {
    "node_0": {}
  }
}
```

`type` 可选值：

```txt
opening
middle
climax
ending
```

---

### 5.4 Node

```json
{
  "node_id": "node_0",
  "text": "剧情文本",
  "bg_theme": "light",
  "ui_effect": ["flash_white"],
  "is_paywall": false,
  "paywall_type": null,
  "ad_config": null,
  "is_rewrite_point": false,
  "choices": [
    {
      "content": "选项 A",
      "next_node": "node_1_a"
    },
    {
      "content": "选项 B",
      "next_node": "node_1_b"
    }
  ]
}
```

字段说明：

```txt
node_id: 节点唯一 ID
text: 当前剧情文本
bg_theme: light / dark / danger / victory
ui_effect: 动效数组
is_paywall: 是否广告卡点
paywall_type: preset_ad 或 null
ad_config: 广告配置
is_rewrite_point: 是否建议展示改写入口
choices: 分支选项，最多 2 个
```

---

### 5.5 Paywall Node

```json
{
  "node_id": "node_paywall_1",
  "text": "就在你即将公开真相时，眼前的一切突然停滞。系统警告声疯狂响起：【世界意志检测到剧情崩坏，反击权限已被冻结！】",
  "bg_theme": "danger",
  "ui_effect": ["flash_red", "glitch", "shake"],
  "is_paywall": true,
  "paywall_type": "preset_ad",
  "ad_config": {
    "title": "观看广告，解锁「命运反击卡」",
    "duration": 5,
    "button_text": "解锁反击"
  },
  "is_rewrite_point": false,
  "choices": [
    {
      "content": "使用命运反击卡",
      "next_node": "__GENERATE_NEXT__"
    }
  ]
}
```

---

### 5.6 AI 续写输出格式

AI 生成 chunk 时必须返回：

```json
{
  "state_patch": {
    "current_phase": "",
    "facts_add": [],
    "open_threads_add": [],
    "open_threads_resolved": [],
    "characters_update": []
  },
  "chunk": {
    "chunk_id": "",
    "chunk_index": 1,
    "type": "",
    "start_node": "",
    "end_nodes": [],
    "nodes": {}
  }
}
```

---

## 6. 后端 API

### 6.1 创建故事

```http
POST /api/stories
```

请求：

```json
{
  "prompt": "我重生回到了假千金把我推下楼梯那天"
}
```

返回：

```json
{
  "story_id": "story_xxxxxxxx",
  "title": "真千金重生：踢碎反派光环",
  "start_node": "node_0",
  "chunk": {}
}
```

后端流程：

```txt
1. 校验 prompt
2. 生成 story_id
3. 调用 AI 生成 story_state
4. 调用 AI 生成 chunk_1
5. 校验 chunk_1
6. 创建 story_session
7. 保存到 backend/stories/{story_id}.json
8. 返回 story_id 和 chunk_1
```

---

### 6.2 获取故事

```http
GET /api/stories/:storyId
```

返回完整 `story_session`：

```json
{
  "story_id": "story_xxxxxxxx",
  "title": "",
  "status": "playing",
  "max_chunks": 3,
  "current_chunk_index": 1,
  "story_state": {},
  "chunks": [],
  "node_index": {},
  "player_path": [],
  "interventions": [],
  "created_at": "",
  "updated_at": ""
}
```

---

### 6.3 继续故事

```http
POST /api/stories/:storyId/continue
```

请求，不干预剧情：

```json
{
  "current_node_id": "node_4_b",
  "choice_content": "接受命运改写权限",
  "mode": "continue",
  "intervention": ""
}
```

请求，干预剧情：

```json
{
  "current_node_id": "node_4_b",
  "choice_content": "接受命运改写权限",
  "mode": "rewrite",
  "intervention": "我要觉醒能听见所有人心声的系统"
}
```

返回：

```json
{
  "story_id": "story_xxxxxxxx",
  "chunk": {},
  "story_state": {}
}
```

后端流程：

```txt
1. 读取 story_session
2. 校验 current_node_id 是否存在
3. 校验是否还能继续生成 chunk
4. 记录用户 choice_content
5. 如果 mode = rewrite，记录 intervention
6. 构建续写上下文
7. 调用 AI 生成下一段 chunk
8. 校验 chunk
9. 如果 chunk_index = 2，确保 chunk_2 末尾有广告节点
10. 合并 state_patch 到 story_state
11. 合并 chunk 到 story_session
12. 保存 story_session 文件
13. 返回新 chunk
```

---

### 6.4 健康检查

```http
GET /api/health
```

返回：

```json
{
  "ok": true
}
```

---

## 7. 后端实现要求

### 7.1 backend/package.json

```json
{
  "scripts": {
    "dev": "node --watch server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "nanoid": "^5.0.7"
  }
}
```

---

### 7.2 .env.example

```env
PORT=3000
AI_API_KEY=your_api_key_here
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

---

### 7.3 server.js

职责：

```txt
1. 启动 Express
2. 配置 JSON body parser
3. 配置 CORS
4. 托管 frontend 静态资源
5. 注册 API 路由
6. 统一错误处理
```

需要提供：

```txt
GET /api/health
POST /api/stories
GET /api/stories/:storyId
POST /api/stories/:storyId/continue
```

---

### 7.4 aiService.js

职责：

```txt
统一封装大模型调用
```

导出：

```js
async function callLLM({ systemPrompt, userPrompt }) {}
```

要求：

```txt
1. 从 .env 读取 API Key
2. 支持配置模型名称
3. 按 OpenAI Chat Completions 风格实现
4. 返回纯文本
5. 捕获错误并抛出明确异常
6. 如果 AI_API_KEY 不存在，走 mock，不调用真实接口
```

---

### 7.5 storageService.js

职责：

```txt
读写 backend/stories 目录下的 story_session JSON 文件
```

导出：

```js
async function saveStorySession(session) {}
async function loadStorySession(storyId) {}
async function listStorySessions() {}
```

要求：

```txt
1. 保存时 JSON.stringify(session, null, 2)
2. 读取不存在的 storyId 时抛出 404 类型错误
3. 启动后确保 stories 目录存在
```

---

### 7.6 storySessionService.js

职责：

```txt
创建 session
合并 chunk
更新 node_index
记录 player_path
记录 interventions
```

导出：

```js
function createSession({ storyId, title, storyState, firstChunk }) {}
function mergeChunk(session, chunk) {}
function recordPlayerChoice(session, { currentNodeId, choiceContent }) {}
function recordIntervention(session, { currentNodeId, intervention }) {}
function getAllNodes(session) {}
function getRecentNodes(session, count = 5) {}
```

---

### 7.7 storyStateService.js

职责：

```txt
合并 AI 返回的 state_patch
```

导出：

```js
function mergeStatePatch(storyState, statePatch) {}
```

合并规则：

```txt
current_phase: 直接覆盖
facts_add: 追加去重
open_threads_add: 追加去重
open_threads_resolved: 从 open_threads 中移除
characters_update: 按 name 更新，没有则新增
```

---

### 7.8 storyValidator.js

职责：

```txt
校验 AI 返回 JSON 是否符合结构要求
```

使用：

```txt
ajv
```

需要校验：

```txt
1. state_patch 存在
2. chunk 存在
3. chunk.chunk_id 存在
4. chunk.chunk_index 是数字
5. chunk.start_node 存在
6. chunk.nodes 是对象
7. 每个 node 必须有 node_id/text/bg_theme/ui_effect/choices
8. choices 最多 2 个
9. choice.content 和 choice.next_node 必须存在
```

---

### 7.9 graphValidator.js

职责：

```txt
校验 chunk 内部节点图是否可播放
```

需要校验：

```txt
1. chunk.start_node 必须存在于 chunk.nodes
2. node_id 不能重复
3. choices.next_node 必须满足：
   - 指向 chunk.nodes 中存在的节点
   - 或者等于 "__GENERATE_NEXT__"
4. 最后 chunk 必须至少有一个 choices = [] 的结局节点
5. 非最后 chunk 必须至少有一个 "__GENERATE_NEXT__"
```

---

### 7.10 paywallService.js

职责：

```txt
在 chunk_2 末尾插入或规范化广告节点
```

导出：

```js
function ensurePaywallForChunk2(chunk) {}
```

要求：

```txt
1. 只在 chunk_index === 2 时处理
2. 如果 chunk_2 已有 is_paywall=true 节点，则规范化 ad_config
3. 如果没有，则把一个 end_node 替换/追加为 paywall 节点
4. paywall 节点 choices[0].next_node 必须是 "__GENERATE_NEXT__"
5. 一个故事最多只有一个 paywall
```

简单实现建议：

```txt
找到 chunk.end_nodes[0]
将该节点改造成 paywall 节点
保留或重写 text
choices 改为：
[
  {
    "content": "使用命运反击卡",
    "next_node": "__GENERATE_NEXT__"
  }
]
```

---

### 7.11 moderationService.js

职责：

```txt
做简单内容安全检查
```

第一版只做基础规则：

```txt
1. prompt/intervention 不能为空
2. prompt 最大 200 字
3. intervention 最大 100 字
4. 文本中不能包含硬编码 forbiddenWords
```

导出：

```js
function validateUserPrompt(prompt) {}
function validateIntervention(intervention) {}
function moderateGeneratedText(text) {}
function moderateChunk(chunk) {}
```

---

### 7.12 initialStoryPipeline.js

职责：

```txt
创建故事
```

导出：

```js
async function initialStoryPipeline({ userPrompt }) {}
```

流程：

```txt
1. validateUserPrompt(userPrompt)
2. storyId = generateStoryId()
3. storyState = await generateInitialStoryState(userPrompt)
4. chunkResult = await generateInitialChunk(storyState)
5. parse JSON
6. validate chunk
7. validate graph
8. 创建 session
9. 保存 session
10. 返回 { story_id, title, start_node, first_chunk }
```

失败处理：

```txt
1. 如果 AI 返回非 JSON，尝试 extractJson
2. 如果校验失败，调用 repairPrompt 修复一次
3. 修复仍失败，抛出错误
```

---

### 7.13 continueStoryPipeline.js

职责：

```txt
续写故事
```

导出：

```js
async function continueStoryPipeline({
  storyId,
  currentNodeId,
  choiceContent,
  mode,
  intervention
}) {}
```

流程：

```txt
1. 读取 session
2. 检查 session.current_chunk_index < session.max_chunks
3. 检查 currentNodeId 存在
4. 记录玩家选择
5. 如果 mode === "rewrite"，校验并记录 intervention
6. 获取最近 5 个节点
7. 构建 continue prompt
8. 调用 AI 生成 { state_patch, chunk }
9. parse JSON
10. validate chunk
11. validate graph
12. 如果 chunk_index === 2，调用 ensurePaywallForChunk2
13. 合并 state_patch
14. 合并 chunk
15. 保存 session
16. 返回 { chunk, story_state }
```

当已经达到 `max_chunks` 时：

```txt
返回错误：故事已经结束
```

---

## 8. Prompt 文件要求

### 8.1 initialStatePrompt.js

导出函数：

```js
function buildInitialStatePrompt(userPrompt) {}
```

Prompt 内容：

```txt
你是一个互动短剧策划器。

请根据用户输入的一句话脑洞，生成一个适合 H5 竖屏互动短剧的故事状态摘要。

要求：
1. 只返回纯 JSON。
2. 不要返回 Markdown。
3. 不要返回解释。
4. 不要生成完整剧情正文。
5. 故事适合 3-5 分钟短体验。
6. 风格要高冲突、强反转、短平快。
7. 不要包含违法、色情、过度血腥、政治敏感内容。

用户脑洞：
{{userPrompt}}

返回格式：
{
  "title": "",
  "genre": "",
  "tone": "",
  "current_phase": "opening",
  "protagonist": {
    "name": "",
    "identity": "",
    "goal": ""
  },
  "characters": [],
  "facts": [],
  "open_threads": [],
  "constraints": []
}
```

---

### 8.2 initialChunkPrompt.js

导出函数：

```js
function buildInitialChunkPrompt(storyState) {}
```

Prompt 内容：

```txt
你是一个互动短剧剧情节点生成器。

请根据故事状态，生成第一段互动剧情 chunk。

要求：
1. 只返回纯 JSON。
2. 不要返回 Markdown。
3. 生成 3-5 个节点。
4. chunk_id 必须是 "chunk_1"。
5. chunk_index 必须是 1。
6. type 必须是 "opening"。
7. start_node 必须是 "node_0"。
8. 每个 node 必须包含 node_id、text、bg_theme、ui_effect、choices。
9. 每个非结局节点最多 2 个 choices。
10. 第一段不要完结故事。
11. 第一段不要生成广告节点。
12. 至少一个末尾选择的 next_node 必须是 "__GENERATE_NEXT__"。
13. 节奏要高冲突、强反转、短平快。

故事状态：
{{storyState}}

返回格式：
{
  "state_patch": {
    "current_phase": "",
    "facts_add": [],
    "open_threads_add": [],
    "open_threads_resolved": [],
    "characters_update": []
  },
  "chunk": {
    "chunk_id": "chunk_1",
    "chunk_index": 1,
    "type": "opening",
    "start_node": "node_0",
    "end_nodes": [],
    "nodes": {}
  }
}
```

---

### 8.3 continueChunkPrompt.js

导出函数：

```js
function buildContinueChunkPrompt({
  storyState,
  recentNodes,
  choiceContent,
  mode,
  intervention,
  nextChunkIndex,
  maxChunks
}) {}
```

Prompt 内容：

```txt
你是一个互动短剧续写引擎。

请根据当前故事状态、最近剧情、用户刚才选择，以及可选的用户剧情干预，生成下一段互动剧情。

重要规则：
1. 只返回纯 JSON。
2. 不要返回 Markdown。
3. 不要返回解释。
4. 用户干预是可选的。
5. 如果没有用户干预，就自然延续当前剧情。
6. 如果有用户干预，必须在下一段剧情中体现，但不能推翻已发生事实。
7. 生成 3-5 个节点。
8. 每个非结局节点最多 2 个 choices。
9. 不要引入过多新角色。
10. 保持高冲突、强反转、短平快。
11. 如果 nextChunkIndex 小于 maxChunks，至少一个末尾选择的 next_node 必须是 "__GENERATE_NEXT__"。
12. 如果 nextChunkIndex 等于 maxChunks，必须生成至少一个结局节点，结局节点 choices = []。
13. 不要主动生成真实广告内容。

当前故事状态：
{{storyState}}

最近剧情：
{{recentNodes}}

用户刚才选择：
{{choiceContent}}

模式：
{{mode}}

用户剧情干预：
{{interventionOrNone}}

nextChunkIndex:
{{nextChunkIndex}}

maxChunks:
{{maxChunks}}

返回格式：
{
  "state_patch": {
    "current_phase": "",
    "facts_add": [],
    "open_threads_add": [],
    "open_threads_resolved": [],
    "characters_update": []
  },
  "chunk": {
    "chunk_id": "chunk_{{nextChunkIndex}}",
    "chunk_index": {{nextChunkIndex}},
    "type": "middle | climax | ending",
    "start_node": "node_{{some_number}}",
    "end_nodes": [],
    "nodes": {}
  }
}
```

---

### 8.4 repairPrompt.js

导出函数：

```js
function buildRepairPrompt({ invalidJsonText, errors }) {}
```

Prompt 内容：

```txt
你上一次返回的 JSON 不符合要求。

错误如下：
{{errors}}

请修复 JSON。

要求：
1. 只返回修复后的纯 JSON。
2. 不要返回 Markdown。
3. 不要返回解释。
4. 不要改变故事主题。
5. 保持原有剧情大意。
6. 修复所有结构错误、节点跳转错误和字段错误。

原始 JSON：
{{invalidJsonText}}
```

---

## 9. 前端页面结构

前端只使用一个 `index.html`，通过 JavaScript 控制页面状态，不做多页面路由框架。

可以使用 hash 路由：

```txt
#/                 首页
#/story/:storyId   播放页
```

---

## 10. frontend/index.html 要求

页面需要包含以下区域：

```html
<div id="app">
  <section id="homePage" class="page">
    <h1>造梦</h1>
    <p>一句话开局，随时改写命运。</p>

    <textarea id="promptInput" placeholder="输入你的脑洞，例如：我重生回到了假千金把我推下楼梯那天"></textarea>

    <button id="generateBtn">生成我的互动短剧</button>

    <div id="hotPrompts">
      <button class="hot-prompt">我重生回到了假千金把我推下楼梯那天</button>
      <button class="hot-prompt">我觉醒了能听见心声的系统</button>
      <button class="hot-prompt">午夜宿舍门外有人敲门</button>
      <button class="hot-prompt">我穿成了反派的白月光</button>
    </div>
  </section>

  <section id="storyPage" class="page hidden">
    <div id="storyShell">
      <div id="storyTitle"></div>
      <div id="storyText"></div>
      <div id="choices"></div>
      <div id="endingActions" class="hidden">
        <button id="backHomeBtn">重新造梦</button>
      </div>
    </div>
  </section>

  <div id="loadingOverlay" class="overlay hidden">
    <div class="loading-card">
      <div class="loading-spinner"></div>
      <p id="loadingText">正在构建梦境世界...</p>
    </div>
  </div>

  <div id="continuePanel" class="overlay hidden">
    <div class="modal-card">
      <h2>下一幕即将展开</h2>
      <p>你可以继续当前剧情，也可以亲手改写命运。</p>
      <button id="continueBtn">继续当前剧情</button>
      <button id="rewriteBtn">改写接下来的剧情</button>
      <button id="cancelContinueBtn">取消</button>
    </div>
  </div>

  <div id="rewriteModal" class="overlay hidden">
    <div class="modal-card">
      <h2>改写命运</h2>
      <textarea id="interventionInput" placeholder="你想让接下来发生什么？例如：我要觉醒能听见所有人心声的系统"></textarea>
      <button id="submitRewriteBtn">加入剧情</button>
      <button id="skipRewriteBtn">算了，继续当前剧情</button>
    </div>
  </div>

  <div id="adModal" class="overlay hidden">
    <div class="modal-card">
      <h2 id="adTitle">观看广告，解锁剧情</h2>
      <p>世界意志正在干扰你的命运。</p>
      <p id="adCountdown">5</p>
      <button id="adUnlockBtn" disabled>解锁剧情</button>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>
</div>
```

---

## 11. 前端 JS 模块要求

### 11.1 js/api.js

封装后端请求。

导出：

```js
async function createStory(prompt) {}
async function getStory(storyId) {}
async function continueStory(storyId, payload) {}
```

接口：

```txt
POST /api/stories
GET /api/stories/:storyId
POST /api/stories/:storyId/continue
```

---

### 11.2 js/storyPlayer.js

维护前端播放状态。

需要维护：

```js
const state = {
  storyId: null,
  title: '',
  nodesMap: {},
  currentNodeId: null,
  pendingChoice: null,
  currentNode: null
}
```

需要提供：

```js
function initStory(sessionOrCreateResponse) {}
function mergeChunk(chunk) {}
function getCurrentNode() {}
function goToNode(nodeId) {}
function choose(choice) {}
function isEndingNode(node) {}
```

核心逻辑：

```js
function choose(choice) {
  if (choice.next_node === '__GENERATE_NEXT__') {
    state.pendingChoice = choice
    showContinuePanel()
    return
  }

  goToNode(choice.next_node)
}
```

---

### 11.3 js/ui.js

负责 DOM 渲染。

需要提供：

```js
function showHomePage() {}
function showStoryPage() {}
function renderNode(node) {}
function renderChoices(choices) {}
function showLoading(text) {}
function hideLoading() {}
function showToast(message) {}
function showContinuePanel() {}
function hideContinuePanel() {}
function showRewriteModal() {}
function hideRewriteModal() {}
function showPresetAd(adConfig, onUnlocked) {}
function applyTheme(bgTheme) {}
function applyEffects(effects) {}
```

---

### 11.4 js/app.js

入口文件。

职责：

```txt
1. 绑定首页生成按钮事件
2. 绑定热门脑洞按钮事件
3. 绑定选项点击事件
4. 绑定继续剧情按钮
5. 绑定改写剧情按钮
6. 绑定广告解锁按钮
7. 处理 hash 路由
8. 页面刷新后根据 storyId 拉取故事
```

关键流程：

```txt
首页点击生成
↓
POST /api/stories
↓
后端返回 story_id + chunk
↓
前端跳转 #/story/{story_id}
↓
拉取 GET /api/stories/{story_id}
↓
合并 chunks
↓
从 chunk_1.start_node 开始播放
```

---

## 12. 前端视觉要求

整体风格：

```txt
竖屏
深色沉浸背景
大字号剧情文本
大按钮
适合手机单手点击
```

页面布局：

```txt
最大宽度 480px
居中显示
高度 100vh
适配移动端
```

主题：

```txt
light: 明亮渐变
dark: 深色压迫
danger: 红黑危机
victory: 金色/亮色胜利
```

---

### 12.1 global.css 基础要求

需要包含：

```txt
1. body 全屏背景
2. #app 最大宽度 480px 居中
3. .page 页面
4. .hidden 隐藏
5. 剧情卡片样式
6. 选项按钮样式
7. overlay 弹窗样式
8. toast 样式
9. 移动端适配
```

---

### 12.2 effects.css 动效要求

实现以下 class：

```txt
effect-flash-white
effect-flash-red
effect-shake
effect-glitch
effect-success
```

效果说明：

```txt
flash-white: 白光闪烁
flash-red: 红光危机闪烁
shake: 屏幕轻微震动
glitch: 文字或容器轻微错位抖动
success: 胜利光效
```

---

## 13. AI Mock 兜底

为了方便本地开发，如果没有配置 `AI_API_KEY`，后端不要崩溃。

实现 mock AI：

```txt
如果 AI_API_KEY 不存在：
  initialStoryPipeline 使用内置 mock story_state 和 mock chunk_1
  continueStoryPipeline 根据 nextChunkIndex 返回 mock chunk_2 或 mock chunk_3
```

mock 数据必须完整符合正式数据结构。

---

### 13.1 mock chunk_1 要求

```txt
1. chunk_id = chunk_1
2. chunk_index = 1
3. type = opening
4. start_node = node_0
5. 3-5 个节点
6. 末尾 next_node = "__GENERATE_NEXT__"
7. 不包含广告节点
```

---

### 13.2 mock chunk_2 要求

```txt
1. chunk_id = chunk_2
2. chunk_index = 2
3. type = middle
4. 3-5 个节点
5. 末尾包含 paywall node
6. paywall node 的 next_node = "__GENERATE_NEXT__"
```

---

### 13.3 mock chunk_3 要求

```txt
1. chunk_id = chunk_3
2. chunk_index = 3
3. type = ending
4. 3-5 个节点
5. 至少一个结局节点 choices = []
```

---

## 14. JSON 解析与修复

### 14.1 utils/json.js

需要提供：

```js
function safeJsonParse(text) {}
function extractJson(text) {}
```

要求：

```txt
1. 优先直接 JSON.parse
2. 如果失败，尝试从文本中提取第一个完整 JSON 对象
3. 去除 ```json 和 ``` 包裹
4. 仍失败则返回 null
```

---

### 14.2 失败修复流程

AI 返回格式错误时：

```txt
第一次失败：
  使用 repairPrompt 让 AI 修复一次

修复仍失败：
  抛出错误

如果没有 AI_API_KEY：
  使用 mock 数据，不走修复流程
```

---

## 15. 校验规则

### 15.1 Chunk Schema 校验

必须校验：

```txt
1. 返回对象必须包含 state_patch 和 chunk
2. state_patch 必须包含：
   - current_phase
   - facts_add
   - open_threads_add
   - open_threads_resolved
   - characters_update
3. chunk 必须包含：
   - chunk_id
   - chunk_index
   - type
   - start_node
   - end_nodes
   - nodes
4. nodes 必须是对象
5. 每个 node 必须包含：
   - node_id
   - text
   - bg_theme
   - ui_effect
   - choices
6. choices 必须是数组
7. choices 最多 2 个
8. 每个 choice 必须包含：
   - content
   - next_node
```

---

### 15.2 Graph 校验

必须校验：

```txt
1. chunk.start_node 必须存在于 chunk.nodes
2. chunk.end_nodes 中的节点必须存在
3. 每个 node 的 node_id 必须等于它在 nodes 对象中的 key
4. choices.next_node 必须满足：
   - 指向 chunk.nodes 中存在的节点
   - 或者等于 "__GENERATE_NEXT__"
5. 如果 chunk_index < max_chunks：
   - 必须至少有一个 choice.next_node = "__GENERATE_NEXT__"
6. 如果 chunk_index === max_chunks：
   - 必须至少有一个 node.choices = []
```

---

## 16. 错误处理

### 16.1 后端错误格式

统一返回：

```json
{
  "message": "错误信息"
}
```

状态码：

```txt
400 参数错误
404 故事不存在
500 生成失败 / 服务错误
```

---

### 16.2 前端错误提示

需要处理：

```txt
1. 生成失败
2. 续写失败
3. 故事不存在
4. 网络错误
5. AI 返回异常
```

展示文案：

```txt
梦境生成失败，请换个脑洞试试
剧情续写失败，请重试
这个故事不存在或已被删除
网络异常，请稍后再试
```

---

## 17. 运行方式

### 17.1 后端

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

默认端口：

```txt
3000
```

---

### 17.2 前端

前端是纯静态文件，有两种运行方式。

方式一：直接由后端托管。

```bash
cd backend
npm run dev
```

然后访问：

```txt
http://localhost:3000
```

方式二：用任意静态服务打开 `frontend/index.html`。

但推荐方式一，避免跨域问题。

---

## 18. server.js 静态托管要求

后端需要托管前端目录：

```js
app.use(express.static(path.join(__dirname, '../frontend')))
```

当访问根路径 `/` 时，返回：

```txt
frontend/index.html
```

---

## 19. 验收标准

### 流程 1：创建故事

```txt
打开首页
输入：我重生回到了假千金把我推下楼梯那天
点击生成
进入播放页
看到第一段剧情
可以点击 A/B 选项推进
```

---

### 流程 2：自然续写

```txt
玩到 chunk_1 末尾
出现“下一幕即将展开”
点击“继续当前剧情”
后端生成 chunk_2
前端继续播放新剧情
```

---

### 流程 3：改写续写

```txt
玩到续写点
点击“改写接下来的剧情”
输入：我要觉醒能听见所有人心声的系统
提交
后端生成 chunk_2
新剧情中体现“听见心声”
```

---

### 流程 4：广告卡点

```txt
chunk_2 末尾出现广告节点
弹出预置广告层
倒计时 5 秒
倒计时结束后点击解锁
继续进入 chunk_3
```

---

### 流程 5：结局

```txt
chunk_3 生成结局节点
结局节点 choices = []
前端展示“故事结束”
可返回首页重新生成
```

---

## 20. 实现优先级

请按以下顺序实现：

```txt
1. 后端 Express 服务和健康检查
2. 前端 index.html + 基础样式
3. 本地 story_session 文件读写
4. mock AI 数据跑通完整流程
5. 首页创建故事
6. 播放页状态机
7. 续写面板
8. 改写输入弹窗
9. 预置广告弹窗
10. 接入真实 AI API
11. JSON Schema 校验
12. Graph 校验
13. AI 修复流程
14. CSS 动效和移动端视觉优化
```

优先保证主流程跑通，再优化视觉和 AI 稳定性。

---

## 21. 最终产品定义

实现后的版本应是：

```txt
一个 H5 互动短剧生成器。

用户输入一句脑洞开局。
AI 生成第一幕。
用户通过二选一推进。
每到关键节点，用户可以选择自然续写，也可以输入一句话改写后续剧情。
AI 分段生成下一幕。
中途出现一次预置广告卡点。
最终在第三段剧情中收束到结局。
```

核心卖点：

```txt
一句话开局，随时改写命运。
```
