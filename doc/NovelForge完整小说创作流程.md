# NovelForge 完整小说创作流程详解

## 一、系统概览

NovelForge 是一套基于「雪花创作法」（Snowflake Method）的 AI 辅助长篇小说写作系统。其核心设计思想是将一部小说的创作过程分解为从宏观到微观的多个层次，每个层次都有对应的数据结构和 AI 辅助工具。

### 1.1 核心创作流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          雪花创作法三阶段                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  【第一阶段：扩展】          【第二阶段：深化】         【第三阶段：撰写】  │
│                                                                         │
│  一句话梗概 ──────────────→  世界观设定 ────────────→  章节正文          │
│       ↓                         ↓                      ↓               │
│  故事大纲 ──────────────→  核心蓝图 ────────────→  阶段大纲           │
│       ↓                         ↓                      ↓               │
│                          分卷大纲 ────────────→  章节大纲             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 卡片类型层级

NovelForge 使用「卡片」作为基本创作单元，卡片类型之间存在严格的父子层级关系：

```
Project（项目）
│
├── 作品标签（全局单例）
├── 金手指（全局单例）
│
├── 一句话梗概（全局单例）
│   └── 作品标签、金手指
│
├── 故事大纲（全局单例）
│   └── 作品标签、金手指、一句话梗概
│
├── 世界观设定（全局单例）
│   └── 作品标签、金手指、故事大纲
│
├── 核心蓝图（全局单例）
│   ├── 作品标签、金手指、故事大纲、世界观
│   ├── 组织卡（子卡片，自动创建）
│   └── 场景卡、角色卡（子卡片，自动创建）
│   │
│   └── 分卷大纲 1 ──────────┐
│   └── 分卷大纲 2 ──────────┼──→ 阶段大纲 × N ──→ 章节大纲 × M ──→ 章节正文
│   └── 分卷大纲 N ──────────┘
│       │
│       └── 写作指南
│
└── 关系图谱（独立系统）
    └── KGRelation（角色-角色、角色-组织、角色-物品等关系）
```

---

## 二、项目初始化

### 2.1 创建新项目

用户通过 GUI 或 CLI 创建一个新项目，并指定使用「雪花创作法」模板：

```bash
# CLI 方式
uv run python cli.py project new \
  --name "星际探索" \
  --description "宇宙探险题材小说"
```

### 2.2 自动初始化工作流

当项目创建时触发 `Trigger.ProjectCreated(template="snowflake")`，系统自动执行 **项目创建·雪花创作法.wf** 工作流：

```python
# 工作流节点按顺序执行：
1. 创建「作品标签」卡片
2. 创建「金手指」卡片
3. 创建「一句话梗概」卡片
4. 创建「故事大纲」卡片
5. 创建「世界观设定」卡片
6. 创建「核心蓝图」卡片
```

**关键实现**：见 `backend/app/bootstrap/workflows/项目创建·雪花创作法.wf`

---

## 三、宏观设计阶段

### 3.1 一句话梗概（核心种子）

**卡片类型**：`一句话梗概`
**Schema 字段**：
- `one_sentence_thinking`：一句话梗概的设计思考
- `one_sentence`：一句话梗概正文
- `theme`：主题
- `audience`：目标读者
- `narrative_person`：叙事人称
- `story_tags`：故事标签
- `affection`：情感关系

**AI 辅助**：
- 使用提示词「一句话梗概」
- 温度 0.6，最大 token 4096

**上下文注入**：
```
作品标签: @作品标签.content
金手指/特殊能力: @金手指.content.special_abilities
```

**生成目标**：用一句话（通常 25-50 字）概括整本书的核心故事。

### 3.2 故事大纲

**卡片类型**：`故事大纲`
**Schema 字段**：
- `overview_thinking`：大纲扩展思考
- `overview`：概述（核心内容）
- `power_structure`：权力结构
- `currency_system`：货币体系
- `background`：背景

**AI 辅助**：
- 使用提示词「一段话大纲」
- 温度 0.7，最大 token 8192

**上下文注入**：
```
作品标签: @作品标签.content
金手指/特殊能力: @金手指.content.special_abilities
故事梗概: @一句话梗概.content.one_sentence
```

