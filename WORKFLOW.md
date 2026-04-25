# 造梦 (Dream Maker) — 互动短篇小说工作流

## 项目概述

**造梦**是一个 H5 互动短剧生成器。用户输入一句"脑洞"，AI 生成一段有分支的3幕互动短剧，包含选择点、视觉主题和 UI 特效。玩家在每个续写点可以选择继续当前剧情，或输入一句话改写后续剧情。

- **前端**：原生 HTML + CSS + JavaScript
- **后端**：Node.js + Express
- **存储**：本地 JSON 文件（`backend/stories/{story_id}.json`）
- **AI**：MiniMax Anthropic 兼容 API（未配置 key 时自动走 mock 兜底）

---

## 用户旅程总览

```
[首页] → 输入脑洞
  ↓
[加载页] "正在生成第一幕..."
  ↓
[第一幕] 阅读剧情 → 二选一
  ↓
[续写面板] 继续当前剧情 / 改写剧情 / 取消
  ↓
[渐进式生成] 预览节点 → 轮询 → 真实下一幕
  ↓
[第二幕] 阅读剧情 → 二选一
  ↓
[续写面板] 继续当前剧情 / 改写剧情 / 取消
  ↓
[广告卡点] 5秒倒计时 → 解锁
  ↓
[渐进式生成] 预览节点 → 轮询 → 真实下一幕
  ↓
[第三幕] 阅读剧情 → 二选一
  ↓
[结局] "故事结束" + "重新造梦"
```

---

## 1. 故事创建 — POST /api/stories

### 用户操作
在首页输入脑洞，点击 **"生成我的互动短剧"**。

### 前端流程
1. 校验非空（最多200字）
2. 显示全屏加载遮罩，文字为 **"正在生成第一幕..."**
3. 调用 `POST /api/stories`，请求体 `{ prompt }`
4. 收到响应 `{ story_id, title, start_node, chunk }`
5. 从 `chunk.nodes` 构建 `nodesMap`
6. `renderNode()` 渲染起始节点的文字和选项按钮
7. URL hash 变为 `#/story/{storyId}`
8. 当前节点持久化到 `localStorage`

### 后端 Pipeline（`initialStoryPipeline`）
1. **内容安全校验** — `moderationService.validateUserPrompt()` 检查敏感词
2. **生成故事ID** — `nanoid`
3. **AI 调用** — `callLLM()` 使用 `buildInitialStoryPrompt`，一次性生成：
   - `title`：故事标题
   - `story_state`：流派、基调、当前幕数、主角、角色、事实、悬念、约束
   - `state_patch`：初始状态变更
   - `chunk`：第一幕节点图（node_0, node_1_a, node_1_b, node_2）
4. **JSON 解析** — `aiJsonService.parseAndValidateAiJson()`
   - 尝试直接解析
   - 失败则调用 AI 配合 `buildRepairPrompt` 修复 JSON
   - 使用 AJV + `chunkResultSchema` 校验
5. **规范化** — `storyNormalizer.normalizeStoryResult()`
   - 修正主题名称
   - 去重并限制选项数量
   - 清除无效的 UI 特效
6. **图结构校验** — `graphValidator.validateChunkGraph()`
   - 确认 `start_node` 存在
   - 确认所有 `end_nodes` 可达
   - 确认无孤立节点
   - 确认非最终幕包含 `__GENERATE_NEXT__`
7. **内容审核** — `moderationService.moderateChunk()` 拒绝违禁词
8. **状态合并** — `storyStateService.mergeStatePatch()` 更新幕数/事实/悬念/角色
9. **构建卡片** — `storyCardService.buildStoryCards()` 创建5张上下文卡片：
   - `idea_seed`：原始脑洞
   - `premise`：故事卖点
   - `protagonist`：主角卡
   - `character`：角色卡
   - `style_guide`：短剧写作指南
10. **创建会话** — `storySessionService.createSession()` 组装会话对象
11. **存储** — `storageService.saveStorySession()` 写入 `backend/stories/{storyId}.json`
12. **返回** `{ story_id, title, start_node, chunk }`

### AI Prompt（初始生成）
初始 prompt 指示 AI 输出单一 JSON 对象，包含：
- `title`：吸引人的故事标题
- `story_state`：结构化故事元数据
- `state_patch`：初始状态变更
- `chunk`：第一幕节点图

第一幕节点结构：
```
node_0 (start_node) → node_1_a / node_1_b → node_2 (__GENERATE_NEXT__)
```

