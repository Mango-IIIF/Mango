<script lang="ts">
  import { t } from '../../i18n';
  import iiifIcon from '../../features/workspace/iiif_bw.svg';
  import {
    ChevronsLeft,
    Download,
    Hammer,
    Image,
    Info,
    ListTree,
    MessageSquare,
    MessageSquareText,
    Quote,
    ScanEye,
    Search,
    Settings,
    Share2,
    SquareSplitHorizontal,
  } from '@lucide/svelte';

  type PanelName =
    | 'thumbnails'
    | 'collection'
    | 'contents'
    | 'search'
    | 'metadata'
    | 'annotations'
    | 'tools'
    | 'settings'
    | 'layers';

  interface Props {
    allowThumbnails?: boolean;
    allowCollection?: boolean;
    allowSearch?: boolean;
    allowMetadata?: boolean;
    allowAnnotations?: boolean;
    allowTools?: boolean;
    allowSettings?: boolean;
    allowContents?: boolean;
    allowChapters?: boolean;
    allowTranscript?: boolean;
    showThumbnails?: boolean;
    showCollection?: boolean;
    showContents?: boolean;
    showSearch?: boolean;
    showMetadata?: boolean;
    showAnnotations?: boolean;
    showTools?: boolean;
    showSettings?: boolean;
    showCompare?: boolean;
    showManifestManager?: boolean;
    multiView?: boolean;
    allowLayers?: boolean;
    showLayers?: boolean;
    compact?: boolean;
    variant?: 'legacy' | 'sidebar';
    mobile?: boolean;
    iconOnly?: boolean;
    galleryActive?: boolean;
    contentsTab?: 'toc' | 'transcript';
    oncollapse?: () => void;
    ongalleryopen?: () => void;
    oncontentsopen?: (tab: 'toc' | 'transcript') => void;
    oncomparetoggle?: () => void;
    onmanifesttoggle?: () => void;
    onpanelToggle?: (payload: { panel: PanelName; open: boolean }) => void;
  }

  let {
    allowThumbnails = true,
    allowCollection = false,
    allowSearch = true,
    allowMetadata = true,
    allowAnnotations = true,
    allowTools = true,
    allowLayers = false,
    allowSettings = false,
    allowContents = false,
    allowChapters = false,
    allowTranscript = false,
    showThumbnails = true,
    showCollection = false,
    showContents = false,
    showSearch = true,
    showMetadata = true,
    showAnnotations = true,
    showTools = false,
    showLayers = false,
    showSettings = false,
    showCompare = false,
    showManifestManager = false,
    multiView = false,
    compact = false,
    variant = 'legacy',
    mobile = false,
    iconOnly = false,
    galleryActive = false,
    contentsTab = 'toc',
    oncollapse = undefined,
    ongalleryopen = undefined,
    oncontentsopen = undefined,
    oncomparetoggle = undefined,
    onmanifesttoggle = undefined,
    onpanelToggle = undefined,
  }: Props = $props();
</script>

