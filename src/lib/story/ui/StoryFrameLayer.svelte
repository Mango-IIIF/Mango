<script lang="ts">
  import { untrack } from 'svelte';
  import {
    OSDAnnotationEditor,
    type AnnotationChange,
    type OSDLikeViewer,
    type RectAnnotation,
    type RenderContext,
    type ShapeData,
  } from '@mango-iiif/annotation';
  import type { StoryFrame } from '../../core/types/story';
  import type { ViewBox } from '../../core/types/viewer';
  import { lockRectAspect } from '../frameGeometry';
  import { translate } from '../../core/i18n';

  /*
   * The chapter frame, and the camera keyframes while motion is being
   * authored, drawn on the stage as objects in canvas pixels.
   *
   * Built on the same editor as the drawing annotations, bound to the real
   * OpenSeadragon viewer, so a frame tracks every pan and zoom per frame and
   * never has to be re-derived from a viewport reading. Only the outline is
   * interactive: the interior is left unpainted, so a drag inside the frame
   * pans the image and a wheel over it zooms, exactly as they would with no
   * frame there — the frame is a thing on the canvas, not a lid over it.
   */

  interface Props {
    viewer?: OSDLikeViewer | null;
    canvasWidth?: number;
    canvasHeight?: number;
    frames?: StoryFrame[];
    selectedFrameId?: string | null;
    /** A move or resize gesture ended; the box already holds the lock. */
    onframecommit?: ((payload: { frameId: string; viewBox: ViewBox }) => void) | undefined;
    /** The author took hold of a different frame. */
    onframeselect?: ((payload: { frameId: string | null }) => void) | undefined;
  }

  let {
    viewer = null,
    canvasWidth = 0,
    canvasHeight = 0,
    frames = [],
    selectedFrameId = null,
    onframecommit = undefined,
    onframeselect = undefined,
  }: Props = $props();

  const SVG_NS = 'http://www.w3.org/2000/svg';

  let editor: OSDAnnotationEditor | null = $state(null);

  /*
   * Bookkeeping that must not be reactive: it records what was sent and where
   * a gesture started, and is read only to decide whether an incoming change
   * is news. As state it would sit in the very dependency graph it exists to
   * keep quiet.
   */
  const pushedGeometry = new Map<string, string>();
  const gestureOrigin = new Map<string, ViewBox>();
  let applyingLock = false;
  let lastPushedShapes = '';

  const frameById = (id: string): StoryFrame | undefined =>
    frames.find((frame) => frame.id === id);

  const rectOf = (shape: ShapeData | null): ViewBox | null =>
    shape?.type === 'rect'
      ? { x: shape.geometry.x, y: shape.geometry.y, w: shape.geometry.w, h: shape.geometry.h }
      : null;

  const sameRect = (a: ViewBox, b: ViewBox): boolean =>
    Math.abs(a.x - b.x) < 1e-6 &&
    Math.abs(a.y - b.y) < 1e-6 &&
    Math.abs(a.w - b.w) < 1e-6 &&
    Math.abs(a.h - b.h) < 1e-6;

  const toShape = (frame: StoryFrame): RectAnnotation => ({
    id: frame.id,
    type: 'rect',
    geometry: {
      x: frame.viewBox.x,
      y: frame.viewBox.y,
      w: frame.viewBox.w,
      h: frame.viewBox.h,
    },
    layer: frame.kind,
    ...(frame.label ? { label: frame.label } : {}),
  });

  const bounds = () =>
    canvasWidth > 0 && canvasHeight > 0 ? { width: canvasWidth, height: canvasHeight } : null;

  /**
   * Holds a resize to the frame's aspect while the pointer is still down.
   *
   * The editor recomputes every preview from the geometry at the start of the
   * gesture, so the lock is applied against that origin rather than against
   * the previous preview — otherwise the re-centring a locked edge drag does
   * would read as a corner drag on the next sample.
   */
  const lockTransientResize = (change: AnnotationChange) => {
    if (!editor || change.operation !== 'resize') return;
    const after = rectOf(change.after);
    const frame = frameById(change.id);
    if (!after || !frame) return;
    const origin =
      gestureOrigin.get(change.id) ??
      rectOf(change.before) ??
      frame.viewBox;
    if (!gestureOrigin.has(change.id)) gestureOrigin.set(change.id, origin);
    const locked = lockRectAspect(origin, after, frame.aspect, bounds());
    if (sameRect(locked, after)) return;
    applyingLock = true;
    try {
      editor.setGeometry(change.id, locked, { constrain: false });
    } finally {
      applyingLock = false;
    }
  };

  const handleChange = (change: AnnotationChange) => {
    if (change.kind !== 'update' || !change.after) return;
    if (change.transient) {
      lockTransientResize(change);
      return;
    }
    // Our own mid-gesture correction, reported back as a committed change.
    if (applyingLock) return;
    const after = rectOf(change.after);
    const frame = frameById(change.id);
    if (!after || !frame) return;
    const key = JSON.stringify(change.after.geometry);
    // The echo of a sync we pushed ourselves.
    if (pushedGeometry.get(change.id) === key) return;

    if (change.operation === 'programmatic') {
      // A committed change that skipped the gesture path (a host call on the
      // editor) arrives unlocked; lock it before it goes anywhere.
      const origin = rectOf(change.before) ?? frame.viewBox;
      const locked = lockRectAspect(origin, after, frame.aspect, bounds());
      if (!sameRect(locked, after) && editor) {
        applyingLock = true;
        try {
          editor.setGeometry(change.id, locked, { constrain: false });
        } finally {
          applyingLock = false;
        }
        pushedGeometry.set(change.id, JSON.stringify(locked));
        onframecommit?.({ frameId: change.id, viewBox: locked });
        return;
      }
    }

    gestureOrigin.delete(change.id);
    pushedGeometry.set(change.id, key);
    onframecommit?.({ frameId: change.id, viewBox: after });
  };

  /** The grab band inside the frame's edge, in screen pixels. */
  const HALO_WIDTH_PX = 7;

  const renderShape = (context: RenderContext): SVGElement | undefined => {
    if (context.annotation.type !== 'rect') return undefined;
    const { x, y, w, h } = context.annotation.geometry;
    const frame = frameById(context.annotation.id);
    const group = document.createElementNS(SVG_NS, 'g');
    // Screen pixels per canvas pixel at the moment of this render.
    const scale = w > 0 && context.bounds.w > 0 ? context.bounds.w / w : 1;
    const draw = (className: string, inset: number) => {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(x + inset));
      rect.setAttribute('y', String(y + inset));
      rect.setAttribute('width', String(Math.max(0, w - inset * 2)));
      rect.setAttribute('height', String(Math.max(0, h - inset * 2)));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('vector-effect', 'non-scaling-stroke');
      rect.setAttribute('class', className);
      group.append(rect);
    };
    /*
     * A dark band just inside the line keeps the frame legible over any
     * artwork, and it is also what the author takes hold of: the editor's hit
     * test for a rectangle is its exact geometry, so the band is drawn inside
     * the edge rather than centred on it, where half of it would miss.
     */
    draw('story-frame__halo', HALO_WIDTH_PX / 2 / scale);
    draw('story-frame__line', 0);
    group.setAttribute(
      'class',
      [
        'story-frame',
        `story-frame--${frame?.kind ?? 'chapter'}`,
        context.selected ? 'story-frame--selected' : '',
        frame?.editable ? 'story-frame--editable' : 'story-frame--passive',
      ]
        .filter(Boolean)
        .join(' '),
    );
    return group;
  };

  $effect(() => {
    if (!viewer || canvasWidth <= 0 || canvasHeight <= 0) return;
    /*
     * No keyboard. The editor would bind arrows, Delete and undo on whatever
     * target it is given, and the chapter frame is selected almost all of the
     * time — so an arrow key pressed anywhere in the builder would nudge the
     * frame and commit it, and Cmd+Z would run the editor's own geometry
     * history against the story's. A detached element hears nothing; the
     * frame's numbers in the inspector are the keyboard route.
     */
    const keyboardTarget = document.createElement('div');
    const instance = new OSDAnnotationEditor({
      viewer,
      keyboardTarget,
      canvasSize: { width: canvasWidth, height: canvasHeight },
      mode: 'select',
      annotations: untrack(() => frames.map(toShape)),
      selectedId: untrack(() => selectedFrameId),
      policy: (shape) => {
        const frame = frameById(shape.id);
        const editable = Boolean(frame?.editable);
        return {
          editable,
          selectable: editable,
          deletable: false,
          rotatable: false,
          visible: true,
        };
      },
      style: {
        strokeColor: 'transparent',
        fillColor: 'none',
        activeColor: 'rgba(255, 255, 255, 0.95)',
      },
      config: {
        handleSize: 10,
        handleColor: '#ffffff',
        handleStrokeColor: 'rgba(15, 23, 42, 0.9)',
        hitTolerance: 9,
        keyboard: { enabled: false },
      },
      renderer: {
        renderShape,
        shapeData: (context) => ({
          storyFrame: context.annotation.id,
          storyFrameKind: frameById(context.annotation.id)?.kind ?? 'chapter',
        }),
        label: (context) => {
          const frame = frameById(context.annotation.id);
          const text =
            frame?.kind === 'keyframe'
              ? frame.label
              : (frame?.label ?? translate('storyBuilder.frame.label'));
          return {
            text,
            placement: 'above',
            minFontSize: 11,
            maxFontSize: 12,
            fontSize: 11,
            className: `story-frame__label story-frame__label--${frame?.kind ?? 'chapter'}`,
          };
        },
      },
      accessibleLabel: (shape) => {
        const frame = frameById(shape.id);
        return frame?.kind === 'keyframe'
          ? translate('storyBuilder.frame.keyframeAria', { number: frame.label ?? '' })
          : translate('storyBuilder.frame.chapterAria');
      },
      onSelectionChanged: (id) => {
        const wanted = selectedFrameId;
        if (id === null) {
          /*
           * A click on the empty canvas — to pan — deselects in the editor.
           * The frame is not a thing the author is done with, so it keeps its
           * handles; re-selecting here is what makes them permanent.
           */
          if (wanted && frameById(wanted)?.editable) {
            queueMicrotask(() => {
              if (instance === editor) instance.select(wanted);
            });
          }
          return;
        }
        if (id !== wanted) onframeselect?.({ frameId: id });
      },
      onAnnotationChanged: handleChange,
    });
    /*
     * The editor appends its root to the viewer container and shares its class
     * names with the drawing annotation editor, which mounts into the same
     * container. Mark this one so styles and tests can tell the two apart.
     */
    const root = viewer.container.lastElementChild;
    if (root instanceof HTMLElement && root.classList.contains('mango-annotation-editor')) {
      root.classList.add('story-frame-layer');
      root.dataset.storyFrameLayer = '';
    }
    for (const shape of untrack(() => frames.map(toShape))) {
      pushedGeometry.set(shape.id, JSON.stringify(shape.geometry));
    }
    lastPushedShapes = JSON.stringify(untrack(() => frames.map(toShape)));
    editor = instance;
    return () => {
      instance.destroy();
      if (editor === instance) editor = null;
      pushedGeometry.clear();
      gestureOrigin.clear();
      lastPushedShapes = '';
    };
  });

  $effect(() => {
    if (!editor) return;
    const shapes = frames.map(toShape);
    const serialised = JSON.stringify(shapes);
    const selection = selectedFrameId;
    if (serialised !== lastPushedShapes) {
      lastPushedShapes = serialised;
      pushedGeometry.clear();
      for (const shape of shapes) pushedGeometry.set(shape.id, JSON.stringify(shape.geometry));
      editor.setAnnotations(shapes, { history: 'preserve' });
    }
    const wanted = selection && frameById(selection)?.editable ? selection : null;
    if (editor.getSelectedId() !== wanted) editor.select(wanted);
  });

  $effect(() => {
    editor?.updateCanvasSize({ width: canvasWidth, height: canvasHeight });
  });
</script>

<style>
  :global(.story-frame) {
    cursor: move;
  }

  :global(.story-frame--passive) {
    pointer-events: none !important;
    cursor: default;
  }

  :global(.story-frame__halo) {
    stroke: rgba(10, 14, 20, 0.45);
    stroke-width: 7;
  }

  :global(.story-frame__line) {
    stroke: var(--story-builder-accent, #e07a3f);
    stroke-width: 2;
  }

  :global(.story-frame--selected .story-frame__line) {
    stroke-width: 2.5;
  }

  :global(.story-frame--keyframe .story-frame__line) {
    stroke: rgba(255, 255, 255, 0.92);
    stroke-dasharray: 6 4;
  }

  :global(.story-frame--keyframe.story-frame--selected .story-frame__line) {
    stroke: var(--story-builder-accent, #e07a3f);
    stroke-dasharray: none;
  }

  :global(.story-frame--passive .story-frame__line) {
    stroke-dasharray: 4 5;
    opacity: 0.8;
  }

  :global(.story-frame__label) {
    font-family: inherit;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
</style>
