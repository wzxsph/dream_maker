const VALID_THEMES = new Set(['light', 'dark', 'danger', 'victory']);
const GENERATE_NEXT = '__GENERATE_NEXT__';

const ARCHITECTURE_EDGES = {
  1: {
    chunk_id: 'chunk_1',
    type: 'opening',
    start_node: 'node_0',
    end_nodes: ['node_2'],
    edges: {
      node_0: ['node_1_a', 'node_1_b'],
      node_1_a: ['node_2'],
      node_1_b: ['node_2'],
      node_2: [GENERATE_NEXT]
    },
    rewrite_node: 'node_2'
  },
  2: {
    chunk_id: 'chunk_2',
    type: 'middle',
    start_node: 'node_5',
    end_nodes: ['node_7'],
    edges: {
      node_5: ['node_6_a', 'node_6_b'],
      node_6_a: ['node_7'],
      node_6_b: ['node_7'],
      node_7: [GENERATE_NEXT]
    },
    rewrite_node: 'node_7'
  },
  3: {
    chunk_id: 'chunk_3',
    type: 'ending',
    start_node: 'node_8',
    end_nodes: ['node_10_ending'],
    edges: {
      node_8: ['node_9_a', 'node_9_b'],
      node_9_a: ['node_10_ending'],
      node_9_b: ['node_10_ending'],
      node_10_ending: []
    },
    rewrite_node: null
  }
};

const FALLBACK_NODE_TEXTS = {
  node_0: '局势在眼前骤然绷紧，所有人的目光都压向你。你知道，下一步必须立刻做出选择。',
  node_1_a: '你正面迎上去，空气像被拉紧，隐藏的破绽开始露出边角。',
  node_1_b: '你换了一种方式试探，对方的反应比预想更快，也更危险。',
  node_2: '两条线索在这一刻汇合，更大的危机已经逼到眼前。你必须抓住最后一点主动权。',
  node_5: '刚才的选择落下后，现场的平衡被打破，一个新的筹码浮出水面。',
  node_6_a: '你把优势压到明处，对方终于露出一瞬无法掩饰的慌乱。',
  node_6_b: '你暂时收住锋芒，逼对方先动手，真正的破绽随即出现。',
  node_7: '真相快要冲破封锁时，世界忽然卡顿。你意识到，最后一击必须马上开始。',
  node_8: '画面重新流动，你攥紧最后的证据，所有被掩盖的真相都在此刻回到你手里。',
  node_9_a: '你选择公开全部证据，让每一个旁观者都无法再假装看不见。',
  node_9_b: '你保留最后的底牌，把对手逼到不得不亲口承认的角落。',
  node_10_ending: '夜色落下，你走出困住自己的旧剧情。这一次，故事不再替你安排结局。'
};

function normalizeTheme(theme) {
  const value = String(theme || '').toLowerCase();

  if (VALID_THEMES.has(value)) {
    return value;
  }

  if (/danger|red|blood|crisis|危|险|警|红|崩|惩/.test(value)) {
    return 'danger';
  }

  if (/victory|success|gold|win|胜|赢|光|金|爽/.test(value)) {
    return 'victory';
  }

  if (/light|white|bright|day|明|白|亮/.test(value)) {
    return 'light';
  }

  return 'dark';
}

function normalizeEffects(effects) {
  if (!Array.isArray(effects)) {
    return [];
  }

  return effects
    .map((effect) => String(effect || '').trim())
    .filter(Boolean)
    .map((effect) => effect.replaceAll('-', '_'));
}

function normalizeChoices(choices) {
  if (!Array.isArray(choices)) {
    return [];
  }

  return choices
    .filter((choice) => choice && typeof choice === 'object')
    .slice(0, 2)
    .map((choice) => ({
      content: String(choice.content || choice.text || choice.label || '继续').trim(),
      next_node: normalizeNextNode(choice.next_node || choice.nextNode || choice.next)
    }))
    .filter((choice) => choice.content && choice.next_node);
}

function normalizeNextNode(nextNode) {
  const value = String(nextNode || '').trim();
  const compact = value.replace(/[\s_\-]/g, '').toUpperCase();

  if (compact === 'GENERATENEXT') {
    return GENERATE_NEXT;
  }

  return value;
}

function isGenericChoiceContent(content) {
  return /^(next|continue|generate_next|继续|下一步|继续剧情|继续推进|进入下一幕|进入下一段剧情|下一幕|继续吧)$/i.test(content || '');
}

function buildConcreteChoiceContent(index, total) {
  if (total >= 2) {
    return index === 0 ? '正面逼问，抢先掌控局面' : '暗中观察，套出更多真相';
  }

  return '顺势追问关键真相';
}

