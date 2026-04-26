/**
 * 初始故事 Pipeline
 *
 * 流程：
 * 1. Layer 0: 生成标题 + 简介（返回给用户立即阅读）
 * 2. Layer 1: 生成 4 个纯文本 fragments
 * 3. Layer 2: 转换为第一幕固定伪开放节点图
 */

import { buildStoryIntroPrompt } from '../prompts/storyIntroPrompt.js';
import { buildContinueChunkPrompt } from '../prompts/continueChunkPrompt.js';
import { buildMockInitialChunk, buildMockInitialState } from '../mock/mockInitial.js';
import { buildMockContinueChunk } from '../mock/mockContinue.js';
import { callLLM, hasApiKey } from './aiService.js';
import { parseAndValidateAiJson } from './aiJsonService.js';
import { moderateChunk, validateUserPrompt } from './moderationService.js';
import { generateStoryId } from '../utils/id.js';
import {
  buildContinuityContext,
  createSession,
  getRecentNodes,
  mergeChunk
} from './storySessionService.js';
import { loadStorySession, saveStorySession } from './storageService.js';
import { buildStoryCards, compactStoryCards, syncStoryCards } from './storyCardService.js';
import { safeJsonParse } from '../utils/json.js';
import { startGenerationJob } from './generationJobService.js';
import { fragmentsToChunkJson } from './contentToJsonService.js';
import { mergeStatePatch } from './storyStateService.js';
import {
  normalizeStoryResult,
  reinforceChunkContinuity,
  repairChunkGraphForArchitecture
} from './storyNormalizer.js';
import { validateStoryResult } from './storyValidator.js';
import { validateChunkGraph } from './graphValidator.js';
import { ensurePaywallForChunk2, stripPaywallsOutsideChunk2 } from './paywallService.js';

function normalizeIntroResult(rawResult, userPrompt) {
  const title = rawResult?.title || '命运改写局';
  const synopsis = rawResult?.synopsis || '命运的齿轮开始转动，新的故事即将展开。';
  return { title, synopsis };
}

function mergeInitialStoryState(baseState, generatedState = {}) {
  const next = {
    ...baseState,
    ...generatedState,
    protagonist: {
      ...(baseState?.protagonist || {}),
      ...(generatedState?.protagonist || {})
    },
    architecture: {
      ...(baseState?.architecture || {}),
      ...(generatedState?.architecture || {})
    }
  };

  next.characters = Array.isArray(generatedState.characters)
    ? generatedState.characters
    : baseState?.characters || [];
  next.facts = Array.isArray(generatedState.facts) ? generatedState.facts : baseState?.facts || [];
  next.open_threads = Array.isArray(generatedState.open_threads)
    ? generatedState.open_threads
    : baseState?.open_threads || [];
  next.constraints = Array.isArray(generatedState.constraints)
    ? generatedState.constraints
    : baseState?.constraints || [];

  return next;
}

export async function initialStoryPipeline({ userPrompt, narrativeMode = 'web_novel' }) {
  const prompt = validateUserPrompt(userPrompt);
  const storyId = generateStoryId();

  // ========== Layer 0: 生成标题 + 简介 ==========
  let introResult;
  if (!hasApiKey()) {
    const mock = buildMockInitialState(prompt);
    introResult = { title: mock.title, synopsis: '命运的齿轮开始转动，新的故事即将展开。' };
  } else {
    const rawText = await callLLM({
      systemPrompt: '你是一个互动短剧策划器，只返回严格 JSON。',
      userPrompt: buildStoryIntroPrompt(prompt, narrativeMode),
      maxTokens: 512,
      temperature: 0.8
    });
    const parsed = safeJsonParse(rawText);
    introResult = normalizeIntroResult(parsed, prompt);
  }

  // 创建 session（初始状态）
  const session = createSession({
    storyId,
    title: introResult.title,
    synopsis: introResult.synopsis,
    userPrompt: prompt,
    narrativeMode,
    status: 'intro'
  });
  await saveStorySession(session);

  // ========== 后台预生成 ==========
  if (narrativeMode === 'past_deduction') {
    // 过去推演模式：只生成第一个开场节点，不预生成全部幕
    await generatePastDeductionOpening({ storyId, userPrompt: prompt, title: introResult.title, synopsis: introResult.synopsis });
  } else if (hasApiKey()) {
    startGenerationJob(() => generateFullStory({ storyId, userPrompt: prompt, narrativeMode }));
  } else {
    // mock 模式：直接生成
    const mockState = buildMockInitialState(prompt);
    const mockResult = buildMockInitialChunk();
    session.chunks = [];
    session.node_index = {};
    session.story_state = mergeStatePatch(mockState, mockResult.state_patch);
    applyChunkResultToSession(session, mockResult);
    applyChunkResultToSession(session, buildMockContinueChunk({
      nextChunkIndex: 2,
      choiceContent: getFirstGenerateChoice(mockResult.chunk)?.content || '带着当前筹码追击下一幕'
    }));
    applyChunkResultToSession(session, buildMockContinueChunk({
      nextChunkIndex: 3,
      choiceContent: '抓住对方露出的破绽继续追证'
    }));
    session.cards = buildStoryCards({ userPrompt: prompt, title: introResult.title, storyState: session.story_state });
    session.generation_status = 'ready';
    session.generated_chunk_count = session.chunks.length;
    await saveStorySession(session);
  }

  const latestSession = await loadStorySession(storyId);

  return {
    story_id: storyId,
    title: introResult.title,
    synopsis: introResult.synopsis,
    narrative_mode: narrativeMode,
    status: latestSession.status,
    generation_status: latestSession.generation_status,
    generated_chunk_count: latestSession.generated_chunk_count || latestSession.chunks?.length || 0,
    max_chunks: latestSession.max_chunks,
    chunks: narrativeMode === 'past_deduction' ? latestSession.chunks : undefined
  };
}

