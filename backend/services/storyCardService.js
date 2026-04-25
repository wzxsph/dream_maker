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
  const characters = safeList(storyState?.characters, 4);

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
    card('card_style_guide', 'style_guide', '短剧写作指南', {
      pacing: '每 1-2 个节点出现一次信息差、反转或强情绪推进',
      choice_rule: '普通节点必须提供具体动作二选一，禁止只写“继续”',
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
