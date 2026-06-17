<script lang="ts">
  export let chapterExists = false;
  export let chapterCanvasIndex = 0;
  export let manifestDraft = '';
  export let transitionSectionCollapsed = false;
  export let delayMs: number | undefined = undefined;

  export let onManifestInput: ((event: Event) => void) | undefined;
  export let onReloadManifest: ((chapterCanvasIndex: number) => void) | undefined;
  export let onToggleTransition: (() => void) | undefined;
  export let onDelayChange: ((event: Event) => void) | undefined;
</script>

<section class="chapter-overlay__section chapter-overlay__section--card">
  <div class="chapter-overlay__section-title">Manifest URL</div>
  <div class="chapter-overlay__row">
    <input
      class="chapter-overlay__input"
      type="url"
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
      disabled={!chapterExists}
    >
      Reload
    </button>
  </div>
  {#if !chapterExists}
    <div class="chapter-overlay__hint">Load a manifest to start capturing chapters.</div>
  {/if}
</section>

<section class="chapter-overlay__section chapter-overlay__section--card">
  <div class="chapter-overlay__section-header">
    <div class="chapter-overlay__section-title">Transition Time</div>
    <button
      class="chapter-overlay__collapse-toggle"
      type="button"
      on:click={onToggleTransition}
      aria-expanded={!transitionSectionCollapsed}
      aria-label={transitionSectionCollapsed ? 'Expand transition section' : 'Collapse transition section'}
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
