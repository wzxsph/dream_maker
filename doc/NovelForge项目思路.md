# NovelForge 项目思路分析

## 1. 项目概述

### 1.1 项目定位
- **项目名称**: NovelForge (新一代 AI 长篇小说创作引擎)
- **核心目标**: 具备数百万字级长篇创作潜力的 AI 辅助写作工具
- **核心理念**: 不仅是编辑器，更是一套集世界观构建、结构化内容生成于一体的解决方案

### 1.2 核心挑战与解决方案
- **挑战**: 长篇创作中，维持一致性、保证可控性、激发持续灵感是最大的挑战
- **四大核心理念**:
  1. 模块化的"卡片"(Cards)
  2. 可自定义的"动态输出模型"(Dynamic Output Models)
  3. 灵活的"上下文注入"(@DSL)
  4. 保证一致性的"知识图谱"(Knowledge Graph)

---

## 2. 核心概念体系

### 2.1 卡片系统 (Card System)

卡片是 NovelForge 的基础创作单元。

#### 2.1.1 卡片类型 (18 种内置类型)

| 类型名称 | 用途 | AI 启用 |
|---------|------|---------|
| 作品标签 | 故事标签/元数据 | 否 |
| 金手指 | 主角特殊能力设定 | 是 |
| 一句话梗概 | 一句话故事核心卖点 | 是 |
| 故事大纲 | 整体故事脉络 | 是 |
| 世界观设定 | 世界构建规则 | 是 |
| 核心蓝图 | 全局蓝图(角色/场景/组织) | 是 |
| 分卷大纲 | 卷级别结构规划 | 是 |
| 写作指南 | 每卷写作指导 | 是 |
| 阶段大纲 | 阶段级别故事 | 是 |
| 章节大纲 | 单章结构 | 是 |
| 章节正文 | 实际章节文本 | 是 |
| 角色卡 | 角色定义 | 是 |
| 场景卡 | 场景定义 | 是 |
| 组织卡 | 组织/势力定义 | 是 |
| 物品卡 | 物品定义 | 否 |
| 概念卡 | 概念/技法定义 | 否 |
| 通用文本 | 自由文本 | 否 |
| 内容审核卡片 | 审核结果 | 否 |

#### 2.1.2 卡片结构 (Card Schema)

每种卡片类型可定义 JSON Schema，AI 生成时按 Schema 校验输出：
- **类型级 Schema**: 每种卡片类型可定义 `json_schema`
- **实例级 Schema**: 具体卡片可覆盖类型默认结构
- **Schema 支持**: 基础类型、relation(嵌入)、tuple、`$ref` 复用

```python
class Card(SQLModel, table=True):
    title: str
    content: Any = Field(default={}, sa_column=Column(JSON))  # 主内容
    json_schema: Optional[dict] = None  # 实例级 Schema 覆盖
    ai_params: Optional[dict] = None    # AI 参数覆盖
    parent_id: Optional[int]            # 树形父子关系
    card_type_id: int                   # 卡片类型
    ai_context_template: Optional[str] = None  # AI 上下文模板
    ai_modified: bool = False          # AI 修改追踪
    needs_confirmation: bool = False   # 需用户确认
```

#### 2.1.3 卡片层级 (雪花创作法)

```
Project
├── 作品标签 (singleton)
├── 金手指 (singleton)
├── 一句话梗概 (singleton)
├── 故事大纲 (singleton)
├── 世界观设定 (singleton)
├── 核心蓝图 (singleton)
│   ├── 分卷大纲 × N (auto-created)
│   ├── 角色卡 × N (auto-created)
│   ├── 场景卡 × N (auto-created)
│   └── 组织卡 × N (auto-created)
├── 分卷大纲
│   ├── 阶段大纲 × M (auto-created)
│   └── 写作指南 (auto-created)
├── 阶段大纲
│   ├── 章节大纲 × K (auto-created)
│   └── 章节正文 × K (auto-created)
```

#### 2.1.4 AI 修改追踪

- `ai_modified`: 标记是否由 AI 修改过
- `needs_confirmation`: 标记是否需要用户确认
- `last_modified_by`: 记录最后修改者 ('user' | 'ai')

---

### 2.2 动态 AI 输出模型

基于 Pydantic Schema 的结构化输出系统。

#### 2.2.1 内置响应模型

- Text, Tags, SpecialAbilityResponse, OneSentence, ParagraphOverview
- WorldBuilding, Blueprint, VolumeOutline, WritingGuide
- StageLine, ChapterOutline, Chapter, ReviewResultCardContent
- CharacterCard, SceneCard, OrganizationCard, ItemCard, ConceptCard

