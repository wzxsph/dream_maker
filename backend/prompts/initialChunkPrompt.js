import { buildArchitecturePromptSection } from '../config/storyArchitecture.js';

export function buildInitialChunkPrompt(storyState) {
  return `你是一个互动短剧剧情节点生成器。

请根据故事状态，生成第一段互动剧情 chunk。

要求：
1. 只返回纯 JSON。
2. 不要返回 Markdown。
3. 固定生成 4 个节点：node_0、node_1_a、node_1_b、node_2。
4. chunk_id 必须是 "chunk_1"。
5. chunk_index 必须是 1。
6. type 必须是 "opening"。
7. start_node 必须是 "node_0"。
8. 每个 node 必须包含 node_id、text、bg_theme、ui_effect、choices。
9. bg_theme 只能从 "light"、"dark"、"danger"、"victory" 中选择。
10. 每个非结局节点最多 2 个 choices。
11. 第一段不要完结故事。
12. 第一段不要生成广告节点。
13. 至少一个末尾选择的 next_node 必须是 "__GENERATE_NEXT__"。
14. 节奏要高冲突、强反转、短平快。
15. 必须遵守微场景锁和 storyState.architecture.ending_lane。
16. node_0 两个选项分别指向 node_1_a / node_1_b。
17. node_1_a 和 node_1_b 的选项都指向 node_2。
18. node_2 的具体动作选项 next_node 必须是 "__GENERATE_NEXT__"。

故事状态：
${JSON.stringify(storyState, null, 2)}

${buildArchitecturePromptSection({ nextChunkIndex: 1 })}

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
    "chunk_id": "chunk_1",
    "chunk_index": 1,
    "type": "opening",
    "start_node": "node_0",
    "end_nodes": [],
    "nodes": {}
  }
}`;
}
