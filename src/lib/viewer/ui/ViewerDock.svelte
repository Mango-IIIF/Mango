<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';

  interface Props {
    allowThumbnails?: boolean;
    allowSearch?: boolean;
    allowMetadata?: boolean;
    allowAnnotations?: boolean;
    allowTools?: boolean;
    allowSettings?: boolean;
    allowContents?: boolean;
    showThumbnails?: boolean;
    showContents?: boolean;
    showSearch?: boolean;
    showMetadata?: boolean;
    showAnnotations?: boolean;
    showTools?: boolean;
    showSettings?: boolean;
    allowLayers?: boolean;
    showLayers?: boolean;
    compact?: boolean;
  }

  let {
    allowThumbnails = true,
    allowSearch = true,
    allowMetadata = true,
    allowAnnotations = true,
    allowTools = true,
    allowLayers = false,
    allowSettings = false,
    allowContents = false,
    showThumbnails = true,
    showContents = false,
    showSearch = true,
    showMetadata = true,
    showAnnotations = true,
    showTools = false,
    showLayers = false,
    showSettings = false,
    compact = false,
  }: Props = $props();

  const dispatch = createEventDispatcher<{
    panelToggle: {
      panel:
        | 'thumbnails'
        | 'contents'
        | 'search'
        | 'metadata'
        | 'annotations'
        | 'tools'
        | 'settings'
        | 'layers';
      open: boolean;
    };
  }>();
</script>

<div
  class="viewer__dock"
  class:viewer__dock--compact={compact}
  aria-label={$t('viewer.stage.controls.label')}
