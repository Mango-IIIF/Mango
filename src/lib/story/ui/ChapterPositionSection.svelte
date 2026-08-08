<script lang="ts">
  import type { ViewBox } from '../../core/types/viewer';
  import { t } from '../../core/i18n';

  export let collapsed = false;
  export let hasSavedPosition = false;
  export let positionDrafts: { x: string; y: string; w: string; h: string } = {
    x: '',
    y: '',
    w: '',
    h: '',
  };
  export let currentViewBox: ViewBox | null = null;
  export let captureAcknowledged = false;

  export let onToggle: (() => void) | undefined = undefined;
  export let onFieldInput:
    ((field: 'x' | 'y' | 'w' | 'h', value: string) => void) | undefined = undefined;
  export let onCommit: (() => void) | undefined = undefined;
  export let onCapture: (() => void) | undefined = undefined;
  export let onGoToPosition: (() => void) | undefined = undefined;

  const fields: Array<{ key: 'x' | 'y' | 'w' | 'h'; labelKey: string; min?: string }> = [
    { key: 'x', labelKey: 'storyBuilder.position.x' },
    { key: 'y', labelKey: 'storyBuilder.position.y' },
    { key: 'w', labelKey: 'storyBuilder.position.width', min: '1' },
    { key: 'h', labelKey: 'storyBuilder.position.height', min: '1' },
  ];

  const round = (value: number): string => String(Math.round(value));

  const handleInput = (field: 'x' | 'y' | 'w' | 'h') => (event: Event) => {
    onFieldInput?.(field, (event.currentTarget as HTMLInputElement).value);
  };
</script>

<section
  class="chapter-overlay__section chapter-overlay__section--card"
  data-testid="chapter-position-section"
>
  <div class="chapter-overlay__section-header">
    <div class="chapter-overlay__section-title">{$t('storyBuilder.position.title')}</div>
    <button
      class="chapter-overlay__collapse-toggle"
      type="button"
      on:click={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed
        ? $t('storyBuilder.position.expand')
        : $t('storyBuilder.position.collapse')}
    >
      <span
        class="chapter-overlay__collapse-icon"
        class:chapter-overlay__collapse-icon--collapsed={collapsed}
      >
        ▾
      </span>
    </button>
  </div>

  <div class="chapter-overlay__section-content" hidden={collapsed}>
    <p class="chapter-overlay__hint">
      {hasSavedPosition
        ? $t('storyBuilder.position.hint')
        : $t('storyBuilder.position.empty')}
    </p>

    <div class="chapter-position__grid">
      {#each fields as field (field.key)}
        <label class="chapter-overlay__label">
          {$t(field.labelKey)}
          <input
            class="chapter-overlay__input"
            type="number"
            inputmode="numeric"
            step="1"
            min={field.min}
            data-testid={`chapter-position-${field.key}`}
            value={positionDrafts[field.key]}
            on:input={handleInput(field.key)}
            on:change={() => onCommit?.()}
          />
        </label>
      {/each}
    </div>

    <div class="chapter-position__actions">
      <button
        class="chapter-overlay__button chapter-overlay__button--accent"
        type="button"
        data-testid="chapter-position-capture"
        on:click={() => onCapture?.()}
      >
        {captureAcknowledged
          ? $t('storyBuilder.overlay.positionUpdated')
          : $t('storyBuilder.position.capture')}
      </button>
      <button
        class="chapter-overlay__button chapter-overlay__button--subtle"
        type="button"
        data-testid="chapter-position-goto"
        disabled={!hasSavedPosition}
        on:click={() => onGoToPosition?.()}
      >
        {$t('storyBuilder.position.goTo')}
      </button>
    </div>

    {#if currentViewBox}
      <p class="chapter-position__current" data-testid="chapter-position-current">
        {$t('storyBuilder.position.current', {
          x: round(currentViewBox.x),
          y: round(currentViewBox.y),
          w: round(currentViewBox.w),
          h: round(currentViewBox.h),
        })}
      </p>
    {/if}
  </div>
</section>

<style>
  .chapter-position__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 10px;
  }

  .chapter-position__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .chapter-position__actions .chapter-overlay__button {
    flex: 1 1 auto;
  }

  .chapter-position__current {
    margin: 10px 0 0;
    font-size: 11px;
    color: var(--viewer-muted, #9aa6b2);
  }
</style>
