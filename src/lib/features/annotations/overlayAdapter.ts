import '@mango-iiif/annotation/view.css';
import type { CanvasOverlayItem, OverlayStyle } from '@mango-iiif/annotation/view';
import { isOpenPathAnnotation, type ResolvedAnnotation } from '../../iiif/annotationResolver';

const LAYER_COLORS: Record<string, string> = {
  research: '#fb7185',
  transcription: '#60a5fa',
  highlights: '#34d399',
  mine: '#a78bfa',
};
const DEFAULT_LAYER_COLOR = '#a78bfa';
const DEFAULT_LAYER_FILL_OPACITY = 0.18;

const styleForLayerClass = (styleClass?: string): OverlayStyle => {
  const color = styleClass
    ? (LAYER_COLORS[styleClass] ?? DEFAULT_LAYER_COLOR)
    : DEFAULT_LAYER_COLOR;
  const r = parseInt(color.slice(1, 3), 16) || 0;
  const g = parseInt(color.slice(3, 5), 16) || 0;
  const b = parseInt(color.slice(5, 7), 16) || 0;
  return {
    strokeColor: color,
    fillColor: `rgba(${r}, ${g}, ${b}, ${DEFAULT_LAYER_FILL_OPACITY})`,
  };
};

const overlayStyleFor = (annotation: ResolvedAnnotation): OverlayStyle => {
  const hints = annotation.styleHints;
  if (hints) {
    const style: OverlayStyle = {
      ...(hints.strokeColor ? { strokeColor: hints.strokeColor } : {}),
      ...(hints.fillColor ? { fillColor: hints.fillColor } : {}),
      ...(hints.strokeWidth != null ? { strokeWidth: hints.strokeWidth } : {}),
      ...(hints.opacity != null ? { opacity: hints.opacity } : {}),
    };
    if (Object.keys(style).length > 0) return style;
  }
  if (annotation.targetStyle?.trim()) {
    return { raw: annotation.targetStyle.trim() };
  }
  return styleForLayerClass(annotation.targetStyleClass);
};

export interface OverlayStateOptions {
  highlightIds?: readonly string[];
  activeAnnotationId?: string | null;
  hoverAnnotationId?: string | null;
}

export const toCanvasOverlayItems = (
  annotations: readonly ResolvedAnnotation[],
  options: OverlayStateOptions = {},
): CanvasOverlayItem[] => {
  const highlightSet = new Set(options.highlightIds ?? []);
  return annotations
    .filter((annotation) => annotation.rect || annotation.point || annotation.polygon?.points?.length)
    .map((annotation) => ({
      id: annotation.id,
      rect: annotation.rect,
      point: annotation.point,
      polygon: annotation.polygon,
      openPath: isOpenPathAnnotation(annotation),
      label: annotation.label?.trim() || undefined,
      title: annotation.text,
      className: annotation.targetStyleClass,
      style: overlayStyleFor(annotation),
      isHighlight: highlightSet.has(annotation.id),
      isActive: annotation.id === options.activeAnnotationId,
      isHover: annotation.id === options.hoverAnnotationId,
    }));
};