**生成目标**：将一句话梗概扩展为一段话（500-1000 字）的大纲。

### 3.3 世界观设定

**卡片类型**：`世界观设定`
**Schema 字段**：
- `world_view_thinking`：世界观设计思考
- `world_view`：世界观正文
- `major_power_camps`：主要势力阵营

**AI 辅助**：
- 使用提示词「世界观设定」
- 温度 0.7，最大 token 4096

**上下文注入**：
```
作品标签: @作品标签.content
金手指/特殊能力: @金手指.content.special_abilities
故事大纲: @故事大纲.content.overview
```

**生成目标**：定义故事发生的世界的基本规则、地理、势力等。

### 3.4 核心蓝图

**卡片类型**：`核心蓝图`
**Schema 字段**：
- `character_thinking`：角色设计思考
- `character_cards`：角色卡列表（会自动创建为子卡片）
- `scene_thinking`：场景设计思考
- `scene_cards`：场景卡列表（会自动创建为子卡片）
- `organization_thinking`：组织设计思考
- `organization_cards`：组织卡列表（会自动创建为子卡片）
- `volume_count`：总卷数

**AI 辅助**：
- 使用提示词「核心蓝图」
- 温度 0.7，最大 token 8192

**上下文注入**：
```
作品标签: @作品标签.content
金手指/特殊能力: @金手指.content.special_abilities
故事大纲: @故事大纲.content.overview
世界观设定: @世界观设定.content
组织/势力设定: @type:组织卡[previous:global].{content.name,content.description,content.influence,content.relationship}
```

**关键特性**：核心蓝图保存时触发 **核心蓝图.wf** 工作流，自动批量创建：
- 分卷大纲卡片（根据 `volume_count` 创建）
- 角色卡（从 `character_cards` 列表创建）
- 场景卡（从 `scene_cards` 列表创建）
- 组织卡（从 `organization_cards` 列表创建）

```python
# 核心蓝图.wf 关键节点
trigger = Trigger.CardSaved(card_type="核心蓝图")
volumes = Logic.Expression(expression="[{'index': i} for i in range(1, (blueprint.content.volume_count or 0) + 1)]")
vol_cards = Card.BatchUpsert(card_type="分卷大纲", items=volumes.result)
char_cards = Card.BatchUpsert(card_type="角色卡", items=characters.result)
scene_cards = Card.BatchUpsert(card_type="场景卡", items=scenes.result)
```

---

## 四、分卷规划阶段

### 4.1 分卷大纲

**卡片类型**：`分卷大纲`
**Schema 字段**：
- `volume_number`：卷号
- `main_target`：主线目标
- `branch_line`：辅线
- `new_character_cards`：新增角色卡列表
- `new_scene_cards`：新增场景卡列表
- `stage_count`：阶段数量
- `character_action_list`：角色行动列表
- `entity_snapshot`：卷末实体状态快照

**AI 辅助**：
- 使用提示词「分卷大纲」
- 温度 0.7，最大 token 8192

**上下文注入**：
```
总卷数: @核心蓝图.content.volume_count
故事大纲: @故事大纲.content.overview
作品标签: @作品标签.content
世界观设定: @世界观设定.content.world_view
组织/势力设定: @type:组织卡[previous:global]
character_card: @type:角色卡[previous]
scene_card: @type:场景卡[previous]
上一卷信息: @type:分卷大纲[index=$current.volumeNumber-1]
接下来请你创作第 @self.content.volume_number 卷的细纲
```

**关键特性**：分卷大纲保存时触发 **分卷大纲.wf** 工作流，自动创建：

1. **阶段大纲**（根据 `stage_count` 创建）
2. **写作指南**（1 篇）
3. **新增角色卡**（从 `new_character_cards` 列表）
4. **新增场景卡**（从 `new_scene_cards` 列表）

```python
# 分卷大纲.wf 关键节点
trigger = Trigger.CardSaved(card_type="分卷大纲")
stages = Logic.Expression(expression="[{'index': i, 'volume_number': volume.content.volume_number} for i in range(1, (volume.content.stage_count or 0) + 1)]")
stage_cards = Card.BatchUpsert(card_type="阶段大纲", items=stages.result)
guide_card = Card.BatchUpsert(card_type="写作指南", items=guide_item.result)
```

