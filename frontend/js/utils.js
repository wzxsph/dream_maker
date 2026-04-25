export function getStoryIdFromHash() {
  const match = window.location.hash.match(/^#\/story\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function currentNodeStorageKey(storyId) {
  return `zaomeng.currentNode.${storyId}`;
}

export function unlockedPaywallStorageKey(storyId, nodeId) {
  return `zaomeng.unlockedPaywall.${storyId}.${nodeId}`;
}
