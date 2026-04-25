# NovelForge LLM 工作流分析文档

## 1. 系统架构概览

NovelForge 的 LLM 系统采用分层架构，主要包含以下组件：

```
┌─────────────────────────────────────────────────────────────┐
│                      API 层 (FastAPI)                       │
│  /ai/generate | /ai/generate/continuation | /ai/assistant │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      服务层 (Services)                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │ llm_service │ │assistant_    │ │ memory_service   │    │
│  │   (通用)    │ │service(灵感) │ │   (记忆/图谱)   │    │
│  └──────────────┘ └──────────────┘ └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    核心层 (AI Core)                        │
│  ┌──────────────────┐ ┌────────────────┐ ┌──────────────┐  │
│  │chat_model_factory│ │ instruction_  │ │ react_text_  │  │
│  │   (模型工厂)    │ │generator      │ │  agent       │  │
│  └──────────────────┘ └────────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│              LangChain 适配器                              │
│  ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI |    │
│  ChatQwen (通义千问)                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. LLM 配置管理

### 2.1 数据库模型

**文件**: `backend/app/db/models.py` - `LLMConfig`

| 字段 | 类型 | 说明 |
|------|------|------|
| `provider` | str | 提供商：openai_compatible, anthropic, google |
| `model_name` | str | 模型名称 |
| `api_base` | str | API 地址 |
| `api_key` | str | API 密钥（已加密，不返回前端） |
| `api_protocol` | str | 协议：chat_completions / responses |
| `custom_request_path` | str | 自定义请求路径 |
| `token_limit` | int | Token 限额 (-1 表示不限) |
| `call_limit` | int | 调用次数限额 |

### 2.2 支持的 LLM 提供商

**文件**: `backend/app/services/ai/core/chat_model_factory.py`

| Provider | LangChain Adapter | 特殊参数 |
|----------|------------------|----------|
| `openai` | `ChatOpenAI` | - |
| `openai_compatible` | `ChatQwen` / `ChatOpenAI` | `use_responses_api` |
| `anthropic` | `ChatAnthropic` | `thinking` (budget_tokens) |
| `google` | `ChatGoogleGenerativeAI` | `include_thoughts` |

### 2.3 模型构建入口

```python
# 通用构建
build_chat_model(session, llm_config_id, temperature, max_tokens, timeout, thinking_enabled)

# 直接构建（从 payload）
build_chat_model_from_payload(provider, model_name, api_key, api_base, ...)
```

---

## 3. AI 生成服务

### 3.1 通用结构化生成

**文件**: `backend/app/services/ai/core/llm_service.py`

```python
async def generate_structured(
    session, llm_config_id, user_prompt, output_type,
    system_prompt=None, max_tokens, temperature, timeout, ...
) -> BaseModel
```

支持两种生成模式：
1. **Native Mode**: 直接使用 LangChain 的 structured output
2. **Instruction Flow Mode**: 使用指令流生成（带校验和自动修复）

### 3.2 指令流生成

**文件**: `backend/app/services/ai/generation/instruction_generator.py`

特点：
- 流式输出，实时返回生成进度
- 自动校验 JSON Schema
- 自动修复格式错误
- 支持对话历史和上下文

### 3.3 续写服务

**文件**: `backend/app/services/ai/generation/`

| 文件 | 功能 |
|------|------|
| `continuation_budget_runtime.py` | 续写预算管理（字数控制） |
| `continuation_context_service.py` | 续写上下文组装 |
| `prompt_builder.py` | 续写提示词构建 |

续写支持两种字数控制模式：
- **constraint**: 提示词约束模式（更自然，省 token）
- **control**: 控制模式（按目标字数切分多轮，稳定但耗 token）

---

## 4. 灵感助手 (Assistant)

### 4.1 服务架构

**文件**: `backend/app/services/ai/assistant/assistant_service.py`

```
用户输入
    │
    ▼
┌─────────────────────────┐
│  React/工具调用协议     │
│  或                     │
│  纯文本对话            │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  灵感助手工具集        │
│  (tools.py)            │
└─────────────────────────┘
```

### 4.2 工具集

**文件**: `backend/app/services/ai/assistant/tools.py`

灵感助手可用的工具：

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

### 4.3 React 协议

```
用户消息 → Think → Action → Observation → Final Response
                  ↑
              可多次调用工具
