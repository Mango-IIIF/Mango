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
    expect(evaluateTaskAvailability('media-timing', { ...context(), mediaType: 'audio' })).toEqual({
      state: 'available',
    });
    expect(evaluateTaskAvailability('media-timing', { ...context(), mediaType: 'video' })).toEqual({
      state: 'available',
    });
  });

  it('disables annotations for audio, video, and 3D chapters', () => {
    for (const mediaType of ['audio', 'video', 'model'] as const) {
      expect(evaluateTaskAvailability('focus', { ...context(), mediaType })).toMatchObject({
        state: 'disabled',
        reason: 'Annotations are available for image and PDF chapters only.',
      });
    }

    expect(
      evaluateTaskAvailability('focus', {
        ...context(),
        mediaType: null,
        chapter: {
          ...story.chapters[0],
          model: { orbit: '0deg 75deg 2m' },
        },
      }),
    ).toMatchObject({ state: 'disabled' });
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

  it('keeps narration and chapter transition configuration independent', () => {
    const chapter = {
      ...story.chapters[0],
      advance: { mode: 'auto' as const, delayMs: 3000 },
    };
    const taskContext = { ...context(), chapter };

    expect(evaluateTaskStatus('audio-timing', taskContext).completion).toBe('empty');
    expect(evaluateTaskStatus('transition-timing', taskContext).completion).toBe('complete');
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

  it('offers viewer position for spatial chapters and explains it otherwise', () => {
    expect(evaluateTaskAvailability('position', context())).toEqual({
      state: 'available',
    });
    expect(evaluateTaskStatus('position', context()).completion).toBe('complete');
    expect(
      evaluateTaskStatus('position', {
        ...context(),
        chapter: { id: 'bare', manifest: 'https://example.org/manifest', canvasIndex: 0 },
      }).completion,
    ).toBe('empty');
    expect(
      evaluateTaskAvailability('position', { ...context(), mediaType: 'audio' }),
    ).toMatchObject({ state: 'disabled', reason: expect.any(String) });
  });

  it('routes viewBox validation to viewer position rather than annotations', () => {
    const messages = ['Chapter 1: viewBox width/height must be > 0'];
    expect(
      evaluateTaskStatus('position', { ...context(), validationErrors: messages }),
    ).toMatchObject({ completion: 'attention', messages });
    expect(
      evaluateTaskStatus('focus', { ...context(), validationErrors: messages }).messages,
    ).toEqual([]);
  });

  it('returns all dashboard tasks in the agreed order', () => {
    expect(evaluateChapterTasks(context()).map((task) => task.id)).toEqual([
      'source',
      'transition-timing',
      'details',
      'position',
      'audio-timing',
      'focus',
      'motion',
      'layers',
      'comparison',
      'media-timing',
    ]);
  });
});

describe('the frame task', () => {
  /*
   * The frame is an object on the canvas, so the task never has a live view
   * to compare against: a chapter with a usable frame is configured, full
   * stop. The drift warning this used to raise only made sense while framings
   * were captured from the camera.
   */
  it('is configured whenever the chapter has a usable frame', () => {
    const status = evaluateTaskStatus('position', context());
    expect(status.completion).toBe('complete');
    expect(status.labelKey).toBeUndefined();
  });

  it('reports a missing frame as unconfigured and a degenerate one as attention', () => {
    expect(
      evaluateTaskStatus('position', {
        ...context(),
        chapter: { ...story.chapters[0], viewBox: undefined },
      }).completion,
    ).toBe('empty');
    expect(
      evaluateTaskStatus('position', {
        ...context(),
        chapter: { ...story.chapters[0], viewBox: { x: 0, y: 0, w: 0, h: 100 } },
      }).completion,
    ).toBe('attention');
  });
});
