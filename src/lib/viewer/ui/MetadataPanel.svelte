<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';
  import type { ManifestMetadataItem } from '../iiif/manifestMetadata';

  export let manifestTitle = '';
  export let manifestDescription = '';
  export let manifestAttribution = '';
  export let manifestLicence = '';
  export let manifestMetadata: ManifestMetadataItem[] = [];

  const dispatch = createEventDispatcher<{
    close: void;
  }>();
</script>

<section class="panel panel--metadata" aria-label={$t('viewer.panels.metadata.label')}>
  <div class="panel__header">
    <div class="panel__title">{$t('viewer.panels.metadata.title')}</div>
    <button
      class="panel__close"
      type="button"
      aria-label={$t('viewer.panels.metadata.close')}
      on:click={() => dispatch('close')}
    >
      {$t('common.closeGlyph')}
    </button>
  </div>
  <div class="panel__body metadata">
    {#if manifestTitle}
      <div class="metadata__label">{manifestTitle}</div>
    {/if}
    {#if manifestDescription}
      <div class="metadata__description">
        {@html manifestDescription}
      </div>
    {/if}
    {#if manifestAttribution}
      <div class="metadata__block">
        <div class="metadata__block-title">
          {$t('viewer.panels.metadata.attribution')}
        </div>
        <div class="metadata__block-value">
          {@html manifestAttribution}
        </div>
      </div>
    {/if}
    {#if manifestLicence}
      <div class="metadata__block">
        <div class="metadata__block-title">
          {$t('viewer.panels.metadata.license')}
        </div>
        <div class="metadata__block-value">
          <a
            class="metadata__link"
            href={manifestLicence}
            target="_blank"
            rel="noreferrer"
          >
            {manifestLicence}
          </a>
        </div>
      </div>
    {/if}
    {#if manifestMetadata.length > 0}
      <dl class="metadata__list">
        {#each manifestMetadata as item}
          <dt class="metadata__term">{item.label}</dt>
          <dd class="metadata__value">{@html item.value}</dd>
        {/each}
      </dl>
    {:else if !manifestDescription && !manifestAttribution && !manifestLicence}
      <div class="panel__empty">
        {$t('viewer.panels.metadata.empty')}
      </div>
    {/if}
  </div>
</section>

<style>
  .metadata {
    display: grid;
    gap: 10px;
  }

  .metadata__label {
    font-size: 14px;
    font-weight: 600;
    color: var(--viewer-text);
  }

  .metadata__description {
    font-size: 12px;
    color: var(--viewer-text);
    line-height: 1.5;
  }

  .metadata__block {
    display: grid;
    gap: 4px;
  }

  .metadata__block-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--viewer-muted);
  }

  .metadata__block-value {
    font-size: 12px;
    color: var(--viewer-text);
  }

  .metadata__link {
    color: inherit;
    word-break: break-all;
  }

  .metadata__list {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
    margin: 0;
  }

  .metadata__term {
    font-size: 12px;
    color: var(--viewer-muted);
    margin: 6px 0 0;
  }

  .metadata__term:first-child {
    margin-top: 0;
  }

  .metadata__value {
    font-size: 12px;
    color: var(--viewer-text);
    margin: 0 0 8px;
  }

  .metadata__value:last-child {
    margin-bottom: 0;
  }
</style>
