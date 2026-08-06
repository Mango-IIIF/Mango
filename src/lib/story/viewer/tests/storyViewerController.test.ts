import { describe, expect, it, vi } from 'vitest';
import { createStoryViewerRuntime } from '../storyViewerController';
import type { StoryWithDefaults } from '../storyLoader';

const createMockViewer = () => {
  const eventHandlers: Record<string, ((...args: any[]) => void)[]> = {};
  let currentManifestId = '';
  let currentCanvasIndex = 0;
  let currentCanvasId = 'canvas-0';
  let canvasCount = 1; // Mock has 1 canvas by default

  const mock = {
    setManifest: vi.fn((manifestId: string) => {
      currentManifestId = manifestId;
      canvasCount = 2; // When manifest changes, assume it has 2 canvases
      // Emit manifestChange event asynchronously (simulates real behavior)
      setTimeout(() => {
        mock.emit('manifestChange', { manifestId });
        // Emit stateChange shortly after to simulate canvases loading
        setTimeout(() => {
          mock.emit('stateChange', {});
        }, 5);
      }, 10);
    }),
    setCanvasByIndex: vi.fn((index: number) => {
      currentCanvasIndex = index;
      currentCanvasId = `canvas-${index}`;
      // Emit pageChange event asynchronously (simulates real behavior)
      setTimeout(() => {
        mock.emit('pageChange', { canvasId: `canvas-${index}`, index });
      }, 10);
    }),
    setCanvasById: vi.fn((canvasId: string) => {
      currentCanvasId = canvasId;
      setTimeout(() => {
        mock.emit('pageChange', { canvasId, index: currentCanvasIndex });
      }, 10);
    }),
    getManifestId: vi.fn(() => currentManifestId),
    getCanvasIndex: vi.fn(() => currentCanvasIndex),
    getCanvasId: vi.fn(() => currentCanvasId),
    getCanvasCount: vi.fn(() => canvasCount),
    setViewBox: vi.fn(),
    setModelPose: vi.fn(),
    setModelOrbit: vi.fn(),
    setModelTarget: vi.fn(),
    setModelOrientation: vi.fn(),
    seekTo: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
      return () => {
        const index = eventHandlers[event].indexOf(handler);
        if (index > -1) {
          eventHandlers[event].splice(index, 1);
        }
      };
    }),
    off: vi.fn(),
    emit: (event: string, payload: any) => {
      const handlers = eventHandlers[event] || [];
      handlers.forEach((handler) => handler(payload));
    },
  };

  return mock;
};

const story: StoryWithDefaults = {
  chapters: [
    {
      id: 'chap-1',
      manifest: 'm1',
      canvasIndex: 0,
      viewBox: { x: 0, y: 0, w: 100, h: 80 },
      transitionTimeMs: 2000,
    },
    {
      id: 'chap-2',
      manifest: 'm1',
      canvasIndex: 1,
      media: { start: 5, end: 10 },
      transitionTimeMs: 2000,
    },
    {
      id: 'chap-3',
      manifest: 'm2',
      canvasIndex: 0,
      model: {
        cameraOrbit: '1rad',
        cameraTarget: '0 0 0',
        orientation: '45deg',
      },
      modelOptions: { transition: 'interpolate', interpolationDecay: 180 },
      transitionTimeMs: 2000,
    },
  ],
};

