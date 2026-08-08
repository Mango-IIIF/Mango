/**
 * The bridge between canonical annotation documents and Mango's editor.
 *
 * The rule this file exists to enforce: the canonical document is the truth,
 * and `ResolvedAnnotation` is a lens over it. Nothing here rebuilds a document
 * from a projection — edits are patch operations addressed at canonical paths,
 * so a body Mango does not display, a refined selector it cannot draw, and a
 * vendor extension it has never heard of all survive an edit to the text.
 *
 * That is the difference from the adapter this replaces, which serialized a
 * flattened value back over the top of the original and lost everything it had
 * not modelled.
 */

import {
  createAnnotation,
  createTarget,
  createTextualBody,
  createTaggingBody,
  htmlToText,
  parseWebAnnotation,
  parseWebAnnotationPage,
  patchAnnotation,
  projectAnnotation,
  refOf,
  repathAnnotation,
  removeBody,
  addBody,
  setBodyLanguage,
  setBodyTextDirection,
  setLabel,
  setMotivation,
  setStyleClass,
  setTargetGeometry,
  setTextualBodyValue,
  simplifyPathShape,
  stringLabel,
  type AnnotationProjection,
  type CanonicalAnnotation,
  type CanonicalAnnotationPage,
  type CanonicalResource,
  type CanonicalStylesheet,
  type Diagnostic,
  type NeutralShape,
  type PatchOperation,
  type TemporalFragment,
} from '@mango-iiif/w3c-parser';
import type {
  AnnotationBody,
  AnnotationPoint,
  ResolvedAnnotation,
} from '../../iiif/annotationResolver';
import type { ChapterAnnotationTool } from '../../core/types/story';
import type { AnnotationEditability, AnnotationProvenance } from './model';
import {
  DEFAULT_BODY_PURPOSE,
  DEFAULT_MOTIVATION,
  MANGO_NOTE_KEY,
  mintDraftId,
} from './profile';
import { hintsForStyleClass, hintsFromInlineStyle, type PresentationHints } from './style';
import { toPresentation3 } from './interop';

export type ProjectionPolicy = {
  /** Languages to prefer when an annotation carries text in several. */
  preferredLanguages?: readonly string[];
};

const DEFAULT_LANGUAGES = ['en'];

/**
 * Purposes whose bodies are display text rather than tags or metadata.
 *
 * Ordered: an annotation carrying both a transcription and a comment shows the
 * comment, because the comment is what the annotator wrote about the region and
 * the transcription is what was already there.
 */
const TEXT_PURPOSES = ['commenting', 'describing', 'transcribing', 'editing'];

/* ------------------------------------------------------------------------- */
/* Geometry                                                                   */
/* ------------------------------------------------------------------------- */

/** The editor tool that authors a given shape, or null when none does. */
export const shapeTool = (
  shape: NeutralShape,
): Exclude<ChapterAnnotationTool, 'select'> | null => {
  switch (shape.type) {
    case 'rect':
      return 'rectangle';
    case 'point':
      return 'point';
    case 'polygon':
      return 'polygon';
    case 'line':
      return 'line';
    case 'freehand':
      return 'freehand';
    default:
      return null;
  }
};

/**
 * Collapses a `path` projection to a shape the editor can hold.
 *
 * A single open subpath is a freehand stroke and a single closed one is a
 * polygon, which covers everything Annotorello- and Recogito-style clients
 * emit. Genuine multi-subpath geometry has no editor representation and is
 * reported as render-only rather than silently flattened into one stroke that
 * joins two separate marks together.
 */
const shapeFromPath = (shape: NeutralShape): { shape: NeutralShape; editable: boolean } => {
  if (shape.type !== 'path') return { shape, editable: true };
  const simplified = simplifyPathShape(shape.geometry);
  if (simplified.type !== 'path') return { shape: simplified, editable: true };
  return { shape, editable: false };
};

