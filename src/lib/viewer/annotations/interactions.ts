import { get } from 'svelte/store';
import type { ViewerEventMap } from '../../core/types/events';
import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
import type { ViewerDerivedStores } from '../state/viewerDerived';
import type { ViewerStateStores } from '../state/viewerState';

type EmitEvent = <K extends keyof ViewerEventMap>(
  event: K,
  payload: ViewerEventMap[K],
) => void;

const resolveAnnotation = (
  derivedStores: ViewerDerivedStores,
  id: string | null,
): ResolvedAnnotation | null => {
  if (!id) return null;
  const items = get(derivedStores.annotations);
  return items.find((annotation) => annotation.id === id) ?? null;
};

export const createAnnotationInteractionHandlers = ({
  state,
  derived: derivedStores,
  emitEvent,
}: {
  state: ViewerStateStores;
  derived: ViewerDerivedStores;
  emitEvent: EmitEvent;
}) => {
  const handleAnnotationHover = (detail: { id: string | null }) => {
    state.hoverAnnotationId.set(detail.id);
    emitEvent('annotationHover', {
      id: detail.id,
      annotation: resolveAnnotation(derivedStores, detail.id),
    });
  };

  const handleAnnotationSelect = (detail: { id: string; preventZoom?: boolean }) => {
    state.activeAnnotationId.set(detail.id);
    state.hoverAnnotationId.set(null);
    emitEvent('annotationSelect', {
      id: detail.id,
      annotation: resolveAnnotation(derivedStores, detail.id),
      preventZoom: detail.preventZoom,
    });
  };

  const handleAnnotationClear = () => {
    state.activeAnnotationId.set(null);
    state.hoverAnnotationId.set(null);
    emitEvent('annotationClear', undefined as void);
  };

  return {
    handleAnnotationHover,
    handleAnnotationSelect,
    handleAnnotationClear,
  };
};
