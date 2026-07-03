<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';
  import PluginSlot from '../../plugins/PluginSlot.svelte';
  import type { PluginContext, ViewerPlugin } from '../../core/types/plugin';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import type { ImageFilters } from '../../core/types/filters';
  import type { MediaType } from '../../iiif/mediaResolver';
  import type { ManifestAttribution, ManifestMetadataItem } from '../iiif/manifestMetadata';
  import type { TocEntry, TranscriptEntry } from '../../iiif/avResolver';
  import type { MediaSource } from '../../iiif/mediaResolver';
  import AnnotationsPanel from './AnnotationsPanel.svelte';
  import ToolsPanel from './ToolsPanel.svelte';
  import SearchPanel from './SearchPanel.svelte';
  import MetadataPanel from './MetadataPanel.svelte';
  import ContentsPanel from './ContentsPanel.svelte';
  import SettingsPanel from './SettingsPanel.svelte';
  import LayersPanel from './LayersPanel.svelte';

  export let showAnnotations = false;
  export let showTools = false;
  export let showContents = false;
  export let showSearch = false;
  export let showMetadata = false;
  export let showSettings = false;
  export let showLayers = false;
  export let layers: MediaSource[] = [];
  export let layerOpacities: Record<string, number> = {};
  export let annotationMode: 'edit' | 'create' = 'edit';
  export let allowCreateMode = false;
  export let overlayAnnotations: ResolvedAnnotation[] = [];
  export let activeAnnotationId: string | null = null;
  export let searchQuery = '';
  export let searchHits: ResolvedAnnotation[] = [];
  export let selectedSearchResultId: string | null = null;
  export let mediaType: MediaType | null = null;
  export let imageFilters: ImageFilters;
  export let manifestTitle = '';
  export let manifestDescription = '';
  export let manifestAttribution: ManifestAttribution = { label: '', value: '' };
  export let manifestLicence = '';
  export let manifestMetadata: ManifestMetadataItem[] = [];
  export let tocEntries: TocEntry[] = [];
  export let transcriptEntries: TranscriptEntry[] = [];
  export let activeTranscriptId: string | null = null;
  export let leftPlugins: ViewerPlugin[] = [];
  export let pluginContext: Omit<PluginContext, 'mount'>;
  export let layoutMode: 'single' | 'two-page' | 'continuous' | 'gallery' = 'single';

  const dispatch = createEventDispatcher<{
    panelToggle: { panel: 'annotations' | 'tools' | 'search' | 'metadata' | 'contents' | 'settings' | 'layers'; open: boolean };
    updateLayerOpacity: { id: string; opacity: number };
    annotationModeChange: { mode: 'edit' | 'create' };
    annotationSelect: { id: string };
    searchQueryChange: { value: string };
    searchResultClick: { annotation: ResolvedAnnotation };
    updateImageFilter: { key: keyof ImageFilters; value: ImageFilters[keyof ImageFilters] };
    resetImageFilters: void;
    mediaSeek: { canvasId?: string | null; time: number };
    settingsLayoutChange: { layout: '1x1' | '1x2' | '2x1' | '2x2' };
    settingsLayoutModeChange: { mode: 'single' | 'two-page' | 'continuous' | 'gallery' };
    settingsThemeChange: { theme: 'dark' | 'light' };
    settingsLocaleChange: { locale: string };
  }>();

  export let settingsLayout: '1x1' | '1x2' | '2x1' | '2x2' = '1x1';
  export let settingsTheme: 'dark' | 'light' = 'dark';
  export let settingsLocale = 'en';
</script>

<aside class="panel-stack panel-stack--left" aria-label={$t('viewer.panels.leftLabel')}>
  {#if showContents && (mediaType === 'audio' || mediaType === 'video') && (tocEntries.length > 0 || transcriptEntries.length > 0)}
    <ContentsPanel
      {tocEntries}
      {transcriptEntries}
      {activeTranscriptId}
      on:close={() => dispatch('panelToggle', { panel: 'contents', open: false })}
      on:seek={(event) => dispatch('mediaSeek', event.detail)}
    />
  {/if}

  {#if showSettings}
    <SettingsPanel
      layout={settingsLayout}
      theme={settingsTheme}
      locale={settingsLocale}
      {layoutMode}
      onclose={() => dispatch('panelToggle', { panel: 'settings', open: false })}
      onlayoutchange={(layout) => dispatch('settingsLayoutChange', { layout })}
      onthemechange={(theme) => dispatch('settingsThemeChange', { theme })}
      onlocalechange={(locale) => dispatch('settingsLocaleChange', { locale })}
      onlayoutmodechange={(mode) => dispatch('settingsLayoutModeChange', { mode })}
    />
  {/if}

  {#if showAnnotations}
    <AnnotationsPanel
      {annotationMode}
      {allowCreateMode}
      {overlayAnnotations}
      {activeAnnotationId}
      onclose={() => dispatch('panelToggle', { panel: 'annotations', open: false })}
      onmodechange={(detail) => dispatch('annotationModeChange', { mode: detail.mode })}
      onannotationselect={(detail) => dispatch('annotationSelect', { id: detail.id })}
    />
  {/if}

  {#if showTools}
    <ToolsPanel
      {mediaType}
      {imageFilters}
      on:close={() => dispatch('panelToggle', { panel: 'tools', open: false })}
      on:updateFilter={(event) =>
        dispatch('updateImageFilter', event.detail)}
      on:reset={() => dispatch('resetImageFilters')}
    />
  {/if}

  {#if showSearch}
    <SearchPanel
      {searchQuery}
      {searchHits}
      {selectedSearchResultId}
      on:close={() => dispatch('panelToggle', { panel: 'search', open: false })}
      on:queryChange={(event) =>
        dispatch('searchQueryChange', { value: event.detail.value })}
      on:resultClick={(event) =>
        dispatch('searchResultClick', { annotation: event.detail.annotation })}
    />
  {/if}

  {#if showMetadata}
    <MetadataPanel
      {manifestTitle}
      {manifestDescription}
      {manifestAttribution}
      {manifestLicence}
      {manifestMetadata}
      on:close={() =>
        dispatch('panelToggle', { panel: 'metadata', open: false })}
    />
  {/if}

  {#if showLayers && layers.length > 0}
    <LayersPanel
      {layers}
      {layerOpacities}
      onclose={() => dispatch('panelToggle', { panel: 'layers', open: false })}
      onopacitychange={(detail) => dispatch('updateLayerOpacity', detail)}
    />
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
