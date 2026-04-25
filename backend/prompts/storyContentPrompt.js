/**
 * 第一层 Prompt：故事内容生成（第一幕）
 * 只生成纯文本片段，不涉及任何渲染相关字段
 *
 * 输入：用户脑洞
 * 输出：title + story_state + state_patch + content（4 个纯文本 fragments）
 */

export function buildStoryContentPrompt(userPrompt) {
  return `你是一个互动短剧策划器。

请根据用户输入的一句话脑洞，生成故事标题、故事状态摘要，以及第一幕互动剧情的纯文本内容。

重要：只返回纯 JSON，不要 Markdown，不要解释。

用户脑洞：
${userPrompt}

要求：
1. title 简短有冲突感，不超过 12 个字
2. story_state 只保存摘要，不要保存完整正文
3. characters、facts、open_threads、constraints 每项最多 2 条
4. content.phase = "opening"
5. content.fragments 固定生成 4 个片段，使用顺序 ID：片段0、片段1、片段2、片段3
6. 每个 fragment.text 控制在 60-120 字
7. 剧情节奏短平快，高冲突、强反转
8. 片段3（最后一个片段）必须是选择点（type = "choice_point"），options 包含 2 个具体动作文案
9. 其他片段为 type = "scene"，options 为 null
10. choices 动作文案示例：当众揭穿她的谎言、先假装妥协套出真相、要求调监控、拒绝妥协直接反击
11. 不要生成广告节点
12. 不要生成 __GENERATE_NEXT__
13. 不要包含违法、色情、过度血腥、政治敏感内容

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
    "constraints": []
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
      { "id": "片段0", "text": "开场场景，60-120字...", "type": "scene", "options": null },
      { "id": "片段1", "text": "冲突升级，60-120字...", "type": "scene", "options": null },
      { "id": "片段2", "text": "冲突继续，60-120字...", "type": "scene", "options": null },
      { "id": "片段3", "text": "选择点前奏，60-120字...", "type": "choice_point", "options": ["选项动作A", "选项动作B"] }
    ]
  }
}`;
}