### 4.2 阶段大纲

**卡片类型**：`阶段大纲`
**Schema 字段**：
- `stage_number`：阶段号
- `stage_name`：阶段名称
- `reference_chapter`：参考章节范围（如 [1, 5]）
- `analysis`：分析
- `overview`：概述
- `entity_snapshot`：实体状态快照
- `chapter_outline_list`：章节大纲列表

**AI 辅助**：
- 使用提示词「阶段大纲」
- 温度 0.7，最大 token 8192

**上下文注入**：
```
世界观设定: @世界观设定.content.world_view
组织/势力设定: @type:组织卡[previous:global]
分卷主线: @parent.content.main_target
分卷辅线: @parent.content.branch_line
角色卡信息: @type:角色卡[previous:global]
地图/场景卡信息: @type:场景卡[previous]
该卷的角色行动简述: @parent.content.character_action_list
之前的阶段故事大纲: @type:阶段大纲[previous:global:1]
本卷的StageCount总数为：@parent.content.stage_count
注意，请务必在@parent.content.stage_count 个阶段内将故事按分卷主线收束
```

**审核上下文**（用于 AI 审核）：
```
世界观设定: @世界观设定.content.world_view
组织/势力设定: @type:组织卡[previous:global]
分卷主线: @parent.content.main_target
角色卡信息: @type:角色卡[previous:global]
之前的阶段故事大纲: @type:阶段大纲[previous:global:1]
上一章节大纲概述: @type:章节大纲[previous:global:1]
```

**关键特性**：阶段大纲保存时触发 **阶段大纲.wf** 工作流：

1. 从 `chapter_outline_list` 提取章节大纲
2. 校验章节号是否连续（1, 2, 3...）
3. 批量创建「章节大纲」卡片
4. 批量创建「章节正文」卡片

```python
# 阶段大纲.wf 关键节点
trigger = Trigger.CardSaved(card_type="阶段大纲")
enriched_outlines = Logic.Expression(expression="[{**outline, 'title': f'第{outline.chapter_number}章 {outline.title}', ...} for outline in stage.content.chapter_outline_list]")
outline_cards = Card.BatchUpsert(card_type="章节大纲", items=enriched_outlines.result)
content_cards = Card.BatchUpsert(card_type="章节正文", items=enriched_outlines.result)
```

---

## 五、章节创作阶段

### 5.1 章节大纲

**卡片类型**：`章节大纲`
**Schema 字段**：
- `volume_number`：所属卷号
- `stage_number`：所属阶段号
- `chapter_number`：章节号
- `title`：标题
- `overview`：概述
- `entity_list`：参与者实体列表（角色名、场景名、物品名）

**AI 辅助**：
- 使用提示词「章节大纲」
- 温度 0.7，最大 token 8192

**上下文注入**：
```
world_view: @世界观设定.content
volume_number: @self.content.volume_number
volume_main_target: @type:分卷大纲[index=$current.volumeNumber].content.main_target
volume_branch_line: @type:分卷大纲[index=$current.volumeNumber].content.branch_line
本卷的实体action列表: @parent.content.entity_action_list
当前阶段故事概述: @stage:current.overview
当前阶段覆盖章节范围: @stage:current.reference_chapter
之前的章节大纲: @type:章节大纲[sibling]
请开始创作第 @self.content.chapter_number 章的大纲
```

### 5.2 章节正文

**卡片类型**：`章节正文`
**Schema 字段**：
- `volume_number`：所属卷号
- `stage_number`：所属阶段号
- `chapter_number`：章节号
- `title`：标题
- `entity_list`：出场人物/物品列表
- `content`：正文内容（Markdown）

**AI 辅助**：
- 使用提示词「内容生成」
- 温度 0.7，最大 token 8192

