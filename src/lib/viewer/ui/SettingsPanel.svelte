<script lang="ts">
  import { Grid2x2, Image, Images, Scroll } from '@lucide/svelte';
  import { getViewerContext } from '../context';
  import { supportedLocales, t } from '../../i18n';
  import PanelCloseButton from './PanelCloseButton.svelte';

  interface Props {
    redesigned?: boolean;
    onclose?: (() => void) | undefined;
  }

  let { redesigned = false, onclose = undefined }: Props = $props();

  const viewer = getViewerContext();
  const settings = viewer.settings;
  const { layoutMode } = viewer.state;
  const pageLayoutDisabled = $derived(settings.layout !== '1x1');

</script>

<section class="panel" aria-label={$t('workspace.settings')}>
  <div class="panel__header">
    <div class="panel__title">{$t('workspace.settings')}</div>
    <PanelCloseButton lucide={redesigned} label={$t('workspace.closeSettings')} {onclose} />
  </div>

  <div class="panel__body settings-panel">

    <!-- language -->
    <div class="settings-panel__section">
      <div class="settings-panel__label">{$t('workspace.language')}</div>
      <select value={settings.locale} onchange={(event) => settings.locale = (event.currentTarget as HTMLSelectElement).value}>
        {#each supportedLocales as option}
          <option value={option}>{option.toUpperCase()}</option>
        {/each}
      </select>
    </div>

    <!-- theme -->
    <div class="settings-panel__section">
      <div class="settings-panel__label">{$t('workspace.theme')}</div>
      <div class="panel__tabs">
        <button type="button" class="panel__tab" class:panel__tab--active={settings.theme === 'dark'} onclick={() => settings.theme = 'dark'}>{$t('workspace.themeDark')}</button>
        <button type="button" class="panel__tab" class:panel__tab--active={settings.theme === 'light'} onclick={() => settings.theme = 'light'}>{$t('workspace.themeLight')}</button>
        <button type="button" class="panel__tab" class:panel__tab--active={settings.theme === 'sepia'} onclick={() => settings.theme = 'sepia'}>{$t('workspace.themeSepia')}</button>
        <button type="button" class="panel__tab" class:panel__tab--active={settings.theme === 'midnight'} onclick={() => settings.theme = 'midnight'}>{$t('workspace.themeMidnight')}</button>
      </div>
    </div>

    <!-- workspace -->
    <div
      class="settings-panel__section"
      class:settings-panel__section--disabled={pageLayoutDisabled}
      aria-disabled={pageLayoutDisabled}
    >
      <div class="settings-panel__label">{$t('workspace.viewMode') ?? 'Page Layout'}</div>
      <div class="page-layout-options" role="radiogroup" aria-label={$t('workspace.pageLayout.group')}>
        <button
          type="button"
          role="radio"
          class="page-layout-card"
          class:page-layout-card--selected={$layoutMode === 'single'}
          aria-checked={$layoutMode === 'single'}
          aria-label={$t('workspace.pageLayout.singleAria')}
          disabled={pageLayoutDisabled}
          onclick={() => settings.layoutMode = 'single'}
        >
          <span>{$t('workspace.viewModeSingle') ?? 'Single'}</span>
          <Image aria-hidden="true" />
        </button>
        <button
          type="button"
          role="radio"
          class="page-layout-card"
          class:page-layout-card--selected={$layoutMode === 'two-page'}
          aria-checked={$layoutMode === 'two-page'}
          aria-label={$t('workspace.pageLayout.sideBySideAria')}
          disabled={pageLayoutDisabled}
          onclick={() => settings.layoutMode = 'two-page'}
        >
          <span>{$t('workspace.viewModePaged') ?? 'Side by Side'}</span>
          <Images aria-hidden="true" />
        </button>
        <button
          type="button"
          role="radio"
          class="page-layout-card"
          class:page-layout-card--selected={$layoutMode === 'continuous'}
          aria-checked={$layoutMode === 'continuous'}
          aria-label={$t('workspace.pageLayout.continuousAria')}
          disabled={pageLayoutDisabled}
          onclick={() => settings.layoutMode = 'continuous'}
        >
          <span>{$t('workspace.viewModeContinuous') ?? 'Continuous Scroll'}</span>
          <Scroll aria-hidden="true" />
        </button>
        <button
          type="button"
          role="radio"
          class="page-layout-card"
          class:page-layout-card--selected={$layoutMode === 'gallery'}
          aria-checked={$layoutMode === 'gallery'}
          aria-label={$t('workspace.pageLayout.galleryAria')}
          disabled={pageLayoutDisabled}
          onclick={() => settings.layoutMode = 'gallery'}
        >
          <span>{$t('workspace.viewModeGallery') ?? 'Gallery'}</span>
          <Grid2x2 aria-hidden="true" />
        </button>
      </div>
    </div>

  </div>
</section>

<style>
  .settings-panel {
    display: grid;
    gap: 10px;
  }
  .settings-panel__section {
    display: grid;
    gap: 8px;
  }
  .settings-panel__label {
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--viewer-muted);
  }
  .settings-panel__section--disabled {
    opacity: 0.48;
  }
  select {
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.08);
    color: var(--viewer-text);
    padding: 8px 10px;
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .settings-panel .panel__tabs) {
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(34, 48, 65, 0.1);
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .settings-panel .panel__tab) {
    background: rgba(255, 255, 255, 0.84);
    color: #223041;
  }

  :global(.settings-panel .panel__tab--active) {
    border: 1px solid rgba(42, 199, 255, 0.64);
    background: rgba(42, 199, 255, 0.14);
    color: #f5fbff;
    box-shadow: inset 0 0 0 1px rgba(42, 199, 255, 0.08);
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .settings-panel .panel__tab--active) {
    border-color: #159fce;
    background: rgba(42, 199, 255, 0.13);
    color: #16435a;
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .settings-panel select) {
    border-color: rgba(34, 48, 65, 0.18);
    background: rgba(255, 255, 255, 0.84);
  }

  .page-layout-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .page-layout-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-height: 64px;
    padding: 11px 12px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.045);
    color: rgba(235, 242, 250, 0.9);
    font-size: 12px;
    font-weight: 650;
    line-height: 1.2;
    text-align: left;
    cursor: pointer;
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      box-shadow 160ms ease;
  }

  .page-layout-card :global(svg) {
    width: 25px;
    height: 25px;
    color: rgba(226, 235, 245, 0.82);
    stroke-width: 1.8;
    transition: color 160ms ease;
  }

  .page-layout-card:hover:not(:disabled):not(.page-layout-card--selected) {
    border-color: rgba(42, 199, 255, 0.46);
    background: rgba(255, 255, 255, 0.08);
  }

  .page-layout-card:hover:not(:disabled):not(.page-layout-card--selected) :global(svg),
  .page-layout-card--selected :global(svg) {
    color: var(--viewer-accent-2, #2ac7ff);
  }

  .page-layout-card--selected {
    border: 2px solid var(--viewer-accent-2, #2ac7ff);
    padding: 10px 11px;
    background: rgba(42, 199, 255, 0.12);
    color: #f5fbff;
    box-shadow: inset 0 0 0 1px rgba(42, 199, 255, 0.12);
  }

  .page-layout-card:focus-visible {
    outline: 3px solid rgba(42, 199, 255, 0.82);
    outline-offset: 3px;
  }

  .page-layout-card:disabled {
    cursor: not-allowed;
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .settings-panel .page-layout-card) {
    border-color: rgba(34, 48, 65, 0.18);
    background: rgba(255, 255, 255, 0.72);
    color: #223041;
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia']) .settings-panel .page-layout-card--selected) {
    border-color: #159fce;
    background: rgba(42, 199, 255, 0.13);
    color: #16435a;
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia'])) .page-layout-card :global(svg) {
    color: rgba(34, 48, 65, 0.72);
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia'])) .page-layout-card--selected :global(svg) {
    color: #159fce;
  }

  @container mango-viewer (max-width: 560px) {
    .page-layout-options {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page-layout-card,
    .page-layout-card :global(svg) {
      transition: none;
    }
  }
</style>
