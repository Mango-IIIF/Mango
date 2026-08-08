/**
 * Standards-shaped export.
 *
 * The output is an AnnotationPage a host can store and any conformant consumer
 * can read. It is deliberately not a list of Mango's internal projections: a
 * host that has to understand `ResolvedAnnotation` in order to persist an
 * annotation is a host coupled to Mango's rendering model, and that model is
 * allowed to change.
 *
 * Three things are reported alongside the JSON rather than being decided here,
 * because each of them is a judgement the caller has to make: whether the
 * document is valid, what private data was withheld, and which annotations
 * still need a real identifier.
 */

import {
  createAnnotationPage,
  serializeAnnotationPage,
  validateAnnotationPage,
  type CanonicalAnnotation,
  type CanonicalAnnotationPage,
  type Diagnostic,
  type JsonObject,
  type SerializationProfile,
  type ValidationResult,
} from '@mango-iiif/w3c-parser';
import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
import { translate } from '../../core/i18n';
import { createMangoAnnotation, shapeFromResolved } from './canonical';
import { toMangoDiagnostics, type MangoDiagnostic } from './diagnostics';
import {
  APPLICATION_EXTENSION_KEYS,
  DRAFT_PAGE_ID_PREFIX,
  PRIVATE_EXTENSION_KEYS,
  isDraftId,
  isHttpId,
  mangoProfiles,
} from './profile';

export type ExportOptions = {
  /** Public HTTP(S) identifier for the page. A draft URN when absent. */
  pageId?: string;
  /** Canvas the annotations target, for projections with no document. */
  canvasId?: string;
  profile?: SerializationProfile;
  /**
   * Include private application data.
   *
   * Off by default, and the caller has to pass it deliberately. Defaulting the
   * other way would mean every ordinary export leaked private notes, which is
   * the failure this flag exists to make impossible to reach by accident.
   */
  includePrivate?: boolean;
  /** Permits the expert-only motivations during validation. */
  expert?: boolean;
  /** Require resolvable HTTP(S) identifiers. For publication, not for drafts. */
  requireHttpIds?: boolean;
};

export type ExcludedField = {
  annotationId: string;
  keys: string[];
};

export type ExportResult = {
  /** AnnotationPage JSON-LD. */
  page: JsonObject;
  /** The canonical page, for a caller that wants to keep editing it. */
  document: CanonicalAnnotationPage;
  /** Validation suitable for keeping the document as a local draft. */
  draftValidation: ValidationResult;
  /** Strict validation for a payload intended to be published as IIIF. */
  publicationValidation: ValidationResult;
  /**
   * @deprecated Selects draft or publication validation according to
   * `requireHttpIds`. New callers should choose the named result explicitly.
   */
  validation: ValidationResult;
  /** Private data withheld, per annotation. Empty when nothing was withheld. */
  excludedPrivateFields: ExcludedField[];
  /** Annotations still carrying a draft identifier. */
  unresolvedIdentities: string[];
  /** Page identifier still needing a public HTTP(S) identity. */
  unresolvedPageIdentity?: string;
  diagnostics: MangoDiagnostic[];
};

/**
 * Removes Mango's own extension keys from a document.
 *
 * Private keys go unless the caller asked for them; application keys always go,
 * because they describe Mango's state rather than the annotation. Third-party
 * extensions are left exactly where they are — preserving what another tool
 * wrote is the whole point of the canonical model, and stripping it here would
 * undo that at the last step.
 */
const stripMangoExtensions = (
  annotation: CanonicalAnnotation,
  includePrivate: boolean,
): { document: CanonicalAnnotation; removed: string[] } => {
  const drop = includePrivate
    ? APPLICATION_EXTENSION_KEYS
    : [...PRIVATE_EXTENSION_KEYS, ...APPLICATION_EXTENSION_KEYS];
  const removed = drop.filter((key) => key in annotation.extensions);
  if (!removed.length) return { document: annotation, removed: [] };

  const extensions = { ...annotation.extensions };
  for (const key of removed) delete extensions[key];
  return {
    document: { ...annotation, extensions },
    // Only the private keys are worth telling the user about. The application
    // keys were never theirs and reporting them as "withheld" would bury the
    // one line that matters under noise.
    removed: removed.filter((key) => PRIVATE_EXTENSION_KEYS.includes(key)),
  };
};

