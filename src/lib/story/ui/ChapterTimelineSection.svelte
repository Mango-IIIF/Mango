<script lang="ts">
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
      ? "Stop preview"
      : "Preview narration";
</script>

{#if activeNarrationUrl}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-header">
      <div class="chapter-overlay__section-title">
        Chapter narration ({activeLanguage.toUpperCase()})
      </div>
      <button
        class="chapter-overlay__collapse-toggle"
        type="button"
        on:click={onToggleNarration}
        aria-expanded={!narrationSectionCollapsed}
        aria-label={narrationSectionCollapsed
          ? "Expand audio narration section"
          : "Collapse audio narration section"}>▾</button
      >
    </div>
    <div
      class="chapter-overlay__section-content"
      hidden={narrationSectionCollapsed}
    >
      <div class="chapter-overlay__hint">
        Use the WaveSurfer editor in the story-builder footer to adjust this
        range.
      </div>
      <label class="chapter-overlay__label"
        >Story audio source<input
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
            >Start (HH:MM:SS)<input
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
            on:click={onUseNarrationStartCurrent}>Use current</button
          >
        </div>
        <div class="chapter-overlay__timerow">
          <label class="chapter-overlay__label chapter-overlay__label--inline"
            >End (HH:MM:SS)<input
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
            on:click={onUseNarrationEndCurrent}>Use current</button
          >
        </div>
      </div>
      <button
        class="chapter-overlay__button chapter-overlay__button--subtle"
        type="button"
        data-testid="chapter-narration-skip"
        on:click={onSkipNarration}>Skip narration for this chapter</button
      >
    </div>
  </section>
{/if}

{#if hasAvMedia}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-header">
      <div class="chapter-overlay__section-title">Audio / Video Preview</div>
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
        Use the media controls in the viewer to set Mark In and Mark Out times.
      </div>
      <div class="chapter-overlay__timegrid">
        <div class="chapter-overlay__timerow">
          <label class="chapter-overlay__label chapter-overlay__label--inline"
            >Mark In (HH:MM:SS)<input
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
            on:click={onUseMarkInCurrent}>Use current</button
          >
        </div>
        <div class="chapter-overlay__timerow">
          <label class="chapter-overlay__label chapter-overlay__label--inline"
            >Mark Out (HH:MM:SS)<input
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
            on:click={onUseMarkOutCurrent}>Use current</button
          >
        </div>
      </div>
      {#if !marksValid}<div
          class="chapter-overlay__hint"
          data-testid="chapter-av-hint"
        >
          Mark Out must be greater than Mark In for audio / video.
        </div>{/if}
      <div class="chapter-overlay__row chapter-overlay__row--tight">
        <button
          class="chapter-overlay__button chapter-overlay__button--accent"
          type="button"
          data-testid="chapter-media-preview"
          on:click={onPreviewMedia}>Preview segment</button
        ><button
          class="chapter-overlay__button chapter-overlay__button--subtle"
          type="button"
          data-testid="chapter-media-stop"
          on:click={onStopPreviewMedia}>Stop</button
        >
      </div>
    </div>
  </section>
{/if}
