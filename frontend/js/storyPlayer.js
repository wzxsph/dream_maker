import { showContinuePanel } from './ui.js';

const GENERATE_NEXT = '__GENERATE_NEXT__';

export const state = {
  storyId: null,
  title: '',
  nodesMap: {},
  currentNodeId: null,
  pendingChoice: null,
  currentNode: null
};

export function initStory(sessionOrCreateResponse) {
  state.storyId = sessionOrCreateResponse.story_id;
  state.title = sessionOrCreateResponse.title || '';
  state.nodesMap = {};
  state.currentNodeId = null;
  state.pendingChoice = null;
  state.currentNode = null;

  if (Array.isArray(sessionOrCreateResponse.chunks)) {
    for (const chunk of sessionOrCreateResponse.chunks) {
      mergeChunk(chunk);
    }
    state.currentNodeId = sessionOrCreateResponse.chunks[0]?.start_node || null;
  } else if (sessionOrCreateResponse.chunk) {
    mergeChunk(sessionOrCreateResponse.chunk);
    state.currentNodeId = sessionOrCreateResponse.start_node || sessionOrCreateResponse.chunk.start_node;
  }

  state.currentNode = state.nodesMap[state.currentNodeId] || null;
  return state;
}

export function mergeChunk(chunk) {
  Object.assign(state.nodesMap, chunk.nodes || {});

  if (!state.currentNodeId) {
    state.currentNodeId = chunk.start_node;
    state.currentNode = state.nodesMap[state.currentNodeId] || null;
  }
}

export function mergePreviewNode(node) {
  state.nodesMap[node.node_id] = node;
  return node;
}

export function getCurrentNode() {
  return state.currentNode;
}

export function goToNode(nodeId) {
  const node = state.nodesMap[nodeId];
  if (!node) {
    throw new Error('节点不存在');
  }

  state.currentNodeId = nodeId;
  state.currentNode = node;
  return node;
}

export function choose(choice) {
  if (choice.next_node === GENERATE_NEXT) {
    state.pendingChoice = choice;
    showContinuePanel();
    return { type: 'generate', choice };
  }

  return {
    type: 'node',
    node: goToNode(choice.next_node)
  };
}

export function getPendingChoice() {
  return state.pendingChoice;
}

export function clearPendingChoice() {
  state.pendingChoice = null;
}

export function isEndingNode(node) {
  return Boolean(node && Array.isArray(node.choices) && node.choices.length === 0);
}
