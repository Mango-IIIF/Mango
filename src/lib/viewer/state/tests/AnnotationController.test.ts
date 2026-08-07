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

describe('AnnotationController shape preservation', () => {
  const makeController = () => {
    const state = createViewerState();
    const controller = createAnnotationController({
      state,
      derived: {
        annotations: writable([]),
        canvases: writable([{ id: 'canvas-1', index: 0 }]),
      } as any,
      emitEvent: vi.fn(),
      emitStateChange: vi.fn(),
      getCanvasId: () => 'canvas-1',
      getCanvasIndex: () => 0,
      setCanvasById: vi.fn(),
      setPendingViewBox: vi.fn(),
      applyViewBox: vi.fn(),
    });
    const stored = (id: string) =>
      Object.values(get(state.userAnnotations))
        .flat()
        .find((item) => item.id === id);
    return { controller, stored };
  };

  it('keeps the shape of a path annotation it is given', async () => {
    const { controller, stored } = makeController();

    // Every path shape shares the `polygon` slot, so this field is the only
    // thing separating an open freehand curve from a closed filled polygon.
    // Dropping it here is what closed committed freehand annotations.
    await controller.addAnnotation({
      id: 'freehand-1',
      shapeType: 'freehand',
      polygon: { points: [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 30, y: 5 }] },
    });
    await controller.addAnnotation({
      id: 'polygon-1',
      shapeType: 'polygon',
      polygon: { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }] },
    });

    expect(stored('freehand-1')?.shapeType).toBe('freehand');
    expect(stored('polygon-1')?.shapeType).toBe('polygon');
  });

  it('records a bare xywh annotation as a rectangle', async () => {
    const { controller, stored } = makeController();
    await controller.addAnnotation({ id: 'rect-1', x: 1, y: 2, w: 3, h: 4 });
    expect(stored('rect-1')?.shapeType).toBe('rect');
  });
});

describe('AnnotationController edits to read-only annotations', () => {
  /*
   * Manifest and external annotations (the Wellcome OCR lists, say) are rebuilt
   * from the fetched IIIF on every recompute, so the controller cannot patch
   * them where they live. It takes a copy under the same id instead, and
   * `mergeCanvasAnnotations` prefers that copy — see derived.test.ts.
   */
  const external: ResolvedAnnotation = {
    id: 'external-1',
    text: 'BILD DER JAHRHUNDERTE',
    rect: { x: 10, y: 20, w: 30, h: 40 },
  };

  const makeController = () => {
    const state = createViewerState();
    const controller = createAnnotationController({
      state,
      derived: {
        annotations: writable([external]),
        canvases: writable([{ id: 'canvas-1', index: 0 }]),
      } as any,
      emitEvent: vi.fn(),
      emitStateChange: vi.fn(),
      getCanvasId: () => 'canvas-1',
      getCanvasIndex: () => 0,
      setCanvasById: vi.fn(),
      setPendingViewBox: vi.fn(),
      applyViewBox: vi.fn(),
    });
    return { controller, state };
  };

  it('copies an external annotation on first edit instead of dropping it', async () => {
    const { controller, state } = makeController();

    await controller.updateAnnotation('external-1', { text: 'Edited' });

    const stored = get(state.userAnnotations)['canvas-1'] ?? [];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: 'external-1',
      text: 'Edited',
      rect: { x: 10, y: 20, w: 30, h: 40 },
      bodies: [{ type: 'text', value: 'Edited' }],
    });
  });

  it('edits the copy on subsequent edits rather than stacking another', async () => {
    const { controller, state } = makeController();

    await controller.updateAnnotation('external-1', { text: 'First' });
    await controller.updateAnnotation('external-1', { text: 'Second' });

    const stored = get(state.userAnnotations)['canvas-1'] ?? [];
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('Second');
  });

  it('does not take ownership for a patch that changes nothing', async () => {
    const { controller, state } = makeController();

    // What an explicit "Save Changes" sends; copying on it would put every
    // annotation the user merely looked at into their export.
    await controller.updateAnnotation('external-1', {});

    expect(get(state.userAnnotations)['canvas-1'] ?? []).toEqual([]);
  });

  it('tombstones a deleted external annotation', async () => {
    const { controller, state } = makeController();

    await controller.removeAnnotation('external-1');

    expect(get(state.removedAnnotationIds)['canvas-1']).toEqual(['external-1']);
  });

  it('lifts the tombstone when an id is added back', async () => {
    const { controller, state } = makeController();

    await controller.removeAnnotation('external-1');
    await controller.addAnnotation({ ...external, id: 'external-1' });

    expect(get(state.removedAnnotationIds)['canvas-1']).toEqual([]);
    expect(get(state.userAnnotations)['canvas-1']).toHaveLength(1);
  });
});
