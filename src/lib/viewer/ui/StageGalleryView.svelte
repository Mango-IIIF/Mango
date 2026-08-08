<script lang="ts">
  /**
   * Grid of every canvas in the manifest, as an alternative to the stage.
   *
   * Split out of `ViewerLayout` because it is the one part of that component
   * with a class namespace entirely of its own: nothing else styles
   * `.stage-gallery-view*`, and the gallery styles nothing else. Styles have
   * to travel with their markup — the viewer renders inside a shadow root, so
   * a document-level stylesheet would never reach them — which makes a
   * self-contained namespace the thing that decides whether a piece of that
   * component can leave at all.
   */
  import { ImageOff } from '@lucide/svelte';
  import { t } from '../../core/i18n';
  import type { CanvasSummary } from '../../core/state/manifests';

  let {
    canvases = [],
    thumbnails = [],
    selectedCanvasIndex = 0,
    onselect,
  }: {
    canvases?: CanvasSummary[];
    /** Resolved thumbnail src per canvas index, sparse while they load. */
    thumbnails?: Array<string | null | undefined>;
    selectedCanvasIndex?: number;
    onselect?: (detail: { index: number }) => void;
  } = $props();

  const labelFor = (canvas: CanvasSummary): string =>
    canvas.label || `Page ${canvas.index + 1}`;
</script>

<div class="stage-gallery-view">
  <div class="stage-gallery-view__grid">
    {#each canvases as canvas (canvas.id)}
      <button
        class="stage-gallery-view__card"
        class:stage-gallery-view__card--active={canvas.index === selectedCanvasIndex}
        type="button"
        onclick={() => onselect?.({ index: canvas.index })}
      >
        <div class="stage-gallery-view__thumb-wrapper">
          {#if thumbnails[canvas.index]}
            <img
              class="stage-gallery-view__img"
              src={thumbnails[canvas.index]}
              alt={labelFor(canvas)}
              loading="lazy"
            />
          {:else}
            <div
              class="stage-gallery-view__placeholder"
              aria-label={$t('viewer.gallery.unavailable')}
            >
              <ImageOff aria-hidden="true" />
              <span class="stage-gallery-view__index">{canvas.index + 1}</span>
            </div>
          {/if}
        </div>
        <div class="stage-gallery-view__label">
          {labelFor(canvas)}
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .stage-gallery-view {
    width: 100%;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    background: var(--viewer-stage, #111720);
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 24px;
    box-sizing: border-box;
  }

  .stage-gallery-view__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 24px;
    width: 100%;
  }

  .stage-gallery-view__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 12px;
    cursor: pointer;
    transition: border-color 0.22s ease;
    width: 100%;
    box-sizing: border-box;
    outline: none;
  }

  /* Hover is the border and nothing else — no lift, no glow, no tint. */
  .stage-gallery-view__card:hover {
    border-color: var(--viewer-accent-2, #2ac7ff);
  }

  .stage-gallery-view__card:focus-visible {
    outline: 2px solid var(--viewer-accent-2, #2ac7ff);
    outline-offset: 2px;
  }

  .stage-gallery-view__card--active {
    border-color: var(--viewer-accent-2, #2ac7ff);
    background: rgba(42, 199, 255, 0.06);
    box-shadow: 0 0 0 2px var(--viewer-accent-2, rgba(42, 199, 255, 0.2));
  }

  .stage-gallery-view__thumb-wrapper {
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.04);
    display: grid;
    place-items: center;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .stage-gallery-view__img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .stage-gallery-view__placeholder {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: var(--viewer-muted, #9aa6b2);
    gap: 8px;
  }

  .stage-gallery-view__placeholder :global(svg) {
    width: 32px;
    height: 32px;
    opacity: 0.75;
  }

  .stage-gallery-view__index {
    font-size: 24px;
    font-weight: 700;
  }

  .stage-gallery-view__label {
    margin-top: 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--viewer-text, #e8edf4);
    text-align: center;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