describe('storyViewerController.loadChapter', () => {
  it('applies viewBox, media seek, and model pose', async () => {
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });

    await runtime.loadStory(story);

    expect(viewer.setViewBox).toHaveBeenCalledWith(story.chapters[0].viewBox);
    await runtime.loadChapter(1);
    expect(viewer.seekTo).toHaveBeenCalledWith(5);
    await runtime.loadChapter(2);
    expect(viewer.setModelPose).toHaveBeenCalledWith(
      story.chapters[2].model,
      story.chapters[2].modelOptions,
    );
    expect(viewer.setModelOrbit).not.toHaveBeenCalled();
    expect(viewer.setModelTarget).not.toHaveBeenCalled();
    expect(viewer.setModelOrientation).not.toHaveBeenCalled();
  });

  it('does not set manifest again for same manifest', async () => {
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });

    await runtime.loadStory(story);
    await runtime.loadChapter(1);

    expect(viewer.setManifest).toHaveBeenCalledTimes(1);
    await runtime.loadChapter(2);
    expect(viewer.setManifest).toHaveBeenCalledTimes(2);
  });

  it('falls back to individual model setters when setModelPose is unavailable', async () => {
    const viewer = createMockViewer();
    viewer.setModelPose = undefined as any;
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });
    const fallbackStory: StoryWithDefaults = {
      chapters: [
        {
          id: 'model-fallback',
          manifest: 'm1',
          canvasIndex: 0,
          model: {
            cameraOrbit: '1rad',
            cameraTarget: '0 0 0',
            orientation: '45deg',
          },
          transitionTimeMs: 200,
        },
      ],
    };

    await runtime.loadStory(fallbackStory);

    expect(viewer.setModelOrbit).toHaveBeenCalledWith('1rad');
    expect(viewer.setModelTarget).toHaveBeenCalledWith('0 0 0');
    expect(viewer.setModelOrientation).toHaveBeenCalledWith('45deg');
  });

  it('uses a stable canvas ID in preference to its fallback index', async () => {
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });
    const canvasStory: StoryWithDefaults = {
      chapters: [
        {
          id: 'canvas-id',
          manifest: 'm1',
          canvasIndex: 0,
          canvasId: 'https://example.org/canvas/stable',
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          transitionTimeMs: 200,
        },
      ],
    };

    await runtime.loadStory(canvasStory);

    expect(viewer.setCanvasById).toHaveBeenCalledWith('https://example.org/canvas/stable');
    expect(viewer.setCanvasByIndex).not.toHaveBeenCalled();
  });

  it('uses the canvas index when an authored canvas ID is stale', async () => {
    const viewer = createMockViewer();
    viewer.setCanvasById.mockImplementation(() => undefined);
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });
    const canvasStory: StoryWithDefaults = {
      chapters: [
        {
          id: 'first',
          manifest: 'm1',
          canvasIndex: 0,
          canvasId: 'https://example.org/stale-canvas/0',
          transitionTimeMs: 200,
        },
        {
          id: 'second',
          manifest: 'm1',
          canvasIndex: 1,
          canvasId: 'https://example.org/stale-canvas/1',
          transitionTimeMs: 200,
        },
      ],
    };

    await runtime.loadStory(canvasStory);
    await runtime.loadChapter(1);

    expect(viewer.setCanvasById).toHaveBeenLastCalledWith('https://example.org/stale-canvas/1');
    expect(viewer.setCanvasByIndex).toHaveBeenCalledWith(1);
    expect(viewer.getCanvasIndex()).toBe(1);
  });

  it('does not repaint the outgoing chapter camera while the next chapter loads', async () => {
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });
    // Both chapters pan across the canvas, and chapter one's opening keyframe
    // is the opposite end of the canvas from where it finishes.
    const motionStory: StoryWithDefaults = {
      chapters: [
        {
          id: 'pan-right-to-left',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 1000, h: 800 },
          cameraTrack: {
            durationMs: 4000,
            preset: 'custom',
            keyframes: [
              { id: 'a', timeMs: 0, viewBox: { x: 8000, y: 0, w: 500, h: 400 } },
              { id: 'b', timeMs: 4000, viewBox: { x: 100, y: 0, w: 500, h: 400 } },
            ],
          },
          transitionTimeMs: 200,
        },
        {
          id: 'second',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 100, y: 0, w: 600, h: 480 },
          cameraTrack: {
            durationMs: 4000,
            preset: 'custom',
            keyframes: [
              { id: 'c', timeMs: 0, viewBox: { x: 100, y: 0, w: 600, h: 480 } },
              { id: 'd', timeMs: 4000, viewBox: { x: 900, y: 0, w: 600, h: 480 } },
            ],
          },
          transitionTimeMs: 200,
        },
      ],
    };

    await runtime.loadStory(motionStory);
    viewer.setViewBox.mockClear();

    await runtime.loadChapter(1);

    // Chapter one's opening keyframe sits at x=8000. Sampling it during the
    // transition snapped the viewer back there before panning to chapter two.
    const framings = viewer.setViewBox.mock.calls.map(([box]: [any]) => box);
    expect(framings.some((box) => box?.x === 8000)).toBe(false);
    expect(framings.length).toBeGreaterThan(0);
    expect(framings.at(-1)).toMatchObject({ x: 100, w: 600 });
  });

  it('auto advances silent chapters after transitionTimeMs', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });
    const silentStory: StoryWithDefaults = {
      chapters: [
        {
          id: 's1',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          transitionTimeMs: 200,
        },
        {
          id: 's2',
          manifest: 'm1',
          canvasIndex: 1,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          transitionTimeMs: 200,
        },
      ],
    };

    const loadPromise = runtime.loadStory(silentStory);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250); // Advance timers to let orchestrator complete
    await loadPromise;
    expect(viewer.setCanvasByIndex).toHaveBeenCalledWith(0);

    runtime.play();
    await vi.advanceTimersByTimeAsync(410);
    await vi.runAllTimersAsync();

    expect(viewer.setCanvasByIndex).toHaveBeenCalledTimes(3);
    expect(['ENDED', 'IDLE']).toContain(runtime.getState());
    vi.useRealTimers();
  });

  it('plays narration then transition delay', async () => {
    const viewer = createMockViewer();
    const mockNarration = {
      playSegment: vi.fn().mockResolvedValue(true),
      stop: vi.fn(),
      pause: vi.fn().mockReturnValue(true),
      resume: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(false),
    };
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      createNarrationPlayer: () => mockNarration as any,
      now: () => Date.now(),
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });

    const narrStory: StoryWithDefaults = {
      narration: { tracks: { en: { src: 'audio.mp3' } } },
      chapters: [
        {
          id: 'n1',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          narrationSegment: { en: { start: 0, end: 1 } },
          transitionTimeMs: 200,
        },
        {
          id: 'n2',
          manifest: 'm1',
          canvasIndex: 1,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          transitionTimeMs: 200,
        },
      ],
    };

    await runtime.loadStory(narrStory);
    runtime.play();
    expect(mockNarration.playSegment).toHaveBeenCalled();
    await Promise.resolve();
    expect(runtime.getState()).toBe('TRANSITION_DELAY');
    await runtime.loadChapter(1);
    expect(viewer.setCanvasByIndex).toHaveBeenCalledTimes(2);
    runtime.destroy();
  });

  it('replays narration when a chapter is selected again or revisited', async () => {
    const viewer = createMockViewer();
    // Mirrors the real player: stopping a segment settles its pending promise
    // with false, which is what re-selecting a chapter triggers.
    let pendingResolve: ((ok: boolean) => void) | null = null;
    const mockNarration = {
      playSegment: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            pendingResolve = resolve;
          }),
      ),
      stop: vi.fn(() => {
        pendingResolve?.(false);
        pendingResolve = null;
      }),
      pause: vi.fn().mockReturnValue(true),
      resume: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(false),
    };
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      createNarrationPlayer: () => mockNarration as any,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });

    const narrStory: StoryWithDefaults = {
      narration: { tracks: { en: { src: 'audio.mp3' } } },
      chapters: [
        {
          id: 'n1',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          narrationSegment: { en: { start: 0, end: 5 } },
          transitionTimeMs: 200,
        },
        {
          id: 'n2',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          narrationSegment: { en: { start: 5, end: 10 } },
          transitionTimeMs: 200,
        },
      ],
    };

    await runtime.loadStory(narrStory);
    runtime.play();
    expect(mockNarration.playSegment).toHaveBeenCalledTimes(1);

    // Selecting the chapter that is already playing must restart it.
    await runtime.loadChapter(0, { autoPlay: true });
    await Promise.resolve();
    expect(mockNarration.playSegment).toHaveBeenCalledTimes(2);
    expect(runtime.getState()).toBe('PLAYING_NARRATION');

    // Going forward and then back again must narrate each time.
    await runtime.loadChapter(1, { autoPlay: true });
    await Promise.resolve();
    expect(mockNarration.playSegment).toHaveBeenCalledTimes(3);

    await runtime.loadChapter(0, { autoPlay: true });
    await Promise.resolve();
    expect(mockNarration.playSegment).toHaveBeenCalledTimes(4);
    expect(runtime.getState()).toBe('PLAYING_NARRATION');

    runtime.destroy();
  });

  it('advances as soon as narration ends when the camera track has no points', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    let finishNarration: ((ok: boolean) => void) | undefined;
    const mockNarration = {
      playSegment: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            finishNarration = resolve;
          }),
      ),
      stop: vi.fn(),
      pause: vi.fn().mockReturnValue(true),
      resume: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(true),
      getCurrentTime: vi.fn(() => 0),
    };
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      createNarrationPlayer: () => mockNarration as any,
      posePaintedTimeoutMs: 50,
      sourceOpenTimeoutMs: 50,
    });
    const emptyTrackStory: StoryWithDefaults = {
      narration: { tracks: { en: { src: 'narration.mp3' } } },
      chapters: [
        {
          id: 'empty-track',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          narrationSegment: { en: { start: 0, end: 4.67 } },
          // Authored by opening the motion tools without placing any points.
          cameraTrack: { durationMs: 8000, preset: 'custom', keyframes: [] },
          advance: { mode: 'auto', delayMs: 0 },
          transitionTimeMs: 0,
        },
        {
          id: 'next',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          advance: { mode: 'manual' },
        },
      ],
    };

    const loadPromise = runtime.loadStory(emptyTrackStory);
    await vi.advanceTimersByTimeAsync(200);
    await loadPromise;

    runtime.play();
    finishNarration?.(true);
    await Promise.resolve();
    await Promise.resolve();

    // The empty 8s track must not hold the chapter for a further 3.3s after
    // the narration has finished, with nothing moving on screen.
    expect(runtime.getState()).not.toBe('PRESENTING_SILENT');

    runtime.destroy();
    vi.useRealTimers();
  });

  it('lets the newest chapter win when selections overlap', async () => {
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 50,
      sourceOpenTimeoutMs: 50,
    });
    const rapidStory: StoryWithDefaults = {
      chapters: [
        { id: 'a', manifest: 'm1', canvasIndex: 0, viewBox: { x: 0, y: 0, w: 10, h: 10 } },
        { id: 'b', manifest: 'm1', canvasIndex: 0, viewBox: { x: 20, y: 0, w: 10, h: 10 } },
        { id: 'c', manifest: 'm1', canvasIndex: 0, viewBox: { x: 40, y: 0, w: 10, h: 10 } },
      ],
    };

    await runtime.loadStory(rapidStory);

    let observedIndex = -1;
    const unsubscribe = runtime.currentChapterIndex.subscribe((value: any) => {
      observedIndex = value ?? 0;
    });

    // Clicking through the chapter strip faster than transitions complete.
    // Superseded loads settle rather than hang, so each one must stand down
    // instead of applying its chapter after a newer one has taken over.
    const first = runtime.loadChapter(1);
    const second = runtime.loadChapter(2);
    await Promise.all([first, second]);

    expect(observedIndex).toBe(2);

    let loading = true;
    const unsubscribeLoading = runtime.isLoading.subscribe((value: any) => {
      loading = value;
    });
    expect(loading).toBe(false);

    unsubscribeLoading();
    unsubscribe();
    runtime.destroy();
  });

  it('keeps time and motion running when jumping back to an earlier chapter', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    // The shared audio element still reports the later chapter's position
    // until the backwards seek lands.
    const narrationTime = 20;
    const mockNarration = {
      playSegment: vi.fn(() => new Promise<boolean>(() => {})),
      stop: vi.fn(),
      pause: vi.fn().mockReturnValue(true),
      resume: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(true),
      getCurrentTime: vi.fn(() => narrationTime),
    };
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      createNarrationPlayer: () => mockNarration as any,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });
    const jumpStory: StoryWithDefaults = {
      narration: { tracks: { en: { src: 'narration.mp3' } } },
      chapters: [
        {
          id: 'early',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          narrationSegment: { en: { start: 0, end: 5 } },
          presentationDurationMs: 5000,
          cameraTrack: {
            durationMs: 5000,
            preset: 'pan',
            easing: 'linear',
            keyframes: [
              { id: 'a', timeMs: 0, viewBox: { x: 0, y: 0, w: 50, h: 50 } },
              { id: 'b', timeMs: 5000, viewBox: { x: 400, y: 0, w: 50, h: 50 } },
            ],
          },
          advance: { mode: 'manual' },
        },
        {
          id: 'later',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          narrationSegment: { en: { start: 20, end: 25 } },
          advance: { mode: 'manual' },
        },
      ],
    };

    const loadPromise = runtime.loadStory(jumpStory);
    await vi.advanceTimersByTimeAsync(150);
    await loadPromise;

    const laterLoad = runtime.loadChapter(1, { autoPlay: true });
    await vi.advanceTimersByTimeAsync(300);
    await laterLoad;

    // Jump back to the first chapter while the element still reads 20s.
    viewer.setViewBox.mockClear();
    const backLoad = runtime.loadChapter(0, { autoPlay: true });
    await vi.advanceTimersByTimeAsync(300);
    await backLoad;
    await vi.advanceTimersByTimeAsync(100);

    // The chapter must actually be presenting, not skipped to its end.
    expect(runtime.getState()).toBe('PLAYING_NARRATION');
    const playback = runtime.playbackState;
    let observed = { currentTime: 0, duration: 0 };
    const unsubscribe = playback.subscribe((value: any) => {
      observed = value;
    });
    expect(observed.duration).toBeGreaterThan(4);
    expect(observed.currentTime).toBeLessThan(1);

    // And the camera must be near the start of its track, not the far end.
    const framings = viewer.setViewBox.mock.calls.map(([box]: [any]) => box);
    expect(framings.length).toBeGreaterThan(0);
    expect(framings.at(-1).x).toBeLessThan(100);

    unsubscribe();
    runtime.destroy();
    vi.useRealTimers();
  });

  it('plays camera motion with narration, then waits before advancing', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    let narrationTime = 0;
    let finishNarration: ((ok: boolean) => void) | undefined;
    const mockNarration = {
      playSegment: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            finishNarration = resolve;
          }),
      ),
      stop: vi.fn(),
      pause: vi.fn().mockReturnValue(true),
      resume: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(true),
      getCurrentTime: vi.fn(() => narrationTime),
    };
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      createNarrationPlayer: () => mockNarration as any,
      now: () => Date.now(),
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });
    const motionStory: StoryWithDefaults = {
      narration: { tracks: { en: { src: 'narration.mp3' } } },
      chapters: [
        {
          id: 'moving',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          transitionTimeMs: 0,
          presentationDurationMs: 1000,
          narrationSegment: { en: { start: 0, end: 1 } },
          cameraTrack: {
            durationMs: 1000,
            preset: 'pan',
            easing: 'linear',
            keyframes: [
              { id: 'start', timeMs: 0, viewBox: { x: 25, y: 0, w: 80, h: 80 } },
              { id: 'end', timeMs: 1000, viewBox: { x: 100, y: 0, w: 100, h: 100 } },
            ],
          },
          advance: { mode: 'auto', delayMs: 500 },
        },
        {
          id: 'next',
          manifest: 'm1',
          canvasIndex: 1,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          transitionTimeMs: 0,
          advance: { mode: 'manual' },
        },
      ],
    };

    const loadPromise = runtime.loadStory(motionStory);
    await vi.advanceTimersByTimeAsync(150);
    await loadPromise;
    expect(viewer.setViewBox).toHaveBeenCalledWith({ x: 25, y: 0, w: 80, h: 80 });
    viewer.setViewBox.mockClear();
    viewer.setCanvasByIndex.mockClear();

    runtime.play();
    narrationTime = 0.5;
    await vi.advanceTimersByTimeAsync(60);
    expect(mockNarration.playSegment).toHaveBeenCalledTimes(1);
    expect(viewer.setViewBox.mock.calls.some(([box]) => box.x > 0 && box.x < 100)).toBe(true);

    narrationTime = 1;
    finishNarration?.(true);
    await Promise.resolve();
    expect(runtime.getState()).toBe('TRANSITION_DELAY');
    await vi.advanceTimersByTimeAsync(499);
    expect(viewer.setCanvasByIndex).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(viewer.setCanvasByIndex).toHaveBeenCalledWith(1);

    runtime.destroy();
    vi.useRealTimers();
  });

  it('pause preserves timer and resumes media', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      now: () => Date.now(),
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });
    const silent: StoryWithDefaults = {
      chapters: [
        {
          id: 's1',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          transitionTimeMs: 200,
        },
        {
          id: 's2',
          manifest: 'm1',
          canvasIndex: 1,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          transitionTimeMs: 200,
        },
      ],
    };
    const loadPromise = runtime.loadStory(silent);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);
    await loadPromise;
    await vi.advanceTimersByTimeAsync(110);
    runtime.play();
    await vi.advanceTimersByTimeAsync(100);
    runtime.pause();
    await vi.advanceTimersByTimeAsync(200);
    runtime.play();
    await vi.advanceTimersByTimeAsync(120);
    await vi.runAllTimersAsync();
    expect(runtime.getState()).not.toBe('PAUSED');
    vi.useRealTimers();
  });

  it('chapter click stops media playback and stays idle', async () => {
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });
    const mediaStory: StoryWithDefaults = {
      chapters: [
        {
          id: 'm1',
          manifest: 'm1',
          canvasIndex: 0,
          media: { start: 0, end: 2 },
          transitionTimeMs: 100,
        },
        {
          id: 'm2',
          manifest: 'm1',
          canvasIndex: 1,
          media: { start: 0, end: 2 },
          transitionTimeMs: 100,
        },
      ],
    };
    await runtime.loadStory(mediaStory);
    runtime.play();
    await runtime.loadChapter(1);
    expect(runtime.getState()).toBe('IDLE');
  });

  it('sets ENDED at story end and play restarts last chapter', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      now: () => Date.now(),
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });
    const silentOneChapter: StoryWithDefaults = {
      chapters: [
        {
          id: 'last',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          transitionTimeMs: 100,
        },
      ],
    };
    const loadPromise = runtime.loadStory(silentOneChapter);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);
    await loadPromise;
    runtime.play();
    await vi.advanceTimersByTimeAsync(210);
    expect(runtime.getState()).toBe('ENDED');
    runtime.play();
    expect(runtime.getState()).not.toBe('ENDED');
    vi.useRealTimers();
  });

  it('stop resets to first chapter start', async () => {
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });
    await runtime.loadStory(story);
    await runtime.loadChapter(2);
    runtime.stop();
    // Wait for loadChapter(0) to complete
    await vi.waitFor(() => {
      expect(runtime.getState()).toBe('IDLE');
    });
    expect(runtime.getStory()?.chapters[0].id).toBe('chap-1');
    // After stop, chapter 0 should be loaded with its manifest
    expect(viewer.setManifest).toHaveBeenCalledWith(story.chapters[0].manifest);
  });

  it('waits for manifestChange and pageChange events before applying viewBox', async () => {
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });

    const storyWithManifestChange: StoryWithDefaults = {
      chapters: [
        {
          id: 'c1',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          transitionTimeMs: 100,
        },
        {
          id: 'c2',
          manifest: 'm2',
          canvasIndex: 0,
          viewBox: { x: 10, y: 10, w: 50, h: 50 },
          transitionTimeMs: 100,
        },
        {
          id: 'c3',
          manifest: 'm2',
          canvasIndex: 1,
          viewBox: { x: 20, y: 20, w: 30, h: 30 },
          transitionTimeMs: 100,
        },
      ],
    };

    await runtime.loadStory(storyWithManifestChange);

    // Switching to chapter 2 (different manifest)
    const loadChapter2Promise = runtime.loadChapter(1);

    // Wait a bit, setViewBox should NOT be called yet
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(viewer.setViewBox).toHaveBeenCalledTimes(1); // Only from initial load

    // Wait for events to fire
    await loadChapter2Promise;

    // Now setViewBox should have been called with chapter 2's viewBox
    expect(viewer.setViewBox).toHaveBeenCalledWith(storyWithManifestChange.chapters[1].viewBox);
    expect(viewer.setManifest).toHaveBeenCalledWith('m2');

    // Switching to chapter 3 (same manifest, different canvas)
    await runtime.loadChapter(2);

    // ViewBox should be applied after pageChange
    expect(viewer.setViewBox).toHaveBeenCalledWith(storyWithManifestChange.chapters[2].viewBox);
    expect(viewer.setCanvasByIndex).toHaveBeenCalledWith(1);
  });

  it('updates manifest when chapter selection changes after rapid transitions', async () => {
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      posePaintedTimeoutMs: 100,
      sourceOpenTimeoutMs: 100,
    });

    const testStory: StoryWithDefaults = {
      chapters: [
        { id: 'c1', manifest: 'm1', canvasIndex: 0, transitionTimeMs: 100 },
        { id: 'c2', manifest: 'm2', canvasIndex: 0, transitionTimeMs: 100 },
        { id: 'c3', manifest: 'm1', canvasIndex: 1, transitionTimeMs: 100 },
      ],
    };

    await runtime.loadStory(testStory);
    // Chapter 0 loaded with manifest 'm1'

    // Start loading chapter 1 (manifest 'm2') - this should trigger setManifest('m2')
    const promise1 = runtime.loadChapter(1);
    // Immediately start loading chapter 2 (manifest 'm1') before chapter 1 completes
    // This cancels the chapter 1 transition, but setManifest('m2') may have already been called
    const promise2 = runtime.loadChapter(2);

    await promise1; // Should resolve even though cancelled
    await promise2; // Should complete successfully

    // After both transitions, we should end up on chapter 2 with manifest 'm1'
    // The manifest should have been set correctly for chapter 2
    // This test ensures that even if the viewer's manifest changed during the cancelled transition,
    // the orchestrator correctly detects and updates to chapter 2's manifest
    const allManifestCalls = viewer.setManifest.mock.calls;
    const lastManifestCall = allManifestCalls[allManifestCalls.length - 1];

    // The last setManifest call should be for 'm1' (chapter 2)
    expect(lastManifestCall[0]).toBe('m1');
    expect(viewer.setCanvasByIndex).toHaveBeenLastCalledWith(1);
  });
});

