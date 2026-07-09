<script lang="ts">
  import { untrack } from 'svelte';

  type PlacementRect = {
    x: number;
    y: number;
    w: number;
    h: number;
  };

  type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw';
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

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

  const cloneRect = (rect: PlacementRect): PlacementRect => ({
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
  });

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
  let draftRect = $state<PlacementRect | null>(null);
  let interaction = $state<InteractionSource | null>(null);
  let resizeHandle = $state<ResizeHandle | null>(null);
  let anchor = $state<{ x: number; y: number } | null>(null);
  let moveOffset = $state({ x: 0, y: 0 });
  let activePointerId = $state<number | null>(null);

  const rectEquals = (a: PlacementRect | null, b: PlacementRect | null): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
  };

  const normalizeRect = (rect: PlacementRect): PlacementRect => {
    const nextMinSize = clamp(minSize, 0.0001, 1);
    const w = clamp(rect.w, nextMinSize, 1);
    const h = clamp(rect.h, nextMinSize, 1);
    const x = clamp(rect.x, 0, 1 - w);
    const y = clamp(rect.y, 0, 1 - h);
    return { x, y, w, h };
  };

  const pointFromEvent = (event: PointerEvent): { x: number; y: number } | null => {
    if (!container) return null;
    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
  };

  const pointInRect = (point: { x: number; y: number }, rect: PlacementRect): boolean => {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.w &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.h
    );
  };

  const oppositeCorner = (
    rect: PlacementRect,
    handle: ResizeHandle,
  ): { x: number; y: number } => {
    if (handle === 'nw') {
      return { x: rect.x + rect.w, y: rect.y + rect.h };
    }
    if (handle === 'ne') {
      return { x: rect.x, y: rect.y + rect.h };
    }
    if (handle === 'sw') {
      return { x: rect.x + rect.w, y: rect.y };
    }
    return { x: rect.x, y: rect.y };
  };

  const rectFromAnchor = (
    anchorPoint: { x: number; y: number },
    pointerPoint: { x: number; y: number },
  ): PlacementRect => {
    const nextMinSize = clamp(minSize, 0.0001, 1);
    let x = Math.min(anchorPoint.x, pointerPoint.x);
    let y = Math.min(anchorPoint.y, pointerPoint.y);
    let w = Math.abs(pointerPoint.x - anchorPoint.x);
    let h = Math.abs(pointerPoint.y - anchorPoint.y);

    if (w < nextMinSize) {
      x = pointerPoint.x < anchorPoint.x ? anchorPoint.x - nextMinSize : anchorPoint.x;
      w = nextMinSize;
    }
    if (h < nextMinSize) {
      y = pointerPoint.y < anchorPoint.y ? anchorPoint.y - nextMinSize : anchorPoint.y;
      h = nextMinSize;
    }

    return normalizeRect({ x, y, w, h });
  };

  const emitRectChange = (source: InteractionSource, rect: PlacementRect | null) => {
    onrectchange?.({
      rect: rect ? cloneRect(rect) : null,
      source,
    });
  };

  const commitRect = (rect: PlacementRect | null) => {
    if (!rect) return;
    onrectcommit?.({ rect: cloneRect(rect) });
  };

  const handleFromEvent = (event: PointerEvent): ResizeHandle | null => {
    const target = event.target as HTMLElement | null;
    const handle = target?.closest<HTMLElement>('[data-rect-handle]');
    const value = handle?.dataset.rectHandle;
    if (value === 'nw' || value === 'ne' || value === 'se' || value === 'sw') {
      return value;
    }
    return null;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!enabled) return;
    const point = pointFromEvent(event);
    if (!point) return;

    if (draftRect) {
      const handle = handleFromEvent(event);
      if (allowResize && handle) {
        interaction = 'resize';
        resizeHandle = handle;
        anchor = oppositeCorner(draftRect, handle);
        activePointerId = event.pointerId;
        container?.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        return;
      }
      if (allowMove && pointInRect(point, draftRect)) {
        interaction = 'move';
        resizeHandle = null;
        anchor = null;
        moveOffset = {
          x: point.x - draftRect.x,
          y: point.y - draftRect.y,
        };
        activePointerId = event.pointerId;
        container?.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        return;
      }
    }

    if (!allowCreate) return;

    interaction = 'create';
    resizeHandle = null;
    anchor = { ...point };
    draftRect = normalizeRect({
      x: point.x,
      y: point.y,
      w: clamp(minSize, 0.0001, 1),
      h: clamp(minSize, 0.0001, 1),
    });
    emitRectChange('create', draftRect);
    activePointerId = event.pointerId;
    container?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!enabled || !interaction) return;
    const point = pointFromEvent(event);
    if (!point) return;

    if (interaction === 'move' && draftRect) {
      const next = normalizeRect({
        x: point.x - moveOffset.x,
        y: point.y - moveOffset.y,
        w: draftRect.w,
        h: draftRect.h,
      });
      draftRect = next;
      emitRectChange('move', next);
      return;
    }

    if (!anchor) return;
    const next = rectFromAnchor(anchor, point);
    draftRect = next;
    emitRectChange(interaction === 'create' ? 'create' : 'resize', next);
  };

  const endInteraction = () => {
    if (activePointerId !== null) {
      container?.releasePointerCapture?.(activePointerId);
      activePointerId = null;
    }
    interaction = null;
    resizeHandle = null;
    anchor = null;
  };

  const onPointerUp = () => {
    if (!interaction) return;
    if (commitOnPointerUp) {
      commitRect(draftRect);
    }
    endInteraction();
  };

  const onDoubleClick = (event: MouseEvent) => {
    if (!enabled || !draftRect) return;
    const point = pointFromEvent(event as unknown as PointerEvent);
    if (!point || !pointInRect(point, draftRect)) return;
    commitRect(draftRect);
  };

  const toPercent = (value: number): string => `${(value * 100).toFixed(4)}%`;

  $effect(() => {
    const currentVal = value;
    untrack(() => {
      if (interaction) return;
      const next = currentVal ? normalizeRect(cloneRect(currentVal)) : null;
      if (!rectEquals(draftRect, next)) {
        draftRect = next;
      }
    });
  });