```

---

## 5. 记忆与知识图谱

### 5.1 记忆提取服务

**文件**: `backend/app/services/memory_service.py`

支持多种记忆提取器：

| 提取器 | 功能 | 输出 |
|--------|------|------|
| `relation` | 关系提取 | 角色间关系 |
| `character_dynamic` | 角色动态信息 | 角色状态变化 |
| `scene_state` | 场景状态 | 场景变化 |
| `organization_state` | 组织状态 | 组织变化 |
| `item_state` | 物品状态 | 物品变化 |
| `concept_state` | 概念掌握 | 学习进度 |

### 5.2 关系类型体系

**文件**: `backend/app/services/memory_service.py`

定义实体间关系类型：

| 关系 | 主-客类型 |
|------|----------|
| 同盟、敌对、亲属、师徒、对手... | character ↔ character |
| 隶属、成员、领导、创立... | character ↔ organization |
| 拥有、使用 | character ↔ item |
| 修炼、领悟 | character ↔ concept |
| 控制、位于 | organization ↔ scene |
| 承载、映射 | item ↔ concept |

### 5.3 知识图谱 Provider

**文件**: `backend/app/services/kg_provider.py`

支持两种存储：
- **SQLite**: 默认，轻量级
- **Neo4j**: 图数据库，适合复杂查询

---

## 6. 工作流节点

### 6.1 AI 相关工作流节点

**文件**: `backend/app/services/workflow/nodes/ai/`

| 节点 | 功能 |
|------|------|
| `LLMGenerateNode` (AI.LLM) | 单轮 LLM 调用 |
| `StructuredGenerateNode` (AI.StructuredGenerate) | 结构化输出生成 |
| `BatchStructuredNode` (AI.BatchStructured) | 批量结构化生成 |
| `SequentialStructuredNode` (AI.SequentialStructured) | 顺序结构化生成 |
| `DebateNode` (AI.Debate) | 多模型辩论 |
| `PromptLoadNode` (Prompt.Load) | 加载提示词 |

### 6.2 LLM 节点输入/输出

```python
class LLMInput(BaseModel):
    user_prompt: str          # 用户提示词
    system_prompt: str         # 系统提示词
    llm_config_id: int         # LLM 配置 ID
    temperature: float = 0.7   # 温度
    max_tokens: int            # 最大 token
    timeout: int = 60         # 超时时间
    max_retry: int = 3         # 最大重试

class LLMOutput(BaseModel):
    response: str              # 生成的文本
    usage: Dict[str, Any]      # Token 使用统计
```

---

## 7. API 端点

**文件**: `backend/app/api/endpoints/ai.py`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/ai/schemas` | GET | 获取所有输出模型的 JSON Schema |
| `/ai/content-models` | GET | 获取可用输出模型列表 |
| `/ai/config-options` | GET | 获取 AI 生成配置选项 |
| `/ai/prompts/render` | GET | 渲染提示词（注入知识库） |
| `/ai/generate` | POST | 通用 AI 生成 |
| `/ai/generate/continuation` | POST | 续写生成 |
| `/ai/generate/stream` | POST | 指令流式生成 |

**文件**: `backend/app/api/endpoints/assistant.py`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/ai/assistant/chat` | POST | 灵感助手对话 |

**文件**: `backend/app/api/endpoints/memory.py`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/memory/extractors` | GET | 获取可用提取器 |
| `/memory/extract-preview` | POST | 预览提取结果 |
| `/memory/apply-preview` | POST | 应用预览数据 |
| `/memory/query` | POST | 查询子图 |
| `/memory/ingest-relations-llm` | POST | LLM 抽取并入图 |
| `/memory/update-dynamic-info` | POST | 更新角色动态信息 |

---

## 8. 提示词系统

### 8.1 提示词存储

**文件**: `backend/app/bootstrap/prompts/`

内置提示词文件（.txt）：