---

## 2. 故事播放 — 节点与选择

### 前端状态（`storyPlayer.js`）
```js
state = {
  storyId,        // 当前故事 ID
  title,          // 故事标题
  nodesMap,       // 所有节点，key 为 node_id
  currentNodeId,  // 当前节点 ID
  pendingChoice, // 等待生成的选项
  currentNode    // 当前节点引用
}
```

### 节点展示
- `#storyTitle` — 故事标题（如"真千金重生：踢碎反派光环"）
- `#storyText` — 节点文字（大号粗体）
- `#choices` — 1~2个选项按钮，显示具体行动文字
- `applyTheme(node.bg_theme)` — dark / light / danger / victory
- `applyEffects(node.ui_effect)` — flash_white / flash_red / shake / glitch / success

### 选择处理（`handleChoice`）
1. 玩家点击选项按钮
2. `choose(choice)` 判断 `next_node === '__GENERATE_NEXT__'`
3. 普通节点：`goToNode(choice.next_node)` 更新状态并重新渲染
4. `__GENERATE_NEXT__`：
   - 设置 `state.pendingChoice = choice`
   - 弹出 `#continuePanel` 遮罩
   - 返回 `{ type: 'generate', choice }`

---

## 3. 续写点 — 续写面板

### 用户选项
当选择导致 `__GENERATE_NEXT__` 时，弹出面板提供三个按钮：

| 按钮 | 行为 |
|------|------|
| **继续当前剧情** | `generateNext('continue', '')` — 继续主线 |
| **改写接下来的剧情** | 弹出 `#rewriteModal`，用户输入干预内容 |
| **取消** | 关闭面板，维持在当前节点 |

### 改写弹窗
- 文本框供用户输入干预（最多100字）
- **"加入剧情"** → `generateNext('rewrite', intervention)`
- **"算了，继续当前剧情"** → `generateNext('continue', '')`（放弃改写）

---

## 4. 渐进式生成

### 前端流程（`generateNext`）
1. 调用 `POST /api/stories/{storyId}/continue/progressive`，请求体：
   ```json
   {
     "current_node_id": "node_2",
     "choice_content": "推开那扇门",
     "mode": "rewrite",
     "intervention": "觉醒读心系统"
   }
   ```
2. 后端立即返回（HTTP 202）：
   ```json
   {
     "status": "generating",
     "job_id": "job_xxxxx",
     "preview_node": { "node_id": "...", "text": "...", "is_generating": true }
   }
   ```
3. 前端：
   - `mergePreviewNode(preview_node)` 将预览节点加入 `nodesMap`
   - `goToNode(preview_node.node_id)` 跳转到预览节点
   - `renderCurrentNode()` 以 **"后续剧情生成中..."**（禁用按钮）展示预览
   - 每约 1.2s 轮询 `GET /api/generation-jobs/{jobId}`
4. 收到 `status: 'done'`：将完整 chunk 合并进 `nodesMap`，替换预览节点为真实节点
5. 收到 `status: 'error'`：展示错误，允许重试

### 后端 Pipeline（`progressiveContinuePipeline`）
1. 从存储加载会话
2. 校验 `current_chunk_index < max_chunks`（最大3幕）
3. 校验当前节点存在
4. 构建 `continuityContext`：
   - `current_node_text` — 玩家刚读完的节点文字
   - `selected_choice` — 玩家刚做的选择
   - `recent_path` — 最近访问的3个节点
   - `intervention` — 玩家的改写输入（如有）
5. **仅生成预览节点** — `callLLM()` 使用 `buildPreviewNodePrompt`（最多360 tokens）
   - 返回下一幕的起始节点
   - AI 调用失败时回退到本地备用文本
6. **启动异步任务** — `generationJobService.startGenerationJob()`
   - 后台执行 `continueStoryPipeline`
   - 立即返回 `job_id`
7. 返回 `{ status: 'generating', job_id, preview_node }`

### 后端 Pipeline（`continueStoryPipeline`）— 后台任务
1. 从存储加载会话
2. 构建 `continuityContext`（同上）
3. **AI 调用** — `callLLM()` 使用 `buildContinueChunkPrompt`
   - 第二幕固定图：`node_5 → node_6_a / node_6_b → node_7 → __GENERATE_NEXT__`
   - 第三幕固定图：`node_8 → node_9_a / node_9_b → node_10_ending`（空选项 = 结局）