/**
 * The canonical document for a projection.
 *
 * Everything that came through the resolver has one. A projection built by hand
 * — by a host calling `addAnnotation` with a plain object, say — does not, and
 * is rebuilt here so it can still be exported. That rebuild is lossy by
 * construction, which is exactly why it is the fallback rather than the path.
 */
const documentFor = (
  annotation: ResolvedAnnotation,
  canvasId: string | undefined,
): CanonicalAnnotation | null => {
  if (annotation.document) return annotation.document;
  const shape = shapeFromResolved(annotation);
  if (shape.type === 'none' || !canvasId) return null;
  return createMangoAnnotation({
    id: annotation.id || undefined,
    canvasId,
    shape,
    text: annotation.text,
    label: annotation.label,
    note: annotation.notes,
    tags: annotation.tags,
    motivation: annotation.motivation?.[0],
    styleClass: annotation.targetStyleClass,
  });
};

export const exportAnnotationPage = (
  annotations: readonly ResolvedAnnotation[],
  options: ExportOptions = {},
): ExportResult => {
  const includePrivate = options.includePrivate ?? false;
  const excludedPrivateFields: ExcludedField[] = [];
  const unresolvedIdentities: string[] = [];
  const items: CanonicalAnnotation[] = [];

  for (const annotation of annotations) {
    const document = documentFor(annotation, options.canvasId);
    if (!document) continue;

    const { document: cleaned, removed } = stripMangoExtensions(document, includePrivate);
    if (removed.length) {
      excludedPrivateFields.push({ annotationId: annotation.id, keys: removed });
    }
    if (isDraftId(cleaned.id) || !isHttpId(cleaned.id)) {
      unresolvedIdentities.push(annotation.id);
    }
    items.push(cleaned);
  }

  const pageId = options.pageId ?? `${DRAFT_PAGE_ID_PREFIX}${Date.now()}`;
  const unresolvedPageIdentity = isHttpId(pageId) ? undefined : pageId;
  const document = createAnnotationPage(items, { id: pageId });
  const draftValidation = validateAnnotationPage(
    document,
    mangoProfiles({ expert: options.expert, requireHttpIds: false }),
    { mode: 'tolerant' },
  );
  const basePublicationValidation = validateAnnotationPage(
    document,
    mangoProfiles({ expert: options.expert, requireHttpIds: true }),
    { mode: 'strict' },
  );
  /* The parser's strict annotation profile checks Annotation identifiers, but
     an empty AnnotationPage has no Annotation on which that rule can fire.
     IIIF publication still requires the page itself to have an HTTP(S) id. */
  const pageIdentityDiagnostics: Diagnostic[] = unresolvedPageIdentity
    ? [
        {
          code: 'serialize.draft-identifier',
          severity: 'error',
          path: '$.id',
          message: translate(
            'viewer.panels.annotations.editor.publicationPageIdRequired',
          ),
          value: pageId,
          reference: 'IIIF Presentation API 3.0, AnnotationPage',
        },
      ]
    : [];
  const publicationValidation: ValidationResult = {
    ...basePublicationValidation,
    valid: basePublicationValidation.valid && pageIdentityDiagnostics.length === 0,
    diagnostics: [
      ...basePublicationValidation.diagnostics,
      ...pageIdentityDiagnostics,
    ],
  };
  const validation = options.requireHttpIds ? publicationValidation : draftValidation;
  const { json, diagnostics } = serializeAnnotationPage(document, {
    profile: options.profile ?? 'iiif-presentation-3',
    context: 'add',
    normalizeLegacyTerms: true,
    labelPolicy: 'language-map',
    defaultLanguage: 'en',
  });

  return {
    page: json,
    document,
    draftValidation,
    publicationValidation,
    validation,
    excludedPrivateFields,
    unresolvedIdentities,
    ...(unresolvedPageIdentity ? { unresolvedPageIdentity } : {}),
    diagnostics: [
      ...toMangoDiagnostics(diagnostics, 'export'),
      ...toMangoDiagnostics(draftValidation.diagnostics, 'validation'),
      ...toMangoDiagnostics(publicationValidation.diagnostics, 'validation'),
    ],
  };
};

/** True when the page is safe to publish rather than only to store locally. */
export const isPublishable = (result: ExportResult): boolean =>
  result.publicationValidation.valid &&
  result.unresolvedIdentities.length === 0 &&
  !result.unresolvedPageIdentity;
