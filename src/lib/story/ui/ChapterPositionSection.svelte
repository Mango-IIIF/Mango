<script lang="ts">
  import { t } from '../../core/i18n';

  /*
   * The numbers beside the frame.
   *
   * The frame itself lives on the canvas, where it is moved and resized by
   * hand; this is its readout, kept editable because a region typed straight
   * from a IIIF recipe is a real way to author a chapter. What is typed is
   * what is kept: a width or height pulls the other dimension along at the
   * story's aspect, and nothing is re-normalised afterwards.
   */

  export let collapsed = false;
  export let hasSavedPosition = false;
  export let positionDrafts: { x: string; y: string; w: string; h: string } = {
    x: '',
    y: '',
    w: '',
    h: '',
  };
  /** Width over height every frame in this story is held to. */
  export let aspect: number | null = null;

  export let onToggle: (() => void) | undefined = undefined;
  export let onFieldInput:
    ((field: 'x' | 'y' | 'w' | 'h', value: string) => void) | undefined = undefined;
  export let onCommit: ((field: 'x' | 'y' | 'w' | 'h') => void) | undefined = undefined;
  export let onGoToPosition: (() => void) | undefined = undefined;

  const fields: Array<{ key: 'x' | 'y' | 'w' | 'h'; labelKey: string; min?: string }> = [
    { key: 'x', labelKey: 'storyBuilder.position.x' },
    { key: 'y', labelKey: 'storyBuilder.position.y' },
    { key: 'w', labelKey: 'storyBuilder.position.width', min: '1' },
    { key: 'h', labelKey: 'storyBuilder.position.height', min: '1' },
  ];

  const formatAspect = (value: number): string => {
    const known: Array<[number, string]> = [
      [16 / 9, '16:9'],
      [3 / 2, '3:2'],
      [4 / 3, '4:3'],
      [1, '1:1'],
      [3 / 4, '3:4'],
      [2 / 3, '2:3'],
      [9 / 16, '9:16'],
    ];
    const match = known.find(([ratio]) => Math.abs(ratio - value) / ratio < 0.002);
    return match ? match[1] : `${value.toFixed(3)}:1`;
  };

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
            on:change={() => onCommit?.(field.key)}
          />
        </label>
      {/each}
    </div>

    {#if aspect}
      <p class="chapter-position__aspect" data-testid="chapter-position-aspect">
        {$t('storyBuilder.position.aspectLocked', { aspect: formatAspect(aspect) })}
      </p>
    {/if}

    <div class="chapter-position__actions">
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
  </div>
</section>

<style>
  .chapter-position__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 10px;
  }

  .chapter-position__aspect {
    margin: 10px 0 0;
    font-size: 11px;
    line-height: 1.45;
    color: var(--viewer-muted, #9aa6b2);
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
</style>
