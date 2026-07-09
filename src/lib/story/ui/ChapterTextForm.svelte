<script lang="ts">
  export let activeLanguage = 'en';
  export let languages: string[] = ['en'];
  export let metadataSectionCollapsed = false;
  export let annotationSectionCollapsed = false;
  export let chapterTitleDraft = '';
  export let chapterDescriptionDraft = '';
  export let annotationDraft = '';
  export let hasChapter = false;

  export let onLanguageChange: ((lang: string) => void) | undefined = undefined;
  export let onToggleMetadata: (() => void) | undefined = undefined;
  export let onToggleAnnotation: (() => void) | undefined = undefined;
  export let onChapterTitleInput: ((event: Event) => void) | undefined = undefined;
  export let onChapterDescriptionInput: ((event: Event) => void) | undefined = undefined;
  export let onAnnotationInput: ((event: Event) => void) | undefined = undefined;
  export let onSetPositionClick: (() => void) | undefined = undefined;
</script>

<section class="chapter-overlay__section chapter-overlay__section--card">
  <div class="chapter-overlay__section-title">Language</div>
  <select
    class="chapter-overlay__select"
    data-testid="chapter-language"
    value={activeLanguage}
    on:change={(event) => {
      const target = event.currentTarget as HTMLSelectElement;
      onLanguageChange?.(target.value);
    }}
  >
    {#each languages as lang}
      <option value={lang}>{lang.toUpperCase()}</option>
    {/each}
  </select>
</section>

<section class="chapter-overlay__section chapter-overlay__section--card">
  <div class="chapter-overlay__section-header">
    <div class="chapter-overlay__section-title">Metadata ({activeLanguage.toUpperCase()})</div>
    <button
      class="chapter-overlay__collapse-toggle"
      type="button"
      on:click={onToggleMetadata}
      aria-expanded={!metadataSectionCollapsed}
      aria-label={metadataSectionCollapsed ? 'Expand metadata section' : 'Collapse metadata section'}
    >
      <span
        class="chapter-overlay__collapse-icon"
        class:chapter-overlay__collapse-icon--collapsed={metadataSectionCollapsed}
      >
        ▾
      </span>
    </button>
  </div>

  <div class="chapter-overlay__section-content" hidden={metadataSectionCollapsed}>
    <label class="chapter-overlay__label">
      Title
      <input
        class="chapter-overlay__input"
        type="text"
        data-testid="chapter-title"
        value={chapterTitleDraft}
        on:input={onChapterTitleInput}
      />
    </label>

    <label class="chapter-overlay__label">
      Description
      <textarea
        class="chapter-overlay__textarea"
        rows="3"
        data-testid="chapter-description"
        value={chapterDescriptionDraft}
        on:input={onChapterDescriptionInput}
      ></textarea>
    </label>
  </div>
</section>

<section class="chapter-overlay__section chapter-overlay__section--card">
  <div class="chapter-overlay__section-header">
    <div class="chapter-overlay__section-title">Annotation ({activeLanguage.toUpperCase()})</div>
    <button
      class="chapter-overlay__collapse-toggle"
      type="button"
      on:click={onToggleAnnotation}
      aria-expanded={!annotationSectionCollapsed}
      aria-label={annotationSectionCollapsed ? 'Expand annotation section' : 'Collapse annotation section'}
    >
      <span
        class="chapter-overlay__collapse-icon"
        class:chapter-overlay__collapse-icon--collapsed={annotationSectionCollapsed}
      >
        ▾
      </span>
    </button>
  </div>

  <div class="chapter-overlay__section-content" hidden={annotationSectionCollapsed}>
    <textarea
      class="chapter-overlay__textarea"
      data-testid="chapter-annotation"
      rows="4"
      value={annotationDraft}
      on:input={onAnnotationInput}
      placeholder="Add annotation text"
    ></textarea>

    {#if hasChapter}
      <button
        class="chapter-overlay__button chapter-overlay__button--accent"
        style="margin-top: 12px; width: 100%;"
        type="button"
        data-testid="set-annotation-position"
        on:click={onSetPositionClick}
      >
        Set Annotation Position on Screen
      </button>
    {:else}
      <div class="chapter-overlay__hint">Capture a chapter to edit annotation text and placement.</div>
    {/if}
  </div>
</section>
