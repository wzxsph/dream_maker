import { buildArchitecturePromptSection, getChunkStartNodeId } from '../config/storyArchitecture.js';

export function buildPreviewNodePrompt({
  storyState,
  storyCards,
  continuityContext,
  nextChunkIndex
}) {
  const startNodeId = getChunkStartNodeId(nextChunkIndex);

  return `你是互动短剧的“下一节点预览”生成器。

请只生成下一幕的第一个剧情节点，用于让用户先看到剧情，不需要生成整幕。

必须只返回纯 JSON，不要 Markdown，不要解释。

硬规则：
1. node_id 必须是 "${startNodeId}"。
2. text 必须直接承接 continuityContext.current_node_text 和 continuityContext.selected_choice。
3. text 写成自然剧情，不要写“你刚选择了”。
4. text 控制在 50-90 字。
5. bg_theme 只能是 "light"、"dark"、"danger"、"victory"。
6. choices 必须是空数组，完整选项由后台完整 chunk 生成后补齐。
7. 预览必须遵守场景锁和 ending_lane，不跳新地点、不提前泄露结局。

${buildArchitecturePromptSection({ nextChunkIndex })}

当前故事状态：
${JSON.stringify(storyState, null, 2)}

轻量作品卡片：
${JSON.stringify(storyCards || [], null, 2)}

衔接上下文：
${JSON.stringify(continuityContext || {}, null, 2)}

返回格式：
{
  "node": {
    "node_id": "${startNodeId}",
    "text": "",
    "bg_theme": "dark",
    "ui_effect": [],
    "choices": []
  }
}`;
}