/** Geometry fields of a `ResolvedAnnotation`, from a neutral shape. */
const geometryFromShape = (
  shape: NeutralShape,
): Pick<ResolvedAnnotation, 'shapeType' | 'rect' | 'point' | 'polygon'> => {
  switch (shape.type) {
    case 'rect':
      return { shapeType: 'rect', rect: shape.geometry };
    case 'point':
      return { shapeType: 'point', point: shape.geometry };
    case 'polygon':
      return { shapeType: 'polygon', polygon: { points: shape.geometry.points } };
    case 'freehand':
      return { shapeType: 'freehand', polygon: { points: shape.geometry.points } };
    case 'line':
      return {
        shapeType: 'line',
        polygon: { points: [shape.geometry.start, shape.geometry.end] },
      };
    case 'path': {
      // Drawable but not editable: every subpath's points, so the shape is
      // visible, with `shapeType` left unset so nothing offers to edit it.
      const points = shape.geometry.subpaths.flatMap((subpath) => subpath.points);
      return points.length ? { polygon: { points } } : {};
    }
    default:
      return {};
  }
};

/**
 * The neutral shape a `ResolvedAnnotation`'s geometry describes.
 *
 * `shapeType` is authoritative because every path shape shares the `polygon`
 * slot and the slot alone cannot say whether the last point joins the first.
 */
export const shapeFromResolved = (
  annotation: Pick<ResolvedAnnotation, 'shapeType' | 'rect' | 'point' | 'polygon'>,
): NeutralShape => {
  if (annotation.rect) return { type: 'rect', geometry: annotation.rect };
  if (annotation.point) return { type: 'point', geometry: annotation.point };
  const points: AnnotationPoint[] = annotation.polygon?.points ?? [];
  if (!points.length) return { type: 'none' };
  if (annotation.shapeType === 'line' && points.length >= 2) {
    return {
      type: 'line',
      geometry: { start: points[0], end: points[points.length - 1] },
    };
  }
  if (annotation.shapeType === 'freehand') return { type: 'freehand', geometry: { points } };
  return { type: 'polygon', geometry: { points } };
};

/* ------------------------------------------------------------------------- */
/* Projection: canonical document to Mango's rendering view                    */
/* ------------------------------------------------------------------------- */

/**
 * Classifies a body for the list and the Canvas-content check.
 *
 * The canonical resource decides, not the projection: a projection reports text
 * and an image body has none, so classifying on the projection alone would file
 * every image as untyped and let a Presentation 2 painting annotation through as
 * an ordinary comment.
 */
const bodyFromProjection = (
  body: AnnotationProjection['bodies'][number],
  resource: CanonicalResource | undefined,
): AnnotationBody => {
  const isImage =
    Boolean(resource?.type.includes('Image')) || Boolean(body.format?.startsWith('image/'));
  return {
    type: isImage ? 'image' : body.isHtml ? 'html' : body.isExternal ? 'unknown' : 'text',
    ...(isImage ? { src: body.id } : { value: body.text }),
    format: body.format,
    language: body.language,
    purpose: body.purposes[0],
  };
};

/** Every body in the document, flattened, so a projection path can be resolved. */
const bodyByPath = (annotation: CanonicalAnnotation): Map<string, CanonicalResource> => {
  const index = new Map<string, CanonicalResource>();
  const visit = (resource: CanonicalResource) => {
    index.set(resource.path, resource);
    if (resource.source) visit(resource.source);
    for (const item of resource.items) visit(item);
  };
  for (const body of annotation.bodies) visit(body);
  return index;
};

/**
 * Projects a canonical annotation into the shape the renderer and list use.
 *
 * The projection carries `document` and `targetPath` so any consumer can get
 * back to the resource that produced a value in order to patch it. That back
 * reference is what makes this a lens rather than a copy.
 */
