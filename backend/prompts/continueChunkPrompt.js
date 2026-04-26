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
