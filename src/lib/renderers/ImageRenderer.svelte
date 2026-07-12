<script lang="ts" module>
  import type { RendererCapabilities } from '../core/types/renderer';
  
  /**
   * ImageRenderer capabilities
   * Supports zoom, filters, pan, viewBox, rotation, and is interactive
   */
  export const capabilities: RendererCapabilities = {
    supportsZoom: true,
    supportsFilters: true,
    supportsPan: true,
    supportsViewBox: true,
    supportsRotation: true,
    isInteractive: true,
  };
</script>

<script lang="ts">
  import { t } from '../i18n';
  import type OpenSeadragon from 'openseadragon';
  import OSDViewer from './OSDViewer.svelte';
  import type { ResolvedAnnotation } from '../iiif/annotationResolver';
  import type { MediaSource, TileSource } from '../iiif/mediaResolver';
  import type { ImageFilters } from '../core/types/filters';
  import type { ViewBox } from '../core/types/viewer';
  import type { ViewerConfig } from '../core/types/config';

  interface Props {
    source?: MediaSource | null;
    layers?: MediaSource[];
    layerOpacities?: Record<string, number>;
    annotations?: ResolvedAnnotation[];
    highlightIds?: string[];
    activeAnnotationId?: string | null;
    hoverAnnotationId?: string | null;
    layoutMode?: 'single' | 'two-page' | 'continuous';
    activeLayoutImages?: any[];
    osdConfig?: Record<string, unknown>;
    legacyOsdConfig?: ViewerConfig['osd'];
    rotation?: number;
    initialViewBox?: ViewBox | null;
    onzoomChange?: (payload: { zoom: number; viewBox: ViewBox }) => void;
    onviewBoxChange?: (payload: { viewBox: ViewBox }) => void;
    onannotationHover?: (payload: { id: string | null }) => void;
    onannotationSelect?: (payload: { id: string }) => void;
    onannotationClear?: () => void;
    onrotationChange?: (payload: { rotation: number }) => void;
    onviewerready?: (payload: { viewer: OpenSeadragon.Viewer }) => void;
  }

  let {
    source = null,
    layers = [],
    layerOpacities = {},
    annotations = [],
    highlightIds = [],
    activeAnnotationId = null,
    hoverAnnotationId = null,
    layoutMode = 'single',
    activeLayoutImages = [],
    osdConfig = {},
    legacyOsdConfig = undefined,
    rotation = 0,
    initialViewBox = null,
    onzoomChange = undefined,
    onviewBoxChange = undefined,
    onannotationHover = undefined,
    onannotationSelect = undefined,
    onannotationClear = undefined,
    onrotationChange = undefined,
    onviewerready = undefined,
  }: Props = $props();

  let osd: any = $state(null);
  let tileSource: TileSource | null = $derived(toTileSource(source));

  const toTileSource = (media: MediaSource | null): TileSource | null => {
    if (!media) return null;
    if (media.src.endsWith('info.json')) return media.src;
    return { type: 'image', url: media.src };
  };

  export const getViewBox = (): ViewBox | null => {
    return osd?.getViewBox?.() ?? null;
  };

  export const setViewBox = (box: ViewBox): void => {
    osd?.setViewBox?.(box);
  };

  export const zoomBy = (factor: number): void => {
    osd?.zoomBy?.(factor);
  };

  export const goHome = (): void => {
    osd?.goHome?.();
  };

  export const rotateBy = (delta: number): void => {
    osd?.rotateBy?.(delta);
  };

  export const setRotation = (value: number): void => {
    osd?.setRotation?.(value);
  };

  export const setImageFilters = (filters: ImageFilters): void => {
    osd?.setFilters?.(filters);
  };

</script>

{#if tileSource}
  <OSDViewer
    bind:this={osd}
    {tileSource}
    {layers}
    {layerOpacities}
    {annotations}
    {highlightIds}
    {activeAnnotationId}
    {hoverAnnotationId}
    {layoutMode}
    {activeLayoutImages}
    {osdConfig}
    {legacyOsdConfig}
    {rotation}
    {initialViewBox}
    onviewboxchange={(detail) => onviewBoxChange?.(detail)}
    onzoomchange={(detail) => onzoomChange?.(detail)}
    onrotationchange={(detail) => onrotationChange?.(detail)}
    onannotationhover={(detail) => onannotationHover?.(detail)}
    onannotationselect={(detail) => onannotationSelect?.(detail)}
    onannotationclear={() => onannotationClear?.()}
    {onviewerready}
  />
{:else}
  <div class="image-placeholder">{$t('renderers.image.noSource')}</div>
{/if}

<style>
  .image-placeholder {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }
</style>
