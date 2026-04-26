/**
 * 过去推演单节点续写 Pipeline
 *
 * 每次只生成1个节点，不预生成整幕。
 * 用户随时可以退出，没有固定的幕数上限。
 */

import { buildPastDeductionNodePrompt } from '../prompts/pastDeductionNodePrompt.js';
import { callLLM, hasApiKey } from './aiService.js';
import { safeJsonParse } from '../utils/json.js';
import { loadStorySession, saveStorySession } from './storageService.js';
import {
    getAllNodes,
    buildContinuityContext,
    getRecentNodes,
    recordPlayerChoice,
    recordIntervention
} from './storySessionService.js';
import { mergeStatePatch } from './storyStateService.js';
import { compactStoryCards, syncStoryCards } from './storyCardService.js';
import { moderateChunk } from './moderationService.js';
import { httpError } from '../utils/errors.js';

export async function pastDeductionContinuePipeline({
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

    const normalizedIntervention = mode === 'rewrite' ? (intervention || '') : '';

    const continuityContext = buildContinuityContext(session, {
        currentNodeId,
        choiceContent,
        intervention: normalizedIntervention
    });

    recordPlayerChoice(session, { currentNodeId, choiceContent });

    if (mode === 'rewrite') {
        recordIntervention(session, {
            currentNodeId,
            intervention: normalizedIntervention
        });
    }

    // 计算下一个节点序号
    const nodeIndex = (session.pd_node_counter || 0) + 1;

    let nodeResult;

    if (!hasApiKey()) {
        // mock 模式
        nodeResult = buildMockPastDeductionNode(nodeIndex, choiceContent);
    } else {
        const rawText = await callLLM({
            systemPrompt: '你是写实互动推演引擎，只返回 JSON。',
            userPrompt: buildPastDeductionNodePrompt({
                storyState: session.story_state,
                storyCards: compactStoryCards(session.cards || []),
                continuityContext,
                recentNodes: getRecentNodes(session, 5, currentNodeId),
                choiceContent,
                intervention: normalizedIntervention,
                nodeIndex
            }),
            maxTokens: 1024,
            temperature: 0.9
        });

        const parsed = safeJsonParse(rawText);
        if (!parsed?.node) {
            throw new Error('过去推演节点生成失败：AI 未返回有效 node');
        }
        nodeResult = parsed;
    }

    // 规范化节点
    const node = nodeResult.node;
    const nodeId = node.node_id || `pd_node_${nodeIndex}`;
    node.node_id = nodeId;
    node.is_paywall = false;
    node.paywall_type = null;
    node.ad_config = null;
    node.is_rewrite_point = false;
    node.is_generating = false;

    // 确保 choices 指向 __GENERATE_NEXT__
    if (Array.isArray(node.choices)) {
        node.choices.forEach(c => {
            c.next_node = '__GENERATE_NEXT__';
        });
    }

    // 构建一个单节点 chunk 来兼容现有数据结构
    const chunkIndex = nodeIndex;
    const chunk = {
        chunk_id: `pd_chunk_${chunkIndex}`,
        chunk_index: chunkIndex,
        type: 'middle',
        start_node: nodeId,
        end_nodes: [nodeId],
        nodes: { [nodeId]: node }
    };

    // 审核
    try {
        moderateChunk(chunk);
    } catch (e) {
        console.warn('[pastDeduction] moderation warning:', e.message);
    }

    // 合并 state patch
    if (nodeResult.state_patch) {
        session.story_state = mergeStatePatch(session.story_state, nodeResult.state_patch);
    }

    // 合并 chunk 到 session
    const existingIdx = session.chunks.findIndex(c => c.chunk_id === chunk.chunk_id);
    if (existingIdx >= 0) {
        session.chunks[existingIdx] = chunk;
    } else {
        session.chunks.push(chunk);
    }

    // 更新 node_index
    session.node_index[nodeId] = { chunk_id: chunk.chunk_id, chunk_index: chunkIndex };

    // 更新计数器
    session.pd_node_counter = nodeIndex;

    syncStoryCards(session);
    await saveStorySession(session);

    return {
        story_id: session.story_id,
        chunk,
        story_state: session.story_state
    };
}

function buildMockPastDeductionNode(nodeIndex, choiceContent) {
    const nodeId = `pd_node_${nodeIndex}`;
    return {
        state_patch: {
            current_phase: 'deduction_in_progress',
            facts_add: [],
            open_threads_add: [],
            open_threads_resolved: [],
            characters_update: []
        },
        node: {
            node_id: nodeId,
            text: `你做出了选择：「${choiceContent || '继续观察'}」。对方明显愣了一下，似乎没想到你会这样反应。空气中弥漫着一种微妙的紧张感，你注意到对方下意识地握紧了手里的东西。`,
            bg_theme: 'dark',
            ui_effect: [],
            choices: [
                { content: '主动开口打破沉默', next_node: '__GENERATE_NEXT__' },
                { content: '保持沉默，等待对方先说话', next_node: '__GENERATE_NEXT__' }
            ]
        }
    };
}