export const projectToResolved = (
  annotation: CanonicalAnnotation,
  options: {
    provenance?: AnnotationProvenance;
    canvasId?: string;
    policy?: ProjectionPolicy;
  } = {},
): ResolvedAnnotation | null => {
  const projection = projectAnnotation(annotation, {
    preferredLanguages: options.policy?.preferredLanguages ?? DEFAULT_LANGUAGES,
    bodyPurposes: TEXT_PURPOSES,
    untypedBodiesMatch: true,
  });

  // A target for another Canvas is not this Canvas's annotation. Matching on
  // the source rather than dropping the annotation entirely keeps multi-target
  // annotations usable: one of their targets may well be this Canvas.
  const target =
    projection.targets.find(
      (entry) => !options.canvasId || !entry.source || entry.source === options.canvasId,
    ) ?? projection.targets[0];
  if (!target) return null;

  const resolvedShape = shapeFromPath(target.shape);
  const geometry = geometryFromShape(resolvedShape.shape);

  // Carry the SvgSelector markup on the projection. Renderers no longer need it
  // to tell an open path from a closed one — `shapeType` says so — but keeping
  // it means a shape Mango cannot edit can still be described exactly.
  const canonicalTarget = annotation.targets.find((entry) => entry.path === target.path);
  const svg = canonicalTarget?.selectors.find(
    (selector) => selector.path === target.selectorPath && selector.kind === 'SvgSelector',
  )?.value;
  if (geometry.polygon && svg) geometry.polygon = { ...geometry.polygon, svg };

  const styleClass = target.styleClass;
  const style = hintsForStyleClass(annotation, styleClass);
  const inlineStyle =
    typeof annotation.targets[0]?.extensions?.style === 'string'
      ? (annotation.targets[0].extensions.style as string)
      : undefined;
  const styleHints: PresentationHints | undefined =
    style.hints ?? hintsFromInlineStyle(inlineStyle);

  const editability: AnnotationEditability = !resolvedShape.editable
    ? 'render-only'
    : resolvedShape.shape.type === 'none' && target.preservedSelectors.length > 0
      ? 'unsupported'
      : 'editable';

  const note = annotation.extensions[MANGO_NOTE_KEY];
  const bodies = bodyByPath(annotation);

  return {
    id: projection.id ?? mintDraftId(),
    ...geometry,
    time: target.temporal
      ? {
          start: target.temporal.start,
          end: Number.isFinite(target.temporal.end) ? target.temporal.end : undefined,
        }
      : undefined,
    /*
     * Tags stand in for display text when there is none. A tagging annotation
     * carries its whole content in bodies the text policy deliberately skips,
     * so without this the list shows a blank row for an annotation that plainly
     * says "manuscript".
     */
    text: projection.text || projection.tags.join(', ') || undefined,
    label: projection.label,
    notes: typeof note === 'string' ? note : undefined,
    tags: projection.tags,
    bodies: projection.bodies.map((body) => bodyFromProjection(body, bodies.get(body.path))),
    motivation: projection.motivations.length ? projection.motivations : undefined,
    stylesheets: annotation.stylesheets
      .filter((sheet) => sheet.isReference && sheet.id)
      .map((sheet) => sheet.id as string),
    targetStyleClass: styleClass,
    targetStyle: inlineStyle,
    styleHints,
    document: annotation,
    targetPath: target.path,
    selectorPath: target.selectorPath,
    provenance: options.provenance,
    editability,
    diagnostics: projection.diagnostics,
  };
};

/**
 * Normalises whatever a caller hands in before the parser sees it.
 *
 * Applied at the entry points rather than at one call site, because a host
 * passing a Presentation 2 annotation — or a bare string target carrying a
 * media fragment — reaches the model through `addAnnotation` and the repository
 * as well as through the manifest. Doing this in the IIIF resolver alone meant
 * those routes silently lost the region.
 */
const normalizeInput = (json: unknown): unknown => {
  if (Array.isArray(json)) return json.map(normalizeInput);
  if (!json || typeof json !== 'object') return json;
  const record = json as Record<string, unknown>;
  if (Array.isArray(record.items)) {
    return { ...record, items: record.items.map(normalizeInput) };
  }
  if (Array.isArray(record.resources)) {
    return { ...record, resources: record.resources.map(normalizeInput) };
  }
  return toPresentation3(record);
};

