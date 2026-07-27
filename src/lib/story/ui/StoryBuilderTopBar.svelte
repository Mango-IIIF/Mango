<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Download, Play, Redo2, Save, Settings2, Square, Undo2 } from '@lucide/svelte';
  import type { Readable } from 'svelte/store';
  import type { StoryState } from '../../core/types/story';
  import type { SaveState } from '../storySerializer';
  import MangoFooterBrand from './MangoFooterBrand.svelte';

  export let story: Readable<StoryState>;
  export let isPreviewing: Readable<boolean>;
  export let saveState: Readable<SaveState>;
  export let saveConfigured: Readable<boolean>;
  export let dirty: Readable<boolean>;
  export let canUndo: Readable<boolean>;
  export let canRedo: Readable<boolean>;
  export let language = 'en';
  export let onUndo: (() => void) | undefined;
  export let onRedo: (() => void) | undefined;
  export let onNarration: (() => void) | undefined;
  export let onPreview: (() => void) | undefined;
  export let onStopPreview: (() => void) | undefined;
  export let onSave: (() => void) | undefined;
  export let onExport: (() => void) | undefined;

  let root: HTMLDivElement | null = null;
  let viewerRoot: HTMLElement | null = null;

  $: if (root) {
    viewerRoot = root.closest('.viewer');
    viewerRoot?.classList.toggle('viewer--story-preview', $isPreviewing);
  }

  onDestroy(() => viewerRoot?.classList.remove('viewer--story-preview'));

  $: statusLabel =
    $saveState.status === 'saving'
      ? 'Saving…'
      : $saveState.status === 'error'
        ? ($saveState.message ?? 'Save failed')
        : $saveState.status === 'success' && !$dirty
          ? ($saveState.message ?? 'Saved')
          : $dirty
            ? 'Unsaved changes'
            : 'Up to date';

  $: storyTitle =
    $story.title?.[language] ||
    $story.title?.en ||
    Object.values($story.title ?? {}).find((value) => value.trim()) ||
    'Untitled story';
</script>

<div class="story-topbar" data-testid="story-builder-topbar" bind:this={root}>
  <div class="story-topbar__title">
    <MangoFooterBrand position="inline" />
    {#if storyTitle}
      <span class="story-topbar__title-divider" aria-hidden="true">|</span>
      <span data-testid="story-builder-title">{storyTitle}</span>
    {/if}
  </div>

  <div class="story-topbar__status" aria-live="polite">
    <span class:story-topbar__status-dot--dirty={$dirty} class="story-topbar__status-dot"></span>
    <span>{statusLabel}</span>
  </div>

  <div class="story-topbar__group" aria-label="Story history">
    <button type="button" aria-label="Undo" title="Undo" disabled={!$canUndo} on:click={onUndo}>
      <Undo2 aria-hidden="true" />
    </button>
    <button type="button" aria-label="Redo" title="Redo" disabled={!$canRedo} on:click={onRedo}>
      <Redo2 aria-hidden="true" />
    </button>
  </div>

  <button
    class="story-topbar__button story-topbar__button--preview"
    type="button"
    disabled={$story.chapters.length === 0}
    on:click={() => ($isPreviewing ? onStopPreview?.() : onPreview?.())}
  >
    {#if $isPreviewing}
      <Square aria-hidden="true" />
      <span>Exit preview</span>
    {:else}
      <Play aria-hidden="true" />
      <span>Preview story</span>
    {/if}
  </button>

  {#if $saveConfigured}
    <button
      class="story-topbar__button story-topbar__button--primary"
      type="button"
      disabled={$saveState.status === 'saving' || $story.chapters.length === 0}
      on:click={onSave}
    >
      <Save aria-hidden="true" />
      <span>Save</span>
    </button>
  {/if}

  <button
    class="story-topbar__button story-topbar__button--export"
    type="button"
    disabled={$story.chapters.length === 0}
    on:click={onExport}
  >
    <Download aria-hidden="true" />
    <span>Export</span>
  </button>

  <button
    class="story-topbar__button story-topbar__button--narration"
    type="button"
    on:click={onNarration}
  >
    <Settings2 aria-hidden="true" />
    <span>Story settings</span>
  </button>
</div>

<style>
  .story-topbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
    color: var(--viewer-text, #e8edf4);
  }

  .story-topbar__status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    max-width: 180px;
    color: var(--viewer-muted, rgba(255, 255, 255, 0.65));
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .story-topbar__title {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    margin-right: auto;
    overflow: hidden;
    color: var(--viewer-text, #e8edf4);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .story-topbar__title-divider {
    color: var(--viewer-muted, rgba(255, 255, 255, 0.35));
    font-size: 14px;
    font-weight: 300;
    line-height: 1;
    user-select: none;
    flex-shrink: 0;
  }

  .story-topbar__status-dot {
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: #55b889;
  }

  .story-topbar__status-dot--dirty {
    background: #f2ad4f;
  }

  .story-topbar__group {
    display: flex;
    gap: 3px;
    padding-right: 8px;
    border-right: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
  }

  .story-topbar button {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.14));
    border-radius: 10px;
    padding: 7px 10px;
    background: var(--viewer-panel, #121922);
    color: inherit;
    font: inherit;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
  }

  .story-topbar button:hover:not(:disabled) {
    background: var(--viewer-panel-strong, #1b2633);
  }

  .story-topbar button:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .story-topbar button :global(svg) {
    width: 16px;
    height: 16px;
  }

  .story-topbar__button--primary {
    border-color: transparent !important;
    background: var(--accent, #e07a3f) !important;
    color: #fff !important;
  }

  @container mango-viewer (max-width: 860px) {
    .story-topbar__status,
    .story-topbar__button span {
      display: none;
    }

    .story-topbar button {
      width: 40px;
      min-width: 40px;
      height: 40px;
      padding: 0;
    }

    .story-topbar__title {
      font-size: 15px;
    }
  }

  :global(.viewer--story-preview) .story-topbar__status,
  :global(.viewer--story-preview) .story-topbar__group,
  :global(.viewer--story-preview) .story-topbar__button--narration,
  :global(.viewer--story-preview) .story-topbar__button--export,
  :global(.viewer--story-preview) .story-topbar__button--primary {
    display: none;
  }
</style>