async function generateFullStory({ storyId, userPrompt, narrativeMode = 'web_novel' }) {
  const session = await loadStorySession(storyId);

  try {
    session.generation_status = 'generating';
    session.generated_chunk_count = session.chunks?.length || 0;
    await saveStorySession(session);

    const openingResult = await generateOpeningChunkResult({
      userPrompt,
      title: session.title,
      synopsis: session.synopsis,
      narrativeMode: session.narrative_mode || narrativeMode
    });

    // 合并到 session
    session.story_state = mergeInitialStoryState(session.story_state, openingResult.story_state);
    applyChunkResultToSession(session, openingResult);
    session.cards = buildStoryCards({ userPrompt, title: session.title, storyState: session.story_state });
    await saveStorySession(session);

    const chunk2Result = await generateContinuationChunkResult({
      session,
      currentNodeId: 'node_2',
      choiceContent: getFirstGenerateChoice(openingResult.chunk)?.content || '带着当前筹码追击下一幕',
      nextChunkIndex: 2
    });
    applyChunkResultToSession(session, chunk2Result);
    syncStoryCards(session);
    await saveStorySession(session);

    const chunk3Result = await generateContinuationChunkResult({
      session,
      currentNodeId: 'node_7',
      choiceContent: getFirstGenerateChoice(chunk2Result.chunk)?.content || '抓住对方露出的破绽继续追证',
      nextChunkIndex: 3
    });
    applyChunkResultToSession(session, chunk3Result);
    syncStoryCards(session);

    session.generation_status = 'ready';
    session.generated_chunk_count = session.chunks.length;
    if (session.status === 'countdown') {
      session.status = 'ready';
    }
    await saveStorySession(session);

    console.log(`[generateFullStory] story ${storyId} prebuilt chunks: ${session.chunks.map((chunk) => chunk.chunk_id).join(', ')}`);

  } catch (error) {
    console.error(`[generateFullStory] error for story ${storyId}:`, error.message);
    session.status = 'error';
    session.generation_status = 'error';
    session.error = error.message;
    await saveStorySession(session);
  }
}

async function generateOpeningChunkResult({ userPrompt, title, synopsis, narrativeMode = 'web_novel' }) {
  const { buildStoryContentPrompt } = await import('../prompts/storyContentPrompt.js');
  const contentText = await callLLM({
    systemPrompt: '你是一个互动短剧策划器，只返回严格 JSON。',
    userPrompt: buildStoryContentPrompt({ userPrompt, title, synopsis, narrativeMode }),
    maxTokens: 2048,
    temperature: 1.0
  });

  console.log(`[generateFullStory] opening layer raw length: ${contentText?.length}`);

  const contentParsed = safeJsonParse(contentText);
  if (!contentParsed?.content?.fragments) {
    throw new Error('Layer 1 未返回有效 fragments');
  }

  const chunkJson = await fragmentsToChunkJson(contentParsed.content.fragments, 1, 3);

  return {
    story_state: contentParsed.story_state || {},
    state_patch: contentParsed.state_patch || {},
    chunk: chunkJson
  };
}

async function generateContinuationChunkResult({
  session,
  currentNodeId,
  choiceContent,
  nextChunkIndex
}) {
  const continuityContext = buildContinuityContext(session, {
    currentNodeId,
    choiceContent,
    intervention: ''
  });

  if (!hasApiKey()) {
    return buildMockContinueChunk({ nextChunkIndex, choiceContent });
  }

  const chunkText = await callLLM({
    systemPrompt: '你是互动短剧续写引擎，只返回 JSON。',
    userPrompt: buildContinueChunkPrompt({
      narrativeMode: session.narrative_mode || 'web_novel',
      storyState: session.story_state,
      storyCards: compactStoryCards(session.cards || []),
      continuityContext,
      recentNodes: getRecentNodes(session, 5, currentNodeId),
      choiceContent,
      mode: 'continue',
      intervention: '',
      nextChunkIndex,
      maxChunks: session.max_chunks
    })
  });

  return parseAndValidateAiJson(chunkText, (result) => {
    normalizeStoryResult(result);
    reinforceChunkContinuity(result, continuityContext);
    repairChunkGraphForArchitecture(result, session.max_chunks);
    validateStoryResult(result);
    if (result.chunk.chunk_index !== nextChunkIndex) {
      throw new Error(`chunk_index 必须是 ${nextChunkIndex}`);
    }
    applyPaywallRules(result.chunk, session.max_chunks);
    validateChunkGraph(result.chunk, session.max_chunks);
    moderateChunk(result.chunk);
  });
}

