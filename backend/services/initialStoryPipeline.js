/**
 * 初始故事 Pipeline
 *
 * 流程：
 * 1. Layer 0: 生成标题 + 简介（返回给用户立即阅读）
 * 2. Layer 1: 生成 3 个纯文本 fragments
 * 3. Layer 2: 转换为 3 节点 chunk
 * 4. 后台并行启动 Batch 2 生成
 */

import { buildStoryIntroPrompt } from '../prompts/storyIntroPrompt.js';
import { buildMockInitialState } from '../mock/mockInitial.js';
import { callLLM, hasApiKey } from './aiService.js';
import { validateUserPrompt } from './moderationService.js';
import { generateStoryId } from '../utils/id.js';
import { createSession, mergeChunk } from './storySessionService.js';
import { saveStorySession } from './storageService.js';
import { buildStoryCards } from './storyCardService.js';
import { safeJsonParse } from '../utils/json.js';
import { startGenerationJob } from './generationJobService.js';
import { batch2Pipeline } from './batch2Pipeline.js';
import { fragmentsToChunkJson } from './contentToJsonService.js';
import { httpError } from '../utils/errors.js';

function normalizeIntroResult(rawResult, userPrompt) {
  const title = rawResult?.title || '命运改写局';
  const synopsis = rawResult?.synopsis || '命运的齿轮开始转动，新的故事即将展开。';
  return { title, synopsis };
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

  // ========== Layer 1 + Layer 2: 生成第一批 3 节点 ==========
  if (hasApiKey()) {
    startGenerationJob(() => generateBatch1({ storyId, userPrompt: prompt }));
  } else {
    // mock 模式：直接生成
    const mockChunk = buildMockBatch1Chunk();
    session.chunks = [];
    session.nodesMap = {};
    mergeChunk(session, mockChunk);
    session.batch_2_status = 'done';
    session.batch_2_nodes = buildMockBatch2Nodes();
    session.cards = buildStoryCards({ userPrompt: prompt, title: introResult.title, storyState: session.story_state });
    session.status = 'batch1_ready';
    await saveStorySession(session);
  }

  return {
    story_id: storyId,
    title: introResult.title,
    synopsis: introResult.synopsis,
    status: session.status
  };
}

async function generateBatch1({ storyId, userPrompt }) {
  const { loadStorySession, saveStorySession } = await import('./storageService.js');
  const { mergeChunk } = await import('./storySessionService.js');
  const { buildStoryCards } = await import('./storyCardService.js');

  const session = await loadStorySession(storyId);

  try {
    // Layer 1: 生成 3 个纯文本 fragments
    const { buildStoryContentPrompt } = await import('../prompts/storyContentPrompt.js');
    const contentText = await callLLM({
      systemPrompt: '你是一个互动短剧策划器，只返回严格 JSON。',
      userPrompt: buildStoryContentPrompt(userPrompt),
      maxTokens: 2048,
      temperature: 1.0
    });

    console.log(`[generateBatch1] Layer 1 raw length: ${contentText?.length}`);

    const contentParsed = safeJsonParse(contentText);
    if (!contentParsed?.content?.fragments) {
      throw new Error('Layer 1 未返回有效 fragments');
    }

    const fragments = contentParsed.content.fragments;

    // Layer 2: 转换为 chunk JSON（3 节点）
    const chunkJson = await fragmentsToChunkJson(fragments, 1, 3);

    const chunkResult = {
      state_patch: contentParsed.state_patch || {},
      chunk: chunkJson
    };

    // 合并到 session
    mergeChunk(session, chunkResult.chunk);
    session.story_state = { ...session.story_state, ...chunkResult.state_patch };
    session.cards = buildStoryCards({ userPrompt, title: session.title, storyState: session.story_state });
    session.status = 'batch1_ready';
    await saveStorySession(session);

    console.log(`[generateBatch1] batch1 done for story ${storyId}, nodes: ${Object.keys(chunkResult.chunk.nodes).join(', ')}`);

    // 启动 Batch 2 后台生成
    await batch2Pipeline({ storyId, userPrompt });

  } catch (error) {
    console.error(`[generateBatch1] error for story ${storyId}:`, error.message);
    session.status = 'error';
    session.error = error.message;
    await saveStorySession(session);
  }
}

