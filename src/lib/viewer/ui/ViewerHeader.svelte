<script lang="ts">
  import { t } from '../../core/i18n';
  import type { ManifestEntry } from '../../core/state/manifests';
  import MangoFooterBrand from './MangoFooterBrand.svelte';

  export let manifestId = '';
  export let manifestEntry: ManifestEntry | undefined;
  export let brand: string | undefined = undefined;
  export let buttonTitle: string | undefined = undefined;
  export let buttonLabel: string | undefined = undefined;
  export let aboutTitle: string | undefined = undefined;
  export let aboutDescription: string | undefined = undefined;
  export let aboutVersion: string | undefined = undefined;
  export let aboutHomepage: string | undefined = undefined;
  export let aboutVisitLabel: string | undefined = undefined;
</script>

<header class="viewer__header">
  <MangoFooterBrand
    position="inline"
    {brand}
    {buttonTitle}
    {buttonLabel}
    {aboutTitle}
    {aboutDescription}
    {aboutVersion}
    {aboutHomepage}
    {aboutVisitLabel}
  />
  {#if manifestId && (manifestEntry?.label || manifestEntry?.isFetching || manifestEntry?.error)}
    <span class="viewer__header-divider" aria-hidden="true">|</span>
    <div class="manifest">
      <span class="manifest__title">
        {#if manifestEntry?.isFetching}
          {$t('viewer.status.loading')}
        {:else if manifestEntry?.error}
          {$t('viewer.status.error')}
        {:else if manifestEntry?.label}
          {manifestEntry.label}
        {/if}
      </span>
    </div>
  {/if}
</header>

<style>
  .viewer__header {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
  }

  .viewer__header-divider {
    color: var(--viewer-muted, rgba(255, 255, 255, 0.35));
    font-size: 14px;
    font-weight: 300;
    line-height: 1;
    user-select: none;
    flex-shrink: 0;
  }

  .manifest {
    display: grid;
    justify-items: start;
    gap: 6px;
    text-align: left;
    width: 100%;
    min-width: 0;
  }

  .manifest__title {
    display: block;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.25;
  }

  @media (max-width: 900px) {
    .viewer__header {
      text-align: center;
    }

    .manifest__title {
      font-size: 15px;
    }
  }
</style>
