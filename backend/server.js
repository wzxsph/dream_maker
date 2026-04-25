import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialStoryPipeline } from './services/initialStoryPipeline.js';
import { beginStoryPipeline } from './services/beginStoryPipeline.js';
import { continueStoryPipeline } from './services/continueStoryPipeline.js';
import { progressiveContinuePipeline } from './services/progressiveContinuePipeline.js';
import { loadStorySession, saveStorySession, ensureStoryDirectory } from './services/storageService.js';
import { syncStoryCards } from './services/storyCardService.js';
import { getGenerationJob } from './services/generationJobService.js';
import { httpError } from './utils/errors.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);

await ensureStoryDirectory();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post(
  '/api/stories',
  asyncRoute(async (req, res) => {
    const result = await initialStoryPipeline({
      userPrompt: req.body?.prompt
    });
    res.status(201).json(result);
  })
);

app.get(
  '/api/stories/:storyId',
  asyncRoute(async (req, res) => {
    const session = await loadStorySession(req.params.storyId);
    res.json(session);
  })
);

app.post(
  '/api/stories/:storyId/begin',
  asyncRoute(async (req, res) => {
    const session = await loadStorySession(req.params.storyId);

    if (!session) {
      throw httpError(404, '故事不存在');
    }

    // 标记用户已点击开始，后台生成继续
    if (session.status === 'intro') {
      session.status = 'countdown';
      await saveStorySession(session);
    }

    res.json({
      story_id: session.story_id,
      status: session.status,
      has_chunk: session.chunks.length > 0
    });
  })
);

app.get(
  '/api/stories/:storyId/cards',
  asyncRoute(async (req, res) => {
    const session = await loadStorySession(req.params.storyId);
    if (!Array.isArray(session.cards) || session.cards.length === 0) {
      syncStoryCards(session);
    }
    res.json({
      story_id: session.story_id,
      cards: session.cards || []
    });
  })
);

app.post(
  '/api/stories/:storyId/continue',
  asyncRoute(async (req, res) => {
    const result = await continueStoryPipeline({
      storyId: req.params.storyId,
      currentNodeId: req.body?.current_node_id,
      choiceContent: req.body?.choice_content,
      mode: req.body?.mode,
      intervention: req.body?.intervention
    });
    res.json(result);
  })
);

app.post(
  '/api/stories/:storyId/continue/progressive',
  asyncRoute(async (req, res) => {
    const result = await progressiveContinuePipeline({
      storyId: req.params.storyId,
      currentNodeId: req.body?.current_node_id,
      choiceContent: req.body?.choice_content,
      mode: req.body?.mode,
      intervention: req.body?.intervention
    });
    res.status(202).json(result);
  })
);

app.get('/api/generation-jobs/:jobId', (req, res) => {
  const job = getGenerationJob(req.params.jobId);

  if (!job) {
    res.status(404).json({ message: '生成任务不存在或已过期' });
    return;
  }

  res.json({
    job_id: job.job_id,
    status: job.status,
    result: job.result,
    error: job.error,
    created_at: job.created_at,
    updated_at: job.updated_at
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  console.error(err);
  res.status(status).json({
    message: status >= 500 ? err.message || '服务异常' : err.message
  });
});

app.listen(port, () => {
  console.log(`Zaomeng server running at http://localhost:${port}`);
});
