<script lang="ts">
  import { Check, Link2, Volume2 } from '@lucide/svelte';
  import type { Readable } from 'svelte/store';
  import type { StoryState } from '../../core/types/story';
  import { deriveChapterAnnotationBase, validatePublicIdentifier } from '../publicIdentifiers';

  export let story: Readable<StoryState>;
  export let open = false;
  export let docked = false;
  export let language = 'en';
  export let languages: string[] = ['en'];
  export let onBack: (() => void) | undefined;
  export let onClose: (() => void) | undefined;
  export let onSetNarrationTrack: ((lang: string, src: string) => void) | undefined;
  export let onUpdateStoryTitle: ((lang: string, value: string) => void) | undefined;
  export let onUpdateStoryIdentifiers:
    ((id: string, annotationBase: string) => void) | undefined;

  let activeLanguage = language;
  let lastLanguageProp = language;
  let url = '';
  let title = '';
  let lastTrackSyncKey = '';
  let lastTitleSyncKey = '';
  let storyId = '';
  let annotationBase = '';
  let lastIdentifierSyncKey = '';

  const getTrackSrc = (value: StoryState, lang: string): string => {
    return value.narration?.tracks?.[lang]?.src ?? '';
  };

  $: if (language !== lastLanguageProp) {
    lastLanguageProp = language;
    activeLanguage = language;
  }

  $: {
    const trackSrc = getTrackSrc($story, activeLanguage);
    const trackSyncKey = `${open ? '1' : '0'}:${activeLanguage}:${trackSrc}`;
    if (trackSyncKey !== lastTrackSyncKey) {
      lastTrackSyncKey = trackSyncKey;
      url = trackSrc;
    }
  }

  $: {
    const nextStoryId = $story.id ?? '';
    const nextBase = $story.publication?.annotationBase ?? deriveChapterAnnotationBase($story) ?? '';
    const key = `${open ? '1' : '0'}:${nextStoryId}:${nextBase}`;
    if (key !== lastIdentifierSyncKey) {
      lastIdentifierSyncKey = key;
      storyId = nextStoryId;
      annotationBase = nextBase;
    }
  }

  $: identifiersLocked = Boolean($story.publication?.identifiersLocked);
  $: storyIdErrors = storyId.trim() ? validatePublicIdentifier(storyId, 'Story ID') : [];
  $: annotationBaseErrors = annotationBase.trim()
    ? validatePublicIdentifier(annotationBase, 'Chapter Annotation base')
    : [];
  $: changingPublishedBase =
    $story.publication?.status === 'published' &&
    Boolean($story.publication.annotationBase) &&
    annotationBase.trim() !== $story.publication.annotationBase;

  const saveIdentifiers = () => {
    if (identifiersLocked || storyIdErrors.length || annotationBaseErrors.length) return;
    onUpdateStoryIdentifiers?.(storyId, annotationBase);
  };

  $: {
    const titleValue = $story.title?.[activeLanguage] ?? '';
    const titleSyncKey = `${open ? '1' : '0'}:${activeLanguage}:${titleValue}`;
    if (titleSyncKey !== lastTitleSyncKey) {
      lastTitleSyncKey = titleSyncKey;
      title = titleValue;
    }
  }

  const handleInput = (event: Event) => {
    url = (event.target as HTMLInputElement).value;
  };

  const handleTitleInput = (event: Event) => {
    title = (event.target as HTMLInputElement).value;
    onUpdateStoryTitle?.(activeLanguage, title);
  };

  const handleSaveUrl = () => {
    onSetNarrationTrack?.(activeLanguage, url);
  };
</script>

<svelte:window
  on:keydown={(event) => {
    if (open && event.key === 'Escape') {
      onClose?.();
    }
  }}
/>

<div
  class="narration-panel"
  class:narration-panel--docked={docked}
  data-testid="narration-overlay"
  aria-hidden={!open}
  hidden={!open}
