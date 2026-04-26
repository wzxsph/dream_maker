/**
 * 内容转 JSON 服务（第二层）
 * 将第一层 LLM 生成的纯文本 fragments 转换为渲染用 chunk JSON
 */

import { callLLM } from './aiService.js';
import { safeJsonParse } from '../utils/json.js';
import { httpError } from '../utils/errors.js';
import { buildArchitecturePromptSection, getChunkBlueprint } from '../config/storyArchitecture.js';

/**
 * 将 content.fragments 转换为完整 chunk JSON
 * @param {Array} fragments - 第一层生成的纯文本片段
 * @param {number} nextChunkIndex
 * @param {number} maxChunks
 * @returns {Promise<Object>} 完整 chunk JSON
 */
export async function fragmentsToChunkJson(fragments, nextChunkIndex, maxChunks) {
  if (!Array.isArray(fragments) || fragments.length === 0) {
    throw httpError(500, 'fragments empty or invalid');
  }

  return buildChunkFromFragments(fragments, nextChunkIndex, maxChunks);
}

/**
 * 将单个预览片段转换为 node JSON
 * @param {Object} fragment - 第一层生成的单个片段
 * @param {string} startNodeId
 * @returns {Promise<Object>} node JSON
 */
export async function fragmentToNodeJson(fragment, startNodeId) {
  if (!fragment?.text) {
    throw httpError(500, 'fragment invalid');
  }

  const rawText = await callLLM({
    systemPrompt: 'You are an interactive drama rendering data converter. Return only strict JSON.',
    userPrompt: buildToNodeJsonPromptWithFragment({ startNodeId }, fragment)
  });

  const parsed = safeJsonParse(rawText);
  if (!parsed?.node) {
    throw httpError(500, 'Layer 2 conversion failed: invalid node JSON');
  }

  return parsed.node;
}

// ===================== 内部辅助函数 =====================

const GENERATE_NEXT = '__GENERATE_NEXT__';

const GRAPH_TARGETS = {
  1: {
    node_0: ['node_1_a', 'node_1_b'],
    node_1_a: ['node_2'],
    node_1_b: ['node_2'],
    node_2: [GENERATE_NEXT]
  },
  2: {
    node_5: ['node_6_a', 'node_6_b'],
    node_6_a: ['node_7'],
    node_6_b: ['node_7'],
    node_7: [GENERATE_NEXT]
  },
  3: {
    node_8: ['node_9_a', 'node_9_b'],
    node_9_a: ['node_10_ending'],
    node_9_b: ['node_10_ending'],
    node_10_ending: []
  }
};

const DEFAULT_TEXTS = {
  0: '局势在眼前骤然绷紧，所有人的目光都压向你。你知道，下一步必须立刻做出选择。',
  1: '你选择正面迎上去，空气像被拉紧，隐藏的破绽开始露出边角。',
  2: '你换了另一种方式试探，对方的反应比你预想得更快，也更危险。',
  3: '两条线索在这一刻汇合，更大的危机已经逼到眼前。你必须抓住最后一点主动权。'
};

const DEFAULT_OPTIONS = {
  node_0: ['正面破局，抢先夺回主动', '暂时示弱，套出更深破绽'],
  node_1_a: ['抓住破绽继续追问'],
  node_1_b: ['顺势逼近关键证据'],
  node_2: ['带着当前筹码追击下一幕'],
  node_5: ['公开手里的关键筹码', '藏住底牌反向试探'],
  node_6_a: ['把优势压到对方面前'],
  node_6_b: ['逼对方先露出破绽'],
  node_7: ['趁世界恢复流动继续追击'],
  node_8: ['公开全部证据完成翻盘', '保留最后底牌逼她坦白'],
  node_9_a: ['当众收回自己的名字'],
  node_9_b: ['亲手关闭这场审判']
};

function buildChunkFromFragments(fragments, nextChunkIndex, maxChunks) {
  const blueprint = getChunkBlueprint(nextChunkIndex);
  const nodeIds = blueprint.nodes;
  const targetsByNode = GRAPH_TARGETS[nextChunkIndex] || GRAPH_TARGETS[1];
  const nodes = {};

  nodeIds.forEach((nodeId, index) => {
    const fragment = fragments[index] || {};
    const targets = targetsByNode[nodeId] || [];
    nodes[nodeId] = {
      node_id: nodeId,
      text: getFragmentText(fragment, index),
      bg_theme: chooseTheme(fragment, nextChunkIndex, nodeId),
      ui_effect: chooseEffects(fragment, nodeId),
      is_paywall: false,
      paywall_type: null,
      ad_config: null,
      is_rewrite_point: nextChunkIndex < maxChunks && nodeId === blueprint.end_nodes[0],
      choices: buildChoices(nodeId, fragment, targets)
    };
  });

  return {
    chunk_id: blueprint.chunk_id,
    chunk_index: nextChunkIndex,
    type: blueprint.type,
    start_node: blueprint.start_node,
    end_nodes: [...blueprint.end_nodes],
    nodes
  };
}

