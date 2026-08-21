<script lang="ts">
  import { Clock3, Play, Square } from '@lucide/svelte';
  import type { ChapterCameraTrack } from '../../core/types/story';
  import { t } from '../../core/i18n';

  export let track: ChapterCameraTrack | undefined;
  export let previewing = false;
  export let onUpdateDuration: (durationMs: number) => void;
  export let onUpdatePathType: (pathType: 'linear' | 'spline') => void = () => {};
  export let onUpdateDwell: (dwellMs: number) => void = () => {};
  export let onUpdateEasing: (
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out',
  ) => void = () => {};
  export let onApplyPreset: (preset: NonNullable<ChapterCameraTrack['preset']>) => void;
  export let onPreview: () => void;
  export let onStopPreview: () => void;
  export let wide = false;

  $: durationSeconds = (track?.durationMs ?? 5000) / 1000;
  $: points = [...(track?.keyframes ?? [])].sort((a, b) => a.timeMs - b.timeMs);
  $: currentDwell = points[0]?.dwellMs ?? 0;
  $: firstSegmentMs = points.length >= 2 ? Math.max(1, points[1].timeMs - points[0].timeMs) : 0;
  $: arcNeedsPoint = track?.preset === 'custom' && points.length > 0 && points.length < 3;
  $: requirementMessage =
    points.length === 0
      ? $t('storyBuilder.motion.requireTwo')
      : points.length === 1
        ? $t('storyBuilder.motion.requireOneMore')
        : arcNeedsPoint
          ? $t('storyBuilder.motion.requireArcPoint')
          : '';

  let feedback = '';

  const commitDuration = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const seconds = Number(input.value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      feedback = $t('storyBuilder.motion.durationError');
      input.value = String(durationSeconds);
      return;
    }
    const durationMs = seconds * 1000;
    const nextFirstSegmentMs = points.length >= 2 ? durationMs / (points.length - 1) : durationMs;
    if (currentDwell > 0 && currentDwell >= nextFirstSegmentMs) {
      feedback = $t('storyBuilder.motion.durationDwellError', { seconds: currentDwell / 1000 });
      input.value = String(durationSeconds);
      return;
    }
    feedback = '';
    onUpdateDuration(durationMs);
  };

  const choosePreset = (preset: NonNullable<ChapterCameraTrack['preset']>) => {
    if (preset === 'arc-sweep' && arcNeedsPoint) {
      feedback = $t('storyBuilder.motion.arcError');
      return;
    }
    feedback = '';
    onApplyPreset(preset);
  };

  const choosePathType = (pathType: 'linear' | 'spline') => {
    if (points.length < 2) return;
    feedback = '';
    onUpdatePathType(pathType);
  };

  const chooseDwell = (dwellMs: number) => {
    if (points.length < 2) return;
    if (dwellMs > 0 && dwellMs >= firstSegmentMs) {
      feedback = $t('storyBuilder.motion.dwellError');
      return;
    }
    feedback = '';
    onUpdateDwell(dwellMs);
  };
</script>

