<script lang="ts">
  import { untrack } from 'svelte';
  import {
    OSDAnnotationEditor,
    type AnnotationStyle,
    type AnnotationTheme,
    type EditorMode,
    type OSDLikeViewer,
    type ShapeData,
  } from '@mango-iiif/annotation';
  import { W3CParser } from '@mango-iiif/w3c-parser';
  import { normalizedShapeTool } from './w3c';
  import {
    fitRectangleLabelLayout,
    rectangleLabelOutlineWidth,
  } from './rectangleLabelLayout';
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
    onannotationcreate?:
      ((payload: { annotation: unknown; tool: Exclude<Tool, 'select'> }) => void) | undefined;
    onannotationupdate?:
      ((payload: { id: string; patch: Partial<ResolvedAnnotation> }) => void) | undefined;
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

  const fitRectangleLabels = () => {
    const root = viewer?.container.querySelector('.mango-annotation-editor');
    if (!root) return;
    const labelsById = new Map(
      annotations.flatMap((annotation) => {
        const label = annotation.label?.trim();
        return annotation.rect && label ? [[annotation.id, label] as const] : [];
      }),
    );

    for (const shape of root.querySelectorAll<SVGElement>('[data-annotation-id]')) {
      const id = shape.dataset.annotationId;
      const label = id ? labelsById.get(id) : undefined;
      const text = shape.nextElementSibling;
      if (
        !label ||
        shape.tagName.toLowerCase() !== 'rect' ||
        text?.tagName.toLowerCase() !== 'text'
      ) {
        continue;
      }

      const x = Number(shape.getAttribute('x'));
      const y = Number(shape.getAttribute('y'));
      const width = Number(shape.getAttribute('width'));
      const height = Number(shape.getAttribute('height'));
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        continue;
      }

      const { fontSize, lineHeight, lines } = fitRectangleLabelLayout(width, height, label);
      const centreX = x + width / 2;
      const firstLineY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
      text.setAttribute('x', String(centreX));
      text.setAttribute('y', String(firstLineY));
      text.setAttribute('font-size', fontSize.toFixed(2));
      text.setAttribute('stroke-width', rectangleLabelOutlineWidth(fontSize).toFixed(2));
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('data-fitted-rectangle-label', id);
      const signature = `${label}|${x}|${y}|${width}|${height}|${lines.join('|')}`;
      if (
        text.getAttribute('data-label-layout') !== signature ||
        text.querySelectorAll('tspan').length !== lines.length
      ) {
        text.setAttribute('data-label-layout', signature);
        text.replaceChildren(
          ...lines.map((line, index) => {
            const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan.textContent = line;
            tspan.setAttribute('x', String(centreX));
            tspan.setAttribute('dy', index === 0 ? '0' : lineHeight.toFixed(2));
            return tspan;
          }),
        );
      }
    }
  };

  const editorStyle = (annotation: ResolvedAnnotation): Partial<AnnotationStyle> | undefined => {
    const declarations = annotation.targetStyle
      ?.split(';')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!declarations?.length) return undefined;

    const values = new Map<string, string>();
    for (const declaration of declarations) {
      const separator = declaration.indexOf(':');
      if (separator < 0) continue;
      values.set(
        declaration.slice(0, separator).trim().toLowerCase(),
        declaration.slice(separator + 1).trim(),
      );
    }

    const strokeWidth = Number.parseFloat(values.get('stroke-width') ?? '');
    return {
      ...(values.get('stroke') ? { strokeColor: values.get('stroke') } : {}),
      ...(values.get('fill') ? { fillColor: values.get('fill') } : {}),
      ...(Number.isFinite(strokeWidth) ? { strokeWidth } : {}),
    };
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
      currentLayer: 'mine',
      theme: untrack(() => themeForLayers(layers)),
      onSelectionChanged: (id) => {
        if (id && annotations.some((annotation) => annotation.id === id)) {
          onannotationselect?.({ id });
        }
      },
      onAnnotationCreated: (shape) => {
        if (!canvasId) return;
        const tool = normalizedShapeTool(shape);
        if (!tool) return;
        const annotation = W3CParser.serialize({
          id: shape.id,
          canvasId,
          text: shape.text ?? '',
          label: shape.label,
          layer: shape.layer,
          shape,
        });
        onannotationcreate?.({ annotation, tool });
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
    const annotationRoot = viewer.container.querySelector('.mango-annotation-editor');
    let labelObserver: MutationObserver | null = null;
    if (annotationRoot && typeof MutationObserver !== 'undefined') {
      labelObserver = new MutationObserver(() => fitRectangleLabels());
      labelObserver.observe(annotationRoot, { childList: true, subtree: true });
    }
    fitRectangleLabels();
    return () => {
      labelObserver?.disconnect();
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
    fitRectangleLabels();
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