function getFragmentText(fragment, index) {
  return String(fragment?.text || fragment?.content || fragment?.body || DEFAULT_TEXTS[index] || DEFAULT_TEXTS[3]).trim();
}

function getFragmentOptions(fragment) {
  if (!Array.isArray(fragment?.options)) {
    return [];
  }

  return fragment.options
    .map((option) => (typeof option === 'string' ? option : option?.content || option?.text || option?.label))
    .map((option) => String(option || '').trim())
    .filter(Boolean);
}

function buildChoices(nodeId, fragment, targets) {
  const options = getFragmentOptions(fragment);
  const defaults = DEFAULT_OPTIONS[nodeId] || ['顺势追问关键真相'];

  return targets.map((target, index) => ({
    content: options[index] || defaults[index] || defaults[0],
    next_node: target
  }));
}

function chooseTheme(fragment, nextChunkIndex, nodeId) {
  const text = getFragmentText(fragment, 0);

  if (nextChunkIndex === 3 || /胜|赢|翻盘|收回|完成|真相大白/.test(text)) {
    return 'victory';
  }

  if (/危|死|血|怒|威胁|崩|警报|逼|摔|锁|恐/.test(text) || /_b$|_7$|_2$/.test(nodeId)) {
    return 'danger';
  }

  if (/醒|白光|清晨|灯|亮/.test(text)) {
    return 'light';
  }

  return 'dark';
}

function chooseEffects(fragment, nodeId) {
  const text = getFragmentText(fragment, 0);
  const effects = new Set();

  if (/白光|刺目|醒来|突然/.test(text)) {
    effects.add('flash_white');
  }
  if (/怒|威胁|危险|警报|逼|摔|崩/.test(text) || /_7$|_2$/.test(nodeId)) {
    effects.add('flash_red');
  }
  if (/震|摔|打|撞|崩|炸/.test(text)) {
    effects.add('shake');
  }
  if (/系统|心声|监控|真相|提示|规则/.test(text)) {
    effects.add('glitch');
  }
  if (/胜|赢|翻盘|完成|收回/.test(text)) {
    effects.add('success');
  }

  return [...effects].slice(0, 2);
}

function buildToChunkJsonPromptWithFragments({ nextChunkIndex, maxChunks }, fragments) {
  const isChunk2 = nextChunkIndex === 2;
  const isChunk3 = nextChunkIndex === maxChunks;

  // chunk 2/3 使用固定结构，chunk 1 使用灵活图结构
  if (isChunk2) {
    return buildChunk2Prompt(fragments);
  }
  if (isChunk3) {
    return buildChunk3Prompt(fragments);
  }
  // chunk 1: 固定伪开放图结构
  return buildChunk1Prompt(fragments);
}

