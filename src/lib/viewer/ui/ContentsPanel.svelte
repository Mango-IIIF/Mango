<script lang="ts">
  import { getContext } from 'svelte';
  import { t } from '../../i18n';

  interface Props {
    onclose?: () => void;
  }

  let { onclose = undefined }: Props = $props();

  const viewer = getContext<any>('viewer-context');
  const { tocEntries, transcriptEntries, activeTranscriptId } = viewer.derived;
  const actions = viewer.actions;

  let activeTab = $state<'toc' | 'transcript'>('toc');

  let hasToc = $derived($tocEntries.length > 0);
  let hasTranscript = $derived($transcriptEntries.length > 0);

  $effect(() => {
    if (!hasToc && hasTranscript) {
      activeTab = 'transcript';
    }
    if (hasToc && !hasTranscript) {
      activeTab = 'toc';
    }
  });

  const formatTime = (value?: number): string => {
    if (value == null || Number.isNaN(value)) return '--:--';
    const total = Math.max(0, Math.floor(value));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };
</script>

<section class="panel panel--contents" aria-label={$t('viewer.panels.contents.label')}>
  <div class="panel__header">
    <div class="panel__title">{$t('viewer.panels.contents.title')}</div>
    <button
      class="panel__close"
      type="button"
      aria-label={$t('viewer.panels.contents.close')}
      onclick={() => onclose?.()}
    >
      {$t('common.closeGlyph')}
    </button>
  </div>

  {#if hasToc && hasTranscript}
    <div
      class="panel__tabs"
      role="tablist"
      aria-label={$t('viewer.panels.contents.tabs')}
    >
      <button
        class:panel__tab--active={activeTab === 'toc'}
        class="panel__tab"
        type="button"
        role="tab"
        aria-selected={activeTab === 'toc'}
        onclick={() => (activeTab = 'toc')}
      >
        {$t('viewer.panels.contents.tocTab')}
      </button>
      <button
        class:panel__tab--active={activeTab === 'transcript'}
        class="panel__tab"
        type="button"
        role="tab"
        aria-selected={activeTab === 'transcript'}
        onclick={() => (activeTab = 'transcript')}
      >
        {$t('viewer.panels.contents.transcriptTab')}
      </button>
    </div>
  {/if}

  <div class="panel__body">
    {#if activeTab === 'toc'}
      {#if $tocEntries.length === 0}
        <div class="panel__empty">{$t('viewer.panels.contents.emptyToc')}</div>
      {:else}
        <ul class="contents-list" aria-label={$t('viewer.panels.contents.tocLabel')}>
          {#each $tocEntries as entry}
            <li style={`--toc-depth: ${entry.depth}`}> 
              <button
                class="contents-list__item"
                type="button"
                onclick={() =>
                  actions.seek({ canvasId: entry.canvasId, time: entry.start })}
              >
                <span class="contents-list__time">{formatTime(entry.start)}</span>
                <span class="contents-list__label">
                  {entry.label || $t('viewer.panels.contents.fallback')}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      {#if $transcriptEntries.length === 0}
        <div class="panel__empty">{$t('viewer.panels.contents.emptyTranscript')}</div>
      {:else}
        <ul
          class="transcript-list"
          aria-label={$t('viewer.panels.contents.transcriptLabel')}
        >
          {#each $transcriptEntries as entry}
            <li>
              <button
                class:transcript-list__item--active={entry.id === $activeTranscriptId}
                class="transcript-list__item"
                type="button"
                onclick={() => actions.seek({ time: entry.start })}
              >
                <span class="transcript-list__time">{formatTime(entry.start)}</span>
                <span class="transcript-list__label">{entry.text}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
</section>

<style>
  .contents-list,
  .transcript-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }

  .contents-list__item,
  .transcript-list__item {
    width: 100%;
    border: none;
    border-radius: 10px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--viewer-text);
    font-size: 12px;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    text-align: left;
    cursor: pointer;
  }

  .contents-list__item {
    padding-left: calc(10px + (var(--toc-depth, 0) * 12px));
  }

  .transcript-list__item--active {
    background: rgba(42, 199, 255, 0.2);
    border: 1px solid rgba(42, 199, 255, 0.5);
  }

  .contents-list__item:focus-visible,
  .transcript-list__item:focus-visible {
    outline: 2px solid rgba(42, 199, 255, 0.6);
    outline-offset: 2px;
  }

  .contents-list__time,
  .transcript-list__time {
    font-size: 11px;
    color: var(--viewer-muted);
    font-variant-numeric: tabular-nums;
  }

  .contents-list__label,
  .transcript-list__label {
    font-weight: 600;
    line-height: 1.4;
  }
</style>
