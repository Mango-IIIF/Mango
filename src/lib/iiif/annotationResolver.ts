import type { CanonicalAnnotation, Diagnostic } from '@mango-iiif/w3c-parser';
import type { IIIFIdentifiable } from '../core/types/iiif';
import { resolveAnnotationJson } from '../features/annotations/canonical';
import type { AnnotationEditability, AnnotationProvenance } from '../features/annotations/model';
import type { PresentationHints } from '../features/annotations/style';

export type AnnotationRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type AnnotationPoint = {
  x: number;
  y: number;
};

export type AnnotationPolygon = {
  points: AnnotationPoint[];
  svg?: string;
};

/** An SVG selector that describes an open path rather than a closed shape. */
const svgDescribesOpenPath = (svg: string | undefined): boolean =>
  Boolean(svg && (svg.includes('<polyline') || svg.includes('<line')));

/**
 * Whether an annotation's points describe an open path.
 *
 * Every path shape is carried in the single `polygon` slot, so `polygon` alone
 * cannot say whether the last point joins back to the first. `shapeType` is the
 * answer and every producer sets it; the SVG sniff behind it is only for legacy
 * v2 annotations that arrive as a bare SvgSelector with no shape recorded.
 *
 * Shared so that the annotation editor, the plain viewer and the story overlay
 * cannot disagree about the same annotation — they did, and a freehand drawn as
 * an open curve came back closed and filled once committed.
 */
export const isOpenPathAnnotation = (
  annotation: Pick<ResolvedAnnotation, 'shapeType' | 'polygon'>,
): boolean => {
  if (annotation.shapeType === 'freehand' || annotation.shapeType === 'line') return true;
  if (annotation.shapeType === 'polygon') return false;
  return svgDescribesOpenPath(annotation.polygon?.svg);
};

export type AnnotationTime = {
  start: number;
  end?: number;
};

export type AnnotationBody = {
  /** Canonical path used to address this body without flattening siblings. */
  path?: string;
  type: 'text' | 'html' | 'image' | 'unknown';
  value?: string;
  format?: string;
  language?: string;
  textDirection?: string;
  purpose?: string;
  src?: string;
  styleClass?: string;
  style?: string;
};

/**
 * Mango's rendering and search view of an annotation.
 *
 * A projection, not a document. `document` is the canonical annotation this was
 * read from and every edit is applied there; the fields below are what the
 * stage, the list, and the inspector need in order to draw and describe it. An
 * annotation with no `document` came from somewhere that has not adopted the
 * canonical model yet, and cannot be exported losslessly.
 */
export type ResolvedAnnotation = {
  id: string;
  shapeType?: 'rect' | 'point' | 'polygon' | 'freehand' | 'line';
  rect?: AnnotationRect;
  time?: AnnotationTime;
  point?: AnnotationPoint;
  polygon?: AnnotationPolygon;
  text?: string;
  label?: string;
  /** Private note. Mango application data, never a body. See `profile.ts`. */
  notes?: string;
  tags?: string[];
  bodies?: AnnotationBody[];
  motivation?: string[];
  /** External stylesheet IRIs referenced by the annotation. Never fetched. */
  stylesheets?: string[];
  targetStyleClass?: string;
  /** Legacy Mango inline `target.style`. Read for migration; never written. */
  targetStyle?: string;
  /** Presentation hints resolved from the stylesheet or a legacy inline style. */
  styleHints?: PresentationHints;
  /** The canonical document this projects. The authority for every edit. */
  document?: CanonicalAnnotation;
  /** Canonical path of the target that produced this projection's geometry. */
  targetPath?: string;
  /** Canonical path of the selector that produced the geometry, when one did. */
  selectorPath?: string;
  provenance?: AnnotationProvenance;
  editability?: AnnotationEditability;
  diagnostics?: Diagnostic[];
};

/**
 * Extracts the id from an IIIF identifiable value (string, {id}, or {@id})
 */
const readId = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if ('id' in value && typeof value.id === 'string') return value.id;
    if ('@id' in value && typeof value['@id'] === 'string') return value['@id'];
  }
  return '';
};

/**
 * Collects annotation items from an annotation page
 */
