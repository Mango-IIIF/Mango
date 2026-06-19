<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, setContext } from 'svelte';
  import { get, writable } from 'svelte/store';
  import { t } from '../../i18n';
  import { normaliseViewerConfig } from '../../config/normalise';
  import type { ViewerEventMap } from '../../core/types/events';
  import type { ViewerConfig } from '../../core/types/config';
  import type { ViewBox } from '../../core/types/viewer';
  import type { ViewerPlugin } from '../../core/types/plugin';
  import type { ModelPose, ModelPoseOptions } from '../../core/types/model';
  import type { ViewerApi } from '../../core/types/viewer-api';
  import PluginSlot from '../../plugins/PluginSlot.svelte';
  import { createAnnotationFocusPlugin } from '../../plugins/annotationFocus';
  import ViewerHeader from '../../viewer/ui/ViewerHeader.svelte';
  import LeftPanelStack from '../../viewer/ui/LeftPanelStack.svelte';
  import ViewerDock from '../../viewer/ui/ViewerDock.svelte';
  import Stage from '../../viewer/ui/Stage.svelte';
  import StageToolbar from '../../viewer/ui/StageToolbar.svelte';
  import Gallery from '../../viewer/ui/Gallery.svelte';
  import type { LayerItem } from '../annotations/workspace/LeftSidebar.svelte';
  import { w3cToResolved } from '../annotations/W3CParser';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import { createViewerState } from '../../viewer/state/viewerState';
  import { createViewerDerived } from '../../viewer/state/viewerDerived';
  import { createViewerController } from '../../viewer/state/viewerController';
  import { manifestsStore, fetchManifest } from '../../state/manifests';
  import { resolveCanvasThumbnail } from '../../viewer/iiif/thumbnails';
  import type { RendererEventHandlers } from '../../viewer/types/rendererEvents';
  import {
    normaliseStoryInput,
    validateStoryViewer,
    type StoryWithDefaults,
  } from '../../story/viewer/storyLoader';
  import { createStoryViewerRuntime } from '../../story/viewer/storyViewerController';
  import {
    ViewportState,
    VIEWPORT_STATE_CONTEXT_KEY,
  } from '../../core/state/viewportState.svelte';
  import { setLocale } from '../../i18n';
  import GridContainer from '../workspace/GridContainer.svelte';
  import { WorkspaceStore } from '../workspace/workspaceStore.svelte';

  interface Props {
    manifestId?: string;
    config?: ViewerConfig | undefined;
    plugins?: ViewerPlugin[];
    mode?: string | undefined;
    story?: string | Record<string, unknown> | undefined;
    storyUrl?: string | undefined;
  }

  const DEFAULT_LAYER_COLOR = '#a78bfa';
  const LAYER_FILL_OPACITY = 0.18;
  const NEW_LAYER_COLORS = [
    '#fb7185',
    '#f59e0b',
    '#22c55e',
    '#06b6d4',
    '#818cf8',
    '#ec4899',
  ];
  const DEFAULT_ANNOTATION_LAYERS: LayerItem[] = [
    { id: 'research', name: 'Research Notes', color: '#facc15', visible: true },
    { id: 'transcription', name: 'Transcription', color: '#60a5fa', visible: true },
    { id: 'highlights', name: 'Highlights', color: '#34d399', visible: true },
    { id: 'mine', name: 'My Annotations', color: '#a78bfa', visible: true },
  ];
  const MOBILE_LAYOUT_WIDTH = 768;

  const matchesInitialMobileLayout = (): boolean =>
    typeof window !== 'undefined' &&
    window.matchMedia(`(max-width: ${MOBILE_LAYOUT_WIDTH}px)`).matches;

  const styleForLayerColor = (color: string): string => {
    const r = parseInt(color.slice(1, 3), 16) || 0;
    const g = parseInt(color.slice(3, 5), 16) || 0;
    const b = parseInt(color.slice(5, 7), 16) || 0;
    return `stroke: ${color}; fill: rgba(${r}, ${g}, ${b}, ${LAYER_FILL_OPACITY});`;
  };

  const parseLayerColorFromStyle = (style?: string): string | null => {
    if (!style) return null;
    const match = style.match(/stroke:\s*([^;]+)/i);
    if (!match) return null;
    const value = match[1]?.trim();
    if (!value) return null;
    const hexMatch = value.match(/^#([0-9a-f]{6})$/i);
    return hexMatch ? `#${hexMatch[1].toLowerCase()}` : null;
  };

  const labelForLayerId = (layerId: string): string =>
    layerId
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Layer';

  let {
    manifestId = $bindable(''),
    config = undefined,
    plugins = [],
    mode = undefined,
    story = undefined,
    storyUrl = undefined,
  }: Props = $props();
  const initialMobileLayout = matchesInitialMobileLayout();

  const corePlugins = [createAnnotationFocusPlugin()];

  const dispatch = createEventDispatcher<ViewerEventMap>();
  const initialViewerConfig = () => normaliseViewerConfig(config);
  let normalisedConfig: ViewerConfig = $state(initialViewerConfig());
  let StoryControlsStageComponent: any = $state(null);
  let StoryAnnotationOverlayComponent: any = $state(null);
  let AnnotationWorkspaceComponent: any = $state(null);
  let storyComponentsLoading = false;
  let annotationWorkspaceLoading = false;
  const createInitialViewerState = () =>
    createViewerState({
      manifestId,
      config: normalisedConfig,
      plugins: [...corePlugins],
    });
  const viewerState = createInitialViewerState();
  const viewerDerived = createViewerDerived(viewerState);
  const controller = createViewerController({
    state: viewerState,
    derived: viewerDerived,
    dispatch,
  });

  const {
    manifestEntry,
    canvases,
    canvasThumbnails,
    mediaSource,
    mediaType,
    accompanyingSource,
    captionTracks,
    startTime,
    rendererComponent,
    overlayAnnotations,
    searchHits,
    highlightIds,
    pluginSlots,
    leftVisible,
    rightVisible,
    manifestTitle,
    manifestDescription,
    manifestAttribution,
    manifestLicence,
    manifestMetadata,
    allowThumbnails,
    allowMetadata,
    allowSearch,
    allowAnnotations,
    allowTools,
    allowLayers,
    mediaSources,
    tocEntries,
    transcriptEntries,
    activeTranscriptId,
    contentsAvailable,
    activeLayoutImages,
  } = viewerDerived;

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

  const enableRightPanel = false;

  const {
    selectedCanvasIndex,
    zoom,
    showThumbnails,
    showMetadata,
    showSearch,
    showAnnotations,
    showTools,
    showSettings,
    showContents,
    showLayers,
    layerOpacities,
    layoutMode,
    annotationMode,
    searchQuery,
    selectedSearchResultId,
    activeAnnotationId,
    hoverAnnotationId,
    imageFilters,
    userAnnotations,
  } = viewerState;
  const viewportState = new ViewportState();
  setContext(VIEWPORT_STATE_CONTEXT_KEY, viewportState);
  let isMobileLayout = $state(initialMobileLayout);

  let stageRef: ReturnType<typeof Stage> | null = $state(null);
  let canZoom = $state(false);
  let hasSource = $derived(Boolean($mediaSource));
  let pendingSeek: { canvasId?: string | null; time: number } | null = $state(null);
  let showThumbnailsEffective = $derived($showThumbnails && $allowThumbnails);
  let showSearchEffective = $derived($showSearch && $allowSearch);
  let showAnnotationsEffective = $derived($showAnnotations && $allowAnnotations);
  let showToolsEffective = $derived($showTools && $allowTools);
  const toolbarAboveMedia = false;
  let isStoryViewer = $derived(mode === 'story-viewer');
  let isStoryBuilder = $derived(mode === 'story-builder');
  let isAnnotationEditor = $derived(mode === 'annotation-editor');
  let isPlainViewerMode = $derived(!mode || mode === 'viewer');
  $effect(() => {
    if (isStoryViewer) {
      void loadStoryViewerComponents();
    }
    if (isAnnotationEditor) {
      void loadAnnotationWorkspaceComponent();
    }
  });
  let canDrawAnnotations = $derived(
    isStoryBuilder || isAnnotationEditor || normalisedConfig.allowCreateMode === true,
  );
  let annotationEditorTool = $state<
    'select' | 'rectangle' | 'point' | 'polygon' | 'freehand' | 'line'
  >('rectangle');
  let effectiveAnnotationMode = $derived(canDrawAnnotations ? $annotationMode : 'edit');
  let isMainViewerMode = $derived(!isStoryViewer && !isStoryBuilder);
  let viewerSettingsLayout = $state<'1x1' | '1x2' | '2x1' | '2x2'>('1x1');
  let workspace = $state<WorkspaceStore | null>(null);
  const closeLeftPanelStores = () => {
    viewerState.showContents.set(false);
    viewerState.showAnnotations.set(false);
    viewerState.showTools.set(false);
    viewerState.showSettings.set(false);
    viewerState.showSearch.set(false);
    viewerState.showMetadata.set(false);
    viewerState.showLayers.set(false);
  };

  if (initialMobileLayout) {
    closeLeftPanelStores();
  }

  let viewerSettingsTheme = $state<'dark' | 'light'>('dark');
  let viewerSettingsLocale = $state('en');
  let showControlRail = $derived(isPlainViewerMode);
  let stageDockVisible = $derived(!isStoryViewer && !showControlRail);
  let zoomBaseline = $state(0);
  let zoomBaselineCanvasIndex = $state(-1);
  let zoomPercent = $derived(
    $zoom > 0 && zoomBaseline > 0
      ? Math.max(10, Math.round(($zoom / zoomBaseline) * 100))
      : 100,
  );
  let pendingZoomDirection: 'in' | 'out' | null = $state(null);
  let storyData: StoryWithDefaults | null = $state(null);
  let storyError: string | null = $state(null);
  let storyLoading = $state(false);
  let storyChapters = $state(0);
  let storyControlsDisabled = $state(true);
  let storyLoadToken = 0;
  let lastStoryInput: string | Record<string, unknown> | undefined = $state(undefined);
  let lastStoryUrl: string | undefined = $state(undefined);
  let storyCurrentChapterIndex = $state(0);
  let storyIsLoading = $state(false);
  let storyPlayState: 'idle' | 'playing' | 'paused' = $state('idle');
  let viewerRoot: HTMLDivElement | null = $state(null);
  let isViewerFullscreen = $state(false);
  let isViewerFullscreenFallback = $state(false);
  let fullscreenFallbackCleanup: (() => void) | null = null;
  let storyChapterThumbnails: Array<string | null> = $state([]);
  const storyThumbnailCache = new Map<string, string>();
  let storyChapterDurationSec = $state(0);
  let storyChapterElapsedSec = $state(0);
  let chapterTitle = $derived.by(() => {
    const activeChapter = storyData?.chapters?.[storyCurrentChapterIndex];
    const resolvedTitle = resolveLanguageValue(activeChapter?.title, storyLanguage);
    return (
      resolvedTitle ||
      (storyChapters > 0 ? `Chapter ${storyCurrentChapterIndex + 1}` : '')
    );
  });
  let chapterDescription = $derived(
    resolveLanguageValue(
      storyData?.chapters?.[storyCurrentChapterIndex]?.description,
      storyLanguage,
    ),
  );
  const storyViewBoxStore = writable<ViewBox | null>(null);
  const EMPTY_STORY: StoryWithDefaults = Object.freeze({
    version: '1.0',
    type: 'story',
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
    viewerSettingsTheme = configuredTheme === 'light' ? 'light' : 'dark';
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

  function callViewerMethod<T extends (...args: any[]) => any>(name: string, fallback: T, ...args: Parameters<T>): ReturnType<T> {
    const host = getShadowHost();
    if (host && Object.prototype.hasOwnProperty.call(host, name)) {
      return (host as any)[name](...args);
    }
    return fallback(...args);
  }

  const storyRuntime = createStoryViewerRuntime(
    {
      getViewBox: () => callViewerMethod('getViewBox', getViewBox),
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
      setModelOrientation: (orientation) => callViewerMethod('setModelOrientation', setModelOrientation, orientation),
      setModelPose: (pose, options) => callViewerMethod('setModelPose', setModelPose, pose, options),
      getModelOrbit: () => callViewerMethod('getModelOrbit', getModelOrbit),
      getModelTarget: () => callViewerMethod('getModelTarget', getModelTarget),
      getModelOrientation: () => callViewerMethod('getModelOrientation', getModelOrientation),
      getModelPose: () => callViewerMethod('getModelPose', getModelPose),
      addAnnotation: (annotation) => callViewerMethod('addAnnotation', addAnnotation, annotation),
      removeAnnotation: (id) => callViewerMethod('removeAnnotation', removeAnnotation, id),
      on: (event, handler) => callViewerMethod('on', on, event, handler),
      off: (event, handler) => callViewerMethod('off', off, event, handler),
      updateLayerOpacity: (id, opacity) => callViewerMethod('updateLayerOpacity', (id, opacity) => controller.updateLayerOpacity(id, opacity), id, opacity),
      getLayerOpacities: () => callViewerMethod('getLayerOpacities', () => get(layerOpacities)),
      getMediaSources: () => callViewerMethod('getMediaSources', () => get(mediaSources)),
    },
    {
      language: resolvePreferredStoryLanguage(),
    },
  );
  const unsubscribeStoryIndex = storyRuntime.currentChapterIndex.subscribe((value) => {
    storyCurrentChapterIndex = value ?? 0;
  });
  const unsubscribeStoryLoading = storyRuntime.isLoading.subscribe((value) => {
    storyIsLoading = value;
  });
  const unsubscribeStoryPlayState = storyRuntime.playState.subscribe((value) => {
    storyPlayState = value;
  });
  const unsubscribeStoryPlaybackState = storyRuntime.playbackState.subscribe((value) => {
    storyChapterDurationSec = value?.duration ?? 0;
    storyChapterElapsedSec = value?.currentTime ?? 0;
  });
  const handleStoryPlay = () => {
    if (storyControlsDisabled) return;
    storyRuntime.play();
  };
  const handleStoryPause = () => {
    if (storyControlsDisabled) return;
    storyRuntime.pause();
  };
  const handleStoryStop = () => {
    if (storyControlsDisabled) return;
    storyRuntime.stop();
  };
  const handleStorySelectChapter = (index: number, autoPlay = true) => {
    if (storyControlsDisabled || storyLoading) return;
    const chapterTotal = storyChapters;
    if (!chapterTotal) return;
    const target = Math.max(0, Math.min(index, chapterTotal - 1));
    storyCurrentChapterIndex = target;
    void storyRuntime.loadChapter(target, { autoPlay });
  };
  const handleStoryPreviousChapter = () => {
    handleStorySelectChapter(storyCurrentChapterIndex - 1, true);
  };
  const handleStoryNextChapter = () => {
    handleStorySelectChapter(storyCurrentChapterIndex + 1, true);
  };
  const handleStoryRefresh = () => {
    if (storyControlsDisabled || storyLoading) return;
    void storyRuntime.loadChapter(storyCurrentChapterIndex, { autoPlay: false });
  };
  const handleStoryFullscreen = async () => {
    if (typeof document === 'undefined') return;
    if (isViewerFullscreenFallback) {
      setViewerFullscreenFallback(false);
      return;
    }
    if (isNativeViewerFullscreenActive()) {
      await document.exitFullscreen?.();
      syncFullscreenState();
      return;
    }
    if (!viewerRoot) return;

    if (canUseNativeFullscreen()) {
      try {
        await viewerRoot.requestFullscreen({ navigationUI: 'hide' });
        syncFullscreenState();
        if (!isNativeViewerFullscreenActive()) {
          setViewerFullscreenFallback(true);
        }
        return;
      } catch {
        setViewerFullscreenFallback(true);
        return;
      }
    }

    setViewerFullscreenFallback(true);
  };

  const closeMobileLeftDrawer = () => {
    controller.setPanelOpen('contents', false);
    controller.setPanelOpen('annotations', false);
    controller.setPanelOpen('tools', false);
    controller.setPanelOpen('settings', false);
    controller.setPanelOpen('search', false);
    controller.setPanelOpen('metadata', false);
    controller.setPanelOpen('layers', false);
  };

  const isNativeViewerFullscreenActive = () => {
    if (!viewerRoot || typeof document === 'undefined') return false;
    const rootNode = viewerRoot.getRootNode();
    const shadowFullscreenElement =
      rootNode instanceof ShadowRoot ? rootNode.fullscreenElement : null;
    const host = getShadowHost();
    return (
      document.fullscreenElement === viewerRoot ||
      document.fullscreenElement === host ||
      shadowFullscreenElement === viewerRoot
    );
  };

  const isViewerFullscreenActive = () =>
    isViewerFullscreenFallback || isNativeViewerFullscreenActive();

  const canUseNativeFullscreen = () =>
    Boolean(viewerRoot?.requestFullscreen) && document.fullscreenEnabled !== false;

  const setViewerFullscreenFallback = (active: boolean) => {
    if (typeof document === 'undefined') return;
    if (isViewerFullscreenFallback === active) {
      syncFullscreenState();
      return;
    }
    fullscreenFallbackCleanup?.();
    fullscreenFallbackCleanup = null;
    isViewerFullscreenFallback = active;
    if (active) {
      const body = document.body;
      const root = document.documentElement;
      const previousBodyOverflow = body.style.overflow;
      const previousRootOverflow = root.style.overflow;
      body.style.overflow = 'hidden';
      root.style.overflow = 'hidden';
      fullscreenFallbackCleanup = () => {
        body.style.overflow = previousBodyOverflow;
        root.style.overflow = previousRootOverflow;
      };
    }
    syncFullscreenState();
  };

  const syncFullscreenState = () => {
    isViewerFullscreen = isViewerFullscreenActive();
  };

  const allowsFullscreenTouchInteraction = (target: EventTarget) =>
    target instanceof Element &&
    (target.classList.contains('gallery__list') ||
      target.classList.contains('panel-stack--left') ||
      target.classList.contains('stage-gallery-view') ||
      target.classList.contains('osd') ||
      target.classList.contains('osd__viewport') ||
      target.classList.contains('openseadragon-canvas'));

  const guardFullscreenDrag = (event: TouchEvent | PointerEvent) => {
    if (!isViewerFullscreenActive()) return;
    if ('pointerType' in event && event.pointerType !== 'touch') return;
    const path = event.composedPath();
    if (path.some(allowsFullscreenTouchInteraction)) {
      return;
    }
    event.preventDefault();
  };

  const handleFullscreenKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !isViewerFullscreenFallback) return;
    event.preventDefault();
    setViewerFullscreenFallback(false);
  };

  let wasMobileLayout = initialMobileLayout;
  const syncMobileLayout = () => {
    if (!viewerRoot) return;
    const nextIsMobileLayout = viewerRoot.clientWidth <= MOBILE_LAYOUT_WIDTH;
    if (nextIsMobileLayout && !wasMobileLayout) {
      closeLeftPanelStores();
    }
    isMobileLayout = nextIsMobileLayout;
    wasMobileLayout = nextIsMobileLayout;
  };

  onMount(() => {
    const root = viewerRoot;
    syncMobileLayout();
    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('keydown', handleFullscreenKeydown, { capture: true });
    root?.addEventListener('touchmove', guardFullscreenDrag, {
      capture: true,
      passive: false,
    });
    root?.addEventListener('pointermove', guardFullscreenDrag, {
      capture: true,
    });
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && root) {
      observer = new ResizeObserver(() => {
        syncMobileLayout();
      });
      observer.observe(root);
    }
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('keydown', handleFullscreenKeydown, {
        capture: true,
      });
      setViewerFullscreenFallback(false);
      root?.removeEventListener('touchmove', guardFullscreenDrag, {
        capture: true,
      });
      root?.removeEventListener('pointermove', guardFullscreenDrag, {
        capture: true,
      });
      observer?.disconnect();
    };
  });

  let draftAnno = $state.raw<ResolvedAnnotation | null>(null);
  let annotationLayers = $state<LayerItem[]>([...DEFAULT_ANNOTATION_LAYERS]);
  let visibleLayerIds = $derived(
    new Set(annotationLayers.filter((layer) => layer.visible).map((layer) => layer.id)),
  );
  const normalizeLayerId = (layerId?: string): string =>
    (layerId?.trim() || 'mine').trim();
  const isAnnotationVisibleByLayer = (annotation: ResolvedAnnotation): boolean => {
    const layerId = normalizeLayerId(annotation.targetStyleClass);
    return visibleLayerIds.has(layerId);
  };
  let filteredOverlayAnnotations = $derived(
    $overlayAnnotations.filter((annotation) => isAnnotationVisibleByLayer(annotation)),
  );
  let visibleDraftAnno = $derived(
    draftAnno && isAnnotationVisibleByLayer(draftAnno) ? draftAnno : null,
  );
  let editorStageAnnotations = $derived(
    visibleDraftAnno
      ? [...filteredOverlayAnnotations, visibleDraftAnno]
      : filteredOverlayAnnotations,
  );
  let editableSavedRectAnnotationId = $derived.by(() => {
    if (!isAnnotationEditor) return null;
    if ($annotationMode !== 'edit') return null;
    const selectedId = $activeAnnotationId;
    if (!selectedId) return null;
    if (draftAnno?.id === selectedId) return null;
    const selected = filteredOverlayAnnotations.find((annotation) => annotation.id === selectedId);
    return selected?.rect ? selectedId : null;
  });

  const findLayerById = (layerId: string): LayerItem | undefined =>
    annotationLayers.find((layer) => layer.id === layerId);

  const handleToggleLayer = (detail: { id: string }) => {
    annotationLayers = annotationLayers.map((layer) =>
      layer.id === detail.id ? { ...layer, visible: !layer.visible } : layer,
    );
  };

  const handleAddLayer = () => {
    let nextIndex = annotationLayers.length + 1;
    let nextId = `layer-${nextIndex}`;
    while (annotationLayers.some((layer) => layer.id === nextId)) {
      nextIndex += 1;
      nextId = `layer-${nextIndex}`;
    }
    const color =
      NEW_LAYER_COLORS[(nextIndex - 1) % NEW_LAYER_COLORS.length] ?? DEFAULT_LAYER_COLOR;
    annotationLayers = [
      ...annotationLayers,
      {
        id: nextId,
        name: `Layer ${nextIndex}`,
        color,
        visible: true,
      },
    ];
  };

  const handleLayerColorChange = (detail: { id: string; color: string }) => {
    annotationLayers = annotationLayers.map((layer) =>
      layer.id === detail.id ? { ...layer, color: detail.color } : layer,
    );

    const patch: Partial<ResolvedAnnotation> = {
      targetStyleClass: detail.id,
      targetStyle: styleForLayerColor(detail.color),
    };
    const affectedAnnotationIds = new Set(
      $overlayAnnotations
        .filter(
          (annotation) => normalizeLayerId(annotation.targetStyleClass) === detail.id,
        )
        .map((annotation) => annotation.id),
    );
    if (draftAnno && normalizeLayerId(draftAnno.targetStyleClass) === detail.id) {
      affectedAnnotationIds.add(draftAnno.id);
    }
    for (const annotationId of affectedAnnotationIds) {
      handleAnnotationUpdate(annotationId, patch);
    }
  };

  $effect(() => {
    const knownLayerIds = new Set(annotationLayers.map((layer) => layer.id));
    const additions: LayerItem[] = [];
    const source = draftAnno ? [...$overlayAnnotations, draftAnno] : $overlayAnnotations;

    for (const annotation of source) {
      const layerId = annotation.targetStyleClass?.trim();
      if (!layerId || knownLayerIds.has(layerId)) continue;
      knownLayerIds.add(layerId);
      additions.push({
        id: layerId,
        name: labelForLayerId(layerId),
        color: parseLayerColorFromStyle(annotation.targetStyle) ?? DEFAULT_LAYER_COLOR,
        visible: true,
      });
    }

    if (additions.length > 0) {
      annotationLayers = [...annotationLayers, ...additions];
    }
  });

  const unsubscribeActiveId = activeAnnotationId.subscribe((activeId) => {
    if (draftAnno && activeId && activeId !== draftAnno.id) {
      draftAnno = null;
    }
  });
  onDestroy(unsubscribeActiveId);

  const handleAnnotationCreate = async (payload: { annotation: any }) => {
    const annotation = payload?.annotation;
    if (!annotation || typeof annotation !== 'object') return;

    const resolved = w3cToResolved(annotation);
    if (!resolved) return;

    // Set default properties
    resolved.targetStyleClass = 'mine';
    resolved.targetStyle = styleForLayerColor(
      findLayerById('mine')?.color ?? DEFAULT_LAYER_COLOR,
    );
    resolved.motivation =
      resolved.motivation && resolved.motivation.length > 0
        ? resolved.motivation
        : ['oa:commenting'];

    console.log('[ViewerLayout] Created resolved draft:', resolved);
    draftAnno = resolved;
    controller.handleAnnotationSelect({ id: resolved.id, preventZoom: true });
  };

  const handleAnnotationDelete = async (id: string) => {
    if (draftAnno && draftAnno.id === id) {
      draftAnno = null;
      controller.handleAnnotationClear();
      return;
    }
    await controller.removeAnnotation(id);
  };

  const handleAnnotationUpdate = (id: string, patch: Partial<ResolvedAnnotation>) => {
    if (draftAnno && draftAnno.id === id) {
      draftAnno = { ...draftAnno, ...patch };
      return;
    }
    controller.updateAnnotation(id, patch);
  };

  const handleAnnotationSave = async () => {
    if (draftAnno) {
      await controller.addAnnotation(draftAnno);
      draftAnno = null;
      annotationEditorTool = 'select';
      controller.setAnnotationMode('edit');
      controller.handleAnnotationClear();
      return;
    }

    const activeId = get(activeAnnotationId);
    if (!activeId) return;

    // Existing annotations are updated live while editing; this commits an explicit save action.
    await controller.updateAnnotation(activeId, {});
    annotationEditorTool = 'select';
    controller.setAnnotationMode('edit');
    controller.handleAnnotationClear();
  };

  const handleExportAnnotations = () => {
    const userAnnosMap = get(userAnnotations) ?? {};
    const allUserAnnos = Object.values(userAnnosMap).flat();
    controller.emitEvent('exportAnnotations', { annotations: allUserAnnos });
  };

  const preloadStoryManifests = async (value: StoryWithDefaults): Promise<void> => {
    const uniqueManifestIds = Array.from(
      new Set(
        (value.chapters ?? [])
          .map((chapter) => chapter.manifest)
          .filter(
            (manifest): manifest is string =>
              typeof manifest === 'string' && manifest.length > 0,
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
    setViewBox,
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
      controller.handleAnnotationSelect(detail);
      if (!isAnnotationEditor) return;
      if (draftAnno?.id === detail.id) return;
      annotationEditorTool = 'select';
      controller.setAnnotationMode('edit');
    },
    onAnnotationClear: () => controller.handleAnnotationClear(),
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
    controller.setCanvasByIndex(detail.index);
  };
  const handleHome = () => stageRef?.goHome?.();
  const handleRotate = () => stageRef?.rotateBy?.(90);
  const handleSeek = (detail: { canvasId?: string | null; time: number }) => {
    if (!Number.isFinite(detail.time)) return;
    const canvasList = get(canvases);
    const currentCanvasId = canvasList[get(selectedCanvasIndex)]?.id;
    if (detail.canvasId && detail.canvasId !== currentCanvasId) {
      const targetIndex = canvasList.findIndex((canvas) => canvas.id === detail.canvasId);
      if (targetIndex === -1) {
        stageRef?.seekTo?.(detail.time);
        return;
      }
      pendingSeek = detail;
      controller.setCanvasById(detail.canvasId);
      return;
    }
    stageRef?.seekTo?.(detail.time);
  };

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

  export function setViewBox(box: ViewBox): void {
    stageRef?.setViewBox?.(box);
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
    manifestId = id;
  }

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

  const setStoryError = (message: string) => {
    storyError = message;
    storyControlsDisabled = true;
    dispatch('storyViewerError', { message });
  };

  const loadStoryInput = async () => {
    const token = ++storyLoadToken;
    storyLoading = true;
    storyError = null;
    storyControlsDisabled = true;
    storyData = null;
    storyChapters = 0;

    let source: any = undefined;
    if (story !== undefined && story !== null && `${story}` !== '') {
      source = story;
    } else if (storyUrl) {
      try {
        const response = await fetch(storyUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        source = await response.json();
      } catch (error) {
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
      } catch (error) {
        setStoryError('Invalid story JSON');
        storyLoading = false;
        return;
      }
    }

    const normalised = normaliseStoryInput(parsed);
    if (!normalised.ok || !normalised.story) {
      setStoryError(normalised.error ?? 'Invalid story');
      storyLoading = false;
      return;
    }

    const validation = validateStoryViewer(normalised.story);
    if (!validation.ok) {
      setStoryError(validation.errors[0] ?? 'Invalid story');
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
  onDestroy(unsubscribeStoryIndex);
  onDestroy(unsubscribeStoryLoading);
  onDestroy(unsubscribeStoryPlayState);
  onDestroy(unsubscribeStoryPlaybackState);
  $effect.pre(() => {
    normalisedConfig = normaliseViewerConfig(config);
  });
  $effect.pre(() => {
    viewerState.manifestId.set(manifestId);
  });
  $effect.pre(() => {
    const configWithModeDefaults = {
      ...normalisedConfig,
      allowCreateMode:
        normalisedConfig.allowCreateMode || isStoryBuilder || isAnnotationEditor,
    };
    viewerState.config.set(configWithModeDefaults);
    if (isMobileLayout) {
      closeLeftPanelStores();
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
      storyChapterDurationSec = 0;
      storyChapterElapsedSec = 0;
    }
  });
  let leftVisibleEffective = $derived(
    isStoryViewer || isAnnotationEditor ? false : $leftVisible,
  );
  let rightVisibleEffective = $derived(
    isStoryViewer ? false : enableRightPanel && $rightVisible,
  );
  let showThumbnailsEffectiveStory = $derived(
    isStoryViewer ? false : showThumbnailsEffective,
  );
  let showSearchEffectiveStory = $derived(isStoryViewer ? false : showSearchEffective);
  let showAnnotationsEffectiveStory = $derived(
    isStoryViewer ? false : showAnnotationsEffective,
  );
  let showToolsEffectiveStory = $derived(isStoryViewer ? false : showToolsEffective);
  let showSettingsEffectiveStory = $derived(isPlainViewerMode ? $showSettings : false);
  let showContentsEffectiveStory = $derived(isStoryViewer ? false : $showContents);
  let showLayersEffective = $derived($showLayers && $allowLayers);
  let showLayersEffectiveStory = $derived(isStoryViewer ? false : showLayersEffective);
  let allowThumbnailsStory = $derived(isStoryViewer ? false : $allowThumbnails);
  let allowMetadataStory = $derived(isStoryViewer ? false : $allowMetadata);
  let allowSearchStory = $derived(isStoryViewer ? false : $allowSearch);
  let allowAnnotationsStory = $derived(isStoryViewer ? false : $allowAnnotations);
  let allowToolsStory = $derived(isStoryViewer ? false : $allowTools);
  let allowLayersStory = $derived((isStoryViewer || isStoryBuilder) ? false : $allowLayers);
  let allowContentsStory = $derived(isStoryViewer ? false : $contentsAvailable);
  // Story annotation overlay reactive variables
  $effect(() => {
    storyDataStore.set(storyData ?? EMPTY_STORY);
  });
  let storyCurrentChapterId = $derived(
    storyData?.chapters[storyCurrentChapterIndex]?.id ?? null,
  );
  $effect(() => {
    if (pendingSeek) {
      const currentCanvasId = get(canvases)[get(selectedCanvasIndex)]?.id;
      if (
        currentCanvasId &&
        (!pendingSeek.canvasId || pendingSeek.canvasId === currentCanvasId)
      ) {
        stageRef?.seekTo?.(pendingSeek.time);
        pendingSeek = null;
      }
    }
  });
</script>

<div
  class="viewer"
  class:viewer--fullscreen-fallback={isViewerFullscreenFallback}
  data-theme={viewerSettingsTheme}
  aria-live="polite"
  bind:this={viewerRoot}
>
  {#if leftVisibleEffective && !isStoryViewer}
    <button
      type="button"
      class="viewer__backdrop viewer__backdrop--active"
      aria-label="Close panels"
      onclick={closeMobileLeftDrawer}
    ></button>
  {/if}

  <div class="viewer__top-row">
    <div class="viewer__top-title">
      {#if !isStoryViewer}
        <ViewerHeader {manifestId} manifestEntry={$manifestEntry} />
      {/if}
    </div>

    <div class="viewer__top-actions">
      {#if isAnnotationEditor}
        <button type="button" class="viewer__export-btn" onclick={handleExportAnnotations}>
          {$t('viewer.panels.annotations.export') || 'Export Annotations'}
        </button>
      {/if}

      <button
        type="button"
        class="viewer__fullscreen-btn"
        onclick={handleStoryFullscreen}
        aria-label={isViewerFullscreen ? 'Close fullscreen' : 'Enter fullscreen'}
        title={isViewerFullscreen ? 'Close fullscreen' : 'Enter fullscreen'}
      >
        ⛶
      </button>
    </div>
  </div>

  <div
    class="viewer__grid"
    class:viewer__grid--controls={showControlRail}
    class:viewer__grid--left={leftVisibleEffective}
    class:viewer__grid--right={rightVisibleEffective}
  >
    {#if showControlRail}
      <aside class="viewer__control-rail" aria-label={$t('viewer.stage.controls.label')}>
        <ViewerDock
          compact={true}
          allowThumbnails={allowThumbnailsStory}
          allowContents={allowContentsStory}
          allowSearch={allowSearchStory}
          allowMetadata={allowMetadataStory}
          allowAnnotations={allowAnnotationsStory}
          allowTools={allowToolsStory}
          allowLayers={allowLayersStory}
          allowSettings={isPlainViewerMode}
          showThumbnails={showThumbnailsEffectiveStory}
          showContents={showContentsEffectiveStory}
          showSearch={showSearchEffectiveStory}
          showMetadata={$showMetadata}
          showAnnotations={showAnnotationsEffectiveStory}
          showTools={showToolsEffectiveStory}
          showLayers={showLayersEffectiveStory}
          showSettings={showSettingsEffectiveStory}
          on:panelToggle={(event) =>
            controller.setPanelOpen(event.detail.panel, event.detail.open)}
        />
      </aside>
    {/if}

    {#if leftVisibleEffective && !isAnnotationEditor}
      <LeftPanelStack
        showAnnotations={showAnnotationsEffectiveStory}
        showTools={showToolsEffectiveStory}
        showSearch={showSearchEffectiveStory}
        showMetadata={$showMetadata}
        showSettings={showSettingsEffectiveStory}
        showContents={showContentsEffectiveStory}
        showLayers={showLayersEffectiveStory}
        layers={$mediaSources}
        layerOpacities={$layerOpacities}
        annotationMode={effectiveAnnotationMode}
        allowCreateMode={canDrawAnnotations}
        overlayAnnotations={$overlayAnnotations}
        activeAnnotationId={$activeAnnotationId}
        searchQuery={$searchQuery}
        searchHits={$searchHits}
        selectedSearchResultId={$selectedSearchResultId}
        mediaType={$mediaType}
        imageFilters={$imageFilters}
        manifestTitle={$manifestTitle}
        manifestDescription={$manifestDescription}
        manifestAttribution={$manifestAttribution}
        manifestLicence={$manifestLicence}
        manifestMetadata={$manifestMetadata}
        tocEntries={$tocEntries}
        transcriptEntries={$transcriptEntries}
        activeTranscriptId={$activeTranscriptId}
        leftPlugins={$pluginSlots.left}
        settingsLayout={viewerSettingsLayout}
        settingsTheme={viewerSettingsTheme}
        settingsLocale={viewerSettingsLocale}
        layoutMode={$layoutMode}
        {pluginContext}
        on:panelToggle={(event) =>
          controller.setPanelOpen(event.detail.panel, event.detail.open)}
        on:updateLayerOpacity={(event) =>
          controller.updateLayerOpacity(event.detail.id, event.detail.opacity)}
        on:annotationModeChange={(event) => {
          if (!canDrawAnnotations) return;
          controller.setAnnotationMode(event.detail.mode);
        }}
        on:annotationSelect={(event) => controller.handleAnnotationSelect(event.detail)}
        on:searchQueryChange={(event) => controller.setSearchQuery(event.detail.value)}
        on:searchResultClick={(event) => controller.handleSearchResultClick(event.detail)}
        on:updateImageFilter={(event) =>
          controller.updateImageFilter(event.detail.key, event.detail.value)}
        on:resetImageFilters={() => controller.resetImageFilters()}
        on:mediaSeek={(event) => handleSeek(event.detail)}
        on:settingsLayoutChange={(event) => {
          const nextLayout = event.detail.layout;
          viewerSettingsLayout = nextLayout;
          if (nextLayout !== '1x1') {
            if (!workspace) {
              workspace = new WorkspaceStore(manifestId);
            }
            workspace.setLayoutPreset(nextLayout);
          } else {
            workspace = null;
          }
        }}
        on:settingsThemeChange={(event) => (viewerSettingsTheme = event.detail.theme)}
        on:settingsLocaleChange={(event) => (viewerSettingsLocale = event.detail.locale)}
        on:settingsLayoutModeChange={(event) => controller.setLayoutMode(event.detail.mode)}
      />
    {/if}

    {#if isStoryViewer}
      <main class="stage stage--story" aria-label={$t('viewer.stage.label')}>
        {#if StoryControlsStageComponent && StoryAnnotationOverlayComponent}
          <StoryControlsStageComponent
            currentChapterIndex={storyCurrentChapterIndex}
            totalChapters={storyChapters}
            chapterThumbnails={storyChapterThumbnails}
            chapterDurationSec={storyChapterDurationSec}
            chapterElapsedSec={storyChapterElapsedSec}
            {chapterTitle}
            {chapterDescription}
            disabled={storyControlsDisabled || storyLoading}
            loading={storyIsLoading}
            error={storyError}
            playState={storyPlayState}
            on:selectChapter={(event) => handleStorySelectChapter(event.detail.index, true)}
            on:play={handleStoryPlay}
            on:pause={handleStoryPause}
            on:stop={handleStoryStop}
            on:zoomIn={handleZoomIn}
            on:zoomOut={handleZoomOut}
            on:fit={handleHome}
            on:refresh={handleStoryRefresh}
            on:previousChapter={handleStoryPreviousChapter}
            on:nextChapter={handleStoryNextChapter}
          >
            {#snippet stage()}
              <div class="stage__story-slot">
                <Stage
                  bind:this={stageRef}
                  bind:canZoom
                  fillHeight={isStoryBuilder}
                  rendererComponent={$rendererComponent}
                  mediaSource={$mediaSource}
                  accompanyingSource={$accompanyingSource}
                  layoutMode={$layoutMode}
                  activeLayoutImages={$activeLayoutImages}
                  captionTracks={$captionTracks}
                  startTime={$startTime}
                  annotations={$overlayAnnotations}
                  highlightIds={$highlightIds}
                  activeAnnotationId={$activeAnnotationId}
                  hoverAnnotationId={$hoverAnnotationId}
                  overlayPlugins={$pluginSlots.overlay}
                  {pluginContext}
                  {rendererHandlers}
                  isFetching={$manifestEntry?.isFetching ?? false}
                  error={$manifestEntry?.error ?? ''}
                  imageFilters={$imageFilters}
                  mediaType={$mediaType}
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
                  layers={$mediaSources}
                  layerOpacities={$layerOpacities}
                  annotationMode={effectiveAnnotationMode}
                  canvasId={activeCanvasId}
                  onviewboxchange={(detail) => {
                    controller.handleViewBoxChange(detail);
                    storyViewBoxStore.set(detail.viewBox);
                  }}
                  onzoomchange={(detail) => controller.handleZoomChange(detail)}
                  onpaneltoggle={(detail) =>
                    controller.setPanelOpen(detail.panel, detail.open)}
                  onannotationcreate={handleAnnotationCreate}
                  onannotationupdate={(payload) =>
                    handleAnnotationUpdate(payload.id, payload.patch as Partial<ResolvedAnnotation>)}
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
            annotations={filteredOverlayAnnotations}
            activeAnnotationId={$activeAnnotationId}
            draftAnnotation={visibleDraftAnno}
            activeTool={annotationEditorTool}
            layers={annotationLayers}
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
                controller.handleAnnotationClear();
              }
            }}
            ontogglelayer={handleToggleLayer}
            onaddlayer={handleAddLayer}
            onlayercolorchange={handleLayerColorChange}
            onannotationselect={(detail) => {
              const selectedDraft = draftAnno?.id === detail.id;
              if (draftAnno && draftAnno.id !== detail.id) {
                draftAnno = null;
              }
              controller.handleAnnotationSelect(detail);
              if (!selectedDraft) {
                annotationEditorTool = 'select';
                controller.setAnnotationMode('edit');
              }
            }}
            onannotationdelete={(detail) => handleAnnotationDelete(detail.id)}
            onannotationupdate={(detail) => handleAnnotationUpdate(detail.id, detail.patch)}
            onannotationsave={handleAnnotationSave}
          >
            {#snippet stage()}
              <div class="stage__story-slot">
                <Stage
                  bind:this={stageRef}
                  bind:canZoom
                  fillHeight={true}
                  rendererComponent={$rendererComponent}
                  mediaSource={$mediaSource}
                  accompanyingSource={$accompanyingSource}
                  layoutMode={$layoutMode}
                  activeLayoutImages={$activeLayoutImages}
                  captionTracks={$captionTracks}
                  startTime={$startTime}
                  annotations={editorStageAnnotations}
                  highlightIds={$highlightIds}
                  activeAnnotationId={$activeAnnotationId}
                  hoverAnnotationId={$hoverAnnotationId}
                  overlayPlugins={$pluginSlots.overlay}
                  {pluginContext}
                  {rendererHandlers}
                  isFetching={$manifestEntry?.isFetching ?? false}
                  error={$manifestEntry?.error ?? ''}
                  imageFilters={$imageFilters}
                  mediaType={$mediaType}
                  layers={$mediaSources}
                  layerOpacities={$layerOpacities}
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
                  annotationMode={effectiveAnnotationMode}
                  annotationTool={annotationEditorTool}
                  canvasId={activeCanvasId}
                  editableRectAnnotationId={editableSavedRectAnnotationId}
                  onviewboxchange={(detail) => controller.handleViewBoxChange(detail)}
                  onzoomchange={(detail) => controller.handleZoomChange(detail)}
                  onannotationcreate={handleAnnotationCreate}
                  onannotationupdate={(payload) =>
                    handleAnnotationUpdate(payload.id, payload.patch as Partial<ResolvedAnnotation>)}
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
                  on:home={handleHome}
                  on:zoomIn={handleZoomIn}
                  on:zoomOut={handleZoomOut}
                  on:setZoomPercent={(event) => handleSetZoomPercent(event.detail)}
                  on:rotate={handleRotate}
                  on:setCanvasIndex={(event) => handleSetCanvasIndex(event.detail)}
                  on:prevCanvas={handlePrevCanvas}
                  on:nextCanvas={handleNextCanvas}
                />
              </div>
            {/snippet}
          </AnnotationWorkspaceComponent>
        {/if}
      </main>
    {:else}
      <main
        class="stage"
        class:stage--with-bottom-toolbar={!toolbarAboveMedia}
        class:stage--workspace={!!workspace && viewerSettingsLayout !== '1x1'}
        aria-label={$t('viewer.stage.label')}
      >
        {#if viewerSettingsLayout === '1x1'}
          {#if toolbarAboveMedia && $layoutMode !== 'gallery'}
            <StageToolbar
              {canZoom}
              {hasSource}
              placement="above"
              mediaType={$mediaType}
              selectedCanvasIndex={$selectedCanvasIndex}
              totalCanvases={$canvases.length}
              {zoomPercent}
              on:home={handleHome}
              on:zoomIn={handleZoomIn}
              on:zoomOut={handleZoomOut}
              on:setZoomPercent={(event) => handleSetZoomPercent(event.detail)}
              on:rotate={handleRotate}
              on:setCanvasIndex={(event) => handleSetCanvasIndex(event.detail)}
              on:prevCanvas={handlePrevCanvas}
              on:nextCanvas={handleNextCanvas}
            />
          {/if}

          {#if $layoutMode === 'gallery'}
            <div class="stage-gallery-view">
              <div class="stage-gallery-view__grid">
                {#each $canvases as canvas (canvas.id)}
                  <button
                    class="stage-gallery-view__card"
                    class:stage-gallery-view__card--active={canvas.index === $selectedCanvasIndex}
                    type="button"
                    onclick={() => {
                      controller.setCanvasByIndex(canvas.index);
                      controller.setLayoutMode('single');
                    }}
                  >
                    <div class="stage-gallery-view__thumb-wrapper">
                      {#if $canvasThumbnails[canvas.index]}
                        <img
                          class="stage-gallery-view__img"
                          src={$canvasThumbnails[canvas.index]}
                          alt={canvas.label || `Page ${canvas.index + 1}`}
                          loading="lazy"
                        />
                      {:else}
                        <div class="stage-gallery-view__placeholder">
                          <span class="stage-gallery-view__index">{canvas.index + 1}</span>
                        </div>
                      {/if}
                    </div>
                    <div class="stage-gallery-view__label">
                      {canvas.label || `Page ${canvas.index + 1}`}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <Stage
              bind:this={stageRef}
              bind:canZoom
              fillHeight={isStoryBuilder}
              rendererComponent={$rendererComponent}
              mediaSource={$mediaSource}
              accompanyingSource={$accompanyingSource}
              layoutMode={$layoutMode}
              activeLayoutImages={$activeLayoutImages}
              captionTracks={$captionTracks}
              startTime={$startTime}
              annotations={$overlayAnnotations}
              highlightIds={$highlightIds}
              activeAnnotationId={$activeAnnotationId}
              hoverAnnotationId={$hoverAnnotationId}
              overlayPlugins={$pluginSlots.overlay}
              {pluginContext}
              {rendererHandlers}
              isFetching={$manifestEntry?.isFetching ?? false}
              error={$manifestEntry?.error ?? ''}
              imageFilters={$imageFilters}
              mediaType={$mediaType}
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
              layers={$mediaSources}
              layerOpacities={$layerOpacities}
              annotationMode={effectiveAnnotationMode}
              canvasId={activeCanvasId}
              onviewboxchange={(detail) => controller.handleViewBoxChange(detail)}
              onzoomchange={(detail) => controller.handleZoomChange(detail)}
              onpaneltoggle={(detail) => controller.setPanelOpen(detail.panel, detail.open)}
              onannotationcreate={handleAnnotationCreate}
              onannotationupdate={(payload) =>
                handleAnnotationUpdate(payload.id, payload.patch as Partial<ResolvedAnnotation>)}
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
              on:home={handleHome}
              on:zoomIn={handleZoomIn}
              on:zoomOut={handleZoomOut}
              on:setZoomPercent={(event) => handleSetZoomPercent(event.detail)}
              on:rotate={handleRotate}
              on:setCanvasIndex={(event) => handleSetCanvasIndex(event.detail)}
              on:prevCanvas={handlePrevCanvas}
              on:nextCanvas={handleNextCanvas}
            />
          {/if}

          {#if showThumbnailsEffectiveStory && $layoutMode !== 'gallery'}
            <Gallery
              canvases={$canvases}
              canvasThumbnails={$canvasThumbnails}
              selectedCanvasIndex={$selectedCanvasIndex}
              on:panelToggle={(event) =>
                controller.setPanelOpen(event.detail.panel, event.detail.open)}
              on:canvasSelect={(event) => controller.setCanvasByIndex(event.detail.index)}
            />
          {/if}

          {#if $pluginSlots.bottom.length > 0}
            <div class="stage__bottom">
              {#snippet bottom()}
                <PluginSlot plugins={$pluginSlots.bottom} {pluginContext} />
              {/snippet}
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
          />
        {/if}
      </main>
    {/if}

    {#if !isStoryViewer && rightVisibleEffective}
      <aside
        class="panel-stack panel-stack--right"
        aria-label={$t('viewer.panels.rightLabel')}
      >
        {#if $pluginSlots.right.length > 0}
          {#snippet right()}
            <PluginSlot plugins={$pluginSlots.right} {pluginContext} />
          {/snippet}
        {/if}
      </aside>
    {/if}
  </div>
</div>

<style>
  .stage-gallery-view {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background: var(--viewer-stage, #111720);
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 24px;
    box-sizing: border-box;
  }

  .stage-gallery-view__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 24px;
    width: 100%;
  }

  .stage-gallery-view__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 12px;
    cursor: pointer;
    transition:
      transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1),
      border-color 0.22s ease,
      box-shadow 0.22s ease,
      background-color 0.22s ease;
    width: 100%;
    box-sizing: border-box;
    outline: none;
  }

  .stage-gallery-view__card:hover {
    transform: translateY(-6px);
    border-color: var(--viewer-accent-2, #2ac7ff);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 12px 30px rgba(42, 199, 255, 0.16);
  }

  .stage-gallery-view__card:focus-visible {
    outline: 2px solid var(--viewer-accent-2, #2ac7ff);
    outline-offset: 2px;
  }

  .stage-gallery-view__card--active {
    border-color: var(--viewer-accent-2, #2ac7ff);
    background: rgba(42, 199, 255, 0.06);
    box-shadow: 0 0 0 2px var(--viewer-accent-2, rgba(42, 199, 255, 0.2));
  }

  .stage-gallery-view__thumb-wrapper {
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.04);
    display: grid;
    place-items: center;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .stage-gallery-view__img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: transform 0.22s ease;
  }

  .stage-gallery-view__card:hover .stage-gallery-view__img {
    transform: scale(1.04);
  }

  .stage-gallery-view__placeholder {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: var(--viewer-muted, #9aa6b2);
  }

  .stage-gallery-view__index {
    font-size: 24px;
    font-weight: 700;
  }

  .stage-gallery-view__label {
    margin-top: 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--viewer-text, #e8edf4);
    text-align: center;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .viewer__top-row {
    display: flex;
    align-items: flex-start;
    min-width: 0;
    gap: 12px;
  }

  .viewer__top-title {
    flex: 1 1 auto;
    min-width: 0;
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

  .viewer__fullscreen-btn {
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
    --viewer-accent-3: #ffd166;
    --viewer-accent-tools: #a3e635;
    --viewer-stage: #111720;
    --viewer-stage-glow: rgba(42, 199, 255, 0.12);
    --viewer-stage-tail: #0b0f14;
    --viewer-dock-button-bg: rgba(15, 20, 27, 0.95);
    --viewer-dock-button-border: rgba(255, 255, 255, 0.12);
    --viewer-dock-tooltip-bg: rgba(10, 14, 19, 0.95);
    --viewer-dock-active-border: rgba(255, 209, 102, 0.42);
    --viewer-dock-active-ring: rgba(255, 209, 102, 0.24);
    --viewer-dock-active-chip-text: #0b0f14;
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
    --viewer-toolbar-group-bg: rgba(20, 30, 45, 0.55);
    --viewer-toolbar-button-bg: rgba(255, 255, 255, 0.03);
    --viewer-toolbar-button-hover-bg: rgba(255, 255, 255, 0.08);
    --viewer-toolbar-value-text: rgba(230, 236, 246, 0.96);
    --viewer-toolbar-value-bg: rgba(4, 11, 22, 0.55);
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

    display: grid;
    grid-template-rows: auto 1fr;
    gap: 16px;
    box-sizing: border-box;
    height: 100%;
    max-height: 100vh;
    min-height: clamp(820px, 92vh, 980px);
    overflow: hidden;
    padding: 20px;
    border-radius: 24px;
    background: radial-gradient(
      120% 120% at 10% 0%,
      #1d2632 0%,
      #111720 55%,
      #0b0f14 100%
    );
    color: var(--viewer-text);
    font-family: sans-serif;
    border: 1px solid #1c2530;
    box-shadow: var(--viewer-frame-shadow, 0 28px 70px rgba(0, 0, 0, 0.55));
    container-type: inline-size;
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
    touch-action: none;
  }

  .viewer:-webkit-full-screen {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    min-height: 0;
    border-radius: 0;
    overscroll-behavior: none;
    touch-action: none;
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
    touch-action: none;
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
    --viewer-muted: #69788b;
    --viewer-accent: #7c96be;
    --viewer-accent-2: #6caec7;
    --viewer-accent-3: #c5a264;
    --viewer-stage: #f3f5f8;
    --viewer-stage-glow: rgba(108, 174, 199, 0.16);
    --viewer-stage-tail: #ffffff;
    --viewer-dock-button-bg: rgba(248, 251, 255, 0.96);
    --viewer-dock-button-border: rgba(34, 48, 65, 0.2);
    --viewer-dock-tooltip-bg: rgba(241, 246, 252, 0.97);
    --viewer-dock-active-border: rgba(197, 162, 100, 0.6);
    --viewer-dock-active-ring: rgba(197, 162, 100, 0.22);
    --viewer-dock-active-chip-text: #223041;
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
    --viewer-close-button-focus-ring: rgba(108, 174, 199, 0.58);
    --viewer-stage-bottom-bg: rgba(241, 245, 251, 0.86);
    --viewer-toolbar-separator: rgba(34, 48, 65, 0.16);
    --viewer-toolbar-group-border: rgba(34, 48, 65, 0.16);
    --viewer-toolbar-group-bg: rgba(235, 241, 248, 0.9);
    --viewer-toolbar-button-bg: rgba(255, 255, 255, 0.84);
    --viewer-toolbar-button-hover-bg: rgba(124, 150, 190, 0.2);
    --viewer-toolbar-value-text: #223041;
    --viewer-toolbar-value-bg: rgba(224, 232, 241, 0.92);
    --viewer-search-input-bg: rgba(255, 255, 255, 0.92);
    --viewer-search-clear-bg: rgba(124, 150, 190, 0.2);
    --viewer-search-item-bg: rgba(255, 255, 255, 0.78);
    --viewer-search-item-hover-bg: rgba(124, 150, 190, 0.22);
    --viewer-search-focus: rgba(108, 174, 199, 0.68);
    --viewer-control-rail-bg: linear-gradient(
      180deg,
      rgba(241, 245, 251, 0.95) 0%,
      rgba(229, 236, 245, 0.95) 100%
    );
    border-color: #dbe2eb;
    box-shadow: var(--viewer-frame-shadow, 0 24px 52px rgba(25, 40, 60, 0.12));
    background: radial-gradient(
      135% 135% at 10% 0%,
      #e6f1ff 0%,
      #f5faff 45%,
      #ffffff 100%
    );
  }

  .viewer__grid {
    display: grid;
    grid-template-columns: 1fr;
    row-gap: 18px;
    column-gap: 18px;
    align-items: stretch;
    height: 100%;
    max-height: 100%;
    min-height: 0;
  }

  .viewer__grid--left {
    grid-template-columns: minmax(240px, 300px) 1fr;
  }

  .viewer__grid--controls {
    grid-template-columns: 68px 1fr;
  }

  .viewer__grid--right {
    grid-template-columns: 1fr minmax(220px, 280px);
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left {
    grid-template-columns: 68px minmax(240px, 300px) 1fr;
    column-gap: 0;
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--right {
    grid-template-columns: 68px 1fr minmax(220px, 280px);
  }

  .viewer__grid.viewer__grid--left.viewer__grid--right {
    grid-template-columns: minmax(240px, 300px) 1fr minmax(220px, 280px);
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--right {
    grid-template-columns: 68px minmax(240px, 300px) 1fr minmax(220px, 280px);
    column-gap: 0;
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
    justify-items: center;
    box-sizing: border-box;
    padding: 14px 8px;
    border: 1px solid var(--viewer-panel-border);
    border-right: none;
    border-radius: 18px 0 0 18px;
    background: var(--viewer-control-rail-bg);
    min-height: 0;
  }

  .viewer__control-rail :global(.viewer__dock) {
    position: static;
    right: auto;
    top: auto;
    transform: none;
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
    overflow-x: hidden;
    overflow-y: auto;
    align-content: start;
  }

  .stage--with-bottom-toolbar {
    grid-template-rows: minmax(0, 1fr);
    grid-auto-rows: auto;
    overflow: hidden;
  }

  .stage--story {
    overflow: hidden;
    align-content: stretch;
  }

  .stage__story-slot {
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 10px;
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

  :global(.viewer :is(button, input, select, textarea):focus-visible) {
    outline: 2px solid rgba(42, 199, 255, 0.7);
    outline-offset: 2px;
  }

  .viewer__backdrop {
    display: none;
  }

  @media (max-width: 768px) {
    .viewer {
      min-height: 100dvh;
      max-height: 100dvh;
      height: 100dvh;
      overflow: hidden;
      padding: 16px;
    }
  }

  @container mango-viewer (max-width: 768px) {
    .viewer {
      min-height: 100vh;
      max-height: 100vh;
      height: 100%;
      overflow: hidden;
      padding: 16px;
    }

    .viewer__grid {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
      height: 100%;
      max-height: 100vh;
      min-height: 0;
      overflow: hidden;
    }

    .viewer__grid.viewer__grid--left.viewer__grid--right,
    .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--right,
    .viewer__grid.viewer__grid--left,
    .viewer__grid.viewer__grid--controls.viewer__grid--left,
    .viewer__grid.viewer__grid--right,
    .viewer__grid.viewer__grid--controls.viewer__grid--right,
    .viewer__grid.viewer__grid--controls {
      grid-template-columns: 1fr;
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
      z-index: 9;
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
      z-index: 10;
      transform: translateX(0);
      animation: viewer-slidein-left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-shadow: 10px 0 30px rgba(0, 0, 0, 0.4);
    }

    .viewer__control-rail {
      grid-row: 2;
      grid-column: 1;
      width: 100%;
      max-width: 100%;
      height: auto;
      box-sizing: border-box;
      padding: 4px 6px;
      border: 1px solid var(--viewer-panel-border);
      border-radius: 12px;
      background: var(--viewer-panel);
      display: grid;
      align-items: center;
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
      max-width: 34px;
      height: 34px;
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
      height: auto;
      min-height: 0;
      overflow: visible;
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
</style>