function buildChunk1Prompt(fragments) {
  // chunk_1 固定结构：node_0 → node_1_a/node_1_b → node_2 → __GENERATE_NEXT__
  return `You are an interactive drama rendering data converter.

Convert the following text fragments into chunk_1 JSON with fixed graph structure.

Return ONLY JSON, no markdown, no explanation.

${buildArchitecturePromptSection({ nextChunkIndex: 1 })}

chunk_1 fixed graph:
- start_node = "node_0"
- nodes: node_0, node_1_a, node_1_b, node_2
- node_0 uses 片段0 text and 片段0.options: option_a -> node_1_a, option_b -> node_1_b
- node_1_a uses 片段1 text and has one concrete action choice -> node_2
- node_1_b uses 片段2 text and has one concrete action choice -> node_2
- node_2 uses 片段3 text and 片段3.options: every choice -> "__GENERATE_NEXT__"
- end_nodes = ["node_2"]

Rules:
1. Map fragments in order: 片段0->node_0, 片段1->node_1_a, 片段2->node_1_b, 片段3->node_2
2. Never leave reachable non-ending nodes with choices = []
3. For node_1_a and node_1_b, write a short concrete bridge action as choice.content, not "continue"
4. bg_theme: choose from ["light","dark","danger","victory"]
   - "light"/"dark": opening/normal scenes
   - "danger": conflict/confrontation
   - "victory": success/reversal
5. ui_effect: choose based on drama action
   - sudden shock -> ["flash_white"]
   - danger/conflict -> ["flash_red"]
   - intense conflict -> ["flash_red","shake"]
   - suspense/reveal -> ["glitch"]
   - success -> ["success"]
   - normal narrative -> []
6. is_paywall = false, paywall_type = null, ad_config = null, is_rewrite_point = false

Layer 1 fragments:
${JSON.stringify(fragments, null, 2)}

Return format:
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

function buildChunk2Prompt(fragments) {
  return `You are an interactive drama rendering data converter.

Convert the following text fragments into chunk_2 JSON with fixed graph structure.

Return ONLY JSON, no markdown, no explanation.

${buildArchitecturePromptSection({ nextChunkIndex: 2 })}

chunk_2 fixed graph:
- start_node = "node_5"
- nodes: node_5, node_6_a, node_6_b, node_7
- node_5 uses 片段0 text and 片段0.options: option_a -> node_6_a, option_b -> node_6_b
- node_6_a uses 片段1 text and has one concrete action choice -> node_7
- node_6_b uses 片段2 text and has one concrete action choice -> node_7
- node_7 uses 片段3 text and 片段3.options: every choice -> "__GENERATE_NEXT__"
- end_nodes = ["node_7"]

Rules:
1. Map fragments in order: 片段0->node_5, 片段1->node_6_a, 片段2->node_6_b, 片段3->node_7
2. Never leave reachable non-ending nodes with choices = []
3. For node_6_a and node_6_b, write a short concrete bridge action as choice.content, not "continue"
4. bg_theme: choose from ["light","dark","danger","victory"]
5. ui_effect: choose based on drama action
6. is_paywall = false, is_rewrite_point = false

Layer 1 fragments:
${JSON.stringify(fragments, null, 2)}

Return format:
{
  "chunk": {
    "chunk_id": "chunk_2",
    "chunk_index": 2,
    "type": "middle",
    "start_node": "node_5",
    "end_nodes": ["node_7"],
    "nodes": {}
  }
}`;
}

function buildChunk3Prompt(fragments) {
  return `You are an interactive drama rendering data converter.

Convert the following text fragments into chunk_3 JSON with fixed graph structure.

Return ONLY JSON, no markdown, no explanation.

${buildArchitecturePromptSection({ nextChunkIndex: 3 })}

chunk_3 fixed graph:
- start_node = "node_8"
- nodes: node_8, node_9_a, node_9_b, node_10_ending
- node_8 uses 片段0 text and 片段0.options: option_a -> node_9_a, option_b -> node_9_b
- node_9_a uses 片段1 text and has one concrete final action choice -> node_10_ending
- node_9_b uses 片段2 text and has one concrete final action choice -> node_10_ending
- node_10_ending -> choices = [] (ending)
- end_nodes = ["node_10_ending"]

Rules:
1. Map fragments in order: 片段0->node_8, 片段1->node_9_a, 片段2->node_9_b, 片段3->node_10_ending
2. node_10_ending must have choices = [] (ending)
3. node_10_ending must obey story_state.architecture.ending_lane if present in upstream context
4. bg_theme: choose from ["light","dark","danger","victory"]
5. ui_effect: choose based on drama action
6. is_paywall = false, is_rewrite_point = false

Layer 1 fragments:
${JSON.stringify(fragments, null, 2)}

Return format:
{
  "chunk": {
    "chunk_id": "chunk_3",
    "chunk_index": 3,
    "type": "ending",
    "start_node": "node_8",
    "end_nodes": ["node_10_ending"],
    "nodes": {}
  }
}`;
}

function buildToNodeJsonPromptWithFragment({ startNodeId }, fragment) {
  return `You are an interactive drama rendering data converter.
Convert the following preview fragment into a node JSON for frontend rendering.

Return ONLY JSON, no markdown, no explanation.

startNodeId = "${startNodeId}"

Fragment:
${JSON.stringify(fragment, null, 2)}

Rules:
1. node_id = "${startNodeId}"
2. bg_theme: choose from ["light", "dark", "danger", "victory"]
3. ui_effect: choose based on drama action
   - sudden shock -> ["flash_white"]
   - danger/conflict -> ["flash_red"]
   - intense conflict -> ["flash_red", "shake"]
   - suspense/reveal -> ["glitch"]
   - success/victory -> ["success"]
   - normal narrative -> []
4. choices = [] (preview node has no choices yet)
5. is_paywall = false, is_rewrite_point = false, paywall_type = null, ad_config = null
6. is_generating = true

Return format:
{
  "node": {
    "node_id": "${startNodeId}",
    "text": "fragment text",
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
