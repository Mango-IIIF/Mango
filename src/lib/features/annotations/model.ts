/**
 * Mango-owned state about an annotation, as distinct from the annotation.
 *
 * Where a document came from, whether this user may change it, and how far
 * Mango's editor can represent it are all application questions the W3C model
 * has no opinion on. They live here rather than on the canonical document so
 * that serializing never has to decide whether to write them out — it cannot,
 * because they are not there.
 */

/** Where an annotation came from, and what changing it would mean. */
export type AnnotationProvenance =
  /** Embedded in the IIIF Manifest. Not ours; editing produces an override. */
  | 'manifest'
  /** Fetched from an external AnnotationPage. Also not ours. */
  | 'external'
  /** Authored here and never sent anywhere. */
  | 'local'
  /** A local edit that shadows a manifest or external annotation. */
  | 'override'
  /** Being authored right now; not yet committed to the local set. */
  | 'draft'
  /** Committed through the repository and acknowledged by the host. */
  | 'persisted';

/** Whether Mango's editor can represent this annotation's geometry. */
export type AnnotationEditability =
  /** Fully representable: the shape can be drawn, moved, and written back. */
  | 'editable'
  /** Renderable but not editable — geometry Mango can draw and not reproduce. */
  | 'render-only'
  /** Neither renderable nor editable, but preserved and exportable verbatim. */
  | 'unsupported';

/** Provenances whose source document belongs to someone else. */
const FOREIGN: readonly AnnotationProvenance[] = ['manifest', 'external'];

export const isForeign = (provenance: AnnotationProvenance | undefined): boolean =>
  Boolean(provenance && FOREIGN.includes(provenance));

export const isOwned = (provenance: AnnotationProvenance | undefined): boolean =>
  provenance === 'local' || provenance === 'override' || provenance === 'draft' ||
  provenance === 'persisted';

/** Lifecycle of a save, kept separate from provenance so both can be shown. */
export type AnnotationSaveState =
  | { status: 'clean' }
  | { status: 'dirty' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'failed'; message: string }
  | { status: 'conflicted'; message: string };
