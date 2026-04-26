import { createStory, beginStory, getStory, continueStory, continueStoryProgressive, getGenerationJob } from './api.js';
import {
  choose,
  clearPendingChoice,
  getCurrentNode,
  getPendingChoice,
  goToNode,
  initStory,
  mergeChunk,
  mergePreviewNode,
  state
} from './storyPlayer.js';
import {
  hideContinuePanel,
  hideLoading,
  hideRewriteModal,
  renderNode,
  setBeginButtonEnabled,
  setChoiceHandler,
  setGenerationProgress,
  setStoryTitle,
  showContinuePanel,
  showHomePage,
  showReviewModal,
  showIntroPage,
  hideReviewModal,
  hideIntroPage,
  setIntroContent,
  setCountdownHint,
  startBeginCountdown,
  resetBeginButton,
  showLoading,
  showPresetAd,
  showRewriteModal,
  showStoryPage,
  showToast
} from './ui.js';
import { currentNodeStorageKey, getStoryIdFromHash, unlockedPaywallStorageKey } from './utils.js';

const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
const hotPromptButtons = document.querySelectorAll('.hot-prompt');
const continueBtn = document.getElementById('continueBtn');
const rewriteBtn = document.getElementById('rewriteBtn');
const cancelContinueBtn = document.getElementById('cancelContinueBtn');
const submitRewriteBtn = document.getElementById('submitRewriteBtn');
const skipRewriteBtn = document.getElementById('skipRewriteBtn');
const interventionInput = document.getElementById('interventionInput');
const backHomeBtn = document.getElementById('backHomeBtn');
const reviewBtn = document.getElementById('reviewBtn');
const closeReviewBtn = document.getElementById('closeReviewBtn');
const beginBtn = document.getElementById('beginBtn');
let activePaywallNodeId = null;
const activeJobs = new Set();
let storyStatusPollTimer = null;

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isStoryGenerated(session) {
  return (
    session.generation_status === 'ready' ||
    session.status === 'ready' ||
    session.status === 'active' ||
    (session.max_chunks && (session.chunks?.length || 0) >= session.max_chunks)
  );
}

function syncViewportHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${height}px`);
}

function persistCurrentNode() {
  if (!state.storyId || !state.currentNodeId) {
    return;
  }
  localStorage.setItem(currentNodeStorageKey(state.storyId), state.currentNodeId);
}

function renderCurrentNode() {
  const node = getCurrentNode();
  renderNode(node);
  persistCurrentNode();
  maybeShowPaywallAd(node);
}

function maybeShowPaywallAd(node) {
  if (!node?.is_paywall || node.paywall_type !== 'preset_ad') {
    activePaywallNodeId = null;
    return;
  }

  const choice = node.choices?.[0];
  if (!choice) {
    return;
  }

  if (localStorage.getItem(unlockedPaywallStorageKey(state.storyId, node.node_id)) === '1') {
    return;
  }

  if (activePaywallNodeId === node.node_id) {
    return;
  }

  activePaywallNodeId = node.node_id;
  window.setTimeout(() => {
    showPresetAd(node.ad_config, () => {
      localStorage.setItem(unlockedPaywallStorageKey(state.storyId, node.node_id), '1');
      activePaywallNodeId = null;
      showToast('已解锁，回到剧情继续选择');
    });
  }, 260);
}

// ====================== 故事创建 ======================

async function handleCreateStory() {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    showToast('请输入一句脑洞');
    return;
  }

  try {
    state.storyId = null;
    stopIntroPolling();
    setBeginButtonEnabled(false);
    setIntroContent({
      title: '正在生成标题...',
      synopsis: '正在把你的脑洞压缩成一场短剧，标题和简介出来后会先展示在这里。'
    });
    setGenerationProgress({ intro_ready: false, generated_chunk_count: 0 });
    setCountdownHint(buildGenerationHint({ intro_ready: false }));
    showIntroPage();

    const result = await createStory(prompt);
    console.log('[handleCreateStory] got result:', result.story_id, result.title);

    // 跳转到 intro 页面，显示标题+简介
    state.storyId = result.story_id;
    setBeginButtonEnabled(true);
    setIntroContent({ title: result.title, synopsis: result.synopsis });
    setGenerationProgress(result);
    setCountdownHint(buildGenerationHint(result));
    showIntroPage();
    console.log('[handleCreateStory] intro page shown, setting hash...');

    // 更新 hash
    window.location.hash = `#/story/${encodeURIComponent(result.story_id)}`;
    console.log('[handleCreateStory] hash set to:', window.location.hash);
  } catch (error) {
    setBeginButtonEnabled(true);
    showHomePage();
    showToast(error.message || '梦境生成失败，请换个脑洞试试');
  } finally {
    hideLoading();
  }
}