describe('storyViewerController timeline', () => {
  it('keeps the chapter timeline moving forward across narration and the transition delay', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    let narrationTime = 0;
    let finishNarration: ((ok: boolean) => void) | undefined;
    const mockNarration = {
      playSegment: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            finishNarration = resolve;
          }),
      ),
      stop: vi.fn(),
      pause: vi.fn().mockReturnValue(true),
      resume: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(true),
      getCurrentTime: vi.fn(() => narrationTime),
    };
    const runtime = createStoryViewerRuntime(viewer as any, {
      // These cover sequencing, not the source-change fade.
      crossfadeMs: 0,
      createNarrationPlayer: () => mockNarration as any,
      posePaintedTimeoutMs: 50,
      sourceOpenTimeoutMs: 50,
    });

    // Five seconds of narration followed by a five second hold — the shape the
    // builder writes by default, where a shrinking denominator would send the
    // fill back to exactly the midpoint.
    const timelineStory: StoryWithDefaults = {
      narration: { tracks: { en: { src: 'narration.mp3' } } },
      chapters: [
        {
          id: 't1',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          narrationSegment: { en: { start: 0, end: 5 } },
          advance: { mode: 'auto', delayMs: 5000 },
          transitionTimeMs: 5000,
        },
        {
          id: 't2',
          manifest: 'm1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          transitionTimeMs: 5000,
        },
      ],
    };

    const samples: { currentTime: number; duration: number }[] = [];
    const unsubscribe = runtime.playbackState.subscribe((value: any) => {
      if (value) samples.push({ currentTime: value.currentTime, duration: value.duration });
    });

    const load = runtime.loadStory(timelineStory);
    await vi.advanceTimersByTimeAsync(200);
    await load;
    runtime.play();

    // Play out the narration.
    for (let step = 0; step < 5; step += 1) {
      narrationTime += 1;
      await vi.advanceTimersByTimeAsync(1000);
    }
    const duringNarration = samples[samples.length - 1];
    expect(duringNarration.duration).toBeCloseTo(10, 3);

    finishNarration?.(true);
    await vi.advanceTimersByTimeAsync(0);

    // And the hold that follows it.
    await vi.advanceTimersByTimeAsync(2000);
    const duringDelay = samples[samples.length - 1];
    expect(duringDelay.duration).toBeCloseTo(10, 3);
    expect(duringDelay.currentTime).toBeGreaterThan(5);

    // The denominator is fixed for the whole chapter, so the fill only grows.
    const chapterSamples = samples.filter((sample) => sample.duration > 0);
    const fractions = chapterSamples.map((sample) => sample.currentTime / sample.duration);
    const regressions = fractions.filter(
      (fraction, index) => index > 0 && fraction < fractions[index - 1] - 1e-9,
    );
    expect(regressions).toEqual([]);
    expect(new Set(chapterSamples.map((sample) => sample.duration)).size).toBe(1);

    unsubscribe();
    runtime.destroy();
    vi.useRealTimers();
  });
});

