<script lang="ts">
  import { ArrowRight, ImageOff, LayoutGrid } from '@lucide/svelte';
  import { t } from '../../core/i18n';
  import type { CanvasSummary } from '../../core/state/manifests';

  /**
   * Page thumbnails: a strip under the stage toolbar, or a grid in a sidebar panel.
   */
  interface Props {
    canvases?: CanvasSummary[];
    canvasThumbnails?: Array<string | null>;
    selectedCanvasIndex?: number;
    layout?: 'strip' | 'grid';
    oncanvasSelect?: (payload: { index: number }) => void;
    /** Opens every page in the stage's gallery view. */
    onviewall?: () => void;
  }

  let {
    canvases = [],
    canvasThumbnails = [],
    selectedCanvasIndex = 0,
    layout = 'strip',
    oncanvasSelect = undefined,
    onviewall = undefined,
  }: Props = $props();

  let buttons: HTMLButtonElement[] = $state([]);
  let pages: HTMLElement | undefined = $state();

  /*
   * Keep the current page in view as it changes. Only the strip scrolls:
   * scrollIntoView would also scroll the sidebar and the host page.
   */
  $effect(() => {
    const button = buttons[selectedCanvasIndex];
    if (layout !== 'strip' || !pages || !button) return;
    const start = button.offsetLeft - 12;
    const end = button.offsetLeft + button.offsetWidth + 12 - pages.clientWidth;
    if (start < pages.scrollLeft) pages.scrollLeft = start;
    else if (end > pages.scrollLeft) pages.scrollLeft = end;
  });

  const onkeydown = (event: KeyboardEvent, index: number) => {
    const forward = layout === 'grid' ? ['ArrowRight', 'ArrowDown'] : ['ArrowRight'];
    const back = layout === 'grid' ? ['ArrowLeft', 'ArrowUp'] : ['ArrowLeft'];
    const next = forward.includes(event.key) ? index + 1 : back.includes(event.key) ? index - 1 : -1;
    if (next < 0 || next >= canvases.length) return;
    event.preventDefault();
    buttons[next]?.focus();
  };
</script>

<div class="gallery-strip gallery-strip--{layout}">
<nav class="gallery-strip__pages" bind:this={pages} aria-label={$t('viewer.gallery.label')}>
  {#each canvases as canvas (canvas.id)}
    <button
      type="button"
      bind:this={buttons[canvas.index]}
      class="gallery-strip__page"
      class:gallery-strip__page--active={canvas.index === selectedCanvasIndex}
      aria-current={canvas.index === selectedCanvasIndex ? 'page' : undefined}
      aria-label={$t('viewer.gallery.page', { n: canvas.index + 1, label: canvas.label })}
      title={canvas.label}
      onclick={() => oncanvasSelect?.({ index: canvas.index })}
      onkeydown={(event) => onkeydown(event, canvas.index)}
    >
      {#if canvasThumbnails[canvas.index]}
        <img src={canvasThumbnails[canvas.index]} alt="" loading="lazy" />
      {:else}
        <ImageOff size={20} aria-label={$t('viewer.gallery.unavailable')} />
      {/if}
      <span class="gallery-strip__n">{canvas.index + 1}</span>
    </button>
  {/each}
</nav>
{#if onviewall}
  <button
    class="gallery-strip__all"
    type="button"
    title={$t('viewer.gallery.viewAll', { count: canvases.length })}
    onclick={() => onviewall?.()}
  >
    <LayoutGrid class="gallery-strip__all-grid" aria-hidden="true" />
    <span>{$t('viewer.gallery.viewAll', { count: canvases.length })}</span>
    <ArrowRight class="gallery-strip__all-arrow" aria-hidden="true" />
  </button>
{/if}
</div>

<style>
  .gallery-strip {
    container: gallery-strip / inline-size;
    display: flex;
    align-items: center;
    min-width: 0;
    border-top: 1px solid var(--viewer-panel-border);
    background: var(--viewer-surface);
  }

  /* Positioned, so the thumbnails' offsetLeft is measured from it. */
  .gallery-strip__pages {
    position: relative;
    display: flex;
    flex: 1;
    gap: 8px;
    min-width: 0;
    padding: 8px 12px;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .gallery-strip--grid {
    display: grid;
    gap: 12px;
    border-top: 0;
    background: transparent;
  }

  .gallery-strip--grid .gallery-strip__pages {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    padding: 0;
    overflow: visible;
  }

  .gallery-strip__all {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
    align-self: stretch;
    padding: 0 14px;
    border: 0;
    border-left: 1px solid var(--viewer-panel-border);
    background: transparent;
    color: var(--viewer-muted);
    font: inherit;
    font-size: 12px;
    white-space: nowrap;
    cursor: pointer;
  }

  .gallery-strip--grid .gallery-strip__all {
    justify-self: start;
    padding: 6px 0;
    border-left: 0;
  }

  .gallery-strip__all:hover {
    color: var(--viewer-text);
  }

  .gallery-strip__all :global(svg) {
    width: 16px;
    height: 16px;
  }

  .gallery-strip__all :global(.gallery-strip__all-grid) {
    display: none;
  }

  /* Narrow strips keep their width for thumbnails: View all becomes an icon. */
  @container gallery-strip (width <= 560px) {
    .gallery-strip--strip .gallery-strip__all {
      padding: 0 12px;
    }

    .gallery-strip--strip .gallery-strip__all span,
    .gallery-strip--strip .gallery-strip__all :global(.gallery-strip__all-arrow) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

    .gallery-strip--strip .gallery-strip__all :global(.gallery-strip__all-grid) {
      display: block;
      width: 20px;
      height: 20px;
    }
  }

  .gallery-strip__page {
    position: relative;
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 64px;
    height: 80px;
    padding: 0;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: 6px;
    background: var(--viewer-well-bg, rgba(255, 255, 255, 0.06));
    color: var(--viewer-muted);
    cursor: pointer;
  }

  .gallery-strip--grid .gallery-strip__page {
    width: 100%;
  }

  .gallery-strip__page:hover {
    border-color: var(--viewer-panel-border);
  }

  .gallery-strip__page--active,
  .gallery-strip__page--active:hover {
    border-color: var(--viewer-accent-2);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .gallery-strip__n {
    position: absolute;
    right: 3px;
    bottom: 3px;
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 10px;
    line-height: 16px;
  }
</style>