/** Parses one annotation and projects it, keeping the parser's diagnostics. */
export const resolveAnnotationJson = (
  json: unknown,
  options: {
    provenance?: AnnotationProvenance;
    canvasId?: string;
    policy?: ProjectionPolicy;
  } = {},
): { annotation: ResolvedAnnotation | null; diagnostics: Diagnostic[] } => {
  try {
    const { document, diagnostics } = parseWebAnnotation(normalizeInput(json));
    const annotation = projectToResolved(document, options);
    return {
      annotation,
      diagnostics: annotation ? [...diagnostics, ...(annotation.diagnostics ?? [])] : diagnostics,
    };
  } catch {
    // `AnnotationParseError` means the input cannot be represented at all —
    // not a document Mango can show, and not one it should invent a shape for.
    return { annotation: null, diagnostics: [] };
  }
};

/** Parses an AnnotationPage and projects every annotation on it. */
export const resolvePageJson = (
  json: unknown,
  options: {
    provenance?: AnnotationProvenance;
    canvasId?: string;
    policy?: ProjectionPolicy;
  } = {},
): {
  page: CanonicalAnnotationPage | null;
  annotations: ResolvedAnnotation[];
  diagnostics: Diagnostic[];
} => {
  try {
    const { document, diagnostics } = parseWebAnnotationPage(normalizeInput(json), {
      allowBareArrays: true,
    });
    const annotations: ResolvedAnnotation[] = [];
    const all = [...diagnostics];
    for (const item of document.items) {
      const resolved = projectToResolved(item, options);
      if (!resolved) continue;
      annotations.push(resolved);
      all.push(...(resolved.diagnostics ?? []));
    }
    return { page: document, annotations, diagnostics: all };
  } catch {
    return { page: null, annotations: [], diagnostics: [] };
  }
};

/* ------------------------------------------------------------------------- */
/* Authoring                                                                  */
/* ------------------------------------------------------------------------- */

export type CreateInput = {
  id?: string;
  canvasId: string;
  shape: NeutralShape;
  temporal?: TemporalFragment;
  text?: string;
  label?: string;
  note?: string;
  tags?: readonly string[];
  motivation?: string;
  bodyPurpose?: string;
  language?: string;
  styleClass?: string;
  stylesheet?: CanonicalStylesheet | null;
};

/**
 * Builds a canonical annotation from an authoring action.
 *
 * `motivation` defaults to `commenting` and `styleClass` is a separate argument
 * from it, which is the structural reason `motivation: "mine"` cannot recur:
 * there is no parameter through which a layer name could reach the motivation
 * field, and `createAnnotation` would refuse it if there were.
 */
export const createMangoAnnotation = (input: CreateInput): CanonicalAnnotation => {
  const bodies: CanonicalResource[] = [];
  const text = input.text?.trim();
  if (text) {
    bodies.push(
      createTextualBody(text, {
        purpose: input.bodyPurpose ?? DEFAULT_BODY_PURPOSE,
        ...(input.language ? { language: input.language } : {}),
      }),
    );
  }
  for (const tag of input.tags ?? []) {
    const value = tag.trim().replace(/\s+/g, ' ');
    if (value) bodies.push(createTaggingBody(value));
  }

  const annotation = createAnnotation({
    id: input.id ?? mintDraftId(),
    motivation: input.motivation ?? DEFAULT_MOTIVATION,
    bodies,
    targets: [
      createTarget(input.canvasId, input.shape, {
        ...(input.temporal ? { temporal: input.temporal } : {}),
        ...(input.styleClass ? { styleClass: input.styleClass } : {}),
      }),
    ],
    ...(input.label ? { label: stringLabel(input.label) } : {}),
    ...(input.stylesheet ? { stylesheets: [input.stylesheet] } : {}),
  });

  const note = input.note?.trim();
  const withNoteApplied = note ? withNote(annotation, note) : annotation;
  /*
   * Builders give each resource a default path, so two bodies built separately
   * arrive carrying the same one. Patch operations address by path, and an
   * ambiguous path means an edit to the comment can land on the tag — which it
   * did. Repathing assigns each node its real position before anything can
   * reference it.
   */
  return repathAnnotation(withNoteApplied);
};

