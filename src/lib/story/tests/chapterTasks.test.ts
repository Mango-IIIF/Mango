import { describe, expect, it } from 'vitest';
import type { StoryState } from '../../core/types/story';
import {
  evaluateChapterTasks,
  evaluateTaskAvailability,
  evaluateTaskStatus,
} from '../chapterTasks';

const story: StoryState = {
  chapters: [
    {
      id: 'one',
      manifest: 'https://example.org/manifest',
      canvasIndex: 0,
      viewBox: { x: 0, y: 0, w: 100, h: 100 },
      title: { en: 'One', cy: 'Un' },
      description: { en: 'First' },
    },
    {
      id: 'two',
      manifest: 'https://example.org/manifest',
      canvasIndex: 0,
      viewBox: { x: 10, y: 10, w: 50, h: 50 },
    },
  ],
};

const context = (chapterIndex = 0) => ({
  story,
  chapter: story.chapters[chapterIndex],
  chapterIndex,
  mediaType: 'image' as const,
  languages: ['en', 'cy'],
  layers: [],
});

describe('chapter task evaluation', () => {
  it('reports configuration separately from translation coverage', () => {
    expect(evaluateTaskStatus('details', context())).toEqual({
      completion: 'partial',
      translated: 1,
      languageTotal: 2,
      messages: [],
    });
  });

  it('explains unavailable but useful tasks', () => {
    expect(evaluateTaskAvailability('layers', context())).toMatchObject({
      state: 'disabled',
      reason: expect.any(String),
      action: expect.any(String),
    });
    expect(evaluateTaskAvailability('comparison', context())).toMatchObject({
      state: 'disabled',
      action: 'Load another compatible source.',
    });
  });

  it('only exposes source media timing for audio and video canvases', () => {
    expect(evaluateTaskAvailability('media-timing', context())).toEqual({ state: 'hidden' });
    expect(
      evaluateTaskAvailability('media-timing', { ...context(), mediaType: 'audio' }),
    ).toEqual({ state: 'available' });
    expect(
      evaluateTaskAvailability('media-timing', { ...context(), mediaType: 'video' }),
    ).toEqual({ state: 'available' });
  });

  it('makes motion available for any chapter with a spatial capture', () => {
    expect(evaluateTaskAvailability('motion', context(0)).state).toBe('available');
    expect(evaluateTaskAvailability('motion', context(1)).state).toBe('available');
  });

  it('does not count a newly captured view as a partially configured annotation', () => {
    expect(evaluateTaskStatus('focus', context(1))).toEqual({
      completion: 'empty',
      messages: [],
    });
  });

  it('only reports partial annotations when authored text is missing its placement', () => {
    const chapter = story.chapters[1];
    expect(
      evaluateTaskStatus('focus', {
        ...context(1),
        chapter: { ...chapter, annotations: { en: { text: 'Unplaced annotation' } } },
      }).completion,
    ).toBe('partial');
    expect(
      evaluateTaskStatus('focus', {
        ...context(1),
        chapter: {
          ...chapter,
          drawingAnnotations: [{ id: 'point-1', type: 'point', point: { x: 10, y: 20 } }],
        },
      }).completion,
    ).toBe('complete');
  });

  it('returns all dashboard tasks in the agreed order', () => {
    expect(evaluateChapterTasks(context()).map((task) => task.id)).toEqual([
      'details',
      'focus',
      'motion',
      'audio-timing',
      'media-timing',
      'layers',
      'comparison',
      'source',
    ]);
  });
});
