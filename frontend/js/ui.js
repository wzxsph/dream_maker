const effectClasses = [
  'effect-flash-white',
  'effect-flash-red',
  'effect-shake',
  'effect-glitch',
  'effect-success'
];

const els = {
  homePage: document.getElementById('homePage'),
  introPage: document.getElementById('introPage'),
  storyPage: document.getElementById('storyPage'),
  introTitle: document.getElementById('introTitle'),
  introSynopsis: document.getElementById('introSynopsis'),
  countdownHint: document.getElementById('countdownHint'),
  progressFill: document.getElementById('progressFill'),
  progressSteps: document.querySelectorAll('.progress-step'),
  storyTitle: document.getElementById('storyTitle'),
  storyText: document.getElementById('storyText'),
  choices: document.getElementById('choices'),
  endingActions: document.getElementById('endingActions'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  loadingText: document.getElementById('loadingText'),
  continuePanel: document.getElementById('continuePanel'),
  nodeActions: document.getElementById('nodeActions'),
  regenerateNodeBtn: document.getElementById('regenerateNodeBtn'),
  adModal: document.getElementById('adModal'),
  adTitle: document.getElementById('adTitle'),
  adDescription: document.getElementById('adDescription'),
  adCountdown: document.getElementById('adCountdown'),
  adUnlockBtn: document.getElementById('adUnlockBtn'),
  reviewModal: document.getElementById('reviewModal'),
  reviewNodeList: document.getElementById('reviewNodeList'),
  historyPanel: document.getElementById('historyPanel'),
  historyTreeContainer: document.getElementById('historyTreeContainer'),
  closeHistoryBtn: document.getElementById('closeHistoryBtn'),
  toast: document.getElementById('toast'),
  app: document.getElementById('app')
};

let choiceHandler = null;
let toastTimer = null;
let adTimer = null;
let storyTextTimer = null;

export function setChoiceHandler(handler) {
  choiceHandler = handler;
}

export function setRegenerateHandler(handler) {
  els.regenerateNodeBtn?.addEventListener('click', handler);
}

export function setStoryTitle(title) {
  els.storyTitle.textContent = title || '';
}

export function showHomePage() {
  els.homePage.classList.remove('hidden');
  els.introPage.classList.add('hidden');
  els.storyPage.classList.add('hidden');
  hideReviewModal();
  document.body.dataset.theme = 'dark';
}

export function showIntroPage() {
  els.homePage.classList.add('hidden');
  els.introPage.classList.remove('hidden');
  els.storyPage.classList.add('hidden');
}

export function hideIntroPage() {
  els.introPage.classList.add('hidden');
}

export function showStoryPage() {
  els.homePage.classList.add('hidden');
  els.introPage.classList.add('hidden');
  els.storyPage.classList.remove('hidden');
}

export function setIntroContent({ title, synopsis }) {
  els.introTitle.textContent = title || '';
  els.introSynopsis.textContent = synopsis || '';
}

export function setCountdownHint(text) {
  els.countdownHint.textContent = text || '';
}

export function setGenerationProgress(session = {}) {
  const chunkCount = Number(session.generated_chunk_count || session.chunks?.length || 0);
  const hasIntro = session.intro_ready ?? Boolean(session.story_id || session.title || session.synopsis || session.status);
  const doneCount = Math.min(4, (hasIntro ? 1 : 0) + Math.max(0, chunkCount));
  const percent = Math.round((doneCount / 4) * 100);

  if (els.progressFill) {
    els.progressFill.style.width = `${percent}%`;
  }

  for (const step of els.progressSteps || []) {
    const index = Number(step.dataset.step || 0);
    step.classList.toggle('done', index < doneCount);
    step.classList.toggle('active', index === doneCount && doneCount < 4);
  }
}

export function renderNode(node) {
  if (!node) {
    return;
  }

  const text = node.text || node.content || '';
  const choices = node.choices || [];
  window.clearInterval(storyTextTimer);
  els.storyText.textContent = '';
  els.endingActions.classList.add('hidden');
  renderChoices([], { generating: Boolean(node.is_generating) });

  if (node.is_generating || text.length <= 18) {
    els.storyText.textContent = text;
    renderChoices(choices, { generating: Boolean(node.is_generating) });
    updateEndingActions(node);
  } else {
    streamStoryText(text, () => {
      renderChoices(choices);
      updateEndingActions(node);
    });
  }

  applyTheme(node.bg_theme);
  applyEffects(node.ui_effect || []);
}

function updateEndingActions(node) {
  els.endingActions.classList.toggle(
    'hidden',
    node.is_generating || (node.choices || []).length > 0
  );
  if (els.nodeActions) {
    els.nodeActions.classList.toggle(
      'hidden',
      node.is_generating || (node.choices || []).length === 0
    );
  }
}

function streamStoryText(text, onDone) {
  let index = 0;
  storyTextTimer = window.setInterval(() => {
    index += 1;
    els.storyText.textContent = text.slice(0, index);

    if (index >= text.length) {
      window.clearInterval(storyTextTimer);
      els.storyText.textContent = text;
      onDone?.();
    }
  }, 45);
}

export function renderChoices(choices, options = {}) {
  els.choices.innerHTML = '';

  if (options.generating) {
    const button = document.createElement('button');
    button.className = 'choice-btn';
    button.type = 'button';
    button.textContent = '后续剧情生成中...';
    button.disabled = true;
    els.choices.appendChild(button);
    return;
  }

  for (const choice of choices) {
    const button = document.createElement('button');
    button.className = 'choice-btn';
    button.type = 'button';
    button.textContent = choice.content;
    button.addEventListener('click', () => {
      if (choiceHandler) {
        choiceHandler(choice);
      }
    });
    els.choices.appendChild(button);
  }

  if (window.currentNarrativeMode === 'past_deduction' && choices.length > 0 && choices.some(c => c.next_node === '__GENERATE_NEXT__')) {
    const group = document.createElement('div');
    group.className = 'custom-choice-group';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'custom-choice-input';
    input.placeholder = '或者输入你的具体行动/选择...';

    const submit = document.createElement('button');
    submit.className = 'custom-choice-submit';
    submit.type = 'button';
    submit.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';

    const handleCustomSubmit = () => {
      const val = input.value.trim();
      if (!val) return;

      submit.disabled = true;
      if (choiceHandler) {
        choiceHandler({ content: val, next_node: '__GENERATE_NEXT__' });
      }
    };

    submit.addEventListener('click', handleCustomSubmit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCustomSubmit();
    });

    group.append(input, submit);
    els.choices.appendChild(group);
  }
}