/**
 * Attaches a private note as an application extension.
 *
 * Not a body. A body is publishable content by construction, so a private note
 * stored as one is a private note that gets published the first time anybody
 * exports — which is exactly what Mango used to do with `describing` bodies.
 */
export const withNote = (
  annotation: CanonicalAnnotation,
  note: string | undefined,
): CanonicalAnnotation => {
  const extensions = { ...annotation.extensions };
  if (note?.trim()) extensions[MANGO_NOTE_KEY] = note.trim();
  else delete extensions[MANGO_NOTE_KEY];
  return { ...annotation, extensions };
};

/* ------------------------------------------------------------------------- */
/* Editing                                                                    */
/* ------------------------------------------------------------------------- */

const tagValue = (body: CanonicalResource): string => (body.value ?? '').trim();

const isTagBody = (body: CanonicalResource): boolean => body.purpose.includes('tagging');

/**
 * The body a text edit should address.
 *
 * The first body carrying display text, never simply the first body: an
 * annotation whose first body is a tag would otherwise have its tag overwritten
 * with the comment, which is the sibling-clobbering bug in a new costume.
 */
const displayBody = (annotation: CanonicalAnnotation): CanonicalResource | undefined =>
  annotation.bodies.find(
    (body) =>
      !isTagBody(body) &&
      body.kind === 'TextualBody' &&
      (body.purpose.length === 0 || body.purpose.some((purpose) => TEXT_PURPOSES.includes(purpose))),
  );

/**
 * Translates a Mango-level edit into patch operations.
 *
 * Only fields the patch actually carries produce operations, so a save that
 * changes the label cannot rewrite the geometry, and an edit Mango has no
 * operation for leaves the document alone rather than approximating it.
 */
export const operationsForPatch = (
  annotation: CanonicalAnnotation,
  patch: Partial<ResolvedAnnotation>,
  options: { language?: string; bodyPurpose?: string; textDirection?: string } = {},
): PatchOperation[] => {
  const operations: PatchOperation[] = [];

  if (patch.text !== undefined) {
    const body = displayBody(annotation);
    const value = patch.text.trim();
    if (body) {
      operations.push(setTextualBodyValue(refOf(body), patch.text));
      // An emptied body is removed rather than left as an empty string: an
      // empty TextualBody is a body that says nothing, and it round-trips
      // through every consumer as content the annotation does not have.
      if (!value) operations.push(removeBody(refOf(body)));
    } else if (value) {
      operations.push(
        addBody(
          createTextualBody(patch.text, {
            purpose: options.bodyPurpose ?? DEFAULT_BODY_PURPOSE,
            ...(options.language ? { language: options.language } : {}),
          }),
          0,
        ),
      );
    }
  }

  // Language and direction address the body the text came from, so setting a
  // language cannot move a tag into another one.
  if (options.language !== undefined) {
    const body = displayBody(annotation);
    if (body) {
      operations.push(
        setBodyLanguage(refOf(body), options.language ? [options.language] : []),
      );
    }
  }

  if (options.textDirection !== undefined) {
    const body = displayBody(annotation);
    if (body) {
      operations.push(
        setBodyTextDirection(refOf(body), options.textDirection || undefined),
      );
    }
  }

  if (patch.label !== undefined) {
    operations.push(setLabel(patch.label.trim() ? stringLabel(patch.label) : undefined));
  }

  if (patch.motivation !== undefined) {
    const motivations = patch.motivation?.filter(Boolean) ?? [];
    if (motivations.length) operations.push(setMotivation(motivations));
  }

  if (patch.tags !== undefined) {
    const wanted = patch.tags.map((tag) => tag.trim().replace(/\s+/g, ' ')).filter(Boolean);
    const existing = annotation.bodies.filter(isTagBody);
    const keep = new Set(wanted.map((tag) => tag.toLowerCase()));
    for (const body of existing) {
      if (!keep.has(tagValue(body).toLowerCase())) operations.push(removeBody(refOf(body)));
    }
    const present = new Set(existing.map((body) => tagValue(body).toLowerCase()));
    for (const tag of wanted) {
      if (!present.has(tag.toLowerCase())) operations.push(addBody(createTaggingBody(tag)));
    }
  }

  const geometryChanged =
    patch.rect !== undefined ||
    patch.point !== undefined ||
    patch.polygon !== undefined ||
    patch.shapeType !== undefined;
  if (geometryChanged) {
    const target = annotation.targets[0];
    if (target) {
      const shape = shapeFromResolved({
        shapeType: patch.shapeType,
        rect: patch.rect,
        point: patch.point,
        polygon: patch.polygon,
      });
      if (shape.type !== 'none') {
        operations.push(setTargetGeometry(refOf(target), shape));
      }
    }
  }

  if (patch.targetStyleClass !== undefined) {
    const target = annotation.targets[0];
    if (target) {
      operations.push(setStyleClass(refOf(target), patch.targetStyleClass || undefined));
    }
  }

  return operations;
};

