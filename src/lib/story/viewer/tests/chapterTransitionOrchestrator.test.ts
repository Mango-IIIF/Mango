import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewBox } from '../../../core/types/viewer';
import type { ViewerApi } from '../../../core/types/viewer-api';
import type { StoryWithDefaults } from '../storyLoader';

const panToViewBox = vi.fn(
  (_viewer: ViewerApi, _target: ViewBox, _sourceChanged: boolean, _deps: unknown) => null,
);

vi.mock('../canvasPanner', async () => {
  const actual = await vi.importActual<typeof import('../canvasPanner')>('../canvasPanner');
  return {
    ...actual,
    panToViewBox: (viewer: ViewerApi, target: ViewBox, sourceChanged: boolean, deps: unknown) =>
      panToViewBox(viewer, target, sourceChanged, deps),
  };
});

const { createChapterTransitionOrchestrator } = await import('../chapterTransitionOrchestrator');

const MANIFEST = 'https://example.org/manifest.json';
const CANVAS_ONE = 'https://example.org/canvas/1';
const CANVAS_TWO = 'https://example.org/canvas/2';

const createViewer = () => {
  const state = {
    manifestId: MANIFEST,
    canvasId: CANVAS_ONE,
    canvasIndex: 0,
    viewBox: { x: 0, y: 0, w: 1000, h: 800 },
  };
  const viewer = {
    getManifestId: () => state.manifestId,
    getCanvasId: () => state.canvasId,
    getCanvasIndex: () => state.canvasIndex,
    getCanvasCount: () => 2,
    getViewBox: () => state.viewBox,
    getLayerOpacities: () => ({}),
    setManifest: vi.fn((id: string) => {
      state.manifestId = id;
    }),
    setCanvasById: vi.fn((id: string) => {
      state.canvasId = id;
      state.canvasIndex = id === CANVAS_TWO ? 1 : 0;
      // The viewer drops its framing on a page change, which is exactly why the
      // old framing is not a coherent place to animate from.
      state.viewBox = { x: 0, y: 0, w: 600, h: 900 };
    }),
    setCanvasByIndex: vi.fn(),
    setViewBox: vi.fn(),
    updateLayerOpacity: vi.fn(),
    on: () => () => undefined,
  } as unknown as ViewerApi;
  return { viewer, state };
};

const createStory = (): StoryWithDefaults =>
  ({
    chapters: [
      {
        id: 'chapter-1',
        manifest: MANIFEST,
        canvasIndex: 0,
        canvasId: CANVAS_ONE,
        viewBox: { x: 0, y: 0, w: 1000, h: 800 },
        transitionTimeMs: 2000,
      },
      {
        id: 'chapter-2',
        manifest: MANIFEST,
        canvasIndex: 1,
        canvasId: CANVAS_TWO,
        viewBox: { x: 100, y: 200, w: 400, h: 600 },
        transitionTimeMs: 2000,
      },
      {
        id: 'chapter-3',
        manifest: MANIFEST,
        canvasIndex: 0,
        canvasId: CANVAS_ONE,
        viewBox: { x: 250, y: 150, w: 300, h: 240 },
        transitionTimeMs: 2000,
      },
    ],
  }) as StoryWithDefaults;

const lastCall = () => {
  const { calls } = panToViewBox.mock;
  return calls[calls.length - 1];
};
const targetArg = () => lastCall()[1];
const sourceChangedArg = () => lastCall()[2];

describe('chapter transitions', () => {
  beforeEach(() => {
    panToViewBox.mockClear();
  });

  it('snaps to the framing when the chapter moves to another canvas', async () => {
    const { viewer } = createViewer();
    const orchestrator = createChapterTransitionOrchestrator(viewer, createStory(), {
      posePaintedTimeoutMs: 200,
      sourceOpenTimeoutMs: 200,
    });

    await orchestrator.loadChapter(1);

    expect(panToViewBox).toHaveBeenCalledOnce();
    expect(targetArg()).toEqual({ x: 100, y: 200, w: 400, h: 600 });
    expect(sourceChangedArg()).toBe(true);
    orchestrator.destroy();
  });

  it('pans and zooms when the chapter stays on the same canvas', async () => {
    const { viewer } = createViewer();
    const orchestrator = createChapterTransitionOrchestrator(viewer, createStory(), {
      posePaintedTimeoutMs: 200,
      sourceOpenTimeoutMs: 200,
    });

    // Chapter 3 shares chapter 1's canvas, so only the framing moves.
    await orchestrator.loadChapter(2);

    expect(panToViewBox).toHaveBeenCalledOnce();
    expect(targetArg()).toEqual({ x: 250, y: 150, w: 300, h: 240 });
    expect(sourceChangedArg()).toBe(false);
    orchestrator.destroy();
  });

  it('pans and zooms when only a synthesised canvas id differs from the viewer', async () => {
    const { viewer } = createViewer();
    const story = createStory();
    // What the serializer writes for a chapter captured without a canvas ID,
    // and what the loader reads back: an ID derived from the index that no
    // manifest contains. Both chapters still sit on canvas 0.
    story.chapters[0].canvasId = `${MANIFEST}/canvas/0`;
    story.chapters[2].canvasId = `${MANIFEST}/canvas/0`;
    const orchestrator = createChapterTransitionOrchestrator(viewer, story, {
      posePaintedTimeoutMs: 200,
      sourceOpenTimeoutMs: 200,
    });

    await orchestrator.loadChapter(2);

    expect(panToViewBox).toHaveBeenCalledOnce();
    expect(sourceChangedArg()).toBe(false);
    orchestrator.destroy();
  });

  it('snaps to the framing when the chapter moves to another manifest', async () => {
    const { viewer } = createViewer();
    const story = createStory();
    story.chapters[1].manifest = 'https://example.org/other-manifest.json';
    const orchestrator = createChapterTransitionOrchestrator(viewer, story, {
      posePaintedTimeoutMs: 200,
      sourceOpenTimeoutMs: 200,
    });

    await orchestrator.loadChapter(1);

    expect(panToViewBox).toHaveBeenCalledOnce();
    expect(sourceChangedArg()).toBe(true);
    orchestrator.destroy();
  });
});
