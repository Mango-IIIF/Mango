<script lang="ts">
  import { untrack } from 'svelte';
  import {
    OSDAnnotationEditor,
    type AnnotationTheme,
    type EditorMode,
    type OSDLikeViewer,
    type ShapeData,
  } from '@mango-iiif/annotation';
  import { W3CParser } from '@mango-iiif/w3c-parser';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import type { LayerItem } from './workspace/LeftSidebar.svelte';

  type Tool = 'select' | 'rectangle' | 'point' | 'polygon' | 'freehand' | 'line';

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
    ontoolchange?: ((payload: { tool: Tool }) => void) | undefined;
    onannotationcreate?: ((payload: { annotation: unknown }) => void) | undefined;
    onannotationupdate?:
      | ((payload: { id: string; patch: Partial<ResolvedAnnotation> }) => void)
      | undefined;
    onannotationdelete?: ((payload: { id: string }) => void) | undefined;
    onannotationselect?: ((payload: { id: string }) => void) | undefined;
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
    ontoolchange = undefined,
    onannotationcreate = undefined,
    onannotationupdate = undefined,
    onannotationdelete = undefined,
    onannotationselect = undefined,
  }: Props = $props();

  let editor: OSDAnnotationEditor | null = $state(null);

  const toShape = (annotation: ResolvedAnnotation): ShapeData | null => {
    const shared = {
      id: annotation.id,
      layer: annotation.targetStyleClass,
      label: annotation.label,
      text: annotation.text,
      data: annotation,
    };
    if (annotation.rect) return { ...shared, type: 'rect', geometry: annotation.rect };
    if (annotation.point) return { ...shared, type: 'point', geometry: annotation.point };
    if (annotation.polygon?.points?.length) {
      return { ...shared, type: 'polygon', geometry: { points: annotation.polygon.points } };
    }
    return null;
  };

  const toPatch = (shape: ShapeData): Partial<ResolvedAnnotation> => {
    if (shape.type === 'rect') {
      return { rect: shape.geometry, point: undefined, polygon: undefined };
    }
    if (shape.type === 'point') {
      return { rect: undefined, point: shape.geometry, polygon: undefined };
    }
    if (shape.type === 'line') {
      return {
        rect: undefined,
        point: undefined,
        polygon: { points: [shape.geometry.start, shape.geometry.end] },
      };
    }
    return {
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
    return channels
      ? `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${opacity})`
      : value;
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
      currentLayer: 'mine',
      theme: untrack(() => themeForLayers(layers)),
      onSelectionChanged: (id) => {
        if (id && annotations.some((annotation) => annotation.id === id)) {
          onannotationselect?.({ id });
        }
      },
      onAnnotationCreated: (shape) => {
        if (!canvasId) return;
        const annotation = W3CParser.serialize({
          id: shape.id,
          canvasId,
          text: shape.text ?? '',
          label: shape.label,
          layer: shape.layer,
          shape,
        });
        onannotationcreate?.({ annotation });
      },
      onAnnotationUpdated: (shape) => {
        onannotationupdate?.({ id: shape.id, patch: toPatch(shape) });
      },
      onAnnotationDeleted: (id) => onannotationdelete?.({ id }),
      onModeChanged: (mode) => {
        if (mode === 'select') ontoolchange?.({ tool: 'select' });
      },
    });
    editor = instance;
    return () => {
      instance.destroy();
      if (editor === instance) editor = null;
    };
  });

  $effect(() => {
    if (!editor) return;
    editor.setAnnotations(
      annotations.map(toShape).filter((shape): shape is ShapeData => Boolean(shape)),
    );
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
</script>
