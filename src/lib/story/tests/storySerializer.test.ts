import { describe, it, expect, vi } from 'vitest';
import { loadStoryIntoStore, serializeStoryToIiif } from '../storySerializer';
import { normaliseStoryInput } from '../viewer/storyLoader';
import type { StoryState } from '../../core/types/story';
import {
  MANGO_STORY_VERSION,
  MANGO_VIEWER_STATE_FORMAT,
  MANGO_VIEWER_STATE_TYPE,
} from '../storyAnnotationProfile';

describe('Story IIIF Serialization and Parsing', () => {
  const sampleStory: StoryState = {
    id: 'https://example.com/stories/my-story/chapters',
    title: { en: 'My Awesome Story', cy: 'Fy Stori Wych' },
    narration: {
      tracks: {
        en: { src: 'https://example.com/audio-en.mp3' },
        cy: { src: 'https://example.com/audio-cy.mp3' },
      },
    },
    chapters: [
      {
        id: 'chapter_1',
        title: { en: 'Chapter 1', cy: 'Pennod 1' },
        description: {
          en: 'This is the first chapter',
          cy: 'Dyma y bennod gyntaf',
        },
        manifest: 'https://manifests.collections.yale.edu/ycba/obj/34',
        canvasIndex: 0,
        canvasId: 'https://manifests.collections.yale.edu/ycba/obj/34/canvas/0',
        transitionTimeMs: 2000,
        viewBox: { x: -500, y: 100, w: 1000, h: 500 }, // Has negative x to check clamping!
        media: { start: 170, end: 183 },
        narrationSegment: {
          en: { start: 0, end: 12.5 },
          cy: { start: 0, end: 14.2 },
        },
        annotations: {
          en: {
            text: 'Look at this detail!',
            placement: { x: 4500, y: 6500, w: 800, h: 300 }, // Absolute canvas coords
          },
        },
        annotationPlacement: { x: 10, y: 20, w: 300, h: 200 },
        advance: { mode: 'auto', delayMs: 4500 },
        layerOpacities: {
          'https://example.com/layers/natural': 0.25,
          'https://example.com/layers/xray': 0.75,
        },
      },
      {
        id: 'model chapter',
        title: { en: 'Model detail' },
        manifest: 'https://example.com/model-manifest',
        canvasIndex: 3,
        canvasId: 'https://example.com/model-manifest/canvas/model',
        transitionTimeMs: 1200,
        model: {
          cameraOrbit: '45deg 30deg 2m',
          cameraTarget: '0m 1m 0m',
          fieldOfView: '45deg',
          orientation: '0deg 0deg 0deg',
        },
        modelOptions: { transition: 'interpolate', interpolationDecay: 180 },
        advance: { mode: 'manual' },
      },
    ],
  };

  it('should serialize story into a valid IIIF Presentation v3 AnnotationPage', () => {
    const serialized = serializeStoryToIiif(sampleStory);

    expect(serialized['@context'][0]).toBe(
      'http://iiif.io/api/presentation/3/context.json',
    );
    expect(serialized['mango:storyVersion']).toBe(MANGO_STORY_VERSION);
    expect(serialized.id).toBe(sampleStory.id);
    expect(serialized.type).toBe('AnnotationPage');
    expect(serialized.label.en[0]).toBe('My Awesome Story');
    expect(serialized.label.cy[0]).toBe('Fy Stori Wych');

    expect(serialized.items).toHaveLength(3);
    const annotation = serialized.items[0];
    expect(annotation.type).toBe('Annotation');
    expect(annotation.motivation).toBe('supplementing');
    expect(annotation.label.en[0]).toBe('Chapter 1');
    expect(annotation.summary.en[0]).toBe('This is the first chapter');

    // Clamping & media segment checks
    expect(annotation.target.source).toBe(
      'https://manifests.collections.yale.edu/ycba/obj/34/canvas/0#t=170,183',
    );
    expect(annotation.target.partOf.id).toBe(
      'https://manifests.collections.yale.edu/ycba/obj/34',
    );
    expect(annotation.target.selector.value).toBe(
      'xywh=0,100,1000,500&t=170,183',
    ); // x=-500 clamped to 0, temporal media appended!

    // Sound and Textual bodies checks
    expect(Array.isArray(annotation.body)).toBe(true);
    const soundEn = annotation.body.find(
      (b: any) => b.type === 'Sound' && b.language === 'en',
    );
    expect(soundEn).toBeDefined();
    expect(soundEn.id).toBe('https://example.com/audio-en.mp3#t=0,12.5');

    const soundCy = annotation.body.find(
      (b: any) => b.type === 'Sound' && b.language === 'cy',
    );
    expect(soundCy).toBeDefined();
    expect(soundCy.id).toBe('https://example.com/audio-cy.mp3#t=0,14.2');

    const textOverlay = serialized.items.find(
      (item) => item['mango:role'] === 'overlay',
    );
    expect(textOverlay).toBeDefined();
    expect(textOverlay?.['mango:chapterId']).toBe('chapter_1');
    expect((textOverlay?.body as any).value).toBe('Look at this detail!');
    expect((textOverlay?.target as any).selector.value).toBe(
      'xywh=4500,6500,800,300',
    );

    const viewerState = annotation.body.find(
      (b: any) => b.type === MANGO_VIEWER_STATE_TYPE,
    );
    expect(viewerState.format).toBe(MANGO_VIEWER_STATE_FORMAT);
    expect(viewerState['mango:storyVersion']).toBe(MANGO_STORY_VERSION);
    expect(viewerState.mangoState).toEqual({
      chapterId: 'chapter_1',
      canvasIndex: 0,
      canvasId: 'https://manifests.collections.yale.edu/ycba/obj/34/canvas/0',
      viewBox: { x: -500, y: 100, w: 1000, h: 500 },
      layerOpacities: {
        'https://example.com/layers/natural': 0.25,
        'https://example.com/layers/xray': 0.75,
      },
      annotationPlacement: { x: 10, y: 20, w: 300, h: 200 },
      playback: {
        advance: 'auto',
        delayMs: 4500,
        transitionMs: 2000,
      },
    });

    const modelAnnotation = serialized.items[2];
    expect(modelAnnotation.id).toContain('model%20chapter');
    expect(modelAnnotation.target.selector).toBeUndefined();
  });

  it('should round-trip parse the serialized AnnotationPage back into the same internal StoryState model', () => {
    const serialized = serializeStoryToIiif(sampleStory);
    const result = normaliseStoryInput(serialized);

    expect(result.ok).toBe(true);
    const parsed = result.story!;

    expect(parsed.title?.en).toBe('My Awesome Story');
    expect(parsed.id).toBe(sampleStory.id);
    expect(parsed.title?.cy).toBe('Fy Stori Wych');
    expect(parsed.narration?.tracks?.en.src).toBe(
      'https://example.com/audio-en.mp3',
    );
    expect(parsed.narration?.tracks?.cy.src).toBe(
      'https://example.com/audio-cy.mp3',
    );

    expect(parsed.chapters).toHaveLength(2);
    const chapter = parsed.chapters[0];
    expect(chapter.id).toBe('chapter_1');
    expect(chapter.title?.en).toBe('Chapter 1');
    expect(chapter.description?.en).toBe('This is the first chapter');
    expect(chapter.transitionTimeMs).toBe(2000);
    expect(chapter.manifest).toBe(
      'https://manifests.collections.yale.edu/ycba/obj/34',
    );
    expect(chapter.canvasIndex).toBe(0);
    expect(chapter.canvasId).toBe(
      'https://manifests.collections.yale.edu/ycba/obj/34/canvas/0',
    );

    // The standard target is clamped, while Mango state retains the exact pose.
    expect(chapter.viewBox).toEqual({ x: -500, y: 100, w: 1000, h: 500 });

    // Resolved media segment
    expect(chapter.media).toEqual({ start: 170, end: 183 });

    expect(chapter.narrationSegment?.en).toEqual({ start: 0, end: 12.5 });
    expect(chapter.narrationSegment?.cy).toEqual({ start: 0, end: 14.2 });

    expect(chapter.annotations?.en.text).toBe('Look at this detail!');
    expect(chapter.annotations?.en.placement).toEqual({
      x: 4500,
      y: 6500,
      w: 800,
      h: 300,
    });
    expect(chapter.annotationPlacement).toEqual({
      x: 10,
      y: 20,
      w: 300,
      h: 200,
    });
    expect(chapter.advance).toEqual({ mode: 'auto', delayMs: 4500 });
    expect(chapter.layerOpacities).toEqual({
      'https://example.com/layers/natural': 0.25,
      'https://example.com/layers/xray': 0.75,
    });

    const modelChapter = parsed.chapters[1];
    expect(modelChapter.id).toBe('model chapter');
    expect(modelChapter.canvasIndex).toBe(3);
    expect(modelChapter.model).toEqual(sampleStory.chapters[1].model);
    expect(modelChapter.modelOptions).toEqual(
      sampleStory.chapters[1].modelOptions,
    );
    expect(modelChapter.advance).toEqual({ mode: 'manual' });
    expect(modelChapter.transitionTimeMs).toBe(1200);
  });

  it('supports an explicit export identifier when the authoring state has none', () => {
    const story = { ...sampleStory, id: undefined };
    const serialized = serializeStoryToIiif(story, {
      id: 'https://museum.example/stories/42/chapters',
    });

    expect(serialized.id).toBe('https://museum.example/stories/42/chapters');
    expect(serialized.items[0].id).toBe(
      'https://museum.example/stories/42/chapters/annotation/chapter_1',
    );
  });

  it('restores builder advance delays without replacing them with transition timing', () => {
    const store = {
      loadStory: vi.fn(),
      addChapterFromCapture: vi.fn(),
      setNarrationTrack: vi.fn(),
      setChapterTitle: vi.fn(),
      setChapterDescription: vi.fn(),
      setNarrationSegment: vi.fn(),
      setAnnotationText: vi.fn(),
      setAnnotationPlacement: vi.fn(),
      setAdvanceMode: vi.fn(),
      setDelay: vi.fn(),
    };

    loadStoryIntoStore(sampleStory, store);

    expect(store.setDelay).toHaveBeenCalledWith({
      chapterId: 'chapter_1',
      delayMs: 4500,
    });
    expect(store.setDelay).toHaveBeenCalledWith({
      chapterId: 'model chapter',
      delayMs: 1200,
    });
    expect(store.addChapterFromCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        capture: expect.objectContaining({
          layerOpacities: sampleStory.chapters[0].layerOpacities,
        }),
      }),
    );
    expect(store.addChapterFromCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        capture: expect.objectContaining({
          model: sampleStory.chapters[1].model,
          modelOptions: sampleStory.chapters[1].modelOptions,
        }),
      }),
    );
  });
});
