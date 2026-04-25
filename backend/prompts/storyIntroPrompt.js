/**
 * Layer 0：生成故事标题和简介
 * 用于用户阅读故事背景，同步后台执行 Layer 1/2
 *
 * 输入：用户脑洞
 * 输出：title + synopsis（简介）
 */

export function buildStoryIntroPrompt(userPrompt) {
  return `你是一个互动短剧策划器。

请根据用户输入的一句话脑洞，生成一个故事的标题和简介。

重要：只返回纯 JSON，不要 Markdown，不要解释。

用户脑洞：
${userPrompt}

要求：
1. title 简短有冲突感，不超过 12 个字
2. synopsis 100-150 字，交代故事背景、主角处境、核心冲突
3. synopsis 不要透露结局，保持悬念
4. 风格：高冲突、强反转、短平快
5. synopsis 格式：段落文字，不要分条列举
6. 不要包含违法、色情、过度血腥、政治敏感内容
7. synopsis 要把故事锁在一个明确小场景里，不铺大世界观，不跳时间线

返回格式：
{
  "title": "故事标题",
  "synopsis": "故事简介，100-150字，交代背景、处境和核心冲突，保持悬念..."
}`;
}
