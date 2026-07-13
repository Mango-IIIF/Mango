<script lang="ts">
  import '@mango-iiif/av/chapters';
  import '@mango-iiif/av/transcript';
  import type {
    MangoAVChaptersElement,
    MangoAVTranscriptElement,
  } from '@mango-iiif/av';
  import { getContext } from 'svelte';
  import { t } from '../../i18n';

  interface Props {
    onclose?: () => void;
  }

  let { onclose = undefined }: Props = $props();

  const viewer = getContext<any>('viewer-context');
  const { avChaptersAvailable, avTranscriptAvailable } = viewer.derived;
  const avController = viewer.derived.av.controller;

  let activeTab = $state<'toc' | 'transcript'>('toc');
  let chaptersElement: MangoAVChaptersElement | null = $state(null);
  let transcriptElement: MangoAVTranscriptElement | null = $state(null);

  let hasToc = $derived($avChaptersAvailable);
  let hasTranscript = $derived($avTranscriptAvailable);

  $effect(() => {
    if (!hasToc && hasTranscript) {
      activeTab = 'transcript';
    }
    if (hasToc && !hasTranscript) {
      activeTab = 'toc';
    }
  });

  $effect(() => {
    if (chaptersElement) chaptersElement.controller = avController;
    if (transcriptElement) transcriptElement.controller = avController;
  });
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
      {#if !hasToc}
        <div class="panel__empty">{$t('viewer.panels.contents.emptyToc')}</div>
      {:else}
        <mango-av-chapters bind:this={chaptersElement}></mango-av-chapters>
      {/if}
    {:else}
      {#if !hasTranscript}
        <div class="panel__empty">{$t('viewer.panels.contents.emptyTranscript')}</div>
      {:else}
        <mango-av-transcript bind:this={transcriptElement}></mango-av-transcript>
      {/if}
    {/if}
  </div>
</section>

<style>
  mango-av-chapters,
  mango-av-transcript {
    display: block;
    --mango-av-accent: var(--viewer-accent, #e07a3f);
    --mango-av-accent-contrast: #fff;
    --mango-av-background: transparent;
    --mango-av-surface: rgba(255, 255, 255, 0.06);
    --mango-av-text: var(--viewer-text, #e8edf4);
    --mango-av-muted: var(--viewer-muted, #9aa6b2);
    --mango-av-border: var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    --mango-av-radius: 0.625rem;
  }
</style>
