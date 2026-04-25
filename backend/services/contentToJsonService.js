/**
 * 内容转 JSON 服务（第二层）
 * 将第一层 LLM 生成的纯文本 fragments 转换为渲染用 chunk JSON
 */

import { callLLM } from './aiService.js';
import { safeJsonParse } from '../utils/json.js';
import { httpError } from '../utils/errors.js';

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

  const prompt = buildToChunkJsonPromptWithFragments({ nextChunkIndex, maxChunks }, fragments);

  const rawText = await callLLM({
    systemPrompt: 'You are an interactive drama rendering data converter. Return only strict JSON.',
    userPrompt: prompt
  });

  const parsed = safeJsonParse(rawText);
  if (!parsed?.chunk) {
    throw httpError(500, 'Layer 2 conversion failed: invalid chunk JSON');
  }

  return parsed.chunk;
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
  // chunk 1: 灵活图结构，10+ 节点
  return buildChunk1Prompt(fragments);
}

function buildChunk1Prompt(fragments) {
  // chunk_1 固定结构：node_0 → node_1_a/node_1_b → node_2 → __GENERATE_NEXT__
  return `You are an interactive drama rendering data converter.

Convert the following text fragments into chunk_1 JSON with fixed graph structure.

Return ONLY JSON, no markdown, no explanation.

chunk_1 fixed graph:
- start_node = "node_0"
- nodes: node_0, node_1_a, node_1_b, node_2
- node_0 -> choices: [option_a -> node_1_a, option_b -> node_1_b]
- node_1_a -> choice: [-> node_2]
- node_1_b -> choice: [-> node_2]
- node_2 -> choice: [-> "__GENERATE_NEXT__"]
- end_nodes = ["node_2"]

Rules:
1. Map fragments in order: 片段0->node_0, 片段1->node_1_a, 片段2->node_1_b, 片段3->node_2
2. If fragment type is "choice_point", use its options for node choices
3. If fragment type is "scene", choices = []
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

chunk_2 fixed graph:
- start_node = "node_5"
- nodes: node_5, node_6_a, node_6_b, node_7
- node_5 -> choices: [option_a -> node_6_a, option_b -> node_6_b]
- node_6_a -> choice: [-> node_7]
- node_6_b -> choice: [-> node_7]
- node_7 -> choice: [-> "__GENERATE_NEXT__"]
- end_nodes = ["node_7"]

Rules:
1. Map fragments in order: 片段0->node_5, 片段1->node_6_a, 片段2->node_6_b, 片段3->node_7
2. If fragment type is "choice_point", use its options for node choices
3. If fragment type is "scene", choices = []
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

chunk_3 fixed graph:
- start_node = "node_8"
- nodes: node_8, node_9_a, node_9_b, node_10_ending
- node_8 -> choices: [option_a -> node_9_a, option_b -> node_9_b]
- node_9_a -> choice: [-> node_10_ending]
- node_9_b -> choice: [-> node_10_ending]
- node_10_ending -> choices = [] (ending)
- end_nodes = ["node_10_ending"]

Rules:
1. Map fragments in order: 片段0->node_8, 片段1->node_9_a, 片段2->node_9_b, 片段3->node_10_ending
2. node_10_ending must have choices = [] (ending)
3. bg_theme: choose from ["light","dark","danger","victory"]
4. ui_effect: choose based on drama action
5. is_paywall = false, is_rewrite_point = false

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