| 提示词 | 功能 |
|--------|------|
| `一句话梗概` | 生成故事一句话简介 |
| `故事大纲` | 生成故事大纲 |
| `世界观设定` | 生成世界观设定 |
| `核心蓝图` | 生成核心蓝图 |
| `章节大纲` | 生成章节大纲 |
| `内容生成` | 通用内容生成 |
| `润色` | 文本润色 |
| `扩写` | 文本扩写 |
| `关系提取` | 从文本提取关系 |
| `角色动态信息提取` | 提取角色状态变化 |
| `灵感对话` | 灵感助手对话 |
| `灵感对话-React` | React 模式灵感对话 |
| `章节审核` | 章节内容审核 |
| `通用审核` | 通用内容审核 |
| `指令流生成规范` | 指令流生成规范 |

### 8.2 提示词模板语法

支持 `@DSL` 语法引用项目数据：
- `@卡片标题` - 引用卡片
- `@type:角色卡` - 按类型引用
- `@self` - 当前卡片
- `@parent` - 父卡片
- `@KB{name=知识库名}` - 引用知识库

---

## 9. 事件系统

### 9.1 AI 相关事件

**文件**: `backend/app/core/events.py`

| 事件 | 触发时机 |
|------|----------|
| `generate.finished` | AI 生成完成 |
| `card.saved` | 卡片保存（触发工作流） |

### 9.2 工作流触发器

**文件**: `backend/app/services/workflow/triggers.py`

| 触发器 | 条件 |
|--------|------|
| `Trigger.CardSaved` | 卡片保存时 |
| `Trigger.ProjectCreated` | 项目创建时 |

---

## 10. 数据流示例

### 10.1 卡片 AI 生成流程

```
1. 前端: 用户输入提示词，选择 LLM 配置
2. API: POST /ai/generate
3. Service: compose_full_schema (组装 Schema)
4. Service: inject_knowledge (注入知识库)
5. Service: generate_structured
6. Core: build_chat_model (构建模型)
7. LangChain: 调用 LLM API
8. Service: 校验输出
9. API: 流式返回 / 返回结果
10. 触发 generate.finished 事件
```

### 10.2 续写流程

```
1. 前端: 用户点击续写，设置目标字数
2. API: POST /ai/generate/continuation
3. Service: enrich_continuation_context_info (组装上下文)
4. Service: estimate_required_call_count (估算调用次数)
5. Service: precheck_quota (配额检查)
6. Service: generate_continuation_streaming (流式生成)
7. LangChain: 分轮调用 LLM（根据字数控制模式）
8. API: SSE 流式返回
9. 触发 generate.finished 事件
```

### 10.3 灵感助手流程

```
1. 前端: 用户发送消息
2. API: POST /ai/assistant/chat
3. Service: 生成系统提示词
4. Agent: stream_chat_with_react_protocol / stream_agent_with_tools
5. 循环: 调用工具 → 执行 → 返回 Observation
6. 工具: create_card / update_card / modify_card_field 等
7. 最终: 返回对话结果
```

---

## 11. 安全机制

### 11.1 API Key 保护

**文件**: `backend/app/schemas/llm_config.py`

```python
class LLMConfigRead(LLMConfigBase):
    id: int
    api_key: Optional[str] = Field(default=None, exclude=True)  # 排除敏感字段
```

### 11.2 配额管理

**文件**: `backend/app/services/ai/core/quota_manager.py`

- Token 配额检查 (precheck_quota)
- 使用量记录 (record_usage)
- 超限拒绝

### 11.3 重试机制

- 默认最大重试 3 次
- 可配置超时时间

---

## 12. 文件索引

| 功能模块 | 核心文件 |
|---------|---------|
| 模型工厂 | `app/services/ai/core/chat_model_factory.py` |
| 通用 LLM 服务 | `app/services/ai/core/llm_service.py` |
| 指令流生成 | `app/services/ai/generation/instruction_generator.py` |
| 续写服务 | `app/services/ai/generation/continuation_*.py` |
| 灵感助手 | `app/services/ai/assistant/assistant_service.py` |
| 助手工具 | `app/services/ai/assistant/tools.py` |
| 记忆服务 | `app/services/memory_service.py` |
| 记忆提取器 | `app/services/memory_extractors/` |
| 工作流节点 | `app/services/workflow/nodes/ai/` |
| AI API | `app/api/endpoints/ai.py` |
| 助手 API | `app/api/endpoints/assistant.py` |
| 记忆 API | `app/api/endpoints/memory.py` |
| 提示词初始化 | `app/bootstrap/prompts.py` |
| 提示词文件 | `app/bootstrap/prompts/*.txt` |
