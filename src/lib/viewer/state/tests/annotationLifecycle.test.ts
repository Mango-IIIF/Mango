/**
 * The save round trip, as it behaves in the running editor.
 *
 * Every case here failed in the browser while the unit suite was green, which
 * is the reason the file exists: the bugs lived in what the controller carried
 * between steps, not in any single function.
 */

import { get, writable } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import type { ResolvedAnnotation } from '../../../iiif/annotationResolver';
import {
  createMangoAnnotation,
  projectToResolved,
} from '../../../features/annotations/canonical';
import { createAnnotationController } from '../controllers/AnnotationController';
import { createViewerState } from '../viewerState';

const CANVAS = 'canvas-1';

const draft = (text?: string): ResolvedAnnotation =>
  projectToResolved(
    createMangoAnnotation({
      id: 'urn:mango:draft:annotation/1',
      canvasId: CANVAS,
      shape: { type: 'rect', geometry: { x: 10, y: 20, w: 30, h: 40 } },
      text,
      styleClass: 'mine',
    }),
    { provenance: 'draft' },
  ) as ResolvedAnnotation;

const makeController = (annotations: ResolvedAnnotation[] = []) => {
  const state = createViewerState();
  const controller = createAnnotationController({
    state,
    derived: {
      annotations: writable(annotations),
      canvases: writable([{ id: CANVAS, index: 0 }]),
    } as never,
    emitEvent: vi.fn(),
    emitStateChange: vi.fn(),
    getCanvasId: () => CANVAS,
    getCanvasIndex: () => 0,
    setCanvasById: vi.fn(),
    setPendingViewBox: vi.fn(),
    applyViewBox: vi.fn(),
  });
  return { controller, state };
};

const stored = (state: ReturnType<typeof createViewerState>) =>
  get(state.userAnnotations)[CANVAS] ?? [];

describe('saving a drafted annotation', () => {
  it('keeps the canonical document', async () => {
    // Rebuilding the projection field by field dropped it, which cost both
    // lossless export and equality with the shape the editor already held.
    const { controller, state } = makeController();

    await controller.addAnnotation(draft('A note'));

    expect(stored(state)).toHaveLength(1);
    expect(stored(state)[0].document).toBeTruthy();
    expect(stored(state)[0].text).toBe('A note');
  });

  it('stops being a draft once it is saved', async () => {
    const { controller, state } = makeController();

    await controller.addAnnotation(draft());

    // Carrying `draft` through left a saved annotation labelled "Draft" in the
    // inspector for the rest of the session.
    expect(stored(state)[0].provenance).toBe('local');
  });

  it('keeps the style hints the editor renders from', async () => {
    const { controller, state } = makeController();
    const withStyle: ResolvedAnnotation = {
      ...draft(),
      styleHints: { strokeColor: '#a78bfa' },
    };

    await controller.addAnnotation(withStyle);

    expect(stored(state)[0].styleHints).toEqual({ strokeColor: '#a78bfa' });
  });
});

describe('undo and redo of a metadata edit', () => {
  it('restores a field that was empty before the edit', async () => {
    /*
     * The reason `replaceAnnotation` exists. A snapshot is a whole earlier
     * state, and a field that was empty then is absent from it — which a patch
     * reads as "leave alone", so undo silently did nothing.
     */
    const before = draft();
    const { controller, state } = makeController([before]);
    await controller.addAnnotation(before);

    await controller.updateAnnotation(before.id, { text: 'Edited' });
    expect(stored(state)[0].text).toBe('Edited');

    await controller.replaceAnnotation(before.id, before);
    expect(stored(state)[0].text).toBeUndefined();
  });

  it('restores the annotation rather than duplicating it', async () => {
    const before = draft();
    const { controller, state } = makeController([before]);
    await controller.addAnnotation(before);

    await controller.updateAnnotation(before.id, { text: 'Edited' });
    await controller.replaceAnnotation(before.id, before);

    expect(stored(state)).toHaveLength(1);
  });

  it('recreates an override that undo restores after a delete', async () => {
    const source = draft('From the manifest');
    const { controller, state } = makeController([source]);

    await controller.removeAnnotation(source.id);
    expect(get(state.removedAnnotationIds)[CANVAS]).toEqual([source.id]);

    await controller.replaceAnnotation(source.id, source);

    expect(stored(state)).toHaveLength(1);
    // The tombstone has to lift too, or the merge filters the restored
    // annotation straight back out and undo appears to do nothing.
    expect(get(state.removedAnnotationIds)[CANVAS] ?? []).not.toContain(source.id);
  });
});

describe('committing an existing annotation', () => {
  it('does not take ownership of an annotation that was only saved', async () => {
    const source = draft('Untouched');
    const { controller, state } = makeController([source]);

    await controller.commitAnnotation(source.id);

    // Save marks a transaction complete; it is not an edit. Copying on it would
    // put every annotation the user merely opened into their export.
    expect(stored(state)).toEqual([]);
  });
});
