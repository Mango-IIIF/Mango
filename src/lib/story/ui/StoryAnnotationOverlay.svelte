<script lang="ts">
  import { t } from '../../i18n';
  import { readable, type Readable } from 'svelte/store';
  import { ANNOTATION_STROKE_WIDTH_PX } from '../../core/types/story';
  import type { ChapterDrawingAnnotation, StoryState } from '../../core/types/story';
  import type { ViewBox } from '../../core/types/viewer';
  import {
    fitRectangleLabelLayout,
    rectangleLabelOutlineWidth,
    STORY_LABEL_SIZING,
  } from '../../features/annotations/rectangleLabelLayout';
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

  type DrawingShape = {
    id: string;
    kind: 'rect' | 'point' | 'polygon' | 'line';
    color: string;
    strokePx: number;
    fillMode: 'transparent' | 'solid';
    label: string;
    // Centroid in overlay percentage coords (for markers and labels).
    cx: number;
    cy: number;
    // Geometry (only the relevant fields are set per kind).
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    pointsStr?: string;
    pointNumber?: number;
  };

  const labelForDrawing = (annotation: ChapterDrawingAnnotation): string =>
    annotation.label?.[language] ?? annotation.label?.en ?? annotation.text ?? '';

  $: drawingShapes = ((): DrawingShape[] => {
    const cvb = currentViewBox;
    if (!cvb) return [];
    const project = (point: { x: number; y: number }) => ({
      x: ((point.x - cvb.x) / cvb.w) * 100,
      y: ((point.y - cvb.y) / cvb.h) * 100,
    });
    let pointCounter = 0;
    return (chapter?.drawingAnnotations ?? []).flatMap((annotation): DrawingShape[] => {
      const color = annotation.color?.trim() || 'var(--accent, #e07a3f)';
      const strokePx = ANNOTATION_STROKE_WIDTH_PX[annotation.strokeWidth ?? 'medium'];
      const label = labelForDrawing(annotation);
      const fillMode = annotation.fillMode ?? 'transparent';
      const base = { id: annotation.id, color, strokePx, label, fillMode };
      if (annotation.rect) {
        const origin = project(annotation.rect);
        const w = (annotation.rect.w / cvb.w) * 100;
        const h = (annotation.rect.h / cvb.h) * 100;
        return [
          { ...base, kind: 'rect', x: origin.x, y: origin.y, w, h, cx: origin.x + w / 2, cy: origin.y + h / 2 },
        ];
      }
      if (annotation.point) {
        const point = project(annotation.point);
        pointCounter += 1;
        return [{ ...base, kind: 'point', cx: point.x, cy: point.y, pointNumber: pointCounter }];
      }
      if (annotation.points?.length) {
        const projected = annotation.points.map(project);
        const cx = projected.reduce((sum, p) => sum + p.x, 0) / projected.length;
        const cy = projected.reduce((sum, p) => sum + p.y, 0) / projected.length;
        return [
          {
            ...base,
            kind: annotation.type === 'polygon' ? 'polygon' : 'line',
            pointsStr: projected.map((p) => `${p.x},${p.y}`).join(' '),
            cx,
            cy,
          },
        ];
      }
      return [];
    });
  })();
  $: svgShapes = drawingShapes.filter((shape) => shape.kind !== 'point');
  $: pointMarkers = drawingShapes.filter((shape) => shape.kind === 'point');
  $: shapeLabels = drawingShapes.filter((shape) => shape.label.trim().length > 0);
  $: hasDrawings = visible && showDrawings && drawingShapes.length > 0;

  let overlayWidth = 0;
  let overlayHeight = 0;
  const drawingLabelStyle = (shape: DrawingShape): string => {
    if (shape.kind !== 'rect' || shape.w == null || shape.h == null) {
      return `left:${shape.cx}%; top:${shape.cy}%; border-color:${shape.color}; --annotation-scale:${annotationScale};`;
    }
    // Percentages of the overlay element, so these are already screen pixels —
    // which is the space the label band is defined in.
    const width = (overlayWidth * shape.w) / 100;
    const height = (overlayHeight * shape.h) / 100;
    const { fontSize, lineHeight, visibleLines } = fitRectangleLabelLayout(
      width,
      height,
      shape.label,
      { sizing: STORY_LABEL_SIZING },
    );
    const outlineWidth = rectangleLabelOutlineWidth(fontSize);
    const padding = Math.max(2, fontSize * 0.28);
    return `left:${shape.cx}%; top:${shape.cy}%; width:${shape.w}%; height:${shape.h}%; padding:${padding.toFixed(2)}px; font-size:${fontSize.toFixed(2)}px; line-height:${lineHeight.toFixed(2)}px; -webkit-text-stroke-width:${outlineWidth.toFixed(2)}px; --label-lines:${visibleLines};`;
  };

  /**
   * Whether a rectangle's label fits inside it at a readable size.
   *
   * A label that does not fit is shown as a compact badge beside the shape
   * rather than crammed in at an unreadable size or silently clipped.
   */
  const labelOverflows = (shape: DrawingShape): boolean => {
    if (shape.kind !== 'rect' || shape.w == null || shape.h == null) return false;
    if (!overlayWidth || !overlayHeight) return false;
    return fitRectangleLabelLayout(
      (overlayWidth * shape.w) / 100,
      (overlayHeight * shape.h) / 100,
      shape.label,
      { sizing: STORY_LABEL_SIZING },
    ).overflow;
  };
