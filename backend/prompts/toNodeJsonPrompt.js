/**
 * 第二层 Prompt：将单个预览片段转换为渲染用节点 JSON
 * 用于渐进式生成中的预览节点
 *
 * 输入：content.fragment + startNodeId
 * 输出：单个 node JSON
 */

export function buildToNodeJsonPrompt({ startNodeId }) {
  return `你是一个互动短剧渲染数据转换器。

请将单个预览片段转换为可用于前端渲染的 node JSON。

重要：只返回纯 JSON，不要 Markdown，不要解释。

硬规则：
1. node_id = "${startNodeId}"
2. bg_theme：根据剧情氛围从 ["light", "dark", "danger", "victory"] 中选择
3. ui_effect：根据剧情动作选择（见下方列表）
4. choices = []（预览节点暂无选项，完整选项等 chunk 生成后补齐）
5. is_paywall = false，is_rewrite_point = false，paywall_type = null，ad_config = null
6. is_generating = true（标记为生成中预览）

ui_effect 选项：
- ["flash_white"]：突然冲击/惊醒
- ["flash_red"]：危险/冲突/争吵
- ["flash_red", "shake"]：激烈冲突
- ["glitch"]：悬疑/转折/真相揭露
- ["success"]：成功/胜利
- []：正常叙事

bg_theme 选项：
- "light"：开场/介绍/平静开始
- "dark"：日常/平静/悬疑铺垫
- "danger"：紧张对峙/危机
- "victory"：胜利/反转/爽感

返回格式：
{
  "node": {
    "node_id": "${startNodeId}",
    "text": "片段文本",
    "bg_theme": "dark|danger|victory|light",
    "ui_effect": [],
    "is_paywall": false,
    "paywall_type": null,
    "ad_config": null,
    "is_rewrite_point": false,
    "is_generating": true,
    "choices": []
  }
}`;
}