function buildChoiceContent(nodeId, index = 0) {
  const byNode = {
    node_0: ['正面破局，抢先夺回主动', '暂时示弱，套出更深破绽'],
    node_1_a: ['抓住破绽继续追问'],
    node_1_b: ['顺势逼近关键证据'],
    node_2: ['带着当前筹码追击下一幕'],
    node_5: ['公开手里的关键筹码', '藏住底牌反向试探'],
    node_6_a: ['把优势压到对方面前'],
    node_6_b: ['逼对方先露出破绽'],
    node_7: ['抓住对方露出的破绽继续追证'],
    node_8: ['公开全部证据完成翻盘', '保留最后底牌逼她坦白'],
    node_9_a: ['当众收回自己的名字'],
    node_9_b: ['亲手关闭这场审判']
  };

  return byNode[nodeId]?.[index] || buildConcreteChoiceContent(index, 2);
}

function normalizeChoicesForTargets(nodeId, choices, targets) {
  return targets.map((target, index) => {
    const reusable = (choices || []).find((choice) => choice.next_node === target) || choices?.[index];
    const content = reusable?.content && !isGenericChoiceContent(reusable.content)
      ? reusable.content
      : buildChoiceContent(nodeId, index);

    return {
      content,
      next_node: target
    };
  });
}

export function repairChunkGraphForArchitecture(result, maxChunks = 3) {
  const chunk = result?.chunk;
  const blueprint = ARCHITECTURE_EDGES[chunk?.chunk_index];

  if (!chunk || !blueprint || chunk.chunk_index > maxChunks) {
    return result;
  }

  chunk.chunk_id = blueprint.chunk_id;
  chunk.type = blueprint.type;
  chunk.start_node = blueprint.start_node;
  chunk.end_nodes = [...blueprint.end_nodes];
  chunk.nodes = chunk.nodes || {};
  const originalTexts = Object.values(chunk.nodes)
    .map((node) => String(node?.text || node?.content || node?.body || '').trim())
    .filter(Boolean);

  const expectedNodeIds = new Set(Object.keys(blueprint.edges));
  for (const nodeId of Object.keys(chunk.nodes)) {
    if (!expectedNodeIds.has(nodeId)) {
      delete chunk.nodes[nodeId];
    }
  }

  for (const [index, [nodeId, targets]] of Object.entries(blueprint.edges).entries()) {
    const node = chunk.nodes?.[nodeId] || buildFallbackNode(nodeId, chunk.chunk_index, originalTexts[index]);
    chunk.nodes[nodeId] = node;

    node.node_id = nodeId;
    node.is_rewrite_point = nodeId === blueprint.rewrite_node;
    node.choices = normalizeChoicesForTargets(nodeId, node.choices, targets);
  }

  return result;
}

function buildFallbackNode(nodeId, chunkIndex, text = '') {
  return {
    node_id: nodeId,
    text: text || FALLBACK_NODE_TEXTS[nodeId] || '局势继续推进，新的压力逼近眼前。',
    bg_theme: buildFallbackTheme(nodeId, chunkIndex),
    ui_effect: buildFallbackEffects(nodeId, chunkIndex),
    is_paywall: false,
    paywall_type: null,
    ad_config: null,
    is_rewrite_point: false,
    choices: []
  };
}

function buildFallbackTheme(nodeId, chunkIndex) {
  if (chunkIndex === 3) {
    return 'victory';
  }

  if (nodeId === 'node_0') {
    return 'light';
  }

  if (/_2$|_7$/.test(nodeId)) {
    return 'danger';
  }

  return 'dark';
}

function buildFallbackEffects(nodeId, chunkIndex) {
  if (chunkIndex === 3) {
    return ['success'];
  }

  if (nodeId === 'node_0') {
    return ['flash_white'];
  }

  if (/_2$|_7$/.test(nodeId)) {
    return ['flash_red', 'glitch'];
  }

  return [];
}

function normalizeChoiceLabels(nodes) {
  for (const node of Object.values(nodes)) {
    node.choices = (node.choices || []).map((choice, index, choices) => {
      if (isGenericChoiceContent(choice.content)) {
        return {
          ...choice,
          content: buildConcreteChoiceContent(index, choices.length)
        };
      }

      return choice;
    });
  }
}

