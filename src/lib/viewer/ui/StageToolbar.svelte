<script lang="ts">
  import { createEventDispatcher, getContext } from 'svelte';
  import { t } from '../../i18n';
  import type { MediaType } from '../../iiif/mediaResolver';
  import type { ViewportState } from '../../core/state/viewportState.svelte';
  import { VIEWPORT_STATE_CONTEXT_KEY } from '../../core/state/viewportState.svelte';

  interface Props {
    canZoom?: boolean;
    hasSource?: boolean;
    mediaType?: MediaType | null;
    placement?: 'below' | 'above';
    selectedCanvasIndex?: number;
    totalCanvases?: number;
    zoomPercent?: number;
  }

  let {
    canZoom = false,
    hasSource = false,
    mediaType = null,
    placement = 'below',
    selectedCanvasIndex = 0,
    totalCanvases = 0,
    zoomPercent = 100,
  }: Props = $props();
  const viewportState = getContext<ViewportState | undefined>(VIEWPORT_STATE_CONTEXT_KEY);
  let effectiveSelectedCanvasIndex = $derived(
    viewportState?.selectedCanvasIndex ?? selectedCanvasIndex,
  );

  let isVisible = $derived(
    mediaType === 'image' || mediaType === 'audio' || mediaType === 'video',
  );
  let canPrevCanvas = $derived(totalCanvases > 0 && effectiveSelectedCanvasIndex > 0);
  let canNextCanvas = $derived(
    totalCanvases > 0 && effectiveSelectedCanvasIndex < totalCanvases - 1,
  );
  let currentCanvasNumber = $derived(
    totalCanvases > 0
      ? Math.min(Math.max(effectiveSelectedCanvasIndex + 1, 1), totalCanvases)
      : 0,
  );
  const MIN_ZOOM_PERCENT = 10;
  const MAX_ZOOM_PERCENT = 2000;
  let currentZoomPercent = $derived(
    Math.max(
      MIN_ZOOM_PERCENT,
      Number.isFinite(zoomPercent) ? Math.round(zoomPercent) : MIN_ZOOM_PERCENT,
    ),
  );
  let canRotate = $derived(mediaType === 'image' && hasSource);
  let canHome = $derived(mediaType === 'image' && hasSource);
  let isEditingCanvasNumber = $state(false);
  let isEditingZoomPercent = $state(false);
  let canvasNumberInput = $state('');
  let zoomPercentInput = $state('');

  const keepDigits = (value: string): string => value.replace(/\D+/g, '');

  const parseDigits = (value: string): number | null => {
    const digits = keepDigits(value);
    if (!digits) return null;
    const parsed = Number.parseInt(digits, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const resetCanvasNumberInput = () => {
    canvasNumberInput = totalCanvases > 0 ? String(currentCanvasNumber) : '';
  };

  const resetZoomPercentInput = () => {
    zoomPercentInput = String(currentZoomPercent);
  };

  const handleCanvasNumberInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    canvasNumberInput = keepDigits(target.value);
  };

  const handleZoomPercentInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    zoomPercentInput = keepDigits(target.value);
  };

  const commitCanvasNumberInput = () => {
    isEditingCanvasNumber = false;
    if (totalCanvases <= 0) {
      canvasNumberInput = '';
      return;
    }
    const parsed = parseDigits(canvasNumberInput);
    if (parsed === null) {
      resetCanvasNumberInput();
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), totalCanvases);
    canvasNumberInput = String(clamped);
    if (clamped !== currentCanvasNumber) {
      dispatch('setCanvasIndex', { index: clamped - 1 });
    }
  };

  const commitZoomPercentInput = () => {
    isEditingZoomPercent = false;
    const parsed = parseDigits(zoomPercentInput);
    if (parsed === null) {
      resetZoomPercentInput();
      return;
    }
    const clamped = Math.min(Math.max(parsed, MIN_ZOOM_PERCENT), MAX_ZOOM_PERCENT);
    zoomPercentInput = String(clamped);
    if (clamped !== currentZoomPercent) {
      dispatch('setZoomPercent', { percent: clamped });
    }
  };

  const handleCanvasNumberKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.currentTarget as HTMLInputElement).blur();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      isEditingCanvasNumber = false;
      resetCanvasNumberInput();
      (event.currentTarget as HTMLInputElement).blur();
    }
  };

  const handleZoomPercentKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.currentTarget as HTMLInputElement).blur();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      isEditingZoomPercent = false;
      resetZoomPercentInput();
      (event.currentTarget as HTMLInputElement).blur();
    }
  };

  $effect(() => {
    if (!isEditingCanvasNumber) {
      resetCanvasNumberInput();
    }
  });

  $effect(() => {
    if (!isEditingZoomPercent) {
      resetZoomPercentInput();
    }
  });

  const dispatch = createEventDispatcher<{
    home: void;
    zoomIn: void;
    zoomOut: void;
    rotate: void;
    prevCanvas: void;
    nextCanvas: void;
    setCanvasIndex: { index: number };
    setZoomPercent: { percent: number };
  }>();
