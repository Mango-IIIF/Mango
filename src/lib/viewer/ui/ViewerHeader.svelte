<script lang="ts">
  import { t } from '../../i18n';
  import type { ManifestEntry } from '../../state/manifests';

  export let manifestId = '';
  export let manifestEntry: ManifestEntry | undefined;
</script>

<header class="viewer__header">
  <div class="manifest">
    <span class="manifest__title">
      {#if !manifestId}
        {$t('viewer.status.waiting')}
      {:else if manifestEntry?.isFetching}
        {$t('viewer.status.loading')}
      {:else if manifestEntry?.error}
        {$t('viewer.status.error')}
      {:else if manifestEntry?.label}
        {manifestEntry.label}
      {:else}
        {$t('viewer.status.loaded')}
      {/if}
    </span>
  </div>
</header>

<style>
  .viewer__header {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    width: 100%;
    min-width: 0;
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
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  @media (max-width: 900px) {
    .viewer__header {
      text-align: center;
    }
  }
</style>
