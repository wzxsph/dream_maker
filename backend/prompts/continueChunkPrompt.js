export function buildContinueChunkPrompt({
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
  return `你是一个互动短剧续写引擎。

请根据当前故事状态、轻量作品卡片、衔接上下文、最近剧情、用户刚才选择，以及可选的用户剧情干预，生成下一段互动剧情。

重要规则：
1. 只返回纯 JSON。
2. 不要返回 Markdown。
3. 不要返回解释。
4. 用户干预是可选的。
5. 如果没有用户干预，就自然延续当前剧情。
6. 如果有用户干预，必须在下一段剧情中体现，但不能推翻已发生事实。
7. 生成 3-4 个节点。
8. 每个非结局节点最多 2 个 choices。
9. 每个 node 的 bg_theme 只能从 "light"、"dark"、"danger"、"victory" 中选择。
10. 每个 node.text 控制在 50-110 字。
11. 不要引入过多新角色。
12. 保持高冲突、强反转、短平快。
13. 如果 nextChunkIndex 小于 maxChunks，至少一个末尾选择的 next_node 必须是 "__GENERATE_NEXT__"。
14. 如果 nextChunkIndex 等于 maxChunks，必须生成至少一个结局节点，结局节点 choices = []。
15. 不要主动生成真实广告内容，chunk_2 的广告节点由后端统一插入。
16. 严禁使用 next_nodes、nextNode、speaker 字段表达跳转；只能使用 choices 数组。
17. 非结局节点的 choices 不能是空数组，必须给出具体动作文案，不要写“继续”“下一步”“进入下一幕”。
18. 每个 choices[].content 必须是有剧情动作的短句，例如“当众揭穿她的谎言”“先假装妥协套出真相”。

剧情衔接硬规则：
1. 必须把“衔接上下文.current_node_text”视为上一幕最后发生的画面。
2. 必须把“衔接上下文.selected_choice”视为玩家刚刚做出的动作。
3. 新 chunk 的 start_node.text 第一段必须写出 selected_choice 造成的直接后果，但要写成自然剧情，不要写“你刚选择了……”这种系统提示句。
4. 不允许突然跳到新地点、新时间、新人物视角；除非上一节点文本已经明确出现。
5. 不允许重讲上一幕，不允许改写上一幕已经发生的事实。
6. 如果有 intervention，只能作为“接下来出现的新变量”，不能覆盖 current_node_text 和 selected_choice。
7. start_node.text 应该包含上一节点中的关键人物或关键物件，保证读者感觉是连续镜头。
8. 如果 selected_choice 类似“等待后续发展/进入下一幕”，请把它理解为镜头继续推进，用环境变化、人物反应或一句突发对白自然承接。

当 nextChunkIndex = 2 时，固定使用以下图结构：
- start_node = "node_5"
- nodes 包含且只包含 node_5、node_6_a、node_6_b、node_7
- node_5 必须有 2 个 choices，分别指向 node_6_a 和 node_6_b
- node_6_a 必须至少有 1 个 choice 指向 node_7
- node_6_b 必须至少有 1 个 choice 指向 node_7
- node_7 必须有 1 个 choice，next_node = "__GENERATE_NEXT__"
- end_nodes = ["node_7"]

当 nextChunkIndex = 3 时，固定使用以下图结构：
- start_node = "node_8"
- nodes 包含且只包含 node_8、node_9_a、node_9_b、node_10_ending
- node_8 必须有 2 个 choices，分别指向 node_9_a 和 node_9_b
- node_9_a 必须至少有 1 个 choice 指向 node_10_ending
- node_9_b 必须至少有 1 个 choice 指向 node_10_ending
- node_10_ending 必须 choices = []
- end_nodes = ["node_10_ending"]

当前故事状态：
${JSON.stringify(storyState, null, 2)}

轻量作品卡片上下文：
${JSON.stringify(storyCards || [], null, 2)}

衔接上下文：
${JSON.stringify(continuityContext || {}, null, 2)}

最近剧情：
${JSON.stringify(recentNodes, null, 2)}

用户刚才选择：
${choiceContent || '无'}

模式：
${mode}

用户剧情干预：
${intervention || '无'}

nextChunkIndex:
${nextChunkIndex}

maxChunks:
${maxChunks}

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
    "chunk_id": "chunk_${nextChunkIndex}",
    "chunk_index": ${nextChunkIndex},
    "type": "middle | climax | ending",
    "start_node": "${nextChunkIndex === 2 ? 'node_5' : 'node_8'}",
    "end_nodes": [],
    "nodes": {}
  }
}`;
}
