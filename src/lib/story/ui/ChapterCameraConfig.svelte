<script lang="ts">
  export let chapterExists = false;
  export let chapterCanvasIndex = 0;
  export let canvasIndex = 0;
  export let canvasCount = 0;
  export let manifestDraft = '';
  export let transitionSectionCollapsed = false;
  export let delayMs: number | undefined = undefined;
  export let section: 'all' | 'source' | 'audio-timing' = 'all';

  export let onManifestInput: ((event: Event) => void) | undefined;
  export let onReloadManifest: ((chapterCanvasIndex: number) => void) | undefined;
  export let onSelectCanvas: ((canvasIndex: number) => void) | undefined;
  export let onToggleTransition: (() => void) | undefined;
  export let onDelayChange: ((event: Event) => void) | undefined;
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
        {chapterExists ? 'Reload' : 'Load manifest'}
      </button>
    </div>
    {#if !chapterExists}
      <div class="chapter-overlay__hint">Load a manifest to start capturing chapters.</div>
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
      <div class="chapter-overlay__hint">
        Choose a canvas, then save the source to apply it to this chapter.
      </div>
    {/if}
  </section>
{/if}

{#if section === 'all' || section === 'audio-timing'}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-header">
      <div class="chapter-overlay__section-title">Advance timing</div>
      <button
        class="chapter-overlay__collapse-toggle"
        type="button"
        on:click={onToggleTransition}
        aria-expanded={!transitionSectionCollapsed}
        aria-label={transitionSectionCollapsed
          ? 'Expand transition section'
          : 'Collapse transition section'}
      >
        <span
          class="chapter-overlay__collapse-icon"
          class:chapter-overlay__collapse-icon--collapsed={transitionSectionCollapsed}
        >
          ▾
        </span>
      </button>
    </div>
    <div class="chapter-overlay__section-content" hidden={transitionSectionCollapsed}>
      <p class="chapter-overlay__hint">
        Set a delay in seconds to auto-play to the next chapter. Leave blank to stay manual.
      </p>
      <label class="chapter-overlay__label">
        Delay between chapters (seconds)
        <input
          class="chapter-overlay__input"
          type="number"
          min="0"
          step="0.5"
          data-testid="chapter-advance-delay"
          value={delayMs !== undefined ? (delayMs / 1000).toString() : ''}
          on:input={onDelayChange}
        />
      </label>
    </div>
  </section>
{/if}
