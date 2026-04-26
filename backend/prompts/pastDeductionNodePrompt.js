/**
 * 过去推演模式：单节点生成 Prompt
 *
 * 每次只生成1个节点（包含文本和2个AI选项），
 * 用户可以额外自行输入选项C。
 * 没有固定的幕数限制，故事可以无限推演下去。
 */

export function buildPastDeductionNodePrompt({
    storyState,
    storyCards,
    continuityContext,
    recentNodes,
    choiceContent,
    intervention,
    nodeIndex
}) {
    const nodeId = `pd_node_${nodeIndex}`;
    const interventionBlock = intervention
        ? `\n用户额外干预：\n${intervention}\n要求：只能作为接下来出现的新变量，不能覆盖已发生事实。\n`
        : '';

    return `你是一个写实互动推演引擎。你现在处于【过去推演】模式。

只返回 JSON，不要 Markdown，不要解释。

生成下一个推演节点（只生成1个节点）。必须自然承接上一个节点的内容和玩家的选择。

核心原则：
1. 这是一个关于现实中某个遗憾瞬间的推演，主角试图做出不同于当初的选择。
2. 极致写实：不允许出现穿越、系统、金手指、超能力等任何网文元素。
3. 场景和人物反应必须符合真实人际关系、情感逻辑。
4. 每个节点的后果是由上一步选择直接导致的，因果链必须紧密。

节点生成规则：
1. node_id 固定为 "${nodeId}"
2. text 50-120 字，描述玩家上一步选择带来的直接后果和当前处境。
3. 第一小句必须点明"上一步选择"造成的具体结果，不要用"下一刻"等模板桥接。
4. choices 给出恰好 2 个具体的行动选项（A和B），文案必须是具体行动，不要写"继续""下一步"。
5. 每个 choice 的 next_node 都设为 "__GENERATE_NEXT__"（由系统动态生成下一个节点）。
6. bg_theme 只能是 "light"、"dark"、"danger"、"victory"。
7. 不要生成终结节点（choices 不能为空数组），除非 story_state 中明确标记了本轮推演应该收束。
8. 新事实不能凭空出现，必须能从已有线索推出。
9. 保持情感细腻与真实的挫败感/成就感。

当前故事状态：
${JSON.stringify(storyState, null, 2)}

轻量作品卡片上下文：
${JSON.stringify(storyCards || [], null, 2)}

衔接上下文：
${JSON.stringify(continuityContext || {}, null, 2)}

最近剧情节点：
${JSON.stringify(recentNodes, null, 2)}

用户刚才选择：
${choiceContent || '无'}
${interventionBlock}

返回格式：
{
  "state_patch": {
    "current_phase": "",
    "facts_add": [],
    "open_threads_add": [],
    "open_threads_resolved": [],
    "characters_update": []
  },
  "node": {
    "node_id": "${nodeId}",
    "text": "",
    "bg_theme": "dark",
    "ui_effect": [],
    "choices": [
      { "content": "选项A的具体行动", "next_node": "__GENERATE_NEXT__" },
      { "content": "选项B的具体行动", "next_node": "__GENERATE_NEXT__" }
    ]
  }
}`;
}
