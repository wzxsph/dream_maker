/**
 * Layer 2 Prompt：chunk 1 结构生成
 *
 * 输入：10-14 个纯文本 fragments
 * 输出：灵活图结构的 chunk JSON（10-20 个节点）
 *
 * chunk 1 结构策略：
 * - 开场序列（片段0-5）展开为多个节点
 * - 第一个选择点（片段6）分支为 A/B 两个子路径（各 1-2 节点）
 * - 两个子路径合并到片段7（汇聚节点）
 * - 汇聚节点（片段7）再分支为 C/D 两个最终选项（片段8-9）
 * - 最终选择（片段10）→ __GENERATE_NEXT__
 */

export function buildChunk1GraphPrompt(nextChunkIndex, maxChunks) {
  return `你是一个互动短剧图结构设计器和渲染数据转换器。

根据 Layer 1 生成的纯文本片段（10-14个），设计并输出第一幕的完整 chunk JSON。

重要：只返回纯 JSON，不要 Markdown，不要解释。

chunk 序号：nextChunkIndex = ${nextChunkIndex}，maxChunks = ${maxChunks}

第一幕（chunk_1）图结构设计规则：

图结构定义：
- chunk_index = 1，type = "opening"，chunk_id = "chunk_1"
- start_node = "node_0"

开场序列（必须全部使用）：
- 片段0 → node_0（start_node，choices → node_1）
- 片段1 → node_1（choices → node_2）
- 片段2 → node_2（choices → node_3）
- 片段3 → node_3（choices → node_4）
- 片段4 → node_4（choices → node_5）
- 片段5 → node_5（choices → choice_point_a）

第一个选择点（必须使用片段6）：
- 片段6 → choice_point_a（node_6），type = "choice_point"
- choice_point_a 有 2 个 choices：
  - option_a_text → node_a1
  - option_b_text → node_b1

分支A路径（使用片段7-8，若不足则合并）：
- 片段7 → node_a1（choices → node_a2）
- 片段8 → node_a2（choices → node_merge）

分支B路径（使用片段9-10，若不足则合并）：
- 片段9 → node_b1（choices → node_b2）
- 片段10 → node_b2（choices → node_merge）

汇聚节点（使用片段11）：
- 片段11 → node_merge（choices → choice_point_b）

第二个选择点（使用片段12，若无则复用汇聚逻辑）：
- 若有片段12 → choice_point_b（node_12），type = "choice_point"
  - choices: option_c_text → node_c1, option_d_text → node_d1
  - node_c1 → node_final, node_d1 → node_final
- 若无片段12：node_merge → choice_point_b（复用 node_merge）

最终选择点（使用最后1-2个片段）：
- 最后片段 → node_final，type = "choice_point"
  - choices: [进入下一幕] → __GENERATE_NEXT__
- chunk_1 的 end_nodes 包含 node_final

bg_theme 分配策略：
- 开场（node_0-node_3）："light" 或 "dark"
- 冲突升级（node_4-node_6）："danger"
- 选择点瞬间："dark"
- 分支路径："danger"
- 汇聚/结尾："dark" 或 "danger"
- 最终选择点："danger"

ui_effect 分配策略：
- 开场冲击："flash_white"
- 冲突/争吵："flash_red"
- 激烈对抗："flash_red", "shake"
- 悬疑/转折："glitch"
- 胜利/反击成功："success"
- 正常叙事：[]

重要：
1. 每个 node.text 直接使用对应 fragment 的 text 内容，不要改写
2. choices 的 content 必须使用 fragment.options 中的文案
3. choices 数量：scene 类型 = []，choice_point 类型 ≥ 1
4. is_paywall = false，paywall_type = null，ad_config = null
5. is_rewrite_point = false
6. end_nodes = ["node_final"]
7. nodes 对象中的所有 node_id 必须与上述定义一致

返回格式：
{
  "chunk": {
    "chunk_id": "chunk_1",
    "chunk_index": 1,
    "type": "opening",
    "start_node": "node_0",
    "end_nodes": ["node_final"],
    "nodes": {
      "node_0": { "node_id": "node_0", "text": "...", "bg_theme": "...", "ui_effect": [], "is_paywall": false, "paywall_type": null, "ad_config": null, "is_rewrite_point": false, "choices": [...] },
      ...
    }
  }
}`;
}
