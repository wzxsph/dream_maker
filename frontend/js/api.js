async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
  } catch {
    throw new Error('网络异常，请稍后再试');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || '请求失败');
  }

  return data;
}

export function createStory(payload) {
  const body = typeof payload === 'string' ? { prompt: payload } : payload;
  return request('/api/stories', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function getStory(storyId) {
  return request(`/api/stories/${encodeURIComponent(storyId)}`);
}

export function continueStory(storyId, payload) {
  return request(`/api/stories/${encodeURIComponent(storyId)}/continue`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function continueStoryProgressive(storyId, payload) {
  return request(`/api/stories/${encodeURIComponent(storyId)}/continue/progressive`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getGenerationJob(jobId) {
  return request(`/api/generation-jobs/${encodeURIComponent(jobId)}`);
}
