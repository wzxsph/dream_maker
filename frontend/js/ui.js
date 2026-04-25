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
  toast: document.getElementById('toast'),
  app: document.getElementById('app')
};

let choiceHandler = null;
let toastTimer = null;
let adTimer = null;

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

  els.storyText.textContent = node.text;
  renderChoices(node.choices || [], { generating: Boolean(node.is_generating) });
  els.endingActions.classList.toggle(
    'hidden',
    node.is_generating || (node.choices || []).length > 0
  );
  applyTheme(node.bg_theme);
  applyEffects(node.ui_effect || []);
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