// ====================== 故事加载（所有状态） ======================

async function loadStory(storyId) {
  console.log('[loadStory] called with storyId:', storyId);
  try {
    const session = await getStory(storyId);
    console.log('[loadStory] got session, status:', session.status, 'chunks:', session.chunks?.length);

    // 立即设置 storyId，确保用户可以点击按钮
    state.storyId = storyId;
    state.title = session.title || '';

    switch (session.status) {
      case 'intro':
        // 后台正在生成，用户刚进入 intro 页面
        setIntroContent({ title: session.title, synopsis: session.synopsis || '' });
        setGenerationProgress(session);
        setCountdownHint(buildGenerationHint(session));
        showIntroPage();
        startIntroPolling(storyId);
        break;

      case 'countdown':
        // 用户已点击开始造梦，等待倒计时结束
        setIntroContent({ title: session.title, synopsis: session.synopsis || '' });
        setGenerationProgress(session);
        setCountdownHint(buildGenerationHint(session));
        showIntroPage();
        startIntroPolling(storyId);
        break;

      case 'generating':
        // 后台仍在生成中，显示 intro 页面并等待
        setIntroContent({ title: session.title, synopsis: session.synopsis || '' });
        setGenerationProgress(session);
        setCountdownHint(buildGenerationHint(session));
        showIntroPage();
        startIntroPolling(storyId);
        break;

      case 'error':
        showToast('故事生成失败：' + (session.error || '请重新开始'));
        window.location.hash = '#/';
        break;

      case 'ready':
      case 'active':
        showStoryReady(storyId, session);
        break;

      default:
        // status 未知或异常，尝试直接展示故事
        if (session.chunks?.length > 0) {
          showStoryReady(storyId, session);
        } else {
          showToast('故事加载异常，请重新开始');
          window.location.hash = '#/';
        }
    }
  } catch (error) {
    showToast(error.message || '这个故事不存在或已被删除');
    window.location.hash = '#/';
  }
}

// ====================== 故事就绪 ======================

async function showStoryReady(storyId, session) {
  stopIntroPolling();
  initStory(session);
  setStoryTitle(session.title);

  // 如果是直接进入 story 页面，清空之前可能的 intro 状态
  hideIntroPage();
  showStoryPage();

  const savedNodeId = localStorage.getItem(currentNodeStorageKey(storyId));
  if (savedNodeId && state.nodesMap[savedNodeId]) {
    goToNode(savedNodeId);
  } else if (session.chunks?.length > 0) {
    goToNode(session.chunks[0].start_node);
  }

  renderCurrentNode();
}

// ====================== 开始按钮 + 倒计时 ======================

async function handleBeginStory() {
  console.log('[handleBeginStory] called, state.storyId:', state.storyId);
  if (!state.storyId) {
    console.warn('[handleBeginStory] no storyId, returning early');
    return;
  }

  // 通知后端用户已点击开始
  try {
    console.log('[handleBeginStory] calling beginStory API...');
    const r = await beginStory(state.storyId);
    console.log('[handleBeginStory] beginStory response:', r);
  } catch (error) {
    console.warn('beginStory API warning:', error.message);
  }

  // 开始 10 秒倒计时
  console.log('[handleBeginStory] starting countdown...');
  startBeginCountdown(12, async () => {
    console.log('[handleBeginStory] countdown ended, waiting for story ready...');
    // 倒计时结束，查询故事是否就绪
    await waitForStoryReady(state.storyId);
  });
}

