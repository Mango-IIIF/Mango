<script lang="ts">
  import { onMount } from 'svelte';
  import {
    OSDAnnotationEditor,
    type RectAnnotation,
  } from '@mango-iiif/annotation';

  type PlacementRect = { x: number; y: number; w: number; h: number };
  type InteractionSource = 'create' | 'move' | 'resize';

  interface Props {
    enabled?: boolean;
    value?: PlacementRect | null;
    showHandles?: boolean;
    minSize?: number;
    allowCreate?: boolean;
    allowMove?: boolean;
    allowResize?: boolean;
    commitOnPointerUp?: boolean;
    passthrough?: boolean;
    text?: string;
    onrectchange?:
      | ((payload: { rect: PlacementRect | null; source: InteractionSource }) => void)
      | undefined;
    onrectcommit?: ((payload: { rect: PlacementRect }) => void) | undefined;
  }

  let {
    enabled = true,
    value = null,
    showHandles = true,
    minSize = 0.01,
    allowCreate = true,
    allowMove = true,
    allowResize = true,
    commitOnPointerUp = false,
    passthrough = false,
    text = '',
    onrectchange = undefined,
    onrectcommit = undefined,
  }: Props = $props();

  let container: HTMLDivElement | null = $state(null);
  let editor: OSDAnnotationEditor | null = $state(null);
  let lastRect: PlacementRect | null = null;
  const annotationId = 'placement-rect';

  const normalize = (rect: PlacementRect): PlacementRect => {
    const size = Math.min(1, Math.max(0.0001, minSize));
    const w = Math.min(1, Math.max(size, rect.w));
    const h = Math.min(1, Math.max(size, rect.h));
    return {
      x: Math.min(1 - w, Math.max(0, rect.x)),
      y: Math.min(1 - h, Math.max(0, rect.y)),
      w,
      h,
    };
  };

  const toShape = (rect: PlacementRect): RectAnnotation => ({
    id: annotationId,
    type: 'rect',
    geometry: normalize(rect),
    label: text || undefined,
  });

  const sourceForUpdate = (next: PlacementRect): InteractionSource =>
    lastRect && (lastRect.w !== next.w || lastRect.h !== next.h) ? 'resize' : 'move';

  onMount(() => {
    if (!container) return;
    editor = new OSDAnnotationEditor({
      viewer: { container },
      canvasSize: { width: 1, height: 1 },
      mode: enabled ? (allowCreate && !value ? 'draw-rect' : 'select') : 'none',
      annotations: value ? [toShape(value)] : [],
      selectedId: value && showHandles ? annotationId : null,
      keyboardTarget: container,
      config: {
        minShapeSize: { width: minSize, height: minSize },
      },
      style: {
        strokeColor: 'rgba(255, 194, 96, 0.96)',
        fillColor: 'transparent',
        activeColor: 'rgba(255, 194, 96, 1)',
      },
      onAnnotationCreated: (shape) => {
        if (shape.type !== 'rect') return;
        const rect = normalize(shape.geometry);
        lastRect = rect;
        onrectchange?.({ rect, source: 'create' });
        if (commitOnPointerUp) onrectcommit?.({ rect });
      },
      onAnnotationUpdated: (shape) => {
        if (shape.type !== 'rect' || (!allowMove && !allowResize)) return;
        const rect = normalize(shape.geometry);
        const source = sourceForUpdate(rect);
        lastRect = rect;
        onrectchange?.({ rect, source });
      },
    });
    if (value && showHandles) editor.select(annotationId);
    return () => {
      editor?.destroy();
      editor = null;
    };
  });

  $effect(() => {
    if (!editor) return;
    lastRect = value ? normalize(value) : null;
    editor.setAnnotations(value ? [toShape(value)] : []);
    editor.select(value && showHandles ? annotationId : null);
  });

  $effect(() => {
    if (!editor) return;
    editor.setMode(enabled ? (allowCreate && !value ? 'draw-rect' : 'select') : 'none');
    editor.updateConfig({ minShapeSize: { width: minSize, height: minSize } });
  });
</script>

<div
  bind:this={container}
  class="rect-placement-editor"
  class:rect-placement-editor--passthrough={passthrough}
  role="application"
  aria-label="Rectangle placement editor"
></div>

<style>
  .rect-placement-editor {
    position: absolute;
    inset: 0;
    touch-action: none;
  }

  .rect-placement-editor--passthrough {
    pointer-events: none;
  }
</style>
