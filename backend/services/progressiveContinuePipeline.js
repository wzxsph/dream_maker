import { buildPreviewNodePrompt } from '../prompts/previewNodePrompt.js';
import { parseAndValidateAiJson } from './aiJsonService.js';
import { callLLM, hasApiKey } from './aiService.js';
import { continueStoryPipeline } from './continueStoryPipeline.js';
import { getAllNodes, buildContinuityContext } from './storySessionService.js';
import { compactStoryCards } from './storyCardService.js';
import { loadStorySession } from './storageService.js';
import { validateIntervention } from './moderationService.js';
import { startGenerationJob } from './generationJobService.js';
import { httpError } from '../utils/errors.js';
import { getChunkStartNodeId } from '../config/storyArchitecture.js';

export async function progressiveContinuePipeline({
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

  const existingNextChunk = session.chunks.find((chunk) => chunk.chunk_index === nextChunkIndex);
  if (existingNextChunk && normalizedMode === 'continue') {
    return {
      story_id: storyId,
      status: 'ready',
      chunk: existingNextChunk,
      story_state: session.story_state,
      prebuilt: true
    };
  }

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
    const parsed = await parseAndValidateAiJson(rawText, (p) => {
      if (!p?.node) throw new Error("无效的 node");
    });
    const node = parsed.node;

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
  const nodeId = getChunkStartNodeId(nextChunkIndex);
  const selectedChoice = continuityContext.selected_choice || '';
  const text = /等待|继续|下一幕|后续/.test(selectedChoice)
    ? '你顺着刚才露出的破绽看过去，现场有人先避开了目光。那个细小反应，比任何解释都更像答案。'
    : '你的动作打破了僵局，对方下意识护住身边的东西。真正的问题不在争吵里，而在他不肯让你碰到的细节里。';

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

function getNodeChunkIndex(session, nodeId) {
  const indexed = session.node_index?.[nodeId]?.chunk_index;
  if (indexed) {
    return indexed;
  }

  return session.chunks?.find((chunk) => chunk.nodes?.[nodeId])?.chunk_index || 0;
}
