<script lang="ts">
  import { t } from '../../core/i18n';

  export let chapterExists = false;
  export let chapterCanvasIndex = 0;
  export let manifestDraft = '';
  export let sourceLoaded = false;
  /**
   * Bare, as the body of an inspector section that already has a heading;
   * otherwise a card of its own, which is how the empty story's first source
   * is loaded before there is a chapter to inspect.
   */
  export let embedded = false;

  export let onManifestInput: ((event: Event) => void) | undefined;
  export let onReloadManifest: ((chapterCanvasIndex: number) => void) | undefined;
  export let onCreateChapter: (() => void) | undefined;

  const handleLoad = () => {
    onReloadManifest?.(chapterCanvasIndex);
    if (!chapterExists) onCreateChapter?.();
  };
</script>

<svelte:element
  this={embedded ? 'div' : 'section'}
  class={embedded
    ? 'chapter-overlay__section-content'
    : 'chapter-overlay__section chapter-overlay__section--card'}
>
    {#if !embedded}
      <div class="chapter-overlay__section-title">{$t('storyBuilder.chapter.manifestLabel')}</div>
    {/if}
    <div class="chapter-overlay__row chapter-camera-config__manifest-row">
      <input
        class="chapter-overlay__input"
        type="url"
        aria-label={$t('storyBuilder.chapter.manifestLabel')}
        data-testid="chapter-manifest"
        value={manifestDraft}
        on:input={onManifestInput}
        placeholder="https://example.org/iiif/manifest.json"
      />
      <button
        class="chapter-overlay__button chapter-overlay__button--primary"
        type="button"
        data-testid="chapter-manifest-reload"
        on:click={handleLoad}
        disabled={!chapterExists && !manifestDraft.trim()}
      >
        {chapterExists || sourceLoaded
          ? $t('storyBuilder.source.reloadManifest')
          : $t('storyBuilder.source.loadManifest')}
      </button>
    </div>
</svelte:element>

<style>
  .chapter-overlay__row.chapter-camera-config__manifest-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .chapter-camera-config__manifest-row .chapter-overlay__button {
    justify-self: start;
  }
</style>
