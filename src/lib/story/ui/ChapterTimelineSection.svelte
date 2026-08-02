<script lang="ts">
  import { t } from '../../i18n';

  export let activeLanguage = "en";
  export let hasAvMedia = false;
  export let marksValid = true;
  export let markInDraft = "";
  export let markOutDraft = "";
  export let activeNarrationUrl = "";
  export let narrationSectionCollapsed = false;
  export let avSectionCollapsed = false;
  export let narrationPreviewing = false;
  export let narrationPreviewLanguage: string | null = null;
  export let narrationStartDraft = "";
  export let narrationEndDraft = "";
  export let currentNarrationAudioRef: HTMLAudioElement | null = null;
  export let parseHms: (value: string) => number | null;
  export let onToggleNarration: (() => void) | undefined;
  export let onNarrationTrackInput: ((event: Event) => void) | undefined;
  export let onNarrationTimeUpdate: (() => void) | undefined;
  export let onNarrationLoadedMetadata: (() => void) | undefined;
  export let onToggleNarrationPlayback: (() => void) | undefined;
  export let onNarrationStartInput: ((event: Event) => void) | undefined;
  export let onNarrationEndInput: ((event: Event) => void) | undefined;
  export let onMarkInInput: ((event: Event) => void) | undefined;
  export let onMarkOutInput: ((event: Event) => void) | undefined;
  export let onNarrationMarksCommit: (() => void) | undefined;
  export let onUseNarrationStartCurrent: (() => void) | undefined;
  export let onUseNarrationEndCurrent: (() => void) | undefined;
  export let onSkipNarration: (() => void) | undefined;
  export let onToggleAv: (() => void) | undefined;
  export let onCommitMediaMarks: (() => void) | undefined;
  export let onUseMarkInCurrent: (() => void) | undefined;
  export let onUseMarkOutCurrent: (() => void) | undefined;
  export let onPreviewMedia: (() => void) | undefined;
  export let onStopPreviewMedia: (() => void) | undefined;

  $: narrationPreviewLabel =
    narrationPreviewing && narrationPreviewLanguage === activeLanguage
      ? $t('storyBuilder.narration.stopPreview')
      : $t('storyBuilder.narration.preview');
</script>

