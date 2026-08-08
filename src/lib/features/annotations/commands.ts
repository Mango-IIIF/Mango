/**
 * One undo stack for two kinds of change.
 *
 * Geometry history belongs to the canvas package, which is the only thing that
 * knows a hundred pointer samples are one drag. Metadata history — text, tags,
 * motivation, layer, notes — belongs to Mango, which is the only thing that
 * knows what a tag is. Neither can own the whole stack, and a user pressing
 * undo does not care which of the two they are undoing: they want the last
 * thing they did reversed, in order.
 *
 * So Mango keeps the ordering and delegates the geometry steps. Each entry
 * either carries a metadata change to invert, or is a marker saying "the next
 * step down is the canvas package's".
 */

import type { ResolvedAnnotation } from '../../iiif/annotationResolver';

/** Something that can undo and redo its own geometry steps. */
export type GeometryHistory = {
  undo(): boolean;
  redo(): boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
};

export type MetadataChange = {
  kind: 'metadata';
  annotationId: string;
  /** The annotation as it was. Null when the entry created it. */
  before: ResolvedAnnotation | null;
  /** The annotation as it became. Null when the entry deleted it. */
  after: ResolvedAnnotation | null;
  /** Names the step for an announcement, e.g. "tags" or "text". */
  label: string;
  /** Internal coalescing boundary for continuous text input. */
  recordedAt?: number;
};

/**
 * A geometry step recorded by the canvas package.
 *
 * Carries no payload: reversing it means asking the editor to undo, and holding
 * a copy of the geometry here would be a second source of truth that drifts the
 * first time the editor coalesces differently than expected.
 */
export type GeometryMarker = {
  kind: 'geometry';
  annotationId: string;
  label: string;
};

export type CommandEntry = MetadataChange | GeometryMarker;

export type CommandStackOptions = {
  limit?: number;
  /** Applies a metadata state. Called for both undo and redo. */
  apply: (annotationId: string, annotation: ResolvedAnnotation | null) => void;
  geometry?: () => GeometryHistory | null;
  onChange?: (state: CommandStackState) => void;
};

export type CommandStackState = {
  canUndo: boolean;
  canRedo: boolean;
  /** What undo would reverse, for an announcement or a tooltip. */
  undoLabel?: string;
  redoLabel?: string;
};

const DEFAULT_LIMIT = 100;
const TEXT_INPUT_WINDOW_MS = 1_000;
const COALESCED_LABELS = new Set(['text', 'label', 'notes']);

export type CommandStack = {
  /** Records a metadata change. */
  record(change: Omit<MetadataChange, 'kind'>): void;
  /** Records that the canvas package committed a geometry step. */
  recordGeometry(annotationId: string, label: string): void;
  undo(): boolean;
  redo(): boolean;
  clear(): void;
  state(): CommandStackState;
};

export const createCommandStack = (options: CommandStackOptions): CommandStack => {
  const limit = options.limit ?? DEFAULT_LIMIT;
  let undoStack: CommandEntry[] = [];
  let redoStack: CommandEntry[] = [];
  /*
   * Applying an undo re-enters the same handlers that record changes, so
   * without this an undo would record itself as a new entry and the stack would
   * never empty — press undo twice and you are back where you started.
   */
  let applying = false;

  const state = (): CommandStackState => ({
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack[undoStack.length - 1]?.label,
    redoLabel: redoStack[redoStack.length - 1]?.label,
  });

  const notify = () => options.onChange?.(state());

  const push = (entry: CommandEntry) => {
    if (applying) return;
    undoStack = [...undoStack, entry].slice(-limit);
    // A new action makes the redo branch unreachable. Keeping it would let a
    // user redo their way into a state that never existed.
    redoStack = [];
    notify();
  };

  return {
    record(change) {
      const recordedAt = Date.now();
      const previous = undoStack[undoStack.length - 1];
      if (
        !applying &&
        previous?.kind === 'metadata' &&
        previous.annotationId === change.annotationId &&
        previous.label === change.label &&
        COALESCED_LABELS.has(change.label) &&
        previous.after === change.before &&
        recordedAt - (previous.recordedAt ?? 0) <= TEXT_INPUT_WINDOW_MS
      ) {
        undoStack = [
          ...undoStack.slice(0, -1),
          { ...previous, after: change.after, recordedAt },
        ];
        redoStack = [];
        notify();
        return;
      }
      push({ ...change, kind: 'metadata', recordedAt });
    },

    recordGeometry(annotationId, label) {
      push({ kind: 'geometry', annotationId, label });
    },

    undo() {
      const entry = undoStack[undoStack.length - 1];
      if (!entry) return false;

      applying = true;
      try {
        if (entry.kind === 'geometry') {
          const history = options.geometry?.();
          // The editor is gone — a different canvas, or the layer torn down.
          // Dropping the entry is right: there is nothing left to reverse.
          if (!history?.undo()) {
            undoStack = undoStack.slice(0, -1);
            notify();
            return false;
          }
        } else {
          options.apply(entry.annotationId, entry.before);
        }
      } finally {
        applying = false;
      }

      undoStack = undoStack.slice(0, -1);
      redoStack = [...redoStack, entry];
      notify();
      return true;
    },

    redo() {
      const entry = redoStack[redoStack.length - 1];
      if (!entry) return false;

      applying = true;
      try {
        if (entry.kind === 'geometry') {
          const history = options.geometry?.();
          if (!history?.redo()) {
            redoStack = redoStack.slice(0, -1);
            notify();
            return false;
          }
        } else {
          options.apply(entry.annotationId, entry.after);
        }
      } finally {
        applying = false;
      }

      redoStack = redoStack.slice(0, -1);
      undoStack = [...undoStack, entry];
      notify();
      return true;
    },

    clear() {
      undoStack = [];
      redoStack = [];
      notify();
    },

    state,
  };
};

/** Names the field a patch touched, for the undo announcement. */
export const labelForPatch = (patch: Partial<ResolvedAnnotation>): string => {
  if (patch.text !== undefined) return 'text';
  if (patch.tags !== undefined) return 'tags';
  if (patch.label !== undefined) return 'label';
  if (patch.notes !== undefined) return 'notes';
  if (patch.motivation !== undefined) return 'motivation';
  if (patch.targetStyleClass !== undefined) return 'layer';
  if (patch.rect || patch.point || patch.polygon) return 'geometry';
  return 'annotation';
};