export function normalizeStoryResult(result) {
  if (!result || typeof result !== 'object') {
    return result;
  }

  result.state_patch = {
    current_phase: String(result.state_patch?.current_phase || ''),
    facts_add: Array.isArray(result.state_patch?.facts_add) ? result.state_patch.facts_add : [],
    open_threads_add: Array.isArray(result.state_patch?.open_threads_add)
      ? result.state_patch.open_threads_add
      : [],
    open_threads_resolved: Array.isArray(result.state_patch?.open_threads_resolved)
      ? result.state_patch.open_threads_resolved
      : [],
    characters_update: Array.isArray(result.state_patch?.characters_update)
      ? result.state_patch.characters_update
      : []
  };

  if (!result.chunk || typeof result.chunk !== 'object') {
    return result;
  }

  result.chunk.nodes = result.chunk.nodes || {};
  result.chunk.end_nodes = Array.isArray(result.chunk.end_nodes) ? result.chunk.end_nodes : [];

  for (const [nodeId, node] of Object.entries(result.chunk.nodes)) {
    if (!node || typeof node !== 'object') {
      continue;
    }

    node.node_id = String(node.node_id || nodeId);
    node.text = String(node.text || node.content || node.body || '');
    node.bg_theme = normalizeTheme(node.bg_theme);
    node.ui_effect = normalizeEffects(node.ui_effect);
    node.is_paywall = Boolean(node.is_paywall);
    node.paywall_type = node.paywall_type || null;
    node.ad_config = node.ad_config || null;
    node.is_rewrite_point = Boolean(node.is_rewrite_point);
    node.choices = normalizeChoices(node.choices);
  }

  normalizeChoiceLabels(result.chunk.nodes);

  if (result.chunk.end_nodes.length === 0) {
    result.chunk.end_nodes = Object.values(result.chunk.nodes)
      .filter((node) =>
        (node.choices || []).some((choice) => choice.next_node === '__GENERATE_NEXT__') ||
        (node.choices || []).length === 0
      )
      .map((node) => node.node_id);
  }

  return result;
}

export function reinforceChunkContinuity(result, continuityContext = {}) {
  const chunk = result?.chunk;
  const startNode = chunk?.nodes?.[chunk.start_node];
  const selectedChoice = String(continuityContext.selected_choice || '').trim();

  if (!startNode || !selectedChoice || chunk.chunk_index <= 1) {
    return result;
  }

  const existingText = String(startNode.text || '');
  const currentNodeText = String(continuityContext.current_node_text || '');
  const choiceKeywords = selectedChoice
    .replace(/[“”"「」？！。，、,.!?]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !isSoftBridgeChoice(word))
    .slice(0, 4);
  const sceneKeywords = extractSceneKeywords(currentNodeText);

  const alreadyLinked =
    hasBridgePrefix(existingText) ||
    choiceKeywords.some((word) => existingText.includes(word)) ||
    sceneKeywords.some((word) => existingText.includes(word));

  if (!alreadyLinked) {
    startNode.text = `${buildNaturalBridgeLine(currentNodeText, selectedChoice)}${existingText}`;
  }

  return result;
}

function isSoftBridgeChoice(text) {
  return /next|continue|generate|继续|下一|后续|发展|等待|观察|看看|进入|剧情|局面|方向/.test(text || '');
}

function extractSceneKeywords(text) {
  const matches = String(text || '').match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  return matches
    .filter((word) => !isSoftBridgeChoice(word))
    .filter((word) => !/一个|这时|突然|已经|正在|没有|所有|自己|什么|时候/.test(word))
    .slice(-6);
}

function buildNaturalBridgeLine(currentNodeText, selectedChoice) {
  if (/广告|黑客松|解锁|倒计时/.test(currentNodeText)) {
    return '倒计时结束的瞬间，停滞的画面重新流动。';
  }

  if (/等待|后续|继续|下一幕|发展/.test(selectedChoice)) {
    return '短暂的沉默后，眼前的局势先一步发生变化。';
  }

  if (/逃|跑|离开|退/.test(selectedChoice)) {
    return '你转身的一瞬，身后的声音却更近了。';
  }

  if (/质问|逼问|追问|揭穿|公开/.test(selectedChoice)) {
    return '你的话音落下，空气像被骤然绷紧。';
  }

  if (/装|假装|隐忍|观察|暗中/.test(selectedChoice)) {
    return '你压下情绪，顺着对方的表演继续往下看。';
  }

  if (/反击|动手|抓|拽|打/.test(selectedChoice)) {
    return '动作发生得太快，所有人的表情都在这一刻凝住。';
  }

  return '眼前的线索终于有了回应。';
}

function hasBridgePrefix(text) {
  return /^(倒计时结束的瞬间|短暂的沉默后|你转身的一瞬|你的话音落下|你压下情绪|动作发生得太快|眼前的线索终于有了回应|下一秒|就在这时|话音刚落)/.test(text || '');
}
