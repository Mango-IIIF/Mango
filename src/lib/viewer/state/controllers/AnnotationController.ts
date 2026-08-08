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
  applyPatch,
  projectToResolved,
  resolveAnnotationJson,
} from "../../../features/annotations/canonical";
import type { ViewerEventEmitter } from "../../../core/types/events";
import type { CanonicalStylesheet } from "@mango-iiif/w3c-parser";

/** Extra context an edit needs that the patch itself cannot carry. */
export type AnnotationPatchOptions = {
  /** Replaces the annotation's stylesheet, for a layer recolour. */
  stylesheet?: CanonicalStylesheet | null;
  language?: string;
  bodyPurpose?: string;
  textDirection?: string;
};

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
    options?: AnnotationPatchOptions,
  ) => Promise<void>;
  removeAnnotation: (annotationId: string) => Promise<void>;
  /** Replaces an annotation wholesale. For undo and redo. */
  replaceAnnotation: (
    annotationId: string,
    annotation: ResolvedAnnotation,
  ) => Promise<void>;
  /** Commits the edits already applied to an annotation as one save. */
  commitAnnotation: (annotationId: string) => Promise<void>;
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
      /*
       * Committing a draft is what stops it being one. Carrying `draft` into
       * the store left a saved annotation labelled "Draft" in the inspector
       * forever, which is precisely the state the badge exists to distinguish.
       */
      provenance:
        annotation.provenance === "draft"
          ? ("local" as const)
          : annotation.provenance,
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
      /*
       * Spread, not a field-by-field rebuild.
       *
       * A projection carries its canonical document, its provenance, and its
       * resolved style hints, and listing fields by hand silently dropped all
       * three the moment they were added. Two things broke: a saved annotation
       * lost the document it had to be exported losslessly from, and it stopped
       * being equal to the shape the editor already held — so every sync looked
       * like a real change and the editor never settled.
       */
      return {
        ...(annotation as ResolvedAnnotation),
        id: value.id ?? "",
        // Every path shape shares the `polygon` slot, so losing this turned a
        // committed freehand into a closed, filled polygon.
        shapeType: value.shapeType,
      };
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
      const { annotation: resolved } = resolveAnnotationJson(annotation, {
        provenance: "local",
      });
      return resolved;
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

  /**
   * Applies an edit through the annotation's canonical document.
   *
   * The projection is rebuilt from the patched document rather than merged over
   * the old one, so the two can never disagree. The previous version replaced
   * the whole `bodies` array with a single plain-text body whenever `text` was
   * patched, which discarded language, format, purpose, and every sibling body
   * the annotation had.
   *
   * An annotation with no canonical document — one that reached the store
   * before the model was adopted, or a host-supplied plain object — falls back
   * to a shallow merge. It cannot be edited losslessly because there is nothing
   * to be lossless about.
   */
  const patchAnnotation = (
    annotation: ResolvedAnnotation,
    patch: Partial<ResolvedAnnotation>,
    options: AnnotationPatchOptions = {},
  ): ResolvedAnnotation => {
    if (!annotation.document) return { ...annotation, ...patch };

    const { document, changed } = applyPatch(annotation.document, patch, options);
    if (!changed) return { ...annotation, ...patch };

    const projected = projectToResolved(document, {
      provenance: annotation.provenance,
    });
    return projected
      ? { ...projected, id: annotation.id, provenance: annotation.provenance }
      : { ...annotation, ...patch };
  };

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
    options: AnnotationPatchOptions = {},
  ): Promise<void> => {
    let owned = false;
    state.userAnnotations.update((current) => {
      const next: Record<string, ResolvedAnnotation[]> = {};
      for (const [key, items] of Object.entries(current)) {
        next[key] = items.map((item) => {
          if (item.id !== annotationId) return item;
          owned = true;
          return patchAnnotation(item, patch, options);
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
            patchAnnotation(source, patch, options),
          ]),
        );
      }
    }

    emitEvent("annotationUpdate", { annotationId, patch });
    emitStateChange();
  };

  /**
   * Commits an annotation's pending edits as one save.
   *
   * Separate from `updateAnnotation` because a save is not a change: edits are
   * already applied as they are made, and Save marks the transaction complete.
   * Sending an empty patch to mean "save" conflated the two, and the controller
   * then had to detect the empty patch and refuse to take ownership for it —
   * otherwise pressing Save on a manifest annotation copied it into the user's
   * own set without them having edited anything.
   */
  const commitAnnotation = async (annotationId: string): Promise<void> => {
    const annotation = resolveAnnotation(derivedStores, annotationId);
    if (!annotation) return;
    emitEvent("annotationSave", { annotationId, annotation });
    emitStateChange();
  };

  /**
   * Replaces an annotation wholesale, for undo and redo.
   *
   * Not `updateAnnotation`: that takes a patch and applies only the fields the
   * patch carries, so handing it a whole earlier annotation reverts nothing —
   * a field that was empty before the edit is `undefined` in the snapshot, and
   * `undefined` means "not mentioned" to a patch. Restoring a previous state
   * has to put the whole document back, including the canonical one.
   */
  const replaceAnnotation = async (
    annotationId: string,
    annotation: ResolvedAnnotation,
  ): Promise<void> => {
    const key = currentCanvasKey();
    let replaced = false;
    state.userAnnotations.update((current) => {
      const next: Record<string, ResolvedAnnotation[]> = {};
      for (const [canvasKey, items] of Object.entries(current)) {
        next[canvasKey] = items.map((item) => {
          if (item.id !== annotationId) return item;
          replaced = true;
          return annotation;
        });
      }
      // A manifest or external annotation being restored has no user copy yet,
      // so the restore creates the override the edit would have created.
      if (!replaced) {
        next[key] = [...(next[key] ?? []), annotation];
      }
      return next;
    });
    forgetRemoval(key, annotationId);
    emitEvent("annotationUpdate", { annotationId, patch: annotation });
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
    replaceAnnotation,
    commitAnnotation,
    setAnnotationMode,
    setSearchQuery,
    handleSearchResultClick,
  };
};
