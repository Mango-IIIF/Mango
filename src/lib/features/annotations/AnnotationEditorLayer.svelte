<script lang="ts">
  import { untrack } from 'svelte';
  import {
    OSDAnnotationEditor,
    type AnnotationStyle,
    type AnnotationTheme,
    type EditorMode,
    type LabelSpec,
    type OSDLikeViewer,
    type RenderContext,
    type ShapeData,
  } from '@mango-iiif/annotation';
  import { serializeWebAnnotation } from '@mango-iiif/w3c-parser';
  import { createMangoAnnotation, shapeTool } from './canonical';
  import { buildLayerStylesheet, hintsFromInlineStyle, styleClassForLayer } from './style';
  import { EDITOR_LABEL_SIZING, type LabelSizing } from './rectangleLabelLayout';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import type { LayerItem } from './workspace/LeftSidebar.svelte';
  import type { ChapterAnnotationTool as Tool } from '../../core/types/story';

  interface Props {
    enabled?: boolean;
    viewer?: OSDLikeViewer | null;
    canvasId?: string | null;
    canvasWidth?: number;
    canvasHeight?: number;
    annotations?: ResolvedAnnotation[];
    activeAnnotationId?: string | null;
    activeTool?: Tool;
    layers?: LayerItem[];
    /** Layer new annotations are created in. A presentation and grouping choice. */
    activeLayerId?: string;
    /**
     * Size band for shape labels, in screen pixels.
     *
     * Story labels are read from further back than editor labels, so the two
     * surfaces use different bands — but each surface uses one band for both
     * viewing and editing, which is the point.
     */
    labelSizing?: LabelSizing;
    ontoolchange?: ((payload: { tool: Tool }) => void) | undefined;
    onannotationcreate?:
      ((payload: { annotation: unknown; tool: Exclude<Tool, 'select'> }) => void) | undefined;
    onannotationupdate?:
      ((payload: { id: string; patch: Partial<ResolvedAnnotation> }) => void) | undefined;
    onannotationdelete?: ((payload: { id: string }) => void) | undefined;
    onannotationselect?: ((payload: { id: string }) => void) | undefined;
    /** Hands the live editor out so undo/redo and exact edits can reach it. */
    oneditorready?: ((editor: OSDAnnotationEditor | null) => void) | undefined;
    /** A committed geometry change, already one undo step in the editor. */
    ongeometrycommit?: ((payload: { id: string }) => void) | undefined;
  }

  let {
    enabled = false,
    viewer = null,
    canvasId = null,
    canvasWidth = 0,
    canvasHeight = 0,
    annotations = [],
    activeAnnotationId = null,
    activeTool = 'rectangle',
    layers = [],
    activeLayerId = 'mine',
    labelSizing = EDITOR_LABEL_SIZING,
    ontoolchange = undefined,
    onannotationcreate = undefined,
    onannotationupdate = undefined,
    onannotationdelete = undefined,
    onannotationselect = undefined,
    oneditorready = undefined,
    ongeometrycommit = undefined,
  }: Props = $props();

  let editor: OSDAnnotationEditor | null = $state(null);

  /**
   * Geometry last handed to the editor, per annotation.
   *
   * Deliberately not reactive: it is a record of what was sent, read only to
   * decide whether an incoming change is news. Making it state would put it in
   * the very dependency graph it exists to keep quiet.
   */
  const pushedGeometry = new Map<string, string>();

  /*
   * Labels are the canvas package's to draw.
   *
   * Mango used to fit them by walking the package's own SVG after every
   * mutation — reading a rect's attributes, rewriting the sibling `text`, and
   * re-running on a MutationObserver. That workaround existed because there was
   * no extension point; there is one now, and `LabelSpec` clamps in screen
   * pixels, which is the thing Mango could not do from the outside. Sizes in
   * image coordinates grew without limit as the viewer zoomed in, so a large
   * region rendered its label at headline size.
   */
  /**
   * Label text for a shape.
   *
   * Shortened rather than wrapped. The canvas package clamps a label's size in
   * screen pixels and keeps doing so as the viewer zooms, which is the part
   * that has to stay right; what it cannot do is wrap, and Mango cannot wrap it
   * from outside either — `renderShape` is sampled once and never re-run on
   * zoom, so anything fitted there freezes at whatever the first frame
   * happened to be.
   *
   * The same goes for trimming to the shape's width: the callback is not
   * re-invoked on zoom either, so any width Mango measured would be a width
   * from some earlier frame. The cap is therefore a fixed number of characters
   * — short enough to read as a label rather than a sentence.
   *
   * A sentence belongs to the annotation's text, which the inspector and the
   * chapter annotation list show in full.
   */
  const SHAPE_LABEL_LIMIT = 30;

  const shapeLabelText = (label: string | undefined): string | undefined => {
    const value = label?.trim();
    if (!value) return undefined;
    return value.length > SHAPE_LABEL_LIMIT
      ? `${value.slice(0, SHAPE_LABEL_LIMIT - 1).trimEnd()}\u2026`
      : value;
  };

  const labelSpec = (context: RenderContext): LabelSpec => {
    const text = shapeLabelText(context.annotation.label);
    /*
     * Placement depends on the shape, never on the label.
     *
     * A rectangle has an interior and its label sits in the middle of it, which
     * is where story playback puts it too. Deciding by length instead made the
     * label jump from the centre of the region to underneath it as the text
     * changed — one annotation, two positions.
     *
     * Points and lines have no interior, so theirs sits below. That is a
     * property of the shape and holds for every label on it.
     */
    return {
      text,
      placement: context.annotation.type === 'rect' ? 'center' : 'below',
      minFontSize: labelSizing.min,
      maxFontSize: labelSizing.max,
      orientation: 'upright',
      visible: Boolean(text),
    };
  };

  /*
   * Presentation hints are resolved once, when the annotation is projected —
   * from its own stylesheet, or from a legacy inline `target.style` for
   * documents Mango wrote before stylesheets. Re-parsing CSS here would be a
   * second interpretation of the same string, and the sanitising that keeps a
   * stranger's stylesheet out of the document lives on the projection side.
   */
  const editorStyle = (annotation: ResolvedAnnotation): Partial<AnnotationStyle> | undefined => {
    /*
     * Falls back to the legacy inline value when nothing has resolved hints.
     * Story drawings carry their colour that way — they are built directly as
     * projections rather than parsed from a document — so reading `styleHints`
     * alone dropped them onto the layer palette, and a chapter's orange
     * annotation turned purple the moment it was opened for editing.
     */
    const hints = annotation.styleHints ?? hintsFromInlineStyle(annotation.targetStyle);
    if (!hints) return undefined;
    const { opacity: _opacity, ...style } = hints;
    return Object.keys(style).length > 0 ? style : undefined;
  };

  const toShape = (annotation: ResolvedAnnotation): ShapeData | null => {
    const shared = {
      id: annotation.id,
      layer: annotation.targetStyleClass,
      label: annotation.label,
      text: annotation.text,
      style: editorStyle(annotation),
    };
    if (annotation.rect) {
      return {
        ...shared,
        type: 'rect',
        geometry: {
          x: annotation.rect.x,
          y: annotation.rect.y,
          w: annotation.rect.w,
          h: annotation.rect.h,
        },
      };
    }
    if (annotation.point) {
      return {
        ...shared,
        type: 'point',
        geometry: { x: annotation.point.x, y: annotation.point.y },
      };
    }
    if (annotation.polygon?.points?.length) {
      if (annotation.shapeType === 'line' && annotation.polygon.points.length >= 2) {
        const start = annotation.polygon.points[0];
        const end = annotation.polygon.points[annotation.polygon.points.length - 1];
        return {
          ...shared,
          type: 'line',
          geometry: {
            start: { x: start.x, y: start.y },
            end: { x: end.x, y: end.y },
          },
        };
      }
      const points = annotation.polygon.points.map((point) => ({ x: point.x, y: point.y }));
      if (annotation.shapeType === 'freehand') {
        return {
          ...shared,
          type: 'freehand',
          geometry: { points },
        };
      }
      return { ...shared, type: 'polygon', geometry: { points } };
    }
    return null;
  };

  const toPatch = (shape: ShapeData): Partial<ResolvedAnnotation> => {
    if (shape.type === 'rect') {
      return { shapeType: 'rect', rect: shape.geometry, point: undefined, polygon: undefined };
    }
    if (shape.type === 'point') {
      return { shapeType: 'point', rect: undefined, point: shape.geometry, polygon: undefined };
    }
    if (shape.type === 'line') {
      return {
        shapeType: 'line',
        rect: undefined,
        point: undefined,
        polygon: { points: [shape.geometry.start, shape.geometry.end] },
      };
    }
    return {
      shapeType: shape.type,
      rect: undefined,
      point: undefined,
      polygon: { points: shape.geometry.points },
    };
  };

  const modeForTool = (tool: Tool): EditorMode => (tool === 'select' ? 'select' : tool);

  const translucentFill = (color: string, opacity = 0.18): string => {
    const value = color.trim();
    const shortHex = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    const longHex = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    const channels = shortHex
      ? shortHex.slice(1).map((channel) => parseInt(`${channel}${channel}`, 16))
      : longHex
        ? longHex.slice(1).map((channel) => parseInt(channel, 16))
        : null;
    return channels ? `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${opacity})` : value;
  };

  const themeForLayers = (items: LayerItem[]): AnnotationTheme => ({
    layers: Object.fromEntries(
      items.map((layer) => [
        layer.id,
        {
          strokeColor: layer.color,
          fillColor: translucentFill(layer.color),
        },
      ]),
    ),
  });

  $effect(() => {
    if (!enabled || !viewer || canvasWidth <= 0 || canvasHeight <= 0) return;
    const instance = new OSDAnnotationEditor({
      viewer,
      canvasSize: { width: canvasWidth, height: canvasHeight },
      annotations: untrack(() =>
        annotations.map(toShape).filter((shape): shape is ShapeData => Boolean(shape)),
      ),
      selectedId: untrack(() => activeAnnotationId),
      mode: untrack(() => modeForTool(activeTool)),
      currentLayer: untrack(() => activeLayerId),
      theme: untrack(() => themeForLayers(layers)),
      renderer: { label: labelSpec },
      onSelectionChanged: (id) => {
        if (id && annotations.some((annotation) => annotation.id === id)) {
          onannotationselect?.({ id });
        }
      },
      onAnnotationCreated: (shape) => {
        if (!canvasId) return;
        const tool = shapeTool(shape);
        if (!tool) return;
        /*
         * The layer becomes a `styleClass` and the motivation is a real term.
         * These used to be the same argument: the canvas package's `layer` is a
         * presentation key, it was handed to the serializer as `layer`, and the
         * serializer wrote it as `motivation` — which is how every annotation
         * drawn on the stage was exported as `motivation: "mine"`.
         */
        const layerId = shape.layer ?? activeLayerId;
        const layer = layers.find((entry) => entry.id === layerId);
        const document = createMangoAnnotation({
          id: shape.id,
          canvasId,
          shape,
          text: shape.text,
          label: shape.label,
          styleClass: layerId ? styleClassForLayer(layerId) : undefined,
          stylesheet: layer ? buildLayerStylesheet([layer]) : null,
        });
        onannotationcreate?.({
          annotation: serializeWebAnnotation(document, { profile: 'iiif-presentation-3' }).json,
          tool,
        });
      },
      /*
       * Geometry edits come through `onAnnotationChanged`, not the older
       * `onAnnotationUpdated`, because only this one says where the change came
       * from — and that distinction is load bearing rather than tidiness.
       *
       * Mango mirrors editor changes into its own state and syncs the result
       * back. `onAnnotationUpdated` fires for that echo exactly as it does for a
       * real drag, so reporting it produced a new projection object, which
       * re-ran the sync, which echoed again: an effect loop Svelte aborts after
       * a thousand rounds, leaving the editor frozen mid-update. That is why a
       * saved annotation kept showing as an unsaved draft.
       *
       * `transient` changes are the in-flight samples of a drag; only the
       * committed one is an undo step, already coalesced by the editor.
       */
      onAnnotationChanged: (change) => {
        if (change.transient) return;
        if (change.kind === 'update' && change.after) {
          /*
           * Report only geometry the editor did not get from us.
           *
           * Mango mirrors editor changes into its own state and syncs the
           * result back, and the editor reports that echo as an ordinary
           * committed change — `operation: 'batch'`, indistinguishable by label
           * from a real multi-shape edit. Feeding it back produced a fresh
           * projection object, which re-ran the sync, which echoed again: an
           * effect loop Svelte aborts after a thousand rounds, leaving the
           * editor frozen mid-update. That is why a saved annotation went on
           * showing as an unsaved draft.
           *
           * Comparing against what we last pushed is what makes this robust:
           * it does not depend on how the package labels a sync.
           */
          const geometry = JSON.stringify(change.after.geometry);
          if (pushedGeometry.get(change.id) === geometry) return;
          pushedGeometry.set(change.id, geometry);
          onannotationupdate?.({ id: change.id, patch: toPatch(change.after) });
        }
        ongeometrycommit?.({ id: change.id });
      },
      onAnnotationDeleted: (id) => onannotationdelete?.({ id }),
      onModeChanged: (mode) => {
        if (mode === 'select') ontoolchange?.({ tool: 'select' });
      },
    });
    editor = instance;
    oneditorready?.(instance);
    return () => {
      oneditorready?.(null);
      instance.destroy();
      if (editor === instance) editor = null;
    };
  });

  $effect(() => {
    if (!editor) return;
    /*
     * `preserve`, not the default. Mango mirrors every editor change into its
     * own state and passes the result straight back, so the default `reset`
     * would wipe the undo stack on every single edit — silently, because
     * nothing errors and undo simply stops working.
     */
    const shapes = annotations.map(toShape).filter((shape): shape is ShapeData => Boolean(shape));
    // Recorded before the push, so the echo it provokes is recognised as ours.
    pushedGeometry.clear();
    for (const shape of shapes) pushedGeometry.set(shape.id, JSON.stringify(shape.geometry));
    editor.setAnnotations(shapes, { history: 'preserve' });
    editor.select(activeAnnotationId);
  });

  $effect(() => {
    editor?.setMode(modeForTool(activeTool));
  });

  $effect(() => {
    editor?.updateCanvasSize({ width: canvasWidth, height: canvasHeight });
  });

  $effect(() => {
    editor?.updateTheme(themeForLayers(layers));
  });

  $effect(() => {
    editor?.setCurrentLayer(activeLayerId);
  });
</script>