async function waitForStoryReady(storyId) {
  console.log('[waitForStoryReady] checking story:', storyId);
  const session = await getStory(storyId);
  console.log('[waitForStoryReady] status:', session.status, 'chunks:', session.chunks?.length);
  setGenerationProgress(session);
  setCountdownHint(buildGenerationHint(session));
  if (isStoryGenerated(session)) {
    console.log('[waitForStoryReady] calling showStoryReady');
    showStoryReady(storyId, session);
  } else if (session.status === 'error') {
    showToast('故事生成失败，请重新开始');
    resetBeginButton();
  } else {
    console.log('[waitForStoryReady] still generating, polling again...');
    // 还在生成中，继续轮询
    window.setTimeout(() => waitForStoryReady(storyId), 1500);
  }
}

// ====================== Intro 页面轮询 ======================

function startIntroPolling(storyId) {
  console.log('[startIntroPolling] started for:', storyId);
  stopIntroPolling();
  storyStatusPollTimer = window.setInterval(async () => {
    try {
      const freshSession = await getStory(storyId);
      console.log('[startIntroPolling] poll status:', freshSession.status, 'chunks:', freshSession.chunks?.length);
      setGenerationProgress(freshSession);
      setCountdownHint(buildGenerationHint(freshSession));
      if (isStoryGenerated(freshSession)) {
        stopIntroPolling();
      }
      if (freshSession.status === 'error') {
        stopIntroPolling();
        showToast('故事生成失败，请重新开始');
        window.location.hash = '#/';
      }
    } catch (e) {
      console.warn('[startIntroPolling] poll error:', e.message);
    }
  }, 2000);
}

function buildGenerationHint(session) {
  if (session?.intro_ready === false) {
    return '正在生成标题和内容简介...';
  }

  if (isStoryGenerated(session)) {
    return '梦境已经铺好，点击开始后进入第一幕。';
  }

  const count = session.generated_chunk_count || session.chunks?.length || 0;
  const labels = ['标题简介已完成，正在锁定开场...', '第一幕已完成，正在预写第二幕...', '第二幕已完成，正在收束结局...'];
  return labels[Math.min(count, labels.length - 1)] || '故事生成中，请稍候...';
}

function stopIntroPolling() {
  window.clearInterval(storyStatusPollTimer);
  storyStatusPollTimer = null;
}

// ====================== 续写逻辑 ======================

async function generateNext(mode, intervention = '', explicitChoice = null, options = {}) {
  const currentNode = getCurrentNode();
  const pendingChoice = explicitChoice || getPendingChoice();

  if (!currentNode || !pendingChoice) {
    showToast('剧情状态异常，请重新进入故事');
    return;
  }

  try {
    hideContinuePanel();
    hideRewriteModal();
    showLoading(mode === 'rewrite' ? '正在生成下一节点...' : '正在生成下一节点...');

    const payload = {
      current_node_id: currentNode.node_id,
      choice_content: pendingChoice.content,
      mode,
      intervention
    };

    const progressive = await continueStoryProgressive(state.storyId, payload);

    if (progressive.chunk) {
      await delay(520);
      mergeChunk(progressive.chunk);
      clearPendingChoice();
      activePaywallNodeId = null;
      goToNode(progressive.chunk.start_node);
      localStorage.setItem(currentNodeStorageKey(state.storyId), progressive.chunk.start_node);
      renderCurrentNode();
      return;
    }

    if (progressive.preview_node) {
      mergePreviewNode(progressive.preview_node);
      clearPendingChoice();
      hideLoading();
      goToNode(progressive.preview_node.node_id);
      renderCurrentNode();
      pollGenerationJob(progressive.job_id);
      return;
    }

    const result = await continueStory(state.storyId, payload);

    mergeChunk(result.chunk);
    clearPendingChoice();
    activePaywallNodeId = null;
    goToNode(result.chunk.start_node);
    localStorage.setItem(currentNodeStorageKey(state.storyId), result.chunk.start_node);
    renderCurrentNode();
  } catch (error) {
    showToast(error.message || '剧情续写失败，请重试');
    if (options.keepOnError !== false && !explicitChoice) {
      showContinuePanel();
    }
  } finally {
    hideLoading();
  }
}