>
  {#if allowThumbnails}
    <button
      class:viewer__dock-button--active={showThumbnails}
      class="viewer__dock-button"
      data-tone="gallery"
      data-label={showThumbnails
        ? $t('viewer.stage.controls.hideGallery')
        : $t('viewer.stage.controls.showGallery')}
      type="button"
      aria-pressed={showThumbnails}
      aria-label={$t('viewer.stage.controls.toggleGallery')}
      onclick={() =>
        dispatch('panelToggle', { panel: 'thumbnails', open: !showThumbnails })}
    >
      <span class="viewer__dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2"></rect>
          <circle cx="9" cy="10" r="1.5"></circle>
          <path d="M20.5 16l-5.2-5.2a1.2 1.2 0 0 0-1.7 0L7 17"></path>
        </svg>
      </span>
      <span class="viewer__dock-label">{$t('viewer.dock.gallery')}</span>
    </button>
  {/if}
  {#if allowContents}
    <button
      class:viewer__dock-button--active={showContents}
      class="viewer__dock-button"
      data-tone="contents"
      data-label={showContents
        ? $t('viewer.stage.controls.hideContents')
        : $t('viewer.stage.controls.showContents')}
      type="button"
      aria-pressed={showContents}
      aria-label={$t('viewer.stage.controls.toggleContents')}
      onclick={() => dispatch('panelToggle', { panel: 'contents', open: !showContents })}
    >
      <span class="viewer__dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M8 7h11"></path>
          <path d="M8 12h11"></path>
          <path d="M8 17h11"></path>
          <circle cx="5" cy="7" r="0.8" fill="currentColor" stroke="none"></circle>
          <circle cx="5" cy="12" r="0.8" fill="currentColor" stroke="none"></circle>
          <circle cx="5" cy="17" r="0.8" fill="currentColor" stroke="none"></circle>
        </svg>
      </span>
      <span class="viewer__dock-label">{$t('viewer.dock.contents')}</span>
    </button>
  {/if}
  {#if allowMetadata}
    <button
      class:viewer__dock-button--active={showMetadata}
      class="viewer__dock-button"
      data-tone="info"
      data-label={showMetadata
        ? $t('viewer.stage.controls.hideInfo')
        : $t('viewer.stage.controls.showInfo')}
      type="button"
      aria-pressed={showMetadata}
      aria-label={$t('viewer.stage.controls.toggleMetadata')}
      onclick={() => dispatch('panelToggle', { panel: 'metadata', open: !showMetadata })}
    >
      <span class="viewer__dock-icon viewer__dock-icon--info" aria-hidden="true">
        <span class="viewer__dock-info-chip">i</span>
      </span>
      <span class="viewer__dock-label">{$t('viewer.dock.info')}</span>
    </button>
  {/if}
  {#if allowSearch}
    <button
      class:viewer__dock-button--active={showSearch}
      class="viewer__dock-button"
      data-tone="search"
      data-label={showSearch
        ? $t('viewer.stage.controls.hideSearch')
        : $t('viewer.stage.controls.showSearch')}
      type="button"
      aria-pressed={showSearch}
      aria-label={$t('viewer.stage.controls.toggleSearch')}
      onclick={() => dispatch('panelToggle', { panel: 'search', open: !showSearch })}
    >
      <span class="viewer__dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="6"></circle>
          <path d="M20 20l-4.2-4.2"></path>
        </svg>
      </span>
      <span class="viewer__dock-label">{$t('viewer.dock.search')}</span>
    </button>
  {/if}
  {#if allowAnnotations}
    <button
      class:viewer__dock-button--active={showAnnotations}
      class="viewer__dock-button"
      data-tone="annotations"
      data-label={showAnnotations
        ? $t('viewer.stage.controls.hideAnnotations')
        : $t('viewer.stage.controls.showAnnotations')}
      type="button"
      aria-pressed={showAnnotations}
      aria-label={$t('viewer.stage.controls.toggleAnnotations')}
      onclick={() =>
        dispatch('panelToggle', { panel: 'annotations', open: !showAnnotations })}
    >
      <span class="viewer__dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="4.5" y="4.5" width="15" height="15" rx="2"></rect>
          <path d="M8 8h8v8H8z"></path>
        </svg>
      </span>
      <span class="viewer__dock-label">{$t('viewer.dock.annotations')}</span>
    </button>
  {/if}
  {#if allowTools}
    <button
      class:viewer__dock-button--active={showTools}
      class="viewer__dock-button"
      data-tone="tools"
      data-label={showTools
        ? $t('viewer.stage.controls.hideTools')
        : $t('viewer.stage.controls.showTools')}
      type="button"
      aria-pressed={showTools}
      aria-label={$t('viewer.stage.controls.toggleTools')}
      onclick={() => dispatch('panelToggle', { panel: 'tools', open: !showTools })}
    >
      <span class="viewer__dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M14.5 6.5a3.5 3.5 0 0 0-4.8 4.8l-5.2 5.2a1.8 1.8 0 1 0 2.5 2.5l5.2-5.2a3.5 3.5 0 0 0 4.8-4.8l-2.2 2.2-2.5-2.5 2.2-2.2z"
          ></path>
        </svg>
      </span>
      <span class="viewer__dock-label">{$t('viewer.dock.tools')}</span>
    </button>
  {/if}

  {#if allowLayers}
    <button
      class:viewer__dock-button--active={showLayers}
      class="viewer__dock-button"
      data-tone="layers"
      data-label={showLayers
        ? $t('viewer.stage.controls.hideLayers')
        : $t('viewer.stage.controls.showLayers')}
      type="button"
      aria-pressed={showLayers}
      aria-label={$t('viewer.stage.controls.toggleLayers')}
      onclick={() => dispatch('panelToggle', { panel: 'layers', open: !showLayers })}
    >
      <span class="viewer__dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
      </span>
      <span class="viewer__dock-label">{$t('viewer.dock.layers')}</span>
    </button>
  {/if}
  {#if allowSettings}
    <button
      class:viewer__dock-button--active={showSettings}
      class="viewer__dock-button"
      data-label={showSettings ? 'Hide settings' : 'Show settings'}
      type="button"
      aria-pressed={showSettings}
      aria-label="Toggle settings"
      onclick={() => dispatch('panelToggle', { panel: 'settings', open: !showSettings })}
    >
      <span class="viewer__dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"></path>
          <path
            d="M19.2 13.1v-2.2l-1.9-.5a5.8 5.8 0 0 0-.5-1.2l1.1-1.7-1.6-1.6-1.7 1.1a5.8 5.8 0 0 0-1.2-.5L13.1 4h-2.2l-.5 1.9a5.8 5.8 0 0 0-1.2.5L7.5 5.3 5.9 6.9 7 8.6a5.8 5.8 0 0 0-.5 1.2l-1.9.5v2.2l1.9.5c.1.4.3.8.5 1.2l-1.1 1.7 1.6 1.6 1.7-1.1c.4.2.8.4 1.2.5l.5 1.9h2.2l.5-1.9c.4-.1.8-.3 1.2-.5l1.7 1.1 1.6-1.6-1.1-1.7c.2-.4.4-.8.5-1.2l1.9-.5z"
          ></path>
        </svg>
      </span>
      <span class="viewer__dock-label">Settings</span>
    </button>
  {/if}
</div>

<style>
  .viewer__dock {
    position: absolute;
    right: 18px;
    top: 50%;
    transform: translateY(-50%);
    display: grid;
    gap: 12px;
    z-index: 2;
  }

  .viewer__dock-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 1px solid var(--viewer-dock-button-border, rgba(255, 255, 255, 0.12));
    background: var(--viewer-dock-button-bg, rgba(15, 20, 27, 0.95));
    color: var(--viewer-text);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    cursor: pointer;
    box-shadow: var(--viewer-dock-button-shadow, 0 12px 24px rgba(0, 0, 0, 0.35));
  }

  .viewer__dock-icon {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .viewer__dock-icon svg {
    width: 22px;
    height: 22px;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .viewer__dock-icon--info {
    width: 26px;
    height: 26px;
  }

  .viewer__dock-info-chip {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid currentColor;
    display: inline-grid;
    place-items: center;
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
    font-family: 'Times New Roman', Georgia, serif;
    text-transform: lowercase;
  }

  .viewer__dock-label {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    border: 0;
    padding: 0;
    white-space: nowrap;
    clip-path: inset(100%);
    clip: rect(0 0 0 0);
    overflow: hidden;
  }

  .viewer__dock--compact .viewer__dock-button {
    width: 44px;
    height: 44px;
  }

  .viewer__dock--compact {
    position: static;
    right: auto;
    top: auto;
    bottom: auto;
    transform: none;
    width: 100%;
  }

  .viewer__dock--compact .viewer__dock-button::after {
    left: calc(100% + 10px);
    right: auto;
  }

  .viewer__dock-button::after {
    content: attr(data-label);
    position: absolute;
    right: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--viewer-dock-tooltip-bg, rgba(10, 14, 19, 0.95));
    border: 1px solid var(--viewer-panel-border);
    color: var(--viewer-text);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .viewer__dock-button:hover::after,
  .viewer__dock-button:focus-visible::after {
    opacity: 1;
  }

  .viewer__dock-button--active {
    color: var(--viewer-accent-3);
    border-color: var(--viewer-dock-active-border, rgba(255, 209, 102, 0.42));
    box-shadow:
      0 0 0 1px var(--viewer-dock-active-ring, rgba(255, 209, 102, 0.24)),
      var(--viewer-dock-active-shadow-base, 0 12px 24px rgba(0, 0, 0, 0.35));
  }

  .viewer__dock-button--active .viewer__dock-info-chip {
    background: var(--viewer-accent-3);
    border-color: var(--viewer-accent-3);
    color: var(--viewer-dock-active-chip-text, #0b0f14);
  }

  @media (max-width: 900px) {
    .viewer__dock {
      top: auto;
      bottom: 16px;
      right: 16px;
      transform: none;
      grid-auto-flow: column;
      grid-template-columns: repeat(auto-fit, minmax(44px, 1fr));
    }

    .viewer__dock--compact {
      position: static;
      right: auto;
      top: auto;
      bottom: auto;
      transform: none;
      width: 100%;
    }
  }
</style>
