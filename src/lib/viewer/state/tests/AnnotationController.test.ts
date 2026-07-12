import { get, writable } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedAnnotation } from '../../../iiif/annotationResolver';
import { createAnnotationController } from '../controllers/AnnotationController';
import { createViewerState } from '../viewerState';

afterEach(() => {
  vi.useRealTimers();
});

describe('AnnotationController search results', () => {
  it('focuses and selects a result on the current canvas', () => {
    vi.useFakeTimers();
    const state = createViewerState();
    const applyViewBox = vi.fn();
    const emitEvent = vi.fn();
    const result: ResolvedAnnotation & { canvasId: string } = {
      id: 'result-1',
      canvasId: 'canvas-1',
      rect: { x: 100, y: 200, w: 300, h: 100 },
      text: 'Result',
    };
    const controller = createAnnotationController({
      state,
      derived: {
        annotations: writable([result]),
        canvases: writable([{ id: 'canvas-1', index: 0 }]),
      } as any,
      emitEvent,
      emitStateChange: vi.fn(),
      getCanvasId: () => 'canvas-1',
      getCanvasIndex: () => 0,
      setCanvasById: vi.fn(),
      setPendingViewBox: vi.fn(),
      applyViewBox,
    });

    controller.handleSearchResultClick(result);

    expect(get(state.selectedSearchResultId)).toBe('result-1');
    expect(applyViewBox).toHaveBeenCalledWith({ x: 55, y: 155, w: 390, h: 190 });
    vi.runAllTimers();
    expect(get(state.activeAnnotationId)).toBe('result-1');
    expect(emitEvent).toHaveBeenCalledWith(
      'annotationSelect',
      expect.objectContaining({ id: 'result-1', annotation: result }),
    );
  });

  it('navigates to an off-canvas result and queues its focus box', () => {
    const state = createViewerState();
    const setCanvasById = vi.fn();
    const setPendingViewBox = vi.fn();
    const result: ResolvedAnnotation & { canvasId: string } = {
      id: 'result-2',
      canvasId: 'canvas-2',
      rect: { x: 10, y: 20, w: 30, h: 40 },
    };
    const controller = createAnnotationController({
      state,
      derived: {
        annotations: writable([]),
        canvases: writable([
          { id: 'canvas-1', index: 0 },
          { id: 'canvas-2', index: 1 },
        ]),
      } as any,
      emitEvent: vi.fn(),
      emitStateChange: vi.fn(),
      getCanvasId: () => 'canvas-1',
      getCanvasIndex: () => 0,
      setCanvasById,
      setPendingViewBox,
      applyViewBox: vi.fn(),
    });

    controller.handleSearchResultClick(result);

    expect(setPendingViewBox).toHaveBeenCalledWith({ x: 4, y: 14, w: 42, h: 52 });
    expect(setCanvasById).toHaveBeenCalledWith('canvas-2');
  });
});
