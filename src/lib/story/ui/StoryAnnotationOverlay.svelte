<script lang="ts">
  import { readable, type Readable } from 'svelte/store';
  import type { Story } from '../../core/types/story';
  import type { ViewBox } from '../../core/types/viewer';
  import {
    coerceAnnotationPlacement,
    DEFAULT_ANNOTATION_PLACEMENT,
  } from '../annotationPlacement';

  export let story: Readable<Story>;
  export let viewBox: Readable<ViewBox | null> = readable(null);
  export let chapterId: string | null = null;
  export let language = 'en';
  export let visible = true;

  $: chapter = $story.chapters.find((item) => item.id === chapterId) ?? null;
  $: annotation = chapter?.annotations?.[language] ?? null;
  $: text = annotation?.text ?? '';
  $: fallbackPlacement = Object.values(chapter?.annotations ?? {})
    .map((entry) => coerceAnnotationPlacement(entry?.placement))
    .find((entry) => Boolean(entry));
  $: placement =
    coerceAnnotationPlacement(chapter?.annotationPlacement) ??
    coerceAnnotationPlacement(annotation?.placement) ??
    fallbackPlacement ??
    DEFAULT_ANNOTATION_PLACEMENT;
  $: placementCenter = {
    x: placement.x + placement.w / 2,
    y: placement.y + placement.h / 2,
  };
  $: captureViewBox = chapter?.viewBox ?? null;
  $: currentViewBox = $viewBox;
  $: anchorPoint = captureViewBox
    ? {
        x: captureViewBox.x + captureViewBox.w * placementCenter.x,
        y: captureViewBox.y + captureViewBox.h * placementCenter.y,
      }
    : null;
  $: relativePoint =
    anchorPoint && currentViewBox
      ? {
          x: (anchorPoint.x - currentViewBox.x) / currentViewBox.w,
          y: (anchorPoint.y - currentViewBox.y) / currentViewBox.h,
        }
      : null;
  $: anchored =
    relativePoint !== null &&
    Number.isFinite(relativePoint.x) &&
    Number.isFinite(relativePoint.y);
  $: inView =
    anchored &&
    relativePoint.x >= 0 &&
    relativePoint.x <= 1 &&
    relativePoint.y >= 0 &&
    relativePoint.y <= 1;
  $: noteStyle = anchored
    ? `left: ${(relativePoint.x * 100).toFixed(3)}%; top: ${(relativePoint.y * 100).toFixed(3)}%;`
    : `left: ${(placementCenter.x * 100).toFixed(3)}%; top: ${(placementCenter.y * 100).toFixed(3)}%;`;
  $: show = Boolean(visible && text && chapterId && (!anchored || inView));
</script>

<div class="story-annotation-overlay" data-testid="story-annotation-overlay">
  {#if show}
    <div
      class="story-annotation-overlay__note"
      data-testid="story-annotation-note"
      style={noteStyle}
    >
      {text}
    </div>
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
    transform: translate(-50%, -50%);
    max-width: min(280px, 80%);
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.92);
    color: var(--ink, #2b2520);
    font-size: 13px;
    line-height: 1.4;
    box-shadow: 0 12px 28px rgba(43, 37, 32, 0.16);
  }
</style>