4. **解析、校验、规范化** — 同初始生成
5. **广告墙逻辑**：
   - 第二幕：`ensurePaywallForChunk2()` 将最后一个节点转为 `is_paywall: true, paywall_type: 'preset_ad'`
   - 第三幕：`stripPaywallsOutsideChunk2()` 移除所有广告墙标记
6. **图结构校验** — 同初始生成
7. **内容审核** — 同初始生成
8. **状态合并** — 将 `state_patch` 合并入 `story_state`
9. **合并 chunk** — 将新 chunk 加入会话
10. **同步卡片** — 更新 story cards
11. **保存会话**
12. 设置任务状态为 `done` 并附带结果

### 任务轮询（GET /api/generation-jobs/:jobId）
- 返回 `{ job_id, status, result/error, created_at, updated_at }`
- 状态流转：`pending` → `running` → `done` / `error`
- 任务10分钟后过期（TTL 清理）

---

## 5. 广告卡点（仅第二幕末尾）

### 触发条件
玩家到达第二幕最后一个节点，该节点 `is_paywall: true`。

### 广告内容
- 标题：**"抖音 AI 创变者黑客松大赛"**
- 5秒倒计时
- 解锁按钮：**"完成观看，返回剧情"**

### 解锁流程
1. 玩家点击广告墙选项 → `handleChoice` 检测到 `is_paywall`
2. 若尚未解锁（通过 `localStorage` 键 `zaomeng.unlockedPaywall.{storyId}.{nodeId}` 判断）：
   - 弹出广告弹窗，开始倒计时
3. 倒计时归零 → 解锁按钮可点击
4. 玩家点击解锁 → 写入 `localStorage`，关闭弹窗，允许继续

### 后端处理
- 第二幕末尾节点：由 `paywallService.ensurePaywallForChunk2()` 注入广告配置
- 第三幕：所有广告墙标记由 `paywallService.stripPaywallsOutsideChunk2()` 清除

---

## 6. 故事结局（第三幕）

### 标志
结局节点的 `choices` 为空数组（`choices: []`）。

### 前端展示
- 不显示选项按钮
- 展示 `#endingActions`：
  - "故事结束" 文字
  - **"重新造梦"** 按钮 → 跳转至 `#/`（首页）

---

## 7. 视觉主题与特效

### 背景主题（`applyTheme`）

| 主题 | 描述 |
|------|------|
| `dark`（默认） | 暖色深色渐变 |
| `light` | 冷调蓝灰色 |
| `danger` | 深红色调 |
| `victory` | 金绿色调 |

### UI 特效（`applyEffects`）

| 特效 | CSS 类名 | 行为 |
|------|---------|------|
| `flash_white` | `.fx-flash-white` | `#app` 白色闪光 |
| `flash_red` | `.fx-flash-red` | `#app` 红色闪光 |
| `shake` | `.fx-shake` | `#app` 水平抖动 |
| `glitch` | `.fx-glitch` | `#app` RGB 分离故障效果 |
| `success` | `.fx-success` | `#app` 短暂绿色脉冲 |

特效通过 `setTimeout` 在 950ms 后移除。

---

## 8. 会话数据结构

### 存储于 `backend/stories/{storyId}.json`

```json
{
  "story_id": "story_xxxxx",
  "title": "真千金重生：踢碎反派光环",
  "status": "active",
  "max_chunks": 3,
  "current_chunk_index": 1,
  "story_state": {
    "genre": "都市重生",
    "tone": "紧张刺激",
    "current_phase": "第二幕",
    "protagonist": { "name": "...", "description": "..." },
    "characters": [...],
    "facts": [...],
    "open_threads": [...],
    "constraints": []
  },
  "chunks": [
    { "chunk_id": "chunk_1", "chunk_index": 0, "type": "start", "nodes": [...] },
    { "chunk_id": "chunk_2", "chunk_index": 1, "type": "middle", "nodes": [...] },
    { "chunk_id": "chunk_3", "chunk_index": 2, "type": "ending", "nodes": [...] }
  ],
  "cards": {
    "idea_seed": "...",
    "premise": "...",
    "protagonist": "...",
    "characters": [...],
    "style_guide": "..."
  },
  "node_index": {
    "node_0": { "chunk_id": "chunk_1", "chunk_index": 0 },
    "node_1_a": { "chunk_id": "chunk_1", "chunk_index": 0 }
  },
  "player_path": [
    { "current_node_id": "node_0", "choice_content": "推开那扇门", "created_at": "..." },
    { "current_node_id": "node_1_a", "choice_content": "进入下一幕", "created_at": "..." }
  ],
  "interventions": [
    { "current_node_id": "node_2", "intervention": "觉醒读心系统", "created_at": "..." }
  ],
  "created_at": "...",
  "updated_at": "..."
}
```