</script>

<div
  class="story-annotation-overlay"
  data-testid="story-annotation-overlay"
  bind:clientWidth={overlayWidth}
  bind:clientHeight={overlayHeight}
>
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
  {#if hasDrawings}
    <svg
      class="story-annotation-overlay__drawings"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-label={$t('storyBuilder.annotations.drawing')}
    >
      {#each svgShapes as shape (shape.id)}
        {#if shape.kind === 'rect'}
          <rect
            class="story-annotation-overlay__shape"
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
            style={`stroke:${shape.color};stroke-width:${shape.strokePx}px;fill:${shape.fillMode === 'solid' ? shape.color : `color-mix(in srgb, ${shape.color} 16%, transparent)`};`}
          />
        {:else if shape.kind === 'polygon'}
          <polygon
            class="story-annotation-overlay__shape"
            points={shape.pointsStr}
            style={`stroke:${shape.color};stroke-width:${shape.strokePx}px;fill:${shape.fillMode === 'solid' ? shape.color : `color-mix(in srgb, ${shape.color} 16%, transparent)`};`}
          />
        {:else}
          <polyline
            class="story-annotation-overlay__line"
            points={shape.pointsStr}
            style={`stroke:${shape.color};stroke-width:${shape.strokePx}px;`}
          />
        {/if}
      {/each}
    </svg>

    <!-- Point markers and labels render as HTML so they stay circular / upright
         regardless of the (non-uniform) stage aspect ratio. -->
    <div class="story-annotation-overlay__markers">
      {#each pointMarkers as marker (marker.id)}
        <span
          class="story-annotation-overlay__point"
          style={`left:${marker.cx}%; top:${marker.cy}%; background:${marker.color};`}
        >
          {marker.pointNumber}
        </span>
      {/each}
      {#each shapeLabels as shape (`label-${shape.id}`)}
        <span
          class="story-annotation-overlay__label"
          class:story-annotation-overlay__label--rectangle={shape.kind === 'rect'}
          class:story-annotation-overlay__label--badge={labelOverflows(shape)}
          style={drawingLabelStyle(shape)}
          title={labelOverflows(shape) ? shape.label : undefined}
        >
          {shape.label}
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .story-annotation-overlay {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    pointer-events: none;
  }

  .story-annotation-overlay__note {
    position: absolute;
    box-sizing: border-box;
    max-width: 100%;
    max-height: 100%;
    padding: calc(10px * var(--annotation-scale, 1)) calc(12px * var(--annotation-scale, 1));
    border: 0;
    border-radius: calc(12px * var(--annotation-scale, 1));
    /*
     * `--accent` and `--ink` are per-annotation overrides carried in the story
     * document, so they must keep winning over the theme; the `--story-note-*`
     * tokens only decide what an annotation that specifies neither looks like.
     */
    background: var(--story-note-bg, rgba(255, 255, 255, 0.92));
    color: var(--ink, var(--story-note-text, #2b2520));
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
  .story-annotation-overlay__line {
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

  .story-annotation-overlay__markers {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  /* Round marker for point annotations (HTML keeps it circular on any aspect). */
  .story-annotation-overlay__point {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    border: 2px solid white;
    background: var(--accent, #e07a3f);
    color: white;
    font-size: 10px;
    font-weight: 850;
    line-height: 1;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  }
  .story-annotation-overlay__label {
    position: absolute;
    transform: translate(-50%, 8px);
    max-width: 40%;
    padding: calc(3px * var(--annotation-scale, 1)) calc(7px * var(--annotation-scale, 1));
    border: 1px solid var(--accent, #e07a3f);
    border-radius: calc(7px * var(--annotation-scale, 1));
    background: var(--story-label-bg, rgba(20, 16, 12, 0.82));
    color: var(--story-label-text, #fff);
    font-size: calc(11px * var(--annotation-scale, 1));
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .story-annotation-overlay__label--rectangle {
    transform: translate(-50%, -50%);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #fff;
    font-weight: 700;
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: center;
    overflow: hidden;
    text-overflow: clip;
    -webkit-text-stroke-color: rgba(15, 23, 42, 0.9);
    paint-order: stroke fill;
  }

  /*
   * A label too long for its region becomes a badge that sits over the shape
   * rather than text crammed inside it. Clipping the text was the previous
   * outcome, which reads as a rendering fault rather than as a label that has
   * more to say — the full text is on the element's title and in the inspector.
   */
  .story-annotation-overlay__label--badge {
    /*
     * A label too long for its region is clamped, not restyled.
     *
     * This used to swap in a dark rounded box, which meant the same annotation
     * changed colour purely because its text no longer fitted — the shape's own
     * colour said one thing and the label said another. The treatment now stays
     * put and only the number of lines gives way; the full text is on the
     * element's title and in the inspector.
     */
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--label-lines, 2);
    line-clamp: var(--label-lines, 2);
  }
</style>
