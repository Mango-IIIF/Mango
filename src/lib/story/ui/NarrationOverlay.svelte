<script lang="ts">
  import type { Readable } from 'svelte/store';
  import type { StoryState } from '../../core/types/story';

  export let story: Readable<StoryState>;
  export let open = false;
  export let language = 'en';
  export let languages: string[] = ['en'];
  export let onBack: (() => void) | undefined;
  export let onClose: (() => void) | undefined;
  export let onSetNarrationTrack:
    | ((lang: string, src: string) => void)
    | undefined;

  let activeLanguage = language;
  let lastLanguageProp = language;
  let url = '';
  
  const getTrackSrc = (value: StoryState, lang: string): string => {
    return value.narration?.tracks?.[lang]?.src ?? '';
  };

  $: if (language !== lastLanguageProp) {
    lastLanguageProp = language;
    activeLanguage = language;
  }

  $: url = getTrackSrc($story, activeLanguage);

  const handleInput = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    onSetNarrationTrack?.(activeLanguage, value);
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
  data-testid="narration-overlay"
  aria-hidden={!open}
  hidden={!open}
>
  <div class="narration-panel__panel" role="dialog" aria-modal="false">
    <div class="narration-overlay__header">
      <button
        class="narration-overlay__back"
        type="button"
        data-testid="narration-back"
        on:click={() => onBack?.()}
      >
        Back
      </button>
      <div>
        <div class="narration-overlay__eyebrow">Story Editor</div>
        <div class="narration-overlay__title">Audio Narration</div>
      </div>
      <button
        class="narration-overlay__close"
        type="button"
        aria-label="Close narration"
        data-testid="narration-close"
        on:click={() => onClose?.()}
      >
        ×
      </button>
    </div>

    <div class="narration-overlay__form">
      <section class="narration-overlay__section narration-overlay__section--card">
        <div class="narration-overlay__section-title">Language</div>
        <label class="narration-overlay__label">
          <select
            class="narration-overlay__select"
            data-testid="narration-language"
            bind:value={activeLanguage}
          >
            {#each languages as lang}
              <option value={lang}>{lang.toUpperCase()}</option>
            {/each}
          </select>
        </label>
      </section>

      <section class="narration-overlay__section narration-overlay__section--card">
        <div class="narration-overlay__section-title">
          Narration Source ({activeLanguage.toUpperCase()})
        </div>
        <label class="narration-overlay__label">
          MP3 URL
          <input
            class="narration-overlay__input"
            type="url"
            data-testid="narration-url"
            value={url}
            on:input={handleInput}
            placeholder="https://example.org/audio.mp3"
          />
        </label>

        <div class="narration-overlay__player-shell">
          <audio
            class="narration-overlay__player"
            controls
            src={url}
          ></audio>
        </div>

        <div class="narration-overlay__row">
          <button
            class="narration-overlay__button narration-overlay__button--accent"
            type="button"
            data-testid="narration-assign"
            on:click={handleSaveUrl}
          >
            Save narration audio
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

  .narration-panel__panel {
    position: relative;
    pointer-events: auto;
    width: clamp(360px, 42vw, 500px);
    max-width: 92vw;
    height: 100%;
    min-height: 100%;
    align-self: stretch;
    border-radius: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.14);
    background: #071428;
    color: #eaf1ff;
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
    padding: 16px 18px;
    background: #08182d;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .narration-overlay__eyebrow {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.62);
  }

  .narration-overlay__title {
    font-size: 18px;
    font-weight: 600;
    color: #f3f8ff;
    letter-spacing: 0.01em;
  }

  .narration-overlay__back {
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 10px;
    padding: 8px 10px;
    background: #0b1b31;
    color: rgba(232, 237, 246, 0.9);
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
    color: rgba(222, 229, 239, 0.72);
  }

  .narration-overlay__input,
  .narration-overlay__select {
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    padding: 10px 12px;
    background: #08192f;
    color: #f0f6ff;
    font-size: 13px;
    outline: none;
  }

  .narration-overlay__input::placeholder {
    color: rgba(213, 221, 234, 0.45);
  }

  .narration-overlay__input:focus,
  .narration-overlay__select:focus {
    border-color: rgba(255, 255, 255, 0.34);
    box-shadow: none;
  }

  .narration-overlay__input:disabled,
  .narration-overlay__select:disabled {
    opacity: 0.56;
    cursor: not-allowed;
  }

  .narration-overlay__player-shell {
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    background: #08192f;
    padding: 8px;
  }

  .narration-overlay__player {
    width: 100%;
    min-height: 40px;
    color: rgba(230, 236, 246, 0.72);
    accent-color: rgba(230, 236, 246, 0.72);
  }

  .narration-overlay__player::-webkit-media-controls-enclosure,
  .narration-overlay__player::-webkit-media-controls-panel {
    background: rgba(230, 236, 246, 0.14);
    color: rgba(230, 236, 246, 0.72);
    text-shadow: none;
  }

  .narration-overlay__player::-webkit-media-controls-current-time-display,
  .narration-overlay__player::-webkit-media-controls-time-remaining-display {
    color: rgba(230, 236, 246, 0.72);
    -webkit-text-fill-color: rgba(230, 236, 246, 0.72);
    text-shadow: none;
    filter: none;
  }

  .narration-overlay__player::-webkit-media-controls-play-button,
  .narration-overlay__player::-webkit-media-controls-mute-button,
  .narration-overlay__player::-webkit-media-controls-fullscreen-button,
  .narration-overlay__player::-webkit-media-controls-timeline,
  .narration-overlay__player::-webkit-media-controls-volume-slider {
    filter: brightness(0) saturate(100%) invert(92%) sepia(8%) saturate(356%)
      hue-rotate(184deg) brightness(98%) contrast(93%);
  }

  .narration-overlay__row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .narration-overlay__button {
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 11px;
    padding: 8px 12px;
    background: #102039;
    color: #e8edf6;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: background 0.16s ease, border-color 0.16s ease;
    white-space: nowrap;
  }

  .narration-overlay__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .narration-overlay__button--accent {
    background: #1d395c;
    border-color: rgba(255, 255, 255, 0.2);
    color: #fafdff;
  }

  .narration-overlay__button:not(:disabled):hover {
    background: #173053;
    border-color: rgba(255, 255, 255, 0.28);
  }

  .narration-overlay__button--accent:not(:disabled):hover {
    background: #274974;
  }

  .narration-overlay__form {
    display: grid;
    gap: 14px;
    padding: 14px 18px 22px;
  }

  .narration-overlay__section {
    display: grid;
    gap: 10px;
  }

  .narration-overlay__section--card {
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: #0a1a2f;
  }

  .narration-overlay__section-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: rgba(230, 236, 246, 0.72);
  }

  @media (max-width: 860px) {
    .narration-panel__panel {
      width: 100%;
      max-width: 100%;
      border-radius: 0;
    }
  }
</style>
