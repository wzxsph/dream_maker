import { buildDefaultArchitectureState } from '../config/storyArchitecture.js';

function buildMockTitle(userPrompt) {
  if (/假千金|重生|楼梯/.test(userPrompt)) {
    return '真千金重生：踢碎反派光环';
  }
  if (/心声|系统/.test(userPrompt)) {
    return '心声觉醒：听见命运后台';
  }
  if (/宿舍|午夜|敲门/.test(userPrompt)) {
    return '午夜门响：别回头';
  }
  return '命运改写局';
}

export function buildMockInitialState(userPrompt) {
  return {
    title: buildMockTitle(userPrompt),
    genre: 'interactive_reversal',
    tone: '高冲突、强反转、短平快、爽感明确',
    current_phase: 'opening',
    protagonist: {
      name: '许晚',
      identity: '被命运错置的主角',
      goal: '抓住第二次机会，改写被安排好的结局'
    },
    characters: [
      {
        name: '林婉儿',
        role: '伪装柔弱的对手',
        status: '正在制造误会，试图把主角推回原剧情'
      },
      {
        name: '顾沉',
        role: '被误导的关键见证人',
        status: '暂时站在对手一边'
      }
    ],
    facts: [`用户脑洞：${userPrompt}`, '主角在命运转折点醒来，旧剧情即将重演'],
    open_threads: ['对手真正的计划尚未公开', '监控和现场证词能否形成完整证据链'],
    constraints: ['不要推翻已发生事实', '每段剧情保持高冲突和强反转', '结局必须在第三段收束'],
    architecture: buildDefaultArchitectureState(userPrompt)
  };
}

export function buildMockInitialChunk() {
  return {
    state_patch: {
      current_phase: 'opening_conflict',
      facts_add: ['主角在危险发生前一秒醒来'],
      open_threads_add: ['主角是否能当场扭转被陷害的局面'],
      open_threads_resolved: [],
      characters_update: []
    },
    chunk: {
      chunk_id: 'chunk_1',
      chunk_index: 1,
      type: 'opening',
      start_node: 'node_0',
      end_nodes: ['node_2'],
      nodes: {
        node_0: {
          node_id: 'node_0',
          text: '一阵刺目的白光划过，你猛地睁开眼。楼梯边缘近在脚下，林婉儿的手正伸向你，脸上却已经摆出受害者的表情。上一世，你就是从这里跌下去，失去了一切。',
          bg_theme: 'light',
          ui_effect: ['flash_white'],
          is_paywall: false,
          paywall_type: null,
          ad_config: null,
          is_rewrite_point: false,
          choices: [
            {
              content: '侧身避开，顺势抓住她的手腕',
              next_node: 'node_1_a'
            },
            {
              content: '不躲了，反手给她一个响亮耳光',
              next_node: 'node_1_b'
            }
          ]
        },
        node_1_a: {
          node_id: 'node_1_a',
          text: '你侧身一闪，林婉儿扑空，手腕被你稳稳扣住。她眼底的慌乱只出现了一瞬，下一秒就红着眼喊：“姐姐，你为什么要推我？”客厅里的脚步声立刻逼近。',
          bg_theme: 'dark',
          ui_effect: ['shake'],
          is_paywall: false,
          paywall_type: null,
          ad_config: null,
          is_rewrite_point: false,
          choices: [
            {
              content: '当众摊开她的手，让所有人看清动作',
              next_node: 'node_2'
            },
            {
              content: '先装作害怕，逼她继续表演',
              next_node: 'node_2'
            }
          ]
        },
        node_1_b: {
          node_id: 'node_1_b',
          text: '“啪！”清脆的声音砸进大厅。林婉儿捂着脸愣住，连眼泪都忘了掉。顾沉正好推门进来，看到这一幕，怒气瞬间压向你：“许晚，你疯了吗？”',
          bg_theme: 'danger',
          ui_effect: ['flash_red', 'shake'],
          is_paywall: false,
          paywall_type: null,
          ad_config: null,
          is_rewrite_point: false,
          choices: [
            {
              content: '冷笑反问：你只看见这一巴掌？',
              next_node: 'node_2'
            },
            {
              content: '把林婉儿拽到摄像头下',
              next_node: 'node_2'
            }
          ]
        },
        node_2: {
          node_id: 'node_2',
          text: '两条路都把你推回同一个焦点：墙角的摄像头还亮着红点。林婉儿的脸色终于变了，顾沉也迟疑地回头。就在真相快被撕开时，冰冷提示音响起：【检测到关键抉择点。】',
          bg_theme: 'danger',
          ui_effect: ['flash_red', 'glitch'],
          is_paywall: false,
          paywall_type: null,
          ad_config: null,
          is_rewrite_point: true,
          choices: [
            {
              content: '抓住监控红点继续追击',
              next_node: '__GENERATE_NEXT__'
            }
          ]
        }
      }
    }
  };
}
