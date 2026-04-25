import { buildPreviewNodePrompt } from '../prompts/previewNodePrompt.js';
import { safeJsonParse } from '../utils/json.js';
import { callLLM, hasApiKey } from './aiService.js';
import { continueStoryPipeline } from './continueStoryPipeline.js';
import { getAllNodes, buildContinuityContext } from './storySessionService.js';
import { compactStoryCards } from './storyCardService.js';
import { loadStorySession } from './storageService.js';
import { validateIntervention } from './moderationService.js';
import { startGenerationJob } from './generationJobService.js';
import { httpError } from '../utils/errors.js';

export async function progressiveContinuePipeline({
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
  const normalizedMode = mode === 'rewrite' ? 'rewrite' : 'continue';
  const normalizedIntervention =
    normalizedMode === 'rewrite' ? validateIntervention(intervention) : '';
  const continuityContext = buildContinuityContext(session, {
    currentNodeId,
    choiceContent,
    intervention: normalizedIntervention
  });

  const previewNode = await generatePreviewNode({
    session,
    continuityContext,
    nextChunkIndex
  });

  const job = startGenerationJob(() =>
    continueStoryPipeline({
      storyId,
      currentNodeId,
      choiceContent,
      mode: normalizedMode,
      intervention: normalizedIntervention
    })
  );

  return {
    story_id: storyId,
    status: 'generating',
    job_id: job.job_id,
    preview_node: previewNode
  };
}

async function generatePreviewNode({ session, continuityContext, nextChunkIndex }) {
  const fallback = buildFallbackPreviewNode({ continuityContext, nextChunkIndex });

  if (!hasApiKey()) {
    return fallback;
  }

  try {
    const rawText = await callLLM({
      systemPrompt: '你只生成一个互动短剧预览节点，必须返回 JSON。',
      userPrompt: buildPreviewNodePrompt({
        storyState: session.story_state,
        storyCards: compactStoryCards(session.cards || []),
        continuityContext,
        nextChunkIndex
      }),
      maxTokens: 360,
      temperature: 0.7
    });
    const parsed = safeJsonParse(rawText);
    const node = parsed?.node || {};

    return {
      node_id: node.node_id || fallback.node_id,
      text: String(node.text || fallback.text).trim(),
      bg_theme: normalizeTheme(node.bg_theme || fallback.bg_theme),
      ui_effect: Array.isArray(node.ui_effect) ? node.ui_effect : [],
      is_paywall: false,
      paywall_type: null,
      ad_config: null,
      is_rewrite_point: false,
      is_generating: true,
      choices: []
    };
  } catch (error) {
    console.warn(`预览节点生成失败，使用本地兜底：${error.message}`);
    return fallback;
  }
}

function buildFallbackPreviewNode({ continuityContext, nextChunkIndex }) {
  const nodeId = nextChunkIndex === 2 ? 'node_5' : 'node_8';
  const selectedChoice = continuityContext.selected_choice || '';
  const text = /等待|继续|下一幕|后续/.test(selectedChoice)
    ? '短暂的沉默后，眼前的局势先一步发生变化。新的危机正在靠近，而你已经没有退路。'
    : '你的动作打破了僵局，所有人的目光瞬间聚焦过来。下一幕的反击，正在这一秒展开。';

  return {
    node_id: nodeId,
    text,
    bg_theme: 'dark',
    ui_effect: ['glitch'],
    is_paywall: false,
    paywall_type: null,
    ad_config: null,
    is_rewrite_point: false,
    is_generating: true,
    choices: []
  };
}

function normalizeTheme(theme) {
  return ['light', 'dark', 'danger', 'victory'].includes(theme) ? theme : 'dark';
}