async function pollGenerationJob(jobId) {
  if (!jobId || activeJobs.has(jobId)) {
    return;
  }

  activeJobs.add(jobId);

  const poll = async () => {
    try {
      const job = await getGenerationJob(jobId);

      if (job.status === 'done') {
        activeJobs.delete(jobId);
        const result = job.result;
        mergeChunk(result.chunk);
        activePaywallNodeId = null;
        goToNode(result.chunk.start_node);
        localStorage.setItem(currentNodeStorageKey(state.storyId), result.chunk.start_node);
        renderCurrentNode();
        return;
      }

      if (job.status === 'error') {
        activeJobs.delete(jobId);
        showToast(job.error || '剧情续写失败，请重试');
        return;
      }

      window.setTimeout(poll, 1200);
    } catch (error) {
      activeJobs.delete(jobId);
      showToast(error.message || '剧情续写失败，请重试');
    }
  };

  window.setTimeout(poll, 900);
}

function handleChoice(choice) {
  const node = getCurrentNode();

  if (node?.is_paywall && node.paywall_type === 'preset_ad') {
    if (localStorage.getItem(unlockedPaywallStorageKey(state.storyId, node.node_id)) === '1') {
      generateNext('continue', '', choice, { fromPaywall: true, keepOnError: false });
    } else {
      showPresetAd(node.ad_config, () => {
        localStorage.setItem(unlockedPaywallStorageKey(state.storyId, node.node_id), '1');
        showToast('已解锁，回到剧情继续选择');
      });
    }
    return;
  }

  try {
    const result = choose(choice);
    if (result.type === 'node') {
      renderCurrentNode();
    }
  } catch {
    showToast('剧情节点丢失，请刷新后重试');
  }
}

function openReviewMode() {
  const nodes = Object.values(state.nodesMap)
    .filter(Boolean)
    .sort((a, b) => nodeSortKey(a.node_id).localeCompare(nodeSortKey(b.node_id)));

  showReviewModal(nodes, (nodeId) => {
    try {
      goToNode(nodeId);
      renderCurrentNode();
    } catch {
      showToast('剧情节点丢失，请刷新后重试');
    }
  });
}

function nodeSortKey(nodeId = '') {
  const match = nodeId.match(/^node_(\d+)(?:_([a-z]+|ending))?/);
  if (!match) {
    return nodeId;
  }
  const suffix = match[2] || '';
  return `${String(Number(match[1])).padStart(3, '0')}_${suffix}`;
}

// ====================== 路由 ======================

function handleRoute() {
  const storyId = getStoryIdFromHash();

  if (storyId) {
    loadStory(storyId);
    return;
  }

  stopIntroPolling();
  showHomePage();
}

// ====================== 事件绑定 ======================

generateBtn.addEventListener('click', handleCreateStory);
promptInput.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    handleCreateStory();
  }
});

for (const button of hotPromptButtons) {
  button.addEventListener('click', () => {
    promptInput.value = button.textContent.trim();
    promptInput.focus();
  });
}

continueBtn.addEventListener('click', () => {
  generateNext('continue', '');
});

rewriteBtn.addEventListener('click', () => {
  hideContinuePanel();
  interventionInput.value = '';
  showRewriteModal();
});

cancelContinueBtn.addEventListener('click', hideContinuePanel);

submitRewriteBtn.addEventListener('click', () => {
  const intervention = interventionInput.value.trim();
  if (!intervention) {
    showToast('请输入改写内容');
    return;
  }
  generateNext('rewrite', intervention);
});

skipRewriteBtn.addEventListener('click', () => {
  generateNext('continue', '');
});

backHomeBtn.addEventListener('click', () => {
  window.location.hash = '#/';
});

reviewBtn.addEventListener('click', openReviewMode);
closeReviewBtn.addEventListener('click', hideReviewModal);
beginBtn.addEventListener('click', handleBeginStory);

setChoiceHandler(handleChoice);
syncViewportHeight();
window.addEventListener('resize', syncViewportHeight);
window.visualViewport?.addEventListener('resize', syncViewportHeight);
window.visualViewport?.addEventListener('scroll', syncViewportHeight);
window.addEventListener('hashchange', handleRoute);
handleRoute();
