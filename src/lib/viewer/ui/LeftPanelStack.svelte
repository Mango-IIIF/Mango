<script lang="ts">
  import { getContext } from 'svelte';
  import { t } from '../../i18n';
  import PluginSlot from '../../plugins/PluginSlot.svelte';
  import type { PluginContext, ViewerPlugin } from '../../core/types/plugin';
  import AnnotationsPanel from './AnnotationsPanel.svelte';
  import ToolsPanel from './ToolsPanel.svelte';
  import SearchPanel from './SearchPanel.svelte';
  import MetadataPanel from './MetadataPanel.svelte';
  import ContentsPanel from './ContentsPanel.svelte';
  import SettingsPanel from './SettingsPanel.svelte';
  import LayersPanel from './LayersPanel.svelte';
  import CollectionPanel from './CollectionPanel.svelte';
  import type { CollectionSelection } from '@mango-iiif/collection-navigator';
  import type { ViewerDerivedStores } from '../state/viewerDerived';

  interface Props {
    visible?: boolean;
    showAnnotations?: boolean;
    showCollection?: boolean;
    showTools?: boolean;
    showContents?: boolean;
    showSearch?: boolean;
    showMetadata?: boolean;
    showSettings?: boolean;
    showLayers?: boolean;
    leftPlugins?: ViewerPlugin[];
    pluginContext: Omit<PluginContext, 'mount'>;
    onpanelToggle?: (
      panel:
        | 'collection'
        | 'annotations'
        | 'tools'
        | 'search'
        | 'metadata'
        | 'contents'
        | 'settings'
        | 'layers',
      open: boolean,
    ) => void;
    oncollectionSelect?: (selection: CollectionSelection) => void;
  }

  let {
    visible = false,
    showAnnotations = false,
    showCollection = false,
    showTools = false,
    showContents = false,
    showSearch = false,
    showMetadata = false,
    showSettings = false,
    showLayers = false,
    leftPlugins = [],
    pluginContext,
    onpanelToggle,
    oncollectionSelect,
  }: Props = $props();

  const viewer = getContext<{
    derived: Pick<ViewerDerivedStores, 'mediaType'>;
  }>('viewer-context');
  const mediaType = viewer.derived.mediaType;
  let loadedCollection = $state(false);
  let loadedContents = $state(false);
  let loadedSettings = $state(false);
  let loadedAnnotations = $state(false);
  let loadedTools = $state(false);
  let loadedSearch = $state(false);
  let loadedMetadata = $state(false);
  let loadedLayers = $state(false);

  $effect(() => {
    if (showCollection) loadedCollection = true;
    if (showContents) loadedContents = true;
    if (showSettings) loadedSettings = true;
    if (showAnnotations) loadedAnnotations = true;
    if (showTools) loadedTools = true;
    if (showSearch) loadedSearch = true;
    if (showMetadata) loadedMetadata = true;
    if (showLayers) loadedLayers = true;
  });
</script>

<aside
  class="panel-stack panel-stack--left"
  aria-label={$t('viewer.panels.leftLabel')}
  hidden={!visible}
