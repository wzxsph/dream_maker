import { createStory, getStory, continueStory, continueStoryProgressive, getGenerationJob } from './api.js';
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
  renderNode,
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
  showLoading,
  showPresetAd,
  showStoryPage,
  showToast
} from './ui.js';
import { currentNodeStorageKey, getStoryIdFromHash, unlockedPaywallStorageKey } from './utils.js';

const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
const hotPromptButtons = document.querySelectorAll('.hot-prompt');
const continueBtn = document.getElementById('continueBtn');
const cancelContinueBtn = document.getElementById('cancelContinueBtn');
const backHomeBtn = document.getElementById('backHomeBtn');
const reviewBtn = document.getElementById('reviewBtn');
const closeReviewBtn = document.getElementById('closeReviewBtn');
let activePaywallNodeId = null;
const activeJobs = new Set();
let storyStatusPollTimer = null;
let introShownAt = 0;
let autoEnterTimer = null;
const MIN_INTRO_VISIBLE_MS = 5200;

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

function clearAutoEnterTimer() {
  window.clearTimeout(autoEnterTimer);
  autoEnterTimer = null;
}

function showIntroProgress({ resetTimer = false } = {}) {
  if (resetTimer || !introShownAt) {
    introShownAt = Date.now();
  }
  showIntroPage();
}

function scheduleStoryReady(storyId, session) {
  stopIntroPolling();
  clearAutoEnterTimer();
  const elapsed = introShownAt ? Date.now() - introShownAt : MIN_INTRO_VISIBLE_MS;
  const remaining = Math.max(0, MIN_INTRO_VISIBLE_MS - elapsed);
  setGenerationProgress(session);
  setCountdownHint(remaining > 0 ? '第一幕已准备好，正在进入...' : '正在进入第一幕...');
  autoEnterTimer = window.setTimeout(() => {
    showStoryReady(storyId, session);
  }, remaining);
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
    clearAutoEnterTimer();
    setIntroContent({
      title: '正在生成标题...',
      synopsis: '正在把你的脑洞压缩成一场短剧，标题和简介出来后会先展示在这里。'
    });
    setGenerationProgress({ intro_ready: false, generated_chunk_count: 0 });
    setCountdownHint(buildGenerationHint({ intro_ready: false }));
    showIntroProgress({ resetTimer: true });

    const result = await createStory(prompt);
    console.log('[handleCreateStory] got result:', result.story_id, result.title);

    // 跳转到 intro 页面，显示标题+简介
    state.storyId = result.story_id;
    setIntroContent({ title: result.title, synopsis: result.synopsis });
    setGenerationProgress(result);
    setCountdownHint(buildGenerationHint(result));
    showIntroProgress();
    console.log('[handleCreateStory] intro page shown, setting hash...');

    // 更新 hash
    const nextHash = `#/story/${encodeURIComponent(result.story_id)}`;
    if (window.location.hash === nextHash) {
      loadStory(result.story_id);
    } else {
      window.location.hash = nextHash;
    }
    console.log('[handleCreateStory] hash set to:', window.location.hash);
  } catch (error) {
    clearAutoEnterTimer();
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
        showIntroProgress();
        if (isStoryGenerated(session)) {
          scheduleStoryReady(storyId, session);
        } else {
          startIntroPolling(storyId);
        }
        break;

      case 'countdown':
        // 兼容旧 session 状态，按自动进入流程处理
        setIntroContent({ title: session.title, synopsis: session.synopsis || '' });
        setGenerationProgress(session);
        setCountdownHint(buildGenerationHint(session));
        showIntroProgress();
        if (isStoryGenerated(session)) {
          scheduleStoryReady(storyId, session);
        } else {
          startIntroPolling(storyId);
        }
        break;

      case 'generating':
        // 后台仍在生成中，显示 intro 页面并等待
        setIntroContent({ title: session.title, synopsis: session.synopsis || '' });
        setGenerationProgress(session);
        setCountdownHint(buildGenerationHint(session));
        showIntroProgress();
        if (isStoryGenerated(session)) {
          scheduleStoryReady(storyId, session);
        } else {
          startIntroPolling(storyId);
        }
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
  clearAutoEnterTimer();
  introShownAt = 0;
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
        scheduleStoryReady(storyId, freshSession);
        return;
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
    return '梦境已经铺好，马上进入第一幕。';
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
    showLoading('正在生成下一节点...');

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
  clearAutoEnterTimer();
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

cancelContinueBtn.addEventListener('click', hideContinuePanel);

backHomeBtn.addEventListener('click', () => {
  window.location.hash = '#/';
});

reviewBtn.addEventListener('click', openReviewMode);
closeReviewBtn.addEventListener('click', hideReviewModal);

setChoiceHandler(handleChoice);
syncViewportHeight();
window.addEventListener('resize', syncViewportHeight);
window.visualViewport?.addEventListener('resize', syncViewportHeight);
window.visualViewport?.addEventListener('scroll', syncViewportHeight);
window.addEventListener('hashchange', handleRoute);
handleRoute();
