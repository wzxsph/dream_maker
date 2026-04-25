/**
 * 初始故事 Pipeline
 *
 * 流程：
 * 1. Layer 0: 生成标题 + 简介（返回给用户立即阅读）
 * 2. 后台: Layer 1 + Layer 2 生成第一幕完整 chunk
 */

import { buildStoryIntroPrompt } from '../prompts/storyIntroPrompt.js';
import { buildMockInitialState, buildMockInitialChunk } from '../mock/mockInitial.js';
import { callLLM, hasApiKey } from './aiService.js';
import { parseAndValidateAiJson } from './aiJsonService.js';
import { validateUserPrompt } from './moderationService.js';
import { generateStoryId } from '../utils/id.js';
import { createSession } from './storySessionService.js';
import { saveStorySession } from './storageService.js';
import { safeJsonParse } from '../utils/json.js';
import { startGenerationJob } from './generationJobService.js';
import { beginStoryPipeline } from './beginStoryPipeline.js';

function normalizeIntroResult(rawResult, userPrompt) {
  const title = rawResult?.title || '命运改写局';
  const synopsis = rawResult?.synopsis || '命运的齿轮开始转动，新的故事即将展开。';
  return { title, synopsis };
}

export async function initialStoryPipeline({ userPrompt }) {
  const prompt = validateUserPrompt(userPrompt);
  const storyId = generateStoryId();

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

    console.log(`[initialStoryPipeline] Layer 0 raw response length: ${rawText?.length}, preview: ${String(rawText).substring(0, 300)}`);

    const parsed = safeJsonParse(rawText);
    console.log(`[initialStoryPipeline] Layer 0 parsed: ${JSON.stringify(parsed)?.substring(0, 300)}`);
    introResult = normalizeIntroResult(parsed, prompt);
  }

  const session = createSession({
    storyId,
    title: introResult.title,
    synopsis: introResult.synopsis,
    status: 'intro'
  });

  await saveStorySession(session);

  // 后台执行 Layer 1 + Layer 2，生成第一幕
  startGenerationJob(() =>
    beginStoryPipeline({ storyId, userPrompt: prompt }, { skipIntro: true })
  );

  return {
    story_id: storyId,
    title: introResult.title,
    synopsis: introResult.synopsis,
    status: 'intro'
  };
}
