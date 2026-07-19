<script lang="ts">
  import type { WorkspaceLayoutPreset } from '../../core/types/workspace';
  import { supportedLocales, t } from '../../i18n';

  interface Props {
    activeLayout?: WorkspaceLayoutPreset;
    theme?: 'dark' | 'light';
    locale?: string;
    placement?: 'left' | 'right';
    onlayoutchange?: ((layout: WorkspaceLayoutPreset) => void) | undefined;
    onthemechange?: ((theme: 'dark' | 'light') => void) | undefined;
    onlocalechange?: ((locale: string) => void) | undefined;
  }

  let {
    activeLayout = '1x1',
    theme = 'dark',
    locale = 'en',
    placement = 'left',
    onlayoutchange = undefined,
    onthemechange = undefined,
    onlocalechange = undefined,
  }: Props = $props();

  let open = $state(false);

  const layouts: WorkspaceLayoutPreset[] = ['1x1', '1x2', '2x1', '1x2-panel', '2x2'];
</script>

<div class="settings-wrap">
  <button
    class="settings-trigger"
    type="button"
    aria-label={$t('workspace.settings')}
    onclick={() => (open = !open)}
  >
    ⚙
  </button>

  {#if open}
    <div
      class="settings-popover"
      class:settings-popover--right={placement === 'right'}
      role="dialog"
      aria-label={$t('workspace.settings')}
    >
      <section class="settings-section">
        <h3>{$t('workspace.layout')}</h3>
        <div class="layout-grid">
          {#each layouts as layout}
            <button
              type="button"
              class="layout-option"
              class:layout-option--active={layout === activeLayout}
              onclick={() => onlayoutchange?.(layout)}
            >
              {layout}
            </button>
          {/each}
        </div>
      </section>

      <section class="settings-section">
        <h3>{$t('workspace.theme')}</h3>
        <div class="segment">
          <button type="button" class:segment__btn--active={theme === 'dark'} class="segment__btn" onclick={() => onthemechange?.('dark')}>{$t('workspace.themeDark')}</button>
          <button type="button" class:segment__btn--active={theme === 'light'} class="segment__btn" onclick={() => onthemechange?.('light')}>{$t('workspace.themeLight')}</button>
        </div>
      </section>

      <section class="settings-section">
        <h3>{$t('workspace.language')}</h3>
        <select value={locale} onchange={(event) => onlocalechange?.((event.currentTarget as HTMLSelectElement).value)}>
          {#each supportedLocales as option}
            <option value={option}>{option.toUpperCase()}</option>
          {/each}
        </select>
      </section>
    </div>
  {/if}
</div>

<style>
  .settings-wrap {
    position: relative;
  }

  .settings-trigger {
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    background: rgba(16, 24, 34, 0.85);
    color: #dbe7f4;
    width: 40px;
    height: 40px;
    cursor: pointer;
  }

  .settings-popover {
    position: absolute;
    left: 0;
    bottom: 48px;
    width: 250px;
    padding: 14px;
    border-radius: 14px;
    background: rgba(9, 18, 30, 0.86);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.16);
    box-shadow: 0 18px 32px rgba(0, 0, 0, 0.45);
    display: grid;
    gap: 12px;
    z-index: 15;
  }

  .settings-popover--right {
    left: 48px;
    bottom: 0;
  }

  .settings-section {
    display: grid;
    gap: 8px;
  }

  h3 {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(224, 234, 245, 0.76);
  }

  .layout-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .layout-option,
  .segment__btn,
  select {
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.06);
    color: #e5eef9;
    padding: 8px 10px;
    font-size: 12px;
  }

  .layout-option,
  .segment__btn {
    cursor: pointer;
  }

  .layout-option--active,
  .segment__btn--active {
    background: rgba(42, 199, 255, 0.26);
    border-color: rgba(42, 199, 255, 0.6);
  }

  .segment {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
</style>
