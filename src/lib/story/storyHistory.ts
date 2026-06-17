import type { Story } from '../core/types/story';

export type StoryHistory = {
  push: (story: Story) => void;
  undo: (current: Story) => Story | null;
  redo: (current: Story) => Story | null;
  reset: (story: Story) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

const cloneStory = (story: Story): Story => {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(story);
    }
  } catch {
    // Fall back to JSON serialization if story is a reactive proxy or has non-cloneable internals
  }
  return JSON.parse(JSON.stringify(story));
};

export const createStoryHistory = (initial: Story, maxEntries = 100): StoryHistory => {
  const past: Story[] = [];
  const future: Story[] = [];
  let current = cloneStory(initial);

  return {
    push: (story: Story) => {
      past.push(cloneStory(current));
      if (past.length > maxEntries) {
        past.shift();
      }
      current = cloneStory(story);
      future.length = 0;
    },
    undo: (latest: Story) => {
      if (past.length === 0) return null;
      future.push(cloneStory(latest));
      current = past.pop() as Story;
      return cloneStory(current);
    },
    redo: (latest: Story) => {
      if (future.length === 0) return null;
      past.push(cloneStory(latest));
      current = future.pop() as Story;
      return cloneStory(current);
    },
    reset: (story: Story) => {
      past.length = 0;
      future.length = 0;
      current = cloneStory(story);
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
};
