/**
 * Chapter Transition Orchestrator
 */

import type { ViewerApi } from '../../core/types/viewer-api';
import type { StoryWithDefaults } from './storyLoader';
import type { ViewBox } from '../../core/types/viewer';
import type { ModelPose, ModelPoseOptions } from '../../core/types/model';
import { isViewBoxEqual, panToViewBox } from './canvasPanner';
import { animateLayerOpacities } from '../viewBoxAnimation';
import { createTransitionGuard, type GateResult } from './transitionGuard';

export type TransitionEventMap = {
  'transition:start': { chapterId: string; runId: string };
  'transition:assetsLoading': { chapterId: string; runId: string };
  'transition:sourceOpen': { chapterId: string; runId: string };
  'transition:poseApplied': { chapterId: string; runId: string };
  'transition:posePainted': {
    chapterId: string;
    runId: string;
    degraded: boolean;
  };
  'transition:narrationStarted': { chapterId: string; runId: string };
  'transition:mediaStarted': { chapterId: string; runId: string };
  'transition:ready': { chapterId: string; runId: string };
  'transition:cancelled': { chapterId: string; runId: string };
  'transition:error': { chapterId: string; runId: string; error: Error };
};

export type TransitionEventHandler<K extends keyof TransitionEventMap> = (
  payload: TransitionEventMap[K],
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

/**
 * Hides or reveals the stage. Called with the ramp length so the consumer can
 * match its own transition to the wait the orchestrator performs.
 */
type StageFader = (visible: boolean, durationMs: number) => void;

/**
 * How long the stage takes to fade each way around a source change.
 *
 * Deliberately not read from `entryTransition.durationMs`: that field still
 * carries the legacy `transitionTimeMs`, which is a presentation length
 * measured in seconds, and ramping opacity over two seconds reads as a fault
 * rather than a transition.
 */
export const STAGE_CROSSFADE_MS = 260;

export type ChapterTransitionOrchestrator = {
  loadChapter: (index: number, options?: TransitionOptions) => Promise<void>;
  cancelCurrentTransition: () => void;
  on: <K extends keyof TransitionEventMap>(
    event: K,
    handler: TransitionEventHandler<K>,
  ) => () => void;
  off: <K extends keyof TransitionEventMap>(event: K, handler: TransitionEventHandler<K>) => void;
  getCurrentRunId: () => string | null;
  destroy: () => void;
};

type RuntimeDeps = {
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
  stageFader?: StageFader;
  crossfadeMs?: number;
};

export const createChapterTransitionOrchestrator = (
  viewer: ViewerApi,
  story: StoryWithDefaults,
  deps: RuntimeDeps & TransitionGateConfig = {},
): ChapterTransitionOrchestrator => {
  const {
    now = () => Date.now(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    requestAnimationFrame: rAF = globalThis.requestAnimationFrame?.bind(globalThis),
    cancelAnimationFrame: cAF = globalThis.cancelAnimationFrame?.bind(globalThis),
    posePaintedTimeoutMs = 500,
    sourceOpenTimeoutMs = 500,
    stageFader,
    crossfadeMs = STAGE_CROSSFADE_MS,
  } = deps;

  let currentRunId: string | null = null;
  let currentManifest: string | null = null;
  let currentChapterIndex = 0;
  let cancelViewBoxAnimation: (() => void) | null = null;
  let cancelLayersAnimation: (() => void) | null = null;
  let stageHidden = false;
  const eventHandlers: EventHandlers = {};
  const activeCleanups: (() => void)[] = [];

  /**
   * The stage must never be left hidden. Every exit from a transition — normal,
   * cancelled or failed — runs through here.
   */
  const revealStage = (durationMs = crossfadeMs) => {
    if (!stageFader || !stageHidden) return;
    stageHidden = false;
    stageFader(true, durationMs);
  };

  const hideStage = () => {
    if (!stageFader || stageHidden) return;
    stageHidden = true;
    stageFader(false, crossfadeMs);
  };

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      if (ms <= 0) {
        resolve();
        return;
      }
      const handle = setTimeoutFn(() => resolve(), ms);
      // A superseded transition settles its waits rather than stranding them.
      activeCleanups.push(() => {
        clearTimeoutFn(handle);
        resolve();
      });
    });

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
    },
  );

  const emit = <K extends keyof TransitionEventMap>(
    event: K,
    payload: TransitionEventMap[K],
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
    handler: TransitionEventHandler<K>,
  ): (() => void) => {
    if (!eventHandlers[event]) eventHandlers[event] = [];
    (eventHandlers[event] as TransitionEventHandler<K>[]).push(handler);
    return () => off(event, handler);
  };

  const off = <K extends keyof TransitionEventMap>(
    event: K,
    handler: TransitionEventHandler<K>,
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

  /**
   * Whether a chapter opens on a different canvas than the one on screen.
   *
   * The stored canvasId cannot be trusted on its own. When a chapter is
   * captured without one, the serializer writes a synthetic
   * `${manifest}/canvas/${index}` into the target and the loader reads it back
   * as the chapter's canvasId — an ID that no manifest ever contains, so
   * comparing it to the viewer reports a change on every single chapter. The
   * index is the value that synthetic ID was built from, so where a chapter has
   * one it decides, and the ID only settles the case of a real ID that matches
   * or a chapter carrying no index at all.
   */
  const targetsAnotherCanvas = (chapter: StoryWithDefaults['chapters'][number]): boolean => {
    const currentCanvasId = viewer.getCanvasId?.() ?? null;
    if (chapter.canvasId && chapter.canvasId === currentCanvasId) return false;
    if (typeof chapter.canvasIndex === 'number') {
      return chapter.canvasIndex !== (viewer.getCanvasIndex?.() ?? -1);
    }
    return Boolean(chapter.canvasId) && chapter.canvasId !== currentCanvasId;
  };

  const applyModelPose = (pose: ModelPose, options?: ModelPoseOptions) => {
    viewer.setModelPose?.(pose, options);
    if (options && viewer.setModelPose) return;
    if (pose.cameraOrbit) viewer.setModelOrbit?.(pose.cameraOrbit);
    if (pose.cameraTarget) viewer.setModelTarget?.(pose.cameraTarget);
    if (pose.orientation) viewer.setModelOrientation?.(pose.orientation);
  };

  const loadChapter = async (index: number, _options: TransitionOptions = {}): Promise<void> => {
    cancelCurrentTransition();

    const chapter = story.chapters[index];
    if (!chapter) throw new Error(`Chapter ${index} not found`);
    const entryViewBox =
      [...(chapter.cameraTrack?.keyframes ?? [])]
        .sort((a, b) => a.timeMs - b.timeMs)
        .find((point) => point.viewBox)?.viewBox ?? chapter.viewBox;

    const runId = generateRunId();
    currentRunId = runId;
    currentChapterIndex = index;

    const checkCancelled = () => currentRunId !== runId;

    try {
      emit('transition:start', { chapterId: chapter.id, runId });
      emit('transition:assetsLoading', { chapterId: chapter.id, runId });

      if (viewer.getManifestId) currentManifest = viewer.getManifestId() ?? null;

      // Decided before anything moves: once the manifest is swapped the viewer
      // no longer reports what the reader is still looking at.
      const manifestWillChange = Boolean(chapter.manifest && chapter.manifest !== currentManifest);
      const canvasWillChange = targetsAnotherCanvas(chapter);
      // An author who asked for a cut gets one; everything else fades, because
      // a source change replaces the image outright and there is nothing for
      // the camera to carry across.
      const crossfade =
        (manifestWillChange || canvasWillChange) && chapter.entryTransition?.type !== 'cut';

      if (crossfade) {
        hideStage();
        await wait(crossfadeMs);
        if (checkCancelled()) return;
      } else {
        revealStage(0);
      }

      let manifestChanged = false;

      if (chapter.manifest && chapter.manifest !== currentManifest) {
        viewer.setManifest?.(chapter.manifest);
        manifestChanged = true;

        const manifestResult = await guard.waitForManifestChange(runId, chapter.manifest);
        if (checkCancelled()) return;
        if (manifestResult.degraded)
          console.warn('[Orchestrator] Manifest loaded with degraded certainty');

        if (typeof chapter.canvasIndex === 'number') {
          const canvasResult = await guard.waitForCanvasesAvailable(runId, chapter.canvasIndex);
          if (checkCancelled()) return;
          if (canvasResult.degraded)
            console.warn('[Orchestrator] Canvases loaded with degraded certainty');
        }

        currentManifest = chapter.manifest;
      }

      // Re-read rather than reusing the pre-fade answer: a manifest swap has
      // already moved the viewer, so what counts now is whether the canvas is
      // still going to change from where it currently sits. The crossfade and
      // this must agree, so both go through the same rule.
      const pageChanged = targetsAnotherCanvas(chapter);

      if (chapter.canvasId || typeof chapter.canvasIndex === 'number') {
        if (chapter.canvasId) {
          viewer.setCanvasById?.(chapter.canvasId);
          // Story documents can retain a stale canvas ID after a manifest is
          // replaced while still carrying the correct authored canvas index.
          // The viewer deliberately treats an unknown ID as a no-op, so use
          // the index as the documented fallback instead of waiting for an
          // event that cannot arrive.
          if (
            viewer.getCanvasId?.() !== chapter.canvasId &&
            typeof chapter.canvasIndex === 'number' &&
            viewer.getCanvasIndex?.() !== chapter.canvasIndex
          ) {
            viewer.setCanvasByIndex?.(chapter.canvasIndex);
          }
        } else {
          viewer.setCanvasByIndex?.(chapter.canvasIndex);
        }
        const pageChangeResult: GateResult = await guard.waitForPageChange(
          runId,
          chapter.canvasIndex,
          manifestChanged,
          chapter.canvasId,
        );
        if (checkCancelled()) return;
        if (pageChangeResult.degraded)
          console.warn('[Orchestrator] Page changed with degraded certainty');
      }

      emit('transition:sourceOpen', { chapterId: chapter.id, runId });

      const sameCanvas = !manifestChanged && !pageChanged;

      if (sameCanvas && chapter.layerOpacities) {
        if (cancelLayersAnimation) {
          cancelLayersAnimation();
          cancelLayersAnimation = null;
        }
        const fromOpacities = viewer.getLayerOpacities?.() ?? {};

        cancelLayersAnimation = animateLayerOpacities(
          viewer,
          fromOpacities,
          chapter.layerOpacities,
          1000,
          {
            now,
            requestAnimationFrame: rAF,
            cancelAnimationFrame: cAF,
          },
        );
      } else if (chapter.layerOpacities) {
        if (cancelLayersAnimation) {
          cancelLayersAnimation();
          cancelLayersAnimation = null;
        }

        for (const [id, opacity] of Object.entries(chapter.layerOpacities)) {
          viewer.updateLayerOpacity?.(id, opacity);
        }
      }

      if (entryViewBox) {
        const currentViewBox = viewer.getViewBox?.();
        const targetViewBox = entryViewBox as ViewBox;
        if (!isViewBoxEqual(currentViewBox, targetViewBox)) {
          const stabilityResult = await guard.waitForContainerStable(runId);
          if (checkCancelled()) return;
          if (stabilityResult.degraded) {
            console.warn(
              '[Orchestrator] Container stability check degraded - viewBox may not be optimal',
            );
          }
        }
      }

      if (entryViewBox) {
        const currentViewBox = viewer.getViewBox?.();
        const targetViewBox = entryViewBox as ViewBox;
        const viewBoxUnchanged = isViewBoxEqual(currentViewBox, targetViewBox);

        if (!viewBoxUnchanged) {
          if (cancelViewBoxAnimation) {
            cancelViewBoxAnimation();
            cancelViewBoxAnimation = null;
          }
          // `sameCanvas`, not `manifestChanged`: a canvas swap within one
          // Manifest changes the coordinate space just as completely, and the
          // viewer resets its viewBox on page change, so there is no coherent
          // framing to animate away from.
          cancelViewBoxAnimation = panToViewBox(viewer, targetViewBox, !sameCanvas, {
            now,
            requestAnimationFrame: rAF,
            cancelAnimationFrame: cAF,
          });
        }
      } else if (chapter.model) {
        applyModelPose(chapter.model, chapter.modelOptions);
      } else if (chapter.media) {
        viewer.seekTo?.(chapter.media.start);
      }

      if (checkCancelled()) return;
      emit('transition:poseApplied', { chapterId: chapter.id, runId });

      const needsPosePainted = Boolean(entryViewBox || chapter.model);
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

      // The framing is applied and painted, so what fades up is the new canvas
      // already in position rather than a fitted image that then jumps.
      revealStage();

      emit('transition:ready', { chapterId: chapter.id, runId });
    } catch (error) {
      revealStage(0);
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
    revealStage(0);
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
