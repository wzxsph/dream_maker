import dotenv from 'dotenv';

dotenv.config();

const PROVIDER_MINIMAX = 'minimax';
const PROVIDER_ANTHROPIC = 'anthropic';
const PROVIDER_OPENAI = 'openai';

export function hasApiKey() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY !== 'your_api_key_here');
}

function getProvider() {
  const provider = (process.env.AI_PROVIDER || '').toLowerCase();
  const baseUrl = process.env.AI_BASE_URL || '';

  if (provider) {
    return provider;
  }

  if (baseUrl.includes('/anthropic') || baseUrl.includes('minimaxi.com')) {
    return PROVIDER_MINIMAX;
  }

  return PROVIDER_OPENAI;
}

export async function callLLM({ systemPrompt, userPrompt, maxTokens, temperature, topP }) {
  if (!hasApiKey()) {
    const error = new Error('AI_API_KEY 未配置，当前应使用 mock AI');
    error.code = 'NO_AI_API_KEY';
    throw error;
  }

  const provider = getProvider();

  if (provider === PROVIDER_MINIMAX || provider === PROVIDER_ANTHROPIC) {
    return callAnthropicCompatible({ systemPrompt, userPrompt, maxTokens, temperature, topP });
  }

  return callOpenAiCompatible({ systemPrompt, userPrompt, maxTokens, temperature });
}

async function callOpenAiCompatible({ systemPrompt, userPrompt, maxTokens, temperature }) {
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: temperature ?? 0.8,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI 调用失败：${response.status} ${detail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI 返回为空');
  }

  return content;
}

async function callAnthropicCompatible({ systemPrompt, userPrompt, maxTokens, temperature, topP }) {
  const baseUrl = process.env.AI_BASE_URL || 'https://api.minimaxi.com/anthropic';
  const model = process.env.AI_MODEL || 'MiniMax-M2.7';
  let maxTokensVal = Number(maxTokens || process.env.AI_MAX_TOKENS || 2048);
  // MiniMax API 不接受 -1，当作 4096 处理
  if (maxTokensVal === -1) {
    maxTokensVal = 4096;
  }
  const payload = {
    model,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userPrompt
          }
        ]
      }
    ],
    max_tokens: maxTokensVal,
    temperature: Number(temperature ?? process.env.AI_TEMPERATURE ?? 1),
    top_p: Number(topP ?? process.env.AI_TOP_P ?? 0.95),
    stream: false
  };

  return callAnthropicMessages({
    baseUrl,
    payload,
    fallbackModel: model.endsWith('-highspeed') ? model.replace('-highspeed', '') : null
  });
}

async function callAnthropicMessages({ baseUrl, payload, fallbackModel = null }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text();

    if (fallbackModel && /not support model|不支持|2061/i.test(detail)) {
      return callAnthropicMessages({
        baseUrl,
        payload: {
          ...payload,
          model: fallbackModel
        }
      });
    }

    throw new Error(`MiniMax AI 调用失败：${response.status} ${detail}`);
  }

  const data = await response.json();
  console.log(`[callAnthropicMessages] raw data:`, JSON.stringify(data)?.substring(0, 500));
  const content = data?.content;
  const text = Array.isArray(content)
    ? content
        .filter((block) => block?.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
    : '';

  console.log(`[callAnthropicMessages] extracted text length: ${text?.length}, preview: ${text?.substring(0, 200)}`);

  if (!text) {
    throw new Error('MiniMax AI 返回为空');
  }

  return text;
}
