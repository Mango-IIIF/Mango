<script lang="ts">
  import { onDestroy, onMount, setContext } from 'svelte';
  import { get, writable } from 'svelte/store';
  import { t } from '../../core/i18n';
  import { normaliseViewerConfig } from '../../core/config/normalise';
  import type { ViewerEventMap } from '../../core/types/events';
  import type { ViewerConfig } from '../../core/types/config';
  import type { ChapterAnnotationTool } from '../../core/types/story';
  import type { ContentSize, ViewBox } from '../../core/types/viewer';
  import type { ViewerPlugin } from '../../core/types/plugin';
  import type { ModelPose, ModelPoseOptions } from '../../core/types/model';
  import type { ViewerApi } from '../../core/types/viewer-api';
  import PluginSlot from '../../plugins/PluginSlot.svelte';
  import MangoFooterBrand from '../../story/ui/MangoFooterBrand.svelte';
  import { createAnnotationFocusPlugin } from '../../plugins/annotationFocus';
  import ViewerHeader from '../../viewer/ui/ViewerHeader.svelte';
  import LeftPanelStack from '../../viewer/ui/LeftPanelStack.svelte';
  import ViewerDock from '../../viewer/ui/ViewerDock.svelte';
  import Stage from '../../viewer/ui/Stage.svelte';
  import StageGalleryView from '../../viewer/ui/StageGalleryView.svelte';
  import StageToolbar from '../../viewer/ui/StageToolbar.svelte';
  import Gallery from '../../viewer/ui/Gallery.svelte';
  import type { LayerItem } from '../annotations/workspace/LeftSidebar.svelte';
  import {
    applyResolvedPatch,
    createMangoAnnotation,
    projectToResolved,
    resolveAnnotationJson,
    shapeFromResolved,
    shapeTool,
  } from '../annotations/canonical';
  import { buildLayerStylesheet, colorFromInlineStyle, styleClassForLayer } from '../annotations/style';
  import {
    archiveLayer,
    createLayer,
    mergeDiscoveredLayers,
    moveLayer,
    recolourLayer,
    renameLayer,
    resolveActiveLayer,
    setLayerVisibility,
  } from '../annotations/layers';
  import { exportAnnotationPage } from '../annotations/export';
  import { STORY_LABEL_SIZING } from '../annotations/rectangleLabelLayout';
  import { normaliseAuthoringLanguages } from '../annotations/languages';
  import type { AnnotationSaveState } from '../annotations/model';
  import {
    createCommandStack,
    labelForPatch,
    type CommandStackState,
  } from '../annotations/commands';
  import type { OSDAnnotationEditor } from '@mango-iiif/annotation';
  import type { CanonicalStylesheet } from '@mango-iiif/w3c-parser';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import { createViewerState } from '../../viewer/state/viewerState';
  import { createViewerDerived } from '../../viewer/state/viewerDerived';
  import { createViewerController } from '../../viewer/state/viewerController';
  import { manifestsStore, fetchManifest } from '../../core/state/manifests';
  import { resolveCanvasThumbnail } from '../../viewer/iiif/thumbnails';
  import type { RendererEventHandlers } from '../../viewer/types/rendererEvents';
  import {
    normaliseStoryInput,
    validateStoryViewer,
    type StoryWithDefaults,
  } from '../../story/viewer/storyLoader';
  import { createStoryViewerRuntime } from '../../story/viewer/storyViewerController';
  import { createStoryPlayback } from '../../story/viewer/storyPlayback.svelte';
  import { ViewportState, VIEWPORT_STATE_CONTEXT_KEY } from '../../core/state/viewportState.svelte';
  import { setLocale } from '../../core/i18n';
  import GridContainer from '../workspace/GridContainer.svelte';
  import ManifestManager from '../workspace/ManifestManager.svelte';
  import { WorkspaceStore } from '../workspace/workspaceStore.svelte';
  import { parseURLHash } from '../../viewer/osd/URLStateManager';
  import { resolveInitialViewerState } from '../../viewer/initialization/viewerInitializer';
  import { ChevronsRight, Expand, Shrink } from '@lucide/svelte';
  import {
    isViewerSettingsTheme,
    setViewerContext,
    type ViewerSettingsTheme,
  } from '../../viewer/context';
  import {
    createViewerFullscreenController,
    isIPadLikeDevice,
  } from '../../viewer/lifecycle/fullscreen';
  import { observeResponsiveLayout } from '../../viewer/lifecycle/responsiveLayout';
  import type { Component } from 'svelte';
  import { findFirstManifestId } from '../../viewer/iiif/collectionNavigation';
  import { navigateMango } from '@mango-iiif/collection-navigator/mango';
  import type { CollectionSelection } from '@mango-iiif/collection-navigator';

  interface Props {
    manifestId?: string;
    config?: ViewerConfig | undefined;
    plugins?: ViewerPlugin[];
    mode?: string | undefined;
    story?: string | Record<string, unknown> | undefined;
    storyUrl?: string | undefined;
    onstoryViewerError?: (payload: { message: string; cause?: unknown }) => void;
    canvasIndex?: number | undefined;
    oncanvaschange?: ((detail: { canvasIndex: number }) => void) | undefined;
  }

  const DEFAULT_ANNOTATION_LAYERS: LayerItem[] = [
    { id: 'research', name: 'Research Notes', color: '#fb7185', visible: true },
    {
      id: 'transcription',
      name: 'Transcription',
      color: '#60a5fa',
      visible: true,
    },
    { id: 'highlights', name: 'Highlights', color: '#34d399', visible: true },
    { id: 'mine', name: 'My Annotations', color: '#a78bfa', visible: true },
  ];
  // Portrait tablets need the same single-column treatment as phones. Keeping
  // the desktop rail at iPad widths leaves a narrow stage inside a tall host.
  const MOBILE_LAYOUT_WIDTH = 1024;
  const SHORT_LAYOUT_HEIGHT = 500;

  const matchesInitialMobileLayout = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(`(max-width: ${MOBILE_LAYOUT_WIDTH}px)`).matches;

  let {
    manifestId = $bindable(''),
    config = undefined,
    plugins = [],
    mode = undefined,
    story = undefined,
    storyUrl = undefined,
    onstoryViewerError = undefined,
    canvasIndex = undefined,
    oncanvaschange = undefined,
  }: Props = $props();
  const initialMobileLayout = matchesInitialMobileLayout();

  const corePlugins = [createAnnotationFocusPlugin()];
  const normaliseConfigForMode = (value?: ViewerConfig): ViewerConfig => {
    const next = normaliseViewerConfig(value);
    const isPlainViewer = !mode || mode === 'viewer';
    if (!isPlainViewer || next.sidebar?.open !== undefined) return next;
    return {
      ...next,
      sidebar: {
        ...next.sidebar,
        open: false,
      },
    };
  };
  const initialViewerConfig = () => normaliseConfigForMode(config);
  const initialNormalisedConfig = initialViewerConfig();
  let normalisedConfig: ViewerConfig = $state(initialNormalisedConfig);
  const initialViewState = resolveInitialViewerState(
    initialNormalisedConfig,
    typeof window !== 'undefined' ? parseURLHash(window.location.hash) : {},
  );
  let StoryControlsStageComponent: Component | null = $state(null);
  let StoryAnnotationOverlayComponent: Component | null = $state(null);
  let AnnotationWorkspaceComponent: Component | null = $state(null);
  let storyComponentsLoading = false;
  let annotationWorkspaceLoading = false;
  const createInitialViewerState = () =>
    createViewerState({
      manifestId,
      config: normalisedConfig,
      plugins: [...corePlugins],
      ...initialViewState,
      selectedCanvasIndex: canvasIndex ?? initialViewState.selectedCanvasIndex,
    });
  const viewerState = createInitialViewerState();
  const viewerDerived = createViewerDerived(viewerState);
  const initialReportedCanvasIndex = () => canvasIndex ?? get(viewerState.selectedCanvasIndex);
  let lastReportedCanvasIndex = initialReportedCanvasIndex();
  let stageRef: ReturnType<typeof Stage> | null = $state(null);
  const controller = createViewerController({
    state: viewerState,
    derived: viewerDerived,
    dispatch: (event, payload) => {
      if (event === 'storyViewerError') {
        onstoryViewerError?.(payload as ViewerEventMap['storyViewerError']);
      }
    },
    applyViewBox: (box) => stageRef?.setViewBox?.(box),
  });

  const {
    manifestEntry,
    collectionEntry,
    canvases,
    canvasThumbnails,
    mediaSource,
    mediaType,
    rendererComponent,
    annotations,
    overlayAnnotations,
    highlightIds,
    pluginSlots,
    leftVisible,
    rightVisible,
    allowThumbnails,
    allowCollection,
    allowMetadata,
    allowSearch,
    allowAnnotations,
    allowTools,
    allowLayers,
    mediaSources,
    contentsAvailable,
    avChaptersAvailable,
    avTranscriptAvailable,
    activeLayoutImages,
  } = viewerDerived;
  const avController = viewerDerived.av.controller;

  const loadStoryViewerComponents = async () => {
    if (StoryControlsStageComponent && StoryAnnotationOverlayComponent) return;
    if (storyComponentsLoading) return;
    storyComponentsLoading = true;
    const [controls, overlay] = await Promise.all([
      import('../../story/viewer/StoryControlsStage.svelte'),
      import('../../story/ui/StoryAnnotationOverlay.svelte'),
    ]);
    StoryControlsStageComponent = controls.default;
    StoryAnnotationOverlayComponent = overlay.default;
    storyComponentsLoading = false;
  };

  const loadAnnotationWorkspaceComponent = async () => {
    if (AnnotationWorkspaceComponent) return;
    if (annotationWorkspaceLoading) return;
    annotationWorkspaceLoading = true;
    const workspace = await import('../annotations/workspace/AnnotationWorkspace.svelte');
    AnnotationWorkspaceComponent = workspace.default;
    annotationWorkspaceLoading = false;
  };

  const {
    selectedCanvasIndex,
    zoom,
    showThumbnails,
    showCollection,
    showMetadata,
    showSearch,
    showAnnotations,
    showTools,
    showSettings,
    showContents,
    showLayers,
    layerOpacities,
    layoutMode,
    rotation,
    annotationMode,
    activeAnnotationId,
    hoverAnnotationId,
    imageFilters,
    userAnnotations,
  } = viewerState;
  const viewportState = new ViewportState();
  setContext(VIEWPORT_STATE_CONTEXT_KEY, viewportState);

  let isMobileLayout = $state(initialMobileLayout);
  let isShortLayout = $state(false);
  let sidebarCollapsed = $state(false);
  let sidebarEnabled = $derived(normalisedConfig.sidebar?.enabled !== false);
  let sidebarPosition = $derived(normalisedConfig.sidebar?.position ?? 'left');

  let canZoom = $state(false);
  let hasSource = $derived(Boolean($mediaSource));
  let showThumbnailsEffective = $derived($showThumbnails && $allowThumbnails);
  let showSearchEffective = $derived($showSearch && $allowSearch);
  let showAnnotationsEffective = $derived($showAnnotations && $allowAnnotations);
  let showToolsEffective = $derived($showTools && $allowTools);
  const toolbarAboveMedia = false;
  let isStoryViewer = $derived(mode === 'story-viewer');
  let isStoryBuilder = $derived(mode === 'story-builder');
  let isAnnotationEditor = $derived(mode === 'annotation-editor');
  let annotationLanguages = $derived(
    normaliseAuthoringLanguages(
      normalisedConfig.annotations?.languages,
      normalisedConfig.language ?? 'en',
    ),
  );
  let isPlainViewerMode = $derived(!mode || mode === 'viewer');
  const VIEWER_CONTROLS_IDLE_MS = 2800;
  let viewerControlsVisible = $state(true);
  let viewerControlsIdleTimer: ReturnType<typeof setTimeout> | undefined;

  const clearViewerControlsIdleTimer = () => {
    if (viewerControlsIdleTimer !== undefined) {
      clearTimeout(viewerControlsIdleTimer);
      viewerControlsIdleTimer = undefined;
    }
  };

  const scheduleViewerControlsFade = () => {
    if (!isPlainViewerMode) return;
    clearViewerControlsIdleTimer();
    viewerControlsIdleTimer = setTimeout(() => {
      viewerControlsVisible = false;
      viewerControlsIdleTimer = undefined;
    }, VIEWER_CONTROLS_IDLE_MS);
  };

  const revealViewerControls = () => {
    if (!isPlainViewerMode) return;
    viewerControlsVisible = true;
    scheduleViewerControlsFade();
  };

  const handleViewerControlsFocusIn = () => {
    if (!isPlainViewerMode) return;
    viewerControlsVisible = true;
    clearViewerControlsIdleTimer();
  };

  const handleViewerControlsFocusOut = (event: FocusEvent) => {
    const frame = event.currentTarget as HTMLElement;
    if (event.relatedTarget instanceof Node && frame.contains(event.relatedTarget)) return;
    scheduleViewerControlsFade();
  };

  const trackViewerControlsActivity = (frame: HTMLElement) => {
    const handleFocusOut = (event: FocusEvent) => handleViewerControlsFocusOut(event);
    frame.addEventListener('pointermove', revealViewerControls);
    frame.addEventListener('pointerdown', revealViewerControls);
    frame.addEventListener('keydown', revealViewerControls);
    frame.addEventListener('focusin', handleViewerControlsFocusIn);
    frame.addEventListener('focusout', handleFocusOut);

    return {
      destroy: () => {
        frame.removeEventListener('pointermove', revealViewerControls);
        frame.removeEventListener('pointerdown', revealViewerControls);
        frame.removeEventListener('keydown', revealViewerControls);
        frame.removeEventListener('focusin', handleViewerControlsFocusIn);
        frame.removeEventListener('focusout', handleFocusOut);
      },
    };
  };
  $effect(() => {
    if (isStoryViewer) {
      void loadStoryViewerComponents();
    }
    if (isAnnotationEditor) {
      void loadAnnotationWorkspaceComponent();
    }
  });

  $effect(() => {
    if (isAnnotationEditor) {
      if (
        annotationEditorTool === 'rectangle' ||
        annotationEditorTool === 'point' ||
        annotationEditorTool === 'polygon' ||
        annotationEditorTool === 'freehand' ||
        annotationEditorTool === 'line'
      ) {
        controller.setAnnotationMode('create');
      } else {
        controller.setAnnotationMode('edit');
      }
    }
  });
  let canDrawAnnotations = $derived(
    isStoryBuilder || isAnnotationEditor || normalisedConfig.allowCreateMode === true,
  );
  let annotationEditorTool = $state<
    'select' | 'rectangle' | 'point' | 'polygon' | 'freehand' | 'line'
  >('rectangle');
  let storyBuilderAnnotations = $state<ResolvedAnnotation[]>([]);
  let storyAnnotationEditing = $state(false);
  let storyBuilderActiveAnnotationId = $state<string | null>(null);
  let effectiveAnnotationMode = $derived(canDrawAnnotations ? $annotationMode : 'edit');
  let viewerSettingsLayout = $state<'1x1' | '1x2' | '2x1' | '1x2-panel' | '2x2'>('1x1');
  let contentsPanelTab = $state<'toc' | 'transcript'>('toc');
  let showComparePanel = $state(false);
  let showManifestManager = $state(false);
  let collectionNavigationManifestId = '';
  let lastUiManifestId = '';
  let workspace = $state<WorkspaceStore | null>(null);
  let isMultiView = $derived(viewerSettingsLayout !== '1x1' && !!workspace);
  const closeLeftPanelStores = () => {
    viewerState.showCollection.set(false);
    viewerState.showContents.set(false);
    viewerState.showAnnotations.set(false);
    viewerState.showTools.set(false);
    viewerState.showSettings.set(false);
    viewerState.showSearch.set(false);
    viewerState.showMetadata.set(false);
    viewerState.showLayers.set(false);
    showComparePanel = false;
    showManifestManager = false;
  };

  const enterMobileLayout = () => {
    closeLeftPanelStores();
    // The inline thumbnail strip can push primary controls below a short
    // handheld viewport. Keep it available in the dock, but closed initially.
    viewerState.showThumbnails.set(false);
  };

  const openContentsPanel = (tab: 'toc' | 'transcript') => {
    if (contentsPanelTab === tab && get(showContents)) {
      controller.setPanelOpen('contents', false);
      return;
    }
    showComparePanel = false;
    contentsPanelTab = tab;
    controller.setPanelOpen('contents', true);
  };

  const handleViewerPanelToggle = (
    panel:
      | 'collection'
      | 'annotations'
      | 'tools'
      | 'search'
      | 'metadata'
      | 'contents'
      | 'settings'
      | 'layers'
      | 'thumbnails'
      | 'compare',
    open: boolean,
  ) => {
    showManifestManager = false;
    if (panel === 'compare') {
      if (open) {
        closeLeftPanelStores();
        showComparePanel = true;
      } else {
        showComparePanel = false;
      }
      return;
    }
    showComparePanel = false;
    controller.setPanelOpen(panel, open);
  };

  const toggleManifestManager = () => {
    const nextOpen = !showManifestManager;
    closeLeftPanelStores();
    showManifestManager = nextOpen;
  };

  if (initialMobileLayout) {
    enterMobileLayout();
  }

  let viewerSettingsTheme = $state<ViewerSettingsTheme>('dark');
  let viewerSettingsLocale = $state('en');
  const applyViewerSettingsLocale = (locale: string) => {
    const nextLocale = locale.toLowerCase();
    viewerSettingsLocale = nextLocale;
    normalisedConfig = {
      ...normalisedConfig,
      language: nextLocale,
    };
    viewerState.config.update((current) => ({
      ...(current ?? {}),
      language: nextLocale,
    }));
  };
  let showControlRail = $derived(
    isPlainViewerMode && sidebarEnabled && (isMobileLayout || !sidebarCollapsed),
  );
  let stageDockVisible = $derived(
    !isStoryViewer &&
      !showControlRail &&
      !(isPlainViewerMode && sidebarEnabled && sidebarCollapsed),
  );
  let zoomBaseline = $state(0);
  let zoomBaselineCanvasIndex = $state(-1);
  let zoomPercent = $derived(
    $zoom > 0 && zoomBaseline > 0 ? Math.max(10, Math.round(($zoom / zoomBaseline) * 100)) : 100,
  );
  const handleStageZoomChange = (detail: { zoom: number; viewBox: ViewBox; homeZoom?: number }) => {
    if (detail.homeZoom && detail.homeZoom > 0) {
      zoomBaseline = detail.homeZoom;
      zoomBaselineCanvasIndex = $selectedCanvasIndex;
    }
    controller.handleZoomChange(detail);
  };
  let pendingZoomDirection: 'in' | 'out' | null = $state(null);
  let storyData: StoryWithDefaults | null = $state(null);
  let storyError: string | null = $state(null);
  let storyLoading = $state(false);
  let storyChapters = $state(0);
  let storyControlsDisabled = $state(true);
  let storyLoadToken = 0;
  let lastStoryInput: string | Record<string, unknown> | undefined = $state(undefined);
  let lastStoryUrl: string | undefined = $state(undefined);
  let viewerRoot: HTMLDivElement | null = $state(null);
  let isViewerFullscreen = $state(false);
  let isViewerFullscreenFallback = $state(false);
  let storyChapterThumbnails: Array<string | null> = $state([]);
  const storyThumbnailCache = new Map<string, string>();
  let storyTitle = $derived.by(() => {
    const resolvedTitle = resolveLanguageValue(storyData?.title, storyLanguage);
    return resolvedTitle || 'Untitled story';
  });
  const storyViewBoxStore = writable<ViewBox | null>(null);
  const EMPTY_STORY: StoryWithDefaults = Object.freeze({
    chapters: Object.freeze([]),
  }) as StoryWithDefaults;
  const storyDataStore = writable<StoryWithDefaults>(EMPTY_STORY);
  const STORY_DEFAULT_LANGUAGE = 'en';
  const resolvePreferredStoryLanguage = (): string => {
    const configured = normalisedConfig.language?.trim();
    if (configured) return configured.toLowerCase();
    if (typeof navigator !== 'undefined' && navigator.language) {
      const browserLang = navigator.language.split('-')[0]?.trim().toLowerCase();
      if (browserLang) return browserLang;
    }
    return STORY_DEFAULT_LANGUAGE;
  };
  let storyLanguage = $derived(resolvePreferredStoryLanguage());
  let activeCanvasId = $derived($canvases[$selectedCanvasIndex]?.id ?? null);

  $effect(() => {
    viewportState.manifestId = manifestId ?? '';
    viewportState.selectedCanvasIndex = $selectedCanvasIndex;
    viewportState.viewBox = getViewBox();
    viewportState.imageFilters = { ...$imageFilters };
  });
  $effect(() => {
    viewerSettingsLocale = (normalisedConfig.language ?? 'en').toLowerCase();
  });
  $effect(() => {
    const configuredTheme = normalisedConfig.theme?.toLowerCase();
    viewerSettingsTheme = isViewerSettingsTheme(configuredTheme) ? configuredTheme : 'dark';
  });
  $effect(() => {
    setLocale(viewerSettingsLocale);
  });
  $effect(() => {
    if (isAnnotationEditor) {
      const isDrawing = annotationEditorTool && annotationEditorTool !== 'select';
      const targetMode = isDrawing ? 'create' : 'edit';
      if ($annotationMode !== targetMode) {
        controller.setAnnotationMode(targetMode);
      }
    }
  });
  function getShadowHost(): Element | null {
    if (!viewerRoot) return null;
    const rootNode = viewerRoot.getRootNode();
    if (rootNode instanceof ShadowRoot) {
      return rootNode.host;
    }
    return null;
  }

  function callViewerMethod<TArgs extends unknown[], TResult>(
    name: string,
    fallback: (...args: TArgs) => TResult,
    ...args: TArgs
  ): TResult {
    const host = getShadowHost();
    const method = host ? (host as unknown as Record<string, unknown>)[name] : undefined;
    if (typeof method === 'function') {
      return method.apply(host, args) as TResult;
    }
    return fallback(...args);
  }

  const storyRuntime = createStoryViewerRuntime(
    {
      getViewBox: () => callViewerMethod('getViewBox', getViewBox),
      getContentSize: () => callViewerMethod('getContentSize', getContentSize),
      setViewBox: (box) => callViewerMethod('setViewBox', setViewBox, box),
      getMediaType: () => callViewerMethod('getMediaType', getMediaType),
      getState: () => callViewerMethod('getState', getState),
      getCanvasIndex: () => callViewerMethod('getCanvasIndex', getCanvasIndex),
      getCanvasId: () => callViewerMethod('getCanvasId', getCanvasId),
      getCanvasCount: () => callViewerMethod('getCanvasCount', getCanvasCount),
      setCanvasByIndex: (index) => callViewerMethod('setCanvasByIndex', setCanvasByIndex, index),
      setCanvasById: (id) => callViewerMethod('setCanvasById', setCanvasById, id),
      setManifest: (id) => callViewerMethod('setManifest', setManifest, id),
      getManifestId: () => callViewerMethod('getManifestId', getManifestId),
      start: () => callViewerMethod('start', start),
      play: () => callViewerMethod('play', play),
      pause: () => callViewerMethod('pause', pause),
      stop: () => callViewerMethod('stop', stop),
      seekBy: (delta) => callViewerMethod('seekBy', seekBy, delta),
      seekTo: (time) => callViewerMethod('seekTo', seekTo, time),
      setModelOrbit: (orbit) => callViewerMethod('setModelOrbit', setModelOrbit, orbit),
      setModelTarget: (target) => callViewerMethod('setModelTarget', setModelTarget, target),
      setModelOrientation: (orientation) =>
        callViewerMethod('setModelOrientation', setModelOrientation, orientation),
      setModelPose: (pose, options) =>
        callViewerMethod('setModelPose', setModelPose, pose, options),
      getModelOrbit: () => callViewerMethod('getModelOrbit', getModelOrbit),
      getModelTarget: () => callViewerMethod('getModelTarget', getModelTarget),
      getModelOrientation: () => callViewerMethod('getModelOrientation', getModelOrientation),
      getModelPose: () => callViewerMethod('getModelPose', getModelPose),
      addAnnotation: (annotation) => callViewerMethod('addAnnotation', addAnnotation, annotation),
      removeAnnotation: (id) => callViewerMethod('removeAnnotation', removeAnnotation, id),
      on: (event, handler) => callViewerMethod('on', on, event, handler),
      off: (event, handler) => callViewerMethod('off', off, event, handler),
      updateLayerOpacity: (id, opacity) =>
        callViewerMethod(
          'updateLayerOpacity',
          (id, opacity) => controller.updateLayerOpacity(id, opacity),
          id,
          opacity,
        ),
      getLayerOpacities: () => callViewerMethod('getLayerOpacities', () => get(layerOpacities)),
      getMediaSources: () => callViewerMethod('getMediaSources', () => get(mediaSources)),
    },
    {
      language: resolvePreferredStoryLanguage(),
    },
  );
  const storyPlayback = createStoryPlayback({
    runtime: storyRuntime,
    guards: {
      canControl: () => !storyControlsDisabled,
      canNavigate: () => !storyControlsDisabled && !storyLoading,
      chapterCount: () => storyChapters,
    },
    // The story builder drives the same stage through the event bus, since its
    // controller lives in a plugin rather than in this layout.
    onExternalStageFade: (handler) => controller.on('stageFade', handler),
  });
  let chapterTitle = $derived.by(() => {
    const activeChapter = storyData?.chapters?.[storyPlayback.currentChapterIndex];
    const resolvedTitle = resolveLanguageValue(activeChapter?.title, storyLanguage);
    return (
      resolvedTitle ||
      (storyChapters > 0 ? `Chapter ${storyPlayback.currentChapterIndex + 1}` : '')
    );
  });
  let chapterDescription = $derived(
    resolveLanguageValue(
      storyData?.chapters?.[storyPlayback.currentChapterIndex]?.description,
      storyLanguage,
    ),
  );
  const fullscreenController = createViewerFullscreenController({
    getRoot: () => viewerRoot,
    getShadowHost,
    preferFallback: () => typeof navigator !== 'undefined' && isIPadLikeDevice(navigator),
    onChange: ({ active, fallback }) => {
      isViewerFullscreen = active;
      isViewerFullscreenFallback = fallback;
    },
  });
  const handleStoryFullscreen = () => fullscreenController.toggle();

  const closeMobileLeftDrawer = () => {
    controller.setPanelOpen('contents', false);
    controller.setPanelOpen('annotations', false);
    controller.setPanelOpen('tools', false);
    controller.setPanelOpen('settings', false);
    controller.setPanelOpen('search', false);
    controller.setPanelOpen('metadata', false);
    controller.setPanelOpen('layers', false);
    showComparePanel = false;
  };

  const collapseViewerSidebar = () => {
    sidebarCollapsed = true;
  };

  const expandViewerSidebar = () => {
    sidebarCollapsed = false;
  };

  onMount(() => {
    const detachFullscreen = fullscreenController.attach();
    const detachResponsiveLayout = observeResponsiveLayout({
      root: viewerRoot,
      breakpoint: MOBILE_LAYOUT_WIDTH,
      wasMobile: initialMobileLayout,
      onChange: (value) => {
        isMobileLayout = value;
      },
      onEnterMobile: enterMobileLayout,
      blockBreakpoint: SHORT_LAYOUT_HEIGHT,
      onBlockChange: (value) => {
        isShortLayout = value;
      },
    });
    revealViewerControls();
    return () => {
      clearViewerControlsIdleTimer();
      detachResponsiveLayout();
      detachFullscreen();
    };
  });

  let draftAnno = $state.raw<ResolvedAnnotation | null>(null);
  let annotationDirty = $state(false);
  let annotationSaveState = $state<AnnotationSaveState>({ status: 'clean' });
  let annotationExportStatus = $state('');
  /**
   * Expert content-authoring mode.
   *
   * Off by default, and the only route to `painting`. An ordinary comment
   * exported as `painting` tells every Presentation 3 consumer that the note is
   * the Canvas image, so the term is behind a deliberate choice rather than
   * sitting in a list next to `commenting`.
   */
  let annotationExpertMode = $state(false);
  /**
   * The annotation as it was when editing began, for Cancel to restore.
   *
   * Taken on the first change rather than on selection: selecting an annotation
   * to read it should not arm a transaction, and taking the snapshot on the
   * first edit is what makes Cancel restore the state the user last saw.
   */
  let editSnapshot = $state.raw<{ id: string; annotation: ResolvedAnnotation } | null>(null);
  let annotationLayers = $state<LayerItem[]>([...DEFAULT_ANNOTATION_LAYERS]);
  /** Layer new annotations are created in. */
  let activeAnnotationLayerId = $state('mine');

  /*
   * The live canvas editor, handed out by the editor layer.
   *
   * Held so undo/redo and exact coordinate editing can reach the package's own
   * geometry history and `setGeometry` rather than Mango synthesising pointer
   * events or keeping a second copy of the geometry.
   */
  let annotationEditor = $state.raw<OSDAnnotationEditor | null>(null);
  let commandState = $state<CommandStackState>({ canUndo: false, canRedo: false });

  const commandStack = createCommandStack({
    apply: (annotationId, annotation) => {
      if (!annotation) {
        void controller.removeAnnotation(annotationId);
        return;
      }
      if (draftAnno && draftAnno.id === annotationId) {
        draftAnno = annotation;
        return;
      }
      // Replace, not patch. A snapshot restores a whole earlier state, and a
      // field that was empty before the edit is absent from it — which a patch
      // reads as "leave alone", so the edit would never be undone.
      void controller.replaceAnnotation(annotationId, annotation);
    },
    geometry: () => annotationEditor,
    onChange: (state) => (commandState = state),
  });

  const annotationById = (id: string): ResolvedAnnotation | null =>
    (draftAnno && draftAnno.id === id ? draftAnno : null) ??
    editorAnnotations.find((annotation) => annotation.id === id) ??
    null;
  let visibleLayerIds = $derived(
    new Set(annotationLayers.filter((layer) => layer.visible).map((layer) => layer.id)),
  );
  const normalizeLayerId = (layerId?: string): string => (layerId?.trim() || 'mine').trim();
  const isAnnotationVisibleByLayer = (annotation: ResolvedAnnotation): boolean => {
    const layerId = normalizeLayerId(annotation.targetStyleClass);
    return visibleLayerIds.has(layerId);
  };
  let editorAnnotations = $derived(isAnnotationEditor ? $annotations : $overlayAnnotations);
  /*
   * Hiding a layer takes its annotations off the stage. It does not take them
   * out of the browser list: the list is how an annotation is found, selected,
   * edited, and moved to another layer, so filtering it too made a hidden
   * annotation unmanageable — including unhideable, because the control for
   * changing its layer is in the inspector the list opens.
   */
  let filteredOverlayAnnotations = $derived(
    editorAnnotations.filter((annotation) => isAnnotationVisibleByLayer(annotation)),
  );
  let visibleDraftAnno = $derived(
    draftAnno && isAnnotationVisibleByLayer(draftAnno) ? draftAnno : null,
  );
  let editorStageAnnotations = $derived(
    visibleDraftAnno
      ? [...filteredOverlayAnnotations, visibleDraftAnno]
      : filteredOverlayAnnotations,
  );
  const handleToggleLayer = (detail: { id: string }) => {
    const current = annotationLayers.find((layer) => layer.id === detail.id);
    annotationLayers = setLayerVisibility(annotationLayers, detail.id, !current?.visible);
  };

  const handleAddLayer = () => {
    annotationLayers = [...annotationLayers, createLayer(annotationLayers)];
  };

  const handleLayerRename = (detail: { id: string; name: string }) => {
    annotationLayers = renameLayer(annotationLayers, detail.id, detail.name);
  };

  const handleLayerMove = (detail: { id: string; direction: -1 | 1 }) => {
    annotationLayers = moveLayer(annotationLayers, detail.id, detail.direction);
  };

  const handleLayerArchive = (detail: { id: string; archived: boolean }) => {
    annotationLayers = archiveLayer(annotationLayers, detail.id, detail.archived);
    // Archiving the layer being drawn into would leave new annotations landing
    // somewhere the user can no longer see.
    activeAnnotationLayerId = resolveActiveLayer(annotationLayers, activeAnnotationLayerId);
  };

  const handleLayerColorChange = (detail: { id: string; color: string }) => {
    annotationLayers = recolourLayer(annotationLayers, detail.id, detail.color);

    /*
     * Recolouring writes a new stylesheet, not an inline `target.style`. The
     * inline form has no portable Web Annotation representation, so it was
     * dropped the moment anything exported in a standards profile; a class plus
     * an Annotation-level stylesheet survives the round trip.
     *
     * The class does not change, because the class is the layer's identity.
     * Changing the colour must not change membership.
     */
    const patch: Partial<ResolvedAnnotation> = {
      targetStyleClass: styleClassForLayer(detail.id),
    };
    const stylesheet = buildLayerStylesheet([{ id: detail.id, color: detail.color }]);
    /*
     * Only annotations that name this layer, not the manifest ones that merely
     * fall back to it for rendering. Recolouring is a real edit, so matching on
     * the fallback would copy every external annotation on the page into the
     * user's own set — and into their export — over a swatch change.
     */
    const styleClass = styleClassForLayer(detail.id);
    const inLayer = (annotation: ResolvedAnnotation): boolean => {
      const current = annotation.targetStyleClass?.trim();
      return current === detail.id || current === styleClass;
    };
    const affectedAnnotationIds = new Set(
      editorAnnotations.filter(inLayer).map((annotation) => annotation.id),
    );
    if (draftAnno && inLayer(draftAnno)) {
      affectedAnnotationIds.add(draftAnno.id);
    }
    for (const annotationId of affectedAnnotationIds) {
      handleAnnotationUpdate(annotationId, patch, { stylesheet });
    }
  };

  $effect(() => {
    const source = draftAnno ? [...editorAnnotations, draftAnno] : editorAnnotations;
    const discovered = source
      .map((annotation) => ({
        id: annotation.targetStyleClass?.trim() ?? '',
        color:
          annotation.styleHints?.strokeColor ??
          colorFromInlineStyle(annotation.targetStyle) ??
          undefined,
      }))
      .filter((entry) => entry.id);

    const merged = mergeDiscoveredLayers(annotationLayers, discovered);
    if (merged.length !== annotationLayers.length) annotationLayers = merged;
  });

  const handleAnnotationCreate = async (payload: {
    annotation: unknown;
    tool?: ChapterAnnotationTool;
  }) => {
    const annotation = payload?.annotation;
    if (!annotation || typeof annotation !== 'object') return;

    const { annotation: resolved } = resolveAnnotationJson(annotation, {
      provenance: 'draft',
    });
    if (!resolved) return;

    /*
     * No defaults are applied here any more. The editor layer builds the
     * annotation through the profile's builders, which set `commenting` as the
     * motivation and put the layer in `styleClass` — the two things this used
     * to overwrite afterwards, one of them with a legacy `oa:` term.
     */
    if (isStoryBuilder) {
      controller.emitEvent('annotationCreate', {
        annotation: resolved,
        tool: payload.tool ?? shapeTool(shapeFromResolved(resolved)) ?? undefined,
      });
      annotationEditorTool = 'select';
      controller.setAnnotationMode('edit');
      return;
    }

    draftAnno = resolved;
    annotationDirty = true;
    annotationSaveState = { status: 'clean' };
    controller.handleAnnotationSelect({ id: resolved.id, preventZoom: true });
  };

  const handleKeyboardAnnotationCreate = (detail: {
    tool: 'rectangle' | 'point';
  }) => {
    const canvasId = getCanvasId() ?? activeCanvasId;
    if (!canvasId) return;
    const content = getContentSize();
    const viewBox = getViewBox() ?? {
      x: 0,
      y: 0,
      w: content?.width ?? 1_000,
      h: content?.height ?? 1_000,
    };
    const centre = {
      x: viewBox.x + viewBox.w / 2,
      y: viewBox.y + viewBox.h / 2,
    };
    const shape =
      detail.tool === 'point'
        ? ({ type: 'point', geometry: centre } as const)
        : ({
            type: 'rect',
            geometry: {
              x: centre.x - viewBox.w * 0.125,
              y: centre.y - viewBox.h * 0.125,
              w: Math.max(1, viewBox.w * 0.25),
              h: Math.max(1, viewBox.h * 0.25),
            },
          } as const);
    const layer = annotationLayers.find((entry) => entry.id === activeAnnotationLayerId);
    const document = createMangoAnnotation({
      canvasId,
      shape,
      styleClass: styleClassForLayer(activeAnnotationLayerId),
      stylesheet: layer
        ? buildLayerStylesheet([{ id: layer.id, color: layer.color }])
        : undefined,
    });
    const resolved = projectToResolved(document, { provenance: 'draft', canvasId });
    if (!resolved) return;
    draftAnno = resolved;
    annotationDirty = true;
    annotationSaveState = { status: 'clean' };
    annotationEditorTool = 'select';
    controller.setAnnotationMode('edit');
    controller.handleAnnotationSelect({ id: resolved.id, preventZoom: true });
  };

  /**
   * Discards the pending edit.
   *
   * A draft has nothing behind it, so cancelling removes it. An edit to a saved
   * annotation is undone by restoring the snapshot taken when editing began —
   * geometry and metadata together, because they are one transaction from the
   * user's point of view even though they arrive through different callbacks.
   */
  const handleAnnotationCancel = () => {
    if (draftAnno) {
      draftAnno = null;
      annotationDirty = false;
      annotationSaveState = { status: 'clean' };
      annotationEditorTool = 'select';
      controller.setAnnotationMode('edit');
      controller.handleAnnotationClear();
      return;
    }

    const snapshot = editSnapshot;
    editSnapshot = null;
    annotationDirty = false;
    annotationSaveState = { status: 'clean' };
    if (snapshot) controller.updateAnnotation(snapshot.id, snapshot.annotation);
  };

  /**
   * A draft is local state until Save. Selection and Canvas navigation used to
   * replace that state silently, which made Cancel trustworthy but made every
   * other route out of the inspector destructive. Keep the policy small and
   * explicit: stay by default; discard only after confirmation.
   */
  const confirmAnnotationNavigation = (): boolean => {
    if (!isAnnotationEditor || (!annotationDirty && !draftAnno)) return true;
    if (typeof window === 'undefined') return false;
    const discard = window.confirm(
      $t('viewer.panels.annotations.editor.discardNavigationConfirmation'),
    );
    if (discard) handleAnnotationCancel();
    return discard;
  };

  /**
   * Deletes an annotation, after confirming.
   *
   * A draft has nothing behind it, so removing it is not a loss and needs no
   * confirmation. Anything else is confirmed, and is undoable afterwards —
   * a confirmation the user can also reverse is cheaper to get wrong.
   */
  const handleAnnotationDelete = async (id: string) => {
    if (isStoryBuilder) {
      controller.emitEvent('annotationDelete', { annotationId: id });
      return;
    }
    if (draftAnno && draftAnno.id === id) {
      draftAnno = null;
      controller.handleAnnotationClear();
      return;
    }

    const existing = annotationById(id);
    if (existing && !confirmDeletion(existing)) return;
    if (existing) {
      commandStack.record({
        annotationId: id,
        before: existing,
        after: null,
        label: 'delete',
      });
    }
    await controller.removeAnnotation(id);
  };

  /**
   * Asks before destroying something the user cannot redraw.
   *
   * `confirm` is a blunt instrument, but it is the one that is guaranteed to be
   * reachable by keyboard and announced by a screen reader without Mango
   * building a dialog and getting focus management wrong.
   */
  const confirmDeletion = (annotation: ResolvedAnnotation): boolean => {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return true;
    const name = annotation.label?.trim() || annotation.text?.trim() || annotation.id;
    return window.confirm($t('viewer.panels.annotations.editor.confirmDelete', { name }));
  };

  const handleAnnotationUndo = () => {
    if (commandStack.undo()) annotationDirty = true;
  };

  const handleAnnotationRedo = () => {
    if (commandStack.redo()) annotationDirty = true;
  };

  /**
   * Undo and redo from the keyboard.
   *
   * Bound on the annotation editor rather than globally: the viewer is embedded
   * in host pages, and swallowing the platform undo shortcut everywhere would
   * break the host's own editing surfaces.
   */
  const handleAnnotationKeydown = (event: KeyboardEvent) => {
    if (!isAnnotationEditor) return;
    const modifier = event.metaKey || event.ctrlKey;
    if (!modifier || event.key.toLowerCase() !== 'z') return;
    const target = event.target as HTMLElement | null;
    // Text fields have their own undo, and taking it would be worse than not
    // offering ours.
    if (target?.closest('input, textarea, [contenteditable="true"]')) return;
    event.preventDefault();
    if (event.shiftKey) handleAnnotationRedo();
    else handleAnnotationUndo();
  };

  const handleAnnotationUpdate = (
    id: string,
    patch: Partial<ResolvedAnnotation>,
    options: {
      stylesheet?: CanonicalStylesheet | null;
      language?: string;
      bodyPurpose?: string;
      textDirection?: string;
      bodyPath?: string;
      createBody?: boolean;
    } = {},
  ) => {
    let effectivePatch = patch;
    let effectiveOptions = options;
    if (patch.targetStyleClass !== undefined && options.stylesheet === undefined) {
      const requested = patch.targetStyleClass.trim();
      const layer = annotationLayers.find(
        (entry) =>
          entry.id === requested || styleClassForLayer(entry.id) === requested,
      );
      if (layer) {
        effectivePatch = {
          ...patch,
          targetStyleClass: styleClassForLayer(layer.id),
        };
        effectiveOptions = {
          ...options,
          stylesheet: buildLayerStylesheet([
            { id: layer.id, color: layer.color },
          ]),
        };
      }
    }
    if (isStoryBuilder) {
      controller.emitEvent('annotationUpdate', {
        annotationId: id,
        patch: effectivePatch,
      });
      return;
    }
    /*
     * Recorded after the edit lands, not before, so the entry holds both ends
     * of it. Recording `after: null` meant redo restored "no annotation" — it
     * deleted the very thing it was meant to bring back.
     */
    const previous = annotationById(id);

    if (draftAnno && draftAnno.id === id) {
      draftAnno = applyResolvedPatch(draftAnno, effectivePatch, effectiveOptions);
      annotationDirty = true;
      if (previous) {
        commandStack.record({
          annotationId: id,
          before: previous,
          after: draftAnno,
          label: labelForPatch(effectivePatch),
        });
      }
      return;
    }
    if (!editSnapshot || editSnapshot.id !== id) {
      const current = editorAnnotations.find((annotation) => annotation.id === id);
      if (current) editSnapshot = { id, annotation: current };
    }
    annotationDirty = true;
    annotationSaveState = { status: 'clean' };
    controller.updateAnnotation(id, effectivePatch, effectiveOptions);

    const next = annotationById(id);
    if (previous && next && next !== previous) {
      commandStack.record({
        annotationId: id,
        before: previous,
        after: next,
        label: labelForPatch(effectivePatch),
      });
    }
  };

  const handleAnnotationSave = async () => {
    annotationSaveState = { status: 'saving' };
    try {
      if (draftAnno) {
        await controller.addAnnotation(draftAnno);
        draftAnno = null;
      } else {
        const activeId = get(activeAnnotationId);
        if (!activeId) {
          annotationSaveState = { status: 'clean' };
          return;
        }
        /*
         * Edits are already applied to the store as they are made, so this
         * commits the transaction rather than sending a patch. It used to send
         * an empty one, which the controller then had to recognise and ignore
         * so that merely saving did not copy a manifest annotation into the
         * user's own set.
         */
        await controller.commitAnnotation(activeId);
      }
      editSnapshot = null;
      annotationDirty = false;
      annotationSaveState = { status: 'saved' };
      annotationEditorTool = 'select';
      controller.setAnnotationMode('edit');
      controller.handleAnnotationClear();
    } catch (error) {
      annotationSaveState = {
        status: 'failed',
        message: error instanceof Error ? error.message : $t('viewer.panels.annotations.editor.saveState.failed'),
      };
    }
  };

  const handleExportAnnotations = () => {
    const userAnnosMap = get(userAnnotations) ?? {};
    const allUserAnnos = Object.values(userAnnosMap).flat();

    const result = exportAnnotationPage(allUserAnnos, {
      canvasId: getCanvasId() ?? undefined,
      expert: annotationExpertMode,
    });
    controller.emitEvent('exportAnnotationPage', {
      page: result.page,
      valid: result.publicationValidation.valid,
      draftValid: result.draftValidation.valid,
      publicationValid: result.publicationValidation.valid,
      excludedPrivateFields: result.excludedPrivateFields,
      unresolvedIdentities: result.unresolvedIdentities,
      unresolvedPageIdentity: result.unresolvedPageIdentity,
    });

    /*
     * The old payload still fires for one deprecation cycle. Hosts wired to it
     * keep working; hosts that want portable JSON-LD move to the event above
     * rather than reverse-engineering `ResolvedAnnotation`.
     */
    controller.emitEvent('exportAnnotations', { annotations: allUserAnnos });

    /* The visible control performs a visible action even when the host has not
       installed an event listener. With draft identifiers this is explicitly a
       local draft download; publication readiness is reported separately. */
    if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
      const blob = new Blob([JSON.stringify(result.page, null, 2)], {
        type: 'application/ld+json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mango-annotations-draft.json';
      link.click();
      URL.revokeObjectURL(url);
    }
    annotationExportStatus = result.publicationValidation.valid
      ? $t('viewer.panels.annotations.exportPublicationReady')
      : $t('viewer.panels.annotations.exportDraftOnly');
  };

  const preloadStoryManifests = async (value: StoryWithDefaults): Promise<void> => {
    const uniqueManifestIds = Array.from(
      new Set(
        (value.chapters ?? [])
          .map((chapter) => chapter.manifest)
          .filter(
            (manifest): manifest is string => typeof manifest === 'string' && manifest.length > 0,
          ),
      ),
    );
    await Promise.all(uniqueManifestIds.map((manifest) => fetchManifest(manifest)));
  };

  const resolveLanguageValue = (
    value: Record<string, string> | undefined,
    lang: string,
  ): string => {
    if (!value) return '';
    const preferred = value[lang]?.trim();
    if (preferred) return preferred;
    const firstAvailable = Object.values(value).find(
      (entry) => typeof entry === 'string' && entry.trim().length > 0,
    );
    return firstAvailable?.trim() ?? '';
  };

  const viewerApi: ViewerApi = {
    getViewBox,
    getContentSize,
    setViewBox,
    getZoom,
    setZoom,
    zoomIn,
    zoomOut,
    panTo,
    getMediaType,
    getState,
    getCanvasIndex,
    getCanvasId,
    getCanvasCount,
    setCanvasByIndex,
    setCanvasById,
    setManifest,
    getManifestId,
    start,
    play,
    pause,
    stop,
    seekBy,
    seekTo,
    setMediaSegment,
    setModelOrbit,
    setModelTarget,
    setModelOrientation,
    setModelPose,
    getModelOrbit,
    getModelTarget,
    getModelOrientation,
    getModelPose,
    addAnnotation,
    removeAnnotation,
    setAnnotationTool: (tool) => {
      annotationEditorTool = tool;
      controller.setAnnotationMode(tool === 'select' ? 'edit' : 'create');
    },
    setStoryAnnotations: (annotations) => {
      storyBuilderAnnotations = annotations;
      if (
        storyBuilderActiveAnnotationId &&
        !annotations.some((annotation) => annotation.id === storyBuilderActiveAnnotationId)
      ) {
        storyBuilderActiveAnnotationId = null;
      }
    },
    setStoryAnnotationEditing: (enabled) => {
      storyAnnotationEditing = enabled;
      if (!enabled) {
        storyBuilderActiveAnnotationId = null;
        annotationEditorTool = 'select';
        controller.setAnnotationMode('edit');
      }
    },
    setStoryAnnotationSelection: (annotationId) => {
      storyBuilderActiveAnnotationId = annotationId;
    },
    updateLayerOpacity: (id: string, opacity: number) => {
      controller.updateLayerOpacity(id, opacity);
    },
    getLayerOpacities: () => {
      return get(layerOpacities);
    },
    getMediaSources: () => {
      return get(mediaSources);
    },
    on,
    off,
  };

  /**
   * The annotation list needs a box of its own to be usable, and taking that
   * off the page being annotated is the wrong side of the trade. The element
   * grows to pay for it instead.
   *
   * The host keeps a *definite* height throughout — only its value changes,
   * which is the property the shadow layout depends on. Mirrors how
   * `:host([mode='workspace'])` already varies the height by attribute.
   */
  const setAnnotationListHostState = (open: boolean): void => {
    const host = getShadowHost();
    if (!host) return;
    if (open) host.setAttribute('data-annotation-list', 'open');
    else host.removeAttribute('data-annotation-list');
  };

  const pluginContext = {
    viewer: viewerApi,
    events: controller.events,
    get config(): ViewerConfig {
      return normalisedConfig;
    },
  };

  const rendererHandlers: RendererEventHandlers = {
    onMediaPlay: (detail) => controller.handleMediaPlay(detail),
    onMediaPause: (detail) => controller.handleMediaPause(detail),
    onMediaTimeUpdate: (detail) => controller.handleMediaTimeUpdate(detail),
    onMediaSeek: (detail) => controller.handleMediaSeek(detail),
    onMediaSegmentEnd: () => controller.handleMediaSegmentEnd(),
    onModelChange: (detail) => controller.handleModelChange(detail),
    onAnnotationHover: (detail) => controller.handleAnnotationHover(detail),
    onAnnotationSelect: (detail) => {
      if (isAnnotationEditor && $annotationMode === 'create') {
        return;
      }
      if (
        isAnnotationEditor &&
        draftAnno?.id !== detail.id &&
        !confirmAnnotationNavigation()
      ) return;
      controller.handleAnnotationSelect(detail);
      if (!isAnnotationEditor) return;
      if (draftAnno?.id === detail.id) return;
      annotationEditorTool = 'select';
      controller.setAnnotationMode('edit');
    },
    /*
     * The pointer-up that finishes a drawn shape reaches the stage background
     * as an ordinary click, so an unconditional clear deselected the annotation
     * the user had just drawn — the draft stayed on the canvas with no way to
     * reach it. A pending draft is dismissed through Cancel, deliberately, not
     * by clicking away.
     */
    onAnnotationClear: () => {
      if (!draftAnno) controller.handleAnnotationClear();
    },
  };

  const getRoundedZoomTarget = (direction: 'in' | 'out', current: number): number => {
    if (direction === 'in') {
      const aligned = Math.ceil(current / 10) * 10;
      return aligned <= current + 0.01 ? aligned + 10 : aligned;
    }
    const aligned = Math.floor(current / 10) * 10;
    const next = aligned >= current - 0.01 ? aligned - 10 : aligned;
    return Math.max(10, next);
  };

  const applyZoomStep = (direction: 'in' | 'out') => {
    if (!stageRef?.zoomBy) return;
    pendingZoomDirection = direction;
    const currentPercent = Math.max(10, zoomPercent);
    const targetPercent = getRoundedZoomTarget(direction, currentPercent);
    const factor = targetPercent / currentPercent;
    if (!Number.isFinite(factor) || factor <= 0) return;
    stageRef.zoomBy(factor);
  };

  const handleZoomIn = () => applyZoomStep('in');
  const handleZoomOut = () => applyZoomStep('out');
  const handleSetZoomPercent = (detail: { percent: number }) => {
    if (!stageRef?.zoomBy) return;
    const targetPercent = Math.max(10, Math.min(2000, Math.round(detail.percent)));
    const currentPercent = Math.max(10, zoomPercent);
    const factor = targetPercent / currentPercent;
    if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.001) return;
    pendingZoomDirection = null;
    stageRef.zoomBy(factor);
  };
  const handlePrevCanvas = () => {
    if (!confirmAnnotationNavigation()) return;
    const index = $selectedCanvasIndex;
    if ($layoutMode === 'two-page') {
      if (index <= 2) {
        controller.setCanvasByIndex(0);
      } else {
        const leftIndex = index % 2 === 1 ? index : index - 1;
        controller.setCanvasByIndex(Math.max(0, leftIndex - 2));
      }
    } else {
      controller.setCanvasByIndex(index - 1);
    }
  };

  const handleNextCanvas = () => {
    if (!confirmAnnotationNavigation()) return;
    const index = $selectedCanvasIndex;
    if ($layoutMode === 'two-page') {
      if (index === 0) {
        controller.setCanvasByIndex(1);
      } else {
        const leftIndex = index % 2 === 1 ? index : index - 1;
        controller.setCanvasByIndex(Math.min($canvases.length - 1, leftIndex + 2));
      }
    } else {
      controller.setCanvasByIndex(index + 1);
    }
  };

  const handleSetCanvasIndex = (detail: { index: number }) => {
    if (!confirmAnnotationNavigation()) return;
    controller.setCanvasByIndex(detail.index);
  };
  const handleHome = () => stageRef?.goHome?.();

  /*
   * KNOWN ISSUE: below a 560px element height the thumbnail strip is shed by
   * container query, and this button then toggles state nothing can render —
   * it appears to do nothing. Routing it to the full gallery layout instead
   * looks like the obvious fix and was tried; it is not safe as things stand.
   *
   * `showThumbnails` is flipped asynchronously by the short-layout pass, so a
   * press can land after the panel has already closed and be read as "open".
   * That switched the stage to the gallery view, where `.stage__media` does not
   * exist, stranding the viewer with no image. Passing the button's rendered
   * state through the event does not help: the handler still reads the live
   * value at click time.
   *
   * A safe version needs a reactive "strip is hidden" flag so the button's
   * state and its action are derived from the same source — note that
   * SHORT_LAYOUT_HEIGHT (500) does not currently match the CSS rung (560).
   */
  const handleGalleryOpen = () => {
    controller.setPanelOpen('thumbnails', !showThumbnailsEffectiveStory);
  };

  /*
   * True while the strip is drawn as an overlay rather than a row — see the
   * `max-height: 560px` rung further down.
   *
   * Read from the element's own computed position instead of tracking a size
   * flag. It is synchronous and reports exactly what the stylesheet decided, so
   * it cannot fall out of step the way an observer-backed flag does; that
   * staleness is what made two earlier attempts at this button race.
   */
  const galleryIsOverlay = (): boolean => {
    const gallery = viewerRoot?.querySelector('.gallery');
    return gallery ? getComputedStyle(gallery).position === 'absolute' : false;
  };

  /*
   * As a row the strip stays open so the reader can keep browsing. As an overlay
   * it covers the stage, so choosing a page has to dismiss it — otherwise you
   * pick an image and are left looking at the picker instead of the picture.
   */
  const handleGalleryCanvasSelect = (index: number) => {
    if (!confirmAnnotationNavigation()) return;
    const dismiss = galleryIsOverlay();
    controller.setCanvasByIndex(index);
    if (dismiss) {
      controller.setPanelOpen('thumbnails', false);
    }
  };
  const handleRotate = () => stageRef?.rotateBy?.(90);
  export function on<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ): () => void {
    return controller.on(event, handler);
  }

  export function off<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ): void {
    controller.off(event, handler);
  }

  export function setEventTarget(target: EventTarget): void {
    controller.setEventTarget(target);
  }

  export function getViewBox(): ViewBox | null {
    return stageRef?.getViewBox?.() ?? null;
  }

  export function getContentSize(): ContentSize | null {
    return stageRef?.getContentSize?.() ?? null;
  }

  export function setViewBox(box: ViewBox): void {
    stageRef?.setViewBox?.(box);
  }

  export function getZoom(): number {
    return zoomPercent;
  }

  export function setZoom(percent: number): void {
    if (!Number.isFinite(percent)) return;
    handleSetZoomPercent({ percent });
  }

  export function zoomIn(): void {
    handleZoomIn();
  }

  export function zoomOut(): void {
    handleZoomOut();
  }

  export function panTo(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const box = getViewBox();
    if (!box) return;
    setViewBox({ x: x - box.w / 2, y: y - box.h / 2, w: box.w, h: box.h });
  }

  export function getMediaType() {
    return get(mediaType);
  }

  export function setModelOrbit(orbit: string): void {
    stageRef?.setModelOrbit?.(orbit);
  }

  export function setModelTarget(target: string): void {
    stageRef?.setModelTarget?.(target);
  }

  export function setModelOrientation(orientation: string): void {
    stageRef?.setModelOrientation?.(orientation);
  }

  export function setModelPose(pose: ModelPose, options?: ModelPoseOptions): void {
    stageRef?.setModelPose?.(pose, options);
  }

  export function getModelOrbit(): string | null {
    return stageRef?.getModelOrbit?.() ?? null;
  }

  export function getModelTarget(): string | null {
    return stageRef?.getModelTarget?.() ?? null;
  }

  export function getModelOrientation(): string | null {
    return stageRef?.getModelOrientation?.() ?? null;
  }

  export function getModelPose(): ModelPose | null {
    return stageRef?.getModelPose?.() ?? null;
  }

  export function getState() {
    return controller.getStateSnapshot();
  }

  export function getCanvasIndex(): number {
    return controller.getCanvasIndex();
  }

  export function getCanvasId(): string | null {
    return controller.getCanvasId();
  }

  export function getCanvasCount(): number {
    return controller.getCanvasCount();
  }

  export function setCanvasByIndex(index: number): void {
    controller.setCanvasByIndex(index);
  }

  export function setCanvasById(canvasId: string): void {
    controller.setCanvasById(canvasId);
  }

  export function setManifest(id: string): void {
    viewerState.collectionId.set('');
    viewerState.showCollection.set(false);
    collectionNavigationManifestId = '';
    manifestId = id;
  }

  const handleCollectionSelect = async (selection: CollectionSelection): Promise<void> => {
    try {
      await navigateMango(
        {
          getManifestId,
          getCanvasCount,
          setManifest: (id: string) => {
            // Moving between members of the active collection must preserve
            // its navigation context. Other manifest changes clear it below.
            collectionNavigationManifestId = id;
            manifestId = id;
          },
          setCanvasById,
          on,
        },
        selection,
      );
    } catch (cause) {
      controller.emitEvent('error', {
        scope: 'manifest',
        message: $t('viewer.panels.collection.openError'),
        cause,
      });
    }
  };

  export function getManifestId(): string | null {
    return manifestId || null;
  }

  export function start(): void {
    stageRef?.start?.();
  }

  export function play(): void {
    stageRef?.play?.();
  }

  export function pause(): void {
    stageRef?.pause?.();
  }

  export function stop(): void {
    stageRef?.stop?.();
  }

  export function seekBy(delta: number): void {
    stageRef?.seekBy?.(delta);
  }

  export function seekTo(time: number): void {
    stageRef?.seekTo?.(time);
  }

  export function setMediaSegment(start: number, end: number): void {
    stageRef?.setMediaSegment?.(start, end);
  }

  export async function addAnnotation(annotation: unknown): Promise<void> {
    return controller.addAnnotation(annotation);
  }

  export async function removeAnnotation(annotationId: string): Promise<void> {
    return controller.removeAnnotation(annotationId);
  }

  export function updateLayerOpacity(id: string, opacity: number): void {
    controller.updateLayerOpacity(id, opacity);
  }

  export function getLayerOpacities(): Record<string, number> {
    return get(layerOpacities);
  }

  export function getMediaSources() {
    return get(mediaSources);
  }

  const setStoryError = (message: string) => {
    storyError = message;
    storyControlsDisabled = true;
    onstoryViewerError?.({ message });
  };

  const loadStoryInput = async () => {
    const token = ++storyLoadToken;
    storyLoading = true;
    storyError = null;
    storyControlsDisabled = true;
    storyData = null;
    storyChapters = 0;

    let source: unknown = undefined;
    if (story !== undefined && story !== null && `${story}` !== '') {
      source = story;
    } else if (storyUrl) {
      try {
        const response = await fetch(storyUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        source = await response.json();
      } catch {
        if (token !== storyLoadToken) return;
        setStoryError('Failed to load story');
        storyLoading = false;
        return;
      }
    } else {
      setStoryError('Story input missing');
      storyLoading = false;
      return;
    }

    if (token !== storyLoadToken) return;

    let parsed = source;
    if (typeof source === 'string') {
      try {
        parsed = JSON.parse(source);
      } catch {
        setStoryError('Invalid story JSON');
        storyLoading = false;
        return;
      }
    }

    const normalised = normaliseStoryInput(parsed);
    if (!normalised.ok || !normalised.story) {
    setStoryError(normalised.error ?? $t('storyViewer.invalid'));
      storyLoading = false;
      return;
    }

    const validation = validateStoryViewer(normalised.story);
    if (!validation.ok) {
    setStoryError(validation.errors[0] ?? $t('storyViewer.invalid'));
      storyLoading = false;
      return;
    }

    storyData = normalised.story;
    storyChapters = normalised.story.chapters.length;
    storyControlsDisabled = false;
    storyLoading = false;
    await storyRuntime.loadStory(normalised.story);
  };

  onDestroy(() => controller.destroy());
  onDestroy(() => storyPlayback.destroy());
  $effect.pre(() => {
    normalisedConfig = normaliseConfigForMode(config);
  });
  $effect.pre(() => {
    const nextManifestId = manifestId ?? '';
    if (nextManifestId !== lastUiManifestId) {
      const isInitialManifest = !lastUiManifestId;
      const preserveCollection =
        Boolean(nextManifestId) && nextManifestId === collectionNavigationManifestId;

      if (!isInitialManifest && !preserveCollection) {
        viewerState.collectionId.set('');
        viewerState.showCollection.set(false);
      }

      collectionNavigationManifestId = '';
      lastUiManifestId = nextManifestId;
      contentsPanelTab = 'toc';
      showComparePanel = false;
      showManifestManager = false;
      draftAnno = null;
      annotationLayers = [...DEFAULT_ANNOTATION_LAYERS];
      if (isAnnotationEditor) annotationEditorTool = 'select';
    }
    viewerState.manifestId.set(nextManifestId);
  });
  $effect(() => {
    const requestedIndex = canvasIndex;
    if (requestedIndex !== undefined && requestedIndex !== get(selectedCanvasIndex)) {
      controller.setCanvasByIndex(requestedIndex);
    }
  });
  $effect(() => {
    const currentIndex = $selectedCanvasIndex;
    if (currentIndex === lastReportedCanvasIndex) return;
    lastReportedCanvasIndex = currentIndex;
    oncanvaschange?.({ canvasIndex: currentIndex });
  });
  $effect(() => {
    const collection = $collectionEntry;
    if (!collection?.json || manifestId !== collection.id) return;

    const firstManifestId = findFirstManifestId(collection.json);
    if (firstManifestId) {
      collectionNavigationManifestId = firstManifestId;
      manifestId = firstManifestId;
    }
  });
  $effect.pre(() => {
    const configWithModeDefaults = {
      ...normalisedConfig,
      allowCreateMode: normalisedConfig.allowCreateMode || isStoryBuilder || isAnnotationEditor,
    };
    viewerState.config.set(configWithModeDefaults);
    if (isMobileLayout) {
      enterMobileLayout();
    }
  });
  $effect.pre(() => {
    viewerState.plugins.set([...corePlugins, ...plugins]);
  });
  $effect.pre(() => {
    if ($selectedCanvasIndex !== zoomBaselineCanvasIndex) {
      zoomBaselineCanvasIndex = $selectedCanvasIndex;
      zoomBaseline = $zoom > 0 ? $zoom : 0;
      pendingZoomDirection = null;
    }
  });
  $effect.pre(() => {
    if ($zoom > 0 && zoomBaseline === 0) {
      if (pendingZoomDirection === 'in') {
        zoomBaseline = $zoom / 1.1;
      } else if (pendingZoomDirection === 'out') {
        zoomBaseline = $zoom / 0.9;
      } else {
        zoomBaseline = $zoom;
      }
    }
  });
  $effect(() => {
    if (isStoryViewer && (story !== lastStoryInput || storyUrl !== lastStoryUrl)) {
      lastStoryInput = story;
      lastStoryUrl = storyUrl;
      void loadStoryInput();
    }
  });
  $effect(() => {
    if (isStoryViewer && storyData?.chapters?.length) {
      void preloadStoryManifests(storyData);
    }
  });
  $effect(() => {
    storyChapterThumbnails =
      isStoryViewer && storyData?.chapters?.length
        ? storyData.chapters.map((chapter) => {
            const chapterKey = `${chapter.id}:${chapter.manifest}:${chapter.canvasIndex}`;
            const manifestEntry = $manifestsStore[chapter.manifest];
            if (!manifestEntry?.manifesto) {
              return storyThumbnailCache.get(chapterKey) ?? null;
            }
            const resolved = resolveCanvasThumbnail(
              manifestEntry.manifesto,
              undefined,
              chapter.canvasIndex,
            );
            if (resolved) {
              storyThumbnailCache.set(chapterKey, resolved);
              return resolved;
            }
            return storyThumbnailCache.get(chapterKey) ?? null;
          })
        : [];
  });
  $effect(() => {
    if (!isStoryViewer) {
      storyPlayback.resetProgress();
    }
  });
  let leftVisibleEffective = $derived(
    isStoryViewer ||
      isAnnotationEditor ||
      !sidebarEnabled ||
      (isPlainViewerMode && sidebarCollapsed && !isMobileLayout)
      ? false
      : $leftVisible || showComparePanel,
  );
  let rightVisibleEffective = $derived(isStoryBuilder && $rightVisible);
  let showThumbnailsEffectiveStory = $derived(isStoryViewer ? false : showThumbnailsEffective);
  let showSearchEffectiveStory = $derived(isStoryViewer ? false : showSearchEffective);
  let showAnnotationsEffectiveStory = $derived(isStoryViewer ? false : showAnnotationsEffective);
  let showToolsEffectiveStory = $derived(isStoryViewer ? false : showToolsEffective);
  let showSettingsEffectiveStory = $derived(isPlainViewerMode ? $showSettings : false);
  let allowSettingsStory = $derived(isPlainViewerMode && normalisedConfig.showSettings !== false);
  let showContentsEffectiveStory = $derived(
    isStoryViewer || isStoryBuilder ? false : $showContents,
  );
  let showCollectionEffectiveStory = $derived(
    isPlainViewerMode ? $showCollection && $allowCollection : false,
  );
  let showLayersEffective = $derived($showLayers && $allowLayers);
  let showLayersEffectiveStory = $derived(isStoryViewer ? false : showLayersEffective);
  let allowThumbnailsStory = $derived(isStoryViewer ? false : $allowThumbnails);
  let allowCollectionStory = $derived(isPlainViewerMode ? $allowCollection : false);
  let allowMetadataStory = $derived(isStoryViewer ? false : $allowMetadata);
  let allowSearchStory = $derived(isStoryViewer ? false : $allowSearch);
  let allowAnnotationsStory = $derived(isStoryViewer ? false : $allowAnnotations);
  let allowToolsStory = $derived(isStoryViewer ? false : $allowTools);
  let allowLayersStory = $derived(isStoryViewer || isStoryBuilder ? false : $allowLayers);
  let allowContentsStory = $derived(
    isStoryViewer || isStoryBuilder ? false : $contentsAvailable,
  );
  let allowChaptersStory = $derived(
    !isStoryViewer && ($mediaType === 'audio' || $mediaType === 'video') && $avChaptersAvailable,
  );
  let allowTranscriptStory = $derived(
    !isStoryViewer && ($mediaType === 'audio' || $mediaType === 'video') && $avTranscriptAvailable,
  );
  // StoryState annotation overlay reactive variables
  $effect(() => {
    storyDataStore.set(storyData ?? EMPTY_STORY);
  });
  let storyCurrentChapterId = $derived(storyData?.chapters[storyPlayback.currentChapterIndex]?.id ?? null);
  setViewerContext({
    state: viewerState,
    derived: viewerDerived,
    controller,
    settings: {
      get layout() {
        return viewerSettingsLayout;
      },
      set layout(val) {
        if (val === viewerSettingsLayout) return;
        viewerSettingsLayout = val;
        if (val !== '1x1') {
          viewerState.showMetadata.set(false);
          viewerState.showSearch.set(false);
          viewerState.showAnnotations.set(false);
          viewerState.showTools.set(false);
          if (!workspace) {
            workspace = new WorkspaceStore(manifestId);
          }
          workspace.setLayoutPreset(val);
        } else {
          workspace = null;
        }
      },
      get theme() {
        return viewerSettingsTheme;
      },
      set theme(val) {
        viewerSettingsTheme = val;
      },
      get locale() {
        return viewerSettingsLocale;
      },
      set locale(val) {
        applyViewerSettingsLocale(val);
      },
      get layoutMode() {
        return get(layoutMode);
      },
      set layoutMode(val) {
        controller.setLayoutMode(val);
      },
    },
    get canDrawAnnotations() {
      return canDrawAnnotations;
    },
    get annotationMode() {
      return effectiveAnnotationMode;
    },
  });

  /**
   * The `Stage` props that do not vary by mode.
   *
   * Every mode renders the same stage; what differs is the chrome around it
   * and which panels it is allowed to offer. Those differences were buried in
   * three ~60-line prop lists that agreed on most of their contents, so
   * telling the modes apart meant diffing them by eye. Spreading the common
   * half leaves each call site showing only what actually makes it that mode.
   *
   * `bind:this` and `bind:canZoom` stay written out at each call: bindings are
   * not values and cannot be spread.
   */
  const commonStageProps = $derived({
    rendererComponent: $rendererComponent,
    avController,
    mediaSource: $mediaSource,
    layoutMode: $layoutMode,
    activeLayoutImages: $activeLayoutImages,
    highlightIds: $highlightIds,
    hoverAnnotationId: $hoverAnnotationId,
    overlayPlugins: $pluginSlots.overlay,
    pluginContext,
    rendererHandlers,
    isFetching: $manifestEntry?.isFetching ?? false,
    error: $manifestEntry?.error ?? '',
    imageFilters: $imageFilters,
    mediaType: $mediaType,
    viewerConfig: normalisedConfig,
    rotation: $rotation,
    initialViewBox: initialViewState.viewBox,
    layers: $mediaSources,
    layerOpacities: $layerOpacities,
    canvasId: activeCanvasId,
    onzoomchange: handleStageZoomChange,
    onrotationchange: (detail: { rotation: number }) =>
      controller.handleRotationChange(detail),
    onannotationcreate: handleAnnotationCreate,
    onannotationupdate: (payload: { id: string; patch: unknown }) =>
      handleAnnotationUpdate(payload.id, payload.patch as Partial<ResolvedAnnotation>),
  });
</script>

<div
  class="viewer"
  class:viewer--story-viewer={isStoryViewer}
  class:viewer--story-builder={isStoryBuilder}
  class:viewer--annotation-editor={isAnnotationEditor}
  class:viewer--fullscreen-fallback={isViewerFullscreenFallback}
  data-theme={viewerSettingsTheme}
  aria-live="polite"
  bind:this={viewerRoot}
>
  {#if leftVisibleEffective && !isStoryViewer && !isStoryBuilder}
    <button
      type="button"
      class="viewer__backdrop viewer__backdrop--active"
      aria-label={$t('viewer.stage.controls.closePanels')}
      onclick={closeMobileLeftDrawer}
    ></button>
  {/if}

  <div class="viewer__top-row">
    <div class="viewer__top-title">
      {#if isStoryViewer}
        <MangoFooterBrand position="inline" />
        {#if storyTitle}
          <span class="viewer__title-divider" aria-hidden="true">|</span>
          <span>{storyTitle}</span>
        {/if}
      {:else if !isStoryBuilder}
        <ViewerHeader {manifestId} manifestEntry={$manifestEntry} />
      {/if}
    </div>

    <div class="viewer__top-actions">
      {#if $pluginSlots.top.length > 0}
        <PluginSlot slot="top" plugins={$pluginSlots.top} {pluginContext} />
      {/if}

      {#if isAnnotationEditor}
        <button type="button" class="viewer__export-btn" onclick={handleExportAnnotations}>
          {$t('viewer.panels.annotations.export') || 'Export Annotations'}
        </button>
        {#if annotationExportStatus}
          <span class="viewer__export-status" role="status">{annotationExportStatus}</span>
        {/if}
      {/if}

      <button
        type="button"
        class="viewer__fullscreen-btn viewer__fullscreen-btn--labelled"
        onclick={handleStoryFullscreen}
      aria-label={isViewerFullscreen ? $t('viewer.stage.controls.closeFullscreen') : $t('viewer.stage.controls.enterFullscreen')}
      title={isViewerFullscreen ? $t('viewer.stage.controls.closeFullscreen') : $t('viewer.stage.controls.enterFullscreen')}
      >
        {#if isViewerFullscreen}
          <Shrink aria-hidden="true" />
        {:else}
          <Expand aria-hidden="true" />
        {/if}
      <span>{isViewerFullscreen ? $t('viewer.stage.controls.closeFullscreen') : $t('viewer.stage.controls.fullscreen')}</span>
      </button>
    </div>
  </div>

  {#if isPlainViewerMode && sidebarEnabled && sidebarCollapsed && !isMobileLayout}
    <button
      class="viewer__expand-sidebar"
      type="button"
      onclick={expandViewerSidebar}
      aria-label={$t('viewer.stage.controls.expandSidebar')}
      title={$t('viewer.stage.controls.expandSidebar')}
    >
      <ChevronsRight aria-hidden="true" />
    </button>
  {/if}

  <div
    class="viewer__grid"
    class:viewer__grid--controls={showControlRail}
    class:viewer__grid--nav-compact={showControlRail &&
      (leftVisibleEffective || showManifestManager) &&
      !isMobileLayout}
    class:viewer__grid--left={leftVisibleEffective}
    class:viewer__grid--right={rightVisibleEffective}
    class:viewer__grid--sidebar-right={sidebarPosition === 'right'}
  >
    {#if showControlRail}
      <aside class="viewer__control-rail" aria-label={$t('viewer.stage.controls.label')}>
        <ViewerDock
          compact={true}
          variant="sidebar"
          mobile={isMobileLayout || isShortLayout}
          iconOnly={leftVisibleEffective || showManifestManager}
          galleryActive={showThumbnailsEffectiveStory}
          contentsTab={contentsPanelTab}
          allowThumbnails={allowThumbnailsStory}
          allowCollection={allowCollectionStory}
          allowContents={allowContentsStory}
          allowChapters={allowChaptersStory}
          allowTranscript={allowTranscriptStory}
          allowSearch={allowSearchStory}
          allowMetadata={allowMetadataStory}
          allowAnnotations={allowAnnotationsStory}
          allowTools={allowToolsStory}
          allowLayers={allowLayersStory}
          allowSettings={allowSettingsStory}
          showThumbnails={showThumbnailsEffectiveStory}
          showCollection={showCollectionEffectiveStory}
          showContents={showContentsEffectiveStory}
          showSearch={showSearchEffectiveStory}
          showMetadata={$showMetadata}
          showAnnotations={showAnnotationsEffectiveStory}
          showTools={showToolsEffectiveStory}
          showLayers={showLayersEffectiveStory}
          showSettings={showSettingsEffectiveStory}
          showCompare={showComparePanel}
          {showManifestManager}
          multiView={isMultiView}
          oncollapse={collapseViewerSidebar}
          ongalleryopen={handleGalleryOpen}
          oncontentsopen={openContentsPanel}
          oncomparetoggle={() => handleViewerPanelToggle('compare', !showComparePanel)}
          onmanifesttoggle={toggleManifestManager}
          onpanelToggle={(detail) => handleViewerPanelToggle(detail.panel, detail.open)}
        />
      </aside>
    {/if}

    {#if showManifestManager}
      <div
        class="viewer__manifest-overlay"
        class:viewer__manifest-overlay--right={sidebarPosition === 'right'}
      >
        <ManifestManager
          {workspace}
          onclose={() => (showManifestManager = false)}
          onsingleload={(id) => (manifestId = id)}
        />
      </div>
    {/if}

    {#if !isStoryViewer && !isAnnotationEditor && sidebarEnabled}
      <LeftPanelStack
        visible={leftVisibleEffective}
        redesigned={isPlainViewerMode}
        contentsTab={contentsPanelTab}
        showAnnotations={showAnnotationsEffectiveStory}
        showCollection={showCollectionEffectiveStory}
        showTools={showToolsEffectiveStory}
        showSearch={showSearchEffectiveStory}
        showMetadata={$showMetadata}
        showSettings={showSettingsEffectiveStory}
        showContents={showContentsEffectiveStory}
        showLayers={showLayersEffectiveStory}
        showCompare={showComparePanel}
        leftPlugins={$pluginSlots.left}
        {pluginContext}
        onpanelToggle={handleViewerPanelToggle}
        oncollectionSelect={handleCollectionSelect}
      />
    {/if}

    {#if isStoryViewer}
      <main class="stage stage--story" aria-label={$t('viewer.stage.label')}>
        {#if StoryControlsStageComponent && StoryAnnotationOverlayComponent}
          <StoryControlsStageComponent
            currentChapterIndex={storyPlayback.currentChapterIndex}
            totalChapters={storyChapters}
            chapterThumbnails={storyChapterThumbnails}
            chapterDurationSec={storyPlayback.chapterDurationSec}
            chapterElapsedSec={storyPlayback.chapterElapsedSec}
            stageOpacity={storyPlayback.stageOpacity}
            stageFadeMs={storyPlayback.stageFadeMs}
            {chapterTitle}
            {chapterDescription}
            disabled={storyControlsDisabled || storyLoading}
            loading={storyPlayback.isLoading}
            error={storyError}
            playState={storyPlayback.playState}
            onselectChapter={(detail) => storyPlayback.selectChapter(detail.index, true)}
            onplay={storyPlayback.play}
            onpause={storyPlayback.pause}
            onstop={storyPlayback.stop}
            onzoomIn={handleZoomIn}
            onzoomOut={handleZoomOut}
            onfit={handleHome}
            onrefresh={storyPlayback.refresh}
            onpreviousChapter={storyPlayback.previousChapter}
            onnextChapter={storyPlayback.nextChapter}
          >
            {#snippet stage()}
              <div class="stage__story-slot">
                <Stage
                  bind:this={stageRef}
                  bind:canZoom
                  {...commonStageProps}
                  fillHeight={true}
                  annotations={$overlayAnnotations}
                  activeAnnotationId={$activeAnnotationId}
                  allowThumbnails={allowThumbnailsStory}
                  allowSearch={allowSearchStory}
                  allowMetadata={allowMetadataStory}
                  allowAnnotations={allowAnnotationsStory}
                  allowTools={allowToolsStory}
                  allowLayers={allowLayersStory}
                  allowContents={allowContentsStory}
                  showDock={stageDockVisible}
                  constrainMediaHeight={false}
                  showThumbnails={showThumbnailsEffectiveStory}
                  showSearch={showSearchEffectiveStory}
                  showMetadata={false}
                  showAnnotations={showAnnotationsEffectiveStory}
                  showTools={showToolsEffectiveStory}
                  showContents={showContentsEffectiveStory}
                  showLayers={showLayersEffectiveStory}
                  onviewboxchange={(detail) => {
                    controller.handleViewBoxChange(detail);
                    storyViewBoxStore.set(detail.viewBox);
                  }}
                  onpaneltoggle={(detail) => controller.setPanelOpen(detail.panel, detail.open)}
                />
                <StoryAnnotationOverlayComponent
                  story={storyDataStore}
                  viewBox={storyViewBoxStore}
                  chapterId={storyCurrentChapterId}
                  language={storyLanguage}
                />
              </div>
            {/snippet}
          </StoryControlsStageComponent>
        {/if}
      </main>
    {:else if isAnnotationEditor}
      <main class="stage stage--story" aria-label={$t('viewer.stage.label')}>
        {#if AnnotationWorkspaceComponent}
          <AnnotationWorkspaceComponent
            annotations={editorAnnotations}
            activeAnnotationId={$activeAnnotationId}
            draftAnnotation={draftAnno}
            isDirty={annotationDirty}
            saveState={annotationSaveState}
            expertMode={annotationExpertMode}
            languages={annotationLanguages}
            onannotationcancel={handleAnnotationCancel}
            canUndo={commandState.canUndo}
            canRedo={commandState.canRedo}
            onundo={handleAnnotationUndo}
            onredo={handleAnnotationRedo}
            onkeyboardcreate={handleKeyboardAnnotationCreate}
            onkeydown={handleAnnotationKeydown}
            activeTool={annotationEditorTool}
            layers={annotationLayers}
            activeLayerId={activeAnnotationLayerId}
            onactivelayerchange={(detail) => (activeAnnotationLayerId = detail.id)}
            ontoolchange={(detail) => {
              if (
                detail.tool === 'rectangle' ||
                detail.tool === 'point' ||
                detail.tool === 'polygon' ||
                detail.tool === 'freehand' ||
                detail.tool === 'line'
              ) {
                annotationEditorTool = detail.tool;
                controller.setAnnotationMode('create');
              } else {
                annotationEditorTool = detail.tool;
                controller.setAnnotationMode('edit');
                /*
                 * A pending draft keeps the selection.
                 *
                 * The editor returns to select mode on its own the moment a
                 * shape is finished, which arrives here as an ordinary tool
                 * change — so clearing unconditionally deselected the very
                 * annotation the user had just drawn, leaving the inspector
                 * empty and the draft unreachable. Picking the select tool
                 * deliberately still clears, because then there is no draft.
                 */
                if (!draftAnno) controller.handleAnnotationClear();
              }
            }}
            ontogglelayer={handleToggleLayer}
            onaddlayer={handleAddLayer}
            onlayercolorchange={handleLayerColorChange}
            onlayerrename={handleLayerRename}
            onlayermove={handleLayerMove}
            onlayerarchive={handleLayerArchive}
            onannotationselect={(detail) => {
              const selectedDraft = draftAnno?.id === detail.id;
              if (!selectedDraft && !confirmAnnotationNavigation()) return;
              controller.handleAnnotationSelect(detail);
              if (!selectedDraft) {
                annotationEditorTool = 'select';
                controller.setAnnotationMode('edit');
              }
            }}
            onannotationdelete={(detail) => handleAnnotationDelete(detail.id)}
            onannotationupdate={(detail) =>
              handleAnnotationUpdate(detail.id, detail.patch, detail.options ?? {})}
            onannotationsave={handleAnnotationSave}
            onlistopenchange={(detail: { open: boolean }) =>
              setAnnotationListHostState(detail.open)}
          >
            {#snippet stage()}
              <div class="stage__story-slot">
                <Stage
                  bind:this={stageRef}
                  bind:canZoom
                  {...commonStageProps}
                  fillHeight={true}
                  annotations={editorStageAnnotations}
                  activeAnnotationId={$activeAnnotationId}
                  allowThumbnails={false}
                  allowSearch={false}
                  allowMetadata={false}
                  allowAnnotations={false}
                  allowTools={false}
                  allowContents={false}
                  showDock={false}
                  constrainMediaHeight={false}
                  showThumbnails={false}
                  showSearch={false}
                  showMetadata={false}
                  showAnnotations={false}
                  showTools={false}
                  showContents={false}
                  annotationTool={annotationEditorTool}
                  annotationEditorEnabled={true}
                  {annotationLayers}
                  activeLayerId={activeAnnotationLayerId}
                  oneditorready={(instance) => (annotationEditor = instance)}
                  ongeometrycommit={(detail) =>
                    commandStack.recordGeometry(detail.id, 'geometry')}
                  onviewboxchange={(detail) => controller.handleViewBoxChange(detail)}
                  onannotationdelete={(payload) => handleAnnotationDelete(payload.id)}
                  onannotationselect={(payload) => {
                    if (
                      draftAnno?.id !== payload.id &&
                      !confirmAnnotationNavigation()
                    ) return;
                    controller.handleAnnotationSelect(payload);
                    annotationEditorTool = 'select';
                    controller.setAnnotationMode('edit');
                  }}
                  onannotationtoolchange={(detail) => {
                    annotationEditorTool = detail.tool;
                  }}
                />
                <StageToolbar
                  {canZoom}
                  {hasSource}
                  placement="below"
                  mediaType={$mediaType}
                  selectedCanvasIndex={$selectedCanvasIndex}
                  totalCanvases={$canvases.length}
                  {zoomPercent}
                  rotation={$rotation}
                  onhome={handleHome}
                  onzoomIn={handleZoomIn}
                  onzoomOut={handleZoomOut}
                  onsetZoomPercent={(detail) => handleSetZoomPercent(detail)}
                  onrotate={handleRotate}
                  onsetCanvasIndex={(detail) => handleSetCanvasIndex(detail)}
                  onprevCanvas={handlePrevCanvas}
                  onnextCanvas={handleNextCanvas}
                />
              </div>
            {/snippet}
          </AnnotationWorkspaceComponent>
        {/if}
      </main>
    {:else}
      <main
        class="stage"
        class:stage--viewer={isPlainViewerMode}
        class:stage--joined-sidebar-left={isPlainViewerMode &&
          showControlRail &&
          !leftVisibleEffective &&
          !isMobileLayout &&
          sidebarPosition === 'left'}
        class:stage--joined-sidebar-right={isPlainViewerMode &&
          showControlRail &&
          !leftVisibleEffective &&
          !isMobileLayout &&
          sidebarPosition === 'right'}
        class:stage--story-builder={isStoryBuilder}
        class:stage--with-bottom-toolbar={!toolbarAboveMedia}
        class:stage--workspace={!!workspace && viewerSettingsLayout !== '1x1'}
        aria-label={$t('viewer.stage.label')}
      >
        {#if viewerSettingsLayout === '1x1'}
          <div
            class:stage__viewer-frame={isPlainViewerMode}
            class:stage__viewer-frame--controls-visible={isPlainViewerMode &&
              viewerControlsVisible}
            class="stage__primary"
            style={isStoryBuilder
              ? `opacity: ${storyPlayback.stageOpacity}; transition: opacity ${storyPlayback.stageFadeMs}ms ease-in-out;`
              : undefined}
            use:trackViewerControlsActivity
          >
            {#if toolbarAboveMedia && $layoutMode !== 'gallery'}
              <StageToolbar
                {canZoom}
                {hasSource}
                placement="above"
                mediaType={$mediaType}
                selectedCanvasIndex={$selectedCanvasIndex}
                totalCanvases={$canvases.length}
                {zoomPercent}
                rotation={$rotation}
                onhome={handleHome}
                onzoomIn={handleZoomIn}
                onzoomOut={handleZoomOut}
                onsetZoomPercent={(detail) => handleSetZoomPercent(detail)}
                onrotate={handleRotate}
                onsetCanvasIndex={(detail) => handleSetCanvasIndex(detail)}
                onprevCanvas={handlePrevCanvas}
                onnextCanvas={handleNextCanvas}
              />
            {/if}

            {#if $layoutMode === 'gallery'}
              <StageGalleryView
                canvases={$canvases}
                thumbnails={$canvasThumbnails}
                selectedCanvasIndex={$selectedCanvasIndex}
                onselect={(detail) => {
                  controller.setCanvasByIndex(detail.index);
                  controller.setLayoutMode('single');
                }}
              />
            {:else}
              <Stage
                bind:this={stageRef}
                bind:canZoom
                {...commonStageProps}
                fillHeight={isStoryBuilder}
                annotations={$overlayAnnotations}
                activeAnnotationId={isStoryBuilder && storyAnnotationEditing
                  ? storyBuilderActiveAnnotationId
                  : $activeAnnotationId}
                allowThumbnails={allowThumbnailsStory}
                allowSearch={allowSearchStory}
                allowMetadata={allowMetadataStory}
                allowAnnotations={allowAnnotationsStory}
                allowTools={allowToolsStory}
                allowLayers={allowLayersStory}
                allowContents={allowContentsStory}
                showDock={stageDockVisible}
                constrainMediaHeight={!toolbarAboveMedia}
                showThumbnails={showThumbnailsEffectiveStory}
                showSearch={showSearchEffectiveStory}
                showMetadata={$showMetadata}
                showAnnotations={showAnnotationsEffectiveStory}
                showTools={showToolsEffectiveStory}
                showContents={showContentsEffectiveStory}
                showLayers={showLayersEffectiveStory}
                onviewboxchange={(detail) => controller.handleViewBoxChange(detail)}
                onpaneltoggle={(detail) => controller.setPanelOpen(detail.panel, detail.open)}
                annotationTool={annotationEditorTool}
                annotationEditorEnabled={isStoryBuilder && storyAnnotationEditing}
                annotationEditorAnnotations={storyBuilderAnnotations}
                labelSizing={STORY_LABEL_SIZING}
                {annotationLayers}
                onannotationdelete={(payload) => handleAnnotationDelete(payload.id)}
                onannotationselect={(payload) => {
                  if (isStoryBuilder && storyAnnotationEditing) {
                    storyBuilderActiveAnnotationId = payload.id;
                  }
                }}
                onannotationtoolchange={(detail) => {
                  annotationEditorTool = detail.tool;
                  controller.setAnnotationMode(detail.tool === 'select' ? 'edit' : 'create');
                }}
              />
            {/if}

            {#if !toolbarAboveMedia && $layoutMode !== 'gallery'}
              <StageToolbar
                {canZoom}
                {hasSource}
                placement="below"
                mediaType={$mediaType}
                selectedCanvasIndex={$selectedCanvasIndex}
                totalCanvases={$canvases.length}
                {zoomPercent}
                rotation={$rotation}
                onhome={handleHome}
                onzoomIn={handleZoomIn}
                onzoomOut={handleZoomOut}
                onsetZoomPercent={(detail) => handleSetZoomPercent(detail)}
                onrotate={handleRotate}
                onsetCanvasIndex={(detail) => handleSetCanvasIndex(detail)}
                onprevCanvas={handlePrevCanvas}
                onnextCanvas={handleNextCanvas}
              />
            {/if}
          </div>

          {#if showThumbnailsEffectiveStory && $layoutMode !== 'gallery'}
            <Gallery
              redesigned={isPlainViewerMode}
              canvases={$canvases}
              canvasThumbnails={$canvasThumbnails}
              selectedCanvasIndex={$selectedCanvasIndex}
              onpanelToggle={(detail) => controller.setPanelOpen(detail.panel, detail.open)}
              oncanvasSelect={(detail) => handleGalleryCanvasSelect(detail.index)}
              onviewall={isPlainViewerMode ? () => controller.setLayoutMode('gallery') : undefined}
            />
          {/if}

          {#if $pluginSlots.bottom.length > 0}
            <div class="stage__bottom">
              <PluginSlot plugins={$pluginSlots.bottom} {pluginContext} />
            </div>
          {/if}
        {:else if workspace}
          <GridContainer
            node={workspace.layout}
            activeWindowId={workspace.activeWindowId}
            onfocuswindow={(id) => workspace.setActiveWindow(id)}
            onmovewindow={(detail) => workspace?.moveWindow(detail.id, detail.direction)}
            onclosewindow={(id) => {
              workspace?.closeWindow(id);
              if (workspace && workspace.layout.type === 'window') {
                viewerSettingsLayout = '1x1';
              }
            }}
            onloadmanifest={(detail) => {
              workspace?.setWindowManifest(detail.id, detail.manifestId);
              workspace?.setActiveWindow(detail.id);
            }}
            oncanvaschange={(detail) =>
              workspace?.setWindowCanvasIndex(detail.id, detail.canvasIndex)}
            onresizesplit={(detail) => workspace?.updateSplitSizes(detail.targetId, detail.sizes)}
            onopenmanifestmanager={(id) => {
              workspace?.setActiveWindow(id);
              closeLeftPanelStores();
              showManifestManager = true;
            }}
          />
        {/if}
      </main>
    {/if}

    {#if !isStoryViewer && rightVisibleEffective}
      <aside class="panel-stack panel-stack--right" aria-label={$t('viewer.panels.rightLabel')}>
        {#if $pluginSlots.right.length > 0}
          <PluginSlot plugins={$pluginSlots.right} {pluginContext} />
        {/if}
      </aside>
    {/if}

  </div>
</div>

<style>

  .viewer__top-row {
    display: flex;
    align-items: flex-start;
    min-width: 0;
    gap: 12px;
  }

  .viewer__top-title {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1 1 auto;
    min-width: 0;
  }

  .viewer__title-divider {
    color: var(--viewer-muted, rgba(255, 255, 255, 0.35));
    font-size: 14px;
    font-weight: 300;
    line-height: 1;
    user-select: none;
    flex-shrink: 0;
  }

  .viewer__top-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: 0 0 auto;
    gap: 10px;
  }

  .viewer__export-btn {
    background: #ff6b35;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.2s,
      transform 0.1s;
    font-family: inherit;
    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.25);
  }
  .viewer__export-btn:hover {
    background: #ff8552;
    transform: translateY(-1px);
  }
  .viewer__export-btn:active {
    transform: translateY(0);
  }
  .viewer__export-status {
    max-width: 34ch;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    line-height: 1.3;
  }

  .viewer__fullscreen-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid var(--viewer-panel-border);
    border-radius: 10px;
    background: var(--viewer-panel);
    color: var(--viewer-text);
    width: 34px;
    height: 34px;
    cursor: pointer;
    z-index: 10;
    line-height: 1;
    font-size: 16px;
  }

  .viewer__fullscreen-btn--labelled {
    width: auto;
    padding-inline: 10px;
    border-color: transparent;
    background: transparent;
    font-size: 13px;
  }

  .viewer__fullscreen-btn :global(svg) {
    width: 18px;
    height: 18px;
  }

  .viewer__expand-sidebar {
    position: absolute;
    top: 50%;
    left: -1px;
    z-index: 8;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 58px;
    padding: 0;
    border: 1px solid var(--viewer-panel-border);
    border-left: 0;
    border-radius: 0 12px 12px 0;
    background: var(--viewer-panel-strong);
    color: var(--viewer-text);
    font: inherit;
    cursor: pointer;
    box-shadow: 6px 0 18px rgba(0, 0, 0, 0.24);
    transform: translateY(-50%);
    transition:
      width 160ms ease,
      background-color 160ms ease,
      border-color 160ms ease;
  }

  .viewer__expand-sidebar:hover {
    width: 42px;
    border-color: var(--viewer-accent);
    background: var(--viewer-panel);
  }

  .viewer__expand-sidebar:focus-visible {
    outline: 2px solid var(--viewer-accent);
    outline-offset: 2px;
  }

  .viewer__expand-sidebar :global(svg) {
    width: 20px;
    height: 20px;
  }

  .viewer {
    --viewer-bg: #0f141b;
    --viewer-surface: #151d26;
    --viewer-panel: #121922;
    --viewer-panel-strong: #1b242e;
    --viewer-panel-border: rgba(255, 255, 255, 0.08);
    --viewer-text: #e8edf4;
    --viewer-muted: #9aa6b2;
    --viewer-accent: #ff4fa2;
    --viewer-accent-2: #2ac7ff;
    --viewer-accent-tools: #a3e635;
    --viewer-stage: #111720;
    --viewer-stage-glow: rgba(42, 199, 255, 0.12);
    --viewer-stage-tail: #0b0f14;
    --viewer-dock-button-bg: rgba(15, 20, 27, 0.95);
    --viewer-dock-button-border: rgba(255, 255, 255, 0.12);
    --viewer-dock-tooltip-bg: rgba(10, 14, 19, 0.95);
    --viewer-dock-active-border: rgba(42, 199, 255, 0.58);
    --viewer-dock-active-ring: rgba(42, 199, 255, 0.22);
    --viewer-dock-active-chip-text: #06141d;
    --viewer-dock-button-shadow: 0 12px 24px rgba(0, 0, 0, 0.35);
    --viewer-dock-active-shadow-base: 0 12px 24px rgba(0, 0, 0, 0.35);
    --viewer-gallery-bg: rgba(10, 14, 19, 0.85);
    --viewer-gallery-item-bg: rgba(18, 25, 34, 0.85);
    --viewer-gallery-item-border: rgba(255, 255, 255, 0.08);
    --viewer-gallery-thumb-bg: rgba(255, 255, 255, 0.06);
    --viewer-gallery-close-bg: rgba(255, 255, 255, 0.1);
    --viewer-gallery-active-ring: rgba(42, 199, 255, 0.2);
    --viewer-close-button-size: 28px;
    --viewer-close-button-radius: 10px;
    --viewer-close-button-border: rgba(255, 255, 255, 0.18);
    --viewer-close-button-bg: rgba(255, 255, 255, 0.1);
    --viewer-close-button-hover-bg: rgba(255, 255, 255, 0.16);
    --viewer-close-button-hover-border: rgba(255, 255, 255, 0.34);
    --viewer-close-button-color: var(--viewer-text);
    --viewer-close-button-glyph-size: 15px;
    --viewer-close-button-focus-ring: rgba(42, 199, 255, 0.55);
    --viewer-stage-bottom-bg: rgba(12, 16, 22, 0.72);
    --viewer-toolbar-separator: rgba(255, 255, 255, 0.14);
    --viewer-toolbar-group-border: rgba(255, 255, 255, 0.1);
    --viewer-toolbar-group-bg: transparent;
    --viewer-toolbar-button-bg: rgba(255, 255, 255, 0.03);
    --viewer-toolbar-button-hover-bg: rgba(255, 255, 255, 0.08);
    --viewer-toolbar-value-text: rgba(230, 236, 246, 0.96);
    --viewer-toolbar-value-bg: transparent;
    --viewer-search-input-bg: rgba(10, 14, 19, 0.8);
    --viewer-search-clear-bg: rgba(255, 255, 255, 0.1);
    --viewer-search-item-bg: rgba(255, 255, 255, 0.06);
    --viewer-search-item-hover-bg: rgba(255, 255, 255, 0.1);
    --viewer-search-focus: rgba(42, 199, 255, 0.65);
    --viewer-control-rail-bg: linear-gradient(
      180deg,
      rgba(20, 28, 37, 0.92) 0%,
      rgba(14, 20, 29, 0.92) 100%
    );

    /*
     * Story chrome runs its own palette rather than reusing `--viewer-accent`:
     * the story viewer is a presentation surface with its own identity, and the
     * two accents are deliberately different in the default theme. Every theme
     * below restates this block, so a story never inherits a palette that was
     * only contrast-checked against viewer chrome. The story components consume
     * these with the dark values as literal fallbacks, so they still render
     * standalone (tests, storybook) outside a themed `.viewer`.
     */
    --story-shell-bg: linear-gradient(180deg, #10161e 0%, #0b1118 100%);
    --story-line: rgba(255, 255, 255, 0.14);
    --story-text: #edf5ff;
    --story-muted: #d8dee9;
    --story-accent: #9a57ff;
    --story-accent-2: #4bc6ff;
    --story-accent-text: #be8dff;
    --story-accent-text-hover: #d8bcff;
    --story-control-bg: rgba(8, 17, 32, 0.6);
    --story-control-border: rgba(255, 255, 255, 0.24);
    --story-control-hover-bg: rgba(255, 255, 255, 0.12);
    --story-track-bg: rgba(255, 255, 255, 0.2);
    --story-track-border: rgba(255, 255, 255, 0.15);
    --story-active-ring: rgba(64, 171, 245, 0.84);
    --story-active-halo: rgba(227, 240, 255, 0.42);
    --story-error: #ffb3c1;
    --story-note-bg: rgba(255, 255, 255, 0.92);
    --story-note-text: #2b2520;
    --story-label-bg: rgba(20, 16, 12, 0.82);
    --story-label-text: #ffffff;

    /*
     * Status colours and the story builder's accent. These carry meaning rather
     * than decoration, so each theme restates them at a lightness that reads on
     * its own panels — the dark theme's pale pinks and greens vanish on a light
     * surface. Tints and washes are mixed from these at the use site.
     */
    --viewer-danger: #ffb8b8;
    --viewer-success: #72cea4;
    --viewer-warning: #e8b85f;
    --story-builder-accent: #b4551f;
    --story-builder-accent-hover: #a8480f;
    /*
     * Sunken surfaces — inputs, scrub tracks, timeline wells. These sit *below*
     * their panel, so they cannot be mixed from `--viewer-text` the way raised
     * fills are: on a dark theme that would lighten them. Each theme states its
     * own recess instead.
     */
    --viewer-well-bg: rgba(5, 10, 16, 0.35);
    --viewer-focus-ring: rgba(42, 199, 255, 0.7);

    display: grid;
    grid-template-rows: auto 1fr;
    gap: 16px;
    box-sizing: border-box;
    height: 100%;
    max-height: none;
    min-height: 0;
    overflow: hidden;
    padding: 20px;
    border-radius: 24px;
    background: radial-gradient(120% 120% at 10% 0%, #1d2632 0%, #111720 55%, #0b0f14 100%);
    color: var(--viewer-text);
    font-family: sans-serif;
    /* Shadow DOM blocks selector leakage, but inherited text properties still
       cross the host boundary. Keep host typography and bidi choices from
       silently rewriting viewer labels or rearranging time values. */
    font-style: normal;
    font-variant: normal;
    font-size: 16px;
    font-weight: 400;
    line-height: normal;
    letter-spacing: normal;
    word-spacing: normal;
    word-break: normal;
    overflow-wrap: normal;
    white-space: normal;
    text-align: left;
    text-indent: 0;
    text-transform: none;
    direction: var(--mango-viewer-direction, ltr);
    border: 1px solid #1c2530;
    box-shadow: var(--viewer-frame-shadow, none);
    container-type: size;
    container-name: mango-viewer;
    position: relative;

    /* Desktop default: contained with fixed height */
  }

  .viewer:fullscreen {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    min-height: 0;
    border-radius: 0;
    overscroll-behavior: none;
    touch-action: auto;
  }

  .viewer.viewer--story-builder {
    min-height: 0;
    gap: 12px;
    padding: 14px;
  }

  .viewer--story-builder .viewer__top-row {
    align-items: center;
  }

  .viewer--story-builder .viewer__top-title {
    display: none;
  }

  .viewer--story-builder .viewer__top-actions {
    flex: 1 1 auto;
  }

  .viewer--story-builder .viewer__top-actions :global(.plugin-slot) {
    flex: 1 1 auto;
  }

  .viewer--story-builder .viewer__top-actions :global(.plugin-panel__panel) {
    padding: 0;
    border: 0;
    background: transparent;
  }

  .viewer--story-builder .viewer__top-actions :global(.plugin-panel__title) {
    display: none;
  }

  .viewer.viewer--story-viewer {
    --story-shell-radius: 18px;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0;
    padding: 0;
    border: 0;
    border-radius: var(--story-shell-radius);
    background: var(--viewer-surface);
  }

  .viewer--story-viewer .viewer__top-row {
    position: relative;
    z-index: 12;
    align-items: center;
    min-height: 56px;
    padding: 10px 12px;
    box-sizing: border-box;
    background: var(--viewer-surface);
    border-bottom: 1px solid var(--viewer-panel-border);
  }

  .viewer--story-viewer .viewer__top-title {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
    color: var(--viewer-text);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
  }

  .viewer--story-viewer .viewer__top-title span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .viewer--story-viewer .viewer__fullscreen-btn {
    width: auto;
    height: 36px;
  }

  .viewer--story-viewer .viewer__grid {
    height: auto;
    min-height: 0;
  }

  .viewer:-webkit-full-screen {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    min-height: 0;
    border-radius: 0;
    overscroll-behavior: none;
    touch-action: auto;
  }

  .viewer.viewer--fullscreen-fallback {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    max-height: 100vh;
    max-height: 100dvh;
    min-height: 0;
    border: 0;
    border-radius: 0;
    overscroll-behavior: none;
    touch-action: auto;
  }

  .viewer--story-viewer:fullscreen,
  .viewer--story-viewer:-webkit-full-screen,
  .viewer--story-viewer.viewer--fullscreen-fallback {
    --story-shell-radius: 0;
  }

  .viewer:fullscreen .viewer__grid {
    max-height: 100%;
  }

  .viewer:-webkit-full-screen .viewer__grid {
    max-height: 100%;
  }

  .viewer.viewer--fullscreen-fallback .viewer__grid {
    max-height: 100%;
  }

  .viewer:fullscreen::backdrop {
    background: #0b0f14;
  }

  .viewer[data-theme='light'] {
    --viewer-bg: #f3f5f8;
    --viewer-surface: #f7f8fb;
    --viewer-panel: #e9edf3;
    --viewer-panel-strong: #dde4ed;
    --viewer-panel-border: rgba(34, 48, 65, 0.12);
    --viewer-text: #223041;
    --viewer-muted: #586576;
    --viewer-accent: #53719c;
    --viewer-accent-2: #357f99;
    --viewer-stage: #f3f5f8;
    --viewer-stage-glow: rgba(108, 174, 199, 0.16);
    --viewer-stage-tail: #ffffff;
    --viewer-dock-button-bg: rgba(248, 251, 255, 0.96);
    --viewer-dock-button-border: rgba(34, 48, 65, 0.2);
    --viewer-dock-tooltip-bg: rgba(241, 246, 252, 0.97);
    --viewer-dock-active-border: rgba(21, 159, 206, 0.65);
    --viewer-dock-active-ring: rgba(42, 199, 255, 0.18);
    --viewer-dock-active-chip-text: #16435a;
    --viewer-dock-button-shadow: 0 10px 20px rgba(34, 48, 65, 0.18);
    --viewer-dock-active-shadow-base: 0 10px 20px rgba(34, 48, 65, 0.2);
    --viewer-gallery-bg: rgba(242, 246, 252, 0.92);
    --viewer-gallery-item-bg: rgba(255, 255, 255, 0.92);
    --viewer-gallery-item-border: rgba(34, 48, 65, 0.14);
    --viewer-gallery-thumb-bg: rgba(224, 232, 241, 0.72);
    --viewer-gallery-close-bg: rgba(255, 255, 255, 0.92);
    --viewer-gallery-active-ring: rgba(108, 174, 199, 0.26);
    --viewer-close-button-border: rgba(34, 48, 65, 0.2);
    --viewer-close-button-bg: rgba(255, 255, 255, 0.92);
    --viewer-close-button-hover-bg: rgba(233, 240, 248, 0.96);
    --viewer-close-button-hover-border: rgba(34, 48, 65, 0.3);
    --viewer-close-button-color: #223041;
    --viewer-close-button-focus-ring: var(--viewer-focus-ring);
    --viewer-stage-bottom-bg: rgba(241, 245, 251, 0.86);
    --viewer-toolbar-separator: rgba(34, 48, 65, 0.16);
    --viewer-toolbar-group-border: rgba(34, 48, 65, 0.16);
    --viewer-toolbar-group-bg: transparent;
    --viewer-toolbar-button-bg: rgba(255, 255, 255, 0.84);
    --viewer-toolbar-button-hover-bg: rgba(124, 150, 190, 0.2);
    --viewer-toolbar-value-text: #223041;
    --viewer-toolbar-value-bg: transparent;
    --viewer-search-input-bg: rgba(255, 255, 255, 0.92);
    --viewer-search-clear-bg: rgba(124, 150, 190, 0.2);
    --viewer-search-item-bg: rgba(255, 255, 255, 0.78);
    --viewer-search-item-hover-bg: rgba(124, 150, 190, 0.22);
    --viewer-search-focus: var(--viewer-focus-ring);
    --viewer-control-rail-bg: linear-gradient(
      180deg,
      rgba(241, 245, 251, 0.95) 0%,
      rgba(229, 236, 245, 0.95) 100%
    );
    --story-shell-bg: linear-gradient(180deg, #ffffff 0%, #eaf0f8 100%);
    --story-line: rgba(34, 48, 65, 0.14);
    --story-text: #1d2a3a;
    --story-muted: #56677d;
    --story-accent: #6d3bd4;
    --story-accent-2: #1f8fc4;
    --story-accent-text: #5a2fbd;
    --story-accent-text-hover: #43219a;
    --story-control-bg: rgba(255, 255, 255, 0.88);
    --story-control-border: rgba(34, 48, 65, 0.22);
    --story-control-hover-bg: rgba(109, 59, 212, 0.12);
    --story-track-bg: rgba(34, 48, 65, 0.14);
    --story-track-border: rgba(34, 48, 65, 0.12);
    --story-active-ring: rgba(31, 143, 196, 0.72);
    --story-active-halo: rgba(34, 48, 65, 0.24);
    --story-error: #b3243c;
    --story-note-bg: rgba(255, 255, 255, 0.95);
    --story-note-text: #1d2a3a;
    --story-label-bg: rgba(29, 42, 58, 0.86);
    --story-label-text: #ffffff;
    --viewer-danger: #b3243c;
    --viewer-success: #1d7a52;
    --viewer-warning: #8a5a00;
    --story-builder-accent: #b4551f;
    --story-builder-accent-hover: #93430f;
    --viewer-well-bg: rgba(34, 48, 65, 0.07);
    --viewer-focus-ring: #0b6fa4;
    border-color: #dbe2eb;
    box-shadow: var(--viewer-frame-shadow, none);
    background: radial-gradient(135% 135% at 10% 0%, #e6f1ff 0%, #f5faff 45%, #ffffff 100%);
  }

  .viewer[data-theme='sepia'] {
    --viewer-bg: #eee4d2;
    --viewer-surface: #f7f0e3;
    --viewer-panel: #e8dcc6;
    --viewer-panel-strong: #dac9aa;
    --viewer-panel-border: rgba(76, 58, 35, 0.16);
    --viewer-text: #3d3023;
    --viewer-muted: #67563f;
    --viewer-accent: #a86f46;
    --viewer-accent-2: #2f858b;
    --viewer-accent-tools: #66864a;
    --viewer-stage: #f4ecde;
    --viewer-stage-glow: rgba(47, 133, 139, 0.13);
    --viewer-stage-tail: #fffaf0;
    --viewer-dock-button-bg: rgba(255, 250, 240, 0.94);
    --viewer-dock-button-border: rgba(76, 58, 35, 0.2);
    --viewer-dock-tooltip-bg: rgba(250, 243, 230, 0.97);
    --viewer-dock-active-border: rgba(47, 133, 139, 0.68);
    --viewer-dock-active-ring: rgba(47, 133, 139, 0.2);
    --viewer-dock-active-chip-text: #173f42;
    --viewer-dock-button-shadow: 0 10px 20px rgba(76, 58, 35, 0.16);
    --viewer-dock-active-shadow-base: 0 10px 20px rgba(76, 58, 35, 0.18);
    --viewer-gallery-bg: rgba(244, 236, 222, 0.94);
    --viewer-gallery-item-bg: rgba(255, 250, 240, 0.94);
    --viewer-gallery-item-border: rgba(76, 58, 35, 0.15);
    --viewer-gallery-thumb-bg: rgba(224, 210, 185, 0.72);
    --viewer-gallery-close-bg: rgba(255, 250, 240, 0.94);
    --viewer-gallery-active-ring: rgba(47, 133, 139, 0.24);
    --viewer-close-button-border: rgba(76, 58, 35, 0.2);
    --viewer-close-button-bg: rgba(255, 250, 240, 0.94);
    --viewer-close-button-hover-bg: rgba(239, 227, 207, 0.96);
    --viewer-close-button-hover-border: rgba(76, 58, 35, 0.32);
    --viewer-close-button-color: #3d3023;
    --viewer-close-button-focus-ring: var(--viewer-focus-ring);
    --viewer-stage-bottom-bg: rgba(241, 231, 212, 0.88);
    --viewer-toolbar-separator: rgba(76, 58, 35, 0.16);
    --viewer-toolbar-group-border: rgba(76, 58, 35, 0.16);
    --viewer-toolbar-group-bg: transparent;
    --viewer-toolbar-button-bg: rgba(255, 250, 240, 0.86);
    --viewer-toolbar-button-hover-bg: rgba(47, 133, 139, 0.15);
    --viewer-toolbar-value-text: #3d3023;
    --viewer-toolbar-value-bg: transparent;
    --viewer-search-input-bg: rgba(255, 250, 240, 0.94);
    --viewer-search-clear-bg: rgba(47, 133, 139, 0.14);
    --viewer-search-item-bg: rgba(255, 250, 240, 0.78);
    --viewer-search-item-hover-bg: rgba(47, 133, 139, 0.16);
    --viewer-search-focus: var(--viewer-focus-ring);
    --viewer-control-rail-bg: linear-gradient(
      180deg,
      rgba(241, 231, 212, 0.96) 0%,
      rgba(229, 214, 188, 0.96) 100%
    );
    --story-shell-bg: linear-gradient(180deg, #f9f3e7 0%, #e8dbc2 100%);
    --story-line: rgba(76, 58, 35, 0.18);
    --story-text: #3d3023;
    --story-muted: #6b5a44;
    --story-accent: #a8562a;
    --story-accent-2: #2f858b;
    --story-accent-text: #8d451f;
    --story-accent-text-hover: #6d3415;
    --story-control-bg: rgba(255, 250, 240, 0.9);
    --story-control-border: rgba(76, 58, 35, 0.24);
    --story-control-hover-bg: rgba(168, 86, 42, 0.14);
    --story-track-bg: rgba(76, 58, 35, 0.16);
    --story-track-border: rgba(76, 58, 35, 0.14);
    --story-active-ring: rgba(47, 133, 139, 0.74);
    --story-active-halo: rgba(76, 58, 35, 0.26);
    --story-error: #a32b26;
    --story-note-bg: rgba(255, 250, 240, 0.95);
    --story-note-text: #3d3023;
    --story-label-bg: rgba(61, 48, 35, 0.86);
    --story-label-text: #fffaf0;
    --viewer-danger: #a32b26;
    --viewer-success: #2f6b4a;
    --viewer-warning: #7a5410;
    --story-builder-accent: #a8562a;
    --story-builder-accent-hover: #8a4319;
    --viewer-well-bg: rgba(76, 58, 35, 0.09);
    --viewer-focus-ring: #1b6b70;
    border-color: #d8c7aa;
    box-shadow: var(--viewer-frame-shadow, none);
    background: radial-gradient(135% 135% at 10% 0%, #f5ead7 0%, #eee4d2 48%, #e5d7bf 100%);
  }

  .viewer[data-theme='midnight'] {
    --viewer-bg: #07111f;
    --viewer-surface: #0a1728;
    --viewer-panel: #0c192a;
    --viewer-panel-strong: #13263d;
    --viewer-panel-border: rgba(126, 180, 235, 0.15);
    --viewer-text: #edf6ff;
    --viewer-muted: #91a7bf;
    --viewer-accent: #a78bfa;
    --viewer-accent-2: #38bdf8;
    --viewer-accent-tools: #5eead4;
    --viewer-stage: #050d18;
    --viewer-stage-glow: rgba(56, 189, 248, 0.15);
    --viewer-stage-tail: #020711;
    --viewer-dock-button-bg: rgba(7, 17, 31, 0.96);
    --viewer-dock-tooltip-bg: rgba(3, 10, 20, 0.97);
    --viewer-control-rail-bg: linear-gradient(
      180deg,
      rgba(12, 29, 48, 0.96) 0%,
      rgba(5, 15, 28, 0.96) 100%
    );
    --story-shell-bg: linear-gradient(180deg, #0b1b30 0%, #040c18 100%);
    --story-line: rgba(126, 180, 235, 0.18);
    --story-text: #edf6ff;
    --story-muted: #a8bdd6;
    --story-accent: #a78bfa;
    --story-accent-2: #38bdf8;
    --story-accent-text: #c4b1ff;
    --story-accent-text-hover: #ddd0ff;
    --story-control-bg: rgba(5, 15, 28, 0.72);
    --story-control-border: rgba(126, 180, 235, 0.28);
    --story-control-hover-bg: rgba(126, 180, 235, 0.14);
    --story-track-bg: rgba(126, 180, 235, 0.2);
    --story-track-border: rgba(126, 180, 235, 0.16);
    --story-active-ring: rgba(56, 189, 248, 0.82);
    --story-active-halo: rgba(199, 226, 255, 0.4);
    --story-error: #ff9db0;
    --viewer-danger: #ff9db0;
    --viewer-success: #5eead4;
    --viewer-warning: #fbbf24;
    /*
     * Deep rather than bright: these accents are button fills carrying white
     * labels, so the fill has to stay dark enough to clear 4.5:1 against white.
     * A lighter orange reads better against the midnight panel but drops the
     * label to ~2.4:1.
     */
    --story-builder-accent: #c2410c;
    --story-builder-accent-hover: #d4550f;
    --viewer-well-bg: rgba(3, 8, 16, 0.45);
    border-color: #142b46;
    box-shadow: var(--viewer-frame-shadow, none);
    background: radial-gradient(130% 130% at 8% 0%, #142a46 0%, #07111f 50%, #020711 100%);
  }

  /*
   * Ringo — the Yellow Submarine theme. A light-family palette (see the
   * `[data-theme='ringo']` entries in the `:is()` lists elsewhere in the
   * codebase, which it joins alongside light and sepia): yellow hull, sea-blue
   * secondary, Pepperland pink accent. The stage stays a pale cream rather than
   * going sea-blue, because stage overlays draw `--viewer-text` on top of it and
   * a dark stage under dark text is unreadable.
   */
  .viewer[data-theme='ringo'] {
    --viewer-bg: #ffd60a;
    --viewer-surface: #ffe987;
    --viewer-panel: #ffe15c;
    --viewer-panel-strong: #ffcf1f;
    --viewer-panel-border: rgba(74, 48, 0, 0.24);
    --viewer-text: #2e2000;
    --viewer-muted: #6d5200;
    --viewer-accent: #a8232b;
    --viewer-accent-2: #0072c6;
    --viewer-accent-tools: #00875a;
    --viewer-stage: #fff6c2;
    /* Warm, not the sea blue: a blue glow over the cream stage mixes to green. */
    --viewer-stage-glow: rgba(168, 35, 43, 0.1);
    --viewer-stage-tail: #fffdf0;
    --viewer-dock-button-bg: rgba(255, 250, 214, 0.96);
    --viewer-dock-button-border: rgba(74, 48, 0, 0.24);
    --viewer-dock-tooltip-bg: rgba(255, 247, 199, 0.97);
    --viewer-dock-active-border: rgba(168, 35, 43, 0.7);
    --viewer-dock-active-ring: rgba(168, 35, 43, 0.2);
    --viewer-dock-active-chip-text: #5a0723;
    --viewer-dock-button-shadow: 0 10px 20px rgba(74, 48, 0, 0.22);
    --viewer-dock-active-shadow-base: 0 10px 20px rgba(74, 48, 0, 0.24);
    --viewer-gallery-bg: rgba(255, 243, 176, 0.94);
    --viewer-gallery-item-bg: rgba(255, 252, 226, 0.94);
    --viewer-gallery-item-border: rgba(74, 48, 0, 0.18);
    --viewer-gallery-thumb-bg: rgba(240, 214, 120, 0.72);
    --viewer-gallery-close-bg: rgba(255, 252, 226, 0.94);
    --viewer-gallery-active-ring: rgba(0, 114, 198, 0.26);
    --viewer-close-button-border: rgba(74, 48, 0, 0.24);
    --viewer-close-button-bg: rgba(255, 252, 226, 0.94);
    --viewer-close-button-hover-bg: rgba(255, 238, 160, 0.96);
    --viewer-close-button-hover-border: rgba(74, 48, 0, 0.36);
    --viewer-close-button-color: #2e2000;
    --viewer-close-button-focus-ring: var(--viewer-focus-ring);
    --viewer-stage-bottom-bg: rgba(255, 244, 184, 0.88);
    --viewer-toolbar-separator: rgba(74, 48, 0, 0.2);
    --viewer-toolbar-group-border: rgba(74, 48, 0, 0.2);
    --viewer-toolbar-group-bg: transparent;
    /*
     * The transport controls are filled in the submarine's trim red with a pale
     * hull-yellow glyph, rather than being pale chips on the yellow panel. The
     * readout text beside them stays dark, because it sits on the panel itself
     * and not on a button.
     */
    --viewer-toolbar-button-bg: rgba(156, 43, 34, 0.94);
    --viewer-toolbar-button-hover-bg: rgba(124, 32, 25, 0.98);
    --viewer-toolbar-button-color: #fff4b8;
    --viewer-toolbar-value-text: #2e2000;
    /* The left navigation matches the transport controls: red fittings on the
       yellow hull. Active is a deeper red with a pale hull-yellow edge, since a
       sea-blue ring would read as a different system on top of the red. */
    --viewer-nav-button-bg: rgba(156, 43, 34, 0.94);
    --viewer-nav-button-hover-bg: rgba(124, 32, 25, 0.98);
    --viewer-nav-button-hover-border: rgba(74, 48, 0, 0.4);
    --viewer-nav-button-border: rgba(74, 48, 0, 0.28);
    --viewer-nav-button-color: #fff4b8;
    --viewer-nav-button-active-bg: rgba(124, 32, 25, 0.98);
    --viewer-nav-button-active-border: #fff4b8;
    --viewer-toolbar-value-bg: transparent;
    --viewer-search-input-bg: rgba(255, 252, 226, 0.94);
    --viewer-search-clear-bg: rgba(168, 35, 43, 0.16);
    --viewer-search-item-bg: rgba(255, 252, 226, 0.78);
    --viewer-search-item-hover-bg: rgba(168, 35, 43, 0.18);
    --viewer-search-focus: var(--viewer-focus-ring);
    /* Flat surfaces. The only gradient Ringo keeps is the stage wash behind the
       image, which OSDViewer builds from --viewer-stage-glow/-stage/-stage-tail. */
    --viewer-control-rail-bg: rgba(255, 225, 92, 0.96);
    --story-shell-bg: #ffe15c;
    --story-line: rgba(74, 48, 0, 0.22);
    --story-text: #2e2000;
    --story-muted: #6d5200;
    --story-accent: #a8232b;
    --story-accent-2: #0072c6;
    --story-accent-text: #8c1f1a;
    --story-accent-text-hover: #701712;
    --story-control-bg: rgba(255, 249, 214, 0.9);
    --story-control-border: rgba(74, 48, 0, 0.28);
    --story-control-hover-bg: rgba(168, 35, 43, 0.14);
    --story-track-bg: rgba(74, 48, 0, 0.18);
    --story-track-border: rgba(74, 48, 0, 0.14);
    --story-active-ring: rgba(0, 114, 198, 0.8);
    --story-active-halo: rgba(74, 48, 0, 0.26);
    --story-error: #a3123c;
    --story-note-bg: rgba(255, 250, 219, 0.95);
    --story-note-text: #2e2000;
    --story-label-bg: rgba(46, 32, 0, 0.86);
    --story-label-text: #fff4b8;
    --viewer-danger: #a3123c;
    --viewer-success: #00694a;
    --viewer-warning: #7a4b00;
    --story-builder-accent: #9c2b22;
    --story-builder-accent-hover: #8c1f1a;
    --viewer-well-bg: rgba(74, 48, 0, 0.1);
    --viewer-focus-ring: #0056a3;
    border-color: #e0a800;
    box-shadow: var(--viewer-frame-shadow, none);
    background: var(--viewer-bg);
  }

  .viewer__grid {
    position: relative;
    display: grid;
    /*
     * `minmax(0, 1fr)`, never a bare `1fr`. A bare `1fr` is `minmax(auto, 1fr)`,
     * so the track floors at the content's min-content width — and OSD's <canvas>
     * carries an intrinsic width. On iOS that let the canvas pin the column at
     * its own size: a 343px-wide element ended up with a 541px stage, so the
     * image was laid out in a box wider than the viewer and appeared shoved right
     * and cropped. Zero-floored tracks let the stage shrink to the element.
     */
    grid-template-columns: minmax(0, 1fr);
    row-gap: 18px;
    column-gap: 18px;
    align-items: stretch;
    height: 100%;
    max-height: 100%;
    min-height: 0;
    transition:
      grid-template-columns 240ms cubic-bezier(0.2, 0.8, 0.2, 1),
      column-gap 240ms ease;
  }

  .viewer__manifest-overlay {
    position: absolute;
    z-index: 20;
    inset: 0;
    min-width: 0;
    min-height: 0;
    /*
     * The manifest manager is taller than a short embed. Without a scroller of
     * its own everything below the fold — the manifest library, the rest of the
     * form — was simply unreachable. `contain` keeps that scrolling inside the
     * element instead of chaining to the host page.
     */
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .viewer__manifest-overlay--right {
    inset: 0;
  }

  .viewer__grid--left {
    grid-template-columns: minmax(240px, 300px) 1fr;
  }

  .viewer__grid--controls {
    grid-template-columns: 220px 1fr;
    column-gap: 0;
  }

  .viewer__grid--right {
    grid-template-columns: 1fr minmax(220px, 280px);
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left {
    grid-template-columns: 220px minmax(320px, 410px) 1fr;
    column-gap: 0;
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--nav-compact {
    grid-template-columns: 72px minmax(320px, 410px) 1fr;
  }

  .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls {
    grid-template-columns: 1fr 220px;
  }

  .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls.viewer__grid--left {
    grid-template-columns: 1fr minmax(320px, 410px) 220px;
    column-gap: 0;
  }

  .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls.viewer__grid--left.viewer__grid--nav-compact {
    grid-template-columns: 1fr minmax(320px, 410px) 72px;
  }

  .viewer__grid--sidebar-right > .stage {
    order: 1;
    margin-right: 18px;
    margin-left: 0 !important;
  }

  .viewer__grid--sidebar-right.viewer__grid--controls:not(.viewer__grid--left) > .stage {
    margin-right: 0;
  }

  .viewer__grid--sidebar-right :global(.panel-stack--left) {
    order: 2;
    border-right: none;
    border-left: 1px solid var(--viewer-panel-border) !important;
    border-radius: 18px 0 0 18px !important;
  }

  .viewer__grid--sidebar-right > .viewer__control-rail {
    order: 3;
    border-right: 1px solid var(--viewer-panel-border);
    border-left: none;
    border-radius: 0 18px 18px 0;
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--right {
    grid-template-columns: 220px 1fr minmax(220px, 280px);
  }

  .viewer__grid.viewer__grid--left.viewer__grid--right {
    grid-template-columns: minmax(240px, 300px) 1fr minmax(220px, 280px);
  }

  .viewer--story-builder .viewer__grid.viewer__grid--left.viewer__grid--right {
    grid-template-columns: minmax(250px, 310px) minmax(430px, 1fr) minmax(330px, 370px);
    column-gap: 14px;
  }

  .viewer--story-builder .viewer__grid {
    row-gap: 14px;
  }

  .viewer--story-builder .panel-stack--right {
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--viewer-panel-border);
    border-radius: 18px;
    background: var(--viewer-panel);
  }

  .viewer--story-builder .panel-stack--right :global(.plugin-slot),
  .viewer--story-builder .panel-stack--right :global(.plugin-panel),
  .viewer--story-builder .panel-stack--right :global(.plugin-panel__panel),
  .viewer--story-builder .panel-stack--right :global(.plugin-panel__body) {
    height: 100%;
    min-height: 0;
  }

  .viewer--story-builder .panel-stack--right :global(.plugin-panel__panel) {
    padding: 0;
    border: 0;
    background: transparent;
  }

  .viewer--story-builder .panel-stack--right :global(.plugin-panel__title) {
    display: none;
  }

  :global(.viewer--story-preview) .viewer__grid {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  :global(.viewer--story-preview) .viewer__grid :global(.panel-stack--left),
  :global(.viewer--story-preview) .panel-stack--right {
    display: none !important;
  }

  :global(.viewer--story-preview) .viewer__grid > .stage {
    grid-column: 1 !important;
    grid-row: 1 / -1 !important;
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--right {
    grid-template-columns: 220px minmax(320px, 410px) 1fr minmax(220px, 280px);
    column-gap: 0;
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--right.viewer__grid--nav-compact {
    grid-template-columns: 72px minmax(320px, 410px) 1fr minmax(220px, 280px);
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left > .stage {
    margin-left: 18px;
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--right > .stage {
    margin-right: 18px;
  }

  .viewer__control-rail {
    position: relative;
    z-index: 4;
    display: grid;
    align-content: start;
    justify-items: stretch;
    box-sizing: border-box;
    padding: 24px 14px 18px;
    border: 1px solid var(--viewer-panel-border);
    border-right: none;
    border-radius: 18px 0 0 18px;
    background: var(--viewer-control-rail-bg);
    width: 100%;
    min-height: 0;
    overflow: hidden;
    transition:
      width 240ms cubic-bezier(0.2, 0.8, 0.2, 1),
      padding 220ms ease;
  }

  .viewer__control-rail :global(.viewer__dock) {
    position: static;
    right: auto;
    top: auto;
    transform: none;
  }

  .viewer__grid--nav-compact > .viewer__control-rail {
    width: 72px;
    padding-inline: 10px;
  }

  .viewer__grid--sidebar-right.viewer__grid--nav-compact > .viewer__control-rail {
    justify-self: end;
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left :global(.panel-stack--left),
  .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--right
    :global(.panel-stack--left) {
    border-left: none;
    border-radius: 0 18px 18px 0;
  }

  .panel-stack {
    display: grid;
    gap: 16px;
    align-content: start;
    min-height: 0;
  }

  .stage {
    display: grid;
    gap: 12px;
    height: 100%;
    min-height: 0;
    /* Same reason as the grid tracks above: the canvas inside must never be able
       to push this column wider than the element that contains it. */
    min-width: 0;
    overflow-x: hidden;
    overflow-y: auto;
    align-content: start;
  }

  /*
   * Vertical priority ladder for the plain viewer.
   *
   * The image is the product, so it owns the flexible row and keeps a floor it
   * can never be squeezed below. Everything else is `auto` and sheds in a fixed
   * order as the element gets shorter (see the max-height container queries):
   * the thumbnail strip goes first (the dock's Gallery button still reaches it),
   * then the toolbar compacts. Without the floor the gallery's intrinsic
   * min-content height wins and the image collapses to 0px.
   */
  .stage--viewer {
    gap: 12px;
    grid-template-rows: minmax(min(160px, 100%), 1fr) auto;
  }

  .stage__primary {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: 0;
    min-width: 0;
  }

  .stage__viewer-frame {
    position: relative;
    grid-template-rows: minmax(0, 1fr);
    gap: 0;
    box-sizing: border-box;
    padding: 0;
    border: 0;
    border-radius: 16px;
    background: transparent;
    overflow: hidden;
  }

  .stage__viewer-frame :global(.stage__media) {
    border: 0;
    border-radius: 16px;
  }

  .stage__viewer-frame :global(.stage__toolbar--below) {
    position: absolute;
    z-index: 12;
    left: 50%;
    bottom: 14px;
    width: min(calc(100% - 24px), 560px);
    margin: 0;
    padding: 6px;
    /*
     * This is the floating placement: the bar is absolutely positioned over the
     * image, so it keeps its panel. Controls sitting on top of artwork need
     * something behind them to stay legible, whatever the image happens to be.
     * The static placements below the image drop the panel instead — see the
     * two `position: static` overrides further down.
     */
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    /*
     * Themed, not a fixed dark slab. The panel still does its job over artwork —
     * it is largely opaque and blurred — but its *contents* follow the theme,
     * and the readout text (`--viewer-toolbar-value-text`) goes dark on the
     * light themes. Against a hardcoded dark panel that left "1 / 36" and the
     * zoom percentage as dark-on-dark, i.e. invisible.
     */
    background: var(--viewer-stage-bottom-bg, rgba(9, 14, 21, 0.78));
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.34);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 8px);
    transition:
      opacity 220ms ease,
      transform 220ms ease;
  }

  .stage__viewer-frame--controls-visible :global(.stage__toolbar--below),
  .stage__viewer-frame :global(.stage__toolbar--below:focus-within) {
    opacity: 1;
    pointer-events: auto;
    transform: translate(-50%, 0);
  }

  @media (prefers-reduced-motion: reduce) {
    .stage__viewer-frame :global(.stage__toolbar--below) {
      transition: none;
    }
  }

  .stage--joined-sidebar-left .stage__viewer-frame :global(.stage__media) {
    border-radius: 0 16px 16px 0;
  }

  .stage--joined-sidebar-right .stage__viewer-frame :global(.stage__media) {
    border-radius: 16px 0 0 16px;
  }

  .stage--joined-sidebar-left {
    --mango-viewer-media-radius: 0 16px 16px 0;
  }

  .stage--joined-sidebar-right {
    --mango-viewer-media-radius: 16px 0 0 16px;
  }

  /*
   * `:global` because the gallery is its own component now. Its root carries
   * that component's scoping hash, not this one's, so an unqualified
   * descendant selector compiles to something that can never match. The
   * squared-off inner corner belongs to the stage rather than to the gallery,
   * though — it exists because a sidebar is joined to that edge, which the
   * gallery knows nothing about — so it stays here.
   */
  .stage--joined-sidebar-left :global(.stage-gallery-view) {
    border-radius: 0 18px 18px 0;
  }

  .stage--joined-sidebar-right :global(.stage-gallery-view) {
    border-radius: 18px 0 0 18px;
  }

  .stage--story-builder :global(.stage__toolbar--below) {
    /* `margin-top: 0` used to sit here to cancel the bar's old negative tuck.
       That tuck is gone, so zeroing the margin only reintroduced the overlap
       it was written to prevent. */
    padding-top: 8px;
  }

  .stage--story-builder {
    /* Preserve a useful viewer while allowing content-aware authoring panels
       to grow below it. If both no longer fit, this column becomes the scroll
       owner instead of clipping the bottom of the editor. */
    grid-template-rows: minmax(clamp(220px, 42cqh, 420px), 1fr) auto;
    align-content: stretch;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    scrollbar-gutter: stable;
    -webkit-overflow-scrolling: touch;
  }

  /*
   * The story builder opts out: it owns its own rows and scrolling (above), and
   * this rule sits later in the sheet at equal specificity, so without the
   * exclusion it silently reinstated `overflow: hidden` and clipped the bottom
   * of the narration editor.
   */
  .stage--with-bottom-toolbar:not(.stage--story-builder) {
    grid-template-rows: minmax(0, 1fr);
    grid-auto-rows: auto;
    overflow: hidden;
  }

  .stage--story {
    --mango-viewer-av-player-max-width: calc((100cqh - 24px) * 16 / 9);
    overflow: hidden;
    align-content: stretch;
  }

  .stage__story-slot {
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .stage__bottom {
    display: grid;
    gap: 12px;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    padding: 12px;
    border-radius: 16px;
    background: var(--viewer-stage-bottom-bg, rgba(12, 16, 22, 0.72));
    border: 1px solid var(--viewer-panel-border);
  }

  /*
   * The keyboard focus indicator for every control in the viewer. It has to
   * clear 3:1 against the surface behind it (WCAG 2.2 SC 1.4.11), which the
   * dark themes' cyan does not manage on a light panel — it landed near 1.4:1
   * on light, sepia and ringo, i.e. all but invisible. Each light-family theme
   * therefore states its own ring rather than inheriting this one.
   */
  :global(.viewer :is(button, input, select, textarea):focus-visible) {
    outline: 2px solid var(--viewer-focus-ring, rgba(42, 199, 255, 0.7));
    outline-offset: 2px;
  }

  .viewer__backdrop {
    display: none;
  }

  @container mango-viewer (max-width: 1024px) {
    .viewer {
      min-height: 0;
      max-height: 100%;
      height: 100%;
      overflow: hidden;
      padding: 12px;
      border-radius: 16px;
      gap: 10px;
    }

    .viewer.viewer--story-viewer {
      gap: 0;
      padding: 0;
    }

    .viewer.viewer--story-builder {
      height: 100%;
      min-height: 0;
      max-height: 100%;
      overflow: hidden;
    }

    .viewer--story-builder .viewer__top-row {
      flex-wrap: wrap;
    }

    .viewer--story-builder .viewer__top-actions {
      width: 100%;
    }

    .viewer__grid {
      /* minmax(0, …): a bare 1fr floors the track at the content min-content
         width, and the mobile dock rail is `max-content` (~541px), which dragged
         the stage wider than the element on iOS. */
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto;
      row-gap: 8px;
      height: 100%;
      max-height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .viewer--story-builder .viewer__grid {
      grid-template-columns: minmax(220px, 36%) minmax(0, 1fr) !important;
      grid-template-rows: minmax(320px, 1fr) minmax(260px, 42%);
      gap: 8px;
      height: 100%;
      max-height: 100%;
      overflow: hidden;
    }

    .viewer--story-builder .viewer__grid > .stage {
      grid-row: 1;
      grid-column: 1 / -1;
      height: 100%;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior-y: contain;
      -webkit-overflow-scrolling: touch;
    }

    .viewer--story-builder .viewer__grid :global(.panel-stack--left) {
      position: relative;
      inset: auto;
      grid-row: 2;
      grid-column: 1;
      width: 100%;
      max-width: none;
      height: 100%;
      transform: none;
      animation: none;
      box-shadow: none;
    }

    .viewer--story-builder .panel-stack--right {
      grid-row: 2;
      grid-column: 2;
      height: 100%;
    }

    .viewer__grid.viewer__grid--left.viewer__grid--right,
    .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--right,
    .viewer__grid.viewer__grid--left,
    .viewer__grid.viewer__grid--controls.viewer__grid--left,
    .viewer__grid.viewer__grid--right,
    .viewer__grid.viewer__grid--controls.viewer__grid--right,
    .viewer__grid.viewer__grid--controls {
      /* minmax(0, …): a bare 1fr floors the track at the content min-content
         width, and the mobile dock rail is `max-content` (~541px), which dragged
         the stage wider than the element on iOS. */
      grid-template-columns: minmax(0, 1fr);
    }

    .viewer__grid.viewer__grid--controls.viewer__grid--left > .stage,
    .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--right > .stage {
      margin-left: 0;
      margin-right: 0;
    }

    .viewer__grid {
      position: relative;
    }

    .viewer__backdrop {
      position: absolute;
      inset: 0;
      /*
       * Above the stage toolbar (z-index 12), not below it. A drawer in this
       * regime is a modal surface with a dimmed backdrop, so the floating
       * controls belong behind it — at z-index 9 the toolbar punched straight
       * through the dim and sat on top of the panel's own text.
       */
      z-index: 13;
      border: 0;
      margin: 0;
      padding: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s linear;
      display: block;
    }

    .viewer__backdrop--active {
      opacity: 1;
      pointer-events: auto;
    }

    .viewer__grid :global(.panel-stack--left) {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: min(280px, 85%);
      max-width: 85%;
      /* Above the backdrop, which is itself above the floating stage controls. */
      z-index: 14;
      transform: translateX(0);
      animation: viewer-slidein-left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-shadow: 10px 0 30px rgba(0, 0, 0, 0.4);
    }

    .viewer__grid--sidebar-right :global(.panel-stack--left) {
      right: 0;
      left: auto;
      border: 1px solid var(--viewer-panel-border) !important;
      border-radius: 18px !important;
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.4);
      animation-name: viewer-slidein-right;
    }

    .viewer__grid--sidebar-right > .stage {
      order: initial;
      margin-right: 0;
    }

    .viewer__grid--sidebar-right > .viewer__control-rail {
      order: initial;
    }

    .viewer__control-rail {
      grid-row: 2;
      grid-column: 1;

      width: fit-content;
      max-width: 100%;
      height: auto;
      box-sizing: border-box;
      justify-self: center;
      padding: 0;
      border: 0;
      border-radius: 9px;
      background: var(--viewer-panel);
      display: grid;
      align-items: center;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
      touch-action: pan-x;
      -webkit-overflow-scrolling: touch;
    }

    .viewer__control-rail::-webkit-scrollbar {
      display: none;
    }

    .viewer__grid > .stage {
      grid-row: 1;
      grid-column: 1;
    }

    .viewer__control-rail :global(.viewer__dock) {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(32px, 1fr));
      align-items: center;
      width: 100%;
      max-width: none;
      padding: 0;
      gap: 3px;
    }

    .viewer__control-rail :global(.viewer__dock-button) {
      width: 100%;
      max-width: 44px;
      height: 44px;
      border-radius: 9px;
      justify-self: center;
    }

    .viewer__control-rail :global(.viewer__dock-icon),
    .viewer__control-rail :global(.viewer__dock-icon svg) {
      width: 18px;
      height: 18px;
    }

    .viewer__control-rail :global(.viewer__dock-icon--info) {
      width: 19px;
      height: 19px;
    }

    .viewer__control-rail :global(.viewer__dock-info-chip) {
      width: 18px;
      height: 18px;
      font-size: 13px;
    }

    .stage {
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .stage--story {
      height: 100%;
      overflow: hidden;
    }

    .stage__viewer-frame {
      grid-template-rows: minmax(0, 1fr) auto;
      border-radius: 14px;
      overflow: hidden;
    }

    .stage__viewer-frame :global(.stage__media) {
      border-radius: 14px 14px 0 0;
    }

    .stage__viewer-frame :global(.stage__toolbar--below) {
      position: static;
      width: 100%;
      margin: 0;
      padding: 6px;
      border: 0;
      border-radius: 0 0 14px 14px;
      /* Unfilled at this size too — see the desktop rule above. */
      background: transparent;
      box-shadow: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      opacity: 1;
      pointer-events: auto;
      transform: none;
      transition: none;
    }

    /*
     * The reveal animation belongs to the floating desktop toolbar, where
     * `translate(-50%, …)` is what centres an absolutely positioned bar. Here the
     * row is a static, full-width bar, so the revealed state must drop the
     * translate as well: without this, any tap that reveals the controls (for
     * example pressing Home) slid the whole bar left by half its width.
     */
    .stage__viewer-frame--controls-visible :global(.stage__toolbar--below),
    .stage__viewer-frame :global(.stage__toolbar--below:focus-within) {
      transform: none;
    }

    .stage--viewer {
      --mango-viewer-av-player-aspect-ratio: 16 / 9;
      --mango-viewer-audio-art-aspect-ratio: 16 / 7;
      --mango-viewer-audio-art-min-height: 0;
    }
  }

  @container mango-viewer (max-width: 700px) {
    /*
     * The annotation editor carries a wide "Export Annotations" action. The top
     * row is nowrap with non-shrinking actions, so on a phone the title collapsed
     * to nothing, the Mango brand overflowed it, and the orange button — painted
     * later — sat on top of the brand. Give the actions their own line instead.
     */
    .viewer--annotation-editor .viewer__top-row {
      flex-wrap: wrap;
      row-gap: 8px;
    }

    .viewer--annotation-editor .viewer__top-actions {
      flex: 1 0 100%;
      justify-content: flex-start;
    }

    .viewer.viewer--story-builder {
      height: 100%;
      min-height: 0;
      max-height: 100%;
      overflow: hidden;
    }

    .viewer--story-builder .viewer__top-actions {
      min-width: 0;
      justify-content: flex-start;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }

    .viewer--story-builder .viewer__top-actions::-webkit-scrollbar {
      display: none;
    }

    .viewer--story-builder .viewer__fullscreen-btn {
      width: 40px;
      min-width: 40px;
      height: 40px;
      padding: 0;
      flex: 0 0 40px;
    }

    .viewer--story-builder .viewer__fullscreen-btn span {
      display: none;
    }

    .viewer--story-builder .viewer__grid {
      grid-template-columns: 1fr !important;
      /* Follow the phone authoring flow: choose a chapter, work on the canvas,
         then refine the selected item in the inspector. Keeping the stage
         first meant that selecting a chapter scrolled the chapter rail into
         view and stranded the drawing canvas above the scroll port. */
      grid-template-rows: 280px 600px 440px;
      height: 100%;
      max-height: 100%;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior-y: contain;
      -webkit-overflow-scrolling: touch;
    }

    .viewer--story-builder .viewer__grid > .stage {
      grid-row: 2;
      grid-column: 1;
    }

    .viewer--story-builder .viewer__grid :global(.panel-stack--left) {
      grid-row: 1;
      grid-column: 1;
    }

    .viewer--story-builder .panel-stack--right {
      grid-row: 3;
      grid-column: 1;
    }
  }

  /*
   * Rung 1 of the vertical ladder (see `.stage--viewer`). Below this height the
   * element cannot give the thumbnail strip a row of its own without squeezing
   * the image to nothing. The strip therefore stops being a row and becomes an
   * overlay: the reader opens it with the Gallery button and dismisses it with
   * the same button. Keyed on the element's own height, so a short embed on a
   * tall page compacts the same way a landscape phone does.
   *
   * This is deliberately a presentation change and nothing else. The button
   * still only ever toggles `showThumbnails`, at every height, so it has one
   * meaning everywhere and no size-dependent branch to race against — see
   * TICKET-viewer-issues.md for the two attempts that changed its behaviour
   * instead and stranded the viewer in the gallery layout.
   *
   * The media keeps its box while the overlay is open: the overlay is taken out
   * of flow rather than replacing the stage, so anything measuring `.stage__media`
   * still finds it.
   */
  @container mango-viewer (max-height: 560px) {
    .stage--viewer {
      position: relative;
      grid-template-rows: minmax(min(120px, 100%), 1fr);
    }

    .stage--viewer > :global(.gallery) {
      position: absolute;
      inset: 0;
      z-index: 15;
      margin-top: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      align-content: start;
      background: var(--viewer-gallery-bg, rgba(10, 14, 19, 0.96));
    }

    /*
     * As a row this list scrolls sideways; with the whole stage to fill it wraps
     * instead, so every page is reachable by scrolling the overlay vertically.
     */
    .stage--viewer > :global(.gallery) :global(.gallery__list) {
      grid-auto-flow: row;
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
      grid-auto-columns: auto;
      overflow-x: visible;
      overflow-y: visible;
      touch-action: auto;
    }
  }

  @container mango-viewer (max-height: 500px) {
    .viewer:not(.viewer--story-viewer):not(.viewer--story-builder):not(
        .viewer--annotation-editor
      )
      .viewer__grid {
      position: relative;
      grid-template-columns: minmax(0, 1fr) !important;
      grid-template-rows: minmax(0, 1fr) auto;
      row-gap: 6px;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .viewer:not(.viewer--story-viewer):not(.viewer--story-builder):not(
        .viewer--annotation-editor
      )
      .viewer__grid
      > .stage {
      grid-column: 1;
      grid-row: 1;
      height: 100%;
      min-height: 0;
      margin: 0;
      overflow: hidden;
    }

    .viewer:not(.viewer--story-viewer):not(.viewer--story-builder):not(
        .viewer--annotation-editor
      )
      .viewer__control-rail {
      grid-column: 1;
      grid-row: 2;
      width: fit-content;
      max-width: 100%;
      height: 44px;
      justify-self: center;
      padding: 0;
      border: 0;
      border-radius: 9px;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
      touch-action: pan-x;
      -webkit-overflow-scrolling: touch;
    }

    .stage--viewer .stage__viewer-frame {
      /*
       * Rung 2: media keeps a smaller floor and the toolbar stays put. The
       * floor is capped at a share of the element (`26cqh`) so that on a box
       * too small for both, the image yields rather than pushing the toolbar
       * out of the frame's hidden overflow.
       */
      grid-template-rows: minmax(min(96px, 26cqh), 1fr) auto;
      overflow: hidden;
    }

    .stage--viewer .stage__viewer-frame :global(.stage__media) {
      min-height: 0;
      border-radius: 12px 12px 0 0;
    }

    .stage--viewer .stage__viewer-frame :global(.stage__toolbar--below) {
      position: static;
      width: 100%;
      margin: 0;
      padding: 4px;
      border: 0;
      border-radius: 0 0 12px 12px;
      /* Unfilled at this size too — see the desktop rule above. */
      background: transparent;
      box-shadow: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      opacity: 1;
      pointer-events: auto;
      transform: none;
      transition: none;
    }

    /* As above: a static bar must not inherit the floating bar's centring
       translate when the controls are revealed. */
    .stage--viewer
      .stage__viewer-frame--controls-visible
      :global(.stage__toolbar--below),
    .stage--viewer
      .stage__viewer-frame
      :global(.stage__toolbar--below:focus-within) {
      transform: none;
    }
  }

  /*
   * Short but wide: stand the icon rail up beside the image instead of stacking
   * it underneath. On a landscape phone that hands ~50px of scarce height back
   * to the image and spends width that was empty anyway. ViewerDock owns the
   * dock's own column flow under the same query.
   */
  @container mango-viewer (max-height: 500px) and (min-width: 560px) {
    .viewer:not(.viewer--story-viewer):not(.viewer--story-builder):not(
        .viewer--annotation-editor
      )
      .viewer__grid {
      grid-template-columns: minmax(0, 1fr) max-content !important;
      grid-template-rows: minmax(0, 1fr);
      column-gap: 8px;
      row-gap: 0;
    }

    .viewer:not(.viewer--story-viewer):not(.viewer--story-builder):not(
        .viewer--annotation-editor
      )
      .viewer__grid
      > .stage {
      grid-column: 1;
      grid-row: 1;
    }

    .viewer:not(.viewer--story-viewer):not(.viewer--story-builder):not(
        .viewer--annotation-editor
      )
      .viewer__control-rail {
      grid-column: 2;
      grid-row: 1;
      width: max-content;
      /* Floor matches the dock's fixed 44px icon button, so the column can
         never collapse even if the intrinsic width resolves small. */
      min-width: 44px;
      max-width: 40%;
      height: 100%;
      justify-self: end;
      align-self: stretch;
      overflow-x: clip;
      overflow-y: auto;
      overscroll-behavior-y: contain;
      touch-action: pan-y;
    }
  }

  /*
   * Element-relative, not viewport-relative: these two rules used to be
   * `@media (max-width: 1024px)`, which is wrong for an embedded element whose
   * width is decided by the host page rather than the window.
   */
  @container mango-viewer (max-width: 1024px) {
    .viewer.viewer--story-builder {
      height: 100%;
      min-height: 0;
      max-height: 100%;
      overflow: hidden;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .viewer__grid,
    .viewer__control-rail,
    .viewer__expand-sidebar {
      transition: none;
    }
  }

  @keyframes viewer-slidein-left {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }

  @keyframes viewer-slidein-right {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
</style>