const collectAnnotationItems = (page: unknown): unknown[] => {
  if (!page || typeof page !== 'object') return [];
  // Some annotation servers answer a page request with the bare list rather
  // than an AnnotationList wrapping it — Simple Annotation Server's
  // `/annotation/search?uri=` does. The annotations inside are ordinary ones,
  // so the only thing missing was the envelope.
  if (Array.isArray(page)) return page;
  const pageObj = page as Record<string, unknown>;
  if (Array.isArray(pageObj.items)) return pageObj.items;
  if (Array.isArray(pageObj.resources)) return pageObj.resources;
  return [];
};

/**
 * Whether an annotation paints the Canvas rather than commenting on it.
 *
 * Presentation 2 used `sc:painting` for transcriptions as well as for the
 * image, so the motivation alone does not settle it — an image body does. A
 * painting annotation with an image body is the Canvas content, already handled
 * by the media resolver, and showing it in the annotation list would offer the
 * user the photograph as something to annotate.
 */
const isCanvasContent = (
  motivations: readonly string[],
  bodies: readonly AnnotationBody[],
): boolean =>
  motivations.some(
    (value) => value === 'painting' || value.endsWith(':painting') || value.endsWith('/painting'),
  ) && bodies.some((body) => body.type === 'image');

/**
 * Resolves a single IIIF annotation through the canonical parser.
 *
 * Mango no longer reads selectors, SVG, fragments, or bodies itself. What
 * remains here is what the parser has no view on: which Canvas the viewer is
 * showing, and whether an annotation is Canvas content rather than commentary.
 */
const resolveAnnotation = (
  annotation: unknown,
  canvasId: string | undefined,
  fallback: { value: number },
  provenance: AnnotationProvenance,
): ResolvedAnnotation | null => {
  if (!annotation || typeof annotation !== 'object') return null;

  const { annotation: resolved } = resolveAnnotationJson(annotation, { provenance, canvasId });
  if (!resolved) return null;

  if (isCanvasContent(resolved.motivation ?? [], resolved.bodies ?? [])) return null;

  // An annotation whose only target is another Canvas is not on this one. The
  // projection already prefers a target matching `canvasId`, so reaching here
  // with a different source means none of its targets matched.
  if (canvasId) {
    const targetSource = resolved.document?.targets.find(
      (target) => target.path === resolved.targetPath,
    );
    const sourceId = targetSource?.source?.id ?? targetSource?.id;
    const bare = sourceId?.split('#')[0]?.split('?')[0];
    const hasGeometry = Boolean(
      resolved.rect || resolved.point || resolved.polygon || resolved.time,
    );
    if (bare && bare !== canvasId && (hasGeometry || sourceId !== canvasId)) return null;
  }

  return {
    ...resolved,
    id: resolved.id || `anno-${fallback.value++}`,
  };
};

/**
 * Pick a canvas from a manifesto manifest object using the manifesto.js API
 */
const pickCanvas = (
  manifestoObject: unknown,
  canvasId?: string,
  canvasIndex?: number,
): unknown | undefined => {
  if (!manifestoObject || typeof manifestoObject !== 'object') return undefined;

  // Type assertion for manifesto.js object - we know it has these methods
  const manifest = manifestoObject as {
    getSequences: () => Array<{ getCanvases: () => unknown[] }>;
  };

  const sequences = manifest.getSequences();
  if (!sequences || sequences.length === 0) return undefined;

  const canvases = sequences[0].getCanvases();
  if (!canvases || canvases.length === 0) return undefined;

  if (canvasId) {
    const match = canvases.find((canvas: unknown) => {
      const c = canvas as { id?: string };
      return c.id === canvasId;
    });
    if (match) return match;
  }

  if (typeof canvasIndex === 'number' && canvases[canvasIndex]) {
    return canvases[canvasIndex];
  }

  return canvases[0];
};

/**
 * Get all annotations for a specific canvas from a manifesto manifest object
 */
