import { buildArchitecturePromptSection } from '../config/storyArchitecture.js';

/**
 * Layer 2 Prompt：chunk 1 结构生成
 *
 * 输入：4 个纯文本 fragments
 * 输出：第一幕固定伪开放节点图
 */

export function buildChunk1GraphPrompt(nextChunkIndex, maxChunks) {
  return `你是一个互动短剧图结构设计器和渲染数据转换器。

根据 Layer 1 生成的 4 个纯文本片段，输出第一幕 chunk JSON。

重要：只返回纯 JSON，不要 Markdown，不要解释。

chunk 序号：nextChunkIndex = ${nextChunkIndex}，maxChunks = ${maxChunks}

${buildArchitecturePromptSection({ nextChunkIndex: 1 })}

第一幕（chunk_1）固定图结构：
- chunk_id = "chunk_1"，chunk_index = 1，type = "opening"
- start_node = "node_0"，end_nodes = ["node_2"]
- nodes 必须且只能包含 node_0、node_1_a、node_1_b、node_2
- 片段0 → node_0，使用片段0.options 生成 2 个 choices，分别指向 node_1_a、node_1_b
- 片段1 → node_1_a，生成 1 个具体动作 choice 指向 node_2
- 片段2 → node_1_b，生成 1 个具体动作 choice 指向 node_2
- 片段3 → node_2，使用片段3.options 生成 1-2 个 choices，next_node 都是 "__GENERATE_NEXT__"

渲染规则：
1. 每个 node.text 直接使用对应 fragment.text，不改写正文
2. 每个 node 必须包含 node_id、text、bg_theme、ui_effect、is_paywall、paywall_type、ad_config、is_rewrite_point、choices
3. bg_theme 只能从 "light"、"dark"、"danger"、"victory" 中选
4. node_2.is_rewrite_point = true，其余节点 is_rewrite_point = false
5. is_paywall = false，paywall_type = null，ad_config = null
6. 普通 choices[].content 必须是具体剧情动作，禁止只写“继续”“下一步”“进入下一幕”

返回格式：
{
  "chunk": {
    "chunk_id": "chunk_1",
    "chunk_index": 1,
    "type": "opening",
    "start_node": "node_0",
    "end_nodes": ["node_2"],
    "nodes": {}
  }
}`;
}