function applyChunkResultToSession(session, chunkResult) {
  normalizeStoryResult(chunkResult);
  repairChunkGraphForArchitecture(chunkResult, session.max_chunks);
  validateStoryResult(chunkResult);
  applyPaywallRules(chunkResult.chunk, session.max_chunks);
  validateChunkGraph(chunkResult.chunk, session.max_chunks);
  moderateChunk(chunkResult.chunk);
  session.story_state = mergeStatePatch(session.story_state, chunkResult.state_patch);
  mergeChunk(session, chunkResult.chunk);
  session.generated_chunk_count = session.chunks.length;
}

function applyPaywallRules(chunk, maxChunks) {
  if (chunk.chunk_index === 2) {
    ensurePaywallForChunk2(chunk);
  } else if (chunk.chunk_index <= maxChunks) {
    stripPaywallsOutsideChunk2(chunk);
  }
}

function getFirstGenerateChoice(chunk) {
  return Object.values(chunk?.nodes || {})
    .flatMap((node) => node.choices || [])
    .find((choice) => choice.next_node === '__GENERATE_NEXT__');
}

async function generatePastDeductionOpening({ storyId, userPrompt, title, synopsis }) {
  const { buildPastDeductionNodePrompt } = await import('../prompts/pastDeductionNodePrompt.js');
  const session = await loadStorySession(storyId);

  try {
    session.generation_status = 'generating';
    session.pd_node_counter = 0;
    await saveStorySession(session);

    const nodeIndex = 1;
    let nodeResult;

    if (!hasApiKey()) {
      nodeResult = {
        state_patch: { current_phase: 'past_deduction_opening', facts_add: [], open_threads_add: [], open_threads_resolved: [], characters_update: [] },
        node: {
          node_id: `pd_node_${nodeIndex}`,
          text: `你回到了那个令你遗憾的瞬间。周围的一切都和记忆中一样。你的心跳加速，这一次，你有机会做出不同的选择。`,
          bg_theme: 'dark',
          ui_effect: [],
          choices: [
            { content: '深呼吸，试着冷静下来', next_node: '__GENERATE_NEXT__' },
            { content: '直接面对当时的困境', next_node: '__GENERATE_NEXT__' }
          ]
        }
      };
    } else {
      const rawText = await callLLM({
        systemPrompt: '你是写实互动推演引擎，只返回 JSON。',
        userPrompt: buildPastDeductionNodePrompt({
          storyState: session.story_state,
          storyCards: compactStoryCards(session.cards || []),
          continuityContext: {
            current_node_id: null,
            current_node_text: synopsis,
            current_node_choices: [],
            selected_choice: userPrompt,
            intervention: '',
            recent_player_path: [],
            bridge_requirement: '这是开场第一个节点，请基于简介和用户的遗憾描述，直接带入那个瞬间的场景。'
          },
          recentNodes: [],
          choiceContent: userPrompt,
          intervention: '',
          nodeIndex
        }),
        maxTokens: 1024,
        temperature: 0.9
      });

      const parsed = safeJsonParse(rawText);
      if (!parsed?.node) {
        throw new Error('过去推演开场节点生成失败');
      }
      nodeResult = parsed;
    }

    // 规范化
    const node = nodeResult.node;
    node.node_id = node.node_id || `pd_node_${nodeIndex}`;
    node.is_paywall = false;
    node.paywall_type = null;
    node.ad_config = null;
    node.is_rewrite_point = false;
    node.is_generating = false;
    if (Array.isArray(node.choices)) {
      node.choices.forEach(c => { c.next_node = '__GENERATE_NEXT__'; });
    }

    const chunk = {
      chunk_id: `pd_chunk_${nodeIndex}`,
      chunk_index: nodeIndex,
      type: 'middle',
      start_node: node.node_id,
      end_nodes: [node.node_id],
      nodes: { [node.node_id]: node }
    };

    if (nodeResult.state_patch) {
      session.story_state = mergeStatePatch(session.story_state, nodeResult.state_patch);
    }

    session.chunks = [chunk];
    session.node_index = { [node.node_id]: { chunk_id: chunk.chunk_id, chunk_index: nodeIndex } };
    session.pd_node_counter = nodeIndex;
    session.generation_status = 'ready';
    session.status = 'ready';
    session.generated_chunk_count = 1;
    session.cards = buildStoryCards({ userPrompt, title, storyState: session.story_state });
    await saveStorySession(session);

    console.log(`[generatePastDeductionOpening] story ${storyId} opening node: ${node.node_id}`);
  } catch (error) {
    console.error(`[generatePastDeductionOpening] error for ${storyId}:`, error.message);
    session.status = 'error';
    session.generation_status = 'error';
    session.error = error.message;
    await saveStorySession(session);
  }
}

