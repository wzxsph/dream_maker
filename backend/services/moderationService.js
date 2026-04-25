import { httpError } from '../utils/errors.js';

const forbiddenWords = ['未成年性', '色情服务', '毒品交易', '违法交易', '政治敏感'];

function normalizeText(text) {
  return String(text || '').trim();
}

function rejectForbidden(text) {
  for (const word of forbiddenWords) {
    if (text.includes(word)) {
      throw httpError(400, '内容包含不适合生成的词汇');
    }
  }
}

export function validateUserPrompt(prompt) {
  const value = normalizeText(prompt);

  if (!value) {
    throw httpError(400, '请输入一句脑洞');
  }

  if (value.length > 200) {
    throw httpError(400, '脑洞最多 200 字');
  }

  rejectForbidden(value);
  return value;
}

export function validateIntervention(intervention) {
  const value = normalizeText(intervention);

  if (!value) {
    throw httpError(400, '改写内容不能为空');
  }

  if (value.length > 100) {
    throw httpError(400, '改写内容最多 100 字');
  }

  rejectForbidden(value);
  return value;
}

export function moderateGeneratedText(text) {
  rejectForbidden(normalizeText(text));
}

export function moderateChunk(chunk) {
  for (const node of Object.values(chunk.nodes || {})) {
    moderateGeneratedText(node.text);
    for (const choice of node.choices || []) {
      moderateGeneratedText(choice.content);
    }
  }
}
