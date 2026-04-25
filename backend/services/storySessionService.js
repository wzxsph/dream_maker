export function createSession({ storyId, title, synopsis = '', storyState = null, firstChunk = null, cards = [], status = 'intro' }) {
  const now = new Date().toISOString();
  const session = {
    story_id: storyId,
    title,
    synopsis,
    status,
    max_chunks: 3,
    current_chunk_index: 0,
    story_state: storyState || {
      genre: 'interactive_reversal',
      tone: '高冲突、强反转、短平快',
      current_phase: 'opening',
      protagonist: { name: '你', identity: '被命运选中的主角', goal: '改写原本的结局' },
      characters: [],
      facts: [],
      open_threads: [],
      constraints: []
    },
    chunks: [],
    cards,
    node_index: {},
    player_path: [],
    interventions: [],
    created_at: now,
    updated_at: now
  };

  if (firstChunk) {
    mergeChunk(session, firstChunk);
  }
  return session;
}

export function mergeChunk(session, chunk) {
  const existingIndex = session.chunks.findIndex((item) => item.chunk_id === chunk.chunk_id);

  if (existingIndex >= 0) {
    session.chunks[existingIndex] = chunk;
  } else {
    session.chunks.push(chunk);
  }

  session.chunks.sort((a, b) => a.chunk_index - b.chunk_index);
  session.current_chunk_index = Math.max(session.current_chunk_index || 0, chunk.chunk_index);
  session.node_index = {};

  for (const item of session.chunks) {
    for (const nodeId of Object.keys(item.nodes || {})) {
      session.node_index[nodeId] = {
        chunk_id: item.chunk_id,
        chunk_index: item.chunk_index
      };
    }
  }

  return session;
}

export function recordPlayerChoice(session, { currentNodeId, choiceContent }) {
  session.player_path.push({
    current_node_id: currentNodeId,
    choice_content: choiceContent || '',
    created_at: new Date().toISOString()
  });
}

export function recordIntervention(session, { currentNodeId, intervention }) {
  session.interventions.push({
    current_node_id: currentNodeId,
    intervention,
    created_at: new Date().toISOString()
  });
}

export function getAllNodes(session) {
  const nodes = {};
  for (const chunk of session.chunks || []) {
    Object.assign(nodes, chunk.nodes || {});
  }
  return nodes;
}

export function getRecentNodes(session, count = 5, currentNodeId = null) {
  const allNodes = getAllNodes(session);
  const pathNodes = (session.player_path || [])
    .map((item) => allNodes[item.current_node_id])
    .filter(Boolean);

  if (currentNodeId && allNodes[currentNodeId] && !pathNodes.some((node) => node.node_id === currentNodeId)) {
    pathNodes.push(allNodes[currentNodeId]);
  }

  return pathNodes.slice(-count).map(compactNode);
}

export function buildContinuityContext(session, { currentNodeId, choiceContent, intervention }) {
  const allNodes = getAllNodes(session);
  const currentNode = allNodes[currentNodeId];
  const recentPath = (session.player_path || [])
    .slice(-4)
    .map((item) => {
      const node = allNodes[item.current_node_id];
      return {
        node_id: item.current_node_id,
        node_text: node?.text || '',
        player_choice: item.choice_content || ''
      };
    });

  return {
    current_node_id: currentNodeId,
    current_node_text: currentNode?.text || '',
    current_node_choices: (currentNode?.choices || []).map((choice) => ({
      content: choice.content,
      next_node: choice.next_node
    })),
    selected_choice: choiceContent || '',
    intervention: intervention || '',
    recent_player_path: recentPath,
    bridge_requirement:
      '新 chunk 的 start_node.text 必须直接承接 current_node_text 和 selected_choice，写出这个选择造成的下一秒结果。'
  };
}

function compactNode(node) {
  return {
    node_id: node.node_id,
    text: node.text,
    bg_theme: node.bg_theme,
    choices: (node.choices || []).map((choice) => choice.content)
  };
}
