<script lang="ts">
  import ViewerLayout from '../viewer/ViewerLayout.svelte';
  import type { ViewerConfig } from '../../core/types/config';
  import { fetchManifest, manifestsStore } from '../../state/manifests';
  import { resolveMedia } from '../../iiif/mediaResolver';
  import { t } from '../../i18n';
  import type { WindowNode } from '../../core/types/workspace';
  import EmptySlotPlaceholder from './EmptySlotPlaceholder.svelte';
  import iiifIcon from './iiif_bw.svg';

  interface Props {
    windowNode: WindowNode;
    windowNumber?: number;
    onfocuswindow?: ((id: string) => void) | undefined;
    onmovewindow?:
      | ((detail: { id: string; direction: 'left' | 'right' | 'up' | 'down' }) => void)
      | undefined;
    onclosewindow?: ((id: string) => void) | undefined;
    onloadmanifest?: ((detail: { id: string; manifestId: string }) => void) | undefined;
    oncanvaschange?: ((detail: { id: string; canvasIndex: number }) => void) | undefined;
    onopenmanifestmanager?: ((id: string) => void) | undefined;
  }

  let {
    windowNode,
    windowNumber = 1,
    onfocuswindow = undefined,
    onmovewindow: _onmovewindow = undefined,
    onclosewindow: _onclosewindow = undefined,
    onloadmanifest = undefined,
    oncanvaschange = undefined,
    onopenmanifestmanager = undefined,
  }: Props = $props();

  const manifestEntry = $derived(
    windowNode.manifestId ? $manifestsStore[windowNode.manifestId] : undefined,
  );
  const windowTitle = $derived(
    manifestEntry?.label ||
      (windowNode.manifestId
        ? windowNode.manifestId
        : $t('workspace.manifestManager.window', { number: windowNumber })),
  );
  const canvasCount = $derived(manifestEntry?.canvases.length ?? 0);
  let pageInput = $state('1');

  $effect(() => {
    pageInput = String(windowNode.canvasIndex + 1);
  });

  const setPageFromInput = () => {
    const requestedPage = Number.parseInt(pageInput, 10);
    const currentPage = windowNode.canvasIndex + 1;
    if (!Number.isFinite(requestedPage)) {
      pageInput = String(currentPage);
      return;
    }

    const page = Math.min(Math.max(requestedPage, 1), canvasCount);
    pageInput = String(page);
    if (page !== currentPage) {
      oncanvaschange?.({ id: windowNode.id, canvasIndex: page - 1 });
    }
  };
  const isImage = $derived.by(() => {
    const entry = manifestEntry;
    if (!entry?.manifesto) return false;
    const canvas = entry.canvases[windowNode.canvasIndex];
    return resolveMedia(entry.manifesto, canvas?.id, windowNode.canvasIndex).primary?.type === 'image';
  });

  const layoutConfig: ViewerConfig = {
    allowCreateMode: true,
    showThumbnails: false,
    showContents: false,
    showSearch: false,
    showMetadata: false,
    showAnnotations: false,
    showTools: false,
  };

  const handleLoadManifest = async (manifestId: string) => {
    if (!manifestId) return;
    await fetchManifest(manifestId);
    onloadmanifest?.({ id: windowNode.id, manifestId });
  };
</script>

<div
  class="workspace-window"
  role="button"
  tabindex="0"
  onclick={() => onfocuswindow?.(windowNode.id)}
  onkeydown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onfocuswindow?.(windowNode.id);
    }
  }}
>
  <header class="workspace-window__header">
    <span class="workspace-window__title" title={windowTitle}>{windowTitle}</span>
    <button
      class="workspace-window__manifest-button"
      type="button"
      aria-label={$t('workspace.window.replaceManifest')}
      title={$t('workspace.window.replaceManifest')}
      onclick={(event) => {
        event.stopPropagation();
        onfocuswindow?.(windowNode.id);
        onopenmanifestmanager?.(windowNode.id);
      }}
    >
      <img src={iiifIcon} alt="" />
    </button>
  </header>

  <div class="workspace-window__body">
    {#if windowNode.manifestId}
      <ViewerLayout
        manifestId={windowNode.manifestId}
        config={layoutConfig}
        canvasIndex={windowNode.canvasIndex}
        oncanvaschange={(detail) =>
          oncanvaschange?.({ id: windowNode.id, canvasIndex: detail.canvasIndex })}
      />
      {#if isImage && canvasCount > 1}
        <div class="workspace-window__pagination" aria-label={$t('workspace.window.canvasNavigation')}>
          <button
            type="button"
            aria-label={$t('workspace.window.previousCanvas')}
            disabled={windowNode.canvasIndex <= 0}
            onclick={(event) => {
              event.stopPropagation();
              oncanvaschange?.({ id: windowNode.id, canvasIndex: windowNode.canvasIndex - 1 });
            }}>‹</button
          >
          <label class="workspace-window__page-input">
            <span class="workspace-window__visually-hidden">
              {$t('workspace.window.pageNumber')}
            </span>
            <input
              type="number"
              min="1"
              max={canvasCount}
              value={pageInput}
              aria-label={$t('workspace.window.pageNumber')}
              oninput={(event) => (pageInput = event.currentTarget.value)}
              onclick={(event) => event.stopPropagation()}
              onkeydown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') {
                  event.preventDefault();
                  setPageFromInput();
                  event.currentTarget.select();
                } else if (event.key === 'Escape') {
                  pageInput = String(windowNode.canvasIndex + 1);
                  event.currentTarget.blur();
                }
              }}
              onblur={setPageFromInput}
            />
            <span aria-hidden="true">/ {canvasCount}</span>
          </label>
          <button
            type="button"
            aria-label={$t('workspace.window.nextCanvas')}
            disabled={windowNode.canvasIndex >= canvasCount - 1}
            onclick={(event) => {
              event.stopPropagation();
              oncanvaschange?.({ id: windowNode.id, canvasIndex: windowNode.canvasIndex + 1 });
            }}>›</button
          >
        </div>
      {/if}
    {:else}
      <EmptySlotPlaceholder
        onloadmanifest={handleLoadManifest}
        onopenmanifestmanager={() => onopenmanifestmanager?.(windowNode.id)}
        showInput={false}
      />
    {/if}
  </div>
