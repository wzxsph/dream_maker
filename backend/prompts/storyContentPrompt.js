/**
 * 第一层 Prompt：故事内容生成（第一幕）
 * 只生成纯文本片段，不涉及任何渲染相关字段
 *
 * 输入：用户脑洞
 * 输出：title + story_state + state_patch + content（4 个纯文本 fragments）
 */

import { buildArchitecturePromptSection } from '../config/storyArchitecture.js';

export function buildStoryContentPrompt(userPrompt) {
  return `你是一个互动短剧策划器。

请根据用户输入的一句话脑洞，生成故事标题、故事状态摘要，以及第一幕互动剧情的纯文本内容。

重要：只返回纯 JSON，不要 Markdown，不要解释。

用户脑洞：
${userPrompt}

${buildArchitecturePromptSection({ nextChunkIndex: 1 })}

要求：
1. title 简短有冲突感，不超过 12 个字
2. story_state 只保存摘要，不要保存完整正文，并必须包含 architecture 字段
3. characters、facts、open_threads、constraints 每项最多 2 条，避免角色膨胀
4. content.phase = "opening"
5. content.fragments 固定生成 4 个片段，使用顺序 ID：片段0、片段1、片段2、片段3
6. 每个 fragment.text 控制在 55-100 字
7. 第一幕必须发生在同一个小场景内，第一句就出现可见压力
8. 片段0 是开场行动选择点（type = "choice_point"），options 包含 2 个具体动作文案
9. 片段1 是选项A造成的直接后果，片段2 是选项B造成的直接后果，二者都为 type = "scene"
10. 片段3 是汇聚后的续写锁点（type = "choice_point"），options 包含 1-2 个具体动作文案，用于进入下一幕
11. choices 动作文案示例：当众揭穿她的谎言、先假装妥协套出真相、要求调监控、拒绝妥协直接反击
12. 不要生成广告节点
13. 不要生成 __GENERATE_NEXT__
14. 不要包含违法、色情、过度血腥、政治敏感内容
15. story_state.architecture.ending_lane 必须从 truth_reversal、price_escape、role_swap 中选择一个
16. 后续所有内容都必须服务于 story_state.architecture.ending_promise

第一幕节点 ID 映射规则（供后续转换层使用）：
- 片段0 → node_0
- 片段1 → node_1_a
- 片段2 → node_1_b
- 片段3 → node_2

返回格式：
{
  "title": "故事标题",
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
      { "id": "片段0", "text": "开场陷阱和第一选择，55-100字...", "type": "choice_point", "options": ["选项动作A", "选项动作B"] },
      { "id": "片段1", "text": "选项A的直接后果，55-100字...", "type": "scene", "options": null },
      { "id": "片段2", "text": "选项B的直接后果，55-100字...", "type": "scene", "options": null },
      { "id": "片段3", "text": "分支汇聚后的更大钩子，55-100字...", "type": "choice_point", "options": ["带着当前筹码追击下一幕"] }
    ]
  }
}`;
}
