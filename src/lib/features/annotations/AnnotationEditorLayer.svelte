<script lang="ts">
  import RectanglePlacementEditor from './RectanglePlacementEditor.svelte';
  import type { ViewBox } from '../../core/types/viewer';

  interface Props {
    enabled?: boolean;
    viewBox?: ViewBox | null;
    width?: number;
    height?: number;
    canvasId?: string | null;
    activeTool?: 'select' | 'rectangle' | 'point' | 'polygon' | 'freehand' | 'line';
    ontoolchange?:
      | ((payload: {
          tool: 'select' | 'rectangle' | 'point' | 'polygon' | 'freehand' | 'line';
        }) => void)
      | undefined;
    onannotationcreate?: ((payload: { annotation: unknown }) => void) | undefined;
  }

  let {
    enabled = false,
    viewBox = null,
    width = 0,
    height = 0,
    canvasId = null,
    activeTool = 'rectangle',
    ontoolchange = undefined,
    onannotationcreate = undefined,
  }: Props = $props();

  let drawing = $state(false);
  let startX = $state(0);
  let startY = $state(0);
  let endX = $state(0);
  let endY = $state(0);
  let rectangleDraft = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  let polygonPoints = $state<Array<{ x: number; y: number }>>([]);
  let freehandPoints = $state<Array<{ x: number; y: number }>>([]);

  const toCanvasX = (screenX: number) =>
    viewBox ? viewBox.x + (screenX / width) * viewBox.w : 0;
  const toCanvasY = (screenY: number) =>
    viewBox ? viewBox.y + (screenY / height) * viewBox.h : 0;
  const toScreenX = (canvasX: number) =>
    viewBox ? ((canvasX - viewBox.x) / viewBox.w) * width : 0;
  const toScreenY = (canvasY: number) =>
    viewBox ? ((canvasY - viewBox.y) / viewBox.h) * height : 0;
  const pointsToSvg = (points: Array<{ x: number; y: number }>) =>
    `<svg><polygon points="${points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}" /></svg>`;
  const lineToSvg = (start: { x: number; y: number }, end: { x: number; y: number }) =>
    `<svg><polyline points="${Math.round(start.x)},${Math.round(start.y)} ${Math.round(end.x)},${Math.round(end.y)}" /></svg>`;
  const polylineToSvg = (points: Array<{ x: number; y: number }>) =>
    `<svg><polyline points="${points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}" /></svg>`;

  const emitAnnotation = (
    targetSelector: {
      type: 'FragmentSelector' | 'SvgSelector';
      value: string;
      conformsTo?: string;
    },
  ) => {
    if (!canvasId) return;
    onannotationcreate?.({
      annotation: {
        id: `anno-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: 'Annotation',
        motivation: 'oa:commenting',
        body: [{ type: 'TextualBody', value: '', format: 'text/plain' }],
        target: {
          type: 'SpecificResource',
          source: canvasId,
          selector: targetSelector,
        },
      },
    });
  };

  const canvasRectFromNormalized = (rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): { x: number; y: number; w: number; h: number } | null => {
    if (!viewBox || width <= 0 || height <= 0) return null;

    const x1 = rect.x * width;
    const y1 = rect.y * height;
    const x2 = (rect.x + rect.w) * width;
    const y2 = (rect.y + rect.h) * height;

    const cx1 = toCanvasX(Math.min(x1, x2));
    const cy1 = toCanvasY(Math.min(y1, y2));
    const cx2 = toCanvasX(Math.max(x1, x2));
    const cy2 = toCanvasY(Math.max(y1, y2));
    const cw = cx2 - cx1;
    const ch = cy2 - cy1;
    if (cw < 1 || ch < 1) return null;

    return { x: cx1, y: cy1, w: cw, h: ch };
  };

  const commitRectangleDraft = (
    rect: { x: number; y: number; w: number; h: number } | null,
  ) => {
    if (!rect) return;
    const canvasRect = canvasRectFromNormalized(rect);
    if (!canvasRect) return;
    emitAnnotation({
      type: 'FragmentSelector',
      conformsTo: 'http://www.w3.org/TR/media-frags/',
      value: `xywh=pixel:${Math.round(canvasRect.x)},${Math.round(canvasRect.y)},${Math.round(canvasRect.w)},${Math.round(canvasRect.h)}`,
    });
  };

  const handleKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    const next =
      key === 'r'
        ? 'rectangle'
        : key === 'o'
          ? 'point'
          : key === 'p'
            ? 'polygon'
            : key === 'f'
              ? 'freehand'
              : key === 'l'
                ? 'line'
                : key === 'v'
                  ? 'select'
                  : null;

    if (next) {
      ontoolchange?.({ tool: next });
      return;
    }

    if (event.key === 'Escape') {
      if (
        drawing ||
        polygonPoints.length > 0 ||
        freehandPoints.length > 0 ||
        rectangleDraft
      ) {
        drawing = false;
        polygonPoints = [];
        freehandPoints = [];
        rectangleDraft = null;
      } else {
        ontoolchange?.({ tool: 'select' });
      }
      return;
    }

    if (!enabled) return;

    if (event.key === 'Enter' && activeTool === 'polygon' && polygonPoints.length >= 3) {
      emitAnnotation({ type: 'SvgSelector', value: pointsToSvg(polygonPoints) });
      polygonPoints = [];
      drawing = false;
      return;
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!enabled || !viewBox) return;
    if (activeTool === 'rectangle') return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    startX = event.clientX - rect.left;
    startY = event.clientY - rect.top;
    endX = startX;
    endY = startY;
    if (activeTool === 'point') {
      const cx = toCanvasX(startX);
      const cy = toCanvasY(startY);
      emitAnnotation({
        type: 'FragmentSelector',
        conformsTo: 'http://www.w3.org/TR/media-frags/',
        value: `xywh=pixel:${Math.round(cx)},${Math.round(cy)},1,1`,
      });
      return;
    }
    if (activeTool === 'polygon') {
      polygonPoints = [...polygonPoints, { x: toCanvasX(startX), y: toCanvasY(startY) }];
      drawing = polygonPoints.length > 0;
      return;
    }
    drawing = true;
    if (activeTool === 'freehand') {
      freehandPoints = [{ x: toCanvasX(startX), y: toCanvasY(startY) }];
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!drawing) return;
    if (activeTool === 'rectangle') return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const nextX = event.clientX - rect.left;
    const nextY = event.clientY - rect.top;
    endX = nextX;
    endY = nextY;
    if (activeTool === 'freehand') {
      freehandPoints = [...freehandPoints, { x: toCanvasX(nextX), y: toCanvasY(nextY) }];
    }
  };

  const onPointerUp = () => {
    if (!drawing || !viewBox || !canvasId) return;
    if (activeTool === 'rectangle') return;
    if (activeTool === 'polygon') return;
    drawing = false;

    const x1 = Math.min(startX, endX);
    const y1 = Math.min(startY, endY);
    const x2 = Math.max(startX, endX);
    const y2 = Math.max(startY, endY);

    const cx1 = toCanvasX(x1);
    const cy1 = toCanvasY(y1);
    const cx2 = toCanvasX(x2);
    const cy2 = toCanvasY(y2);

    if (activeTool === 'line') {
      emitAnnotation({
        type: 'SvgSelector',
        value: lineToSvg({ x: cx1, y: cy1 }, { x: cx2, y: cy2 }),
      });
      return;
    }
    if (activeTool === 'freehand') {
      if (freehandPoints.length < 2) return;
      emitAnnotation({
        type: 'SvgSelector',
        value: polylineToSvg(freehandPoints),
      });
      freehandPoints = [];
      return;
    }
    if (Math.abs(cx2 - cx1) < 1 || Math.abs(cy2 - cy1) < 1) return;
    emitAnnotation({
      type: 'FragmentSelector',
      conformsTo: 'http://www.w3.org/TR/media-frags/',
      value: `xywh=pixel:${Math.round(cx1)},${Math.round(cy1)},${Math.round(cx2 - cx1)},${Math.round(cy2 - cy1)}`,
    });
  };

  const onDblClick = (event: MouseEvent) => {
    if (!enabled) return;
    if (activeTool === 'polygon') {
      let points = [...polygonPoints];
      if (points.length >= 3) {
        points.pop();
      }
      if (points.length >= 3) {
        emitAnnotation({ type: 'SvgSelector', value: pointsToSvg(points) });
      }
      polygonPoints = [];
      drawing = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  $effect(() => {
    if (!enabled || activeTool !== 'rectangle') {
      rectangleDraft = null;
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if enabled}
  <div
    class="annotation-editor"
    class:annotation-editor--crosshair={activeTool !== 'rectangle'}
    role="application"
    aria-label="Annotation drawing surface"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={onPointerUp}
    ondblclick={onDblClick}
  >
    {#if activeTool === 'rectangle'}
      <RectanglePlacementEditor
        enabled={true}
        value={rectangleDraft}
        minSize={0.0001}
        showHandles={false}
        allowCreate={true}
        allowMove={false}
        allowResize={false}
        commitOnPointerUp={true}
        onrectchange={({ rect }) => {
          rectangleDraft = rect;
        }}
        onrectcommit={({ rect }) => {
          commitRectangleDraft(rect);
          rectangleDraft = null;
        }}
      />
    {/if}
    {#if drawing && activeTool === 'line'}
      <svg class="annotation-editor__svg" aria-hidden="true">
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          class="annotation-editor__line"
        />
      </svg>
    {/if}
    {#if activeTool === 'polygon' && polygonPoints.length > 0}
      <svg class="annotation-editor__svg" aria-hidden="true">
        <polyline
          points={`${polygonPoints.map((p) => `${toScreenX(p.x)},${toScreenY(p.y)}`).join(' ')} ${endX},${endY}`}
          class="annotation-editor__polyline"
        />
      </svg>
    {/if}
    {#if drawing && activeTool === 'freehand' && freehandPoints.length > 1}
      <svg class="annotation-editor__svg" aria-hidden="true">
        <polyline
          points={freehandPoints
            .map((p) => `${toScreenX(p.x)},${toScreenY(p.y)}`)
            .join(' ')}
          class="annotation-editor__polyline"
        />
      </svg>
    {/if}
  </div>
{/if}

<style>
  .annotation-editor {
    position: absolute;
    inset: 0;
    z-index: 5;
  }

  .annotation-editor--crosshair {
    cursor: crosshair;
  }

  .annotation-editor__svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .annotation-editor__line,
  .annotation-editor__polyline {
    fill: none;
    stroke: rgba(106, 229, 161, 0.95);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
