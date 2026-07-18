<script lang="ts">
  import { getContext } from 'svelte';
  import { t } from '../../i18n';
  import PanelCloseButton from './PanelCloseButton.svelte';

  interface Props {
    onclose?: (() => void) | undefined;
  }

  let { onclose = undefined }: Props = $props();

  const viewer = getContext<any>('viewer-context');
  const settings = viewer.settings;
  const layouts: Array<'1x1' | '1x2' | '2x1' | '2x2'> = ['1x1', '1x2', '2x1', '2x2'];
</script>

<section class="panel" aria-label="Compare">
  <div class="panel__header">
    <div class="panel__title">Compare</div>
    <PanelCloseButton lucide={true} label="Close compare" {onclose} />
  </div>

  <div class="panel__body compare-panel">
    <div class="compare-panel__label">{$t('workspace.layout')}</div>
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
</section>

<style>
  .compare-panel {
    display: grid;
    gap: 8px;
  }

  .compare-panel__label {
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--viewer-muted);
  }

  :global(.compare-panel .panel__tab--active) {
    background: var(--viewer-accent-3, #ffd166);
    border: 1px solid var(--viewer-dock-active-border, rgba(255, 209, 102, 0.42));
    color: var(--viewer-dock-active-chip-text, #0b0f14);
  }

  :global(.viewer[data-theme='light'] .compare-panel .panel__tabs) {
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(34, 48, 65, 0.1);
  }

  :global(.viewer[data-theme='light'] .compare-panel .panel__tab) {
    background: rgba(255, 255, 255, 0.84);
    color: #223041;
  }

  :global(.viewer[data-theme='light'] .compare-panel .panel__tab--active) {
    background: var(--viewer-accent-3, #c5a264);
    border: 1px solid var(--viewer-dock-active-border, rgba(197, 162, 100, 0.6));
    color: var(--viewer-dock-active-chip-text, #223041);
  }
</style>