<div class="motion-panel" class:motion-panel--wide={wide}>
  <div class="motion-panel__intro">
    <div>
      <strong>{$t('storyBuilder.motion.title')}</strong>
      <span>
        {track?.preset === 'custom'
          ? $t('storyBuilder.motion.customHint')
          : $t('storyBuilder.motion.presetHint')}
      </span>
    </div>
    <button
      class="motion-panel__preview"
      type="button"
      disabled={points.length < 2}
      on:click={() => (previewing ? onStopPreview() : onPreview())}
    >
      {#if previewing}<Square aria-hidden="true" /> {$t('storyBuilder.media.stop')}{:else}<Play aria-hidden="true" /> {$t('storyBuilder.motion.preview')}{/if}
    </button>
  </div>

  {#if feedback || requirementMessage}
    <p class="motion-panel__feedback" role="status" aria-live="polite">
      {feedback || requirementMessage}
    </p>
  {/if}

  <div class="motion-panel__options">
  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section motion-panel__section--style">
    <div class="motion-panel__section-label">{$t('storyBuilder.motion.style')}</div>
    <div class="motion-panel__presets" role="group" aria-label={$t('storyBuilder.motion.presets')}>
      {#each ['ken-burns', 'hero-reveal', 'arc-sweep', 'zoom-in', 'zoom-out', 'pan', 'drift-zoom', 'static', 'custom'] as preset}
        <button
          type="button"
          disabled={preset === 'arc-sweep' && arcNeedsPoint}
          aria-pressed={track?.preset === preset}
          class:motion-panel__preset--active={track?.preset === preset}
          on:click={() => choosePreset(preset as NonNullable<ChapterCameraTrack['preset']>)}
          >{$t(`storyBuilder.motion.preset.${preset}`)}</button
        >
      {/each}
    </div>
  </section>

  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section">
    <div class="motion-panel__section-label">{$t('storyBuilder.motion.path')}</div>
    <div class="motion-panel__presets" role="group" aria-label={$t('storyBuilder.motion.path')}>
      <button
        type="button"
        disabled={points.length < 2}
        aria-pressed={track?.pathType === 'spline'}
        class:motion-panel__preset--active={Boolean(track) &&
          (track?.pathType ?? 'linear') === 'spline'}
        on:click={() => choosePathType('spline')}>{$t('storyBuilder.motion.curved')}</button
      >
      <button
        type="button"
        disabled={points.length < 2}
        aria-pressed={track?.pathType === 'linear'}
        class:motion-panel__preset--active={Boolean(track) &&
          (track?.pathType ?? 'linear') === 'linear'}
        on:click={() => choosePathType('linear')}>{$t('storyBuilder.motion.straight')}</button
      >
    </div>
  </section>

  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section">
    <div class="motion-panel__heading">
      <span class="motion-panel__icon"><Clock3 aria-hidden="true" /></span>
      <span>
        <strong>{$t('storyBuilder.motion.dwell')}</strong>
        <small>{$t('storyBuilder.motion.dwellHint')}</small>
      </span>
    </div>
    <div class="motion-panel__presets" role="group" aria-label={$t('storyBuilder.motion.dwell')}>
      {#each [0, 1000, 1500, 2000, 3000] as dwell}
        <button
          type="button"
          disabled={points.length < 2 || (dwell > 0 && dwell >= firstSegmentMs)}
          aria-pressed={points.length >= 2 && currentDwell === dwell}
          class:motion-panel__preset--active={points.length >= 2 && currentDwell === dwell}
          on:click={() => chooseDwell(dwell)}>{dwell === 0 ? $t('storyBuilder.motion.noDwell') : $t('storyBuilder.motion.seconds', { seconds: (dwell / 1000).toFixed(1) })}</button
        >
      {/each}
    </div>
  </section>

  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section">
    <div class="motion-panel__section-label">{$t('storyBuilder.motion.easing')}</div>
    <div class="motion-panel__presets" role="group" aria-label={$t('storyBuilder.motion.easing')}>
      {#each ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as easing}
        <button
          type="button"
          disabled={points.length < 2}
          aria-pressed={Boolean(track) && (track?.easing ?? 'ease-in-out') === easing}
          class:motion-panel__preset--active={Boolean(track) &&
            (track?.easing ?? 'ease-in-out') === easing}
          on:click={() => {
            feedback = '';
            onUpdateEasing(easing as NonNullable<ChapterCameraTrack['easing']>);
          }}>{$t(`storyBuilder.motion.easingOptions.${easing}`)}</button
        >
      {/each}
    </div>
  </section>

  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section">
    <div class="motion-panel__heading">
      <span class="motion-panel__icon"><Clock3 aria-hidden="true" /></span>
      <span>
        <strong>{$t('storyBuilder.motion.duration')}</strong>
        <small>{$t('storyBuilder.motion.durationHint')}</small>
      </span>
    </div>
    <label class="chapter-overlay__label">
      {$t('storyBuilder.motion.durationSeconds')}
      <input
        class="chapter-overlay__input"
        type="number"
        min="0.1"
        step="0.1"
        data-testid="motion-duration"
        value={durationSeconds}
        on:change={commitDuration}
      />
    </label>
  </section>
  </div>
</div>

<style>
  .motion-panel {
    display: grid;
    gap: 12px;
  }
  .motion-panel__intro {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .motion-panel__intro > div {
    display: grid;
    gap: 3px;
  }
  .motion-panel__intro strong {
    font-size: 14px;
  }
  .motion-panel__intro span {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    line-height: 1.4;
  }
  .motion-panel__preview {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    border-radius: 9px;
    padding: 9px 11px;
    background: var(--accent, var(--story-builder-accent, #e07a3f));
    color: white;
    font-weight: 700;
    cursor: pointer;
  }
  .motion-panel__preview:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .motion-panel__feedback {
    margin: 0;
    border: 1px solid color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 38%, transparent);
    border-radius: 9px;
    padding: 8px 10px;
    background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 9%, transparent);
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    line-height: 1.45;
  }
  .motion-panel__preview :global(svg) {
    width: 14px;
    height: 14px;
  }
  .motion-panel__section {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .motion-panel__section + .motion-panel__section {
    padding-top: 12px;
    border-top: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
  .motion-panel__options {
    display: grid;
    gap: 12px;
  }
  .motion-panel--wide .motion-panel__options {
    grid-template-columns: minmax(260px, 2fr) repeat(4, minmax(120px, 1fr));
    align-items: start;
  }
  .motion-panel--wide .motion-panel__section + .motion-panel__section {
    padding-top: 0;
    padding-left: 12px;
    border-top: 0;
    border-left: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
  .motion-panel__section-label {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .motion-panel__presets {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .motion-panel__presets button {
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 9px;
    padding: 9px 5px;
    background: transparent;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    cursor: pointer;
  }
  .motion-panel__presets button:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }
  .motion-panel__presets .motion-panel__preset--active {
    border-color: var(--accent, var(--story-builder-accent, #e07a3f));
    background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 12%, transparent);
    color: var(--viewer-text, #e8edf4);
  }
  .motion-panel__heading {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .motion-panel__heading > span:last-child {
    display: grid;
    gap: 2px;
  }
  .motion-panel__heading strong {
    font-size: 13px;
  }
  .motion-panel__heading small {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
  }
  .motion-panel__icon {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    color: var(--accent, var(--story-builder-accent, #e07a3f));
    background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 14%, transparent);
  }
  .motion-panel input {
    min-width: 0;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 8px;
    background: var(--viewer-panel, #121922);
    color: inherit;
  }
  @media (max-width: 960px) {
    .motion-panel--wide .motion-panel__options {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .motion-panel--wide .motion-panel__section--style {
      grid-column: 1 / -1;
    }
    .motion-panel--wide .motion-panel__section + .motion-panel__section {
      padding-left: 0;
      border-left: 0;
    }
  }
</style>
