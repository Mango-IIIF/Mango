<script lang="ts" module>
  import type { RendererCapabilities } from '../core/types/renderer';
  
  /**
   * PdfRenderer capabilities
   * Supports zoom, pan, and viewBox but not filters or rotation
   */
  export const capabilities: RendererCapabilities = {
    supportsZoom: true,
    supportsFilters: false,
    supportsPan: true,
    supportsViewBox: true,
    supportsRotation: false,
    isInteractive: true,
  };

  export const resolveInitialPdfPage = (requested: number | undefined, total: number): number => {
    if (!Number.isInteger(requested) || (requested ?? 0) < 1) return 1;
    return Math.min(requested ?? 1, Math.max(1, total));
  };
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
  import { t } from '../i18n';
  import type { MediaSource } from '../iiif/mediaResolver';
  import type { ViewBox } from '../core/types/viewer';

  type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf');
  type PdfLoadingTask = ReturnType<PdfJs['getDocument']>;
  type PdfDocument = Awaited<PdfLoadingTask['promise']>;

  interface Props {
    source?: MediaSource | null;
    initialPage?: number;
    onzoomChange?: (payload: { zoom: number; viewBox: ViewBox }) => void;
    onviewBoxChange?: (payload: { viewBox: ViewBox }) => void;
  }

  let {
    source = null,
    initialPage = 1,
    onzoomChange = undefined,
    onviewBoxChange = undefined,
  }: Props = $props();

  let canvas: HTMLCanvasElement | null = $state(null);
  let canvasWrap: HTMLDivElement | null = $state(null);
  let pdfDoc: PdfDocument | null = null;
  let pageNumber = $state(1);
  let pageCount = $state(0);
  let scale = 1;
  let loadingTask: PdfLoadingTask | null = null;
  let lastViewBox: ViewBox | null = null;
  let lastSrc = $state('');

  const emitViewBox = () => {
    if (!canvas || !canvasWrap) return;
    const viewBox = {
      x: canvasWrap.scrollLeft,
      y: canvasWrap.scrollTop,
      w: canvasWrap.clientWidth,
      h: canvasWrap.clientHeight,
    };
    lastViewBox = viewBox;
    onviewBoxChange?.({ viewBox });
    onzoomChange?.({ zoom: scale, viewBox });
  };

  const renderPage = async () => {
    if (!pdfDoc || !canvas) return;
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const renderTask = page.render({ canvasContext: context, viewport });
    await renderTask.promise;
    emitViewBox();
  };

  const loadPdf = async () => {
    if (!source) return;
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

    loadingTask?.destroy?.();
    loadingTask = pdfjs.getDocument(source.src);
    pdfDoc = await loadingTask.promise;
    pageCount = pdfDoc.numPages;
    pageNumber = resolveInitialPdfPage(initialPage, pageCount);
    await renderPage();
  };

  const changePage = async (next: number) => {
    if (!pdfDoc) return;
    if (next < 1 || next > pageCount) return;
    pageNumber = next;
    await renderPage();
  };

  const zoomIn = async () => {
    scale = Math.min(scale + 0.2, 3);
    await renderPage();
  };

  const zoomOut = async () => {
    scale = Math.max(scale - 0.2, 0.4);
    await renderPage();
  };

  export const getViewBox = (): ViewBox | null => {
    return lastViewBox;
  };

  export const setViewBox = (viewBox: ViewBox): void => {
    if (!canvasWrap) return;
    canvasWrap.scrollLeft = viewBox.x;
    canvasWrap.scrollTop = viewBox.y;
    emitViewBox();
  };

  $effect(() => {
    if (source && source.src !== lastSrc) {
      lastSrc = source.src;
      loadPdf();
    }
  });

  onDestroy(() => {
    loadingTask?.destroy?.();
  });
</script>

<div class="pdf">
  {#if source}
    <div class="pdf__controls">
      <button
        class="pdf__button"
        type="button"
        aria-label={$t('renderers.pdf.prevAria')}
        onclick={() => changePage(pageNumber - 1)}
      >
        {$t('renderers.pdf.prev')}
      </button>
      <div class="pdf__status">
        {$t('renderers.pdf.status', { pageNumber, pageCount })}
      </div>
      <button
        class="pdf__button"
        type="button"
        aria-label={$t('renderers.pdf.nextAria')}
        onclick={() => changePage(pageNumber + 1)}
      >
        {$t('renderers.pdf.next')}
      </button>
      <button
        class="pdf__button"
        type="button"
        aria-label={$t('renderers.pdf.zoomOutAria')}
        onclick={zoomOut}
      >
        {$t('renderers.pdf.zoomOut')}
      </button>
      <button
        class="pdf__button"
        type="button"
        aria-label={$t('renderers.pdf.zoomInAria')}
        onclick={zoomIn}
      >
        {$t('renderers.pdf.zoomIn')}
      </button>
    </div>
    <div class="pdf__canvas-wrap" bind:this={canvasWrap} onscroll={emitViewBox}>
      <canvas bind:this={canvas}></canvas>
    </div>
  {:else}
    <div class="pdf__placeholder">{$t('renderers.pdf.noSource')}</div>
  {/if}
</div>

<style>
  .pdf {
    display: grid;
    gap: 12px;
    height: 100%;
  }

  .pdf__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .pdf__button {
    border: none;
    border-radius: 10px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--viewer-text, #e8edf4);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    cursor: pointer;
  }

  .pdf__status {
    font-size: 12px;
    color: var(--viewer-muted, #9aa6b2);
  }

  .pdf__canvas-wrap {
    flex: 1;
    overflow: auto;
    border-radius: 16px;
    background: rgba(10, 14, 19, 0.8);
    padding: 10px;
  }

  .pdf__placeholder {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }
</style>
