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
  beginBtn: document.getElementById('beginBtn'),
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
  rewriteModal: document.getElementById('rewriteModal'),
  adModal: document.getElementById('adModal'),
  adTitle: document.getElementById('adTitle'),
  adDescription: document.getElementById('adDescription'),
  adCountdown: document.getElementById('adCountdown'),
  adUnlockBtn: document.getElementById('adUnlockBtn'),
  reviewModal: document.getElementById('reviewModal'),
  reviewNodeList: document.getElementById('reviewNodeList'),
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

export function setBeginButtonEnabled(enabled, label = '开始造梦') {
  els.beginBtn.disabled = !enabled;
  els.beginBtn.textContent = enabled ? label : '正在准备';
  els.beginBtn.classList.toggle('counting', !enabled);
}

let countdownTimer = null;

export function startBeginCountdown(seconds = 10, onCountdownEnd) {
  let left = seconds;
  els.beginBtn.classList.add('counting');
  els.beginBtn.disabled = true;
  els.beginBtn.textContent = `${left}s 后开始`;
  els.countdownHint.textContent = '故事生成中，请稍候...';

  window.clearInterval(countdownTimer);
  countdownTimer = window.setInterval(() => {
    left -= 1;
    if (left <= 0) {
      window.clearInterval(countdownTimer);
      els.beginBtn.textContent = '开始造梦';
      els.beginBtn.classList.remove('counting');
      els.beginBtn.disabled = false;
      els.countdownHint.textContent = '';
      onCountdownEnd?.();
    } else {
      els.beginBtn.textContent = `${left}s 后开始`;
    }
  }, 1000);
}

export function resetBeginButton() {
  window.clearInterval(countdownTimer);
  els.beginBtn.classList.remove('counting');
  els.beginBtn.disabled = false;
  els.beginBtn.textContent = '开始造梦';
  els.countdownHint.textContent = '生成中，请稍候...';
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
}

function streamStoryText(text, onDone) {
  let index = 0;
  storyTextTimer = window.setInterval(() => {
    index += text.length > 120 ? 3 : 2;
    els.storyText.textContent = text.slice(0, index);

    if (index >= text.length) {
      window.clearInterval(storyTextTimer);
      els.storyText.textContent = text;
      onDone?.();
    }
  }, 28);
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

export function showRewriteModal() {
  els.rewriteModal.classList.remove('hidden');
}

export function hideRewriteModal() {
  els.rewriteModal.classList.add('hidden');
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

  for (const node of nodes) {
    const button = document.createElement('button');
    button.className = 'review-node-btn';
    button.type = 'button';

    const id = document.createElement('span');
    id.textContent = node.node_id;
    const text = document.createElement('b');
    text.textContent = node.text || node.content || '空白节点';

    button.append(id, text);
    button.addEventListener('click', () => {
      hideReviewModal();
      onSelect?.(node.node_id);
    });
    els.reviewNodeList.appendChild(button);
  }

  els.reviewModal.classList.remove('hidden');
}

export function hideReviewModal() {
  els.reviewModal.classList.add('hidden');
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
