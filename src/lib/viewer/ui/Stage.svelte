<script lang="ts">
  import { t } from '../../core/i18n';
  import PluginSlot from '../../plugins/PluginSlot.svelte';
  import RendererHost from './RendererHost.svelte';
  import ViewerDock from './ViewerDock.svelte';
  import type { ImageFilters } from '../../core/types/filters';
  import type { ModelPose, ModelPoseOptions } from '../../core/types/model';
  import type { ContentSize, ViewBox } from '../../core/types/viewer';
  import type { MediaSource, MediaType } from '../../iiif/mediaResolver';
  import type { AVPlayerController } from '@mango-iiif/av/core';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import type { PluginContext, ViewerPlugin } from '../../core/types/plugin';
  import type { RendererEventHandlers } from '../types/rendererEvents';
  import type { ViewerConfig } from '../../core/types/config';
  import AnnotationLayer from '../../features/annotations/AnnotationLayer.svelte';
  import type {
    ActiveLayoutImage,
    RendererExtension,
    RendererComponent,
    RendererInstance,
    StagePoint,
    StageSize,
  } from '../../core/types/renderer';

  type DockPanel =
    | 'thumbnails'
    | 'contents'
    | 'search'
    | 'metadata'
    | 'annotations'
    | 'tools'
    | 'layers'
    | 'settings';

  interface Props {
    rendererComponent?: RendererComponent | null;
    avController?: AVPlayerController;
    mediaSource?: MediaSource | null;
    annotations?: ResolvedAnnotation[];
    highlightIds?: string[];
    activeAnnotationId?: string | null;
    hoverAnnotationId?: string | null;
    overlayPlugins?: ViewerPlugin[];
    pluginContext: Omit<PluginContext, 'mount'>;
    isFetching?: boolean;
    error?: string;
    imageFilters: ImageFilters;
    mediaType?: MediaType | null;
    viewerConfig?: ViewerConfig;
    allowThumbnails?: boolean;
    allowSearch?: boolean;
    allowMetadata?: boolean;
    allowAnnotations?: boolean;
    allowTools?: boolean;
    allowLayers?: boolean;
    allowSettings?: boolean;
    allowContents?: boolean;
    showThumbnails?: boolean;
    showContents?: boolean;
    showSearch?: boolean;
    showMetadata?: boolean;
    showAnnotations?: boolean;
    showTools?: boolean;
    showLayers?: boolean;
    layers?: MediaSource[];
    layerOpacities?: Record<string, number>;
    showDock?: boolean;
    rendererHandlers?: RendererEventHandlers | null;
    rotation?: number;
    initialViewBox?: ViewBox | null;
    fillHeight?: boolean;
    constrainMediaHeight?: boolean;
    canZoom?: boolean;
    onviewboxchange?: ((payload: { viewBox: ViewBox }) => void) | undefined;
    onzoomchange?:
      ((payload: { zoom: number; viewBox: ViewBox; homeZoom?: number }) => void) | undefined;
    onrotationchange?: ((payload: { rotation: number }) => void) | undefined;
    onpaneltoggle?: ((payload: { panel: DockPanel; open: boolean }) => void) | undefined;
    onrendererready?: ((payload: { renderer: RendererExtension }) => void) | undefined;
    onstageresize?: ((payload: StageSize) => void) | undefined;
    layoutMode?: 'single' | 'two-page' | 'continuous';
    activeLayoutImages?: ActiveLayoutImage[];
  }

  let {
    rendererComponent = null,
    avController = undefined,
    mediaSource = null,
    annotations = [],
    highlightIds = [],
    activeAnnotationId = null,
    hoverAnnotationId = null,
    overlayPlugins = [],
    pluginContext,
    isFetching = false,
    error = '',
    imageFilters,
    mediaType = null,
    viewerConfig = {},
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
    layers = [],
    layerOpacities = {},
    showDock = true,
    rendererHandlers = null,
    rotation = 0,
    initialViewBox = null,
    fillHeight = false,
    constrainMediaHeight = false,
    canZoom = $bindable(false),
    onviewboxchange = undefined,
    onzoomchange = undefined,
    onrotationchange = undefined,
    onpaneltoggle = undefined,
    onrendererready = undefined,
    onstageresize = undefined,
    layoutMode = 'single',
    activeLayoutImages = [],
  }: Props = $props();
  void canZoom;
  let useConstrainedMedia = $derived(constrainMediaHeight && !fillHeight && mediaType !== 'video');
  let isFixedStage = $derived(
    !fillHeight && (!mediaSource || mediaType !== 'video') && !useConstrainedMedia,
  );
  let dockInline = $derived(!fillHeight && mediaType === 'audio');
  let useRendererNativeAnnotationLayer = $derived(mediaType === 'image' || mediaType === 'audio');

  let rendererInstance: RendererInstance | null = $state(null);
  let mediaBounds: HTMLDivElement | null = $state(null);
  let stageWidth = $state(0);
  let stageHeight = $state(0);
  let stageViewBox = $state<ViewBox | null>(null);
  let pendingViewBox: ViewBox | null = $state(null);
  let pendingModelPose: ModelPose | null = $state(null);
  let pendingModelPoseOptions: ModelPoseOptions = $state({});
  let rendererError = $state('');
  export const getViewBox = (): ViewBox | null => rendererInstance?.getViewBox?.() ?? null;

  export const getContentSize = (): ContentSize | null =>
    rendererInstance?.getContentSize?.() ?? null;

  export const getRendererExtension = (): RendererExtension | null => {
    const extension = rendererInstance?.getExtension?.();
    if (extension) return extension;
    if (!rendererInstance || !mediaType) return null;
    if (mediaType === 'image') return null;
    return { kind: mediaType, instance: rendererInstance };
  };

  export const getStageSize = (): StageSize => ({
    width: stageWidth,
    height: stageHeight,
  });

  export const canvasToScreen = (point: StagePoint): StagePoint | null => {
    const extension = getRendererExtension();
    return extension?.kind === 'image' ? extension.canvasToScreen(point) : null;
  };

  export const screenToCanvas = (point: StagePoint): StagePoint | null => {
    const extension = getRendererExtension();
    return extension?.kind === 'image' ? extension.screenToCanvas(point) : null;
  };

  export const setViewBox = (box: ViewBox): void => {
    if (rendererInstance?.setViewBox) {
      rendererInstance.setViewBox(box);
      pendingViewBox = null;
      return;
    }
    // A host can request framing while the dynamically imported renderer is
    // still mounting. Keep that request until the renderer is ready.
    pendingViewBox = { ...box };
  };

  export const zoomBy = (factor: number): void => {
    rendererInstance?.zoomBy?.(factor);
  };

  export const goHome = (): void => {
    pendingViewBox = null;
    rendererInstance?.goHome?.();
  };

  export const rotateBy = (delta: number): void => {
    rendererInstance?.rotateBy?.(delta);
  };

  export const start = (): void => {
    rendererInstance?.start?.();
  };

  export const play = (): void => {
    rendererInstance?.play?.();
  };

  export const pause = (): void => {
    rendererInstance?.pause?.();
  };

  export const stop = (): void => {
    rendererInstance?.stop?.();
  };

  export const seekBy = (delta: number): void => {
    rendererInstance?.seekBy?.(delta);
  };

  export const seekTo = (time: number): void => {
    rendererInstance?.seekTo?.(time);
  };

  export const setMediaSegment = (start: number, end: number): void => {
    rendererInstance?.setMediaSegment?.(start, end);
  };

  export const setModelOrbit = (orbit: string): void => {
    pendingModelPose = { ...(pendingModelPose ?? {}), cameraOrbit: orbit };
    rendererInstance?.setCameraOrbit?.(orbit);
  };

  export const setModelTarget = (target: string): void => {
    pendingModelPose = { ...(pendingModelPose ?? {}), cameraTarget: target };
    rendererInstance?.setCameraTarget?.(target);
  };

  export const setModelOrientation = (orientation: string): void => {
    pendingModelPose = { ...(pendingModelPose ?? {}), orientation };
    rendererInstance?.setOrientation?.(orientation);
  };

  export const setModelPose = (pose: ModelPose, options?: ModelPoseOptions): void => {
    pendingModelPose = pose;
    pendingModelPoseOptions = options ?? {};
    rendererInstance?.setModelPose?.(pose, options);
  };

  export const getModelOrbit = (): string | null =>
    rendererInstance?.getCameraOrbit?.() ?? pendingModelPose?.cameraOrbit ?? null;

  export const getModelTarget = (): string | null =>
    rendererInstance?.getCameraTarget?.() ?? pendingModelPose?.cameraTarget ?? null;

  export const getModelOrientation = (): string | null =>
    rendererInstance?.getOrientation?.() ?? pendingModelPose?.orientation ?? null;

  export const getModelPose = (): ModelPose | null =>
    rendererInstance?.getModelPose?.() ?? pendingModelPose ?? null;

  const handleStageKeydown = (event: KeyboardEvent) => {
    const isEditable = event.composedPath().some(
      (target) =>
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.matches('input, textarea, select') ||
          Boolean(target.closest('[contenteditable="true"]'))),
    );
    if (isEditable) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(1.2);
    }
    if (event.key === '-') {
      event.preventDefault();
      zoomBy(0.8);
    }
  };

  const handleRendererViewBoxChange = (payload: { viewBox: ViewBox }) => {
    stageViewBox = payload.viewBox;
    onviewboxchange?.(payload);
  };

  const handleRendererZoomChange = (payload: {
    zoom: number;
    viewBox: ViewBox;
    homeZoom?: number;
  }) => {
    stageViewBox = payload.viewBox;
    onzoomchange?.(payload);
  };

  const handleRendererViewerReady = () => {
    rendererError = '';
    const extension = getRendererExtension();
    if (extension) onrendererready?.({ renderer: extension });
  };

  const handleRendererError = (payload: { message: string }) => {
    rendererError = payload.message || $t('viewer.stage.mediaError');
  };

  $effect(() => {
    // A renderer error belongs only to the active source. Changing canvas or
    // manifest must not carry that error into the next item.
    void mediaSource?.id;
    void mediaSource?.src;
    rendererError = '';
  });

  $effect(() => {
    canZoom = Boolean(rendererInstance?.zoomBy);
  });
  $effect(() => {
    if (rendererInstance?.setViewBox && pendingViewBox) {
      const box = pendingViewBox;
      pendingViewBox = null;
      rendererInstance.setViewBox(box);
    }
  });
  $effect(() => {
    if (rendererInstance?.setModelPose && pendingModelPose) {
      rendererInstance.setModelPose(pendingModelPose, pendingModelPoseOptions);
    }
  });
  $effect(() => {
    if (!mediaBounds || typeof ResizeObserver === 'undefined') return;
    stageWidth = mediaBounds.clientWidth;
    stageHeight = mediaBounds.clientHeight;
    onstageresize?.({ width: stageWidth, height: stageHeight });
    const observer = new ResizeObserver(() => {
      if (!mediaBounds) return;
      stageWidth = mediaBounds.clientWidth;
      stageHeight = mediaBounds.clientHeight;
      onstageresize?.({ width: stageWidth, height: stageHeight });
    });
    observer.observe(mediaBounds);
    return () => observer.disconnect();
  });
