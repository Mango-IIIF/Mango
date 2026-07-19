<script lang="ts">
  import { getViewerContext } from '../context';
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
  import ComparePanel from './ComparePanel.svelte';
  import CollectionPanel from './CollectionPanel.svelte';
  import type { CollectionSelection } from '@mango-iiif/collection-navigator';

  interface Props {
    visible?: boolean;
    showCollection?: boolean;
    showAnnotations?: boolean;
    showTools?: boolean;
    showContents?: boolean;
    showSearch?: boolean;
    showMetadata?: boolean;
    showSettings?: boolean;
    showLayers?: boolean;
    showCompare?: boolean;
    redesigned?: boolean;
    contentsTab?: 'toc' | 'transcript';
    leftPlugins?: ViewerPlugin[];
    pluginContext: Omit<PluginContext, 'mount'>;
    onpanelToggle?: (panel: 'collection' | 'annotations' | 'tools' | 'search' | 'metadata' | 'contents' | 'settings' | 'layers' | 'compare', open: boolean) => void;
    oncollectionSelect?: (selection: CollectionSelection) => void;
  }

  let {
    visible = true,
    showCollection = false,
    showAnnotations = false,
    showTools = false,
    showContents = false,
    showSearch = false,
    showMetadata = false,
    showSettings = false,
    showLayers = false,
    showCompare = false,
    redesigned = false,
    contentsTab = 'toc',
    leftPlugins = [],
    pluginContext,
    onpanelToggle,
    oncollectionSelect,
  }: Props = $props();

  const viewer = getViewerContext();
  const mediaType = viewer.derived.mediaType;
  let loaded = $state({
    collection: false,
    contents: false,
    settings: false,
    compare: false,
    annotations: false,
    tools: false,
    search: false,
    metadata: false,
    layers: false,
  });

  $effect(() => {
    if (showCollection) loaded.collection = true;
    if (showContents) loaded.contents = true;
    if (showSettings) loaded.settings = true;
    if (showCompare) loaded.compare = true;
    if (showAnnotations) loaded.annotations = true;
    if (showTools) loaded.tools = true;
    if (showSearch) loaded.search = true;
    if (showMetadata) loaded.metadata = true;
    if (showLayers) loaded.layers = true;
  });
</script>

<aside
  class="panel-stack panel-stack--left"
  class:panel-stack--redesigned={redesigned}
  hidden={!visible}
  aria-label={$t('viewer.panels.leftLabel')}
>
  {#if loaded.collection}
    <div hidden={!showCollection}>
      <CollectionPanel
        onclose={() => onpanelToggle?.('collection', false)}
        onselect={oncollectionSelect}
      />
    </div>
  {/if}

  {#if loaded.contents}
    <div hidden={!showContents || !($mediaType === 'audio' || $mediaType === 'video')}>
      <ContentsPanel
        {redesigned}
        selectedTab={contentsTab}
        onclose={() => onpanelToggle?.('contents', false)}
      />
    </div>
  {/if}

  {#if loaded.settings}
    <div hidden={!showSettings}>
      <SettingsPanel
        {redesigned}
        onclose={() => onpanelToggle?.('settings', false)}
      />
    </div>
  {/if}

  {#if loaded.compare}
    <div hidden={!showCompare}>
      <ComparePanel onclose={() => onpanelToggle?.('compare', false)} />
    </div>
  {/if}

  {#if loaded.annotations}
    <div hidden={!showAnnotations}>
      <AnnotationsPanel
        {redesigned}
        onclose={() => onpanelToggle?.('annotations', false)}
      />
    </div>
  {/if}

  {#if loaded.tools}
    <div hidden={!showTools}>
      <ToolsPanel
        {redesigned}
        onclose={() => onpanelToggle?.('tools', false)}
      />
    </div>
  {/if}

  {#if loaded.search}
    <div hidden={!showSearch}>
      <SearchPanel
        {redesigned}
        onclose={() => onpanelToggle?.('search', false)}
      />
    </div>
  {/if}

  {#if loaded.metadata}
    <div hidden={!showMetadata}>
      <MetadataPanel
        {redesigned}
        onclose={() => onpanelToggle?.('metadata', false)}
      />
    </div>
  {/if}

  {#if loaded.layers}
    <div hidden={!showLayers}>
      <LayersPanel
        {redesigned}
        onclose={() => onpanelToggle?.('layers', false)}
      />
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

  .panel-stack[hidden] {
    display: none !important;
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

  .panel-stack--left.panel-stack--redesigned {
    padding: 18px 24px 28px;
    border-radius: 0 18px 18px 0;
    background: rgba(18, 25, 34, 0.72);
    box-shadow: none;
    transform-origin: left center;
    animation: viewer-secondary-panel-enter 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia'])) .panel-stack--left.panel-stack--redesigned {
    border-color: rgba(34, 48, 65, 0.12);
    background: rgba(233, 237, 243, 0.9);
  }

  :global(.viewer[data-theme='sepia']) .panel-stack--left.panel-stack--redesigned {
    border-color: rgba(76, 58, 35, 0.16);
    background: rgba(232, 220, 198, 0.92);
  }

  :global(.viewer[data-theme='midnight']) .panel-stack--left.panel-stack--redesigned {
    border-color: rgba(126, 180, 235, 0.15);
    background: rgba(7, 19, 33, 0.9);
  }

  .panel-stack--left.panel-stack--redesigned :global(.panel) {
    gap: 18px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .panel-stack--left.panel-stack--redesigned :global(.panel__header) {
    min-height: 46px;
  }

  .panel-stack--left.panel-stack--redesigned :global(.panel__title) {
    color: var(--viewer-text);
    font-size: 24px;
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
  }

  .panel-stack--left.panel-stack--redesigned :global(.panel__close) {
    width: 38px;
    height: 38px;
    font-size: 19px;
  }

  .panel-stack--left.panel-stack--redesigned :global(.panel__body) {
    font-size: 13px;
    line-height: 1.55;
  }

  @keyframes viewer-secondary-panel-enter {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel-stack--left.panel-stack--redesigned {
      animation: none;
    }
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
    color: var(--story-sidebar-link, var(--viewer-accent-2, #2ac7ff));
    font-weight: 600;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
  }

  .panel-stack--left :global(a:visited) {
    color: var(--story-sidebar-link, var(--viewer-accent-2, #2ac7ff));
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
    border: 1px solid rgba(42, 199, 255, 0.64);
    background: rgba(42, 199, 255, 0.14);
    color: #f5fbff;
    box-shadow: inset 0 0 0 1px rgba(42, 199, 255, 0.08);
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia'])) .panel-stack--left :global(.panel__tab) {
    background: rgba(255, 255, 255, 0.78);
    color: #223041;
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia'])) .panel-stack--left :global(.panel__tab--active) {
    border-color: #159fce;
    background: rgba(42, 199, 255, 0.13);
    color: #16435a;
    box-shadow: inset 0 0 0 1px rgba(21, 159, 206, 0.1);
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
