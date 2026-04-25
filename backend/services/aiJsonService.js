import { callLLM } from './aiService.js';
import { safeJsonParse } from '../utils/json.js';
import { buildRepairPrompt } from '../prompts/repairPrompt.js';

export async function parseAndValidateAiJson(rawText, validate) {
  const parsed = safeJsonParse(rawText);

  try {
    if (!parsed) {
      throw new Error('AI 返回不是有效 JSON');
    }
    validate(parsed);
    return parsed;
  } catch (firstError) {
    const repairedText = await callLLM({
      systemPrompt: '你是 JSON 修复器，只能返回 JSON。',
      userPrompt: buildRepairPrompt({
        invalidJsonText: rawText,
        errors: firstError.message
      })
    });

    const repaired = safeJsonParse(repairedText);
    if (!repaired) {
      throw firstError;
    }

    validate(repaired);
    return repaired;
  }
}
