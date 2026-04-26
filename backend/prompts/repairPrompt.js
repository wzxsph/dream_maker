export function buildRepairPrompt({ invalidJsonText, errors }) {
  return `你上一次返回的 JSON 不符合要求。

错误如下：
${errors}

请修复 JSON。

要求：
1. 只返回修复后的纯 JSON。
2. 不要返回 Markdown。
3. 不要返回解释。
4. 不要改变故事主题。
5. 保持原有剧情大意。
6. 修复所有结构错误、节点跳转错误和字段错误。
7. 不要新增无铺垫的关键人物、关键证据或权威救场。
8. 如需补 choices 文案，必须写具体动作，且符合当前小场景因果。

原始 JSON：
${invalidJsonText}`;
}
