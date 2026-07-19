import type { ViewerApi } from '../../core/types/viewer-api';

export type GateResult = { ok: boolean; degraded: boolean };

type GuardDeps = {
  setTimeoutFn: typeof setTimeout;
  clearTimeoutFn: typeof clearTimeout;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
  posePaintedTimeoutMs: number;
  sourceOpenTimeoutMs: number;
  layoutStabilityFrameCount?: number;
};

type GuardContext = {
  currentRunId: () => string | null;
  registerCleanup: (cleanup: () => void) => void;
};

export const createTransitionGuard = (
  viewer: ViewerApi,
  deps: GuardDeps,
  ctx: GuardContext,
) => {
  const {
    setTimeoutFn,
    clearTimeoutFn,
    requestAnimationFrame: rAF,
    cancelAnimationFrame: cAF,
    posePaintedTimeoutMs,
    sourceOpenTimeoutMs,
    layoutStabilityFrameCount = 5,
  } = deps;

  const waitForManifestChange = async (runId: string, expectedManifestId: string): Promise<GateResult> => {
    return new Promise((resolve) => {
      let resolved = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      const checkResolved = () => runId === ctx.currentRunId() && !resolved;
      const cleanup = () => {
        if (timeoutHandle) clearTimeoutFn(timeoutHandle);
      };
      const resolveOnce = (result: GateResult) => {
        if (!checkResolved()) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      ctx.registerCleanup(cleanup);
      if (viewer.getManifestId?.() === expectedManifestId) {
        resolveOnce({ ok: true, degraded: false });
        return;
      }

      const unsubscribe = viewer.on?.('manifestChange', (payload: { manifestId: string }) => {
        if (checkResolved() && payload.manifestId === expectedManifestId) {
          resolveOnce({ ok: true, degraded: false });
        }
      });
      if (unsubscribe) ctx.registerCleanup(unsubscribe);

      timeoutHandle = setTimeoutFn(() => {
        if (checkResolved()) resolveOnce({ ok: true, degraded: true });
      }, sourceOpenTimeoutMs);
    });
  };

  const waitForCanvasesAvailable = async (runId: string, expectedCanvasIndex: number): Promise<GateResult> => {
    return new Promise((resolve) => {
      let resolved = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let unsubscribe: (() => void) | null = null;
      const checkResolved = () => runId === ctx.currentRunId() && !resolved;
      const checkCanvases = () => (viewer.getCanvasCount?.() ?? 0) > expectedCanvasIndex;
      const cleanup = () => {
        if (timeoutHandle) clearTimeoutFn(timeoutHandle);
        unsubscribe?.();
      };
      const resolveOnce = (result: GateResult) => {
        if (!checkResolved()) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      ctx.registerCleanup(cleanup);
      if (checkCanvases()) {
        resolveOnce({ ok: true, degraded: false });
        return;
      }

      unsubscribe = viewer.on?.('stateChange', () => {
        if (checkResolved() && checkCanvases()) resolveOnce({ ok: true, degraded: false });
      }) ?? null;

      timeoutHandle = setTimeoutFn(() => {
        if (checkResolved()) resolveOnce({ ok: true, degraded: true });
      }, sourceOpenTimeoutMs);
    });
  };

  const waitForPageChange = async (
    runId: string,
    expectedCanvasIndex: number,
    _manifestJustChanged = false,
  ): Promise<GateResult> => {
    return new Promise((resolve) => {
      let resolved = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let rafHandle: number | null = null;
      const checkResolved = () => runId === ctx.currentRunId() && !resolved;
      const cleanup = () => {
        if (timeoutHandle) clearTimeoutFn(timeoutHandle);
        if (rafHandle != null && cAF) cAF(rafHandle);
      };
      const resolveOnce = (result: GateResult) => {
        if (!checkResolved()) return;
        resolved = true;
        cleanup();
        resolve(result);
      };
      const waitFrames = (frames: number) => {
        let remaining = frames;
        const tick = () => {
          if (!checkResolved()) return;
          remaining -= 1;
          if (remaining > 0 && rAF) {
            rafHandle = rAF(tick);
            return;
          }
          resolveOnce({ ok: true, degraded: false });
        };
        if (!rAF) {
          resolveOnce({ ok: true, degraded: false });
          return;
        }
        rafHandle = rAF(tick);
      };

      ctx.registerCleanup(cleanup);
      if (viewer.getCanvasIndex?.() === expectedCanvasIndex) {
        waitFrames(2);
        return;
      }

      const unsubscribe = viewer.on?.('pageChange', (payload: { index: number }) => {
        if (checkResolved() && payload.index === expectedCanvasIndex) waitFrames(3);
      });
      if (unsubscribe) ctx.registerCleanup(unsubscribe);

      timeoutHandle = setTimeoutFn(() => {
        if (checkResolved()) resolveOnce({ ok: true, degraded: true });
      }, sourceOpenTimeoutMs);
    });
  };

  const waitForPosePainted = async (runId: string): Promise<GateResult> => {
    return new Promise((resolve) => {
      let resolved = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let rafHandle: number | null = null;
      let paintEventReceived = false;
      const checkResolved = () => runId === ctx.currentRunId() && !resolved;
      const cleanup = () => {
        if (timeoutHandle) clearTimeoutFn(timeoutHandle);
        if (rafHandle != null && cAF) cAF(rafHandle);
      };
      const resolveOnce = (result: GateResult) => {
        if (!checkResolved()) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      ctx.registerCleanup(cleanup);
      const onPaint = () => {
        if (!checkResolved()) return;
        paintEventReceived = true;
        if (!rAF) {
          resolveOnce({ ok: true, degraded: false });
          return;
        }
        rafHandle = rAF(() => resolveOnce({ ok: true, degraded: false }));
      };

      const unsubView = viewer.on?.('viewBoxChange', onPaint);
      const unsubZoom = viewer.on?.('zoomChange', onPaint);
      if (unsubView) ctx.registerCleanup(unsubView);
      if (unsubZoom) ctx.registerCleanup(unsubZoom);

      timeoutHandle = setTimeoutFn(() => {
        if (checkResolved()) resolveOnce({ ok: true, degraded: true });
      }, posePaintedTimeoutMs);

      if (rAF) {
        rafHandle = rAF(() => {
          if (!checkResolved() || paintEventReceived || !rAF) return;
          const second = rAF(() => {
            if (checkResolved() && !paintEventReceived) resolveOnce({ ok: true, degraded: true });
          });
          if (cAF) ctx.registerCleanup(() => cAF(second));
        });
      }
    });
  };

  const waitForContainerStable = async (runId: string): Promise<GateResult> => {
    return new Promise((resolve) => {
      let resolved = false;
      let handles: number[] = [];
      const checkResolved = () => runId === ctx.currentRunId() && !resolved;
      const cleanup = () => {
        if (cAF) handles.forEach((h) => cAF(h));
        handles = [];
      };
      const resolveOnce = (result: GateResult) => {
        if (!checkResolved()) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      ctx.registerCleanup(cleanup);
      if (!rAF) {
        resolveOnce({ ok: true, degraded: true });
        return;
      }

      let remaining = layoutStabilityFrameCount;
      const tick = () => {
        if (!checkResolved()) return;
        remaining -= 1;
        if (remaining > 0) {
          handles.push(rAF(tick));
          return;
        }
        resolveOnce({ ok: true, degraded: false });
      };
      handles.push(rAF(tick));
    });
  };

  return {
    waitForManifestChange,
    waitForCanvasesAvailable,
    waitForPageChange,
    waitForPosePainted,
    waitForContainerStable,
  };
};