**上下文注入**（完整示例）：
```
世界观设定: @世界观设定.content
组织/势力设定:@type:组织卡[index=filter:content.name in $self.content.entity_list].{content.name,content.description,content.influence,content.relationship,content.dynamic_state}
场景卡:@type:场景卡[index=filter:content.name in $self.content.entity_list].{content.name,content.description,content.dynamic_state}
当前故事阶段大纲: @parent.content.overview
角色卡:@type:角色卡[index=filter:content.name in $self.content.entity_list].{content.name,content.role_type,content.born_scene,content.description,content.personality,content.core_drive,content.character_arc,content.dynamic_info}
物品卡:@type:物品卡[index=filter:content.name in $self.content.entity_list].{content.name,content.category,content.description,content.current_state,content.power_or_effect}
概念卡:@type:概念卡[index=filter:content.name in $self.content.entity_list].{content.name,content.category,content.description,content.rule_definition,content.mastery_hint}
最近的章节原文:@type:章节正文[previous:1].{content.title,content.chapter_number,content.content}
参与者实体列表:@self.content.entity_list
请根据章节大纲来创作章节正文内容:@type:章节大纲[index=filter:...].{content.overview}
注意，写作时必须保证结尾剧情与下一章的剧情大纲不会冲突:@type:章节大纲[index=filter:content.chapter_number = $self.content.chapter_number+1].{content.title,content.overview}
写作时请结合写作指南要求:@type:写作指南[index=filter:content.volume_number = $self.content.volume_number].{content.content}
```

**续写功能**：用户可以调用 AI 续写当前章节，系统支持两种字数控制模式：

1. **constraint 模式**（提示词约束，更自然，省 token）
2. **control 模式**（控制模式，按目标字数切分多轮，稳定但耗 token）

---

## 六、@DSL 上下文注入系统

### 6.1 语法详解

NovelForge 的核心创新之一是 `@DSL` 上下文注入语法，允许在提示词中动态引用项目数据：

| 语法 | 说明 |
|------|------|
| `@卡片标题` | 按标题精确引用卡片 |
| `@type:角色卡` | 按类型引用所有角色卡 |
| `@type:角色卡[previous]` | 引用同一父卡片下的前一个角色卡 |
| `@type:角色卡[previous:global]` | 引用全局范围内前一个角色卡 |
| `@type:角色卡[previous:global:1]` | 引用全局范围内前第 1 个角色卡 |
| `@type:角色卡[index=filter:...]` | 按过滤条件引用 |
| `@parent` | 引用父卡片 |
| `@self` | 引用当前卡片 |
| `@KB{name=知识库名}` | 引用知识库内容 |
| `@stage:current` | 引用当前阶段 |
| `@worldview` | 简写引用 |

### 6.2 字段选择器

可以只引用卡片的特定字段：

```
@type:角色卡[previous:global].{content.name,content.personality,content.core_drive}
```

### 6.3 过滤表达式

支持在 `[index=filter:...]` 中使用过滤条件：

```
@type:角色卡[index=filter:content.name in $self.content.entity_list]
```

---

## 七、知识图谱系统

### 7.1 关系类型体系

NovelForge 维护一个关系图谱系统，记录实体间的关系：

| 关系类型 | 主-客类型 | 示例 |
|----------|-----------|------|
| 同盟、敌对、亲属、师徒、对手 | character ↔ character | 林远-张伟：对手 |
| 隶属、成员、领导、创立 | character ↔ organization | 林远-星际探索队：成员 |
| 拥有、使用 | character ↔ item | 林远-光剑：拥有 |
| 修炼、领悟 | character ↔ concept | 林远-剑法：修炼 |
| 控制、位于 | organization ↔ scene | 星际探索队-火星基地：位于 |
| 承载、映射 | item ↔ concept | 光剑-能量法则：承载 |

### 7.2 记忆提取器

系统支持从文本中自动提取关系和状态变化：

| 提取器 | 功能 |
|--------|------|
| `relation` | 关系提取 |
| `character_dynamic` | 角色动态信息 |
| `scene_state` | 场景状态 |
| `organization_state` | 组织状态 |
| `item_state` | 物品状态 |
| `concept_state` | 概念掌握 |

### 7.3 实体状态追踪

每个实体（角色、场景、组织、物品、概念）都有 `dynamic_info` 字段，用于追踪状态变化。例如角色卡包含：

- `dynamic_info`：动态信息（随剧情推进更新）
- `dynamic_state`：当前状态快照

---

## 八、灵感助手系统

### 8.1 对话模式

