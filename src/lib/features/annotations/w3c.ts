/**
 * Compatibility surface over the canonical adapter.
 *
 * A thin wrapper on `canonical.ts`, kept so the call sites that spoke in terms
 * of "a W3C annotation object" keep working through one deprecation cycle; new
 * code should take a `CanonicalAnnotation` and stay in the document model
 * rather than round-tripping through JSON.
 *
 * @deprecated Use `canonical.ts` directly.
 */

import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
import { resolveAnnotationJson } from './canonical';

export const w3cToResolved = (annotation: unknown): ResolvedAnnotation | null =>
  resolveAnnotationJson(annotation, { provenance: 'local' }).annotation;