</script>

<div
  bind:this={container}
  class="rect-placement-editor"
  class:rect-placement-editor--enabled={enabled}
  class:rect-placement-editor--passthrough={passthrough}
  role="application"
  aria-label="Rectangle placement editor"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  ondblclick={onDoubleClick}
>
  {#if draftRect}
    <div
      class="rect-placement-editor__rect"
      style={`left:${toPercent(draftRect.x)};top:${toPercent(draftRect.y)};width:${toPercent(draftRect.w)};height:${toPercent(draftRect.h)};`}
    >
      <span class="rect-placement-editor__text">{text}</span>
      {#if showHandles && allowResize}
        <span
          class="rect-placement-editor__handle rect-placement-editor__handle--nw"
          data-rect-handle="nw"
          aria-hidden="true"
        ></span>
        <span
          class="rect-placement-editor__handle rect-placement-editor__handle--ne"
          data-rect-handle="ne"
          aria-hidden="true"
        ></span>
        <span
          class="rect-placement-editor__handle rect-placement-editor__handle--se"
          data-rect-handle="se"
          aria-hidden="true"
        ></span>
        <span
          class="rect-placement-editor__handle rect-placement-editor__handle--sw"
          data-rect-handle="sw"
          aria-hidden="true"
        ></span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .rect-placement-editor {
    position: absolute;
    inset: 0;
    touch-action: none;
  }

  .rect-placement-editor--enabled {
    cursor: crosshair;
  }

  .rect-placement-editor--passthrough {
    pointer-events: none;
    cursor: default;
  }

  .rect-placement-editor__rect {
    position: absolute;
    border: 2px dashed rgba(255, 194, 96, 0.96);
    background: rgba(255, 255, 255, 0.94);
    color: #2b2520;
    font-size: 13px;
    line-height: 1.4;
    padding: 10px 12px;
    border-radius: 12px;
    box-shadow: 0 12px 28px rgba(43, 37, 32, 0.2);
    cursor: move;
    box-sizing: border-box;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .rect-placement-editor__text {
    pointer-events: none;
    max-width: 100%;
    max-height: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: normal;
  }

  .rect-placement-editor__handle {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    border: 2px solid rgba(8, 25, 47, 0.92);
    background: rgba(243, 248, 255, 0.96);
    box-sizing: border-box;
    pointer-events: auto;
  }

  .rect-placement-editor__handle--nw {
    left: -6px;
    top: -6px;
    cursor: nwse-resize;
  }

  .rect-placement-editor__handle--ne {
    right: -6px;
    top: -6px;
    cursor: nesw-resize;
  }

  .rect-placement-editor__handle--se {
    right: -6px;
    bottom: -6px;
    cursor: nwse-resize;
  }

  .rect-placement-editor__handle--sw {
    left: -6px;
    bottom: -6px;
    cursor: nesw-resize;
  }
</style>