灵感助手是一个基于 React 协议的 AI 对话系统，可以：

1. 回答创作相关问题（纯文本对话）
2. 执行工具操作（React 模式）

### 8.2 可用工具

| 工具名 | 功能 |
|--------|------|
| `create_card` | 创建卡片 |
| `update_card` | 更新卡片 |
| `delete_card` | 删除卡片 |
| `modify_card_field` | 修改卡片字段 |
| `replace_field_text` | 替换字段文本 |
| `search_cards` | 搜索卡片 |
| `get_card_type_schema` | 获取卡片类型 Schema |
| `set_confirmed` | 确认修改 |

### 8.3 React 协议流程

```
用户消息 → Think → Action → Observation → Final Response
                  ↑
              可多次调用工具
```

---

## 九、完整创作流程示例

### 第一步：项目初始化

```
1. 创建项目 "星际探索"
   → 自动触发雪花创作法工作流
   → 创建初始卡片：作品标签、金手指、一句话梗概、故事大纲、世界观设定、核心蓝图
```

### 第二步：完善一句话梗概

```
2. 用户在「一句话梗概」卡片中输入：
   "一位年轻舰长驾驶过时战舰，携带神秘古董，
    带领小队穿越星际虫洞，寻找失落的远古文明。"
   → AI 辅助生成 theme、audience、narrative_person 等字段
```

### 第三步：扩展故事大纲

```
3. 用户点击「故事大纲」的 AI 生成
   → AI 基于一句话梗概扩写为一段完整大纲
   → 定义 power_structure、currency_system、background
```

### 第四步：构建世界观

```
4. 用户点击「世界观设定」的 AI 生成
   → AI 生成 world_view（星际政治体系、科技水平、文化设定）
   → 定义 major_power_camps（银河联邦、星际海盗、远古文明后裔）
```

### 第五步：创建核心蓝图

```
5. 用户在「核心蓝图」中定义：
   - volume_count: 3（三卷本）
   - character_cards: [林远, 艾琳娜, 老船长]
   - scene_cards: [星舰探索号, 火星基地, 虫洞入口]
   → 核心蓝图保存时自动创建：
     - 第1卷、第2卷、第3卷 分卷大纲
     - 林远、艾琳娜、老船长 角色卡
     - 星舰探索号、火星基地、虫洞入口 场景卡
```

### 第六步：规划分卷

```
6. 用户编辑「第1卷」分卷大纲：
   - main_target: 主角发现远古遗迹的线索
   - branch_line: 与海盗的冲突
   - stage_count: 3（三个阶段）
   → 分卷大纲保存时自动创建：
     - 阶段1、阶段2、阶段3 阶段大纲
     - 写作指南
```

### 第七步：生成阶段大纲

```
7. 用户点击「阶段1」的 AI 生成
   → AI 参考上下文生成 stage_outline、chapter_outline_list
   → 阶段大纲保存时自动创建：
     - 第1章、第2章、第3章 章节大纲
     - 第1章、第2章、第3章 章节正文（空卡片）
```

### 第八步：撰写章节正文

```
8. 用户点击「第1章」的 AI 续写
   → AI 参考以下上下文生成正文：
     - 世界观设定
     - 角色卡（林远、艾琳娜等）
     - 场景卡（星舰探索号）
     - 阶段大纲概述
     - 章节大纲
     - 写作指南要求
   → 续写完成后更新角色 dynamic_info（状态变化）
```

### 第九步：循环迭代

```
9. 重复步骤 7-8，完成所有章节
   → 定期调用记忆提取器，更新知识图谱
   → 使用灵感助手解决创作瓶颈
```

---

## 十、工作流系统

### 10.1 内置工作流

| 工作流文件 | 触发条件 | 功能 |
|-----------|----------|------|
| `项目创建·雪花创作法.wf` | 项目创建 | 创建初始卡片结构 |
| `核心蓝图.wf` | 核心蓝图保存 | 创建分卷、角色、场景 |
| `分卷大纲.wf` | 分卷大纲保存 | 创建阶段、写作指南 |
| `阶段大纲.wf` | 阶段大纲保存 | 创建章节大纲和正文 |
| `世界观.wf` | 世界观保存 | （待定义） |
| `拆书工作流.wf` | 手动触发 | 导入现有小说并拆解 |

