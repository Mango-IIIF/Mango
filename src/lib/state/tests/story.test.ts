import { describe, expect, it } from 'vitest';
import type { Story } from '../../core/types/story';
import type { ViewBox } from '../../core/types/viewer';
import {
  addChapterFromCapture,
  createEmptyStory,
  createStoryStore,
  deleteChapter,
  reorderChapter,
  setChapterManifest,
  setAdvanceMode,
  setAnnotationPlacement,
  setAnnotationText,
  setDelay,
  setNarrationSegment,
  setNarrationTrack,
  updateChapterFromCapture,
} from '../story.svelte';

const viewBox = (w = 100, h = 80): ViewBox => ({ x: 0, y: 0, w, h });
const placement = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

const createStoryWithChapters = (): Story => ({
  version: '1.0',
  type: 'story',
  narration: {
    tracks: {
      en: { src: 'https://example.org/en.mp3' },
      cy: { src: 'https://example.org/cy.mp3' },
    },
  },
  chapters: [
    {
      id: 'chapter-a',
      manifest: 'https://example.org/manifest-a.json',
      canvasIndex: 0,
      viewBox: viewBox(),
      annotationPlacement: placement(0.1, 0.1, 0.3, 0.3),
      annotations: {
        en: { text: 'Hello', placement: placement(0.1, 0.1, 0.3, 0.3) },
        cy: { text: 'Shwmae', placement: placement(0.6, 0.6, 0.3, 0.3) },
      },
      narrationSegment: {
        en: { start: 2, end: 5 },
      },
      advance: {
        mode: 'manual',
        delayMs: 1500,
      },
    },
    {
      id: 'chapter-b',
      manifest: 'https://example.org/manifest-b.json',
      canvasIndex: 3,
      viewBox: viewBox(200, 120),
    },
  ],
});

