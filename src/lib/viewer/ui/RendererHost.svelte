<script lang="ts">
  import { DEFAULT_IMAGE_FILTERS, type ImageFilters } from '../../core/types/filters';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import type { MediaSource, MediaType } from '../../iiif/mediaResolver';
  import type { MediaTextTrack } from '../../iiif/avResolver';
  import type { ViewBox } from '../../core/types/viewer';
  import type { RendererEventHandlers } from '../types/rendererEvents';

  export let rendererComponent: any = null;
  export let source: MediaSource | null = null;
  export let accompanyingSource: MediaSource | null = null;
  export let captionTracks: MediaTextTrack[] = [];
  export let startTime: number | null = null;
  export let annotations: ResolvedAnnotation[] = [];
  export let highlightIds: string[] = [];
  export let activeAnnotationId: string | null = null;
  export let hoverAnnotationId: string | null = null;
  export let imageFilters: ImageFilters;
  export let mediaType: MediaType | null = null;
  export let rendererHandlers: RendererEventHandlers | null = null;
  export let rotation: number = 0;
  export let initialViewBox: ViewBox | null = null;
  export let onviewboxchange: ((payload: { viewBox: ViewBox }) => void) | undefined = undefined;
  export let onzoomchange: ((payload: { zoom: number; viewBox: ViewBox }) => void) | undefined = undefined;
  export let onrotationchange: ((payload: { rotation: number }) => void) | undefined = undefined;
  export let layers: MediaSource[] = [];
  export let layerOpacities: Record<string, number> = {};
  export let layoutMode: 'single' | 'two-page' | 'continuous' = 'single';
  export let activeLayoutImages: any[] = [];

  export let rendererInstance: any = null;

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

  const handleModelChange = (detail: any) => {
    rendererHandlers?.onModelChange?.(detail);
  };

  $: if (rendererInstance?.setImageFilters) {
    if (mediaType === 'image') {
      rendererInstance.setImageFilters(imageFilters);
    } else {
      rendererInstance.setImageFilters(DEFAULT_IMAGE_FILTERS);
    }
  }

  $: if (rendererInstance?.setRotation && mediaType === 'image') {
    rendererInstance.setRotation(rotation);
  }
</script>

{#if rendererComponent && source}
  <svelte:component
    this={rendererComponent}
    bind:this={rendererInstance}
    source={source}
    {accompanyingSource}
    {captionTracks}
    {startTime}
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
    onviewboxchange={onviewboxchange}
    onzoomchange={onzoomchange}
    onrotationchange={onrotationchange}
    onmediaplay={handleMediaPlay}
    onmediapause={handleMediaPause}
    onmediatimeupdate={handleMediaTimeUpdate}
    onmediaseek={handleMediaSeek}
    onmodelchange={handleModelChange}
    onannotationhover={handleAnnotationHover}
    onannotationselect={handleAnnotationSelect}
    onannotationclear={handleAnnotationClear}
    on:viewBoxChange={(event) => onviewboxchange?.(event.detail)}
    on:zoomChange={(event) => onzoomchange?.(event.detail)}
    on:rotationChange={(event) => onrotationchange?.(event.detail)}
    on:mediaPlay={(event) => handleMediaPlay(event.detail)}
    on:mediaPause={(event) => handleMediaPause(event.detail)}
    on:mediaTimeUpdate={(event) => handleMediaTimeUpdate(event.detail)}
    on:mediaSeek={(event) => handleMediaSeek(event.detail)}
    on:mediaSegmentEnd={handleMediaSegmentEnd}
    on:annotationHover={(event) => handleAnnotationHover(event.detail)}
    on:annotationSelect={(event) => handleAnnotationSelect(event.detail)}
    on:annotationClear={handleAnnotationClear}
    on:modelChange={(event) => handleModelChange(event.detail)}
  />
{/if}
