/**
 * Chapter Transition Orchestrator
 */

import type { ViewerApi } from '../../core/types/viewer-api';
import type { StoryWithDefaults } from './storyLoader';
import type { ViewBox } from '../../core/types/viewer';
import type { ModelPose } from '../../core/types/model';
import { isViewBoxEqual, panToViewBox } from './canvasPanner';
import { animateLayerOpacities } from '../viewBoxAnimation';
import { createTransitionGuard, type GateResult } from './transitionGuard';

export type TransitionEventMap = {
  'transition:start': { chapterId: string; runId: string };
  'transition:assetsLoading': { chapterId: string; runId: string };
  'transition:sourceOpen': { chapterId: string; runId: string };
  'transition:poseApplied': { chapterId: string; runId: string };
  'transition:posePainted': { chapterId: string; runId: string; degraded: boolean };
  'transition:narrationStarted': { chapterId: string; runId: string };
  'transition:mediaStarted': { chapterId: string; runId: string };
  'transition:ready': { chapterId: string; runId: string };
  'transition:cancelled': { chapterId: string; runId: string };
  'transition:error': { chapterId: string; runId: string; error: Error };
};

export type TransitionEventHandler<K extends keyof TransitionEventMap> = (
  payload: TransitionEventMap[K]
) => void;

type EventHandlers = {
  [K in keyof TransitionEventMap]?: TransitionEventHandler<K>[];
};

type TransitionOptions = {
  autoPlay?: boolean;
};

type TransitionGateConfig = {
  posePaintedTimeoutMs?: number;
  sourceOpenTimeoutMs?: number;
};

export type ChapterTransitionOrchestrator = {
  loadChapter: (index: number, options?: TransitionOptions) => Promise<void>;
  cancelCurrentTransition: () => void;
  on: <K extends keyof TransitionEventMap>(
    event: K,
    handler: TransitionEventHandler<K>
  ) => () => void;
  off: <K extends keyof TransitionEventMap>(
    event: K,
    handler: TransitionEventHandler<K>
  ) => void;
  getCurrentRunId: () => string | null;
  destroy: () => void;
};

type RuntimeDeps = {
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
};

