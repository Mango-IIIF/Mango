import { describe, expect, it, vi } from 'vitest';
import { createTransitionGuard } from '../transitionGuard';

const createViewer = (overrides: Record<string, unknown> = {}) => ({
  getManifestId: () => 'm1',
  getCanvasId: () => 'canvas-0',
  getCanvasIndex: () => 0,
  getCanvasCount: () => 1,
  on: vi.fn(() => () => undefined),
  ...overrides,
});

/**
 * A background tab keeps running timers but never fires animation frames.
 * Gates that count frames must not depend on them for liveness.
 */
const createFrozenFrames = () => ({
  requestAnimationFrame: vi.fn(() => 1),
  cancelAnimationFrame: vi.fn(),
});

describe('chapter transition gates', () => {
  it('does not wait forever for frames that never arrive', async () => {
    vi.useFakeTimers();
    const cleanups: (() => void)[] = [];
    const frames = createFrozenFrames();
    const guard = createTransitionGuard(
      createViewer() as never,
      {
        setTimeoutFn: setTimeout,
        clearTimeoutFn: clearTimeout,
        ...frames,
        posePaintedTimeoutMs: 100,
        sourceOpenTimeoutMs: 100,
      },
      {
        currentRunId: () => 'run-1',
        registerCleanup: (cleanup) => cleanups.push(cleanup),
      },
    );

    // Already on the requested canvas: the gate counts frames rather than
    // waiting for a pageChange event that will never come.
    const pageChange = guard.waitForPageChange('run-1', 0, false, 'canvas-0');
    const containerStable = guard.waitForContainerStable('run-1');

    await vi.advanceTimersByTimeAsync(200);

    await expect(pageChange).resolves.toMatchObject({ ok: true });
    await expect(containerStable).resolves.toMatchObject({ ok: true });
    vi.useRealTimers();
  });

  it('settles every gate when its run is superseded', async () => {
    let runId: string | null = 'run-1';
    const cleanups: (() => void)[] = [];
    const guard = createTransitionGuard(
      createViewer({
        getManifestId: () => 'other',
        getCanvasCount: () => 0,
        getCanvasId: () => 'elsewhere',
        getCanvasIndex: () => 9,
      }) as never,
      {
        setTimeoutFn: setTimeout,
        clearTimeoutFn: clearTimeout,
        requestAnimationFrame: vi.fn(() => 1),
        cancelAnimationFrame: vi.fn(),
        posePaintedTimeoutMs: 10_000,
        sourceOpenTimeoutMs: 10_000,
      },
      {
        currentRunId: () => runId,
        registerCleanup: (cleanup) => cleanups.push(cleanup),
      },
    );

    const pending = [
      guard.waitForManifestChange('run-1', 'm1'),
      guard.waitForCanvasesAvailable('run-1', 0),
      guard.waitForPageChange('run-1', 0, false, 'canvas-0'),
      guard.waitForPosePainted('run-1'),
      guard.waitForContainerStable('run-1'),
    ];

    // A newer transition cancels this run and flushes its cleanups. Every
    // gate has to settle: an unsettled promise leaves the chapter load
    // awaiting forever, holding its state and listeners.
    runId = null;
    cleanups.forEach((cleanup) => cleanup());

    const settled = await Promise.race([
      Promise.all(pending).then(() => 'settled'),
      new Promise((resolve) => setTimeout(() => resolve('hung'), 50)),
    ]);
    expect(settled).toBe('settled');
  });
});
