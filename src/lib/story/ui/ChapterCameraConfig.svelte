<script lang="ts">
  import { t } from '../../i18n';

  export let chapterExists = false;
  export let chapterCanvasIndex = 0;
  export let canvasIndex = 0;
  export let canvasCount = 0;
  export let manifestDraft = '';
  export let sourceLoaded = false;
  export let delayMs: number | undefined = undefined;
  export let section: 'all' | 'source' | 'transition-timing' = 'all';

  export let onManifestInput: ((event: Event) => void) | undefined;
  export let onReloadManifest: ((chapterCanvasIndex: number) => void) | undefined;
  export let onSelectCanvas: ((canvasIndex: number) => void) | undefined;
  export let onDelayChange: ((event: Event) => void) | undefined;
  export let onCreateChapter: (() => void) | undefined;
</script>

{#if section === 'all' || section === 'source'}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-title">{$t('storyBuilder.chapter.manifestLabel')}</div>
    <div class="chapter-overlay__row">
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
        on:click={() => onReloadManifest?.(chapterCanvasIndex)}
        disabled={!chapterExists && !manifestDraft.trim()}
      >
        {chapterExists || sourceLoaded
          ? $t('storyBuilder.source.reloadManifest')
          : $t('storyBuilder.source.loadManifest')}
      </button>
    </div>
    {#if !chapterExists && !sourceLoaded}
      <div class="chapter-overlay__hint">{$t('storyBuilder.source.stepLoad')}</div>
    {:else if canvasCount > 0}
      <label class="chapter-overlay__label">
        {$t('storyBuilder.source.canvas')}
        <select
          class="chapter-overlay__select"
          data-testid="chapter-canvas-select"
          value={canvasIndex}
          on:change={(event) => onSelectCanvas?.(Number(event.currentTarget.value))}
        >
          {#each Array.from({ length: canvasCount }, (_, index) => index) as index}
            <option value={index}>{$t('storyBuilder.source.canvasPosition', { current: index + 1, total: canvasCount })}</option>
          {/each}
        </select>
      </label>
      {#if chapterExists}
        <div class="chapter-overlay__hint">
          {$t('storyBuilder.source.chooseCanvasHint')}
        </div>
      {:else}
        <div class="chapter-overlay__onboarding-finish">
          <div class="chapter-overlay__hint">
            {$t('storyBuilder.source.stepCreate')}
          </div>
          <button
            class="chapter-overlay__button chapter-overlay__button--primary"
            type="button"
            data-testid="chapter-create-first"
            on:click={onCreateChapter}>{$t('storyBuilder.source.createFirst')}</button
          >
        </div>
      {/if}
    {:else if sourceLoaded}
      <div class="chapter-overlay__hint" role="status">{$t('storyBuilder.source.loading')}</div>
    {/if}
  </section>
{/if}

{#if section === 'all' || section === 'transition-timing'}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-title">{$t('storyBuilder.transition.title')}</div>
    <div class="chapter-overlay__section-content">
      <p class="chapter-overlay__hint">
        {$t('storyBuilder.transition.description')}
      </p>
      <label class="chapter-overlay__label">
        {$t('storyBuilder.transition.delay')}
        <input
          class="chapter-overlay__input"
          type="number"
          min="0"
          step="0.5"
          data-testid="chapter-transition-delay"
          value={delayMs !== undefined ? (delayMs / 1000).toString() : ''}
          on:input={onDelayChange}
        />
      </label>
    </div>
  </section>
{/if}
