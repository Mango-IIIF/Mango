import { describe, expect, it } from 'vitest';
import type { Story } from '../../core/types/story';
import { validateStory } from '../validation';

const baseStory = (): Story => ({
  version: '1.0',
  type: 'story',
  chapters: [
    {
      id: 'chapter-1',
      manifest: 'https://example.org/manifest.json',
      canvasIndex: 0,
      viewBox: { x: 0, y: 0, w: 10, h: 10 },
    },
  ],
});

describe('validateStory', () => {
  it('accepts valid stories', () => {
    const story = baseStory();
    const result = validateStory(story);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('requires at least one chapter', () => {
    const story: Story = {
      version: '1.0',
      type: 'story',
      chapters: [],
    };
    const result = validateStory(story);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Story: must have at least one chapter');
  });

  it('rejects invalid chapter captures', () => {
    const story = baseStory();
    story.chapters[0].viewBox = { x: 0, y: 0, w: 0, h: 10 };
    story.chapters[0].media = { start: 5, end: 2 };

    const result = validateStory(story);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('viewBox'))).toBe(true);
    expect(result.errors.some((error) => error.includes('media end'))).toBe(true);
  });

  it('rejects invalid placements', () => {
    const story = baseStory();
    story.chapters[0].annotations = {
      en: { text: 'Note', placement: { x: 2, y: -1, w: 3, h: 0 } as any },
    };

    const result = validateStory(story);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('invalid placement'))).toBe(
      true,
    );
  });
});