function buildMockBatch1Chunk() {
  return {
    chunk_id: 'chunk_1',
    chunk_index: 1,
    type: 'opening',
    start_node: 'node_0',
    end_nodes: ['node_2'],
    nodes: {
      node_0: {
        node_id: 'node_0',
        text: '一阵刺目的白光划过，你猛地睁开眼。楼梯边缘近在脚下，林婉儿的手正伸向你，脸上却已经摆出受害者的表情。上一世，你就是从这里跌下去，失去了一切。',
        bg_theme: 'light',
        ui_effect: ['flash_white'],
        is_paywall: false,
        paywall_type: null,
        ad_config: null,
        is_rewrite_point: false,
        choices: [
          { content: '侧身避开，顺势抓住她的手腕', next_node: 'node_1_a' },
          { content: '不躲了，反手给她一个响亮耳光', next_node: 'node_1_b' }
        ]
      },
      node_1_a: {
        node_id: 'node_1_a',
        text: '你侧身一闪，林婉儿扑空，手腕被你稳稳扣住。她眼底的慌乱只出现了一瞬，下一秒就红着眼喊："姐姐，你为什么要推我？"客厅里的脚步声立刻逼近。',
        bg_theme: 'dark',
        ui_effect: ['shake'],
        is_paywall: false,
        paywall_type: null,
        ad_config: null,
        is_rewrite_point: false,
        choices: [{ content: '当众揭穿她的谎言', next_node: 'node_2' }]
      },
      node_1_b: {
        node_id: 'node_1_b',
        text: '"啪！"清脆的声音砸进大厅。林婉儿捂着脸愣住，连眼泪都忘了掉。顾沉正好推门进来，看到这一幕，怒气瞬间压向你："许晚，你疯了吗？"',
        bg_theme: 'danger',
        ui_effect: ['flash_red', 'shake'],
        is_paywall: false,
        paywall_type: null,
        ad_config: null,
        is_rewrite_point: false,
        choices: [{ content: '冷笑反问：你只看见这一巴掌？', next_node: 'node_2' }]
      },
      node_2: {
        node_id: 'node_2',
        text: '你抬头看向墙角的摄像头，心跳反而冷静下来。上一世被剪掉的监控，这一次还在闪着红点。林婉儿的脸色终于变了，顾沉也迟疑地回头。就在真相快被撕开时，你脑海里忽然响起冰冷的提示音：【检测到关键抉择点。】',
        bg_theme: 'danger',
        ui_effect: ['flash_red', 'glitch'],
        is_paywall: false,
        paywall_type: null,
        ad_config: null,
        is_rewrite_point: true,
        choices: [{ content: '进入下一段剧情', next_node: '__GENERATE_NEXT__' }]
      }
    }
  };
}

function buildMockBatch2Nodes() {
  return {
    node_3_a: {
      node_id: 'node_3_a',
      text: '你的话音落下，空气像被骤然绷紧。监控画面被投到墙上，林婉儿伸手推你的动作清清楚楚。她脸上的泪光僵住，像一张被撕开的假面。',
      bg_theme: 'danger',
      ui_effect: ['glitch'],
      is_paywall: false,
      paywall_type: null,
      ad_config: null,
      is_rewrite_point: false,
      choices: [{ content: '把监控声音也放出来', next_node: 'node_4' }]
    },
    node_3_b: {
      node_id: 'node_3_b',
      text: '你没有急着解释，而是顺着眼前的破绽继续逼近。林婉儿被你看得后退半步，却还想哭。你轻声提醒她："这次，所有摄像头都开着。"',
      bg_theme: 'dark',
      ui_effect: ['glitch'],
      is_paywall: false,
      paywall_type: null,
      ad_config: null,
      is_rewrite_point: false,
      choices: [{ content: '盯着林婉儿，让她自己解释', next_node: 'node_4' }]
    },
    node_4: {
      node_id: 'node_4',
      text: '就在真相即将彻底公开时，世界忽然卡顿。刺耳警报在你脑海里炸开：【剧情权限被世界意志暂时锁定。】林婉儿的表情停在惊恐的一瞬，而你知道，下一步就是彻底反击。',
      bg_theme: 'danger',
      ui_effect: ['flash_red', 'glitch', 'shake'],
      is_paywall: false,
      paywall_type: null,
      ad_config: null,
      is_rewrite_point: true,
      choices: [{ content: '进入下一幕', next_node: '__GENERATE_NEXT__' }]
    }
  };
}
