<script lang="ts">
  import { readable, type Readable } from 'svelte/store';
  import type { StoryState } from '../../core/types/story';
  import type { ViewBox } from '../../core/types/viewer';
  import { coerceAnnotationPlacement, DEFAULT_ANNOTATION_PLACEMENT } from '../annotationPlacement';

  export let story: Readable<StoryState>;
  export let viewBox: Readable<ViewBox | null> = readable(null);
  export let chapterId: string | null = null;
  export let language = 'en';
  export let visible = true;
  export let showDrawings = true;
  export let editable = false;
  export let onEditText: ((language: string) => void) | undefined = undefined;

  $: chapter = $story.chapters.find((item) => item.id === chapterId) ?? null;
  $: annotation = chapter?.annotations?.[language] ?? null;
  $: text = annotation?.text ?? '';
  $: fallbackPlacement = Object.values(chapter?.annotations ?? {})
    .map((entry) => coerceAnnotationPlacement(entry?.placement))
    .find((entry) => Boolean(entry));
  $: placement =
    coerceAnnotationPlacement(annotation?.placement) ??
    coerceAnnotationPlacement(chapter?.annotationPlacement) ??
    fallbackPlacement ??
    DEFAULT_ANNOTATION_PLACEMENT;
  $: captureViewBox = chapter?.viewBox ?? null;
  $: currentViewBox = $viewBox;
  $: isAbsolute = Boolean(
    placement && (placement.x > 1 || placement.y > 1 || placement.w > 1 || placement.h > 1),
  );
  $: canvasBounds = isAbsolute
    ? placement
    : captureViewBox
      ? {
          x: captureViewBox.x + captureViewBox.w * placement.x,
          y: captureViewBox.y + captureViewBox.h * placement.y,
          w: captureViewBox.w * placement.w,
          h: captureViewBox.h * placement.h,
        }
      : null;
  $: projectedBounds =
    canvasBounds && currentViewBox
      ? {
          x: (canvasBounds.x - currentViewBox.x) / currentViewBox.w,
          y: (canvasBounds.y - currentViewBox.y) / currentViewBox.h,
          w: canvasBounds.w / currentViewBox.w,
          h: canvasBounds.h / currentViewBox.h,
        }
      : null;
  $: anchored =
    projectedBounds !== null &&
    Number.isFinite(projectedBounds.x) &&
    Number.isFinite(projectedBounds.y) &&
    Number.isFinite(projectedBounds.w) &&
    Number.isFinite(projectedBounds.h);
  $: inView =
    anchored &&
    projectedBounds.x + projectedBounds.w >= 0 &&
    projectedBounds.x <= 1 &&
    projectedBounds.y + projectedBounds.h >= 0 &&
    projectedBounds.y <= 1;
  $: annotationScale =
    captureViewBox && currentViewBox && currentViewBox.w > 0
      ? Math.max(0.15, captureViewBox.w / currentViewBox.w)
      : 1;
  $: noteStyle = anchored
    ? `left: ${(projectedBounds.x * 100).toFixed(3)}%; top: ${(projectedBounds.y * 100).toFixed(3)}%; width: ${(projectedBounds.w * 100).toFixed(3)}%; height: ${(projectedBounds.h * 100).toFixed(3)}%; --annotation-scale:${annotationScale};`
    : `left: ${(placement.x * 100).toFixed(3)}%; top: ${(placement.y * 100).toFixed(3)}%; width: ${(placement.w * 100).toFixed(3)}%; height: ${(placement.h * 100).toFixed(3)}%; --annotation-scale:1;`;
  $: show = Boolean(visible && text && chapterId && (!anchored || inView));
  $: drawingShapes = (chapter?.drawingAnnotations ?? []).flatMap((annotation, index) => {
    if (!currentViewBox) return [];
    const project = (point: { x: number; y: number }) => ({
      x: ((point.x - currentViewBox!.x) / currentViewBox!.w) * 100,
      y: ((point.y - currentViewBox!.y) / currentViewBox!.h) * 100,
    });
    if (annotation.rect) {
      const origin = project(annotation.rect);
      return [
        {
          annotation,
          index,
          kind: 'rect' as const,
          x: origin.x,
          y: origin.y,
          w: (annotation.rect.w / currentViewBox.w) * 100,
          h: (annotation.rect.h / currentViewBox.h) * 100,
        },
      ];
    }
    if (annotation.point) {
      const point = project(annotation.point);
      return [{ annotation, index, kind: 'point' as const, x: point.x, y: point.y }];
    }
    if (annotation.points?.length) {
      return [
        {
          annotation,
          index,
          kind: 'points' as const,
          points: annotation.points
            .map(project)
            .map((point) => `${point.x},${point.y}`)
            .join(' '),
        },
      ];
    }
    return [];
  });
