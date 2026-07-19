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

  let previewRect: PlacementRect | null = $state(null);

  const previewStyle = (rect: PlacementRect): string =>
    `left: ${(rect.x * 100).toFixed(3)}%; top: ${(rect.y * 100).toFixed(3)}%; width: ${(rect.w * 100).toFixed(3)}%; height: ${(rect.h * 100).toFixed(3)}%;`;

  const toShape = (rect: PlacementRect): RectAnnotation => ({
    id: annotationId,
    type: 'rect',
    geometry: normalize(rect),
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
        previewRect = rect;
        onrectchange?.({ rect, source: 'create' });
        if (commitOnPointerUp) onrectcommit?.({ rect });
      },
      onAnnotationUpdated: (shape) => {
        if (shape.type !== 'rect' || (!allowMove && !allowResize)) return;
        const rect = normalize(shape.geometry);
        const source = sourceForUpdate(rect);
        lastRect = rect;
        previewRect = rect;
        onrectchange?.({ rect, source });
      },
    });
    const syncPreviewFromEditor = () => {
      const shape = editor
        ?.getAnnotations()
        .find((annotation) => annotation.id === annotationId);
      if (shape?.type === 'rect') previewRect = normalize(shape.geometry);
    };
    const schedulePreviewSync = () => queueMicrotask(syncPreviewFromEditor);
    container.addEventListener('pointermove', schedulePreviewSync, true);
    container.addEventListener('pointerup', schedulePreviewSync, true);
    if (value && showHandles) editor.select(annotationId);
    return () => {
      container?.removeEventListener('pointermove', schedulePreviewSync, true);
      container?.removeEventListener('pointerup', schedulePreviewSync, true);
      editor?.destroy();
      editor = null;
    };
  });

  $effect(() => {
    if (!editor) return;
    lastRect = value ? normalize(value) : null;
    previewRect = lastRect;
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

{#if text && previewRect}
  <div
    class="rect-placement-editor__label"
    data-testid="rect-placement-editor-label"
    style={previewStyle(previewRect)}
  >
    {text}
  </div>
{/if}

<style>
  .rect-placement-editor {
    position: absolute;
    inset: 0;
    touch-action: none;
  }

  .rect-placement-editor--passthrough {
    pointer-events: none;
  }

  .rect-placement-editor__label {
    position: absolute;
    z-index: 4;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.92);
    color: var(--ink, #2b2520);
    font-size: 13px;
    line-height: 1.4;
    text-align: center;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    pointer-events: none;
  }
</style>
