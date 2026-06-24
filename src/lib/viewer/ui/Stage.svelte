<script lang="ts">
  import { getContext } from 'svelte';
  import { t } from '../../i18n';
  import PluginSlot from '../../plugins/PluginSlot.svelte';
  import RendererHost from './RendererHost.svelte';
  import ViewerDock from './ViewerDock.svelte';
  import type { ImageFilters } from '../../core/types/filters';
  import type { ModelPose, ModelPoseOptions } from '../../core/types/model';
  import type { ViewBox } from '../../core/types/viewer';
  import type { MediaSource, MediaType } from '../../iiif/mediaResolver';
  import type { MediaTextTrack } from '../../iiif/avResolver';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import type { PluginContext, ViewerPlugin } from '../../core/types/plugin';
  import type { RendererEventHandlers } from '../types/rendererEvents';
  import type { ViewerConfig } from '../../core/types/config';
  import AnnotationLayer from '../../features/annotations/AnnotationLayer.svelte';
  import AnnotationEditorLayer from '../../features/annotations/AnnotationEditorLayer.svelte';
  import RectanglePlacementEditor from '../../features/annotations/RectanglePlacementEditor.svelte';
  import { resolvedToW3C, w3cToResolved } from '../../features/annotations/W3CParser';
  import type { ViewportState } from '../../core/state/viewportState.svelte';
  import { VIEWPORT_STATE_CONTEXT_KEY } from '../../core/state/viewportState.svelte';

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
    rendererComponent?: any;
    mediaSource?: MediaSource | null;
    accompanyingSource?: MediaSource | null;
    captionTracks?: MediaTextTrack[];
    startTime?: number | null;
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
    onzoomchange?: ((payload: { zoom: number; viewBox: ViewBox }) => void) | undefined;
    onrotationchange?: ((payload: { rotation: number }) => void) | undefined;
    onpaneltoggle?: ((payload: { panel: DockPanel; open: boolean }) => void) | undefined;
    annotationMode?: 'edit' | 'create';
    annotationTool?: 'select' | 'rectangle' | 'point' | 'polygon' | 'freehand' | 'line';
    canvasId?: string | null;
    editableRectAnnotationId?: string | null;
    onannotationcreate?: ((payload: { annotation: unknown }) => void) | undefined;
    onannotationupdate?:
      | ((payload: { id: string; patch: Record<string, unknown> }) => void)
      | undefined;
    onannotationtoolchange?:
      | ((payload: { tool: 'select' | 'rectangle' | 'point' | 'polygon' | 'freehand' | 'line' }) => void)
      | undefined;
    layoutMode?: 'single' | 'two-page' | 'continuous';
    activeLayoutImages?: any[];
  }

  let {
    rendererComponent = null,
    mediaSource = null,
    accompanyingSource = null,
    captionTracks = [],
    startTime = null,
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
    annotationMode = 'edit',
    annotationTool = 'select',
    canvasId = null,
    editableRectAnnotationId = null,
    onannotationcreate = undefined,
    onannotationupdate = undefined,
    onannotationtoolchange = undefined,
    layoutMode = 'single',
    activeLayoutImages = []
  }: Props = $props();
  const viewportState = getContext<ViewportState | undefined>(VIEWPORT_STATE_CONTEXT_KEY);
  let effectiveCanvasId = $derived(canvasId ?? viewportState?.manifestId ?? null);
  let useConstrainedMedia = $derived(
    constrainMediaHeight && !fillHeight && mediaType !== 'video',
  );
  let isFixedStage = $derived(
    !fillHeight && (!mediaSource || mediaType !== 'video') && !useConstrainedMedia,
  );
  let dockInline = $derived(!fillHeight && mediaType === 'audio' && !accompanyingSource);
  let useRendererNativeAnnotationLayer = $derived(mediaType === 'image' || mediaType === 'audio');

  let rendererInstance: any = $state(null);
  let mediaBounds: HTMLDivElement | null = $state(null);
  let stageWidth = $state(0);
  let stageHeight = $state(0);
  let stageViewBox = $state<ViewBox | null>(null);
  let pendingModelPose: ModelPose | null = $state(null);
  let pendingModelPoseOptions: ModelPoseOptions = $state({});
  const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

  export const getViewBox = (): ViewBox | null =>
    rendererInstance?.getViewBox?.() ?? null;

  export const setViewBox = (box: ViewBox): void => {
    rendererInstance?.setViewBox?.(box);
  };

  export const zoomBy = (factor: number): void => {
    rendererInstance?.zoomBy?.(factor);
  };

  export const goHome = (): void => {
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
    rendererInstance?.getCameraOrbit?.() ??
    pendingModelPose?.cameraOrbit ??
    null;

  export const getModelTarget = (): string | null =>
    rendererInstance?.getCameraTarget?.() ??
    pendingModelPose?.cameraTarget ??
    null;

  export const getModelOrientation = (): string | null =>
    rendererInstance?.getOrientation?.() ??
    pendingModelPose?.orientation ??
    null;

  export const getModelPose = (): ModelPose | null =>
    rendererInstance?.getModelPose?.() ?? pendingModelPose ?? null;

  const handleStageKeydown = (event: KeyboardEvent) => {
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

  const handleRendererZoomChange = (payload: { zoom: number; viewBox: ViewBox }) => {
    stageViewBox = payload.viewBox;
    onzoomchange?.(payload);
  };

  const toCanvasX = (screenX: number): number =>
    stageViewBox ? stageViewBox.x + (screenX / stageWidth) * stageViewBox.w : 0;
  const toCanvasY = (screenY: number): number =>
    stageViewBox ? stageViewBox.y + (screenY / stageHeight) * stageViewBox.h : 0;
  const toScreenX = (canvasX: number): number =>
    stageViewBox ? ((canvasX - stageViewBox.x) / stageViewBox.w) * stageWidth : 0;
  const toScreenY = (canvasY: number): number =>
    stageViewBox ? ((canvasY - stageViewBox.y) / stageViewBox.h) * stageHeight : 0;

  const normalizedRectFromCanvas = (rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): { x: number; y: number; w: number; h: number } | null => {
    if (
      !stageViewBox ||
      stageWidth <= 0 ||
      stageHeight <= 0 ||
      stageViewBox.w <= 0 ||
      stageViewBox.h <= 0
    ) {
      return null;
    }
    const x = toScreenX(rect.x) / stageWidth;
    const y = toScreenY(rect.y) / stageHeight;
    const w = rect.w / stageViewBox.w;
    const h = rect.h / stageViewBox.h;
    const clampedW = clamp(w, 0, 1);
    const clampedH = clamp(h, 0, 1);
    return {
      x: clamp(x, 0, 1 - clampedW),
      y: clamp(y, 0, 1 - clampedH),
      w: clampedW,
      h: clampedH,
    };
  };

  const canvasRectFromNormalized = (rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): { x: number; y: number; w: number; h: number } | null => {
    if (
      !stageViewBox ||
      stageWidth <= 0 ||
      stageHeight <= 0 ||
      stageViewBox.w <= 0 ||
      stageViewBox.h <= 0
    ) {
      return null;
    }
    const x1 = rect.x * stageWidth;
    const y1 = rect.y * stageHeight;
    const x2 = (rect.x + rect.w) * stageWidth;
    const y2 = (rect.y + rect.h) * stageHeight;
    const cx1 = toCanvasX(Math.min(x1, x2));
    const cy1 = toCanvasY(Math.min(y1, y2));
    const cx2 = toCanvasX(Math.max(x1, x2));
    const cy2 = toCanvasY(Math.max(y1, y2));
    return {
      x: cx1,
      y: cy1,
      w: Math.max(1, cx2 - cx1),
      h: Math.max(1, cy2 - cy1),
    };
  };

  $effect(() => {
    canZoom = Boolean(rendererInstance?.zoomBy);
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
    const observer = new ResizeObserver(() => {
      if (!mediaBounds) return;
      stageWidth = mediaBounds.clientWidth;
      stageHeight = mediaBounds.clientHeight;
    });
    observer.observe(mediaBounds);
    return () => observer.disconnect();
  });
  const projectedAnnotations = $derived(
    annotations
      .map((item) => resolvedToW3C(item, canvasId ?? ''))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => w3cToResolved(item))
      .filter((item): item is ResolvedAnnotation => Boolean(item))
  );
  const editableRectAnnotation = $derived.by(() => {
    if (annotationMode !== 'edit' || !editableRectAnnotationId) return null;
    const target = annotations.find((annotation) => annotation.id === editableRectAnnotationId);
    if (!target?.rect) return null;
    return {
      id: target.id,
      rect: target.rect,
    };
  });
  const editableRectValue = $derived(
    editableRectAnnotation ? normalizedRectFromCanvas(editableRectAnnotation.rect) : null,
  );

  const handleEditableRectChange = (rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null) => {
    if (!editableRectAnnotation || !rect) return;
    const canvasRect = canvasRectFromNormalized(rect);
    if (!canvasRect) return;
    onannotationupdate?.({
      id: editableRectAnnotation.id,
      patch: {
        rect: canvasRect,
      },
    });
  };
</script>

<svelte:window onkeydown={handleStageKeydown} />

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
        {showThumbnails}
        {showContents}
        {showSearch}
        {showMetadata}
        {showAnnotations}
        {showTools}
        {showLayers}
        on:panelToggle={(event) => onpaneltoggle?.(event.detail)}
      />
    </div>
  {/if}

  <div
    bind:this={mediaBounds}
    class:stage__media--fixed={isFixedStage}
    class:stage__media--constrained={useConstrainedMedia}
    class:stage__media--fill={fillHeight}
    class="stage__media"
    role="application"
    aria-label={$t('viewer.stage.label') ?? 'Viewer stage'}
  >
    {#if isFetching}
      <div class="stage__placeholder">{$t('viewer.stage.loading')}</div>
    {:else if error}
      <div class="stage__placeholder">{$t('viewer.stage.error')}</div>
    {:else if rendererComponent && mediaSource}
      <RendererHost
        bind:rendererInstance
        {rendererComponent}
        source={mediaSource}
        {accompanyingSource}
        {captionTracks}
        {startTime}
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
      />
    {:else}
      <div class="stage__placeholder">
        {$t('viewer.stage.empty')}
      </div>
    {/if}

    {#if !useRendererNativeAnnotationLayer}
      <AnnotationLayer
        annotations={projectedAnnotations}
        viewBox={stageViewBox}
        width={stageWidth}
        height={stageHeight}
        {activeAnnotationId}
        {hoverAnnotationId}
        on:annotationHover={(event) => rendererHandlers?.onAnnotationHover?.(event.detail)}
        on:annotationSelect={(event) => rendererHandlers?.onAnnotationSelect?.(event.detail)}
        on:annotationClear={() => rendererHandlers?.onAnnotationClear?.()}
      />
    {/if}

    <AnnotationEditorLayer
      enabled={annotationMode === 'create'}
      activeTool={annotationTool}
      viewBox={stageViewBox}
      width={stageWidth}
      height={stageHeight}
      canvasId={effectiveCanvasId}
      onannotationcreate={(payload) => onannotationcreate?.(payload)}
      ontoolchange={(payload) => onannotationtoolchange?.(payload)}
    />

    {#if editableRectAnnotation && editableRectValue}
      <div class="stage__rect-edit-layer">
        <RectanglePlacementEditor
          enabled={annotationMode === 'edit'}
          value={editableRectValue}
          minSize={0.0001}
          allowCreate={false}
          allowMove={true}
          allowResize={true}
          showHandles={true}
          passthrough={true}
          onrectchange={({ rect, source }) => {
            if (source === 'move' || source === 'resize') {
              handleEditableRectChange(rect);
            }
          }}
        />
      </div>
    {/if}

    {#if overlayPlugins.length > 0}
      <div class:stage__overlay--flush={fillHeight} class="stage__overlay">
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
    border-radius: 18px;
    overflow: hidden;
    background: var(--viewer-stage);
    position: relative;
    outline: none;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .stage__media--fixed {
    height: clamp(364px, 68vh, 676px);
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
    box-shadow: 0 0 0 3px rgba(42, 199, 255, 0.4);
  }

  .stage__placeholder {
    display: grid;
    place-items: center;
    height: 100%;
    padding: 16px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--viewer-muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
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

  .stage__rect-edit-layer {
    position: absolute;
    inset: 0;
    z-index: 6;
  }

  @container mango-viewer (max-width: 768px) {
    .stage__container {
      gap: 10px;
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
  }
</style>