describe('storyViewerController stage crossfade', () => {
  const fadeStory: StoryWithDefaults = {
    chapters: [
      {
        id: 'f1',
        manifest: 'm1',
        canvasIndex: 0,
        canvasId: 'canvas-0',
        viewBox: { x: 0, y: 0, w: 10, h: 10 },
        transitionTimeMs: 200,
      },
      {
        id: 'f2',
        manifest: 'm1',
        canvasIndex: 1,
        canvasId: 'canvas-1',
        viewBox: { x: 5, y: 5, w: 10, h: 10 },
        transitionTimeMs: 200,
      },
    ],
  };

  it('hides the stage before swapping the canvas and reveals it once framed', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      crossfadeMs: 100,
      posePaintedTimeoutMs: 50,
      sourceOpenTimeoutMs: 50,
    });

    const fades: { opacity: number; durationMs: number }[] = [];
    const unsubscribe = runtime.stageFade.subscribe((value: any) => {
      fades.push({ opacity: value.opacity, durationMs: value.durationMs });
    });

    const load = runtime.loadStory(fadeStory);
    await vi.advanceTimersByTimeAsync(400);
    await load;

    viewer.setCanvasById.mockClear();
    viewer.setCanvasByIndex.mockClear();
    fades.length = 0;

    const toSecond = runtime.loadChapter(1);
    // Part-way into the ramp the stage is hidden and nothing has moved yet.
    await vi.advanceTimersByTimeAsync(50);
    expect(fades[0]?.opacity).toBe(0);
    expect(fades[0]?.durationMs).toBe(100);
    expect(viewer.setCanvasById).not.toHaveBeenCalled();
    expect(viewer.setCanvasByIndex).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400);
    await toSecond;

    // The swap happened while hidden, and the reveal is the last thing to run.
    expect(viewer.setCanvasById).toHaveBeenCalled();
    expect(fades[fades.length - 1].opacity).toBe(1);

    unsubscribe();
    runtime.destroy();
    vi.useRealTimers();
  });

  it('leaves the stage alone when the chapter stays on the same canvas', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      crossfadeMs: 100,
      posePaintedTimeoutMs: 50,
      sourceOpenTimeoutMs: 50,
    });

    const sameCanvasStory: StoryWithDefaults = {
      chapters: [
        { ...fadeStory.chapters[0] },
        { ...fadeStory.chapters[1], canvasIndex: 0, canvasId: 'canvas-0' },
      ],
    };

    const load = runtime.loadStory(sameCanvasStory);
    await vi.advanceTimersByTimeAsync(400);
    await load;

    const fades: number[] = [];
    const unsubscribe = runtime.stageFade.subscribe((value: any) => {
      fades.push(value.opacity);
    });

    const toSecond = runtime.loadChapter(1);
    await vi.advanceTimersByTimeAsync(400);
    await toSecond;

    expect(fades.every((opacity) => opacity === 1)).toBe(true);

    unsubscribe();
    runtime.destroy();
    vi.useRealTimers();
  });

  it('never leaves the stage hidden when a transition is superseded', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
      crossfadeMs: 100,
      posePaintedTimeoutMs: 50,
      sourceOpenTimeoutMs: 50,
    });

    const load = runtime.loadStory(fadeStory);
    await vi.advanceTimersByTimeAsync(400);
    await load;

    let opacity = 1;
    const unsubscribe = runtime.stageFade.subscribe((value: any) => {
      opacity = value.opacity;
    });

    // Interrupt mid-fade, then let everything settle.
    const first = runtime.loadChapter(1);
    await vi.advanceTimersByTimeAsync(40);
    const second = runtime.loadChapter(0);
    await vi.advanceTimersByTimeAsync(600);
    await first;
    await second;

    expect(opacity).toBe(1);

    unsubscribe();
    runtime.destroy();
    vi.useRealTimers();
  });
});
