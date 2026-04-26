/**
 * 第一层 Prompt：故事内容生成（第一幕）
 * 只生成纯文本片段，不涉及任何渲染相关字段
 *
 * 输入：Layer 0 的 title + synopsis，用户脑洞仅作兜底约束
 * 输出：story_state + state_patch + content（4 个纯文本 fragments）
 */

import { buildArchitecturePromptSection } from '../config/storyArchitecture.js';

export function buildStoryContentPrompt(input) {
  const payload = typeof input === 'string' ? { userPrompt: input } : input || {};
  const title = payload.title || '命运改写局';
  const synopsis = payload.synopsis || '';
  const userPrompt = payload.userPrompt || '';

  return `你是一个互动短剧策划器。

请根据 Layer 0 已确定的标题和简介，生成第一幕互动剧情的纯文本片段。

只返回 JSON，不要 Markdown，不要解释。

标题：
${title}

简介：
${synopsis}

原始脑洞：
${userPrompt}

${buildArchitecturePromptSection({ nextChunkIndex: 1 })}

要求：
1. 严格承接标题和简介，不要另起故事。
2. 第一幕锁在同一小场景，第一句就给可见压力。
3. content.fragments 固定 4 个片段：片段0、片段1、片段2、片段3。
4. 每个 fragment.text 55-100 字。
5. 片段0 是开场选择点，options 给 2 个具体动作。
6. 片段1/2 分别是 A/B 的直接后果。
7. 片段3 是分支汇合后的更大钩子，options 给 1 个进入下一幕的具体动作。
8. 不要写广告，不要写 __GENERATE_NEXT__。
9. story_state 只保存摘要；characters、facts、open_threads、constraints 每项最多 2 条。
10. story_state.architecture.ending_lane 只能是 truth_reversal、price_escape、role_swap。

返回格式：
{
  "story_state": {
    "genre": "流派",
    "tone": "基调",
    "current_phase": "opening",
    "protagonist": { "name": "", "identity": "", "goal": "" },
    "characters": [],
    "facts": [],
    "open_threads": [],
    "constraints": [],
    "architecture": {
      "id": "micro_scene_locked_3_act",
      "name": "微场景锁结局三幕架构",
      "scene_lock": "单一核心场景，最多扩展到一个相邻小空间",
      "time_lock": "10-30 分钟",
      "cast_limit": "最多 3 个有姓名角色",
      "choice_contract": "玩家选择改变手段、代价、谁先暴露，不改变结局走向",
      "ending_lane": "truth_reversal | price_escape | role_swap",
      "ending_promise": "该结局走向的一句话承诺"
    }
  },
  "state_patch": {
    "current_phase": "opening_conflict",
    "facts_add": [],
    "open_threads_add": [],
    "open_threads_resolved": [],
    "characters_update": []
  },
  "content": {
    "phase": "opening",
    "fragments": [
      { "id": "片段0", "text": "", "type": "choice_point", "options": ["", ""] },
      { "id": "片段1", "text": "", "type": "scene", "options": null },
      { "id": "片段2", "text": "", "type": "scene", "options": null },
      { "id": "片段3", "text": "", "type": "choice_point", "options": [""] }
    ]
  }
}`;
}
