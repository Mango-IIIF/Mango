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

    expect(viewer.setCanvasById).toHaveBeenCalledWith(
      'https://example.org/canvas/stable',
    );
    expect(viewer.setCanvasByIndex).not.toHaveBeenCalled();
  });

  it('auto advances silent chapters after transitionTimeMs', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
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
    await runtime.loadChapter(1);
    expect(viewer.setCanvasByIndex).toHaveBeenCalledTimes(3);
  });

  it('pause preserves timer and resumes media', async () => {
    vi.useFakeTimers();
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
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
    await vi.advanceTimersByTimeAsync(110);
    expect(runtime.getState()).toBe('ENDED');
    runtime.play();
    expect(runtime.getState()).not.toBe('ENDED');
    vi.useRealTimers();
  });

  it('stop resets to first chapter start', async () => {
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
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
    expect(viewer.setViewBox).toHaveBeenCalledWith(
      storyWithManifestChange.chapters[1].viewBox,
    );
    expect(viewer.setManifest).toHaveBeenCalledWith('m2');

    // Switching to chapter 3 (same manifest, different canvas)
    await runtime.loadChapter(2);

    // ViewBox should be applied after pageChange
    expect(viewer.setViewBox).toHaveBeenCalledWith(
      storyWithManifestChange.chapters[2].viewBox,
    );
    expect(viewer.setCanvasByIndex).toHaveBeenCalledWith(1);
  });

  it('updates manifest when chapter selection changes after rapid transitions', async () => {
    const viewer = createMockViewer();
    const runtime = createStoryViewerRuntime(viewer as any, {
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