#### 2.2.2 Schema 驱动的生成校验

AI 生成时按 Schema 校验输出，减少"看起来能用、落地却混乱"的输出。

---

### 2.3 上下文注入系统 (@DSL)

#### 2.3.1 @KB 知识库注入

**语法**:
- `@KB{id=123}` - 按 ID 引用
- `@KB{name="文风约束"}` - 按名称引用

**注入规则**:
- 在 `- knowledge:` 段落内：多个占位符按顺序编号注入 (1., 2., etc.)
- 在段外：就地替换为知识全文
- 找不到时：保留提示注释 `/* 知识库未找到: id=... */`

#### 2.3.2 @DSL 卡片引用

**按标题引用**:
- `@卡片标题` - 引用整张卡片
- `@卡片标题.content.某个字段` - 引用卡片特定字段

**按类型引用**:
- `@type:角色卡` - 引用所有该类型卡片

**特殊引用**:
- `@self` - 当前卡片
- `@parent` - 父卡片

#### 2.3.3 过滤器语法

- `[previous]`: 获取同级的前一个卡片
- `[previous:global:n]`: 获取全局顺序中最近的 n 个同类型卡片
- `[sibling]`: 获取所有同级兄弟卡片
- `[index=...]`: 按序号获取，支持表达式如 `$self.content.volume_number - 1`
- `[filter:...]`: 按条件过滤，如 `[filter:content.level > 5]`

#### 2.3.4 完整解析流程

```
1. 用户/AI 请求
       ↓
2. 提示词检索 (prompt_service.get_prompt_by_name)
       ↓
3. 模板变量渲染 (render_prompt 替换 ${} 变量)
       ↓
4. 知识库注入 (inject_knowledge 替换 @KB{...})
       ↓
5. 上下文组装 (assemble_context 构建事实子图)
       ↓
6. LLM 调用 (llm_service.generate_*)
```

---

### 2.4 知识图谱系统 (Knowledge Graph)

#### 2.4.1 关系模型 (KGRelation)

```python
class KGRelation(SQLModel, table=True):
    project_id: int
    source: str           # 实体 A 名称
    target: str           # 实体 B 名称
    kind_en: str          # 关系类型英文 (ally, enemy, etc.)
    kind_cn: str          # 关系类型中文 (同盟, 敌对, etc.)
    fact: Optional[str]   # 事实描述
    a_to_b_addressing: Optional[str]  # A 如何称呼 B
    b_to_a_addressing: Optional[str]  # B 如何称呼 A
    recent_dialogues: List[str]        # 近期对话
    recent_event_summaries: List[dict] # 近期事件
    stance: Optional[dict]  # 态度: 友好/中立/敌意
```

#### 2.4.2 支持的关系类型

**角色关系**: 同盟, 队友, 同门, 敌对, 亲属, 师徒, 对手, 伙伴, 上级, 下属, 指导
**角色-组织**: 隶属, 成员, 领导, 创立
**角色-物品/概念**: 拥有, 使用, 修炼, 领悟, 承载, 映射
**组织-场景**: 控制, 位于
**通用**: 影响, 克制, 关于, 其他

#### 2.4.3 双 Provider 架构

| Provider | 设置 | 存储 |
|----------|------|------|
| `SQLModelKGProvider` (默认) | `KNOWLEDGE_GRAPH_PROVIDER=sqlite` | SQLite via KGRelation 表 |
| `Neo4jKGProvider` | `KNOWLEDGE_GRAPH_PROVIDER=neo4j` | Neo4j 图数据库 |

#### 2.4.4 上下文组装 (Context Assembly)

`assemble_context()` 从知识图谱提取"事实子图"：
- 按参与者筛选相关关系
- 返回结构化 `FactsStructured` (fact_summaries, relation_summaries, item_summaries, concept_summaries)

#### 2.4.5 记忆服务 (Memory Service)

- `ingest_relations_from_llm()`: 从新写文本中提取关系存入图谱
- `update_dynamic_character_info()`: 更新角色卡的动态信息
- `extract_*_preview()`: 先预览再确认写入的流程

---

## 3. 工作流系统

### 3.1 代码式工作流 (Code-style Workflow)

使用 `#@node(...) ... #</node>` 注释标记 DSL：
```python
#@node(async, description="创建分卷")
def create_volumes(self):
    # Python 风格语句
    volumes = []
    for i in range卷数:
        volumes.append(create_card("分卷大纲", ...))
    return volumes
#</node>
```