{#if activeNarrationUrl}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-header">
      <div class="chapter-overlay__section-title">
        {$t('storyBuilder.narration.chapterTitle', { language: activeLanguage.toUpperCase() })}
      </div>
      <button
        class="chapter-overlay__collapse-toggle"
        type="button"
        on:click={onToggleNarration}
        aria-expanded={!narrationSectionCollapsed}
        aria-label={narrationSectionCollapsed
          ? $t('storyBuilder.narration.expand')
          : $t('storyBuilder.narration.collapse')}>▾</button
      >
    </div>
    <div
      class="chapter-overlay__section-content"
      hidden={narrationSectionCollapsed}
    >
      <div class="chapter-overlay__hint">
        {$t('storyBuilder.narration.footerHint')}
      </div>
      <label class="chapter-overlay__label"
        >{$t('storyBuilder.narration.storyAudioSource')}<input
          class="chapter-overlay__input"
          type="url"
          data-testid="chapter-narration-url"
          value={activeNarrationUrl}
          on:input={onNarrationTrackInput}
        /></label
      >
      <audio
        class="chapter-overlay__audio-source"
        src={activeNarrationUrl}
        preload="metadata"
        bind:this={currentNarrationAudioRef}
        on:timeupdate={onNarrationTimeUpdate}
        on:loadedmetadata={onNarrationLoadedMetadata}
      ></audio>
      <button
        class="chapter-overlay__button chapter-overlay__button--accent"
        type="button"
        data-testid="chapter-narration-preview"
        on:click={onToggleNarrationPlayback}
        disabled={parseHms(narrationStartDraft) === null ||
          parseHms(narrationEndDraft) === null ||
          parseHms(narrationEndDraft) <= parseHms(narrationStartDraft)}
        >{narrationPreviewLabel}</button
      >
      <div class="chapter-overlay__timegrid">
        <div class="chapter-overlay__timerow">
          <label class="chapter-overlay__label chapter-overlay__label--inline"
            >{$t('storyBuilder.chapter.start')}<input
              class="chapter-overlay__input chapter-overlay__input--time"
              type="text"
              data-testid="chapter-narration-start"
              value={narrationStartDraft}
              on:input={onNarrationStartInput}
              on:change={onNarrationMarksCommit}
              on:blur={onNarrationMarksCommit}
            /></label
          ><button
            class="chapter-overlay__button chapter-overlay__button--subtle"
            type="button"
            data-testid="chapter-narration-start-now"
            on:click={onUseNarrationStartCurrent}>{$t('storyBuilder.media.useCurrent')}</button
          >
        </div>
        <div class="chapter-overlay__timerow">
          <label class="chapter-overlay__label chapter-overlay__label--inline"
            >{$t('storyBuilder.chapter.end')}<input
              class="chapter-overlay__input chapter-overlay__input--time"
              type="text"
              data-testid="chapter-narration-end"
              value={narrationEndDraft}
              on:input={onNarrationEndInput}
              on:change={onNarrationMarksCommit}
              on:blur={onNarrationMarksCommit}
            /></label
          ><button
            class="chapter-overlay__button chapter-overlay__button--subtle"
            type="button"
            data-testid="chapter-narration-end-now"
            on:click={onUseNarrationEndCurrent}>{$t('storyBuilder.media.useCurrent')}</button
          >
        </div>
      </div>
      <button
        class="chapter-overlay__button chapter-overlay__button--subtle"
        type="button"
        data-testid="chapter-narration-skip"
        on:click={onSkipNarration}>{$t('storyBuilder.narration.skip')}</button
      >
    </div>
  </section>
{/if}

{#if hasAvMedia}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-header">
      <div class="chapter-overlay__section-title">{$t('storyBuilder.media.avPreview')}</div>
      <button
        class="chapter-overlay__collapse-toggle"
        type="button"
        on:click={onToggleAv}
        aria-expanded={!avSectionCollapsed}
        >{avSectionCollapsed ? "▸" : "▾"}</button
      >
    </div>
    <div class="chapter-overlay__section-content" hidden={avSectionCollapsed}>
      <div class="chapter-overlay__hint">
        {$t('storyBuilder.media.marksHint')}
      </div>
      <div class="chapter-overlay__timegrid">
        <div class="chapter-overlay__timerow">
          <label class="chapter-overlay__label chapter-overlay__label--inline"
            >{$t('storyBuilder.media.markIn')}<input
              class="chapter-overlay__input"
              type="text"
              data-testid="chapter-mark-in"
              value={markInDraft}
              on:input={onMarkInInput}
              on:change={onCommitMediaMarks}
              on:blur={onCommitMediaMarks}
            /></label
          ><button
            class="chapter-overlay__button chapter-overlay__button--subtle"
            type="button"
            data-testid="chapter-mark-in-btn"
            on:click={onUseMarkInCurrent}>{$t('storyBuilder.media.useCurrent')}</button
          >
        </div>
        <div class="chapter-overlay__timerow">
          <label class="chapter-overlay__label chapter-overlay__label--inline"
            >{$t('storyBuilder.media.markOut')}<input
              class="chapter-overlay__input"
              type="text"
              data-testid="chapter-mark-out"
              value={markOutDraft}
              on:input={onMarkOutInput}
              on:change={onCommitMediaMarks}
              on:blur={onCommitMediaMarks}
            /></label
          ><button
            class="chapter-overlay__button chapter-overlay__button--subtle"
            type="button"
            data-testid="chapter-mark-out-btn"
            on:click={onUseMarkOutCurrent}>{$t('storyBuilder.media.useCurrent')}</button
          >
        </div>
      </div>
      {#if !marksValid}<div
          class="chapter-overlay__hint"
          data-testid="chapter-av-hint"
        >
          {$t('storyBuilder.chapter.markHint')}
        </div>{/if}
      <div class="chapter-overlay__row chapter-overlay__row--tight">
        <button
          class="chapter-overlay__button chapter-overlay__button--accent"
          type="button"
          data-testid="chapter-media-preview"
          on:click={onPreviewMedia}>{$t('storyBuilder.chapter.preview')}</button
        ><button
          class="chapter-overlay__button chapter-overlay__button--subtle"
          type="button"
          data-testid="chapter-media-stop"
          on:click={onStopPreviewMedia}>{$t('storyBuilder.media.stop')}</button
        >
      </div>
    </div>
  </section>
{/if}
