export const STORY_MAX_CHUNKS = 3;

export const STORY_ARCHITECTURE = {
  id: 'micro_scene_locked_3_act',
  name: '微场景锁结局三幕架构',
  version: '2026-04-26',
  scene_contract: {
    scope: '单一核心场景，最多扩展到一个相邻小空间',
    timebox: '故事时间控制在 10-30 分钟内',
    cast_limit: '最多 3 个有姓名角色：主角、压力源、见证者/盟友',
    world_rule: '不铺大世界观，不跳地点、不跳时间、不切换主视角'
  },
  choice_contract: {
    mode: '伪开放式',
    rule: '玩家选择改变手段、代价、谁先暴露，不改变故事必须收束的结局走向'
  },
  fun_loop: [
    '每个节点先给可见压力，再给一个信息差或反转',
    '每个选项都是具体动作，禁止只写继续、下一步、进入下一幕',
    '每幕末尾必须留下一个更强的钩子，让用户愿意进入下一幕'
  ],
  ending_lanes: [
    {
      id: 'truth_reversal',
      label: '真相翻盘',
      rule: '关键证据或隐藏规则公开，主角夺回主动权，主要误会被解决'
    },
    {
      id: 'price_escape',
      label: '代价脱身',
      rule: '主角脱离即时陷阱，但必须舍弃某个关系、身份、承诺或安全感'
    },
    {
      id: 'role_swap',
      label: '身份换位',
      rule: '对手用来压制主角的身份、规则或资源反噬，对局权力发生反转'
    }
  ],
  chunks: {
    1: {
      chunk_id: 'chunk_1',
      type: 'opening',
      start_node: 'node_0',
      end_nodes: ['node_2'],
      nodes: ['node_0', 'node_1_a', 'node_1_b', 'node_2'],
      beat: '开场陷阱：把主角锁进一个小场景，立刻给出第一处危险和第一组行动选择'
    },
    2: {
      chunk_id: 'chunk_2',
      type: 'middle',
      start_node: 'node_5',
      end_nodes: ['node_7'],
      nodes: ['node_5', 'node_6_a', 'node_6_b', 'node_7'],
      beat: '中段反转：暴露新规则或隐藏筹码，让两个分支以不同代价汇合到更大的危机'
    },
    3: {
      chunk_id: 'chunk_3',
      type: 'ending',
      start_node: 'node_8',
      end_nodes: ['node_10_ending'],
      nodes: ['node_8', 'node_9_a', 'node_9_b', 'node_10_ending'],
      beat: '锁定结局：两个最后手段都通向同一结局走向，清掉主要悬念并停止续集钩子'
    }
  }
};

export function getChunkBlueprint(chunkIndex) {
  return STORY_ARCHITECTURE.chunks[chunkIndex] || STORY_ARCHITECTURE.chunks[1];
}

export function getChunkStartNodeId(chunkIndex) {
  return getChunkBlueprint(chunkIndex).start_node;
}

export function chooseEndingLane(userPrompt = '') {
  if (/逃|离开|跑|脱身|困|密室|宿舍|门|追/.test(userPrompt)) {
    return 'price_escape';
  }

  if (/身份|真假|替身|反派|白月光|系统|规则|权力|继承/.test(userPrompt)) {
    return 'role_swap';
  }

  return 'truth_reversal';
}

export function getEndingLane(endingLaneId = '') {
  return (
    STORY_ARCHITECTURE.ending_lanes.find((lane) => lane.id === endingLaneId) ||
    STORY_ARCHITECTURE.ending_lanes[0]
  );
}

export function buildDefaultArchitectureState(userPrompt = '') {
  const endingLane = getEndingLane(chooseEndingLane(userPrompt));

  return {
    id: STORY_ARCHITECTURE.id,
    name: STORY_ARCHITECTURE.name,
    version: STORY_ARCHITECTURE.version,
    scene_lock: STORY_ARCHITECTURE.scene_contract.scope,
    time_lock: STORY_ARCHITECTURE.scene_contract.timebox,
    cast_limit: STORY_ARCHITECTURE.scene_contract.cast_limit,
    choice_contract: STORY_ARCHITECTURE.choice_contract.rule,
    ending_lane: endingLane.id,
    ending_promise: endingLane.rule
  };
}

export function buildArchitecturePromptSection({ nextChunkIndex = null } = {}) {
  const chunk = nextChunkIndex ? getChunkBlueprint(nextChunkIndex) : null;
  const chunkLine = chunk
    ? `
当前幕蓝图：
- chunk_id = "${chunk.chunk_id}"，chunk_index = ${nextChunkIndex}，type = "${chunk.type}"
- start_node = "${chunk.start_node}"，end_nodes = ${JSON.stringify(chunk.end_nodes)}
- nodes 只能使用：${chunk.nodes.join('、')}
- 戏剧任务：${chunk.beat}
`
    : '';

  return `短篇互动小说统一架构：${STORY_ARCHITECTURE.name}
- 场景锁：${STORY_ARCHITECTURE.scene_contract.scope}；${STORY_ARCHITECTURE.scene_contract.timebox}
- 角色锁：${STORY_ARCHITECTURE.scene_contract.cast_limit}
- 叙事锁：${STORY_ARCHITECTURE.scene_contract.world_rule}
- 交互方式：${STORY_ARCHITECTURE.choice_contract.mode}。${STORY_ARCHITECTURE.choice_contract.rule}
- 爽感循环：${STORY_ARCHITECTURE.fun_loop.join('；')}
- 结局走向只能从以下三类选一并贯穿全文：
  1. truth_reversal：${STORY_ARCHITECTURE.ending_lanes[0].rule}
  2. price_escape：${STORY_ARCHITECTURE.ending_lanes[1].rule}
  3. role_swap：${STORY_ARCHITECTURE.ending_lanes[2].rule}
${chunkLine}`;
}