describe('story reducers', () => {
  it('adds chapters immutably from capture', () => {
    const story = createEmptyStory();
    const next = addChapterFromCapture(story, {
      id: 'chapter-1',
      capture: {
        manifest: 'https://example.org/manifest.json',
        canvasIndex: 1,
        viewBox: viewBox(50, 60),
      },
    });

    expect(next).not.toBe(story);
    expect(story.chapters).toHaveLength(0);
    expect(next.chapters).toHaveLength(1);
    expect(next.chapters[0]).toMatchObject({
      id: 'chapter-1',
      manifest: 'https://example.org/manifest.json',
      canvasIndex: 1,
    });
    expect(next.chapters[0].viewBox).toEqual(viewBox(50, 60));
  });

  it('adds media chapters with start and end times', () => {
    const story = createEmptyStory();
    const next = addChapterFromCapture(story, {
      id: 'chapter-media',
      capture: {
        manifest: 'https://example.org/manifest.json',
        canvasIndex: 0,
        media: { start: 12.5, end: 18.75 },
      },
    });

    expect(next.chapters[0].media).toEqual({ start: 12.5, end: 18.75 });
    expect(next.chapters[0].viewBox).toBeUndefined();
  });

  it('adds model chapters with pose data', () => {
    const story = createEmptyStory();
    const next = addChapterFromCapture(story, {
      id: 'chapter-model',
      capture: {
        manifest: 'https://example.org/manifest.json',
        canvasIndex: 1,
        model: {
          cameraOrbit: '45deg 30deg 2m',
          cameraTarget: '0m 1m 0m',
          orientation: '0deg 0deg 0deg',
        },
      },
    });

    expect(next.chapters[0].model).toEqual({
      cameraOrbit: '45deg 30deg 2m',
      cameraTarget: '0m 1m 0m',
      orientation: '0deg 0deg 0deg',
    });
    expect(next.chapters[0].viewBox).toBeUndefined();
    expect(next.chapters[0].media).toBeUndefined();
  });

  it('updates capture while keeping overlays intact', () => {
    const story = createStoryWithChapters();
    const next = updateChapterFromCapture(story, {
      chapterId: 'chapter-a',
      capture: {
        manifest: 'https://example.org/manifest-a.json',
        canvasIndex: 2,
        media: { start: 4, end: 9 },
      },
    });

    const updated = next.chapters[0];
    expect(updated).not.toBe(story.chapters[0]);
    expect(updated.media).toEqual({ start: 4, end: 9 });
    expect(updated.viewBox).toBeUndefined();
    expect(updated.annotations).toEqual(story.chapters[0].annotations);
    expect(updated.narrationSegment).toEqual(story.chapters[0].narrationSegment);
    expect(updated.advance).toEqual(story.chapters[0].advance);
  });

  it('overwrites viewBox when updating capture', () => {
    const story = createStoryWithChapters();
    const next = updateChapterFromCapture(story, {
      chapterId: 'chapter-a',
      capture: {
        manifest: 'https://example.org/manifest-a.json',
        canvasIndex: 1,
        viewBox: { x: 10, y: 20, w: 50, h: 60 },
      },
    });

    expect(next.chapters[0].viewBox).toEqual({ x: 10, y: 20, w: 50, h: 60 });
    expect(next.chapters[0].media).toBeUndefined();
    expect(next.chapters[0].model).toBeUndefined();
  });

  it('keeps language overlays isolated for annotations', () => {
    const story = createStoryWithChapters();
    const next = setAnnotationText(story, {
      chapterId: 'chapter-a',
      language: 'en',
      text: 'Updated',
    });

    expect(next.chapters[0]).not.toBe(story.chapters[0]);
    expect(next.chapters[0].annotations).not.toBe(story.chapters[0].annotations);
    expect(next.chapters[0].annotations?.en?.text).toBe('Updated');
    expect(next.chapters[0].annotations?.en?.placement).toEqual(placement(0.1, 0.1, 0.3, 0.3));
    expect(next.chapters[0].annotations?.cy).toEqual(story.chapters[0].annotations?.cy);
    expect(next.chapters[1]).toBe(story.chapters[1]);
  });

  it('keeps language overlays isolated for narration segments', () => {
    const story = createStoryWithChapters();
    const next = setNarrationSegment(story, {
      chapterId: 'chapter-a',
      language: 'cy',
      start: 10,
      end: 12,
    });

    expect(next.chapters[0]).not.toBe(story.chapters[0]);
    expect(next.chapters[0].narrationSegment?.cy).toEqual({ start: 10, end: 12 });
    expect(next.chapters[0].narrationSegment?.en).toEqual(
      story.chapters[0].narrationSegment?.en,
    );
  });

  it('assigns narration segments to the selected chapter and language', () => {
    const story = createStoryWithChapters();
    const next = setNarrationSegment(story, {
      chapterId: 'chapter-b',
      language: 'en',
      start: 4,
      end: 9,
    });

    expect(next.chapters[1].narrationSegment?.en).toEqual({ start: 4, end: 9 });
    expect(next.chapters[0].narrationSegment?.en).toEqual(
      story.chapters[0].narrationSegment?.en,
    );
  });

  it('updates chapter manifest immutably', () => {
    const story = createStoryWithChapters();
    const next = setChapterManifest(story, {
      chapterId: 'chapter-b',
      manifest: 'https://example.org/updated-manifest.json',
    });

    expect(next).not.toBe(story);
    expect(next.chapters[1].manifest).toBe(
      'https://example.org/updated-manifest.json',
    );
    expect(next.chapters[0].manifest).toBe(story.chapters[0].manifest);
  });

  it('exports then loads story with overlays intact', () => {
    const store = createStoryStore(createStoryWithChapters());
    const exported = store.exportStory();

    const newStore = createStoryStore();
    newStore.loadStory(exported);
    const loaded = newStore.exportStory();

    expect(loaded.chapters).toHaveLength(2);
    expect(loaded.chapters[0].annotations).toEqual(
      exported.chapters[0].annotations,
    );
    expect(loaded.chapters[0].narrationSegment).toEqual(
      exported.chapters[0].narrationSegment,
    );
    expect(loaded.chapters[0].advance).toEqual(exported.chapters[0].advance);
    expect(loaded.chapters[0].manifest).toBe(exported.chapters[0].manifest);
  });

  it('preserves manifests when updating overlays', () => {
    const story = createStoryWithChapters();
    const next = setAnnotationPlacement(story, {
      chapterId: 'chapter-a',
      language: 'en',
      placement: placement(0.55, 0.35, 0.3, 0.3),
    });

    expect(next.chapters[0].manifest).toBe(story.chapters[0].manifest);
    expect(next.chapters[1].manifest).toBe(story.chapters[1].manifest);
    expect(next.chapters[0].annotations?.en?.placement).toEqual(placement(0.55, 0.35, 0.3, 0.3));
  });

  it('updates narration tracks immutably', () => {
    const story = createStoryWithChapters();
    const next = setNarrationTrack(story, {
      language: 'en',
      src: 'https://example.org/en-updated.mp3',
    });

    expect(next).not.toBe(story);
    expect(next.narration).not.toBe(story.narration);
    expect(next.narration?.tracks.en.src).toBe('https://example.org/en-updated.mp3');
    expect(next.narration?.tracks.cy.src).toBe('https://example.org/cy.mp3');
  });

  it('updates advance mode and delay without changing manifest', () => {
    const story = createStoryWithChapters();
    const modeUpdated = setAdvanceMode(story, {
      chapterId: 'chapter-a',
      mode: 'auto',
    });
    const delayUpdated = setDelay(modeUpdated, {
      chapterId: 'chapter-a',
      delayMs: 2000,
    });

    expect(delayUpdated.chapters[0].advance?.mode).toBe('auto');
    expect(delayUpdated.chapters[0].advance?.delayMs).toBe(2000);
    expect(delayUpdated.chapters[0].manifest).toBe(story.chapters[0].manifest);
  });

  it('deletes chapters immutably', () => {
    const story = createStoryWithChapters();
    const next = deleteChapter(story, { chapterId: 'chapter-b' });

    expect(next).not.toBe(story);
    expect(next.chapters).toHaveLength(1);
    expect(next.chapters[0].id).toBe('chapter-a');
    expect(story.chapters).toHaveLength(2);
  });

  it('reorders chapters immutably', () => {
    const story = createStoryWithChapters();
    const next = reorderChapter(story, {
      chapterId: 'chapter-b',
      targetChapterId: 'chapter-a',
      position: 'before',
    });

    expect(next).not.toBe(story);
    expect(next.chapters.map((chapter) => chapter.id)).toEqual([
      'chapter-b',
      'chapter-a',
    ]);
    expect(story.chapters.map((chapter) => chapter.id)).toEqual([
      'chapter-a',
      'chapter-b',
    ]);
  });
});
