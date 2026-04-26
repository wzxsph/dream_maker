function safeList(values, limit = 4) {
  return Array.isArray(values) ? values.filter(Boolean).slice(0, limit) : [];
}

function card(id, type, title, content) {
  return {
    id,
    type,
    title,
    content,
    updated_at: new Date().toISOString()
  };
}

export function buildStoryCards({ userPrompt, title, storyState }) {
  const protagonist = storyState?.protagonist || {};
  const characters = safeList(storyState?.characters, 3);
  const architecture = storyState?.architecture || {};

  return [
    card('card_seed', 'idea_seed', '初始脑洞', {
      prompt: userPrompt,
      title
    }),
    card('card_premise', 'premise', '故事卖点', {
      genre: storyState?.genre || '',
      tone: storyState?.tone || '',
      core_hook: safeList(storyState?.facts, 2).join('；'),
      open_threads: safeList(storyState?.open_threads, 3)
    }),
    card('card_protagonist', 'protagonist', protagonist.name || '主角', {
      name: protagonist.name || '主角',
      identity: protagonist.identity || '',
      goal: protagonist.goal || '',
      current_phase: storyState?.current_phase || 'opening'
    }),
    ...characters.map((character, index) =>
      card(`card_character_${index + 1}`, 'character', character.name || `角色${index + 1}`, character)
    ),
    card('card_architecture', 'architecture', '互动小说架构', {
      name: architecture.name || '微场景锁结局三幕架构',
      scene_lock: architecture.scene_lock || '单一核心场景',
      choice_contract: architecture.choice_contract || '伪开放式选择，分支改变手段和代价',
      ending_lane: architecture.ending_lane || 'truth_reversal',
      ending_promise: architecture.ending_promise || ''
    }),
    card('card_style_guide', 'style_guide', '短剧写作指南', {
      pacing: '每个节点先给可见压力，再给信息差、反转或强情绪推进',
      choice_rule: '普通节点必须提供具体动作二选一，禁止只写“继续”',
      scene_rule: '不跳地点、不跳时间、不切换主视角，始终围绕小场景内的即时危机',
      logic_rule: '新事实必须来自已出现的人、物件、动机或伏笔，禁止天降权威、万能证据和无因反转',
      webnovel_rule: '主角主动抓证据和借规则反击，压力源有自保动机，爽点要逐步累积且符合常识',
      ad_rule: '第二幕末尾插入一次抖音 AI 创变者黑客松大赛 demo 广告',
      constraints: safeList(storyState?.constraints, 4)
    })
  ];
}

export function syncStoryCards(session) {
  const seedCard = (session.cards || []).find((item) => item.id === 'card_seed');
  session.cards = buildStoryCards({
    userPrompt: seedCard?.content?.prompt || session.story_state?.facts?.[0] || '',
    title: session.title,
    storyState: session.story_state
  });
  return session.cards;
}

export function compactStoryCards(cards = []) {
  return cards.map((item) => ({
    type: item.type,
    title: item.title,
    content: item.content
  }));
}