### 3.2 内置工作流模板

- 项目创建·雪花创作法
- 世界观·转组织
- 核心蓝图·落子卡
- 分卷大纲·落子卡
- 阶段大纲·落章节卡
- 拆书工作流

### 3.3 触发器类型

- **保存时触发 (onsave)**: 当指定类型卡片保存时自动执行
- **创建项目时触发 (onprojectcreate)**: 新建项目后自动执行

### 3.4 工作流 Agent

自然语言描述需求，Agent 生成/修改工作流代码，支持"先预览再应用"的安全变更体验。

---

## 4. 创作流程

### 4.1 雪花创作法流程

1. 创建项目 -> 选择"项目创建·雪花创作法"工作流
2. 自顶向下: 一句话梗概 -> 故事大纲 -> 世界观 -> 核心蓝图
3. 完成核心蓝图 -> 自动创建分卷卡片
4. 完成分卷大纲 -> 自动创建阶段大纲和写作指南
5. 完成阶段大纲 -> 自动生成章节大纲和章节正文卡片

### 4.2 AI 生成卡片流程

1. 选中卡片 -> 打开 AI 生成对话框
2. 输入要求 -> 系统按字段粒度流式生成
3. 选择"确认"落库或"反馈继续迭代"
4. 不满意不必整卡重来

### 4.3 记忆与图谱更新

1. 章节正文完成后点击"入图关系"
2. 解析角色关系存入知识图谱
3. 提取角色动态信息
4. 后续章节自动注入相关实体信息

---

## 5. 技术架构

### 5.1 前端架构

```
frontend/src/
├── main/           # Electron 主进程
├── preload/        # 预加载脚本
└── renderer/src/   # Vue 3 渲染进程
    ├── components/ # Vue 组件
    ├── services/   # 前端服务
    ├── stores/     # Pinia 状态管理
    └── views/      # 页面视图
```

### 5.2 后端架构

```
backend/app/
├── api/           # FastAPI 路由
│   └── endpoints/ # cards, projects, workflows, etc.
├── db/            # 数据库模型与会话
│   ├── models.py  # SQLModel 模型定义
│   └── session.py # 数据库会话管理
├── schemas/       # Pydantic 数据模型
├── services/      # 核心业务逻辑
│   ├── ai/        # AI 生成服务
│   ├── memory_extractors/  # 记忆提取器
│   └── workflow/   # 工作流引擎
├── bootstrap/     # 初始化器 (card_types, prompts, workflows)
└── core/          # 核心配置与事件
```

---

## 6. 关键文件索引

### 卡片系统核心
- `/backend/app/db/models.py` - Card, CardType 模型定义
- `/backend/app/schemas/card.py` - 卡片相关 Pydantic Schema
- `/backend/app/bootstrap/card_types.py` - 内置卡片类型初始化
- `/backend/app/services/card_service.py` - 卡片业务逻辑

### AI 生成系统
- `/backend/app/services/ai/generation/` - 结构化生成逻辑
- `/backend/app/services/prompt_service.py` - 提示词服务 (@KB 注入)
- `/backend/app/schemas/response_registry.py` - 响应模型映射

### 上下文与知识图谱
- `/backend/app/services/context_service.py` - 上下文组装
- `/backend/app/services/kg_provider.py` - 知识图谱 Provider
- `/backend/app/services/memory_service.py` - 记忆提取与更新

### 工作流系统
- `/backend/app/services/workflow/` - 工作流引擎
- `/backend/app/bootstrap/workflows/` - 内置工作流模板
- `/backend/app/services/workflow/parser/marker_parser.py` - DSL 解析器

### 提示词
- `/backend/app/bootstrap/prompts/` - 提示词模板文件 (.txt)
- `/backend/app/bootstrap/prompts.py` - 提示词初始化逻辑

---

## 7. 配置与扩展

### 7.1 LLM 配置

支持多 LLM 配置：
- provider, model_name, api_base, api_key
- 配额管理 (token_limit, call_limit)
- 用量统计 (used_tokens_input/output, used_calls)

### 7.2 提示词工坊 (Prompt Workshop)

所有 AI 功能背后都是可编辑的提示词模板，支持 @KB 语法注入知识库内容。

### 7.3 卡片类型管理

在"设置 -> 卡片类型"中管理类型 Schema，使用结构构建器定义 json_schema。
