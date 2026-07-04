<script lang="ts">
  import { getContext } from 'svelte';
  import { t } from '../../i18n';
  import type { CanvasSummary } from '../../state/manifests';
  import type { ViewportState } from '../../core/state/viewportState.svelte';
  import { VIEWPORT_STATE_CONTEXT_KEY } from '../../core/state/viewportState.svelte';

  interface Props {
    canvases?: CanvasSummary[];
    canvasThumbnails?: Array<string | null>;
    selectedCanvasIndex?: number;
    onpanelToggle?: (payload: { panel: 'thumbnails'; open: boolean }) => void;
    oncanvasSelect?: (payload: { index: number }) => void;
  }

  let {
    canvases = [],
    canvasThumbnails = [],
    selectedCanvasIndex = 0,
    onpanelToggle = undefined,
    oncanvasSelect = undefined,
  }: Props = $props();
  const viewportState = getContext<ViewportState | undefined>(VIEWPORT_STATE_CONTEXT_KEY);
  let effectiveSelectedCanvasIndex = $derived(
    viewportState?.selectedCanvasIndex ?? selectedCanvasIndex,
  );

  let canvasButtons: HTMLButtonElement[] = [];



  const focusCanvasButton = (index: number) => {
    canvasButtons[index]?.focus();
  };

  const handleCanvasKeydown = (event: KeyboardEvent, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = Math.min(canvases.length - 1, index + 1);
      oncanvasSelect?.({ index: next });
      focusCanvasButton(next);
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = Math.max(0, index - 1);
      oncanvasSelect?.({ index: next });
      focusCanvasButton(next);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      oncanvasSelect?.({ index: 0 });
      focusCanvasButton(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      const next = Math.max(0, canvases.length - 1);
      oncanvasSelect?.({ index: next });
      focusCanvasButton(next);
    }
  };
</script>

<section class="gallery" aria-label={$t('viewer.gallery.label')}>
  <div class="gallery__header">
    <div class="gallery__title">{$t('viewer.gallery.title')}</div>
    <button
      class="gallery__close"
      type="button"
      aria-label={$t('viewer.gallery.hide')}
      onclick={() => onpanelToggle?.({ panel: 'thumbnails', open: false })}
    >
      {$t('common.closeGlyph')}
    </button>
  </div>
  {#if canvases.length === 0}
    <div class="gallery__empty">{$t('viewer.gallery.empty')}</div>
  {:else}
    <ul class="gallery__list" role="listbox">
      {#each canvases as canvas (canvas.id)}
        <li class="gallery__item">
          <button
            bind:this={canvasButtons[canvas.index]}
            class:gallery__button--active={canvas.index === effectiveSelectedCanvasIndex}
            class="gallery__button"
            type="button"
            aria-selected={canvas.index === effectiveSelectedCanvasIndex}
            role="option"
            onclick={() => oncanvasSelect?.({ index: canvas.index })}
            onkeydown={(event) => handleCanvasKeydown(event, canvas.index)}
          >
            <span class="gallery__thumb">
              {#if canvasThumbnails[canvas.index]}
                <img
                  class="gallery__img"
                  src={canvasThumbnails[canvas.index]}
                  alt={canvas.label ||
                    $t('viewer.gallery.canvasAlt', {
                      index: canvas.index + 1,
                    })}
                  loading="lazy"
                />
              {:else}
                <span class="gallery__index">
                  {canvas.index + 1}
                </span>
              {/if}
            </span>
            <span class="gallery__label">{canvas.label}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .gallery {
    display: grid;
    gap: 12px;
    padding: 16px 12px 12px;
    margin-top: 4px;
    border-radius: 16px;
    background: var(--viewer-gallery-bg, rgba(10, 14, 19, 0.85));
    border: 1px solid var(--viewer-panel-border);
  }

  .gallery__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .gallery__title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--viewer-muted);
  }

  .gallery__close {
    width: var(--viewer-close-button-size, 28px);
    height: var(--viewer-close-button-size, 28px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--viewer-close-button-border, rgba(255, 255, 255, 0.18));
    border-radius: var(--viewer-close-button-radius, 10px);
    background: var(--viewer-gallery-close-bg, var(--viewer-close-button-bg, rgba(255, 255, 255, 0.1)));
    color: var(--viewer-close-button-color, var(--viewer-text));
    font-size: var(--viewer-close-button-glyph-size, 15px);
    line-height: 1;
    cursor: pointer;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      transform 0.08s ease;
  }

  .gallery__close:hover:not(:disabled) {
    background: var(--viewer-close-button-hover-bg, rgba(255, 255, 255, 0.16));
    border-color: var(--viewer-close-button-hover-border, rgba(255, 255, 255, 0.34));
  }

  .gallery__close:focus-visible {
    outline: 2px solid var(--viewer-close-button-focus-ring, rgba(42, 199, 255, 0.55));
    outline-offset: 2px;
  }

  .gallery__close:active:not(:disabled) {
    transform: translateY(1px);
  }

  .gallery__empty {
    color: var(--viewer-muted);
    font-size: 12px;
  }

  .gallery__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(96px, 130px);
    gap: 12px;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    padding-bottom: 6px;
    touch-action: pan-x;
    -webkit-overflow-scrolling: touch;
  }

  .gallery__item {
    list-style: none;
  }

  .gallery__button {
    display: grid;
    gap: 8px;
    width: 100%;
    text-align: left;
    border: 1px solid var(--viewer-gallery-item-border, rgba(255, 255, 255, 0.08));
    padding: 8px;
    border-radius: 12px;
    background: var(--viewer-gallery-item-bg, rgba(18, 25, 34, 0.85));
    color: var(--viewer-text);
    cursor: pointer;
  }

  .gallery__button--active {
    border-color: var(--viewer-accent-2);
    box-shadow: 0 0 0 2px var(--viewer-gallery-active-ring, rgba(42, 199, 255, 0.2));
  }

  .gallery__thumb {
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: 10px;
    overflow: hidden;
    background: var(--viewer-gallery-thumb-bg, rgba(255, 255, 255, 0.06));
    color: var(--viewer-muted);
    font-size: 12px;
  }

  .gallery__img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .gallery__index {
    font-weight: 600;
  }

  .gallery__label {
    font-size: 11px;
    color: var(--viewer-muted);
  }
</style>