export type ApplyResult = {
  document: CanonicalAnnotation;
  diagnostics: Diagnostic[];
  changed: boolean;
};

/**
 * Applies a Mango-level edit to a canonical document.
 *
 * Notes and stylesheets are applied outside `patchAnnotation` because they are
 * not W3C body or target operations — the note is a Mango extension and the
 * stylesheet is annotation-level. Everything the parser owns goes through the
 * parser, so a rejected operation rejects the whole patch instead of leaving
 * the document half-changed.
 */
export const applyPatch = (
  annotation: CanonicalAnnotation,
  patch: Partial<ResolvedAnnotation>,
  options: {
    language?: string;
    bodyPurpose?: string;
    textDirection?: string;
    stylesheet?: CanonicalStylesheet | null;
  } = {},
): ApplyResult => {
  const operations = operationsForPatch(annotation, patch, options);
  let document = annotation;
  const diagnostics: Diagnostic[] = [];
  let changed = false;

  if (operations.length) {
    const result = patchAnnotation(annotation, operations);
    diagnostics.push(...result.diagnostics);
    if (result.changed) {
      document = result.document;
      changed = true;
    }
  }

  if (patch.notes !== undefined) {
    const next = withNote(document, patch.notes);
    changed = changed || next.extensions[MANGO_NOTE_KEY] !== document.extensions[MANGO_NOTE_KEY];
    document = next;
  }

  if (options.stylesheet !== undefined) {
    const stylesheets = options.stylesheet ? [options.stylesheet] : [];
    document = { ...document, stylesheets, stylesheetCardinality: stylesheets.length ? 'single' : 'absent' };
    changed = true;
  }

  return { document, diagnostics, changed };
};

/**
 * Applies an edit to a projection by way of its canonical document.
 *
 * The projection is rebuilt from the patched document rather than merged over
 * the old one, so the two cannot disagree about what the annotation now says.
 * A projection with no document behind it — one built by hand, or supplied by a
 * host as a plain object — falls back to a shallow merge, which is lossy but is
 * the most that can be done when there is no document to be lossless about.
 */
export const applyResolvedPatch = (
  annotation: ResolvedAnnotation,
  patch: Partial<ResolvedAnnotation>,
  options: {
    language?: string;
    bodyPurpose?: string;
    textDirection?: string;
    stylesheet?: CanonicalStylesheet | null;
  } = {},
): ResolvedAnnotation => {
  if (!annotation.document) return { ...annotation, ...patch };
  const { document, changed } = applyPatch(annotation.document, patch, options);
  if (!changed) return { ...annotation, ...patch };
  const projected = projectToResolved(document, { provenance: annotation.provenance });
  return projected
    ? { ...projected, id: annotation.id, provenance: annotation.provenance }
    : { ...annotation, ...patch };
};

/** Plain text for search and list display, HTML bodies included. */
export const searchTextFor = (annotation: ResolvedAnnotation): string =>
  [
    annotation.label,
    annotation.text,
    ...(annotation.bodies ?? []).map((body) =>
      body.type === 'html' ? htmlToText(body.value ?? '') : (body.value ?? ''),
    ),
    ...(annotation.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ');
