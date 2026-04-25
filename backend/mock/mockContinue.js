function interventionLine(intervention) {
  if (!intervention) {
    return '你没有急着解释，而是顺着眼前的破绽继续逼近。';
  }
  return `你在心里写下新的命令：${intervention}。下一秒，这个改写开始在现实里生效。`;
}

export function buildMockContinueChunk({ nextChunkIndex, intervention = '', choiceContent = '' }) {
  if (nextChunkIndex === 2) {
    return buildMockChunk2({ intervention, choiceContent });
  }

  return buildMockChunk3({ intervention, choiceContent });
}

function buildMockChunk2({ intervention, choiceContent }) {
  const hasMindVoice = /心声|听见/.test(intervention);

  return {
    state_patch: {
      current_phase: 'middle_reversal',
      facts_add: [
        `玩家选择继续线索：${choiceContent || '进入下一幕'}`,
        intervention ? `玩家改写剧情：${intervention}` : '玩家选择自然续写当前剧情'
      ],
      open_threads_add: ['顾沉开始怀疑林婉儿', '世界意志准备强行修正剧情'],
      open_threads_resolved: ['主角是否能当场扭转被陷害的局面'],
      characters_update: [
        {
          name: '顾沉',
          role: '关键见证人',
          status: '开始动摇，但仍不愿承认自己被利用'
        }
      ]
    },
    chunk: {
      chunk_id: 'chunk_2',
      chunk_index: 2,
      type: 'middle',
      start_node: 'node_5',
      end_nodes: ['node_7'],
      nodes: {
        node_5: {
          node_id: 'node_5',
          text: `${interventionLine(intervention)}监控画面被投到墙上，林婉儿伸手推你的动作清清楚楚。${hasMindVoice ? '更可怕的是，你忽然听见她心里的尖叫：不可能，监控不是早就坏了吗？' : '她脸上的泪光僵住，像一张被撕开的假面。'}`,
          bg_theme: 'dark',
          ui_effect: ['glitch'],
          is_paywall: false,
          paywall_type: null,
          ad_config: null,
          is_rewrite_point: false,
          choices: [
            {
              content: '把监控声音也放出来',
              next_node: 'node_6_a'
            },
            {
              content: '盯着林婉儿，让她自己解释',
              next_node: 'node_6_b'
            }
          ]
        },
        node_6_a: {
          node_id: 'node_6_a',
          text: '音频被打开，林婉儿压低声音说的那句“只要她摔下去，所有人都会站在我这边”清晰传出。客厅瞬间死寂，顾沉的脸色一点点白了下去。',
          bg_theme: 'danger',
          ui_effect: ['flash_red', 'shake'],
          is_paywall: false,
          paywall_type: null,
          ad_config: null,
          is_rewrite_point: false,
          choices: [
            {
              content: '要求顾沉当场道歉',
              next_node: 'node_7'
            },
            {
              content: '直接报警，把证据发给所有人',
              next_node: 'node_7'
            }
          ]
        },
        node_6_b: {
          node_id: 'node_6_b',
          text: '林婉儿被你看得后退半步，却还想哭。你轻声提醒她：“这次，所有摄像头都开着。”她的哭声断在喉咙里，顾沉终于意识到自己从头到尾都站错了位置。',
          bg_theme: 'dark',
          ui_effect: ['glitch'],
          is_paywall: false,
          paywall_type: null,
          ad_config: null,
          is_rewrite_point: false,
          choices: [
            {
              content: '逼她说出幕后交易',
              next_node: 'node_7'
            },
            {
              content: '转身离开，让她自己崩盘',
              next_node: 'node_7'
            }
          ]
        },
        node_7: {
          node_id: 'node_7',
          text: '就在真相即将彻底公开时，世界忽然卡顿。刺耳警报在你脑海里炸开：【剧情权限被世界意志暂时锁定。】林婉儿的表情停在惊恐的一瞬，而你知道，下一步就是彻底反击。',
          bg_theme: 'danger',
          ui_effect: ['flash_red', 'glitch', 'shake'],
          is_paywall: true,
          paywall_type: 'preset_ad',
          ad_config: {
            title: '欢迎参加抖音 AI 创变者黑客松大赛',
            description: '用 AI 改写故事，用创意点亮下一幕。',
            duration: 5,
            button_text: '完成观看，返回剧情'
          },
          is_rewrite_point: false,
          choices: [
            {
              content: '趁世界恢复流动，继续追击真相',
              next_node: '__GENERATE_NEXT__'
            }
          ]
        }
      }
    }
  };
}

function buildMockChunk3({ intervention, choiceContent }) {
  return {
    state_patch: {
      current_phase: 'ending',
      facts_add: [
        `最终幕承接选择：${choiceContent || '使用命运反击卡'}`,
        intervention ? `改写影响延续到结局：${intervention}` : '主角以已有证据完成反击'
      ],
      open_threads_add: [],
      open_threads_resolved: ['顾沉开始怀疑林婉儿', '世界意志准备强行修正剧情', '对手真正的计划尚未公开'],
      characters_update: [
        {
          name: '林婉儿',
          role: '败露的对手',
          status: '失去所有伪装，必须面对证据'
        }
      ]
    },
    chunk: {
      chunk_id: 'chunk_3',
      chunk_index: 3,
      type: 'ending',
      start_node: 'node_8',
      end_nodes: ['node_10_ending'],
      nodes: {
        node_8: {
          node_id: 'node_8',
          text: '画面重新流动的一瞬，你手心浮现一张微光卡片，所有被篡改的记录同时恢复。聊天记录、转账凭证、删掉的视频，全都投在大厅的墙面上。',
          bg_theme: 'victory',
          ui_effect: ['success'],
          is_paywall: false,
          paywall_type: null,
          ad_config: null,
          is_rewrite_point: false,
          choices: [
            {
              content: '公开全部证据，让她无处可退',
              next_node: 'node_9_a'
            },
            {
              content: '只给她最后一次坦白机会',
              next_node: 'node_9_b'
            }
          ]
        },
        node_9_a: {
          node_id: 'node_9_a',
          text: '证据像雪崩一样砸下。林婉儿的哭腔彻底失效，顾沉当众道歉，许家人第一次沉默地看向你。你没有接受迟来的愧疚，只把属于自己的名字重新写回继承名单。',
          bg_theme: 'victory',
          ui_effect: ['success'],
          is_paywall: false,
          paywall_type: null,
          ad_config: null,
          is_rewrite_point: false,
          choices: [
            {
              content: '当众收回自己的名字',
              next_node: 'node_10_ending'
            }
          ]
        },
        node_9_b: {
          node_id: 'node_9_b',
          text: '你没有立刻毁掉她，而是按下暂停键。林婉儿看着墙上的证据，终于崩溃承认一切。那些曾经围观你坠落的人，此刻全都被迫听完真相。',
          bg_theme: 'victory',
          ui_effect: ['success'],
          is_paywall: false,
          paywall_type: null,
          ad_config: null,
          is_rewrite_point: false,
          choices: [
            {
              content: '亲手关闭这场审判',
              next_node: 'node_10_ending'
            }
          ]
        },
        node_10_ending: {
          node_id: 'node_10_ending',
          text: '夜色落下，你走出那栋困住你两世的房子。系统提示音最后一次响起：【命运改写完成。】这一次，故事不再替你安排结局。',
          bg_theme: 'victory',
          ui_effect: ['success'],
          is_paywall: false,
          paywall_type: null,
          ad_config: null,
          is_rewrite_point: false,
          choices: []
        }
      }
    }
  };
}
