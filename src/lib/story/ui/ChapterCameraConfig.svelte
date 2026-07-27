<script lang="ts">
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
    <div class="chapter-overlay__section-title">Manifest URL</div>
    <div class="chapter-overlay__row">
      <input
        class="chapter-overlay__input"
        type="url"
        aria-label="Manifest URL"
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
        {chapterExists || sourceLoaded ? 'Reload manifest' : 'Load manifest'}
      </button>
    </div>
    {#if !chapterExists && !sourceLoaded}
      <div class="chapter-overlay__hint">Step 1 of 2 · Load a IIIF Manifest.</div>
    {:else if canvasCount > 0}
      <label class="chapter-overlay__label">
        Canvas
        <select
          class="chapter-overlay__select"
          data-testid="chapter-canvas-select"
          value={canvasIndex}
          on:change={(event) => onSelectCanvas?.(Number(event.currentTarget.value))}
        >
          {#each Array.from({ length: canvasCount }, (_, index) => index) as index}
            <option value={index}>Canvas {index + 1} of {canvasCount}</option>
          {/each}
        </select>
      </label>
      {#if chapterExists}
        <div class="chapter-overlay__hint">
          Choose a canvas, then save the source to apply it to this chapter.
        </div>
      {:else}
        <div class="chapter-overlay__onboarding-finish">
          <div class="chapter-overlay__hint">
            Step 2 of 2 · Choose a canvas and create the first chapter. Image placement can be
            adjusted afterwards from the chapter tools.
          </div>
          <button
            class="chapter-overlay__button chapter-overlay__button--primary"
            type="button"
            data-testid="chapter-create-first"
            on:click={onCreateChapter}>Create first chapter</button
          >
        </div>
      {/if}
    {:else if sourceLoaded}
      <div class="chapter-overlay__hint" role="status">Loading the manifest and its canvases…</div>
    {/if}
  </section>
{/if}

{#if section === 'all' || section === 'transition-timing'}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-title">Chapter transition time</div>
    <div class="chapter-overlay__section-content">
      <p class="chapter-overlay__hint">
        Set how long to wait before moving to the next chapter. Leave this blank to require manual
        navigation.
      </p>
      <label class="chapter-overlay__label">
        Delay before next chapter (seconds)
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
