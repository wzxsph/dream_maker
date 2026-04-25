export function buildInitialStoryPrompt(userPrompt) {
  return `你是一个互动短剧策划器和剧情节点生成器。

请根据用户输入的一句话脑洞，一次性生成故事状态摘要和第一段互动剧情 chunk。

必须只返回纯 JSON，不要 Markdown，不要解释。

用户脑洞：
${userPrompt}

要求：
1. title 简短有冲突感，不超过 12 个字。
2. story_state 只保存摘要，不要保存完整正文。
3. characters、facts、open_threads、constraints 每项最多 2 条。
4. chunk 必须是第一段开局冲突。
5. 固定生成 4 个节点：node_0、node_1_a、node_1_b、node_2。
6. node_0 有两个选项，分别指向 node_1_a 和 node_1_b。
7. node_1_a 和 node_1_b 的选项都指向 node_2。
8. node_2 的唯一选项 next_node 必须是 "__GENERATE_NEXT__"。
9. chunk_id 必须是 "chunk_1"。
10. chunk_index 必须是 1。
11. type 必须是 "opening"。
12. start_node 必须是 "node_0"。
13. end_nodes 必须是 ["node_2"]。
14. 每个 node 必须包含 node_id、text、bg_theme、ui_effect、choices。
15. 每个 node.text 控制在 50-100 字。
16. bg_theme 只能是 "light"、"dark"、"danger"、"victory"。
17. 每个非结局节点最多 2 个 choices。
18. 第一段不要完结故事，不要生成广告节点。
19. 剧情节奏短平快，高冲突、强反转。
20. 普通 choices[].content 必须是具体动作，严禁只写“继续”“下一步”“进入下一幕”。
21. 不要包含违法、色情、过度血腥、政治敏感内容。

返回格式：
{
  "title": "",
  "story_state": {
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
  },
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
}`;
}
