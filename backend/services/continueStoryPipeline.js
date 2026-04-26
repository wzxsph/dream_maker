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
import {
  normalizeStoryResult,
  reinforceChunkContinuity,
  repairChunkGraphForArchitecture
} from './storyNormalizer.js';
import { compactStoryCards, syncStoryCards } from './storyCardService.js';

export async function continueStoryPipeline({
  storyId,
  currentNodeId,
  choiceContent,
  mode = 'continue',
  intervention = ''
}) {
  const session = await loadStorySession(storyId);

  const allNodes = getAllNodes(session);
  if (!allNodes[currentNodeId]) {
    throw httpError(400, 'current_node_id 不存在');
  }

  const currentChunkIndex = getNodeChunkIndex(session, currentNodeId);
  if (currentChunkIndex >= session.max_chunks) {
    throw httpError(400, '故事已经结束');
  }

  const nextChunkIndex = currentChunkIndex + 1;
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

  const existingNextChunk = session.chunks.find((chunk) => chunk.chunk_index === nextChunkIndex);
  if (existingNextChunk && normalizedMode === 'continue') {
    await saveStorySession(session);
    return {
      story_id: session.story_id,
      chunk: existingNextChunk,
      story_state: session.story_state,
      prebuilt: true
    };
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
      repairChunkGraphForArchitecture(result, session.max_chunks);
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
  repairChunkGraphForArchitecture(chunkResult, session.max_chunks);
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

function getNodeChunkIndex(session, nodeId) {
  const indexed = session.node_index?.[nodeId]?.chunk_index;
  if (indexed) {
    return indexed;
  }

  return session.chunks?.find((chunk) => chunk.nodes?.[nodeId])?.chunk_index || 0;
}
