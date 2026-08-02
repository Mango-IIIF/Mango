<script lang="ts">
  import { t } from '../../i18n';

  export let activeLanguage = 'en';
  export let languages: string[] = ['en'];
  export let metadataSectionCollapsed = false;
  export let annotationSectionCollapsed = false;
  export let chapterTitleDraft = '';
  export let chapterDescriptionDraft = '';
  export let annotationDraft = '';
  export let hasChapter = false;
  export let section: 'all' | 'details' | 'focus' = 'all';

  export let onLanguageChange: ((lang: string) => void) | undefined = undefined;
  export let onToggleMetadata: (() => void) | undefined = undefined;
  export let onToggleAnnotation: (() => void) | undefined = undefined;
  export let onChapterTitleInput: ((event: Event) => void) | undefined = undefined;
  export let onChapterDescriptionInput: ((event: Event) => void) | undefined = undefined;
  export let onAnnotationInput: ((event: Event) => void) | undefined = undefined;
  export let onSetPositionClick: (() => void) | undefined = undefined;
</script>

{#if section === 'all' || section === 'details' || section === 'focus'}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-title">{$t('storyBuilder.content.language')}</div>
    <div class="chapter-overlay__language-tabs" role="tablist" aria-label={$t('storyBuilder.content.language')}>
      {#each languages as lang}
        <button
          class="chapter-overlay__language-tab"
          class:chapter-overlay__language-tab--active={lang === activeLanguage}
          type="button"
          role="tab"
          aria-selected={lang === activeLanguage}
          data-testid="chapter-language-{lang}"
          on:click={() => onLanguageChange?.(lang)}
        >
          {lang.toUpperCase()}
        </button>
      {/each}
    </div>
  </section>
{/if}

{#if section === 'all' || section === 'details'}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-header">
      <div class="chapter-overlay__section-title">
        {$t('storyBuilder.content.title', { language: activeLanguage.toUpperCase() })}
      </div>
      <button
        class="chapter-overlay__collapse-toggle"
        type="button"
        on:click={onToggleMetadata}
        aria-expanded={!metadataSectionCollapsed}
        aria-label={metadataSectionCollapsed
          ? $t('storyBuilder.content.expandMetadata')
          : $t('storyBuilder.content.collapseMetadata')}
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
        {$t('storyBuilder.content.titleLabel')}
        <input
          class="chapter-overlay__input"
          type="text"
          data-testid="chapter-title"
          value={chapterTitleDraft}
          on:input={onChapterTitleInput}
        />
      </label>

      <label class="chapter-overlay__label">
        {$t('storyBuilder.content.descriptionLabel')}
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
{/if}

{#if section === 'all' || section === 'focus'}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-header">
      <div class="chapter-overlay__section-title">
        {$t('storyBuilder.content.textBox', { language: activeLanguage.toUpperCase() })}
      </div>
      <button
        class="chapter-overlay__collapse-toggle"
        type="button"
        on:click={onToggleAnnotation}
        aria-expanded={!annotationSectionCollapsed}
        aria-label={annotationSectionCollapsed
          ? $t('storyBuilder.content.expandAnnotation')
          : $t('storyBuilder.content.collapseAnnotation')}
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
      <p class="chapter-overlay__hint">
        {$t('storyBuilder.content.textBoxHint')}
      </p>
      <textarea
        class="chapter-overlay__textarea"
        data-testid="chapter-annotation"
        rows="4"
        value={annotationDraft}
        on:input={onAnnotationInput}
        placeholder={$t('storyBuilder.content.textPlaceholder')}
      ></textarea>

      {#if hasChapter}
        <button
          class="chapter-overlay__button chapter-overlay__button--accent"
          style="margin-top: 12px; width: 100%;"
          type="button"
          data-testid="set-annotation-position"
          disabled={!annotationDraft.trim()}
          on:click={onSetPositionClick}
        >
          {$t('storyBuilder.content.placeText')}
        </button>
      {:else}
        <div class="chapter-overlay__hint">
          {$t('storyBuilder.content.captureHint')}
        </div>
      {/if}
    </div>
  </section>
{/if}
