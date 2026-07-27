import { describe, expect, it } from 'vitest';
import { createStoryHistory } from '../storyHistory';
import type { StoryState } from '../../core/types/story';

const storyWith = (...ids: string[]): StoryState => ({
  chapters: ids.map((id, canvasIndex) => ({
    id,
    manifest: `https://example.org/${id}`,
    canvasIndex,
  })),
});

describe('storyHistory', () => {
  it('undoes and redoes successive checkpoints in order', () => {
    const initial = storyWith('a');
    const afterFirstChange = storyWith('a', 'b');
    const afterSecondChange = storyWith('a', 'b', 'c');
    const history = createStoryHistory(initial);

    history.push(initial);
    history.push(afterFirstChange);

    expect(history.undo(afterSecondChange)?.chapters.map((chapter) => chapter.id)).toEqual([
      'a',
      'b',
    ]);
    expect(history.undo(afterFirstChange)?.chapters.map((chapter) => chapter.id)).toEqual(['a']);
    expect(history.redo(initial)?.chapters.map((chapter) => chapter.id)).toEqual(['a', 'b']);
  });
});
