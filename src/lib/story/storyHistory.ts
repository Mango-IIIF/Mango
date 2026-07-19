import type { StoryState } from '../core/types/story';

export type StoryHistory = {
  push: (story: StoryState) => void;
  undo: (current: StoryState) => StoryState | null;
  redo: (current: StoryState) => StoryState | null;
  reset: (story: StoryState) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

const cloneStory = (story: StoryState): StoryState => {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(story);
    }
  } catch {
    // Fall back to JSON serialization if story is a reactive proxy or has non-cloneable internals
  }
  return JSON.parse(JSON.stringify(story));
};

export const createStoryHistory = (initial: StoryState, maxEntries = 100): StoryHistory => {
  const past: StoryState[] = [];
  const future: StoryState[] = [];
  let current = cloneStory(initial);

  return {
    push: (story: StoryState) => {
      past.push(cloneStory(current));
      if (past.length > maxEntries) {
        past.shift();
      }
      current = cloneStory(story);
      future.length = 0;
    },
    undo: (latest: StoryState) => {
      if (past.length === 0) return null;
      future.push(cloneStory(latest));
      current = past.pop() as StoryState;
      return cloneStory(current);
    },
    redo: (latest: StoryState) => {
      if (future.length === 0) return null;
      past.push(cloneStory(latest));
      current = future.pop() as StoryState;
      return cloneStory(current);
    },
    reset: (story: StoryState) => {
      past.length = 0;
      future.length = 0;
      current = cloneStory(story);
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
};