</div>

<style>
  .workspace-window {
    position: relative;
    isolation: isolate;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(9, 17, 28, 0.88);
    width: 100%;
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
  }

  .workspace-window__header {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(12, 24, 38, 0.92);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .workspace-window__title {
    font-size: 11px;
    color: rgba(220, 232, 247, 0.84);
    letter-spacing: 0.1em;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    max-width: calc(100% - 72px);
  }

  .workspace-window__manifest-button {
    position: absolute;
    top: 50%;
    right: 8px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 5px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    cursor: pointer;
    transform: translateY(-50%);
  }

  .workspace-window__manifest-button:hover {
    border-color: rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.08);
  }

  .workspace-window__manifest-button:focus-visible {
    outline: 2px solid rgba(166, 205, 255, 0.9);
    outline-offset: 1px;
  }

  .workspace-window__manifest-button img {
    display: block;
    width: 17px;
    height: 17px;
    object-fit: contain;
    opacity: 0.86;
    filter: invert(1);
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']))
    .workspace-window__manifest-button img {
    filter: none;
  }

  .workspace-window__pagination {
    position: absolute;
    z-index: 4;
    left: 50%;
    bottom: 12px;
    max-width: calc(100% - 20px);
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 999px;
    background: rgba(8, 16, 25, 0.78);
    backdrop-filter: blur(8px);
    color: rgba(238, 245, 252, 0.9);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .workspace-window__pagination button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: #dce8f5;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }

  .workspace-window__pagination button:disabled {
    cursor: default;
    opacity: 0.36;
  }

  .workspace-window__page-input {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .workspace-window__page-input input {
    box-sizing: border-box;
    width: 42px;
    height: 28px;
    padding: 0 5px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.08);
    color: inherit;
    font: inherit;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    text-align: center;
    outline: none;
    appearance: textfield;
  }

  .workspace-window__page-input input::-webkit-inner-spin-button,
  .workspace-window__page-input input::-webkit-outer-spin-button {
    margin: 0;
    appearance: none;
  }

  .workspace-window__page-input input:focus-visible {
    border-color: rgba(166, 205, 255, 0.82);
    box-shadow: 0 0 0 2px rgba(85, 155, 230, 0.28);
  }

  .workspace-window__visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .workspace-window__body {
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .workspace-window__body :global(.viewer) {
    border-radius: 0;
    min-height: 0 !important;
    height: 100%;
    max-height: none !important;
    grid-template-rows: minmax(0, 1fr);
    gap: 0;
    padding: 0;
    border: 0;
    box-shadow: none;
  }

  .workspace-window__body :global(.viewer__grid) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) !important;
    height: 100%;
    max-height: none !important;
    min-height: 0;
    row-gap: 0;
  }

  .workspace-window__body :global(.stage),
  .workspace-window__body :global(.stage__container),
  .workspace-window__body :global(.stage__media) {
    height: 100%;
    min-height: 0;
  }

  .workspace-window__body :global(.stage) {
    overflow: hidden;
  }

  .workspace-window__body :global(.stage__primary) {
    height: 100%;
  }

  .workspace-window__body :global(.stage__viewer-frame) {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .workspace-window__body :global(.stage__viewer-frame .stage__media) {
    border-radius: 0;
  }

  .workspace-window__body :global(.viewer__top-row),
  .workspace-window__body :global(.viewer__header),
  .workspace-window__body :global(.viewer__control-rail),
  .workspace-window__body :global(.viewer__mobile-overlay),
  .workspace-window__body :global(.stage__toolbar),
  .workspace-window__body :global(.stage__bottom) {
    display: none !important;
  }
</style>