export const createChapterTransitionOrchestrator = (
  viewer: ViewerApi,
  story: StoryWithDefaults,
  deps: RuntimeDeps & TransitionGateConfig = {}
): ChapterTransitionOrchestrator => {
  const {
    now = () => Date.now(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    requestAnimationFrame: rAF = globalThis.requestAnimationFrame?.bind(globalThis),
    cancelAnimationFrame: cAF = globalThis.cancelAnimationFrame?.bind(globalThis),
    posePaintedTimeoutMs = 500,
    sourceOpenTimeoutMs = 500,
  } = deps;

  let currentRunId: string | null = null;
  let currentManifest: string | null = null;
  let currentChapterIndex = 0;
  let cancelViewBoxAnimation: (() => void) | null = null;
  let cancelLayersAnimation: (() => void) | null = null;
  const eventHandlers: EventHandlers = {};
  const activeCleanups: (() => void)[] = [];

  const guard = createTransitionGuard(
    viewer,
    {
      setTimeoutFn,
      clearTimeoutFn,
      requestAnimationFrame: rAF,
      cancelAnimationFrame: cAF,
      posePaintedTimeoutMs,
      sourceOpenTimeoutMs,
    },
    {
      currentRunId: () => currentRunId,
      registerCleanup: (cleanup) => activeCleanups.push(cleanup),
    }
  );

  const emit = <K extends keyof TransitionEventMap>(
    event: K,
    payload: TransitionEventMap[K]
  ): void => {
    const handlers = eventHandlers[event];
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        (handler as TransitionEventHandler<K>)(payload);
      } catch (err) {
        console.error(`[Orchestrator] Error in ${event} handler:`, err);
      }
    });
  };

  const on = <K extends keyof TransitionEventMap>(
    event: K,
    handler: TransitionEventHandler<K>
  ): (() => void) => {
    if (!eventHandlers[event]) eventHandlers[event] = [];
    (eventHandlers[event] as TransitionEventHandler<K>[]).push(handler);
    return () => off(event, handler);
  };

  const off = <K extends keyof TransitionEventMap>(
    event: K,
    handler: TransitionEventHandler<K>
  ): void => {
    const handlers = eventHandlers[event];
    if (!handlers) return;
    const index = handlers.indexOf(handler as never);
    if (index > -1) handlers.splice(index, 1);
  };

  const cleanup = () => {
    activeCleanups.forEach((fn) => fn());
    activeCleanups.length = 0;
    if (cancelViewBoxAnimation) {
      cancelViewBoxAnimation();
      cancelViewBoxAnimation = null;
    }
    if (cancelLayersAnimation) {
      cancelLayersAnimation();
      cancelLayersAnimation = null;
    }
  };

  const cancelCurrentTransition = () => {
    if (!currentRunId) return;
    const runId = currentRunId;
    const chapter = story.chapters[currentChapterIndex];
    cleanup();
    emit('transition:cancelled', { chapterId: chapter?.id ?? '', runId });
    currentRunId = null;
  };

  const generateRunId = (): string => `run-${now()}-${Math.random().toString(36).substring(2, 9)}`;

  const applyModelPose = (pose: ModelPose) => {
    viewer.setModelPose?.(pose);
    if (pose.cameraOrbit) viewer.setModelOrbit?.(pose.cameraOrbit);
    if (pose.cameraTarget) viewer.setModelTarget?.(pose.cameraTarget);
    if (pose.orientation) viewer.setModelOrientation?.(pose.orientation);
  };

  const loadChapter = async (
    index: number,
    _options: TransitionOptions = {}
  ): Promise<void> => {
    cancelCurrentTransition();

    const chapter = story.chapters[index];
    if (!chapter) throw new Error(`Chapter ${index} not found`);

    const runId = generateRunId();
    currentRunId = runId;
    currentChapterIndex = index;

    const checkCancelled = () => currentRunId !== runId;

    try {
      emit('transition:start', { chapterId: chapter.id, runId });
      emit('transition:assetsLoading', { chapterId: chapter.id, runId });

      if (viewer.getManifestId) currentManifest = viewer.getManifestId() ?? null;

      let manifestChanged = false;

      if (chapter.manifest && chapter.manifest !== currentManifest) {
        viewer.setManifest?.(chapter.manifest);
        manifestChanged = true;

        const manifestResult = await guard.waitForManifestChange(runId, chapter.manifest);
        if (checkCancelled()) return;
        if (manifestResult.degraded) console.warn('[Orchestrator] Manifest loaded with degraded certainty');

        if (typeof chapter.canvasIndex === 'number') {
          const canvasResult = await guard.waitForCanvasesAvailable(runId, chapter.canvasIndex);
          if (checkCancelled()) return;
          if (canvasResult.degraded) console.warn('[Orchestrator] Canvases loaded with degraded certainty');
        }

        currentManifest = chapter.manifest;
      }

      const currentCanvasIndex = viewer.getCanvasIndex?.() ?? -1;
      const pageChanged = typeof chapter.canvasIndex === 'number' && chapter.canvasIndex !== currentCanvasIndex;


      if (typeof chapter.canvasIndex === 'number') {
        viewer.setCanvasByIndex?.(chapter.canvasIndex);
        const pageChangeResult: GateResult = await guard.waitForPageChange(
          runId,
          chapter.canvasIndex,
          manifestChanged
        );
        if (checkCancelled()) return;
        if (pageChangeResult.degraded) console.warn('[Orchestrator] Page changed with degraded certainty');
      }

      emit('transition:sourceOpen', { chapterId: chapter.id, runId });

      const sameCanvas = !manifestChanged && !pageChanged;

      if (sameCanvas && chapter.layerOpacities) {
        if (cancelLayersAnimation) {
          cancelLayersAnimation();
          cancelLayersAnimation = null;
        }
        const fromOpacities = viewer.getLayerOpacities?.() ?? {};

        cancelLayersAnimation = animateLayerOpacities(viewer, fromOpacities, chapter.layerOpacities, 1000, {
          now,
          requestAnimationFrame: rAF,
          cancelAnimationFrame: cAF,
        });
      } else if (chapter.layerOpacities) {
        if (cancelLayersAnimation) {
          cancelLayersAnimation();
          cancelLayersAnimation = null;
        }

        for (const [id, opacity] of Object.entries(chapter.layerOpacities)) {
          viewer.updateLayerOpacity?.(id, opacity);
        }
      }

      if (chapter.viewBox) {
        const currentViewBox = viewer.getViewBox?.();
        const targetViewBox = chapter.viewBox as ViewBox;
        if (!isViewBoxEqual(currentViewBox, targetViewBox)) {
          const stabilityResult = await guard.waitForContainerStable(runId);
          if (checkCancelled()) return;
          if (stabilityResult.degraded) {
            console.warn('[Orchestrator] Container stability check degraded - viewBox may not be optimal');
          }
        }
      }

      if (chapter.viewBox) {
        const currentViewBox = viewer.getViewBox?.();
        const targetViewBox = chapter.viewBox as ViewBox;
        const viewBoxUnchanged = isViewBoxEqual(currentViewBox, targetViewBox);

        if (!viewBoxUnchanged) {
          if (cancelViewBoxAnimation) {
            cancelViewBoxAnimation();
            cancelViewBoxAnimation = null;
          }
          cancelViewBoxAnimation = panToViewBox(viewer, targetViewBox, manifestChanged, {
            now,
            requestAnimationFrame: rAF,
            cancelAnimationFrame: cAF,
          });
        }
      } else if (chapter.model) {
        applyModelPose(chapter.model);
      } else if (chapter.media) {
        viewer.seekTo?.(chapter.media.start);
      }

      if (checkCancelled()) return;
      emit('transition:poseApplied', { chapterId: chapter.id, runId });

      const needsPosePainted = Boolean(chapter.viewBox || chapter.model);
      let posePaintedResult: GateResult = { ok: true, degraded: false };
      if (needsPosePainted) {
        posePaintedResult = await guard.waitForPosePainted(runId);
        if (checkCancelled()) return;
      }

      emit('transition:posePainted', {
        chapterId: chapter.id,
        runId,
        degraded: posePaintedResult.degraded,
      });

      emit('transition:ready', { chapterId: chapter.id, runId });
    } catch (error) {
      if (checkCancelled()) return;
      emit('transition:error', {
        chapterId: chapter.id,
        runId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  };

  const getCurrentRunId = () => currentRunId;

  const destroy = () => {
    cancelCurrentTransition();
    Object.keys(eventHandlers).forEach((key) => {
      delete eventHandlers[key as keyof TransitionEventMap];
    });
  };

  return {
    loadChapter,
    cancelCurrentTransition,
    on,
    off,
    getCurrentRunId,
    destroy,
  };
};
