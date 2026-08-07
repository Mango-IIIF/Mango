/**
 * AnnotationController
 *
 * Manages annotations including user annotations, external annotations,
 * annotation interactions (hover, select), and search functionality.
 */

import { get } from "svelte/store";
import type { ViewerStateStores } from "../viewerState";
import type { ViewerDerivedStores } from "../viewerDerived";
import type {
  AnnotationRect,
  AnnotationTime,
  ResolvedAnnotation,
} from "../../../iiif/annotationResolver";
import type { ViewBox } from "../../../core/types/viewer";
import { resolveAnnotationViewBox, padViewBox } from "../../annotations/focus";
import {
  w3cToResolved,
  type W3CAnnotation,
} from "../../../features/annotations/w3c";
import type { ViewerEventEmitter } from "../../../core/types/events";

export type AnnotationControllerConfig = {
  state: ViewerStateStores;
  derived: ViewerDerivedStores;
  emitEvent: ViewerEventEmitter;
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
  setAnnotationMode: (mode: "edit" | "create") => void;
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
  const currentCanvasKey = () =>
    resolveCanvasKey(getCanvasId(), getCanvasIndex());

  const forgetRemoval = (key: string, annotationId: string) => {
    state.removedAnnotationIds.update((current) => {
      const items = current[key] ?? [];
      return items.includes(annotationId)
        ? { ...current, [key]: items.filter((id) => id !== annotationId) }
        : current;
    });
  };

  const addAnnotationValue = (annotation: ResolvedAnnotation) => {
    const key = currentCanvasKey();
    const next = {
      ...annotation,
      id:
        annotation.id ||
        `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    };
    state.userAnnotations.update((current) => {
      const items = current[key] ?? [];
      const updated = updateRecord(current, key, [...items, next]);
      return updated;
    });
    // Re-adding an id that was deleted earlier has to lift its tombstone,
    // or the merge would filter the new annotation straight back out.
    forgetRemoval(key, next.id);
    emitEvent("addAnnotation", { annotation: next });
    emitEvent("annotationCreate", { annotation: next });
    emitStateChange();
  };

  const toResolvedAnnotation = (
    annotation: unknown,
  ): ResolvedAnnotation | null => {
    if (!annotation || typeof annotation !== "object") {
      return null;
    }
    const value = annotation as {
      id?: string;
      rect?: AnnotationRect;
      time?: AnnotationTime;
      point?: { x: number; y: number };
      polygon?: { points: Array<{ x: number; y: number }>; svg?: string };
      shapeType?: ResolvedAnnotation["shapeType"];
      text?: string;
      label?: string;
      notes?: string;
      tags?: string[];
      bodies?: ResolvedAnnotation["bodies"];
      motivation?: ResolvedAnnotation["motivation"];
      stylesheets?: ResolvedAnnotation["stylesheets"];
      targetStyleClass?: ResolvedAnnotation["targetStyleClass"];
      targetStyle?: ResolvedAnnotation["targetStyle"];
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      target?: unknown;
      body?: unknown;
    };
    if (value.rect || value.time || value.point || value.polygon) {
      const resolved = {
        id: value.id ?? "",
        rect: value.rect,
        time: value.time,
        point: value.point,
        polygon: value.polygon,
        // Every path shape shares the `polygon` slot, so dropping this here
        // turned a committed freehand into a closed, filled polygon.
        shapeType: value.shapeType,
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
      typeof value.x === "number" &&
      typeof value.y === "number" &&
      typeof value.w === "number" &&
      typeof value.h === "number"
    ) {
      const resolved = {
        id: value.id ?? "",
        rect: { x: value.x, y: value.y, w: value.w, h: value.h },
        shapeType: "rect" as const,
        text: value.text,
      };
      return resolved;
    }
    if (value.target && typeof value.target === "object") {
      const asW3C = value as unknown as W3CAnnotation;
      const resolved = w3cToResolved(asW3C);
      if (!resolved) {
        return null;
      }
      const bodyText =
        Array.isArray(asW3C.body) &&
        asW3C.body[0] &&
        typeof asW3C.body[0] === "object"
          ? ((asW3C.body[0] as { value?: string }).value ?? "")
          : "";
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
    /*
     * A manifest or external annotation cannot be taken out of its source, and
     * for an edited one the user copy is only an override — dropping it above
     * would have restored the unedited original rather than removed anything.
     * The tombstone is what actually deletes it, and it is harmless for
     * annotations that only ever lived in `userAnnotations`.
     */
    const key = currentCanvasKey();
    state.removedAnnotationIds.update((current) => {
      const items = current[key] ?? [];
      return items.includes(annotationId)
        ? current
        : { ...current, [key]: [...items, annotationId] };
    });
    emitEvent("removeAnnotation", { annotationId });
    emitEvent("annotationDelete", { annotationId });
    emitStateChange();
  };

  const setAnnotationMode = (mode: "edit" | "create") => {
    state.annotationMode.set(mode);
  };

  const patchAnnotation = (
    annotation: ResolvedAnnotation,
    patch: Partial<ResolvedAnnotation>,
  ): ResolvedAnnotation => ({
    ...annotation,
    ...patch,
    bodies:
      patch.text !== undefined
        ? [{ type: "text", value: patch.text }]
        : annotation.bodies,
  });

  // Shallow, so a patch carrying an equal-but-new rect or tags array still
  // counts as a change. Erring that way only costs a redundant write; erring
  // the other way would drop a real edit.
  const changesNothing = (
    annotation: ResolvedAnnotation,
    patch: Partial<ResolvedAnnotation>,
  ): boolean =>
    Object.entries(patch).every(([field, value]) =>
      Object.is(annotation[field as keyof ResolvedAnnotation], value),
    );

  const updateAnnotation = async (
    annotationId: string,
    patch: Partial<ResolvedAnnotation>,
  ): Promise<void> => {
    let owned = false;
    state.userAnnotations.update((current) => {
      const next: Record<string, ResolvedAnnotation[]> = {};
      for (const [key, items] of Object.entries(current)) {
        next[key] = items.map((item) => {
          if (item.id !== annotationId) return item;
          owned = true;
          return patchAnnotation(item, patch);
        });
      }
      return next;
    });

    /*
     * Manifest and external annotations are not ours to mutate: patching them
     * in place is thrown away the next time the derived list rebuilds from the
     * fetched IIIF, which is why editing a Wellcome OCR annotation used to
     * silently revert. Store the edit as a user annotation under the same id
     * instead and let `mergeCanvasAnnotations` prefer it. A patch that changes
     * nothing — the empty one an explicit Save sends — is not worth taking
     * ownership for, or every save would copy the source into the export.
     */
    if (!owned) {
      const source = resolveAnnotation(derivedStores, annotationId);
      if (source && !changesNothing(source, patch)) {
        const key = currentCanvasKey();
        state.userAnnotations.update((current) =>
          updateRecord(current, key, [
            ...(current[key] ?? []),
            patchAnnotation(source, patch),
          ]),
        );
      }
    }

    emitEvent("annotationUpdate", { annotationId, patch });
    emitStateChange();
  };

  const setSearchQuery = (value: string) => {
    state.selectedSearchResultId.set(null);
    state.searchQuery.set(value);
  };

  const handleSearchResultClick = (annotation: ResolvedAnnotation) => {
    const searchResult = annotation as ResolvedAnnotation & {
      canvasId?: string;
    };

    // Set the selected search result ID for highlighting in the sidebar
    state.selectedSearchResultId.set(searchResult.id);

    // Calculate the target viewBox for zooming
    let targetViewBox: ViewBox | null = null;
    if (searchResult.rect) {
      const currentViewBox = get(state.viewBox);
      const annotationViewBox = resolveAnnotationViewBox(
        searchResult,
        currentViewBox,
      );
      if (annotationViewBox) {
        targetViewBox = padViewBox(annotationViewBox, 0.15);
      }
    }

    // If the search result has canvasId metadata, navigate to that canvas
    if (searchResult.canvasId) {
      const currentCanvasId = get(derivedStores.canvases)[
        get(state.selectedCanvasIndex)
      ]?.id;
      const needsNavigation = currentCanvasId !== searchResult.canvasId;

      if (needsNavigation) {
        // Store the viewBox to apply after the canvas loads
        setPendingViewBox(targetViewBox);
        setCanvasById(searchResult.canvasId);
      } else if (targetViewBox) {
        // Same canvas, apply zoom immediately
        state.viewBox.set(targetViewBox);
        applyViewBox(targetViewBox);
        emitEvent("viewBoxChange", { viewBox: targetViewBox });
      }
    } else if (targetViewBox) {
      // No canvas change needed, apply zoom immediately
      state.viewBox.set(targetViewBox);
      applyViewBox(targetViewBox);
      emitEvent("viewBoxChange", { viewBox: targetViewBox });
    }

    // Select the annotation to highlight it
    if (searchResult.id) {
      // Small delay to ensure the annotation is available
      const ANNOTATION_SELECT_DELAY = 50;
      setTimeout(() => {
        state.activeAnnotationId.set(searchResult.id);
        emitEvent("annotationSelect", {
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
