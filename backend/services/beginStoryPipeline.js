/**
 * 开始故事 Pipeline
 *
 * 用户点击"开始造梦"后，或后台预生成时调用
 *
 * 流程：
 * 1. Layer 1: 生成 4 个纯文本 fragments
 * 2. Layer 2: 一次转换所有 fragments 为 chunk JSON
 * 3. 校验、规范化、合并状态、存档
 */

import { buildStoryContentPrompt } from '../prompts/storyContentPrompt.js';
import { buildMockInitialChunk } from '../mock/mockInitial.js';
import { callLLM, hasApiKey } from './aiService.js';
import { loadStorySession, saveStorySession } from './storageService.js';
import { mergeStatePatch } from './storyStateService.js';
import { mergeChunk } from './storySessionService.js';
import { buildStoryCards } from './storyCardService.js';
import {
  normalizeStoryResult,
  reinforceChunkContinuity,
  repairChunkGraphForArchitecture
} from './storyNormalizer.js';
import { validateChunkGraph } from './graphValidator.js';
import { moderateChunk } from './moderationService.js';
import { ensurePaywallForChunk2, stripPaywallsOutsideChunk2 } from './paywallService.js';
import { fragmentsToChunkJson } from './contentToJsonService.js';
import { safeJsonParse } from '../utils/json.js';
import { httpError } from '../utils/errors.js';

function normalizeStoryState(rawState, userPrompt) {
  const payload = rawState?.story_state || rawState || {};
  const title = rawState?.title || payload.title;
  return {
    title: title || '命运改写局',
    storyState: {
      genre: payload.genre || 'interactive_reversal',
      tone: payload.tone || '高冲突、强反转、短平快',
      current_phase: payload.current_phase || 'opening',
      protagonist: payload.protagonist || {
        name: '你',
        identity: '被命运选中的主角',
        goal: '改写原本的结局'
      },
      characters: payload.characters || [],
      facts: payload.facts || [`用户脑洞：${userPrompt}`],
      open_threads: payload.open_threads || [],
      constraints: payload.constraints || ['不要推翻已发生事实'],
      architecture: payload.architecture || {}
    }
  };
}

export async function beginStoryPipeline({ storyId, userPrompt }, options = {}) {
  const session = await loadStorySession(storyId);

  // 防止重复执行
  if (session.status === 'generating' || session.status === 'ready' || session.status === 'countdown' || session.status === 'active') {
    console.log(`[beginStoryPipeline] story ${storyId} already in status: ${session.status}`);
    return { story_id: storyId, status: session.status };
  }

  session.status = 'generating';
  await saveStorySession(session);

  let chunkResult;

  if (!hasApiKey()) {
    chunkResult = buildMockInitialChunk();
  } else {
    try {
      // ========== Layer 1: 生成纯文本 fragments ==========
      const contentText = await callLLM({
        systemPrompt: '你是一个互动短剧策划器，只返回严格 JSON。',
        userPrompt: buildStoryContentPrompt({
          userPrompt,
          title: session.title,
          synopsis: session.synopsis
        }),
        maxTokens: 2048,
        temperature: 1.0
      });

      console.log(`[beginStoryPipeline] Layer 1 raw response length: ${contentText?.length}, preview: ${String(contentText).substring(0, 200)}`);

      const contentParsed = safeJsonParse(contentText);
      console.log(`[beginStoryPipeline] Layer 1 parsed: ${JSON.stringify(contentParsed)?.substring(0, 300)}`);

      if (!contentParsed?.content?.fragments) {
        throw new Error('Layer 1 未返回有效 fragments');
      }

      const fragments = contentParsed.content.fragments;

      // ========== Layer 2: 一次转换所有 fragments 为 chunk JSON ==========
      const chunkJson = await fragmentsToChunkJson(fragments, 1, 3);

      chunkResult = {
        story_state: contentParsed.story_state || {},
        state_patch: contentParsed.state_patch || {
          current_phase: 'opening_conflict',
          facts_add: [],
          open_threads_add: [],
          open_threads_resolved: [],
          characters_update: []
        },
        chunk: chunkJson
      };

    } catch (error) {
      console.error(`[beginStoryPipeline] Layer 1/2 error for story ${storyId}:`, error.message);
      session.status = 'error';
      session.error = error.message;
      await saveStorySession(session);
      throw error;
    }
  }

  // 规范化
  normalizeStoryResult(chunkResult);

  // chunk_index 必须是 1
  if (chunkResult.chunk.chunk_index !== 1) {
    chunkResult.chunk.chunk_index = 1;
    chunkResult.chunk.chunk_id = 'chunk_1';
  }
  repairChunkGraphForArchitecture(chunkResult, session.max_chunks);

  // 校验图结构与内容安全
  validateChunkGraph(chunkResult.chunk, session.max_chunks);
  moderateChunk(chunkResult.chunk);

  // 更新 story_state
  if (chunkResult.story_state) {
    const normalized = normalizeStoryState(chunkResult, userPrompt);
    session.story_state = {
      ...session.story_state,
      ...normalized.storyState,
      protagonist: {
        ...(session.story_state?.protagonist || {}),
        ...(normalized.storyState.protagonist || {})
      },
      architecture: {
        ...(session.story_state?.architecture || {}),
        ...(normalized.storyState.architecture || {})
      }
    };
  }
  session.story_state = mergeStatePatch(session.story_state, chunkResult.state_patch);

  // 合并 chunk
  mergeChunk(session, chunkResult.chunk);

  // 构建卡片
  session.cards = buildStoryCards({
    userPrompt,
    title: session.title,
    storyState: session.story_state
  });

  // 更新状态
  session.status = 'ready';
  await saveStorySession(session);

  return {
    story_id: storyId,
    status: 'ready',
    chunk: chunkResult.chunk
  };
}
