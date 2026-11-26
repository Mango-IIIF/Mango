<script lang="ts">
  import {
    AnnotationOverlay,
    projectOverlayItems,
    viewBoxProjector,
  } from '@mango-iiif/annotation/view';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import type { ViewBox } from '../../core/types/viewer';
  import { t } from '../../core/i18n';
  import { toCanvasOverlayItems } from './overlayAdapter';

  interface Props {
    annotations?: ResolvedAnnotation[];
    viewBox?: ViewBox | null;
    width?: number;
    height?: number;
    activeAnnotationId?: string | null;
    hoverAnnotationId?: string | null;
    highlightIds?: string[];
    onannotationHover?: (payload: { id: string | null }) => void;
    onannotationSelect?: (payload: { id: string }) => void;
    onannotationClear?: () => void;
  }

  let {
    annotations = [],
    viewBox = null,
    width = 0,
    height = 0,
    activeAnnotationId = null,
    hoverAnnotationId = null,
    highlightIds = [],
    onannotationHover = undefined,
    onannotationSelect = undefined,
    onannotationClear: _onannotationClear = undefined,
  }: Props = $props();

  let shapes = $derived.by(() => {
    if (!viewBox || width <= 1 || height <= 1) return [];
    const items = toCanvasOverlayItems(annotations, {
      highlightIds,
      activeAnnotationId,
      hoverAnnotationId,
    });
    return projectOverlayItems(items, viewBoxProjector(viewBox, width, height));
  });
</script>

<AnnotationOverlay
  {shapes}
  {width}
  {height}
  labelMode="svg"
  fallbackLabel={$t('viewer.panels.annotations.fallback')}
  onhover={(payload) => onannotationHover?.(payload)}
  onselect={(payload) => onannotationSelect?.(payload)}
/>
