<script lang="ts">
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import type { ViewBox } from '../../core/types/viewer';

  interface Props {
    annotations?: ResolvedAnnotation[];
    viewBox?: ViewBox | null;
    width?: number;
    height?: number;
    activeAnnotationId?: string | null;
    hoverAnnotationId?: string | null;
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
    onannotationHover = undefined,
    onannotationSelect = undefined,
    onannotationClear: _onannotationClear = undefined,
  }: Props = $props();

  const projectX = (canvasX: number) =>
    ((canvasX - (viewBox?.x ?? 0)) / (viewBox?.w ?? 1)) * width;
  const projectY = (canvasY: number) =>
    ((canvasY - (viewBox?.y ?? 0)) / (viewBox?.h ?? 1)) * height;
  const projectWidth = (canvasW: number) => (canvasW / (viewBox?.w ?? 1)) * width;
  const projectHeight = (canvasH: number) => (canvasH / (viewBox?.h ?? 1)) * height;

  const pointsToPolyline = (points: Array<{ x: number; y: number }>) =>
    points.map((p) => `${projectX(p.x)},${projectY(p.y)}`).join(' ');

  const LAYER_COLORS: Record<string, string> = {
    research: '#facc15',
    transcription: '#60a5fa',
    highlights: '#34d399',
    mine: '#a78bfa',
  };
  const DEFAULT_LAYER_COLOR = '#a78bfa';
  const DEFAULT_LAYER_FILL_OPACITY = 0.18;

  const styleForLayerClass = (styleClass?: string): string => {
    const color = styleClass
      ? (LAYER_COLORS[styleClass] ?? DEFAULT_LAYER_COLOR)
      : DEFAULT_LAYER_COLOR;
    const r = parseInt(color.slice(1, 3), 16) || 0;
    const g = parseInt(color.slice(3, 5), 16) || 0;
    const b = parseInt(color.slice(5, 7), 16) || 0;
    return `stroke: ${color}; fill: rgba(${r}, ${g}, ${b}, ${DEFAULT_LAYER_FILL_OPACITY});`;
  };

  const annotationStyle = (annotation: ResolvedAnnotation): string =>
    annotation.targetStyle?.trim() || styleForLayerClass(annotation.targetStyleClass);

  const annotationLabel = (annotation: ResolvedAnnotation): string =>
    annotation.label?.trim() || '';

  const annotationAccessibleName = (annotation: ResolvedAnnotation): string =>
    annotationLabel(annotation) || 'Annotation';

  const selectAnnotation = (id: string) => {
    onannotationSelect?.({ id });
  };

  const handleAnnotationKeydown = (event: KeyboardEvent, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    selectAnnotation(id);
  };

  const polygonLabelPosition = (
    points: Array<{ x: number; y: number }>,
  ): { x: number; y: number } => {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const maxY = Math.max(...ys);
    return {
      x: projectX(centerX),
      y: projectY(maxY) + 14,
    };
  };
</script>