</script>

<div class="stage__container">
  {#if showDock}
    <div class:stage__dock--inline={dockInline} class="stage__dock">
      <ViewerDock
        {allowThumbnails}
        {allowContents}
        {allowSearch}
        {allowMetadata}
        {allowAnnotations}
        {allowTools}
        {allowLayers}
        {allowSettings}
        {showThumbnails}
        {showContents}
        {showSearch}
        {showMetadata}
        {showAnnotations}
        {showTools}
        {showLayers}
        onpanelToggle={(detail) => onpaneltoggle?.(detail)}
      />
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_tabindex (the labelled application region intentionally owns viewer-only keyboard shortcuts) -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions (the labelled application region intentionally owns viewer-only keyboard shortcuts) -->
  <div
    bind:this={mediaBounds}
    class:stage__media--fixed={isFixedStage}
    class:stage__media--constrained={useConstrainedMedia}
    class:stage__media--fill={fillHeight}
    class:stage__media--audio={mediaType === 'audio'}
    class:stage__media--video={mediaType === 'video'}
    class="stage__media"
    role="application"
    tabindex="0"
  aria-label={$t('viewer.stage.label')}
    onkeydown={handleStageKeydown}
  >
    {#if isFetching}
      <div class="stage__placeholder">{$t('viewer.stage.loading')}</div>
    {:else if error}
      <div class="stage__placeholder">{$t('viewer.stage.error')}</div>
    {:else if rendererError}
      <div class="stage__placeholder" role="alert">
        <strong>{$t('viewer.stage.mediaError')}</strong>
        {#if rendererError !== $t('viewer.stage.mediaError')}
          <span>{rendererError}</span>
        {/if}
      </div>
    {:else if rendererComponent && mediaSource}
      <RendererHost
        bind:rendererInstance
        {rendererComponent}
        {avController}
        source={mediaSource}
        {annotations}
        {highlightIds}
        {activeAnnotationId}
        {hoverAnnotationId}
        {imageFilters}
        {mediaType}
        {viewerConfig}
        {rendererHandlers}
        {rotation}
        {initialViewBox}
        {layers}
        {layerOpacities}
        {layoutMode}
        {activeLayoutImages}
        onviewboxchange={handleRendererViewBoxChange}
        onzoomchange={handleRendererZoomChange}
        onrotationchange={(payload) => onrotationchange?.(payload)}
        onviewerready={handleRendererViewerReady}
        onrenderererror={handleRendererError}
      />
    {:else}
      <div class="stage__placeholder" role="status">
        {$t('viewer.stage.missingMedia')}
      </div>
    {/if}

    {#if !useRendererNativeAnnotationLayer}
      <AnnotationLayer
        annotations={annotations}
        viewBox={stageViewBox}
        width={stageWidth}
        height={stageHeight}
        {activeAnnotationId}
        {hoverAnnotationId}
        {highlightIds}
        onannotationHover={(detail) => rendererHandlers?.onAnnotationHover?.(detail)}
        onannotationSelect={(detail) => rendererHandlers?.onAnnotationSelect?.(detail)}
        onannotationClear={() => rendererHandlers?.onAnnotationClear?.()}
      />
    {/if}

    {#if overlayPlugins.length > 0}
      <div
        class:stage__overlay--flush={fillHeight}
        class="stage__overlay"
      >
        <PluginSlot slot="overlay" plugins={overlayPlugins} context={pluginContext} />
      </div>
    {/if}
  </div>
</div>

<style>
  .stage__container {
    position: relative;
    display: grid;
    gap: 16px;
    height: 100%;
    min-height: 0;
    /*
     * A size container so the stage can be sized against the slot it
     * actually sits in. The viewer-level container is the whole element,
     * including its bars, which is the wrong reference for "how much room does
     * the picture have".
     */
    container-type: size;
    container-name: mango-stage;
    /* The OSD <canvas> has an intrinsic width; without a zero min-width it can
       force this column — and therefore the whole stage — wider than the viewer. */
    min-width: 0;
  }

  .stage__dock {
    position: absolute;
    right: 18px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
  }

  .stage__dock--inline {
    position: static;
    transform: none;
    justify-self: start;
  }

  .stage__dock :global(.viewer__dock) {
    position: static;
    right: auto;
    top: auto;
    transform: none;
  }

  .stage__dock--inline :global(.viewer__dock) {
    grid-auto-flow: column;
    grid-template-columns: repeat(auto-fit, minmax(44px, 1fr));
  }

  .stage__media {
    height: auto;
    min-width: 0;
    border-radius: var(--viewer-chrome-radius, 0);
    overflow: hidden;
    background: var(--viewer-stage);
    position: relative;
    outline: none;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  /*
   * Sized against the viewer element (`cqh`), never the browser window. With
   * `vh` here a 400px-tall embed on a 1080px monitor asked for 734px of media
   * and overflowed its host; `cqh` resolves against `.viewer`, which is a size
   * container, so the media tracks the space the embedder actually gave us.
   */
  .stage__media--fixed {
    height: clamp(240px, 68cqh, 676px);
  }

  .stage__media--constrained {
    height: 100%;
    min-height: 0;
  }

  .stage__media--fill {
    height: 100%;
    min-height: 0;
  }

  .stage__media:focus-visible {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--viewer-accent-2, #2ac7ff) 4%, transparent);
  }

  .stage__placeholder {
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 16px;
    border-radius: var(--viewer-chrome-radius, 0);
    background: rgba(255, 255, 255, 0.04);
    color: var(--viewer-muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }

  .stage__placeholder span {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.85em;
    opacity: 0.8;
  }

  .stage__overlay {
    position: absolute;
    inset: 12px;
    display: grid;
    align-content: start;
    gap: 12px;
    pointer-events: none;
  }

  .stage__overlay--flush {
    inset: 0;
  }

  .stage__overlay :global(.plugin-panel--overlay) {
    pointer-events: auto;
  }

  /* Overlay plugins fill the stage and normally own its pointer input. */

  @container mango-viewer (max-width: 1024px) {
    .stage__container {
      gap: 6px;
    }

    .stage__dock {
      position: static;
      transform: none;
      justify-self: start;
    }

    .stage__dock :global(.viewer__dock) {
      grid-auto-flow: column;
      grid-template-columns: repeat(auto-fit, minmax(32px, 1fr));
      gap: 4px;
    }

    .stage__media--fixed {
      height: clamp(200px, 52cqh, 560px);
    }

    .stage__media--audio {
      /* Audio is a 16:7 artwork area plus the player's compact control bar. */
      height: min(calc(100cqw * 7 / 16 + 44px), 510px);
      min-height: 0;
    }

    .stage__media--video {
      height: auto;
      min-height: 0;
      aspect-ratio: 16 / 9;
    }
  }

  @container mango-viewer (max-width: 480px) {
    .stage__media--fixed {
      height: clamp(160px, 44cqh, 340px);
    }

    .stage__media--audio {
      height: clamp(200px, 26cqh, 240px);
    }

    .stage__media--video {
      /* Slightly higher share than audio: `cqh` measures the viewer element,
         which is shorter than the window the old `svh` value measured, so the
         coefficient is raised to keep the same on-screen video height. */
      height: clamp(210px, 30cqh, 240px);
    }
  }

  /*
   * Short elements (landscape phones, short embeds): the media keeps its share
   * of the box instead of asking for a fixed pixel height it cannot have.
   */
  @container mango-viewer (max-height: 560px) {
    .stage__media--fixed,
    .stage__media--audio,
    .stage__media--video {
      height: 100%;
      min-height: 0;
    }
  }
</style>
