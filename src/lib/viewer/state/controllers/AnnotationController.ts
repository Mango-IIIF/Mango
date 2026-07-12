/**
 * AnnotationController
 *
 * Manages annotations including user annotations, external annotations,
 * annotation interactions (hover, select), and search functionality.
 */

import { get } from 'svelte/store';
import type { ViewerStateStores } from '../viewerState';
import type { ViewerDerivedStores } from '../viewerDerived';
import type {
  AnnotationRect,
  AnnotationTime,
  ResolvedAnnotation,
} from '../../../iiif/annotationResolver';
import type { ViewBox } from '../../../core/types/viewer';
import { resolveAnnotationViewBox, padViewBox } from '../../annotations/focus';
import {
  w3cToResolved,
  type W3CAnnotation,
} from '../../../features/annotations/w3c';

export type AnnotationControllerConfig = {
  state: ViewerStateStores;
  derived: ViewerDerivedStores;
  emitEvent: <K extends string>(event: K, payload: any) => void;
  emitStateChange: () => void;
  getCanvasId: () => string | null;
  getCanvasIndex: () => number;
  setCanvasById: (canvasId: string) => void;
  setPendingViewBox: (viewBox: ViewBox | null) => void;
  applyViewBox: (viewBox: ViewBox) => void;
};

export type AnnotationController = {
  addAnnotation: (annotation: unknown) => Promise<void>;
  updateAnnotation: (
    annotationId: string,
    patch: Partial<ResolvedAnnotation>,
  ) => Promise<void>;
  removeAnnotation: (annotationId: string) => Promise<void>;
  setAnnotationMode: (mode: 'edit' | 'create') => void;
  setSearchQuery: (value: string) => void;
  handleSearchResultClick: (annotation: ResolvedAnnotation) => void;
};

const resolveCanvasKey = (canvasId: string | null, index: number): string =>
  canvasId || `index-${index}`;

const updateRecord = (
  current: Record<string, ResolvedAnnotation[]>,
  key: string,
  value: ResolvedAnnotation[],
) => ({ ...current, [key]: value });

const resolveAnnotation = (
  derivedStores: ViewerDerivedStores,
  id: string | null,
): ResolvedAnnotation | null => {
  if (!id) return null;
  const items = get(derivedStores.annotations);
  return items.find((annotation) => annotation.id === id) ?? null;
};

