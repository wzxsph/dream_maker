import { buildArchitecturePromptSection } from '../config/storyArchitecture.js';

export function buildContinueChunkPrompt({
  storyState,
  storyCards,
  continuityContext,
  recentNodes,
  choiceContent,
  intervention,
  nextChunkIndex,
  maxChunks
}) {
  const chunkType = nextChunkIndex >= maxChunks ? 'ending' : 'middle';
  const graphRule = nextChunkIndex === 2
    ? `chunk_2 固定图：
- node_5 -> node_6_a / node_6_b
- node_6_a -> node_7
- node_6_b -> node_7
- node_7 -> "__GENERATE_NEXT__"
- end_nodes = ["node_7"]`
    : `chunk_3 固定图：
- node_8 -> node_9_a / node_9_b
- node_9_a -> node_10_ending
- node_9_b -> node_10_ending
- node_10_ending choices = []
- end_nodes = ["node_10_ending"]`;
  const interventionBlock = intervention
    ? `\n用户额外干预：\n${intervention}\n要求：只能作为接下来出现的新变量，不能覆盖已发生事实。\n`
    : '';

  return `你是一个互动短剧续写引擎。

只返回 JSON，不要 Markdown，不要解释。

生成下一幕 4 个节点。必须自然承接上一幕最后画面和玩家选择，不能跳地点、跳时间、换视角或推翻已发生事实。

硬规则：
1. node.text 50-110 字，每个节点都要有压力或信息差。
2. choices 只能用 choices 数组，最多 2 个，文案必须是具体动作。
3. 禁止只写“继续”“下一步”“进入下一幕”。
4. 分支是伪开放：A/B 代价不同，但本幕内必须汇合。
5. chunk_2 不写广告节点，广告由后端插入。
6. 必须沿着 story_state.architecture.ending_lane 收束。

连贯性与网文质感：
1. start_node.text 第一小句必须点名上一幕的关键人物/物件/场面，并写出“用户刚才选择”造成的直接结果；不要使用“下一秒，眼前局势变化”这类泛桥接。
2. 每个新增事实都要能从 story_state.facts、open_threads、最近剧情或当前小场景物件推出；不要凭空增加陌生证人、神秘文件、突然到场的权威人物。
3. 如果必须引入新工具或角色，只能是此前已经提到或符合当前场景流程的人/物，例如办公室里的同事、群消息、桌面文件、门外脚步、正在响的电话。
4. 第二幕负责“加深和反转”，不要直接大结局；第三幕负责“用已积累线索完成收束”，不要最后一刻天降关键证据。
5. 压力源要有自保逻辑，不能突然降智承认一切；主角也不能靠喊口号取胜，必须用证据、规则、心理或关系反制。
6. 保持常见网文爽感：小胜利逐步累积，反派被自己留下的漏洞反噬，主角获得体面和希望。
7. 避免模板腔和重复桥接：不要连续使用“下一秒”“空气凝固”“所有人的命运彻底改变”“世界恢复流动”。

${graphRule}

${buildArchitecturePromptSection({ nextChunkIndex })}

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
  "chunk": {
    "chunk_id": "chunk_${nextChunkIndex}",
    "chunk_index": ${nextChunkIndex},
    "type": "${chunkType}",
    "start_node": "${nextChunkIndex === 2 ? 'node_5' : 'node_8'}",
    "end_nodes": [],
    "nodes": {}
  }
}`;
}
