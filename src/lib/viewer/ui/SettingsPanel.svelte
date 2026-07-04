<script lang="ts">
  import { getContext } from 'svelte';
  import { supportedLocales, t } from '../../i18n';

  interface Props {
    onclose?: (() => void) | undefined;
  }

  let { onclose = undefined }: Props = $props();

  const viewer = getContext<any>('viewer-context');
  const settings = viewer.settings;
  const { layoutMode } = viewer.derived;

  const layouts: Array<'1x1' | '1x2' | '2x1' | '2x2'> = ['1x1', '1x2', '2x1', '2x2'];
</script>

<section class="panel" aria-label={$t('workspace.settings')}>
  <div class="panel__header">
    <div class="panel__title">{$t('workspace.settings')}</div>
    <button class="panel__close" type="button" aria-label="Close" onclick={() => onclose?.()}>{$t('common.closeGlyph')}</button>
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
      </div>
    </div>

    <!-- workspace -->
    <div class="settings-panel__section">
      <div class="settings-panel__label">{$t('workspace.viewMode') ?? 'Page Layout'}</div>
      <div class="panel__tabs">
        <button
          type="button"
          class="panel__tab"
          class:panel__tab--active={$layoutMode === 'single'}
          onclick={() => settings.layoutMode = 'single'}
        >{$t('workspace.viewModeSingle') ?? 'Single'}</button>
        <button
          type="button"
          class="panel__tab"
          class:panel__tab--active={$layoutMode === 'two-page'}
          onclick={() => settings.layoutMode = 'two-page'}
        >{$t('workspace.viewModePaged') ?? 'Side by Side'}</button>
        <button
          type="button"
          class="panel__tab"
          class:panel__tab--active={$layoutMode === 'continuous'}
          onclick={() => settings.layoutMode = 'continuous'}
        >{$t('workspace.viewModeContinuous') ?? 'Continuous'}</button>
        <button
          type="button"
          class="panel__tab"
          class:panel__tab--active={$layoutMode === 'gallery'}
          onclick={() => settings.layoutMode = 'gallery'}
        >{$t('workspace.viewModeGallery') ?? 'Gallery'}</button>
      </div>
    </div>

    <!-- layout -->
    <div class="settings-panel__section">
      <div class="settings-panel__label">{$t('workspace.layout')}</div>
      <div class="panel__tabs">
        {#each layouts as option}
          <button
            type="button"
            class="panel__tab"
            class:panel__tab--active={settings.layout === option}
            onclick={() => settings.layout = option}
          >{option}</button>
        {/each}
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
  select {
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.08);
    color: var(--viewer-text);
    padding: 8px 10px;
  }

  :global(.viewer[data-theme='light'] .settings-panel .panel__tabs) {
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(34, 48, 65, 0.1);
  }

  :global(.viewer[data-theme='light'] .settings-panel .panel__tab) {
    background: rgba(255, 255, 255, 0.84);
    color: #223041;
  }

  :global(.settings-panel .panel__tab--active) {
    background: var(--viewer-accent-3, #ffd166);
    border: 1px solid var(--viewer-dock-active-border, rgba(255, 209, 102, 0.42));
    color: var(--viewer-dock-active-chip-text, #0b0f14);
  }

  :global(.viewer[data-theme='light'] .settings-panel .panel__tab--active) {
    background: var(--viewer-accent-3, #c5a264);
    border: 1px solid var(--viewer-dock-active-border, rgba(197, 162, 100, 0.6));
    color: var(--viewer-dock-active-chip-text, #223041);
  }

  :global(.viewer[data-theme='light'] .settings-panel select) {
    border-color: rgba(34, 48, 65, 0.18);
    background: rgba(255, 255, 255, 0.84);
  }
</style>