export function showLoading(text = '正在构建梦境世界...') {
  els.loadingText.textContent = text;
  els.loadingOverlay.classList.remove('hidden');
}

export function hideLoading() {
  els.loadingOverlay.classList.add('hidden');
}

export function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  toastTimer = window.setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 2400);
}

export function showContinuePanel() {
  els.continuePanel.classList.remove('hidden');
}

export function hideContinuePanel() {
  els.continuePanel.classList.add('hidden');
}

export function showPresetAd(adConfig = {}, onUnlocked) {
  const duration = Number(adConfig.duration || 5);
  let left = duration;

  window.clearInterval(adTimer);
  els.adTitle.textContent = adConfig.title || '观看广告，解锁剧情';
  els.adDescription.textContent = adConfig.description || '世界意志正在干扰你的命运。';
  els.adCountdown.textContent = String(left);
  els.adUnlockBtn.textContent = adConfig.button_text || '解锁剧情';
  els.adUnlockBtn.disabled = true;
  els.adModal.classList.remove('hidden');

  adTimer = window.setInterval(() => {
    left -= 1;
    els.adCountdown.textContent = String(Math.max(left, 0));

    if (left <= 0) {
      window.clearInterval(adTimer);
      els.adUnlockBtn.disabled = false;
    }
  }, 1000);

  const unlock = () => {
    els.adUnlockBtn.removeEventListener('click', unlock);
    els.adModal.classList.add('hidden');
    window.clearInterval(adTimer);
    onUnlocked?.();
  };

  els.adUnlockBtn.addEventListener('click', unlock);
}

export function showReviewModal(nodes, onSelect) {
  els.reviewNodeList.innerHTML = '';

  const map = buildReviewGroups(nodes);
  for (const group of map) {
    const section = document.createElement('section');
    section.className = 'review-act';

    const header = document.createElement('div');
    header.className = 'review-act-header';
    const label = document.createElement('span');
    label.textContent = group.label;
    const title = document.createElement('b');
    title.textContent = group.title;
    header.append(label, title);

    const tree = document.createElement('div');
    tree.className = 'review-tree';

    for (const node of group.nodes) {
      const button = document.createElement('button');
      button.className = `review-node-btn review-depth-${getReviewDepth(node.node_id)}`;
      button.type = 'button';

      const meta = document.createElement('span');
      meta.className = 'review-node-meta';
      meta.textContent = formatNodeLabel(node.node_id);
      const text = document.createElement('b');
      text.textContent = node.text || node.content || '空白节点';
      const route = document.createElement('small');
      route.textContent = formatChoiceRoute(node);

      button.append(meta, text, route);
      button.addEventListener('click', () => {
        hideReviewModal();
        onSelect?.(node.node_id);
      });
      tree.appendChild(button);
    }

    section.append(header, tree);
    els.reviewNodeList.appendChild(section);
  }

  els.reviewModal.classList.remove('hidden');
}

export function hideReviewModal() {
  els.reviewModal.classList.add('hidden');
}