>
  {#if loadedCollection}
    <div class="panel-slot" hidden={!showCollection}>
      <CollectionPanel
        onclose={() => onpanelToggle?.('collection', false)}
        onselect={oncollectionSelect}
      />
    </div>
  {/if}

  {#if loadedContents}
    <div class="panel-slot" hidden={!showContents || !($mediaType === 'audio' || $mediaType === 'video')}>
      <ContentsPanel onclose={() => onpanelToggle?.('contents', false)} />
    </div>
  {/if}

  {#if loadedSettings}
    <div class="panel-slot" hidden={!showSettings}>
      <SettingsPanel onclose={() => onpanelToggle?.('settings', false)} />
    </div>
  {/if}

  {#if loadedAnnotations}
    <div class="panel-slot" hidden={!showAnnotations}>
      <AnnotationsPanel onclose={() => onpanelToggle?.('annotations', false)} />
    </div>
  {/if}

  {#if loadedTools}
    <div class="panel-slot" hidden={!showTools}>
      <ToolsPanel onclose={() => onpanelToggle?.('tools', false)} />
    </div>
  {/if}

  {#if loadedSearch}
    <div class="panel-slot" hidden={!showSearch}>
      <SearchPanel onclose={() => onpanelToggle?.('search', false)} />
    </div>
  {/if}

  {#if loadedMetadata}
    <div class="panel-slot" hidden={!showMetadata}>
      <MetadataPanel onclose={() => onpanelToggle?.('metadata', false)} />
    </div>
  {/if}

  {#if loadedLayers}
    <div class="panel-slot" hidden={!showLayers}>
      <LayersPanel onclose={() => onpanelToggle?.('layers', false)} />
    </div>
  {/if}

  {#if leftPlugins.length > 0}
    <PluginSlot slot="left" plugins={leftPlugins} context={pluginContext} />
  {/if}
</aside>

<style>
  .panel-stack {
    display: grid;
    gap: 16px;
    align-content: start;
    min-height: 0;
  }

  .panel-stack[hidden],
  .panel-slot[hidden] {
    display: none;
  }

  .panel-stack--left {
    box-sizing: border-box;
    padding: 16px 16px 36px;
    border-radius: 18px;
    background: var(--story-sidebar-bg, var(--viewer-panel, #121922));
    color: var(--story-sidebar-text, var(--viewer-text, #e8edf4));
    border: 1px solid
      var(--story-sidebar-border, var(--viewer-panel-border, rgba(255, 255, 255, 0.08)));
    height: 100%;
    min-height: 0;
    max-height: 100%;
    overflow: auto;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
    overscroll-behavior: contain;
  }

  .panel-stack--left :global(.panel) {
    display: grid;
    gap: 12px;
    padding: 12px;
    border-radius: 14px;
    background: var(--story-sidebar-row-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid transparent;
    box-shadow: none;
    color: var(--story-sidebar-text, var(--viewer-text, #e8edf4));
  }

  .panel-stack--left :global(.panel + .panel) {
    margin-top: 10px;
  }

  .panel-stack--left :global(.panel__header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .panel-stack--left :global(.panel__title) {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--story-sidebar-muted, var(--viewer-muted, rgba(255, 255, 255, 0.65)));
  }

  .panel-stack--left :global(.panel__close) {
    background: var(--story-sidebar-button-bg, var(--viewer-close-button-bg));
    border-color: var(--story-sidebar-button-border, var(--viewer-close-button-border));
  }

  .panel-stack--left :global(.panel__body) {
    color: var(--story-sidebar-text, var(--viewer-text, #e8edf4));
    line-height: 1.4;
    font-size: 13px;
  }

  .panel-stack--left :global(a) {
    color: var(--story-sidebar-link, var(--viewer-accent-3, #ffbf4d));
    font-weight: 600;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
  }

  .panel-stack--left :global(a:visited) {
    color: var(--story-sidebar-link, var(--viewer-accent-3, #ffbf4d));
  }

  .panel-stack--left :global(a:hover),
  .panel-stack--left :global(a:focus-visible) {
    color: var(--story-sidebar-link-hover, var(--viewer-accent, #e07a3f));
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .panel-stack--left :global(.panel__subtext),
  .panel-stack--left :global(.panel__empty),
  .panel-stack--left :global(.panel__hint) {
    color: var(--story-sidebar-muted, var(--viewer-muted, rgba(255, 255, 255, 0.6)));
  }

  :global(.panel) {
    display: grid;
    gap: 10px;
    padding: 14px;
    border-radius: 16px;
    background: var(--viewer-panel);
    border: 1px solid var(--viewer-panel-border);
    font-size: 13px;
  }

  :global(.panel__header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  :global(.panel__title) {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--viewer-muted);
  }

  :global(.panel__close) {
    width: var(--viewer-close-button-size, 28px);
    height: var(--viewer-close-button-size, 28px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--viewer-close-button-border, rgba(255, 255, 255, 0.18));
    border-radius: var(--viewer-close-button-radius, 10px);
    background: var(--viewer-close-button-bg, rgba(255, 255, 255, 0.1));
    color: var(--viewer-close-button-color, var(--viewer-text));
    font-size: var(--viewer-close-button-glyph-size, 15px);
    line-height: 1;
    cursor: pointer;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      transform 0.08s ease;
  }

  :global(.panel__close:hover:not(:disabled)) {
    background: var(--viewer-close-button-hover-bg, rgba(255, 255, 255, 0.16));
    border-color: var(--viewer-close-button-hover-border, rgba(255, 255, 255, 0.34));
  }

  :global(.panel__close:focus-visible) {
    outline: 2px solid var(--viewer-close-button-focus-ring, rgba(42, 199, 255, 0.55));
    outline-offset: 2px;
  }

  :global(.panel__close:active:not(:disabled)) {
    transform: translateY(1px);
  }

  :global(.panel__close:disabled) {
    opacity: 0.45;
    cursor: not-allowed;
  }

  :global(.panel__tabs) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 6px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
  }

  :global(.panel__tab) {
    border: none;
    border-radius: 10px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--viewer-text);
    background: rgba(255, 255, 255, 0.06);
    cursor: pointer;
  }

  :global(.panel__tab--active) {
    background: var(--viewer-accent);
    color: #0b0f14;
  }

  :global(.panel__subtext) {
    font-size: 12px;
    color: var(--viewer-muted);
    text-align: center;
  }

  :global(.panel__body) {
    color: var(--viewer-text);
    line-height: 1.4;
  }

  :global(.panel__empty) {
    color: var(--viewer-muted);
    font-size: 12px;
  }

  :global(.panel__hint) {
    margin-top: 8px;
    font-size: 11px;
    color: var(--viewer-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  @container mango-viewer (max-width: 768px) {
    .panel-stack--left {
      padding: 12px;
    }
  }
</style>
