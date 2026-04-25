/**
 * Batch 2 Pipeline
 *
 * 在玩家阅读第一批节点时，后台生成第二批节点
 * node_3_a, node_3_b → node_4 → __GENERATE_NEXT__
 *
 * 流程：
 * 1. Layer 1: 生成 3 个纯文本 fragments
 * 2. Layer 2: 转换为 3 个节点 JSON
 * 3. 存入 session.batch_2_nodes
 */

import { buildBatch2ContentPrompt } from '../prompts/batch2ContentPrompt.js';
import { callLLM, hasApiKey } from './aiService.js';
import { loadStorySession, saveStorySession } from './storageService.js';
import { fragmentsToChunkJson } from './contentToJsonService.js';
import { safeJsonParse } from '../utils/json.js';
import { httpError } from '../utils/errors.js';

export async function batch2Pipeline({ storyId, userPrompt }) {
  const session = await loadStorySession(storyId);

  // 防止重复生成
  if (session.batch_2_status === 'done' || session.batch_2_status === 'generating') {
    console.log(`[batch2Pipeline] story ${storyId} batch_2 already status: ${session.batch_2_status}`);
    return;
  }

  session.batch_2_status = 'generating';
  await saveStorySession(session);

  try {
    if (!hasApiKey()) {
      // mock 模式：生成简单节点
      session.batch_2_nodes = buildMockBatch2Nodes();
      session.batch_2_status = 'done';
      await saveStorySession(session);
      return;
    }

    // ========== Layer 1: 生成纯文本 fragments ==========
    const contentText = await callLLM({
      systemPrompt: '你是一个互动短剧续写引擎，只返回严格 JSON。',
      userPrompt: buildBatch2ContentPrompt({
        storyState: session.story_state,
        storyCards: session.cards || [],
        continuityContext: buildBatch2ContinuityContext(session),
        firstBatchNodes: session.chunks?.[0]?.nodes || {}
      }),
      maxTokens: 2048,
      temperature: 1.0
    });

    console.log(`[batch2Pipeline] Layer 1 raw response length: ${contentText?.length}`);

    const contentParsed = safeJsonParse(contentText);
    if (!contentParsed?.content?.fragments) {
      throw new Error('Layer 1 batch2 未返回有效 fragments');
    }

    const fragments = contentParsed.content.fragments;

    // ========== Layer 2: 转换为节点 JSON ==========
    const nodes = await fragmentsToBatch2Nodes(fragments);

    session.batch_2_nodes = nodes;
    session.batch_2_status = 'done';
    session.batch_2_state_patch = contentParsed.state_patch || {};
    await saveStorySession(session);

    console.log(`[batch2Pipeline] batch2 done, nodes: ${Object.keys(nodes).join(', ')}`);

  } catch (error) {
    console.error(`[batch2Pipeline] error for story ${storyId}:`, error.message);
    session.batch_2_status = 'error';
    session.batch_2_error = error.message;
    await saveStorySession(session);
    throw error;
  }
}

async function fragmentsToBatch2Nodes(fragments) {
  // batch2: node_3_a, node_3_b → node_4 → __GENERATE_NEXT__
  const prompt = buildBatch2ChunkPrompt(fragments);

  const rawText = await callLLM({
    systemPrompt: 'You are an interactive drama rendering data converter. Return only strict JSON.',
    userPrompt: prompt
  });

  const parsed = safeJsonParse(rawText);
  if (!parsed?.chunk?.nodes) {
    throw httpError(500, 'Layer 2 batch2 转换失败');
  }

  return parsed.chunk.nodes;
}

function buildBatch2ChunkPrompt(fragments) {
  // batch2 固定结构：node_3_a/node_3_b → node_4 → __GENERATE_NEXT__
  return `You are an interactive drama rendering data converter.

Convert the following text fragments into batch_2 nodes JSON with fixed graph structure.

Return ONLY JSON, no markdown, no explanation.

batch_2 fixed graph:
- nodes: node_3_a, node_3_b, node_4
- node_3_a -> choice: [-> node_4]
- node_3_b -> choice: [-> node_4]
- node_4 -> choice: [-> "__GENERATE_NEXT__"]
- node_4 is the ending node of this batch

Rules:
1. Map fragments in order: 片段0->node_3_a, 片段1->node_3_b, 片段2->node_4
2. If fragment type is "choice_point", use its options for node choices
3. If fragment type is "scene", choices = []
4. bg_theme: choose from ["light","dark","danger","victory"]
   - "danger": conflict/confrontation/crisis
   - "victory": success/reversal
   - "dark": daily/calm/suspense
   - "light": opening/intro
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
    "chunk_id": "batch_2",
    "nodes": {
      "node_3_a": { "node_id": "node_3_a", "text": "...", "bg_theme": "...", "ui_effect": [], "is_paywall": false, "paywall_type": null, "ad_config": null, "is_rewrite_point": false, "choices": [...] },
      "node_3_b": { ... },
      "node_4": { ... }
    }
  }
}`;
}

function buildBatch2ContinuityContext(session) {
  const nodes = session.chunks?.[0]?.nodes || {};
  const lastNode = nodes['node_2'];
  return {
    current_node_text: lastNode?.text || '',
    selected_choice: '',
    intervention: '',
    recent_player_path: []
  };
}

function buildMockBatch2Nodes() {
  return {
    node_3_a: {
      node_id: 'node_3_a',
      text: '你的话音落下，空气像被骤然绷紧。所有人的目光瞬间聚焦过来，新的危机正在靠近。',
      bg_theme: 'danger',
      ui_effect: ['glitch'],
      is_paywall: false,
      paywall_type: null,
      ad_config: null,
      is_rewrite_point: false,
      choices: [{ content: '正面迎战', next_node: 'node_4' }]
    },
    node_3_b: {
      node_id: 'node_3_b',
      text: '你没有退缩，反而向前迈了一步。所有人都在等待你的下一步动作。',
      bg_theme: 'danger',
      ui_effect: ['flash_red'],
      is_paywall: false,
      paywall_type: null,
      ad_config: null,
      is_rewrite_point: false,
      choices: [{ content: '策略周旋', next_node: 'node_4' }]
    },
    node_4: {
      node_id: 'node_4',
      text: '就在局势即将逆转的瞬间，你脑海里忽然响起冰冷的提示音：【检测到关键抉择点。】接下来的选择，将决定这一章的结局。',
      bg_theme: 'danger',
      ui_effect: ['flash_red', 'glitch'],
      is_paywall: false,
      paywall_type: null,
      ad_config: null,
      is_rewrite_point: true,
      choices: [{ content: '进入下一幕', next_node: '__GENERATE_NEXT__' }]
    }
  };
}