export const createAnnotationController = ({
  state,
  derived: derivedStores,
  emitEvent,
  emitStateChange,
  getCanvasId,
  getCanvasIndex,
  setCanvasById,
  setPendingViewBox,
  applyViewBox,
}: AnnotationControllerConfig): AnnotationController => {
  const addAnnotationValue = (annotation: ResolvedAnnotation) => {
    const canvasId = getCanvasId();
    const key = resolveCanvasKey(canvasId, getCanvasIndex());
    const next = {
      ...annotation,
      id: annotation.id || `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    };
    state.userAnnotations.update((current) => {
      const items = current[key] ?? [];
      const updated = updateRecord(current, key, [...items, next]);
      return updated;
    });
    emitEvent('addAnnotation', { annotation: next });
    emitEvent('annotationCreate', { annotation: next });
    emitStateChange();
  };

  const toResolvedAnnotation = (annotation: unknown): ResolvedAnnotation | null => {
    if (!annotation || typeof annotation !== 'object') {
      return null;
    }
    const value = annotation as {
      id?: string;
      rect?: AnnotationRect;
      time?: AnnotationTime;
      point?: { x: number; y: number };
      polygon?: { points: Array<{ x: number; y: number }>; svg?: string };
      text?: string;
      label?: string;
      notes?: string;
      tags?: string[];
      bodies?: ResolvedAnnotation['bodies'];
      motivation?: ResolvedAnnotation['motivation'];
      stylesheets?: ResolvedAnnotation['stylesheets'];
      targetStyleClass?: ResolvedAnnotation['targetStyleClass'];
      targetStyle?: ResolvedAnnotation['targetStyle'];
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      target?: unknown;
      body?: unknown;
    };
    if (value.rect || value.time || value.point || value.polygon) {
      const resolved = {
        id: value.id ?? '',
        rect: value.rect,
        time: value.time,
        point: value.point,
        polygon: value.polygon,
        text: value.text,
        label: value.label,
        notes: value.notes,
        tags: value.tags,
        bodies: value.bodies,
        motivation: value.motivation,
        stylesheets: value.stylesheets,
        targetStyleClass: value.targetStyleClass,
        targetStyle: value.targetStyle,
      };
      return resolved;
    }
    if (
      typeof value.x === 'number' &&
      typeof value.y === 'number' &&
      typeof value.w === 'number' &&
      typeof value.h === 'number'
    ) {
      const resolved = {
        id: value.id ?? '',
        rect: { x: value.x, y: value.y, w: value.w, h: value.h },
        text: value.text,
      };
      return resolved;
    }
    if (value.target && typeof value.target === 'object') {
      const asW3C = value as unknown as W3CAnnotation;
      const resolved = w3cToResolved(asW3C);
      if (!resolved) {
        return null;
      }
      const bodyText =
        Array.isArray(asW3C.body) && asW3C.body[0] && typeof asW3C.body[0] === 'object'
          ? ((asW3C.body[0] as { value?: string }).value ?? '')
          : '';
      const finalResolved = {
        ...resolved,
        text: resolved.text ?? bodyText,
      };
      return finalResolved;
    }
    return null;
  };

  const addAnnotation = async (annotation: unknown): Promise<void> => {
    const resolved = toResolvedAnnotation(annotation);
    if (!resolved) return;
    addAnnotationValue(resolved);
  };

  const removeAnnotation = async (annotationId: string): Promise<void> => {
    state.userAnnotations.update((current) => {
      const next: Record<string, ResolvedAnnotation[]> = {};
      for (const [key, items] of Object.entries(current)) {
        next[key] = items.filter((item) => item.id !== annotationId);
      }
      return next;
    });
    emitEvent('removeAnnotation', { annotationId });
    emitEvent('annotationDelete', { annotationId });
    emitStateChange();
  };

  const setAnnotationMode = (mode: 'edit' | 'create') => {
    state.annotationMode.set(mode);
  };

  const updateAnnotation = async (
    annotationId: string,
    patch: Partial<ResolvedAnnotation>,
  ): Promise<void> => {
    state.userAnnotations.update((current) => {
      const next: Record<string, ResolvedAnnotation[]> = {};
      for (const [key, items] of Object.entries(current)) {
        next[key] = items.map((item) =>
          item.id === annotationId
            ? {
                ...item,
                ...patch,
                bodies:
                  patch.text !== undefined
                    ? [{ type: 'text', value: patch.text }]
                    : item.bodies,
              }
            : item,
        );
      }
      return next;
    });
    emitEvent('annotationUpdate', { annotationId, patch });
    emitStateChange();
  };

  const setSearchQuery = (value: string) => {
    state.selectedSearchResultId.set(null);
    state.searchQuery.set(value);
  };

  const handleSearchResultClick = (annotation: ResolvedAnnotation) => {
    const searchResult = annotation as ResolvedAnnotation & { canvasId?: string };

    // Set the selected search result ID for highlighting in the sidebar
    state.selectedSearchResultId.set(searchResult.id);

    // Calculate the target viewBox for zooming
    let targetViewBox: ViewBox | null = null;
    if (searchResult.rect) {
      const currentViewBox = get(state.viewBox);
      const annotationViewBox = resolveAnnotationViewBox(searchResult, currentViewBox);
      if (annotationViewBox) {
        targetViewBox = padViewBox(annotationViewBox, 0.15);
      }
    }

    // If the search result has canvasId metadata, navigate to that canvas
    if (searchResult.canvasId) {
      const currentCanvasId = get(derivedStores.canvases)[get(state.selectedCanvasIndex)]
        ?.id;
      const needsNavigation = currentCanvasId !== searchResult.canvasId;

      if (needsNavigation) {
        // Store the viewBox to apply after the canvas loads
        setPendingViewBox(targetViewBox);
        setCanvasById(searchResult.canvasId);
      } else if (targetViewBox) {
        // Same canvas, apply zoom immediately
        state.viewBox.set(targetViewBox);
        applyViewBox(targetViewBox);
        emitEvent('viewBoxChange', { viewBox: targetViewBox });
      }
    } else if (targetViewBox) {
      // No canvas change needed, apply zoom immediately
      state.viewBox.set(targetViewBox);
      applyViewBox(targetViewBox);
      emitEvent('viewBoxChange', { viewBox: targetViewBox });
    }

    // Select the annotation to highlight it
    if (searchResult.id) {
      // Small delay to ensure the annotation is available
      const ANNOTATION_SELECT_DELAY = 50;
      setTimeout(() => {
        state.activeAnnotationId.set(searchResult.id);
        emitEvent('annotationSelect', {
          id: searchResult.id,
          annotation: resolveAnnotation(derivedStores, searchResult.id),
        });
      }, ANNOTATION_SELECT_DELAY);
    }
  };

  return {
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    setAnnotationMode,
    setSearchQuery,
    handleSearchResultClick,
  };
};
