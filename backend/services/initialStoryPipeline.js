/**
 * 初始故事 Pipeline
 *
 * 流程：
 * 1. Layer 0: 生成标题 + 简介（返回给用户立即阅读）
 * 2. Layer 1: 生成 4 个纯文本 fragments
 * 3. Layer 2: 转换为第一幕固定伪开放节点图
 */

import { buildStoryIntroPrompt } from '../prompts/storyIntroPrompt.js';
import { buildMockInitialChunk, buildMockInitialState } from '../mock/mockInitial.js';
import { callLLM, hasApiKey } from './aiService.js';
import { moderateChunk, validateUserPrompt } from './moderationService.js';
import { generateStoryId } from '../utils/id.js';
import { createSession, mergeChunk } from './storySessionService.js';
import { loadStorySession, saveStorySession } from './storageService.js';
import { buildStoryCards } from './storyCardService.js';
import { safeJsonParse } from '../utils/json.js';
import { startGenerationJob } from './generationJobService.js';
import { fragmentsToChunkJson } from './contentToJsonService.js';
import { mergeStatePatch } from './storyStateService.js';
import { normalizeStoryResult } from './storyNormalizer.js';
import { validateStoryResult } from './storyValidator.js';
import { validateChunkGraph } from './graphValidator.js';

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

export async function initialStoryPipeline({ userPrompt }) {
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
      userPrompt: buildStoryIntroPrompt(prompt),
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
    status: 'intro'
  });
  await saveStorySession(session);

  // ========== Layer 1 + Layer 2: 生成第一幕固定节点图 ==========
  if (hasApiKey()) {
    startGenerationJob(() => generateOpeningChunk({ storyId, userPrompt: prompt }));
  } else {
    // mock 模式：直接生成
    const mockState = buildMockInitialState(prompt);
    const mockResult = buildMockInitialChunk();
    normalizeStoryResult(mockResult);
    validateStoryResult(mockResult);
    validateChunkGraph(mockResult.chunk, session.max_chunks);
    moderateChunk(mockResult.chunk);
    session.chunks = [];
    session.node_index = {};
    session.story_state = mergeStatePatch(mockState, mockResult.state_patch);
    mergeChunk(session, mockResult.chunk);
    session.cards = buildStoryCards({ userPrompt: prompt, title: introResult.title, storyState: session.story_state });
    session.status = 'ready';
    await saveStorySession(session);
  }

  return {
    story_id: storyId,
    title: introResult.title,
    synopsis: introResult.synopsis,
    status: session.status
  };
}

async function generateOpeningChunk({ storyId, userPrompt }) {
  const session = await loadStorySession(storyId);

  try {
    // Layer 1: 生成 4 个纯文本 fragments
    const { buildStoryContentPrompt } = await import('../prompts/storyContentPrompt.js');
    const contentText = await callLLM({
      systemPrompt: '你是一个互动短剧策划器，只返回严格 JSON。',
      userPrompt: buildStoryContentPrompt(userPrompt),
      maxTokens: 2048,
      temperature: 1.0
    });

    console.log(`[generateOpeningChunk] Layer 1 raw length: ${contentText?.length}`);

    const contentParsed = safeJsonParse(contentText);
    if (!contentParsed?.content?.fragments) {
      throw new Error('Layer 1 未返回有效 fragments');
    }

    const fragments = contentParsed.content.fragments;

    // Layer 2: 转换为 chunk JSON（4 节点）
    const chunkJson = await fragmentsToChunkJson(fragments, 1, 3);

    const chunkResult = {
      state_patch: contentParsed.state_patch || {},
      chunk: chunkJson
    };

    normalizeStoryResult(chunkResult);
    validateStoryResult(chunkResult);
    validateChunkGraph(chunkResult.chunk, session.max_chunks);
    moderateChunk(chunkResult.chunk);

    // 合并到 session
    session.story_state = mergeInitialStoryState(session.story_state, contentParsed.story_state);
    session.story_state = mergeStatePatch(session.story_state, chunkResult.state_patch);
    mergeChunk(session, chunkResult.chunk);
    session.cards = buildStoryCards({ userPrompt, title: session.title, storyState: session.story_state });
    session.status = 'ready';
    await saveStorySession(session);

    console.log(`[generateOpeningChunk] opening chunk done for story ${storyId}, nodes: ${Object.keys(chunkResult.chunk.nodes).join(', ')}`);

  } catch (error) {
    console.error(`[generateOpeningChunk] error for story ${storyId}:`, error.message);
    session.status = 'error';
    session.error = error.message;
    await saveStorySession(session);
  }
}
