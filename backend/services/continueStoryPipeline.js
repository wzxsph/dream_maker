import { buildContinueChunkPrompt } from '../prompts/continueChunkPrompt.js';
import { buildMockContinueChunk } from '../mock/mockContinue.js';
import { callLLM, hasApiKey } from './aiService.js';
import { parseAndValidateAiJson } from './aiJsonService.js';
import { loadStorySession, saveStorySession } from './storageService.js';
import {
  getAllNodes,
  buildContinuityContext,
  getRecentNodes,
  mergeChunk,
  recordIntervention,
  recordPlayerChoice
} from './storySessionService.js';
import { mergeStatePatch } from './storyStateService.js';
import { validateStoryResult } from './storyValidator.js';
import { validateChunkGraph } from './graphValidator.js';
import { ensurePaywallForChunk2, stripPaywallsOutsideChunk2 } from './paywallService.js';
import { moderateChunk, validateIntervention } from './moderationService.js';
import { httpError } from '../utils/errors.js';
import { normalizeStoryResult, reinforceChunkContinuity } from './storyNormalizer.js';
import { compactStoryCards, syncStoryCards } from './storyCardService.js';

export async function continueStoryPipeline({
  storyId,
  currentNodeId,
  choiceContent,
  mode = 'continue',
  intervention = ''
}) {
  const session = await loadStorySession(storyId);

  if (session.current_chunk_index >= session.max_chunks) {
    throw httpError(400, '故事已经结束');
  }

  const allNodes = getAllNodes(session);
  if (!allNodes[currentNodeId]) {
    throw httpError(400, 'current_node_id 不存在');
  }

  const nextChunkIndex = session.current_chunk_index + 1;
  const currentNode = allNodes[currentNodeId];

  if (currentNode?.is_paywall) {
    const existingNextChunk = session.chunks.find((chunk) => chunk.chunk_index === nextChunkIndex);
    if (existingNextChunk) {
      return {
        story_id: session.story_id,
        chunk: existingNextChunk,
        story_state: session.story_state
      };
    }
  }

  // 特殊处理：node_2 + batch1 已显示 → 返回预先生成的 batch2 节点
  if (currentNodeId === 'node_2' && session.batch_position === 1 && session.batch_2_nodes) {
    // 合并 batch_2_nodes 到现有 chunk
    const batch2Nodes = session.batch_2_nodes;
    const currentChunk = session.chunks.find((c) => c.chunk_index === 1);
    if (currentChunk) {
      Object.assign(currentChunk.nodes, batch2Nodes);
      // 更新 end_nodes 为 batch2 的最后节点
      currentChunk.end_nodes = ['node_4'];
    }
    session.batch_position = 2;
    session.batch_2_nodes = null;

    recordPlayerChoice(session, { currentNodeId, choiceContent });

    await saveStorySession(session);
    return {
      story_id: session.story_id,
      chunk: currentChunk,
      story_state: session.story_state,
      is_batch2: true
    };
  }

  const normalizedMode = mode === 'rewrite' ? 'rewrite' : 'continue';
  const normalizedIntervention =
    normalizedMode === 'rewrite' ? validateIntervention(intervention) : '';
  const continuityContext = buildContinuityContext(session, {
    currentNodeId,
    choiceContent,
    intervention: normalizedIntervention
  });

  recordPlayerChoice(session, {
    currentNodeId,
    choiceContent
  });

  if (normalizedMode === 'rewrite') {
    recordIntervention(session, {
      currentNodeId,
      intervention: normalizedIntervention
    });
  }

  let chunkResult;

  if (!hasApiKey()) {
    chunkResult = buildMockContinueChunk({
      nextChunkIndex,
      intervention: normalizedIntervention,
      choiceContent
    });
  } else {
    const chunkText = await callLLM({
      systemPrompt: '你是互动短剧续写引擎，只返回 JSON。',
      userPrompt: buildContinueChunkPrompt({
        storyState: session.story_state,
        storyCards: compactStoryCards(session.cards || []),
        continuityContext,
        recentNodes: getRecentNodes(session, 5, currentNodeId),
        choiceContent,
        mode: normalizedMode,
        intervention: normalizedIntervention,
        nextChunkIndex,
        maxChunks: session.max_chunks
      })
    });

    chunkResult = await parseAndValidateAiJson(chunkText, (result) => {
      normalizeStoryResult(result);
      reinforceChunkContinuity(result, continuityContext);
      validateStoryResult(result);
      if (result.chunk.chunk_index !== nextChunkIndex) {
        throw new Error(`chunk_index 必须是 ${nextChunkIndex}`);
      }
      if (result.chunk.chunk_index === 2) {
        ensurePaywallForChunk2(result.chunk);
      } else {
        stripPaywallsOutsideChunk2(result.chunk);
      }
      validateChunkGraph(result.chunk, session.max_chunks);
      moderateChunk(result.chunk);
    });
  }

  normalizeStoryResult(chunkResult);
  reinforceChunkContinuity(chunkResult, continuityContext);
  validateStoryResult(chunkResult);

  if (chunkResult.chunk.chunk_index !== nextChunkIndex) {
    throw new Error(`chunk_index 必须是 ${nextChunkIndex}`);
  }

  if (chunkResult.chunk.chunk_index === 2) {
    ensurePaywallForChunk2(chunkResult.chunk);
  } else {
    stripPaywallsOutsideChunk2(chunkResult.chunk);
  }

  validateChunkGraph(chunkResult.chunk, session.max_chunks);
  moderateChunk(chunkResult.chunk);

  session.story_state = mergeStatePatch(session.story_state, chunkResult.state_patch);
  mergeChunk(session, chunkResult.chunk);
  syncStoryCards(session);
  await saveStorySession(session);

  return {
    story_id: session.story_id,
    chunk: chunkResult.chunk,
    story_state: session.story_state
  };
}
