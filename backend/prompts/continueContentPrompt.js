/**
 * 第一层 Prompt：续写内容生成
 * 只生成纯文本片段，不涉及任何渲染相关字段
 *
 * 输入：故事状态 + 上下文卡片 + 衔接上下文 + 最近剧情 + 玩家选择 + 干预内容 + 幕序号
 * 输出：state_patch + content（纯文本 fragments）
 */

export function buildContinueContentPrompt({
  storyState,
  storyCards,
  continuityContext,
  recentNodes,
  choiceContent,
  mode,
  intervention,
  nextChunkIndex,
  maxChunks
}) {
  const isChunk2 = nextChunkIndex === 2;
  const isChunk3 = nextChunkIndex === maxChunks;

  return `你是一个互动短剧续写引擎。

请根据当前故事状态、轻量作品卡片、衔接上下文、最近剧情、用户刚才选择，以及可选的用户剧情干预，生成下一段互动剧情的纯文本内容。

重要：只返回纯 JSON，不要 Markdown，不要解释。

用户刚才选择：
${choiceContent || '无'}

模式：
${mode === 'rewrite' ? '改写模式：玩家输入了干预内容' : '继续模式：玩家选择继续当前剧情'}

用户剧情干预：
${intervention || '无'}

nextChunkIndex：${nextChunkIndex}
maxChunks：${maxChunks}

衔接硬规则：
1. 必须把 continuityContext.current_node_text 视为上一幕最后发生的画面
2. 必须把 continuityContext.selected_choice 视为玩家刚刚做出的动作
3. 新片段的 text 必须写出 selected_choice 造成的直接后果，要写成自然剧情
4. 不要写"你刚选择了……"这种系统提示句
5. 不允许突然跳到新地点、新时间、新人物视角（除非上一节点已明确出现）
6. 不允许重讲上一幕，不允许改写已发生的事实
7. 如果有 intervention，只能作为"接下来出现的新变量"，不能覆盖 current_node_text 和 selected_choice
8. 如果 selected_choice 类似"等待后续发展/进入下一幕"，用环境变化、人物反应或一句突发对白自然承接

剧情要求：
1. 生成 4 个片段，使用顺序 ID：片段0、片段1、片段2、片段3
2. 如果 nextChunkIndex < maxChunks（不是结局幕），最后一个片段（片段3）必须是 type = "choice_point"，options 包含 2 个动作文案，next_node = "__GENERATE_NEXT__"
3. 如果 nextChunkIndex === maxChunks（结局幕），最后一个片段（片段3）必须是 type = "ending"，options = []
4. 每个 fragment.text 控制在 50-110 字
5. 保持高冲突、强反转、短平快
6. 不要引入过多新角色
7. 不要主动生成广告节点，广告节点由后端统一插入
8. choices 动作文案要有剧情动作感，如"当众揭穿她的谎言""先假装妥协套出真相"

${isChunk2 ? `
第二幕节点 ID 映射规则（供后续转换层使用）：
- 片段0 → node_5
- 片段1 → node_6_a
- 片段2 → node_6_b
- 片段3 → node_7（此节点 next_node 必须为 "__GENERATE_NEXT__"）
` : ''}

${isChunk3 ? `
第三幕/结局节点 ID 映射规则（供后续转换层使用）：
- 片段0 → node_8
- 片段1 → node_9_a
- 片段2 → node_9_b
- 片段3 → node_10_ending（此节点 type = "ending"，choices = []）
` : ''}

当前故事状态：
${JSON.stringify(storyState, null, 2)}

轻量作品卡片上下文：
${JSON.stringify(storyCards || [], null, 2)}

衔接上下文：
${JSON.stringify(continuityContext || {}, null, 2)}

最近剧情：
${JSON.stringify(recentNodes, null, 2)}

返回格式：
{
  "state_patch": {
    "current_phase": "",
    "facts_add": [],
    "open_threads_add": [],
    "open_threads_resolved": [],
    "characters_update": []
  },
  "content": {
    "phase": "${isChunk2 ? 'middle' : isChunk3 ? 'ending' : 'climax'}",
    "fragments": [
      { "id": "片段0", "text": "剧情文字...", "type": "scene", "options": null },
      { "id": "片段1", "text": "剧情文字...", "type": "scene", "options": null },
      { "id": "片段2", "text": "剧情文字...", "type": "scene", "options": null },
      { "id": "片段3", "text": "剧情文字...", "type": "${isChunk3 ? 'ending' : 'choice_point'}", "options": ${isChunk3 ? '[]' : '["选项A", "选项B"]'} }
    ]
  }
}`;
}
