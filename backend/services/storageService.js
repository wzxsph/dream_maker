import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storiesDir = path.join(__dirname, '..', 'stories');

function assertSafeStoryId(storyId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(storyId || '')) {
    throw httpError(400, 'story_id 不合法');
  }
}

export async function ensureStoryDirectory() {
  await fs.mkdir(storiesDir, { recursive: true });
}

export async function saveStorySession(session) {
  assertSafeStoryId(session.story_id);
  await ensureStoryDirectory();
  session.updated_at = new Date().toISOString();
  const filepath = path.join(storiesDir, `${session.story_id}.json`);
  await fs.writeFile(filepath, JSON.stringify(session, null, 2), 'utf8');
  return session;
}

export async function loadStorySession(storyId) {
  assertSafeStoryId(storyId);
  await ensureStoryDirectory();
  const filepath = path.join(storiesDir, `${storyId}.json`);

  try {
    const content = await fs.readFile(filepath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw httpError(404, '这个故事不存在或已被删除');
    }
    throw error;
  }
}

export async function listStorySessions() {
  await ensureStoryDirectory();
  const files = await fs.readdir(storiesDir);
  const sessions = [];

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }
    const content = await fs.readFile(path.join(storiesDir, file), 'utf8');
    sessions.push(JSON.parse(content));
  }

  return sessions;
}
