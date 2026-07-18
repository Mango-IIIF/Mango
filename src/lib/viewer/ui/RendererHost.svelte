<script lang="ts">
  import { DEFAULT_IMAGE_FILTERS, type ImageFilters } from '../../core/types/filters';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import type { MediaSource, MediaType } from '../../iiif/mediaResolver';
  import type { AVPlayerController } from '@mango-iiif/av/core';
  import type { ViewBox } from '../../core/types/viewer';
  import type { RendererEventHandlers } from '../types/rendererEvents';
  import type { ViewerConfig } from '../../core/types/config';
  import type { ActiveLayoutImage, RendererComponent, RendererInstance } from '../../core/types/renderer';
  import type { ModelViewChange } from '../../core/types/events';

  interface Props {
    rendererComponent?: RendererComponent | null;
    avController?: AVPlayerController;
    source?: MediaSource | null;
    annotations?: ResolvedAnnotation[];
    highlightIds?: string[];
    activeAnnotationId?: string | null;
    hoverAnnotationId?: string | null;
    imageFilters?: ImageFilters;
    mediaType?: MediaType | null;
    viewerConfig?: ViewerConfig;
    rendererHandlers?: RendererEventHandlers | null;
    rotation?: number;
    initialViewBox?: ViewBox | null;
    onviewboxchange?: ((payload: { viewBox: ViewBox }) => void) | undefined;
    onzoomchange?:
      | ((payload: { zoom: number; viewBox: ViewBox; homeZoom?: number }) => void)
      | undefined;
    onrotationchange?: ((payload: { rotation: number }) => void) | undefined;
    onviewerready?: ((payload: { viewer: unknown }) => void) | undefined;
    layers?: MediaSource[];
    layerOpacities?: Record<string, number>;
    layoutMode?: 'single' | 'two-page' | 'continuous';
    activeLayoutImages?: ActiveLayoutImage[];
    rendererInstance?: RendererInstance | null;
  }

  let {
    rendererComponent = null,
    avController = undefined,
    source = null,
    annotations = [],
    highlightIds = [],
    activeAnnotationId = null,
    hoverAnnotationId = null,
    imageFilters = { ...DEFAULT_IMAGE_FILTERS },
    mediaType = null,
    viewerConfig = {},
    rendererHandlers = null,
    rotation = 0,
    initialViewBox = null,
    onviewboxchange = undefined,
    onzoomchange = undefined,
    onrotationchange = undefined,
    onviewerready = undefined,
    layers = [],
    layerOpacities = {},
    layoutMode = 'single',
    activeLayoutImages = [],
    rendererInstance = $bindable(null),
  }: Props = $props();

  const handleMediaPlay = (detail: { time: number }) => {
    rendererHandlers?.onMediaPlay?.(detail);
  };

  const handleMediaPause = (detail: { time: number }) => {
    rendererHandlers?.onMediaPause?.(detail);
  };

  const handleMediaTimeUpdate = (detail: { time: number; duration?: number }) => {
    rendererHandlers?.onMediaTimeUpdate?.(detail);
  };

  const handleMediaSeek = (detail: { from: number; to: number }) => {
    rendererHandlers?.onMediaSeek?.(detail);
  };

  const handleMediaSegmentEnd = () => {
    rendererHandlers?.onMediaSegmentEnd?.();
  };

  const handleAnnotationHover = (detail: { id: string | null }) => {
    rendererHandlers?.onAnnotationHover?.(detail);
  };

  const handleAnnotationSelect = (detail: { id: string }) => {
    rendererHandlers?.onAnnotationSelect?.(detail);
  };

  const handleAnnotationClear = () => {
    rendererHandlers?.onAnnotationClear?.();
  };

  const handleModelChange = (detail: ModelViewChange) => {
    rendererHandlers?.onModelChange?.(detail);
  };

  $effect(() => {
    if (rendererInstance?.setImageFilters) {
      if (mediaType === 'image') {
        rendererInstance.setImageFilters(imageFilters);
      } else {
        rendererInstance.setImageFilters(DEFAULT_IMAGE_FILTERS);
      }
    }
  });

  $effect(() => {
    if (rendererInstance?.setRotation && mediaType === 'image') {
      rendererInstance.setRotation(rotation);
    }
  });
</script>

{#if rendererComponent && source}
  {@const Renderer = rendererComponent}
  <Renderer
    bind:this={rendererInstance}
    controller={avController}
    source={source}
    {annotations}
    {highlightIds}
    {activeAnnotationId}
    {hoverAnnotationId}
    {rotation}
    {initialViewBox}
    {layers}
    {layerOpacities}
    {layoutMode}
    {activeLayoutImages}
    osdConfig={viewerConfig.osdConfig}
    legacyOsdConfig={viewerConfig.osd}
    modelConfig={viewerConfig.modelConfig}
    initialPage={viewerConfig.pdf?.page}
    onviewboxchange={onviewboxchange}
    onviewBoxChange={onviewboxchange}
    onzoomchange={onzoomchange}
    onzoomChange={onzoomchange}
    onrotationchange={onrotationchange}
    onrotationChange={onrotationchange}
    onviewerready={onviewerready}
    onmediaplay={handleMediaPlay}
    onmediapause={handleMediaPause}
    onmediatimeupdate={handleMediaTimeUpdate}
    onmediaseek={handleMediaSeek}
    onmediasegmentend={handleMediaSegmentEnd}
    onmodelchange={handleModelChange}
    onannotationhover={handleAnnotationHover}
    onannotationHover={handleAnnotationHover}
    onannotationselect={handleAnnotationSelect}
    onannotationSelect={handleAnnotationSelect}
    onannotationclear={handleAnnotationClear}
    onannotationClear={handleAnnotationClear}
  />
{/if}
