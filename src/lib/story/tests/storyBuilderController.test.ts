import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { createEventBus } from '../../core/events/eventBus';
import type { PluginContext } from '../../core/types/plugin';
import {
  collectLatestNarrationSegments,
  createStoryBuilderController,
} from '../storyBuilderController';

describe('story builder narration defaults', () => {
  it('keeps the latest valid range for each language', () => {
    expect(
      collectLatestNarrationSegments({
        chapters: [
          {
            id: 'chapter-1',
            manifest: 'https://example.org/manifest.json',
            canvasIndex: 0,
            narrationSegment: {
              en: { start: 2, end: 5 },
              cy: { start: 10, end: 14 },
            },
          },
          {
            id: 'chapter-2',
            manifest: 'https://example.org/manifest.json',
            canvasIndex: 1,
            narrationSegment: { en: { start: 6, end: 9 } },
          },
        ],
      }),
    ).toEqual({
      en: { start: 6, end: 9 },
      cy: { start: 10, end: 14 },
    });
  });

  it('persists drawing geometry even when the editor has already returned to select mode', () => {
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          {
            id: 'chapter-1',
            manifest: 'https://example.org/manifest.json',
            canvasIndex: 0,
            viewBox: { x: 0, y: 0, w: 100, h: 100 },
            annotations: {
              en: { text: 'Editable text', placement: { x: 20, y: 30, w: 25, h: 15 } },
            },
          },
        ],
      },
    });
    const events = createEventBus();
    const viewer = {
      getManifestId: () => 'https://example.org/manifest.json',
      getState: () => null,
      getViewBox: () => ({ x: 0, y: 0, w: 100, h: 100 }),
      getCanvasIndex: () => 0,
      getCanvasCount: () => 1,
      getCanvasId: () => 'canvas-1',
      getMediaType: () => 'image',
      getMediaSources: () => [],
      getLayerOpacities: () => ({}),
      setStoryAnnotations: vi.fn(),
      setStoryAnnotationEditing: vi.fn(),
      setStoryAnnotationSelection: vi.fn(),
      setAnnotationTool: vi.fn(),
      setCanvasByIndex: vi.fn(),
      setCanvasById: vi.fn(),
      setManifest: vi.fn(),
      setViewBox: vi.fn(),
      updateLayerOpacity: vi.fn(),
      setModelOrbit: vi.fn(),
      setModelTarget: vi.fn(),
      setModelOrientation: vi.fn(),
      addAnnotation: vi.fn(),
      removeAnnotation: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
    const detach = controller.attach({
      mount: document.createElement('div'),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);

    controller.selectChapter('chapter-1');
    controller.activeChapterTask.set('focus');
    controller.chapterAnnotationTool.set('select');
    events.emit('annotationCreate', {
      annotation: { id: 'rectangle-1', rect: { x: 10, y: 20, w: 30, h: 40 } },
      tool: 'rectangle',
    });

    expect(get(controller.story).chapters[0].drawingAnnotations).toEqual([
      {
        id: 'rectangle-1',
        type: 'rectangle',
        rect: { x: 10, y: 20, w: 30, h: 40 },
      },
    ]);
    events.emit('annotationUpdate', {
      annotationId: 'rectangle-1',
      patch: { rect: { x: 15, y: 25, w: 45, h: 50 } },
    });
    expect(get(controller.story).chapters[0].drawingAnnotations?.[0].rect).toEqual({
      x: 15,
      y: 25,
      w: 45,
      h: 50,
    });
    expect(viewer.setStoryAnnotations).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: 'rectangle-1',
        rect: { x: 15, y: 25, w: 45, h: 50 },
      }),
    ]);

    controller.editChapterDrawingAnnotation('rectangle-1');
    expect(viewer.setStoryAnnotationSelection).toHaveBeenLastCalledWith('rectangle-1');
    expect(viewer.setViewBox).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );

    controller.editChapterTextAnnotation('en');
    expect(get(controller.uiMode)).toBe('annotationPositioning');
    expect(viewer.setStoryAnnotationSelection).toHaveBeenLastCalledWith(null);

    controller.deleteChapterTextAnnotation('en');
    expect(get(controller.story).chapters[0].annotations).toBeUndefined();

    controller.updateLayerOpacity('painting-layer', 0.35);
    expect(viewer.updateLayerOpacity).toHaveBeenCalledWith('painting-layer', 0.35);
    expect(get(controller.story).chapters[0].layerOpacities).toEqual({
      'painting-layer': 0.35,
    });
    detach();
  });

  it('captures the full source by default and edits source-media timing independently', () => {
    const controller = createStoryBuilderController({ initialStory: { chapters: [] } });
    const events = createEventBus();
    const viewer = {
      getManifestId: () => 'https://iiif.io/api/cookbook/recipe/0002-mvm-audio/manifest.json',
      getState: () => null,
      getViewBox: () => null,
      getCanvasIndex: () => 0,
      getCanvasCount: () => 1,
      getCanvasId: () => 'https://iiif.io/api/cookbook/recipe/0002-mvm-audio/canvas/1',
      getMediaType: () => 'audio',
      getMediaSources: () => [
        {
          type: 'audio',
          id: 'audio-source',
          src: 'https://fixtures.iiif.io/audio/indiana/donizetti-elixir.mp4',
          duration: 1985.024,
        },
      ],
      getLayerOpacities: () => ({}),
      setMediaSegment: vi.fn(),
      seekTo: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      setStoryAnnotations: vi.fn(),
      setStoryAnnotationEditing: vi.fn(),
      setStoryAnnotationSelection: vi.fn(),
      setAnnotationTool: vi.fn(),
      setCanvasByIndex: vi.fn(),
      setCanvasById: vi.fn(),
      setManifest: vi.fn(),
      setViewBox: vi.fn(),
      setModelOrbit: vi.fn(),
      setModelTarget: vi.fn(),
      setModelOrientation: vi.fn(),
      addAnnotation: vi.fn(),
      removeAnnotation: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
    const detach = controller.attach({
      mount: document.createElement('div'),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);

    controller.addChapter();
    expect(get(controller.story).chapters[0].media).toEqual({
      start: 0,
      end: 1985.024,
    });
    expect(get(controller.story).chapters[0].advance).toEqual({
      mode: 'auto',
      delayMs: 2000,
    });

    controller.assignMediaSegment(12.5, 42);
    expect(get(controller.story).chapters[0].media).toEqual({ start: 12.5, end: 42 });
    expect(viewer.setMediaSegment).toHaveBeenLastCalledWith(12.5, 42);
    expect(get(controller.story).chapters[0].narrationSegment).toBeUndefined();

    controller.previewMediaSegment();
    expect(viewer.seekTo).toHaveBeenLastCalledWith(12.5);
    expect(viewer.play).toHaveBeenCalledOnce();

    controller.stopPreviewMediaSegment();
    expect(viewer.pause).toHaveBeenCalledOnce();
    expect(viewer.seekTo).toHaveBeenLastCalledWith(12.5);

    controller.updateAdvanceMode('auto');
    controller.updateDelay(3500);
    controller.addChapter();
    expect(get(controller.story).chapters[1].advance).toEqual({
      mode: 'auto',
      delayMs: 3500,
    });
    detach();
  });
});