export const getCanvasAnnotations = (
  manifestoObject: unknown,
  canvasId?: string,
  canvasIndex?: number,
): ResolvedAnnotation[] => {
  const canvas = pickCanvas(manifestoObject, canvasId, canvasIndex);
  if (!canvas || typeof canvas !== 'object') return [];

  const canvasObj = canvas as {
    id?: string;
    getAnnotations?: () => unknown[];
    getOtherContent?: () => unknown[];
    __jsonld?: { otherContent?: unknown[] };
  };
  const resolvedCanvasId = canvasObj.id || canvasId;

  const results: ResolvedAnnotation[] = [];
  const fallback = { value: 0 };

  // Get annotation pages using manifesto.js API (IIIF v3)
  if (typeof canvasObj.getAnnotations === 'function') {
    const annotationPages = canvasObj.getAnnotations();
    for (const page of annotationPages) {
      const pageObj = page as {
        getItems?: () => unknown[];
        items?: unknown[];
      };
      // Get items from the annotation page
      const items =
        typeof pageObj.getItems === 'function' ? pageObj.getItems() : pageObj.items || [];

      for (const annotation of items) {
        const resolved = resolveAnnotation(annotation, resolvedCanvasId, fallback, 'manifest');
        if (resolved) results.push(resolved);
      }
    }
  }

  // Also check otherContent (for IIIF v2 manifests)
  // In v2, inline annotation lists are available synchronously via getProperty
  const canvasWithProperties = canvas as { getProperty?: (prop: string) => unknown };
  if (typeof canvasWithProperties.getProperty === 'function') {
    const otherContent = canvasWithProperties.getProperty('otherContent');
    if (Array.isArray(otherContent)) {
      for (const annotationList of otherContent) {
        // Each annotation list can have 'resources' (v2) or 'items'
        const annotations = collectAnnotationItems(annotationList);
        for (const annotation of annotations) {
          const resolved = resolveAnnotation(annotation, resolvedCanvasId, fallback, 'manifest');
          if (resolved) results.push(resolved);
        }
      }
    }
  }

  // For painting annotations (items/content), these are handled by getContent
  // which is already processed through mediaResolver for painting annotations
  // We only want non-painting annotations here

  return results;
};

/**
 * Get annotations from an annotation page JSON
 */
export const getAnnotationPageAnnotations = (
  pageJson: unknown,
  canvasId?: string,
  provenance: AnnotationProvenance = 'external',
): ResolvedAnnotation[] => {
  const results: ResolvedAnnotation[] = [];
  const fallback = { value: 0 };
  const items = collectAnnotationItems(pageJson);
  for (const annotation of items) {
    const resolved = resolveAnnotation(annotation, canvasId, fallback, provenance);
    if (resolved) results.push(resolved);
  }
  return results;
};

/**
 * Check if a canvas has external annotation references (URLs that need to be fetched)
 * This is important for v2 manifests where annotations are often external
 */
export const hasExternalAnnotationRefs = (canvas: unknown): boolean => {
  if (!canvas || typeof canvas !== 'object') return false;

  const canvasObj = canvas as {
    getProperty?: (prop: string) => unknown;
  };

  // Check for otherContent in v2 manifests using manifesto API
  if (typeof canvasObj.getProperty === 'function') {
    const otherContent = canvasObj.getProperty('otherContent');
    if (Array.isArray(otherContent)) {
      for (const entry of otherContent) {
        if (!entry) continue;

        // If it's a string URL, it's an external reference
        if (typeof entry === 'string') return true;

        // If it has an ID but no inline items/resources, it's an external reference
        if (typeof entry === 'object') {
          const id = readId(entry as IIIFIdentifiable);
          if (id) {
            const entryObj = entry as Record<string, unknown>;
            const hasInlineItems =
              Array.isArray(entryObj.items) || Array.isArray(entryObj.resources);
            if (!hasInlineItems) return true;
          }
        }
      }
    }
  }

  // Check for annotations property in v3 manifests
  // Note: In v3, manifesto.js typically loads annotation pages synchronously,
  // so if getAnnotations() returns pages, they should have items available.
  // External v3 annotations are less common and are handled by the external
  // annotation loader when it encounters annotation page URLs in the manifest.
  // For now, we rely on the external annotation loader to handle v3 external refs.

  return false;
};
