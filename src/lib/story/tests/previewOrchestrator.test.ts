import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import type { Story } from '../../core/types/story';
import {
  createStoryPreviewOrchestrator,
  getPreviewChapterDuration,
} from '../previewOrchestrator';

const story: Story = {
  version: '1.0',
  type: 'story',
  chapters: [{
    id: 'chapter-1',
    manifest: 'manifest',
    canvasIndex: 0,
    media: { start: 1, end: 3 },
    advance: { mode: 'auto', delayMs: 500 },
  }],
};

describe('story preview orchestration', () => {
  it('owns sequential selection, application, and completion', async () => {
    const selectChapter = vi.fn();
    const applyChapter = vi.fn();
    const wait = vi.fn(async () => undefined);
    const preview = createStoryPreviewOrchestrator({
      getStory: () => story,
      selectChapter,
      applyChapter,
      getNarrationSegment: () => ({ start: 0, end: 1 }),
      closeEditors: vi.fn(),
      stopPlayback: vi.fn(),
      wait,
    });

    await preview.start();

    expect(selectChapter).toHaveBeenCalledWith('chapter-1');
    expect(applyChapter).toHaveBeenCalledWith(story.chapters[0]);
    expect(wait).toHaveBeenNthCalledWith(1, 300);
    expect(wait).toHaveBeenNthCalledWith(2, 3500);
    expect(get(preview.isPreviewing)).toBe(false);
  });

  it('uses a visible default duration for silent chapters', () => {
    expect(getPreviewChapterDuration({
      id: 'silent',
      manifest: 'manifest',
      canvasIndex: 0,
    }, null)).toBe(2000);
  });
});
