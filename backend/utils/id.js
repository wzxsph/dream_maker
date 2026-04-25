import { nanoid } from 'nanoid';

export function generateStoryId() {
  return `story_${nanoid(10)}`;
}