>
  <div
    class="narration-panel__panel"
    role={docked ? 'region' : 'dialog'}
    aria-modal="false"
    aria-labelledby="narration-overlay-title"
  >
    <div class="narration-overlay__header">
      {#if !docked}
        <button
          class="narration-overlay__back"
          type="button"
          data-testid="narration-back"
          on:click={() => onBack?.()}
        >
          Back
        </button>
      {/if}
      <div>
        <div class="narration-overlay__title" id="narration-overlay-title">Story settings</div>
        <div class="narration-overlay__subtitle">Set the story title and narration audio</div>
      </div>
      <button
        class="narration-overlay__close"
        type="button"
        aria-label="Close story settings"
        data-testid="narration-close"
        on:click={() => onClose?.()}
      >
        ×
      </button>
    </div>

    <div class="narration-overlay__form">
      <section class="narration-overlay__section">
        <div class="narration-overlay__section-title">Language</div>
        <div
          class="narration-overlay__language-tabs"
          role="tablist"
          aria-label="Narration language"
        >
          {#each languages as lang}
            <button
              class="narration-overlay__language-tab"
              class:narration-overlay__language-tab--active={lang === activeLanguage}
              type="button"
              role="tab"
              aria-selected={lang === activeLanguage}
              data-testid={lang === activeLanguage ? 'narration-language' : undefined}
              on:click={() => (activeLanguage = lang)}
            >
              {lang.toUpperCase()}
            </button>
          {/each}
        </div>
      </section>

      <section class="narration-overlay__section narration-overlay__section--card">
        <div class="narration-overlay__source-heading">
          <span class="narration-overlay__source-icon narration-overlay__source-icon--title">T</span
          >
          <span>
            <strong>Story title ({activeLanguage.toUpperCase()})</strong>
            <small>Shown in the story viewer top bar</small>
          </span>
        </div>

        <label class="narration-overlay__label" for="story-title">
          Title
          <input
            id="story-title"
            class="narration-overlay__input narration-overlay__input--standalone"
            type="text"
            data-testid="story-title"
            value={title}
            on:input={handleTitleInput}
            placeholder="Untitled story"
          />
        </label>
        <p class="narration-overlay__hint">
          Saved as the {activeLanguage.toUpperCase()} value in the AnnotationPage label.
        </p>
      </section>

      <section class="narration-overlay__section narration-overlay__section--card">
        <div class="narration-overlay__source-heading">
          <span class="narration-overlay__source-icon"><Link2 aria-hidden="true" /></span>
          <span>
            <strong>Publishing identifiers</strong>
            <small>Stable public IDs for the story and its chapters</small>
          </span>
        </div>
        <label class="narration-overlay__label">
          AnnotationPage ID
          <input
            class="narration-overlay__input narration-overlay__input--standalone"
            type="url"
            data-testid="story-public-id"
            bind:value={storyId}
            disabled={identifiersLocked}
            placeholder="https://museum.example/stories/my-story"
          />
        </label>
        <label class="narration-overlay__label">
          Chapter Annotation base
          <input
            class="narration-overlay__input narration-overlay__input--standalone"
            type="url"
            data-testid="story-annotation-base"
            bind:value={annotationBase}
            disabled={identifiersLocked}
            placeholder="Derived from the AnnotationPage ID"
          />
        </label>
        {#if identifiersLocked}
          <p class="narration-overlay__hint">These identifiers are managed by the publishing host.</p>
        {:else if changingPublishedBase}
          <p class="narration-overlay__warning" role="alert">
            Changing this base will change the public IDs of previously published chapter Annotations.
          </p>
        {/if}
        {#if storyIdErrors.length || annotationBaseErrors.length}
          <ul class="narration-overlay__warning" role="alert">
            {#each [...storyIdErrors, ...annotationBaseErrors] as error}<li>{error}</li>{/each}
          </ul>
        {/if}
        <button
          class="narration-overlay__button narration-overlay__button--accent"
          type="button"
          data-testid="story-save-identifiers"
          disabled={identifiersLocked || storyIdErrors.length > 0 || annotationBaseErrors.length > 0}
          on:click={saveIdentifiers}
        >
          <Check aria-hidden="true" /> Save publishing identifiers
        </button>
      </section>

      <section class="narration-overlay__section narration-overlay__section--card">
        <div class="narration-overlay__source-heading">
          <span class="narration-overlay__source-icon"><Volume2 aria-hidden="true" /></span>
          <span>
            <strong>{activeLanguage.toUpperCase()} audio source</strong>
            <small>Used by every narrated chapter in this language</small>
          </span>
        </div>

        <label class="narration-overlay__label" for="narration-audio-url">
          Audio file URL
          <span class="narration-overlay__input-shell">
            <Link2 aria-hidden="true" />
            <input
              id="narration-audio-url"
              class="narration-overlay__input"
              type="url"
              data-testid="narration-url"
              value={url}
              on:input={handleInput}
              placeholder="https://example.org/audio.mp3"
            />
          </span>
        </label>

        <div class="narration-overlay__preview">
          <div class="narration-overlay__preview-label">Audio preview</div>
          <div class="narration-overlay__player-shell">
            <audio class="narration-overlay__player" controls preload="metadata" src={url}></audio>
          </div>
          {#if !url}
            <p class="narration-overlay__hint">Enter a URL to preview the narration track.</p>
          {/if}
        </div>

        <div class="narration-overlay__row">
          <button
            class="narration-overlay__button narration-overlay__button--accent"
            type="button"
            data-testid="narration-assign"
            disabled={!url.trim()}
            on:click={handleSaveUrl}
          >
            <Check aria-hidden="true" />
            Save audio source
          </button>
        </div>
      </section>
    </div>
  </div>
</div>

<style>
  .narration-panel {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: flex-end;
    pointer-events: none;
    z-index: 12;
  }

  .narration-panel[hidden] {
    display: none;
  }

  .narration-panel--docked {
    position: relative;
    inset: auto;
    display: block;
    height: 100%;
    pointer-events: auto;
  }

  .narration-panel--docked .narration-panel__panel {
    width: 100%;
    max-width: none;
    border-left: 0;
    background: var(--viewer-panel, #121922);
  }

  .narration-panel--docked .narration-overlay__header {
    grid-template-columns: 1fr auto;
  }

  .narration-panel__panel {
    position: relative;
    pointer-events: auto;
    width: clamp(360px, 42cqw, 500px);
    max-width: 92cqw;
    height: 100%;
    min-height: 100%;
    align-self: stretch;
    border-radius: 0;
    border-left: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    background: var(--viewer-panel, #121922);
    color: var(--viewer-text, #e8edf4);
    box-shadow: none;
    overflow: auto;
    box-sizing: border-box;
  }

  .narration-overlay__header {
    position: sticky;
    top: 0;
    z-index: 3;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    min-height: 72px;
    padding: 16px 18px;
    background: var(--viewer-panel, #121922);
    border-bottom: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }

  .narration-overlay__title {
    font-size: 18px;
    font-weight: 650;
    color: var(--viewer-text, #e8edf4);
    letter-spacing: 0.01em;
  }

  .narration-overlay__subtitle {
    margin-top: 3px;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 12px;
    line-height: 1.35;
  }

  .narration-overlay__back {
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    padding: 8px 10px;
    background: var(--viewer-panel-strong, #1b242e);
    color: var(--viewer-text, #e8edf4);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }

  .narration-overlay__close {
    width: var(--viewer-close-button-size, 28px);
    height: var(--viewer-close-button-size, 28px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--viewer-close-button-border, rgba(255, 255, 255, 0.18));
    border-radius: var(--viewer-close-button-radius, 10px);
    background: var(--viewer-close-button-bg, rgba(255, 255, 255, 0.1));
    color: var(--viewer-close-button-color, rgba(232, 237, 246, 0.9));
    font-size: var(--viewer-close-button-glyph-size, 15px);
    line-height: 1;
    text-transform: none;
    letter-spacing: 0;
    padding: 0;
    cursor: pointer;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      transform 0.08s ease;
  }

  .narration-overlay__close:hover:not(:disabled) {
    background: var(--viewer-close-button-hover-bg, rgba(255, 255, 255, 0.16));
    border-color: var(--viewer-close-button-hover-border, rgba(255, 255, 255, 0.34));
  }

  .narration-overlay__close:focus-visible {
    outline: 2px solid var(--viewer-close-button-focus-ring, rgba(42, 199, 255, 0.55));
    outline-offset: 2px;
  }

  .narration-overlay__close:active:not(:disabled) {
    transform: translateY(1px);
  }

  .narration-overlay__label {
    display: grid;
    gap: 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--viewer-muted, #9aa6b2);
  }

  .narration-overlay__input-shell {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 44px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    padding: 0 12px;
    background: var(--viewer-panel, #121922);
  }

  .narration-overlay__input-shell:focus-within {
    border-color: var(--accent, var(--story-builder-accent, #e07a3f));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 18%, transparent);
  }

  .narration-overlay__input-shell :global(svg) {
    width: 16px;
    height: 16px;
    color: var(--viewer-muted, #9aa6b2);
  }

  .narration-overlay__input {
    width: 100%;
    min-width: 0;
    border: 0;
    padding: 11px 0;
    background: transparent;
    color: var(--viewer-text, #e8edf4);
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
  }

  .narration-overlay__input--standalone {
    min-height: 44px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    padding: 10px 12px;
    background: var(--viewer-panel, #121922);
  }

  .narration-overlay__input--standalone:focus {
    border-color: var(--accent, var(--story-builder-accent, #e07a3f));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 18%, transparent);
  }

  .narration-overlay__input::placeholder {
    color: color-mix(in srgb, var(--viewer-muted, #9aa6b2) 45%, transparent);
  }

  .narration-overlay__input:disabled {
    opacity: 0.56;
    cursor: not-allowed;
  }

  .narration-overlay__warning {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid color-mix(in srgb, var(--story-builder-accent, #e07a3f) 45%, transparent);
    border-radius: 9px;
    background: color-mix(in srgb, var(--story-builder-accent, #e07a3f) 10%, transparent);
    color: var(--story-builder-accent-hover, #ffd2b2);
    font-size: 12px;
    line-height: 1.4;
  }

  .narration-overlay__player-shell {
    display: flex;
    align-items: center;
    min-height: 72px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    background: var(--viewer-panel, #121922);
    padding: 12px;
  }

  .narration-overlay__player {
    width: 100%;
    min-height: 48px;
    color: var(--viewer-text, #e8edf4);
    accent-color: var(--accent, var(--story-builder-accent, #e07a3f));
  }

  .narration-overlay__player::-webkit-media-controls-enclosure,
  .narration-overlay__player::-webkit-media-controls-panel {
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 14%, transparent);
    color: color-mix(in srgb, var(--viewer-text, #e8edf4) 72%, transparent);
    text-shadow: none;
  }

  .narration-overlay__player::-webkit-media-controls-current-time-display,
  .narration-overlay__player::-webkit-media-controls-time-remaining-display {
    color: color-mix(in srgb, var(--viewer-text, #e8edf4) 72%, transparent);
    -webkit-text-fill-color: color-mix(in srgb, var(--viewer-text, #e8edf4) 72%, transparent);
    text-shadow: none;
    filter: none;
  }

  .narration-overlay__player::-webkit-media-controls-play-button,
  .narration-overlay__player::-webkit-media-controls-mute-button,
  .narration-overlay__player::-webkit-media-controls-fullscreen-button,
  .narration-overlay__player::-webkit-media-controls-timeline,
  .narration-overlay__player::-webkit-media-controls-volume-slider {
    filter: brightness(0) saturate(100%) invert(92%) sepia(8%) saturate(356%) hue-rotate(184deg)
      brightness(98%) contrast(93%);
  }

  .narration-overlay__row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .narration-overlay__button {
    min-height: 42px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-radius: 11px;
    padding: 8px 12px;
    background: var(--viewer-panel-strong, #1b242e);
    color: var(--viewer-text, #e8edf4);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition:
      background 0.16s ease,
      border-color 0.16s ease;
    white-space: nowrap;
  }

  .narration-overlay__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .narration-overlay__button--accent {
    width: 100%;
    background: var(--accent, var(--story-builder-accent, #e07a3f));
    border-color: transparent;
    color: #fff;
  }

  .narration-overlay__button:not(:disabled):hover {
    background: color-mix(in srgb, var(--viewer-panel-strong, #1b242e) 82%, white);
  }

  .narration-overlay__button--accent:not(:disabled):hover {
    /*
     * Darken on hover rather than lighten. These fills carry white labels, so
     * mixing toward white pushed the label under 4.5:1 exactly when the
     * pointer was on it; mixing toward black raises it instead.
     */
    background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 86%, black);
  }

  .narration-overlay__form {
    display: grid;
    gap: 22px;
    padding: 20px 18px 28px;
  }

  .narration-overlay__section {
    display: grid;
    gap: 12px;
  }

  .narration-overlay__section--card {
    padding: 18px;
    border-radius: 12px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    background: var(--viewer-surface, #151d26);
    gap: 18px;
  }

  .narration-overlay__section-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--viewer-muted, #9aa6b2);
    font-weight: 700;
  }

  .narration-overlay__language-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .narration-overlay__language-tab {
    min-width: 54px;
    min-height: 38px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-radius: 9px;
    padding: 8px 13px;
    background: var(--viewer-panel-strong, #1b242e);
    color: var(--viewer-muted, #9aa6b2);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .narration-overlay__language-tab--active {
    border-color: var(--accent, var(--story-builder-accent, #e07a3f));
    background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 16%, transparent);
    color: var(--viewer-text, #e8edf4);
  }

  .narration-overlay__source-heading {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px;
  }

  .narration-overlay__source-heading strong,
  .narration-overlay__source-heading small {
    display: block;
  }

  .narration-overlay__source-heading strong {
    color: var(--viewer-text, #e8edf4);
    font-size: 14px;
  }

  .narration-overlay__source-heading small {
    margin-top: 3px;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 12px;
    line-height: 1.4;
  }

  .narration-overlay__source-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: var(--viewer-panel-strong, #1b242e);
    color: var(--accent, var(--story-builder-accent, #e07a3f));
  }

  .narration-overlay__source-icon :global(svg) {
    width: 19px;
    height: 19px;
  }

  .narration-overlay__source-icon--title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 20px;
    font-weight: 700;
  }

  .narration-overlay__preview {
    display: grid;
    gap: 8px;
  }

  .narration-overlay__preview-label {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .narration-overlay__hint {
    margin: 0;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 12px;
    line-height: 1.45;
  }

  .narration-overlay__button :global(svg) {
    width: 16px;
    height: 16px;
  }

  @media (max-width: 860px) {
    .narration-panel__panel {
      width: 100%;
      max-width: 100%;
      border-radius: 0;
    }
  }
</style>
