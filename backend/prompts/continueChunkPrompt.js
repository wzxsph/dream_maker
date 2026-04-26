import { buildArchitecturePromptSection } from '../config/storyArchitecture.js';

export function buildContinueChunkPrompt({
  storyState,
  storyCards,
  continuityContext,
  recentNodes,
  choiceContent,
  intervention,
  nextChunkIndex,
  maxChunks,
  narrativeMode = 'web_novel'
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

  const isPastDeduction = narrativeMode === 'past_deduction';
  const modeInstruction = isPastDeduction
    ? `过去推演连贯性要求（写实且克制）：
1. 必须自然承接玩家刚刚选择所带来的直接后果，注重现实的挫败感与互动。
2. 避免套路化的网文爽感与过度夸张的逆袭，所有的“成功”必须基于现实。
3. 压力源动机必须真实，避免降智。保持自然细腻的情感回响。`
    : `网文质感与爽感要求：
1. 保持爽感：小胜利逐步累积，反派被自己留下的漏洞反噬，主角获得体面。
2. 避免模板腔和重复结构：“下一秒”“世界恢复流动”等词不要重复使用。
3. 如果是职场等生活场景，也需要符合基本常识。`;

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

通用连贯性：
1. start_node.text 第一小句必须点名“用户刚才选择”造成的直接结果。
2. 新增事件不能凭空跳出陌生人或完全未提及的关键证物。
3. 绝对禁止在 JSON 字符串值内部使用未转义的英文双引号（"），请一律替换为中文引号（“”）或进行转义（\\"）。

${modeInstruction}

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
