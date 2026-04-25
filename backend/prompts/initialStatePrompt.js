import { buildArchitecturePromptSection } from '../config/storyArchitecture.js';

export function buildInitialStatePrompt(userPrompt) {
  return `你是一个互动短剧策划器。

请根据用户输入的一句话脑洞，生成一个适合 H5 竖屏互动短剧的故事状态摘要。

要求：
1. 只返回纯 JSON。
2. 不要返回 Markdown。
3. 不要返回解释。
4. 不要生成完整剧情正文。
5. 故事适合 3-5 分钟短体验。
6. 风格要高冲突、强反转、短平快。
7. 不要包含违法、色情、过度血腥、政治敏感内容。
8. 必须使用下方短篇互动小说架构，选择一个 ending_lane 并写入 architecture。

用户脑洞：
${userPrompt}

${buildArchitecturePromptSection()}

返回格式：
{
  "title": "",
  "genre": "",
  "tone": "",
  "current_phase": "opening",
  "protagonist": {
    "name": "",
    "identity": "",
    "goal": ""
  },
  "characters": [],
  "facts": [],
  "open_threads": [],
  "constraints": [],
  "architecture": {
    "id": "micro_scene_locked_3_act",
    "name": "微场景锁结局三幕架构",
    "scene_lock": "单一核心场景，最多扩展到一个相邻小空间",
    "choice_contract": "玩家选择改变手段和代价，不改变结局走向",
    "ending_lane": "truth_reversal | price_escape | role_swap",
    "ending_promise": ""
  }
}`;
}