{#if variant === 'sidebar' && !mobile}
  <nav
    class="viewer-sidebar"
    class:viewer-sidebar--icon-only={iconOnly}
    aria-label={$t('workspace.sidebar.navigation')}
  >
    <div class="viewer-sidebar__scroll">
    <div class="viewer-sidebar__section">
      <div class="viewer-sidebar__heading">{$t('workspace.sidebar.browse')}</div>
      <div class="viewer-sidebar__items">
        {#if allowThumbnails}
          <button
            class:viewer-sidebar__button--active={galleryActive}
            class="viewer-sidebar__button"
            type="button"
            title={iconOnly ? $t('workspace.sidebar.gallery') : undefined}
            aria-pressed={galleryActive}
            onclick={() => ongalleryopen?.()}
          >
            <Image aria-hidden="true" />
            <span>{$t('workspace.sidebar.gallery')}</span>
          </button>
        {/if}
        {#if allowCollection}
          <button
            class:viewer-sidebar__button--active={showCollection}
            class="viewer-sidebar__button"
            data-tone="collection"
            type="button"
            title={iconOnly ? $t('viewer.panels.collection.title') : undefined}
            aria-pressed={showCollection}
            onclick={() => onpanelToggle?.({ panel: 'collection', open: !showCollection })}
          >
            <ListTree aria-hidden="true" />
            <span>{$t('viewer.panels.collection.title')}</span>
          </button>
        {/if}
        {#if allowMetadata}
          <button
            class:viewer-sidebar__button--active={showMetadata}
            class="viewer-sidebar__button"
            data-tone="info"
            type="button"
            title={iconOnly ? $t('workspace.sidebar.metadata') : undefined}
            aria-pressed={showMetadata}
            disabled={multiView}
            onclick={() => onpanelToggle?.({ panel: 'metadata', open: !showMetadata })}
          >
            <Info aria-hidden="true" />
            <span>{$t('workspace.sidebar.metadata')}</span>
          </button>
        {/if}
        {#if allowSearch}
          <button
            class:viewer-sidebar__button--active={showSearch}
            class="viewer-sidebar__button"
            type="button"
            title={iconOnly ? $t('workspace.sidebar.search') : undefined}
            aria-pressed={showSearch}
            disabled={multiView}
            onclick={() => onpanelToggle?.({ panel: 'search', open: !showSearch })}
          >
            <Search aria-hidden="true" />
            <span>{$t('workspace.sidebar.search')}</span>
          </button>
        {/if}
        {#if allowAnnotations}
          <button
            class:viewer-sidebar__button--active={showAnnotations}
            class="viewer-sidebar__button"
            type="button"
            title={iconOnly ? $t('workspace.sidebar.annotations') : undefined}
            aria-pressed={showAnnotations}
            disabled={multiView}
            onclick={() => onpanelToggle?.({ panel: 'annotations', open: !showAnnotations })}
          >
            <MessageSquare aria-hidden="true" />
            <span>{$t('workspace.sidebar.annotations')}</span>
          </button>
        {/if}
        {#if allowChapters}
          <button
            class:viewer-sidebar__button--active={showContents && contentsTab === 'toc'}
            class="viewer-sidebar__button"
            type="button"
            title={iconOnly ? $t('workspace.sidebar.collections') : undefined}
            aria-pressed={showContents && contentsTab === 'toc'}
            onclick={() => oncontentsopen?.('toc')}
          >
            <ListTree aria-hidden="true" />
            <span>{$t('workspace.sidebar.collections')}</span>
          </button>
        {/if}
        {#if allowTranscript}
          <button
            class:viewer-sidebar__button--active={showContents && contentsTab === 'transcript'}
            class="viewer-sidebar__button"
            type="button"
            title={iconOnly ? $t('workspace.sidebar.transcription') : undefined}
            aria-pressed={showContents && contentsTab === 'transcript'}
            onclick={() => oncontentsopen?.('transcript')}
          >
            <MessageSquareText aria-hidden="true" />
            <span>{$t('workspace.sidebar.transcription')}</span>
          </button>
        {/if}
      </div>
    </div>

    {#if allowLayers}
      <div class="viewer-sidebar__section">
        <div class="viewer-sidebar__heading">{$t('workspace.sidebar.explore')}</div>
        <div class="viewer-sidebar__items">
          <button
            class:viewer-sidebar__button--active={showLayers}
            class="viewer-sidebar__button"
            type="button"
            title={iconOnly ? $t('workspace.sidebar.imageLayers') : undefined}
            aria-pressed={showLayers}
            onclick={() => onpanelToggle?.({ panel: 'layers', open: !showLayers })}
          >
            <ScanEye aria-hidden="true" />
            <span>{$t('workspace.sidebar.imageLayers')}</span>
          </button>
        </div>
      </div>
    {/if}

    <div class="viewer-sidebar__section">
      <div class="viewer-sidebar__heading">{$t('workspace.sidebar.tools')}</div>
      <div class="viewer-sidebar__items">
        <button
          class:viewer-sidebar__button--active={showManifestManager}
          class="viewer-sidebar__button viewer-sidebar__button--iiif"
          type="button"
          title={iconOnly ? $t('workspace.sidebar.iiifManifests') : undefined}
          aria-label={$t('workspace.sidebar.iiifManifests')}
          aria-pressed={showManifestManager}
          onclick={() => onmanifesttoggle?.()}
        >
          <img src={iiifIcon} alt="" />
          <span>{$t('workspace.sidebar.iiifManifests')}</span>
        </button>
        {#if allowTools}
          <button
            class:viewer-sidebar__button--active={showTools}
            class="viewer-sidebar__button"
            type="button"
            title={iconOnly ? $t('workspace.sidebar.tools') : undefined}
            aria-pressed={showTools}
            disabled={multiView}
            onclick={() => onpanelToggle?.({ panel: 'tools', open: !showTools })}
          >
            <Hammer aria-hidden="true" />
            <span>{$t('workspace.sidebar.tools')}</span>
          </button>
        {/if}
        {#if allowSettings}
          <button
            class:viewer-sidebar__button--active={showSettings}
            class="viewer-sidebar__button"
            type="button"
            title={iconOnly ? $t('workspace.sidebar.viewSettings') : undefined}
            aria-pressed={showSettings}
            onclick={() => onpanelToggle?.({ panel: 'settings', open: !showSettings })}
          >
            <Settings aria-hidden="true" />
            <span>{$t('workspace.sidebar.viewSettings')}</span>
          </button>
        {/if}
        <button
          class:viewer-sidebar__button--active={showCompare}
          class="viewer-sidebar__button"
          type="button"
          title={iconOnly ? $t('workspace.sidebar.compare') : undefined}
          aria-pressed={showCompare}
          onclick={() => oncomparetoggle?.()}
        >
          <SquareSplitHorizontal aria-hidden="true" />
          <span>{$t('workspace.sidebar.compare')}</span>
        </button>
        <button
          class="viewer-sidebar__button"
          type="button"
          title={iconOnly ? $t('workspace.sidebar.download') : undefined}
          disabled
        >
          <Download aria-hidden="true" />
          <span>{$t('workspace.sidebar.download')}</span>
        </button>
        <button
          class="viewer-sidebar__button"
          type="button"
          title={iconOnly ? $t('workspace.sidebar.share') : undefined}
          disabled
        >
          <Share2 aria-hidden="true" />
          <span>{$t('workspace.sidebar.share')}</span>
        </button>
        <button
          class="viewer-sidebar__button"
          type="button"
          title={iconOnly ? $t('workspace.sidebar.cite') : undefined}
          disabled
        >
          <Quote aria-hidden="true" />
          <span>{$t('workspace.sidebar.cite')}</span>
        </button>
      </div>
    </div>
    </div>

    <button
      class="viewer-sidebar__collapse"
      type="button"
      title={iconOnly ? $t('workspace.sidebar.collapse') : undefined}
      onclick={() => oncollapse?.()}
    >
      <ChevronsLeft aria-hidden="true" />
      <span>{$t('workspace.sidebar.collapse')}</span>
    </button>
  </nav>
{:else if variant === 'sidebar' && mobile}
  <nav class="viewer-mobile-nav" aria-label={$t('workspace.sidebar.navigation')}>
    <div class="viewer-mobile-nav__group" aria-label={$t('workspace.sidebar.browse')}>
      {#if allowThumbnails}
        <button
          class:viewer-mobile-nav__button--active={galleryActive}
          class="viewer-mobile-nav__button"
          type="button"
          aria-label={$t('workspace.sidebar.gallery')}
          title={$t('workspace.sidebar.gallery')}
          aria-pressed={galleryActive}
          onclick={() => ongalleryopen?.()}
        >
          <Image aria-hidden="true" />
        </button>
      {/if}
      {#if allowCollection}
        <button
          class:viewer-mobile-nav__button--active={showCollection}
          class="viewer-mobile-nav__button"
          data-tone="collection"
          type="button"
          aria-label={$t('viewer.panels.collection.title')}
          title={$t('viewer.panels.collection.title')}
          aria-pressed={showCollection}
          onclick={() => onpanelToggle?.({ panel: 'collection', open: !showCollection })}
        >
          <ListTree aria-hidden="true" />
        </button>
      {/if}
      {#if allowMetadata}
        <button
          class:viewer-mobile-nav__button--active={showMetadata}
          class="viewer-mobile-nav__button"
          data-tone="info"
          type="button"
          aria-label={$t('workspace.sidebar.metadata')}
          title={$t('workspace.sidebar.metadata')}
          aria-pressed={showMetadata}
          disabled={multiView}
          onclick={() => onpanelToggle?.({ panel: 'metadata', open: !showMetadata })}
        >
          <Info aria-hidden="true" />
        </button>
      {/if}
      {#if allowSearch}
        <button
          class:viewer-mobile-nav__button--active={showSearch}
          class="viewer-mobile-nav__button"
          type="button"
          aria-label={$t('workspace.sidebar.search')}
          title={$t('workspace.sidebar.search')}
          aria-pressed={showSearch}
          disabled={multiView}
          onclick={() => onpanelToggle?.({ panel: 'search', open: !showSearch })}
        >
          <Search aria-hidden="true" />
        </button>
      {/if}
      {#if allowAnnotations}
        <button
          class:viewer-mobile-nav__button--active={showAnnotations}
          class="viewer-mobile-nav__button"
          type="button"
          aria-label={$t('workspace.sidebar.annotations')}
          title={$t('workspace.sidebar.annotations')}
          aria-pressed={showAnnotations}
          disabled={multiView}
          onclick={() => onpanelToggle?.({ panel: 'annotations', open: !showAnnotations })}
        >
          <MessageSquare aria-hidden="true" />
        </button>
      {/if}
      {#if allowChapters}
        <button
          class:viewer-mobile-nav__button--active={showContents && contentsTab === 'toc'}
          class="viewer-mobile-nav__button"
          type="button"
          aria-label={$t('workspace.sidebar.collections')}
          title={$t('workspace.sidebar.collections')}
          aria-pressed={showContents && contentsTab === 'toc'}
          onclick={() => oncontentsopen?.('toc')}
        >
          <ListTree aria-hidden="true" />
        </button>
      {/if}
      {#if allowTranscript}
        <button
          class:viewer-mobile-nav__button--active={showContents && contentsTab === 'transcript'}
          class="viewer-mobile-nav__button"
          type="button"
          aria-label={$t('workspace.sidebar.transcription')}
          title={$t('workspace.sidebar.transcription')}
          aria-pressed={showContents && contentsTab === 'transcript'}
          onclick={() => oncontentsopen?.('transcript')}
        >
          <MessageSquareText aria-hidden="true" />
        </button>
      {/if}
    </div>

    {#if allowLayers}
      <div class="viewer-mobile-nav__group" aria-label={$t('workspace.sidebar.explore')}>
        <button
          class:viewer-mobile-nav__button--active={showLayers}
          class="viewer-mobile-nav__button"
          type="button"
          aria-label={$t('workspace.sidebar.imageLayers')}
          title={$t('workspace.sidebar.imageLayers')}
          aria-pressed={showLayers}
          onclick={() => onpanelToggle?.({ panel: 'layers', open: !showLayers })}
        >
          <ScanEye aria-hidden="true" />
        </button>
      </div>
    {/if}

    <div class="viewer-mobile-nav__group" aria-label={$t('workspace.sidebar.tools')}>
      <button
        class:viewer-mobile-nav__button--active={showManifestManager}
        class="viewer-mobile-nav__button viewer-mobile-nav__button--iiif"
        type="button"
        aria-label={$t('workspace.sidebar.iiifManifests')}
        title={$t('workspace.sidebar.iiifManifests')}
        aria-pressed={showManifestManager}
        onclick={() => onmanifesttoggle?.()}
      >
        <img src={iiifIcon} alt="" />
      </button>
      {#if allowTools}
        <button
          class:viewer-mobile-nav__button--active={showTools}
          class="viewer-mobile-nav__button"
          type="button"
          aria-label={$t('workspace.sidebar.tools')}
          title={$t('workspace.sidebar.tools')}
          aria-pressed={showTools}
          disabled={multiView}
          onclick={() => onpanelToggle?.({ panel: 'tools', open: !showTools })}
        >
          <Hammer aria-hidden="true" />
        </button>
      {/if}
      {#if allowSettings}
        <button
          class:viewer-mobile-nav__button--active={showSettings}
          class="viewer-mobile-nav__button"
          type="button"
          aria-label={$t('workspace.sidebar.viewSettings')}
          title={$t('workspace.sidebar.viewSettings')}
          aria-pressed={showSettings}
          onclick={() => onpanelToggle?.({ panel: 'settings', open: !showSettings })}
        >
          <Settings aria-hidden="true" />
        </button>
      {/if}
      <button
        class:viewer-mobile-nav__button--active={showCompare}
        class="viewer-mobile-nav__button"
        type="button"
        aria-label={$t('workspace.sidebar.compare')}
        title={$t('workspace.sidebar.compare')}
        aria-pressed={showCompare}
        onclick={() => oncomparetoggle?.()}
      >
        <SquareSplitHorizontal aria-hidden="true" />
      </button>
      <button class="viewer-mobile-nav__button" type="button" aria-label={$t('workspace.sidebar.download')} title={$t('workspace.sidebar.download')} disabled>
        <Download aria-hidden="true" />
      </button>
      <button class="viewer-mobile-nav__button" type="button" aria-label={$t('workspace.sidebar.share')} title={$t('workspace.sidebar.share')} disabled>
        <Share2 aria-hidden="true" />
      </button>
      <button class="viewer-mobile-nav__button" type="button" aria-label={$t('workspace.sidebar.cite')} title={$t('workspace.sidebar.cite')} disabled>
        <Quote aria-hidden="true" />
      </button>
    </div>
  </nav>
{:else}
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
      onclick={() => onpanelToggle?.({ panel: 'thumbnails', open: !showThumbnails })}
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
  {#if allowCollection}
    <button
      class:viewer__dock-button--active={showCollection}
      class="viewer__dock-button"
      data-tone="collection"
      data-label={showCollection
        ? $t('viewer.stage.controls.hideCollection')
        : $t('viewer.stage.controls.showCollection')}
      type="button"
      aria-pressed={showCollection}
      aria-label={$t('viewer.stage.controls.toggleCollection')}
      onclick={() => onpanelToggle?.({ panel: 'collection', open: !showCollection })}
    >
      <span class="viewer__dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="6" height="6" rx="1"></rect>
          <rect x="14" y="4" width="6" height="6" rx="1"></rect>
          <rect x="4" y="14" width="6" height="6" rx="1"></rect>
          <rect x="14" y="14" width="6" height="6" rx="1"></rect>
        </svg>
      </span>
      <span class="viewer__dock-label">{$t('viewer.dock.collection')}</span>
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
      onclick={() => onpanelToggle?.({ panel: 'contents', open: !showContents })}
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
      onclick={() => onpanelToggle?.({ panel: 'metadata', open: !showMetadata })}
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
      onclick={() => onpanelToggle?.({ panel: 'search', open: !showSearch })}
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
      onclick={() => onpanelToggle?.({ panel: 'annotations', open: !showAnnotations })}
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
      disabled={multiView}
      onclick={() => onpanelToggle?.({ panel: 'tools', open: !showTools })}
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
      onclick={() => onpanelToggle?.({ panel: 'layers', open: !showLayers })}
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
      data-label={showSettings ? $t('workspace.hideSettings') : $t('workspace.showSettings')}
      type="button"
      aria-pressed={showSettings}
      aria-label={$t('workspace.toggleSettings')}
      onclick={() => onpanelToggle?.({ panel: 'settings', open: !showSettings })}
    >
      <span class="viewer__dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"></path>
          <path
            d="M19.2 13.1v-2.2l-1.9-.5a5.8 5.8 0 0 0-.5-1.2l1.1-1.7-1.6-1.6-1.7 1.1a5.8 5.8 0 0 0-1.2-.5L13.1 4h-2.2l-.5 1.9a5.8 5.8 0 0 0-1.2.5L7.5 5.3 5.9 6.9 7 8.6a5.8 5.8 0 0 0-.5 1.2l-1.9.5v2.2l1.9.5c.1.4.3.8.5 1.2l-1.1 1.7 1.6 1.6 1.7-1.1c.4.2.8.4 1.2.5l.5 1.9h2.2l.5-1.9c.4-.1.8-.3 1.2-.5l1.7 1.1 1.6-1.6-1.1-1.7c.2-.4.4-.8.5-1.2l1.9-.5z"
          ></path>
        </svg>
      </span>
      <span class="viewer__dock-label">{$t('workspace.settings')}</span>
    </button>
  {/if}
</div>
{/if}

<style>
  .viewer-mobile-nav {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: 2px 3px 5px;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--viewer-panel-border) transparent;
    touch-action: pan-x;
    -webkit-overflow-scrolling: touch;
  }

  .viewer-mobile-nav::-webkit-scrollbar {
    height: 4px;
  }

  .viewer-mobile-nav::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: var(--viewer-panel-border);
  }

  .viewer-mobile-nav__group {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    gap: 4px;
  }

  .viewer-mobile-nav__group + .viewer-mobile-nav__group {
    padding-left: 10px;
    border-left: 1px solid var(--viewer-panel-border);
  }

  .viewer-mobile-nav__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 44px;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.025);
    color: var(--viewer-text);
    cursor: pointer;
  }

  .viewer-mobile-nav__button :global(svg) {
    width: 19px;
    height: 19px;
    stroke-width: 1.8;
  }

  .viewer-mobile-nav__button--active {
    border-color: var(--viewer-accent-2);
    background: rgba(42, 199, 255, 0.09);
    color: var(--viewer-text);
  }

  .viewer-mobile-nav__button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .viewer-sidebar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
    transition: gap 220ms ease;
  }

  .viewer-sidebar__scroll {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 34px;
    min-height: 0;
    padding: 0 4px 8px 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: rgba(151, 165, 179, 0.42) transparent;
    transition: gap 220ms ease;
  }

  .viewer-sidebar__scroll::-webkit-scrollbar {
    width: 6px;
  }

  .viewer-sidebar__scroll::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(151, 165, 179, 0.42);
  }

  .viewer-sidebar__section,
  .viewer-sidebar__items {
    display: grid;
  }

  .viewer-sidebar__section {
    gap: 14px;
    transition: gap 220ms ease;
  }

  .viewer-sidebar__items {
    gap: 10px;
  }

  .viewer-sidebar__heading {
    padding-inline: 8px;
    color: var(--viewer-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    max-height: 18px;
    opacity: 1;
    overflow: hidden;
    transition:
      max-height 180ms ease,
      opacity 140ms ease,
      padding 180ms ease;
  }

  .viewer-sidebar__button,
  .viewer-sidebar__collapse {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 46px;
    box-sizing: border-box;
    padding: 10px 12px;
    border: 1px solid var(--viewer-panel-border);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.025);
    color: var(--viewer-text);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease,
      gap 220ms ease,
      padding 220ms ease;
  }

  .viewer-sidebar__button span,
  .viewer-sidebar__collapse span {
    max-width: 160px;
    opacity: 1;
    overflow: hidden;
    white-space: nowrap;
    transform: translateX(0);
    transition:
      max-width 220ms ease,
      opacity 140ms ease,
      transform 220ms ease;
  }

  .viewer-sidebar__button :global(svg),
  .viewer-sidebar__collapse :global(svg) {
    width: 20px;
    height: 20px;
    flex: 0 0 20px;
    stroke-width: 1.8;
  }

  .viewer-sidebar__button--iiif img,
  .viewer-mobile-nav__button--iiif img {
    width: 20px;
    height: 20px;
    flex: 0 0 20px;
    filter: invert(1);
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia'])) .viewer-sidebar__button--iiif img,
  :global(.viewer:is([data-theme='light'], [data-theme='sepia'])) .viewer-mobile-nav__button--iiif img {
    filter: none;
  }

  .viewer-sidebar__button:hover:not(:disabled),
  .viewer-sidebar__collapse:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .viewer-sidebar__button--active {
    border-color: var(--viewer-accent-2);
    background: rgba(42, 199, 255, 0.09);
    box-shadow: inset 0 0 0 1px rgba(42, 199, 255, 0.12);
  }

  .viewer-sidebar__button:disabled {
    opacity: 0.38;
    cursor: not-allowed;
  }

  .viewer-sidebar__collapse {
    flex: 0 0 auto;
    min-height: 38px;
    margin-top: 0;
    border-color: transparent;
    background: transparent;
    color: var(--viewer-muted);
  }

  .viewer-sidebar--icon-only .viewer-sidebar__scroll {
    gap: 22px;
  }

  .viewer-sidebar--icon-only .viewer-sidebar__section {
    gap: 0;
  }

  .viewer-sidebar--icon-only .viewer-sidebar__section + .viewer-sidebar__section {
    padding-top: 18px;
    border-top: 1px solid var(--viewer-panel-border);
  }

  .viewer-sidebar--icon-only .viewer-sidebar__heading {
    max-height: 0;
    padding: 0;
    opacity: 0;
  }

  .viewer-sidebar--icon-only .viewer-sidebar__button,
  .viewer-sidebar--icon-only .viewer-sidebar__collapse {
    min-height: 44px;
    gap: 0;
    padding: 10px 15px;
  }

  .viewer-sidebar--icon-only .viewer-sidebar__button span,
  .viewer-sidebar--icon-only .viewer-sidebar__collapse span {
    max-width: 0;
    opacity: 0;
    transform: translateX(-8px);
  }

  @media (prefers-reduced-motion: reduce) {
    .viewer-sidebar,
    .viewer-sidebar__scroll,
    .viewer-sidebar__section,
    .viewer-sidebar__heading,
    .viewer-sidebar__button,
    .viewer-sidebar__collapse,
    .viewer-sidebar__button span,
    .viewer-sidebar__collapse span {
      transition: none;
    }
  }

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
    color: var(--viewer-accent-2);
    border-color: var(--viewer-dock-active-border, rgba(42, 199, 255, 0.58));
    box-shadow:
      0 0 0 1px var(--viewer-dock-active-ring, rgba(42, 199, 255, 0.22)),
      var(--viewer-dock-active-shadow-base, 0 12px 24px rgba(0, 0, 0, 0.35));
  }

  .viewer__dock-button--active .viewer__dock-info-chip {
    background: var(--viewer-accent-2);
    border-color: var(--viewer-accent-2);
    color: var(--viewer-dock-active-chip-text, #0b0f14);
  }

  @media (max-width: 900px) {
    .viewer__dock {
      top: auto;
      bottom: 16px;
      right: 16px;
      transform: none;
      grid-auto-flow: column;
      grid-template-columns: repeat(auto-fit, minmax(32px, 1fr));
      gap: 4px;
    }

    .viewer__dock-button,
    .viewer__dock--compact .viewer__dock-button {
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }

    .viewer__dock-icon,
    .viewer__dock-icon svg {
      width: 18px;
      height: 18px;
    }

    .viewer__dock-icon--info {
      width: 20px;
      height: 20px;
    }

    .viewer__dock-info-chip {
      width: 19px;
      height: 19px;
      font-size: 14px;
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