function buildReviewGroups(nodes) {
  const groups = [
    { label: '第一幕', title: '开场陷阱', nodes: [] },
    { label: '第二幕', title: '中段反转', nodes: [] },
    { label: '第三幕', title: '收束结尾', nodes: [] }
  ];

  for (const node of nodes) {
    const number = getNodeNumber(node.node_id);
    if (number >= 8) {
      groups[2].nodes.push(node);
    } else if (number >= 5) {
      groups[1].nodes.push(node);
    } else {
      groups[0].nodes.push(node);
    }
  }

  return groups.filter((group) => group.nodes.length > 0);
}

function getNodeNumber(nodeId = '') {
  const match = nodeId.match(/^node_(\d+)/);
  return match ? Number(match[1]) : 0;
}

function getReviewDepth(nodeId = '') {
  if (/_a$/.test(nodeId)) {
    return 1;
  }
  if (/_b$/.test(nodeId)) {
    return 2;
  }
  if (/ending$/.test(nodeId) || /_2$|_7$/.test(nodeId)) {
    return 3;
  }
  return 0;
}

function formatNodeLabel(nodeId = '') {
  if (/ending$/.test(nodeId)) {
    return '结局';
  }
  if (/_a$/.test(nodeId)) {
    return '分支 A';
  }
  if (/_b$/.test(nodeId)) {
    return '分支 B';
  }
  if (/_2$|_7$/.test(nodeId)) {
    return '汇合';
  }
  return '起点';
}

function formatChoiceRoute(node) {
  const choices = node.choices || [];
  if (choices.length === 0) {
    return '终点';
  }
  return choices.map((choice) => choice.content).join(' / ');
}

export function applyTheme(bgTheme = 'dark') {
  document.body.dataset.theme = bgTheme;
}

export function applyEffects(effects = []) {
  els.app.classList.remove(...effectClasses);
  void els.app.offsetWidth;

  for (const effect of effects) {
    const className = `effect-${effect.replaceAll('_', '-')}`;
    if (effectClasses.includes(className)) {
      els.app.classList.add(className);
    }
  }

  window.setTimeout(() => {
    els.app.classList.remove(...effectClasses);
  }, 950);
}

// ====================== History Tree Panel ======================

let historyNodeHandler = null;

export function setHistoryNodeHandler(handler) {
  historyNodeHandler = handler;
}

export function showHistoryPanel() {
  els.historyPanel?.classList.remove('hidden');
}

export function hideHistoryPanel() {
  els.historyPanel?.classList.add('hidden');
}

export function isHistoryPanelOpen() {
  return els.historyPanel && !els.historyPanel.classList.contains('hidden');
}

export function renderHistoryTree(nodesMap, currentNodeId, playerPath = []) {
  if (!els.historyTreeContainer) return;
  els.historyTreeContainer.innerHTML = '';

  // Collect and sort pd_node_* entries
  const pdNodes = Object.entries(nodesMap)
    .filter(([id]) => id.startsWith('pd_node_'))
    .sort(([a], [b]) => {
      const numA = parseInt(a.replace('pd_node_', ''), 10);
      const numB = parseInt(b.replace('pd_node_', ''), 10);
      return numA - numB;
    });

  if (pdNodes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = '还没有推演历史';
    els.historyTreeContainer.appendChild(empty);
    return;
  }

  // Build a map of choices taken from playerPath
  const choiceMap = {};
  for (const entry of playerPath) {
    if (entry.current_node_id && entry.choice_content) {
      choiceMap[entry.current_node_id] = entry.choice_content;
    }
  }

  for (const [nodeId, node] of pdNodes) {
    const item = document.createElement('div');
    item.className = 'history-node';
    if (nodeId === currentNodeId) {
      item.classList.add('active');
    }

    const idx = document.createElement('div');
    idx.className = 'history-node-index';
    const num = parseInt(nodeId.replace('pd_node_', ''), 10);
    idx.textContent = `第 ${num} 步`;

    const text = document.createElement('div');
    text.className = 'history-node-text';
    text.textContent = node.text || node.content || '空白节点';

    item.append(idx, text);

    // Show the choice that was made at this node
    const choiceMade = choiceMap[nodeId];
    if (choiceMade) {
      const choiceEl = document.createElement('div');
      choiceEl.className = 'history-node-choice';
      choiceEl.textContent = `→ ${choiceMade}`;
      item.appendChild(choiceEl);
    }

    item.addEventListener('click', () => {
      historyNodeHandler?.(nodeId);
    });

    els.historyTreeContainer.appendChild(item);
  }

  // Auto-scroll to active node
  const activeEl = els.historyTreeContainer.querySelector('.history-node.active');
  if (activeEl) {
    activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

els.closeHistoryBtn?.addEventListener('click', hideHistoryPanel);
