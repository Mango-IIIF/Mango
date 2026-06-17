<script lang="ts">
  import ViewerLayout from '../viewer/ViewerLayout.svelte';
  import type { ViewerConfig } from '../../core/types/config';
  import { fetchManifest } from '../../state/manifests';
  import type { WindowNode } from '../../core/types/workspace';
  import EmptySlotPlaceholder from './EmptySlotPlaceholder.svelte';

  interface Props {
    windowNode: WindowNode;
    windowNumber?: number;
    active?: boolean;
    onfocuswindow?: ((id: string) => void) | undefined;
    onmovewindow?:
      | ((detail: { id: string; direction: 'left' | 'right' | 'up' | 'down' }) => void)
      | undefined;
    onclosewindow?: ((id: string) => void) | undefined;
    onloadmanifest?: ((detail: { id: string; manifestId: string }) => void) | undefined;
  }

  let {
    windowNode,
    windowNumber = 1,
    active = false,
    onfocuswindow = undefined,
    onmovewindow = undefined,
    onclosewindow = undefined,
    onloadmanifest = undefined,
  }: Props = $props();

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
  class:workspace-window--active={active}
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
    <span class="workspace-window__title">Window {windowNumber}</span>
    <div class="workspace-window__actions">
      <button
        class="workspace-window__action"
        type="button"
        title="Move left"
        onclick={(event) => {
          event.stopPropagation();
          onmovewindow?.({ id: windowNode.id, direction: 'left' });
        }}>←</button
      >
      <button
        class="workspace-window__action"
        type="button"
        title="Move up"
        onclick={(event) => {
          event.stopPropagation();
          onmovewindow?.({ id: windowNode.id, direction: 'up' });
        }}>↑</button
      >
      <button
        class="workspace-window__action"
        type="button"
        title="Move down"
        onclick={(event) => {
          event.stopPropagation();
          onmovewindow?.({ id: windowNode.id, direction: 'down' });
        }}>↓</button
      >
      <button
        class="workspace-window__action"
        type="button"
        title="Move right"
        onclick={(event) => {
          event.stopPropagation();
          onmovewindow?.({ id: windowNode.id, direction: 'right' });
        }}>→</button
      >
      <button
        class="workspace-window__action workspace-window__action--close"
        type="button"
        title="Close"
        onclick={(event) => {
          event.stopPropagation();
          onclosewindow?.(windowNode.id);
        }}>×</button
      >
    </div>
  </header>

  <div class="workspace-window__body">
    {#if windowNode.manifestId}
      <ViewerLayout manifestId={windowNode.manifestId} config={layoutConfig} />
    {:else}
      <EmptySlotPlaceholder onloadmanifest={handleLoadManifest} />
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

  .workspace-window::after {
    content: '';
    position: absolute;
    inset: 1px;
    border-radius: inherit;
    pointer-events: none;
    z-index: 2;
    box-shadow: inset 0 0 0 0 rgba(42, 199, 255, 0);
    transition: box-shadow 0.16s ease;
  }

  .workspace-window--active {
    border-color: rgba(42, 199, 255, 0.7);
  }

  .workspace-window--active::after {
    box-shadow: inset 0 0 0 2px rgba(42, 199, 255, 0.5);
  }

  .workspace-window__header {
    display: flex;
    justify-content: space-between;
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
    text-transform: uppercase;
  }

  .workspace-window__actions {
    display: flex;
    gap: 6px;
  }

  .workspace-window__action {
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: #dce8f5;
    font-size: 12px;
    width: 28px;
    height: 28px;
    cursor: pointer;
  }

  .workspace-window__action--close {
    border-color: var(--viewer-close-button-border, rgba(255, 255, 255, 0.18));
    border-radius: var(--viewer-close-button-radius, 10px);
    background: var(--viewer-close-button-bg, rgba(255, 255, 255, 0.1));
    color: var(--viewer-close-button-color, #dce8f5);
    font-size: var(--viewer-close-button-glyph-size, 15px);
    line-height: 1;
  }

  .workspace-window__action--close:hover:not(:disabled) {
    background: var(--viewer-close-button-hover-bg, rgba(255, 255, 255, 0.16));
    border-color: var(--viewer-close-button-hover-border, rgba(255, 255, 255, 0.34));
  }

  .workspace-window__action--close:focus-visible {
    outline: 2px solid var(--viewer-close-button-focus-ring, rgba(42, 199, 255, 0.55));
    outline-offset: 2px;
  }

  .workspace-window__action--close:active:not(:disabled) {
    transform: translateY(1px);
  }

  .workspace-window__body {
    display: grid;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .workspace-window__body :global(.viewer) {
    border-radius: 0;
    min-height: 0 !important;
    height: 100%;
    grid-template-rows: minmax(0, 1fr);
    gap: 0;
    padding: 0;
  }

  .workspace-window__body :global(.viewer__grid) {
    grid-template-columns: minmax(0, 1fr);
    height: 100%;
    min-height: 0;
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

  .workspace-window__body :global(.viewer__header),
  .workspace-window__body :global(.viewer__control-rail),
  .workspace-window__body :global(.viewer__mobile-overlay),
  .workspace-window__body :global(.stage__toolbar),
  .workspace-window__body :global(.stage__bottom) {
    display: none !important;
  }
</style>
