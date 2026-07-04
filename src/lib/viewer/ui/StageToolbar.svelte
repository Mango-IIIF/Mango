<script lang="ts">
  import { getContext } from 'svelte';
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
    onhome?: () => void;
    onzoomIn?: () => void;
    onzoomOut?: () => void;
    onrotate?: () => void;
    onprevCanvas?: () => void;
    onnextCanvas?: () => void;
    onsetCanvasIndex?: (payload: { index: number }) => void;
    onsetZoomPercent?: (payload: { percent: number }) => void;
  }

  let {
    canZoom = false,
    hasSource = false,
    mediaType = null,
    placement = 'below',
    selectedCanvasIndex = 0,
    totalCanvases = 0,
    zoomPercent = 100,
    onhome = undefined,
    onzoomIn = undefined,
    onzoomOut = undefined,
    onrotate = undefined,
    onprevCanvas = undefined,
    onnextCanvas = undefined,
    onsetCanvasIndex = undefined,
    onsetZoomPercent = undefined,
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
      onsetCanvasIndex?.({ index: clamped - 1 });
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
      onsetZoomPercent?.({ percent: clamped });
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
        onclick={() => onrotate?.()}
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
        onclick={() => onprevCanvas?.()}
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
        onclick={() => onnextCanvas?.()}
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
        onclick={() => onzoomOut?.()}
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
        onclick={() => onzoomIn?.()}
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
        onclick={() => onhome?.()}
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
    --stage-toolbar-gap: 5px;
    --stage-toolbar-button-width: 36px;
    --stage-toolbar-button-height: 34px;
    --stage-toolbar-group-height: 34px;
    --stage-toolbar-value-width: 85px;
    --stage-toolbar-zoom-width: 74px;
    --stage-toolbar-zoom-input-width: 3.6ch;
    --stage-toolbar-value-font-size: 12px;
    --stage-toolbar-value-gap: 4px;
    --stage-toolbar-value-padding: 8px;
    --stage-toolbar-icon-size: 17px;
    --stage-toolbar-rotate-icon-size: 18px;
    --stage-toolbar-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: nowrap;
    row-gap: 5px;
    gap: var(--stage-toolbar-gap);
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
    --stage-toolbar-button-width: 40px;
    --stage-toolbar-button-height: 38px;
    --stage-toolbar-group-height: 40px;
    --stage-toolbar-value-width: 90px;
    --stage-toolbar-zoom-width: 78px;
    --stage-toolbar-icon-size: 18px;
    --stage-toolbar-rotate-icon-size: 19px;
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
    border-radius: var(--stage-toolbar-radius);
    overflow: hidden;
    background: var(--viewer-toolbar-group-bg, rgba(20, 30, 45, 0.55));
    min-height: var(--stage-toolbar-group-height);
  }

  .stage__toolbar-group--single {
    border-radius: var(--stage-toolbar-radius);
  }

  .stage__toolbar-button {
    border: 0;
    width: var(--stage-toolbar-button-width);
    height: var(--stage-toolbar-button-height);
    min-height: var(--stage-toolbar-button-height);
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
    width: var(--stage-toolbar-button-width);
    height: var(--stage-toolbar-button-height);
    border: 0;
    border-radius: 0;
    background: var(--viewer-toolbar-button-bg, rgba(255, 255, 255, 0.03));
  }

  .stage__toolbar-value {
    min-width: var(--stage-toolbar-value-width);
    max-width: 100%;
    min-height: var(--stage-toolbar-button-height);
    box-sizing: border-box;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--stage-toolbar-value-gap);
    padding-inline: var(--stage-toolbar-value-padding);
    font-size: var(--stage-toolbar-value-font-size);
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--viewer-toolbar-value-text, rgba(230, 236, 246, 0.96));
    background: var(--viewer-toolbar-value-bg, rgba(4, 11, 22, 0.55));
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .stage__toolbar-value--zoom {
    width: var(--stage-toolbar-zoom-width);
    min-width: var(--stage-toolbar-zoom-width);
    flex-basis: var(--stage-toolbar-zoom-width);
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

  .stage__toolbar-input--zoom {
    width: var(--stage-toolbar-zoom-input-width);
    min-width: var(--stage-toolbar-zoom-input-width);
    max-width: var(--stage-toolbar-zoom-input-width);
    flex: 0 0 var(--stage-toolbar-zoom-input-width);
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
    width: var(--stage-toolbar-icon-size);
    height: var(--stage-toolbar-icon-size);
    display: block;
    overflow: visible;
  }

  .stage__toolbar-icon--rotate {
    width: var(--stage-toolbar-rotate-icon-size);
    height: var(--stage-toolbar-rotate-icon-size);
  }

  @container (max-width: 430px) {
    .stage__toolbar--below {
      --stage-toolbar-gap: clamp(3px, 1.1cqw, 5px);
      --stage-toolbar-button-width: clamp(26px, 10.2cqw, 34px);
      --stage-toolbar-button-height: clamp(30px, 11cqw, 36px);
      --stage-toolbar-group-height: calc(var(--stage-toolbar-button-height) + 2px);
      --stage-toolbar-value-width: clamp(40px, 16cqw, 58px);
      --stage-toolbar-zoom-width: clamp(38px, 14.5cqw, 52px);
      --stage-toolbar-zoom-input-width: 3.6ch;
      --stage-toolbar-value-font-size: clamp(10px, 3.4cqw, 12px);
      --stage-toolbar-value-gap: clamp(2px, .8cqw, 4px);
      --stage-toolbar-value-padding: clamp(3px, 1.2cqw, 6px);
      --stage-toolbar-icon-size: clamp(15px, 5.2cqw, 18px);
      --stage-toolbar-rotate-icon-size: clamp(16px, 5.6cqw, 19px);
      --stage-toolbar-radius: clamp(8px, 2.8cqw, 10px);
      width: min(100% + 24px, 100vw - 28px);
      max-width: min(100% + 24px, 100vw - 28px);
      position: relative;
      left: 50%;
      transform: translateX(-50%);
      margin-inline: auto;
      padding: 0;
      overflow: hidden;
    }

    .stage__toolbar--below .stage__toolbar-separator {
      display: none;
    }

    .stage__toolbar--below .stage__toolbar-group {
      min-height: var(--stage-toolbar-group-height);
      border-radius: var(--stage-toolbar-radius);
    }

    .stage__toolbar--below .stage__toolbar-group--single {
      min-height: var(--stage-toolbar-group-height);
    }

    .stage__toolbar--below .stage__toolbar-button {
      width: var(--stage-toolbar-button-width);
      height: var(--stage-toolbar-button-height);
      min-height: var(--stage-toolbar-button-height);
    }

    .stage__toolbar--below .stage__toolbar-button--single {
      width: var(--stage-toolbar-button-width);
      height: var(--stage-toolbar-button-height);
      min-height: var(--stage-toolbar-button-height);
      border-radius: 0;
    }

    .stage__toolbar--below .stage__toolbar-value {
      min-width: var(--stage-toolbar-value-width);
      min-height: var(--stage-toolbar-button-height);
      font-size: var(--stage-toolbar-value-font-size);
      gap: var(--stage-toolbar-value-gap);
      padding-inline: var(--stage-toolbar-value-padding);
    }

    .stage__toolbar--below .stage__toolbar-value--zoom {
      width: var(--stage-toolbar-zoom-width);
      min-width: var(--stage-toolbar-zoom-width);
      flex-basis: var(--stage-toolbar-zoom-width);
    }

    .stage__toolbar--below .stage__toolbar-icon {
      width: var(--stage-toolbar-icon-size);
      height: var(--stage-toolbar-icon-size);
    }

    .stage__toolbar--below .stage__toolbar-icon--rotate {
      width: var(--stage-toolbar-rotate-icon-size);
      height: var(--stage-toolbar-rotate-icon-size);
    }
  }

  @media (max-width: 900px) {
    .stage__toolbar--below {
      --stage-toolbar-gap: clamp(3px, 1vw, 5px);
      --stage-toolbar-button-width: clamp(26px, 8.2vw, 38px);
      --stage-toolbar-button-height: clamp(30px, 8.8vw, 38px);
      --stage-toolbar-group-height: calc(var(--stage-toolbar-button-height) + 2px);
      --stage-toolbar-value-width: clamp(40px, 13.5vw, 70px);
      --stage-toolbar-zoom-width: clamp(38px, 12vw, 60px);
      --stage-toolbar-zoom-input-width: 3.6ch;
      --stage-toolbar-value-font-size: clamp(10px, 2.7vw, 12px);
      --stage-toolbar-value-gap: clamp(2px, .7vw, 4px);
      --stage-toolbar-value-padding: clamp(3px, 1vw, 7px);
      --stage-toolbar-icon-size: clamp(15px, 4vw, 18px);
      --stage-toolbar-rotate-icon-size: clamp(16px, 4.4vw, 19px);
      --stage-toolbar-radius: clamp(8px, 2.4vw, 10px);
      width: min(100% + 24px, 100vw - 28px);
      max-width: min(100% + 24px, 100vw - 28px);
      position: relative;
      left: 50%;
      transform: translateX(-50%);
      margin-inline: auto;
      padding: 0;
      border-radius: 8px;
      overflow: hidden;
    }

    .stage__toolbar--below .stage__toolbar-group {
      min-height: var(--stage-toolbar-group-height);
      border-radius: var(--stage-toolbar-radius);
    }

    .stage__toolbar--below .stage__toolbar-group--single {
      min-height: var(--stage-toolbar-group-height);
    }

    .stage__toolbar--below .stage__toolbar-separator {
      display: none;
    }

    .stage__toolbar--below .stage__toolbar-button {
      width: var(--stage-toolbar-button-width);
      height: var(--stage-toolbar-button-height);
      min-height: var(--stage-toolbar-button-height);
    }

    .stage__toolbar--below .stage__toolbar-button--single {
      width: var(--stage-toolbar-button-width);
      height: var(--stage-toolbar-button-height);
      border-radius: 0;
      min-height: var(--stage-toolbar-button-height);
    }

    .stage__toolbar--below .stage__toolbar-value {
      min-width: var(--stage-toolbar-value-width);
      min-height: var(--stage-toolbar-button-height);
      font-size: var(--stage-toolbar-value-font-size);
      gap: var(--stage-toolbar-value-gap);
      padding-inline: var(--stage-toolbar-value-padding);
    }

    .stage__toolbar--below .stage__toolbar-value--zoom {
      width: var(--stage-toolbar-zoom-width);
      min-width: var(--stage-toolbar-zoom-width);
      flex-basis: var(--stage-toolbar-zoom-width);
    }

    .stage__toolbar--below .stage__toolbar-icon {
      width: var(--stage-toolbar-icon-size);
      height: var(--stage-toolbar-icon-size);
    }

    .stage__toolbar--below .stage__toolbar-icon--rotate {
      width: var(--stage-toolbar-rotate-icon-size);
      height: var(--stage-toolbar-rotate-icon-size);
    }
  }
</style>