{#if viewBox && width > 1 && height > 1}
  <svg class="annotation-layer" {width} {height} viewBox={`0 0 ${width} ${height}`}>
    {#each annotations as annotation (annotation.id)}
      {#if annotation.rect}
        <rect
          class="annotation-layer__shape"
          class:annotation-layer__shape--active={annotation.id === activeAnnotationId}
          class:annotation-layer__shape--hover={annotation.id === hoverAnnotationId}
          x={projectX(annotation.rect.x)}
          y={projectY(annotation.rect.y)}
          width={projectWidth(annotation.rect.w)}
          height={projectHeight(annotation.rect.h)}
          style={annotationStyle(annotation)}
          role="button"
          tabindex="0"
          aria-label={annotationAccessibleName(annotation)}
          aria-pressed={annotation.id === activeAnnotationId}
          onmouseenter={() => onannotationHover?.({ id: annotation.id })}
          onmouseleave={() => onannotationHover?.({ id: null })}
          onclick={(event) => { event.stopPropagation(); selectAnnotation(annotation.id); }}
          onkeydown={(event) => handleAnnotationKeydown(event, annotation.id)}
        />
        {#if annotationLabel(annotation)}
          <text
            class="annotation-layer__label"
            x={projectX(annotation.rect.x + annotation.rect.w / 2)}
            y={projectY(annotation.rect.y + annotation.rect.h) + 14}
          >
            {annotationLabel(annotation)}
          </text>
        {/if}
      {:else if annotation.polygon?.points?.length}
        {#if annotation.polygon.svg && (annotation.polygon.svg.includes('<polyline') || annotation.polygon.svg.includes('<line'))}
          <polyline
            class="annotation-layer__shape annotation-layer__shape--polyline"
            class:annotation-layer__shape--active={annotation.id === activeAnnotationId}
            class:annotation-layer__shape--hover={annotation.id === hoverAnnotationId}
            points={pointsToPolyline(annotation.polygon.points)}
            style={annotationStyle(annotation)}
            role="button"
            tabindex="0"
            aria-label={annotationAccessibleName(annotation)}
            aria-pressed={annotation.id === activeAnnotationId}
            onmouseenter={() => onannotationHover?.({ id: annotation.id })}
            onmouseleave={() => onannotationHover?.({ id: null })}
            onclick={(event) => { event.stopPropagation(); selectAnnotation(annotation.id); }}
            onkeydown={(event) => handleAnnotationKeydown(event, annotation.id)}
          />
          {#if annotationLabel(annotation)}
            {@const labelPos = polygonLabelPosition(annotation.polygon.points)}
            <text class="annotation-layer__label" x={labelPos.x} y={labelPos.y}>
              {annotationLabel(annotation)}
            </text>
          {/if}
        {:else}
          <polygon
            class="annotation-layer__shape"
            class:annotation-layer__shape--active={annotation.id === activeAnnotationId}
            class:annotation-layer__shape--hover={annotation.id === hoverAnnotationId}
            points={pointsToPolyline(annotation.polygon.points)}
            style={annotationStyle(annotation)}
            role="button"
            tabindex="0"
            aria-label={annotationAccessibleName(annotation)}
            aria-pressed={annotation.id === activeAnnotationId}
            onmouseenter={() => onannotationHover?.({ id: annotation.id })}
            onmouseleave={() => onannotationHover?.({ id: null })}
            onclick={(event) => { event.stopPropagation(); selectAnnotation(annotation.id); }}
            onkeydown={(event) => handleAnnotationKeydown(event, annotation.id)}
          />
          {#if annotationLabel(annotation)}
            {@const labelPos = polygonLabelPosition(annotation.polygon.points)}
            <text class="annotation-layer__label" x={labelPos.x} y={labelPos.y}>
              {annotationLabel(annotation)}
            </text>
          {/if}
        {/if}
      {:else if annotation.point}
        <circle
          class="annotation-layer__shape"
          class:annotation-layer__shape--active={annotation.id === activeAnnotationId}
          class:annotation-layer__shape--hover={annotation.id === hoverAnnotationId}
          cx={projectX(annotation.point.x)}
          cy={projectY(annotation.point.y)}
          r="6"
          style={annotationStyle(annotation)}
          role="button"
          tabindex="0"
          aria-label={annotationAccessibleName(annotation)}
          aria-pressed={annotation.id === activeAnnotationId}
          onmouseenter={() => onannotationHover?.({ id: annotation.id })}
          onmouseleave={() => onannotationHover?.({ id: null })}
          onclick={(event) => { event.stopPropagation(); selectAnnotation(annotation.id); }}
          onkeydown={(event) => handleAnnotationKeydown(event, annotation.id)}
        />
        {#if annotationLabel(annotation)}
          <text
            class="annotation-layer__label"
            x={projectX(annotation.point.x)}
            y={projectY(annotation.point.y) + 14}
          >
            {annotationLabel(annotation)}
          </text>
        {/if}
      {/if}
    {/each}
  </svg>
{/if}

<style>
  .annotation-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .annotation-layer__shape {
    fill: rgba(42, 199, 255, 0.18);
    stroke: rgba(42, 199, 255, 0.92);
    stroke-width: 2;
    cursor: pointer;
    pointer-events: auto;
  }

  .annotation-layer__shape--polyline {
    fill: none !important;
  }

  .annotation-layer__shape--hover {
    opacity: 0.95;
  }

  .annotation-layer__shape--active {
    stroke-width: 3;
  }

  .annotation-layer__label {
    font-size: 11px;
    fill: #f1f5f9;
    paint-order: stroke;
    stroke: rgba(10, 14, 20, 0.9);
    stroke-width: 3px;
    stroke-linejoin: round;
    text-anchor: middle;
    dominant-baseline: middle;
    pointer-events: none;
  }
</style>
