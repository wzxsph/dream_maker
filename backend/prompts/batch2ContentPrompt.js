/**
 * 第一层 Prompt：第一幕第二批节点内容生成
 * 在玩家阅读第一批节点时，后台并行生成
 *
 * 输入：故事状态 + 上下文卡片 + 第一批节点内容 + 衔接上下文
 * 输出：3 个纯文本 fragments
 */

export function buildBatch2ContentPrompt({
  storyState,
  storyCards,
  continuityContext,
  firstBatchNodes
}) {
  return `你是一个互动短剧续写引擎。

请根据当前故事状态、轻量作品卡片，以及衔接上下文，生成第一幕第二批剧情的纯文本内容。

重要：只返回纯 JSON，不要 Markdown，不要解释。

衔接上下文：
${JSON.stringify(continuityContext || {}, null, 2)}

第一批节点（请勿重复这些内容）：
${JSON.stringify(firstBatchNodes || [], null, 2)}

剧情要求：
1. content.fragments 固定生成 3 个片段，使用顺序 ID：片段0、片段1、片段2
2. 每个 fragment.text 控制在 60-120 字
3. 保持高冲突、强反转、短平快
4. 片段2（最后一个片段）是第二批的结尾选择点，type = "choice_point"，options 包含 2 个动作文案，next_node = "__GENERATE_NEXT__"
5. 其他片段为 type = "scene"，options = null
6. choices 动作文案要有剧情动作感

第二批节点 ID 映射规则（供后续转换层使用）：
- 片段0 → node_3
- 片段1 → node_4
- 片段2 → node_5（此节点 next_node 必须为 "__GENERATE_NEXT__"）

当前故事状态：
${JSON.stringify(storyState, null, 2)}

轻量作品卡片上下文：
${JSON.stringify(storyCards || [], null, 2)}

返回格式：
{
  "state_patch": {
    "current_phase": "opening_second_half",
    "facts_add": [],
    "open_threads_add": [],
    "open_threads_resolved": [],
    "characters_update": []
  },
  "content": {
    "phase": "opening_second_half",
    "fragments": [
      { "id": "片段0", "text": "剧情文字...", "type": "scene", "options": null },
      { "id": "片段1", "text": "剧情文字...", "type": "scene", "options": null },
      { "id": "片段2", "text": "剧情文字...", "type": "choice_point", "options": ["选项动作A", "选项动作B"] }
    ]
  }
}`;
}
