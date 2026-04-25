/**
 * 第一层 Prompt：预览节点内容生成
 * 只生成单个文本片段，用于快速预览
 *
 * 输入：故事状态 + 上下文卡片 + 衔接上下文 + 幕序号
 * 输出：单个 fragment 文本
 */

export function buildPreviewContentPrompt({
  storyState,
  storyCards,
  continuityContext,
  nextChunkIndex
}) {
  const startNodeId = nextChunkIndex === 2 ? 'node_5' : 'node_8';

  return `你是互动短剧的"下一节点预览"生成器。

请只生成下一幕的第一个剧情片段，用于让用户先看到剧情开头。

重要：只返回纯 JSON，不要 Markdown，不要解释。

硬规则：
1. text 必须直接承接 continuityContext.current_node_text 和 continuityContext.selected_choice
2. text 写成自然剧情，不要写"你刚选择了"
3. text 控制在 50-90 字
4. type = "scene"，options = null

预览节点对应节点 ID：${startNodeId}

当前故事状态：
${JSON.stringify(storyState, null, 2)}

轻量作品卡片：
${JSON.stringify(storyCards || [], null, 2)}

衔接上下文：
${JSON.stringify(continuityContext || {}, null, 2)}

返回格式：
{
  "content": {
    "fragment": {
      "id": "片段0",
      "text": "剧情文字...",
      "type": "scene",
      "options": null
    }
  }
}

注意：片段0 在后续转换时会映射为节点 ID "${startNodeId}"`;
}