### 10.2 工作流 DSL 语法

工作流使用 `@node()` 注解定义节点：

```python
#@node(description="触发器：监听卡片保存")
trigger = Trigger.CardSaved(card_type="核心蓝图")
#</node>

#@node(description="读取卡片")
card = Card.Read(card_id=trigger.card_id)
#</node>

#@node(async=true, description="批量创建卡片（异步）")
cards = Card.BatchUpsert(
    project_id=trigger.project_id,
    card_type="角色卡",
    items=items
)
#</node>

#@node(description="等待异步任务")
wait_result = Logic.Wait(tasks=[cards])
#</node>
```

---

## 十一、CLI 辅助工具

### 11.1 完整创作流程 CLI 示例

```bash
# 1. 启动后端
unset ALL_PROXY all_proxy
uv run python main.py &

# 2. 创建项目
uv run python cli.py project new \
  --name "星际探索" \
  --description "宇宙探险题材小说"

# 3. 查看项目卡片（验证自动创建）
uv run python cli.py card list 1

# 4. 查看 LLM 配置
uv run python cli.py llm list

# 5. AI 生成一句话梗概
uv run python cli.py ai generate <card_id> \
  --llm 1 \
  --prompt "描写一个关于星际探险的故事" \
  --prompt-name "一句话梗概"

# 6. 创建章节
uv run python cli.py chapter new 1 \
  --title "第一章：神秘信号" \
  --volume 1

# 7. 续写章节
uv run python cli.py chapter write <chapter_card_id> \
  --llm 1 \
  --words 3000 \
  --mode constraint \
  --stream

# 8. 使用灵感助手
uv run python cli.py assistant chat \
  --project 1 \
  --message "如何塑造一个有趣的反派角色？"

# 9. 管理关系图谱
uv run python cli.py relation upsert \
  --project 1 \
  --from "林远" \
  --to "神秘文明" \
  --relation "关于"

# 10. 查看工作流
uv run python cli.py workflow list
```

### 11.2 卡片类型 ID 速查

| ID | 类型 | 用途 |
|----|------|------|
| 1 | 通用文本 | 通用内容 |
| 4 | 一句话梗概 | 核心种子 |
| 5 | 故事大纲 | 扩展大纲 |
| 6 | 世界观设定 | 世界规则 |
| 7 | 核心蓝图 | 全局规划 |
| 8 | 分卷大纲 | 分卷规划 |
| 10 | 阶段大纲 | 阶段规划 |
| 11 | 章节大纲 | 章节规划 |
| 12 | 章节正文 | 实际正文 |
| 14 | 角色卡 | 角色定义 |
| 15 | 场景卡 | 场景定义 |
| 16 | 组织卡 | 组织定义 |

---

## 十二、数据流总览

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户操作层                               │
│   GUI (Electron+Vue3) / CLI (Typer+httpx)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI 路由层                             │
│   /api/projects/* | /api/cards/* | /api/ai/* | /api/workflows/* │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Service 层                                │
│   card_service.py | ai_service.py | workflow_service.py         │
│   memory_service.py | kg_provider.py                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       AI Core 层                                │
│   chat_model_factory.py | llm_service.py                        │
│   instruction_generator.py | react_text_agent                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LangChain 适配器                            │
│   ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI |        │
│   ChatQwen | ChatMiniMax                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LLM API (外部)                              │
│   OpenAI | Anthropic | Google | MiniMax | Qwen                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 总结

NovelForge 的核心设计思想：

1. **从宏观到微观**：从一句话梗概 → 故事大纲 → 世界观 → 核心蓝图 → 分卷 → 阶段 → 章节，逐层细化

2. **卡片式管理**：每个创作单元都是一张卡片，有类型、Schema、父子关系

3. **@DSL 上下文注入**：提示词中可以动态引用项目数据，确保 AI 输出的一致性

4. **工作流自动化**：卡片保存时自动触发后续创建流程，减少重复操作

5. **知识图谱追踪**：维护角色、场景、组织、物品间的关系，追踪状态变化

6. **雪花创作法**：经典创作方法与 AI 辅助的结合，降低长篇小说创作门槛
