<script lang="ts">
  import { t } from '../../core/i18n';
  import LanguageTabs from '../../features/annotations/LanguageTabs.svelte';

  /*
   * The chapter's words: which language is being written, and the title and
   * description in it. Rendered bare, as the body of the inspector's Details
   * section — the section owns the card and its heading.
   */

  export let activeLanguage = 'en';
  export let languages: string[] = ['en'];
  export let chapterTitleDraft = '';
  export let chapterDescriptionDraft = '';

  export let onLanguageChange: ((lang: string) => void) | undefined = undefined;
  export let onChapterTitleInput: ((event: Event) => void) | undefined = undefined;
  export let onChapterDescriptionInput: ((event: Event) => void) | undefined = undefined;
</script>

<div class="chapter-text-form">
  <div class="chapter-overlay__field">
    <span class="chapter-overlay__section-title">{$t('storyBuilder.content.language')}</span>
    <LanguageTabs
      {languages}
      {activeLanguage}
      ariaLabel={$t('storyBuilder.content.language')}
      testIdPrefix="chapter-language"
      onchange={(lang) => onLanguageChange?.(lang)}
    />
  </div>

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

<style>
  .chapter-text-form {
    display: grid;
    gap: 10px;
  }
</style>
