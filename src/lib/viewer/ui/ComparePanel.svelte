<script lang="ts">
  import { Columns2, Grid2x2, LayoutPanelLeft, Square } from '@lucide/svelte';
  import { getViewerContext } from '../context';
  import { t } from '../../i18n';
  import PanelCloseButton from './PanelCloseButton.svelte';

  interface Props {
    onclose?: (() => void) | undefined;
  }

  type LayoutOption = {
    value: '1x1' | '1x2' | '2x1' | '1x2-panel' | '2x2';
    label: string;
    dimensions: string;
    accessibleName: string;
    announcement: string;
  };

  let { onclose = undefined }: Props = $props();

  const viewer = getViewerContext();
  const settings = viewer.settings;
  const layouts: LayoutOption[] = $derived([
    {
      value: '1x1',
      label: $t('workspace.compare.single'),
      dimensions: '1 × 1',
      accessibleName: $t('workspace.compare.singleAria'),
      announcement: $t('workspace.compare.singleAnnouncement'),
    },
    {
      value: '1x2',
      label: $t('workspace.compare.sideBySide'),
      dimensions: '1 × 2',
      accessibleName: $t('workspace.compare.sideBySideAria'),
      announcement: $t('workspace.compare.sideBySideAnnouncement'),
    },
    {
      value: '2x1',
      label: $t('workspace.compare.stacked'),
      dimensions: '2 × 1',
      accessibleName: $t('workspace.compare.stackedAria'),
      announcement: $t('workspace.compare.stackedAnnouncement'),
    },
    {
      value: '1x2-panel',
      label: $t('workspace.compare.oneByTwo'),
      dimensions: '1 × 2',
      accessibleName: $t('workspace.compare.oneByTwoAria'),
      announcement: $t('workspace.compare.oneByTwoAnnouncement'),
    },
    {
      value: '2x2',
      label: $t('workspace.compare.grid'),
      dimensions: '2 × 2',
      accessibleName: $t('workspace.compare.gridAria'),
      announcement: $t('workspace.compare.gridAnnouncement'),
    },
  ]);

  let announcement = $state('');

  const selectLayout = (option: LayoutOption) => {
    if (settings.layout === option.value) return;
    settings.layout = option.value;
    announcement = option.announcement;
  };

  const handleLayoutKeydown = (event: KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % layouts.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + layouts.length) % layouts.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = layouts.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const option = layouts[nextIndex];
    selectLayout(option);
    const group = (event.currentTarget as HTMLButtonElement).closest('[role="radiogroup"]');
    group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
  };
</script>

<section class="panel" aria-label={$t('workspace.compare.title')}>
  <div class="panel__header">
    <div class="panel__title">{$t('workspace.compare.title')}</div>
    <PanelCloseButton lucide={true} label={$t('workspace.compare.close')} {onclose} />
  </div>

  <div class="panel__body compare-panel">
    <div class="compare-panel__intro">
      <div class="compare-panel__label">{$t('workspace.layout')}</div>
      <p>{$t('workspace.compare.description')}</p>
    </div>

    <div class="compare-panel__options" role="radiogroup" aria-label={$t('workspace.compare.group')}>
      {#each layouts as option, index (option.value)}
        <button
          type="button"
          role="radio"
          class="layout-card"
          class:layout-card--selected={settings.layout === option.value}
          aria-checked={settings.layout === option.value}
          aria-label={option.accessibleName}
          tabindex={settings.layout === option.value ? 0 : -1}
          onclick={() => selectLayout(option)}
          onkeydown={(event) => handleLayoutKeydown(event, index)}
        >
          <span
            class="layout-card__icon"
            class:layout-card__icon--stacked={option.value === '2x1'}
            aria-hidden="true"
          >
            {#if option.value === '1x1'}
              <Square />
            {:else if option.value === '2x2'}
              <Grid2x2 />
            {:else if option.value === '1x2-panel'}
              <LayoutPanelLeft />
            {:else}
              <Columns2 />
            {/if}
          </span>
          <span class="layout-card__copy">
            <span class="layout-card__label">{option.label}</span>
            <span class="layout-card__dimensions">{option.dimensions}</span>
          </span>
        </button>
      {/each}
    </div>

    <div class="compare-panel__status" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  </div>
</section>

<style>
  .compare-panel {
    display: grid;
    gap: 14px;
  }

  .compare-panel__intro {
    display: grid;
    gap: 4px;
  }

  .compare-panel__label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--viewer-muted);
  }

  .compare-panel__intro p {
    margin: 0;
    color: var(--viewer-muted);
    font-size: 12px;
    line-height: 1.45;
  }

  .compare-panel__options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .layout-card {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-height: 72px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.045);
    color: var(--viewer-text);
    text-align: left;
    cursor: pointer;
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      box-shadow 160ms ease;
  }

  .layout-card:hover:not(:disabled):not(.layout-card--selected) {
    border-color: rgba(42, 199, 255, 0.46);
    background: rgba(255, 255, 255, 0.08);
  }

  .layout-card:focus-visible {
    outline: 3px solid rgba(42, 199, 255, 0.82);
    outline-offset: 3px;
  }

  .layout-card--selected {
    border: 2px solid var(--viewer-accent-2, #2ac7ff);
    padding: 11px;
    background: rgba(42, 199, 255, 0.12);
    box-shadow: inset 0 0 0 1px rgba(42, 199, 255, 0.12);
  }

  .layout-card:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .layout-card__icon {
    order: 2;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    color: rgba(226, 235, 245, 0.82);
    transition: color 160ms ease;
  }

  .layout-card__icon--stacked {
    transform: rotate(90deg);
  }

  .layout-card__icon :global(svg) {
    width: 25px;
    height: 25px;
    stroke-width: 1.8;
  }

  .layout-card:hover:not(:disabled):not(.layout-card--selected) .layout-card__icon,
  .layout-card--selected .layout-card__icon {
    color: var(--viewer-accent-2, #2ac7ff);
  }

  .layout-card__copy {
    order: 1;
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .layout-card__label {
    color: rgba(235, 242, 250, 0.9);
    font-size: 12px;
    font-weight: 650;
    line-height: 1.2;
  }

  .layout-card--selected .layout-card__label {
    color: #f5fbff;
  }

  .layout-card__dimensions {
    color: var(--viewer-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .compare-panel__status {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .compare-panel .layout-card) {
    border-color: rgba(34, 48, 65, 0.18);
    background: rgba(255, 255, 255, 0.72);
    color: #223041;
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .compare-panel .layout-card:hover:not(:disabled):not(.layout-card--selected)) {
    border-color: rgba(18, 160, 207, 0.55);
    background: rgba(236, 247, 252, 0.94);
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .compare-panel .layout-card--selected) {
    border-color: #159fce;
    background: rgba(42, 199, 255, 0.13);
    box-shadow: inset 0 0 0 1px rgba(21, 159, 206, 0.14);
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .compare-panel .layout-card__label) {
    color: #223041;
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .compare-panel .layout-card__icon) {
    color: rgba(34, 48, 65, 0.72);
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .compare-panel .layout-card:hover:not(:disabled):not(.layout-card--selected) .layout-card__icon),
  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .compare-panel .layout-card--selected .layout-card__icon) {
    color: #159fce;
  }

  @container mango-viewer (max-width: 560px) {
    .compare-panel__options {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .layout-card,
    .layout-card__icon {
      transition: none;
    }
  }
</style>
