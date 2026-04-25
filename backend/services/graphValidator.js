const GENERATE_NEXT = '__GENERATE_NEXT__';

export function validateChunkGraph(chunk, maxChunks = 3) {
  const nodes = chunk.nodes || {};
  const errors = [];

  if (!nodes[chunk.start_node]) {
    errors.push(`start_node ${chunk.start_node} 不存在`);
  }

  for (const endNode of chunk.end_nodes || []) {
    if (!nodes[endNode]) {
      errors.push(`end_node ${endNode} 不存在`);
    }
  }

  let hasGenerateNext = false;
  let hasEndingNode = false;

  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.node_id !== nodeId) {
      errors.push(`节点 key ${nodeId} 与 node_id ${node.node_id} 不一致`);
    }

    if ('next_nodes' in node || 'nextNodes' in node || 'next_node' in node) {
      errors.push(`${nodeId} 不能使用 next_nodes/next_node 字段，必须使用 choices 数组`);
    }

    if ((node.choices || []).length === 0) {
      hasEndingNode = true;
    }

    for (const choice of node.choices || []) {
      if (choice.next_node === GENERATE_NEXT) {
        hasGenerateNext = true;
        continue;
      }

      if (/^(继续|下一步|继续剧情|继续推进|进入下一幕|下一幕)$/i.test(choice.content || '')) {
        errors.push(`${nodeId} 的普通选项不能只写“${choice.content}”，必须是具体剧情动作`);
      }

      if (!nodes[choice.next_node]) {
        errors.push(`${nodeId} 的选项指向不存在的节点 ${choice.next_node}`);
      }
    }
  }

  const reachable = collectReachableNodeIds(chunk);
  const reachableNodes = [...reachable].map((nodeId) => nodes[nodeId]).filter(Boolean);
  const hasReachableGenerateNext = reachableNodes.some((node) =>
    (node.choices || []).some((choice) => choice.next_node === GENERATE_NEXT)
  );
  const hasReachableEndingNode = reachableNodes.some((node) => (node.choices || []).length === 0);

  if (chunk.chunk_index < maxChunks) {
    if (!hasGenerateNext) {
      errors.push('非最后 chunk 必须至少包含一个 __GENERATE_NEXT__ 跳转');
    }

    if (!hasReachableGenerateNext) {
      errors.push('非最后 chunk 的 __GENERATE_NEXT__ 必须能从 start_node 播放到达');
    }

    for (const node of reachableNodes) {
      if ((node.choices || []).length === 0) {
        errors.push(`非最后 chunk 的可达节点 ${node.node_id} 不能是空 choices`);
      }
    }
  }

  if (chunk.chunk_index === maxChunks) {
    if (!hasEndingNode) {
      errors.push('最后 chunk 必须至少包含一个 choices 为空的结局节点');
    }

    if (!hasReachableEndingNode) {
      errors.push('最后 chunk 的结局节点必须能从 start_node 播放到达');
    }
  }

  if (errors.length > 0) {
    const error = new Error(`剧情节点图校验失败：${errors.join('；')}`);
    error.status = 500;
    throw error;
  }

  return true;
}

function collectReachableNodeIds(chunk) {
  const nodes = chunk.nodes || {};
  const seen = new Set();
  const stack = nodes[chunk.start_node] ? [chunk.start_node] : [];

  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (seen.has(nodeId)) {
      continue;
    }

    seen.add(nodeId);
    const node = nodes[nodeId];
    for (const choice of node?.choices || []) {
      if (choice.next_node !== GENERATE_NEXT && nodes[choice.next_node]) {
        stack.push(choice.next_node);
      }
    }
  }

  return seen;
}