</script>

<div class="story-annotation-overlay" data-testid="story-annotation-overlay">
  {#if show}
    <button
      type="button"
      class="story-annotation-overlay__note"
      class:story-annotation-overlay__note--editable={editable}
      data-testid="story-annotation-note"
      style={noteStyle}
      disabled={!editable}
      aria-label={`Edit text annotation: ${text}`}
      on:click={() => editable && onEditText?.(language)}
    >
      {text}
    </button>
  {/if}
  {#if visible && showDrawings && drawingShapes.length}
    <svg
      class="story-annotation-overlay__drawings"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-label="Chapter drawing annotations"
    >
      {#each drawingShapes as shape (shape.annotation.id)}
        {#if shape.kind === 'rect'}
          <rect
            class="story-annotation-overlay__shape"
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
          />
        {:else if shape.kind === 'point'}
          <circle class="story-annotation-overlay__point" cx={shape.x} cy={shape.y} r="1.2" />
          <text class="story-annotation-overlay__point-label" x={shape.x} y={shape.y}
            >{shape.index + 1}</text
          >
        {:else if shape.annotation.type === 'polygon'}
          <polygon class="story-annotation-overlay__shape" points={shape.points} />
        {:else}
          <polyline class="story-annotation-overlay__line" points={shape.points} />
        {/if}
      {/each}
    </svg>
  {/if}
</div>

<style>
  .story-annotation-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    padding: 16px;
  }

  .story-annotation-overlay__note {
    position: absolute;
    box-sizing: border-box;
    max-width: 100%;
    max-height: 100%;
    padding: calc(10px * var(--annotation-scale, 1)) calc(12px * var(--annotation-scale, 1));
    border: 0;
    border-radius: calc(12px * var(--annotation-scale, 1));
    background: rgba(255, 255, 255, 0.92);
    color: var(--ink, #2b2520);
    font: inherit;
    font-size: calc(13px * var(--annotation-scale, 1));
    line-height: 1.4;
    box-shadow: 0 12px 28px rgba(43, 37, 32, 0.16);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    overflow: hidden;
    pointer-events: none;
  }

  .story-annotation-overlay__note--editable {
    pointer-events: auto;
    cursor: move;
    outline: 1px solid color-mix(in srgb, var(--accent, #e07a3f) 72%, white);
  }

  .story-annotation-overlay__note--editable:hover,
  .story-annotation-overlay__note--editable:focus-visible {
    outline: 2px solid var(--accent, #e07a3f);
    outline-offset: 2px;
  }

  .story-annotation-overlay__drawings {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .story-annotation-overlay__shape,
  .story-annotation-overlay__line,
  .story-annotation-overlay__point {
    vector-effect: non-scaling-stroke;
    stroke: var(--accent, #e07a3f);
    stroke-width: 2px;
  }
  .story-annotation-overlay__shape {
    fill: color-mix(in srgb, var(--accent, #e07a3f) 16%, transparent);
  }
  .story-annotation-overlay__line {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .story-annotation-overlay__point {
    fill: var(--accent, #e07a3f);
    stroke: white;
  }
  .story-annotation-overlay__point-label {
    fill: white;
    font-size: 1.2px;
    font-weight: 850;
    text-anchor: middle;
    dominant-baseline: central;
  }
</style>