</script>

{#if isVisible}
  <div
    class:stage__toolbar--above={placement === 'above'}
    class:stage__toolbar--below={placement === 'below'}
    class="stage__toolbar"
    aria-label={$t('viewer.toolbar.label')}
  >
    <div class="stage__toolbar-group stage__toolbar-group--single">
      <button
        class="stage__toolbar-button stage__toolbar-button--single"
        type="button"
        aria-label={$t('viewer.toolbar.rotateRight')}
        title={$t('viewer.toolbar.rotateRight')}
        disabled={!canRotate}
        onclick={() => dispatch('rotate')}
      >
        <svg
          class="stage__toolbar-icon stage__toolbar-icon--rotate"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M21 4v6h-6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M20.4 13.4A8.5 8.5 0 1 1 18 5.9"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <span class="stage__toolbar-separator" aria-hidden="true"></span>

    <div class="stage__toolbar-group">
      <button
        class="stage__toolbar-button"
        type="button"
        aria-label={$t('viewer.stage.nav.prev')}
        disabled={!canPrevCanvas}
        onclick={() => dispatch('prevCanvas')}
      >
        <svg class="stage__toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M14.5 5.5L7.5 12l7 6.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <span class="stage__toolbar-value stage__toolbar-value--canvas">
        <input
          class="stage__toolbar-input stage__toolbar-input--canvas"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          aria-label={$t('viewer.toolbar.canvasNumber') ?? 'Canvas number'}
          value={canvasNumberInput}
          style={`width: ${Math.max(2, String(Math.max(totalCanvases, currentCanvasNumber, 1)).length)}ch;`}
          disabled={totalCanvases <= 0}
          onfocus={() => (isEditingCanvasNumber = true)}
          oninput={handleCanvasNumberInput}
          onblur={commitCanvasNumberInput}
          onkeydown={handleCanvasNumberKeydown}
        />
        <span class="stage__toolbar-input-divider" aria-hidden="true">/</span>
        <span class="stage__toolbar-input-suffix">{totalCanvases}</span>
      </span>
      <button
        class="stage__toolbar-button"
        type="button"
        aria-label={$t('viewer.stage.nav.next')}
        disabled={!canNextCanvas}
        onclick={() => dispatch('nextCanvas')}
      >
        <svg class="stage__toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9.5 5.5l7 6.5-7 6.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <span class="stage__toolbar-separator" aria-hidden="true"></span>

    <div class="stage__toolbar-group">
      <button
        class="stage__toolbar-button"
        type="button"
        aria-label={$t('viewer.toolbar.zoomOut')}
        title={$t('viewer.toolbar.zoomOut')}
        disabled={!hasSource || !canZoom}
        onclick={() => dispatch('zoomOut')}
      >
        <svg class="stage__toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.5 12h11"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <span class="stage__toolbar-value stage__toolbar-value--zoom">
        <input
          class="stage__toolbar-input stage__toolbar-input--zoom"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          aria-label={$t('viewer.toolbar.zoomPercent') ?? 'Zoom percent'}
          value={zoomPercentInput}
          style={`width: ${Math.max(3, (zoomPercentInput || String(currentZoomPercent)).length)}ch;`}
          disabled={!hasSource || !canZoom}
          onfocus={() => (isEditingZoomPercent = true)}
          oninput={handleZoomPercentInput}
          onblur={commitZoomPercentInput}
          onkeydown={handleZoomPercentKeydown}
        />
        <span class="stage__toolbar-input-suffix">%</span>
      </span>
      <button
        class="stage__toolbar-button"
        type="button"
        aria-label={$t('viewer.toolbar.zoomIn')}
        title={$t('viewer.toolbar.zoomIn')}
        disabled={!hasSource || !canZoom}
        onclick={() => dispatch('zoomIn')}
      >
        <svg class="stage__toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 6.5v11M6.5 12h11"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <span class="stage__toolbar-separator" aria-hidden="true"></span>

    <div class="stage__toolbar-group stage__toolbar-group--single">
      <button
        class="stage__toolbar-button stage__toolbar-button--single"
        type="button"
        aria-label={$t('viewer.toolbar.home')}
        title={$t('viewer.toolbar.home')}
        disabled={!canHome}
        onclick={() => dispatch('home')}
      >
        <svg class="stage__toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 11.5L12 4l8 7.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M7 10.5V20h10v-9.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M10 20v-6h4v6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

  </div>
{/if}

<style>
  .stage__toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: nowrap;
    row-gap: 5px;
    gap: 5px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    margin-inline: auto;
    padding: 3px;
    border-radius: 11px;
    border: none;
    background: transparent;
    box-shadow: none;
    margin-top: 0;
    container-type: inline-size;
  }

  .stage__toolbar--below {
    margin-top: -6px;
  }

  .stage__toolbar--above {
    margin-bottom: 6px;
  }

  .stage__toolbar-separator {
    width: 1px;
    height: 29px;
    background: var(--viewer-toolbar-separator, rgba(255, 255, 255, 0.14));
  }

  .stage__toolbar-group {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    max-width: 100%;
    min-width: 0;
    border: 1px solid var(--viewer-toolbar-group-border, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    overflow: hidden;
    background: var(--viewer-toolbar-group-bg, rgba(20, 30, 45, 0.55));
    min-height: 34px;
  }

  .stage__toolbar-group--single {
    border-radius: 10px;
  }

  .stage__toolbar-button {
    border: 0;
    width: 36px;
    height: 34px;
    min-height: 34px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--viewer-toolbar-button-bg, rgba(255, 255, 255, 0.03));
    color: var(--viewer-text);
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .stage__toolbar-button:hover:not(:disabled) {
    background: var(--viewer-toolbar-button-hover-bg, rgba(255, 255, 255, 0.08));
  }

  .stage__toolbar-button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .stage__toolbar-button--single {
    width: 36px;
    height: 34px;
    border: 0;
    border-radius: 0;
    background: var(--viewer-toolbar-button-bg, rgba(255, 255, 255, 0.03));
  }

  .stage__toolbar-value {
    min-width: 85px;
    max-width: 100%;
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding-inline: 8px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--viewer-toolbar-value-text, rgba(230, 236, 246, 0.96));
    background: var(--viewer-toolbar-value-bg, rgba(4, 11, 22, 0.55));
    font-variant-numeric: tabular-nums;
  }

  .stage__toolbar-value--zoom {
    min-width: 74px;
  }

  .stage__toolbar-input {
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: inherit;
    line-height: 1;
    padding: 0;
    margin: 0;
    outline: none;
    text-align: right;
    font-variant-numeric: tabular-nums;
    max-width: 7ch;
    min-width: 2ch;
  }

  .stage__toolbar-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .stage__toolbar-input-divider {
    opacity: 0.7;
  }

  .stage__toolbar-input-suffix {
    opacity: 0.95;
  }

  .stage__toolbar-icon {
    width: 17px;
    height: 17px;
    display: block;
    overflow: visible;
  }

  .stage__toolbar-icon--rotate {
    width: 18px;
    height: 18px;
  }

  @container (max-width: 430px) {
    .stage__toolbar {
      gap: 2px;
      padding: 0;
      overflow: hidden;
    }

    .stage__toolbar-separator {
      display: none;
    }

    .stage__toolbar-group {
      min-height: 27px;
      border-radius: 8px;
    }

    .stage__toolbar-group--single {
      min-height: 27px;
    }

    .stage__toolbar-button {
      width: 23px;
      height: 25px;
      min-height: 25px;
    }

    .stage__toolbar-button--single {
      width: 23px;
      height: 25px;
      min-height: 25px;
      border-radius: 0;
    }

    .stage__toolbar-value {
      min-width: 36px;
      min-height: 25px;
      font-size: 9px;
      gap: 2px;
      padding-inline: 3px;
    }

    .stage__toolbar-value--zoom {
      min-width: 31px;
    }

    .stage__toolbar-icon {
      width: 13px;
      height: 13px;
    }

    .stage__toolbar-icon--rotate {
      width: 14px;
      height: 14px;
    }
  }

  @media (max-width: 900px) {
    .stage__toolbar {
      gap: 2px;
      padding: 0;
      border-radius: 8px;
      overflow: hidden;
    }

    .stage__toolbar-group {
      min-height: 27px;
      border-radius: 8px;
    }

    .stage__toolbar-group--single {
      min-height: 27px;
    }

    .stage__toolbar-separator {
      display: none;
    }

    .stage__toolbar-button {
      width: 23px;
      height: 25px;
      min-height: 25px;
    }

    .stage__toolbar-button--single {
      width: 23px;
      height: 25px;
      border-radius: 0;
      min-height: 25px;
    }

    .stage__toolbar-value {
      min-width: 36px;
      min-height: 25px;
      font-size: 9px;
      gap: 2px;
      padding-inline: 3px;
    }

    .stage__toolbar-value--zoom {
      min-width: 31px;
    }

    .stage__toolbar-icon {
      width: 13px;
      height: 13px;
    }

    .stage__toolbar-icon--rotate {
      width: 14px;
      height: 14px;
    }
  }
</style>
