import dotenv from 'dotenv';
dotenv.config();

import { callLLM } from './services/aiService.js';
import { buildStoryContentPrompt } from './prompts/storyContentPrompt.js';

async function run() {
  const prompt = buildStoryContentPrompt({ userPrompt: '假总裁，真逼婚', title: '假总裁勇闯逼婚局', synopsis: '年夜饭上，你带回一个假总裁男友，原想堵住亲戚逼婚的嘴，却发现表妹带回的真少爷竟是他失散多年的弟弟。', narrativeMode: 'web_novel' });
  
  const contentText = await callLLM({
    systemPrompt: '你是一个互动短剧策划器，只返回严格 JSON。',
    userPrompt: prompt,
    maxTokens: 2048,
    temperature: 1.0
  });

  console.log("----- LLM OUTPUT -----");
  console.log(contentText);
}

run().catch(console.error);
