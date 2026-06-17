import { describe, expect, it } from 'vitest';
import type { Story } from '../../core/types/story';
import type { ViewBox } from '../../core/types/viewer';
import { createStoryStore } from '../story.svelte';

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

describe('story store (runes)', () => {
  it('initializes with empty story', () => {
    const store = createStoryStore();
    expect(store.story.chapters).toHaveLength(0);
    expect(store.story.version).toBe('1.0');
  });

  it('initializes with provided story', () => {
    const initial = createStoryWithChapters();
    const store = createStoryStore(initial);
    expect(store.story.chapters).toHaveLength(2);
    expect(store.story.chapters[0].id).toBe('chapter-a');
  });

  it('adds chapters reactively', () => {
    const store = createStoryStore();
    
    store.addChapterFromCapture({
      id: 'chapter-1',
      capture: {
        manifest: 'https://example.org/manifest.json',
        canvasIndex: 1,
        viewBox: viewBox(50, 60),
      },
    });

    expect(store.story.chapters).toHaveLength(1);
    expect(store.story.chapters[0]).toMatchObject({
      id: 'chapter-1',
      manifest: 'https://example.org/manifest.json',
      canvasIndex: 1,
    });
    expect(store.story.chapters[0].viewBox).toEqual(viewBox(50, 60));
  });

  it('updates capture while keeping overlays intact', () => {
    const store = createStoryStore(createStoryWithChapters());
    const originalAnnotations = store.story.chapters[0].annotations;
    const originalNarration = store.story.chapters[0].narrationSegment;

    store.updateChapterFromCapture({
      chapterId: 'chapter-a',
      capture: {
        manifest: 'https://example.org/manifest-a.json',
        canvasIndex: 2,
        media: { start: 4, end: 9 },
      },
    });

    const updated = store.story.chapters[0];
    expect(updated.media).toEqual({ start: 4, end: 9 });
    expect(updated.viewBox).toBeUndefined();
    expect(updated.annotations).toEqual(originalAnnotations);
    expect(updated.narrationSegment).toEqual(originalNarration);
  });

  it('deletes chapters reactively', () => {
    const store = createStoryStore(createStoryWithChapters());
    expect(store.story.chapters).toHaveLength(2);

    store.deleteChapter({ chapterId: 'chapter-b' });

    expect(store.story.chapters).toHaveLength(1);
    expect(store.story.chapters[0].id).toBe('chapter-a');
  });

  it('reorders chapters reactively', () => {
    const store = createStoryStore(createStoryWithChapters());
    expect(store.story.chapters.map((chapter) => chapter.id)).toEqual([
      'chapter-a',
      'chapter-b',
    ]);

    store.reorderChapter({
      chapterId: 'chapter-b',
      targetChapterId: 'chapter-a',
      position: 'before',
    });

    expect(store.story.chapters.map((chapter) => chapter.id)).toEqual([
      'chapter-b',
      'chapter-a',
    ]);
  });

  it('updates annotation text reactively', () => {
    const store = createStoryStore(createStoryWithChapters());
    
    store.setAnnotationText({
      chapterId: 'chapter-a',
      language: 'en',
      text: 'Updated',
    });

    expect(store.story.chapters[0].annotations?.en?.text).toBe('Updated');
    expect(store.story.chapters[0].annotations?.cy?.text).toBe('Shwmae');
  });

  it('updates annotation placement reactively', () => {
    const store = createStoryStore(createStoryWithChapters());
    
    store.setAnnotationPlacement({
      chapterId: 'chapter-a',
      language: 'en',
      placement: placement(0.55, 0.35, 0.3, 0.3),
    });

    expect(store.story.chapters[0].annotationPlacement).toEqual(
      placement(0.55, 0.35, 0.3, 0.3),
    );
  });

  it('updates narration tracks reactively', () => {
    const store = createStoryStore(createStoryWithChapters());
    
    store.setNarrationTrack({
      language: 'en',
      src: 'https://example.org/en-updated.mp3',
    });

    expect(store.story.narration?.tracks.en.src).toBe('https://example.org/en-updated.mp3');
    expect(store.story.narration?.tracks.cy.src).toBe('https://example.org/cy.mp3');
  });

  it('updates narration segments reactively', () => {
    const store = createStoryStore(createStoryWithChapters());
    
    store.setNarrationSegment({
      chapterId: 'chapter-a',
      language: 'cy',
      start: 10,
      end: 12,
    });

    expect(store.story.chapters[0].narrationSegment?.cy).toEqual({ start: 10, end: 12 });
    expect(store.story.chapters[0].narrationSegment?.en).toEqual({ start: 2, end: 5 });
  });

  it('updates advance mode reactively', () => {
    const store = createStoryStore(createStoryWithChapters());
    
    store.setAdvanceMode({
      chapterId: 'chapter-a',
      mode: 'auto',
    });

    expect(store.story.chapters[0].advance?.mode).toBe('auto');
    expect(store.story.chapters[0].advance?.delayMs).toBe(1500);
  });

  it('updates delay reactively', () => {
    const store = createStoryStore(createStoryWithChapters());
    
    store.setDelay({
      chapterId: 'chapter-a',
      delayMs: 2000,
    });

    expect(store.story.chapters[0].advance?.delayMs).toBe(2000);
    expect(store.story.chapters[0].advance?.mode).toBe('manual');
  });

  it('updates chapter manifest reactively', () => {
    const store = createStoryStore(createStoryWithChapters());
    
    store.setChapterManifest({
      chapterId: 'chapter-b',
      manifest: 'https://example.org/updated-manifest.json',
    });

    expect(store.story.chapters[1].manifest).toBe('https://example.org/updated-manifest.json');
    expect(store.story.chapters[0].manifest).toBe('https://example.org/manifest-a.json');
  });

  it('updates chapter metadata reactively', () => {
    const store = createStoryStore(createStoryWithChapters());

    store.setChapterTitle({
      chapterId: 'chapter-a',
      language: 'en',
      value: 'Story title',
    });
    store.setChapterDescription({
      chapterId: 'chapter-b',
      language: 'cy',
      value: 'Disgrifiad stori',
    });

    expect(store.story.chapters[0].title?.en).toBe('Story title');
    expect(store.story.chapters[1].description?.cy).toBe('Disgrifiad stori');
  });

  it('exports story as plain JSON', () => {
    const initial = createStoryWithChapters();
    const store = createStoryStore(initial);
    const exported = store.exportStory();

    expect(exported).toEqual(initial);
    expect(exported.chapters).toHaveLength(2);
    expect(exported.chapters[0].annotations).toEqual(initial.chapters[0].annotations);
  });

  it('loads story replacing current state', () => {
    const store = createStoryStore();
    expect(store.story.chapters).toHaveLength(0);

    const newStory = createStoryWithChapters();
    store.loadStory(newStory);

    expect(store.story.chapters).toHaveLength(2);
    expect(store.story.chapters[0].id).toBe('chapter-a');
  });

  it('story remains serializable after mutations', () => {
    const store = createStoryStore(createStoryWithChapters());
    
    store.addChapterFromCapture({
      capture: {
        manifest: 'https://example.org/manifest.json',
        canvasIndex: 0,
      },
    });
    
    store.setAnnotationText({
      chapterId: 'chapter-a',
      language: 'en',
      text: 'New text',
    });

    const exported = store.exportStory();
    const serialized = JSON.stringify(exported);
    const parsed = JSON.parse(serialized);

    expect(parsed.chapters).toHaveLength(3);
    expect(parsed.chapters[0].annotations.en.text).toBe('New text');
  });
});
