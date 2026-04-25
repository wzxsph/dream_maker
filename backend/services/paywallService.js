const DEFAULT_AD_CONFIG = {
  title: '欢迎参加抖音 AI 创变者黑客松大赛',
  description: '用 AI 改写故事，用创意点亮下一幕。',
  duration: 5,
  button_text: '完成观看，返回剧情'
};

const DEFAULT_PAYWALL_STORY_TEXT =
  '就在真相即将继续推进时，周围的一切忽然停滞。刺耳的系统提示音响起：【剧情权限被世界意志暂时锁定。】你必须先解开这道限制，才能把下一幕推向真正的反击。';

export function ensurePaywallForChunk2(chunk) {
  if (chunk.chunk_index !== 2) {
    return chunk;
  }

  const nodes = chunk.nodes || {};
  const paywallNodes = Object.values(nodes).filter((node) => node.is_paywall);
  const target = paywallNodes[0] || nodes[(chunk.end_nodes || [])[0]] || Object.values(nodes).at(-1);

  if (!target) {
    return chunk;
  }

  if (!target.text || /广告|赞助展示|抖音 AI 创变者黑客松/.test(target.text)) {
    target.text = DEFAULT_PAYWALL_STORY_TEXT;
  }
  target.bg_theme = 'danger';
  target.ui_effect = ['flash_red', 'glitch', 'shake'];
  target.is_paywall = true;
  target.paywall_type = 'preset_ad';
  target.ad_config = {
    ...(target.ad_config || {}),
    ...DEFAULT_AD_CONFIG
  };
  target.is_rewrite_point = false;
  target.choices = [
    {
      content: '趁世界恢复流动，继续追击真相',
      next_node: '__GENERATE_NEXT__'
    }
  ];

  for (const node of paywallNodes.slice(1)) {
    node.is_paywall = false;
    node.paywall_type = null;
    node.ad_config = null;
  }

  if (!chunk.end_nodes.includes(target.node_id)) {
    chunk.end_nodes = [target.node_id];
  }

  return chunk;
}

export function stripPaywallsOutsideChunk2(chunk) {
  if (chunk.chunk_index === 2) {
    return chunk;
  }

  for (const node of Object.values(chunk.nodes || {})) {
    node.is_paywall = false;
    node.paywall_type = null;
    node.ad_config = null;
  }

  return chunk;
}