---

## 9. API 参考

| 方法 | 路径 | 用途 | 响应 |
|------|------|------|------|
| `GET` | `/api/health` | 健康检查 | `{ ok: true }` |
| `POST` | `/api/stories` | 创建新故事 | `{ story_id, title, start_node, chunk }` |
| `GET` | `/api/stories/:storyId` | 加载完整故事 | 完整会话对象 |
| `GET` | `/api/stories/:storyId/cards` | 获取上下文卡片 | `{ cards }` |
| `POST` | `/api/stories/:storyId/continue` | 生成下一 chunk（同步阻塞） | `{ story_id, chunk, story_state }` |
| `POST` | `/api/stories/:storyId/continue/progressive` | 生成下一 chunk（异步） | HTTP 202: `{ status, job_id, preview_node }` |
| `GET` | `/api/generation-jobs/:jobId` | 轮询任务状态 | `{ job_id, status, result/error }` |

---

## 10. 目录结构

```
frontend/
  index.html
  css/
    global.css
    effects.css
  js/
    api.js          — fetch 封装
    app.js          — 页面路由，hash 导航
    storyPlayer.js  — 核心状态机，节点渲染
    ui.js           — 主题/特效应用
    utils.js        — localStorage 工具

backend/
  server.js
  services/
    initialStoryPipeline.js       — 故事创建 pipeline
    continueStoryPipeline.js       — 同步续写 pipeline
    progressiveContinuePipeline.js  — 异步续写 pipeline
    aiService.js                   — LLM API 调用（MiniMax/OpenAI）
    aiJsonService.js               — JSON 解析/修复/校验
    storySessionService.js         — 会话组装
    storyNormalizer.js             — 节点规范化，桥接句
    paywallService.js              — 广告注入/剥离
    storyStateService.js           — 状态合并
    moderationService.js           — 内容安全
    graphValidator.js              — 节点图校验
    storyValidator.js              — 会话级别校验
    storyCardService.js            — 上下文卡片构建
    generationJobService.js        — 异步任务管理
    storageService.js               — JSON 文件持久化
  prompts/
    initialStoryPrompt.js
    continueChunkPrompt.js
    previewNodePrompt.js
    repairPrompt.js
  mock/
    mockInitial.js
    mockContinue.js
  stories/                          — 故事 JSON 存储目录
  schemas/
    chunkSchema.js                 — AJV chunk 校验 schema
  utils/
    json.js
    errors.js
    id.js
```

---

## 11. 关键设计模式

### 连续性强制

每次续写 prompt 都会注入 `continuityContext`：
- `current_node_text` — 玩家刚读完的节点
- `selected_choice` — 玩家刚做的选择
- `recent_path` — 最近访问的3个节点
- `intervention` — 玩家的改写输入（如有）

Prompt 明确要求新 chunk 的 `start_node.text` 必须**直接承接**玩家选择，防止场景跳跃或主线断裂。

### 桥接句

`storyNormalizer.reinforceChunkContinuity()` 会在 AI 未能自然衔接玩家选择时，自动在 `start_node.text` 前面插入一段自然过渡句（如面对冲突型选择时插入"你的话音落下，空气像被骤然绷紧。"）。

### 第二幕/第三幕的固定图结构

- **第二幕**：`node_5 → node_6_a / node_6_b → node_7 → __GENERATE_NEXT__`
- **第三幕**：`node_8 → node_9_a / node_9_b → node_10_ending`（空选项 = 结局）

这保证了所有生成故事的情节节奏一致。

### JSON-Only 输出

所有 AI prompt 均明确要求：**"只返回纯 JSON，不要 Markdown，不要解释"**。`aiJsonService` 负责从 AI 返回内容中提取、修复和校验原始 JSON。

### 状态累积

`story_state` 随每个 chunk 累积：
- `facts` — 故事事实随节点增加
- `open_threads` — 新悬念被添加，已解决悬念被移除
- `characters` — 角色被添加/更新
- `player_path` — 记录每一次选择
- `interventions` — 记录每一次改写输入
