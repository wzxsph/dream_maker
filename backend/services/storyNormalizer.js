const VALID_THEMES = new Set(['light', 'dark', 'danger', 'victory']);

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
      next_node: String(choice.next_node || choice.nextNode || choice.next || '').trim()
    }))
    .filter((choice) => choice.content && choice.next_node);
}

function isGenericChoiceContent(content) {
  return /^(继续|下一步|继续剧情|继续推进|进入下一幕|下一幕|继续吧)$/i.test(content || '');
}

function buildConcreteChoiceContent(index, total) {
  if (total >= 2) {
    return index === 0 ? '正面逼问，抢先掌控局面' : '暗中观察，套出更多真相';
  }

  return '顺势追问关键真相';
}

function normalizeChoiceLabels(nodes) {
  for (const node of Object.values(nodes)) {
    node.choices = (node.choices || []).map((choice, index, choices) => {
      if (choice.next_node !== '__GENERATE_NEXT__' && isGenericChoiceContent(choice.content)) {
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
    node.text = String(node.text || '');
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
    choiceKeywords.some((word) => existingText.includes(word)) ||
    sceneKeywords.some((word) => existingText.includes(word));

  if (!alreadyLinked) {
    startNode.text = `${buildNaturalBridgeLine(currentNodeText, selectedChoice)}${existingText}`;
  }

  return result;
}

function isSoftBridgeChoice(text) {
  return /继续|下一|后续|发展|等待|观察|看看|进入|剧情|局面|方向/.test(text || '');
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

  return '下一秒，眼前的局势悄然转向。';
}
