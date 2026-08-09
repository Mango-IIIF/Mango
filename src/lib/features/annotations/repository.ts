/**
 * The persistence contract.
 *
 * Mango does not know how a host stores annotations, and should not: the same
 * viewer runs against a static file, a repository's own API, and a IIIF
 * annotation server. What it does know is the shape of the conversation —
 * pages are loaded, annotations are created and updated and deleted, a create
 * may come back with a different identifier than it went out with, and an
 * update may lose a race.
 *
 * Only a host-callback adapter ships. A W3C Annotation Protocol adapter would
 * be a second implementation of this interface and nothing above it would
 * change, which is the point of writing the interface down before there is a
 * second one.
 */

import {
  replaceAnnotationId,
  serializeWebAnnotation,
  type CanonicalAnnotation,
  type CanonicalAnnotationPage,
  type JsonObject,
} from '@mango-iiif/w3c-parser';
import { resolvePageJson } from './canonical';
import type { ResolvedAnnotation } from '../../iiif/annotationResolver';

/** Why a repository call failed, in terms the UI can act on. */
export type RepositoryErrorKind =
  /** The host rejected the change; retrying unchanged will fail again. */
  | 'rejected'
  /** Someone else changed it first. The user has to choose what to keep. */
  | 'conflict'
  /** The caller is not permitted to do this. */
  | 'forbidden'
  /** Transport failed. Retrying may work. */
  | 'network'
  /** The request was abandoned. */
  | 'cancelled';

export class RepositoryError extends Error {
  constructor(
    readonly kind: RepositoryErrorKind,
    message: string,
    /** The version the server holds, when it told us. */
    readonly serverVersion?: string,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }

  get retryable(): boolean {
    return this.kind === 'network';
  }
}

/** An annotation as stored, with whatever the host uses for optimistic locking. */
export type StoredAnnotation = {
  annotation: CanonicalAnnotation;
  /** ETag or revision. Passed back on update so the host can detect conflicts. */
  version?: string;
};

export type LoadedPage = {
  page: CanonicalAnnotationPage;
  annotations: ResolvedAnnotation[];
  versions: Map<string, string>;
};

export type AnnotationRepository = {
  /** Loads one page of annotations. */
  loadPage(pageId: string, options?: { signal?: AbortSignal }): Promise<LoadedPage>;
  /** Lists the pages available for a Canvas. */
  listPages(canvasId: string, options?: { signal?: AbortSignal }): Promise<string[]>;
  /**
   * Creates an annotation.
   *
   * The returned annotation is authoritative: a host that mints identifiers
   * server-side returns one carrying the assigned id, and the caller replaces
   * the draft id with it rather than assuming the one it sent was kept.
   */
  create(
    annotation: CanonicalAnnotation,
    options?: { pageId?: string; signal?: AbortSignal },
  ): Promise<StoredAnnotation>;
  update(
    annotation: CanonicalAnnotation,
    options?: { version?: string; signal?: AbortSignal },
  ): Promise<StoredAnnotation>;
  delete(
    annotationId: string,
    options?: { version?: string; signal?: AbortSignal },
  ): Promise<void>;
};

/* ------------------------------------------------------------------------- */
/* Host callback adapter                                                      */
/* ------------------------------------------------------------------------- */

/**
 * What a host implements.
 *
 * Plain JSON in both directions, so a host can wire this to `fetch`, to a
 * framework's data layer, or to an in-memory store in a test, without importing
 * anything from Mango. Every callback is optional; an absent one means the
 * operation is unsupported and is reported as `forbidden` rather than failing
 * silently.
 */
export type AnnotationHostCallbacks = {
  loadPage?: (pageId: string, signal?: AbortSignal) => Promise<unknown>;
  listPages?: (canvasId: string, signal?: AbortSignal) => Promise<string[]>;
  create?: (
    annotation: JsonObject,
    context: { pageId?: string; signal?: AbortSignal },
  ) => Promise<{ annotation?: unknown; id?: string; version?: string } | void>;
  update?: (
    annotation: JsonObject,
    context: { version?: string; signal?: AbortSignal },
  ) => Promise<{ annotation?: unknown; version?: string } | void>;
  delete?: (
    annotationId: string,
    context: { version?: string; signal?: AbortSignal },
  ) => Promise<void>;
};

// A declaration rather than a const arrow: TypeScript only narrows past a
// `never`-returning call when the callee's type is known from a declaration.
function unsupported(operation: string): never {
  throw new RepositoryError('forbidden', `The host does not support ${operation}.`);
}

/**
 * Classifies a thrown value.
 *
 * A host throws whatever its stack throws — a `Response`, an `Error`, a string.
 * Mapping it here means the UI can distinguish "try again" from "someone else
 * changed this" without every host having to learn Mango's error type.
 */
const toRepositoryError = (error: unknown): RepositoryError => {
  if (error instanceof RepositoryError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new RepositoryError('cancelled', 'The request was cancelled.');
  }
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : undefined;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 409 || status === 412) return new RepositoryError('conflict', message);
  if (status === 401 || status === 403) return new RepositoryError('forbidden', message);
  if (status && status >= 400 && status < 500) return new RepositoryError('rejected', message);
  return new RepositoryError('network', message);
};

const serialize = (annotation: CanonicalAnnotation): JsonObject =>
  serializeWebAnnotation(annotation, { profile: 'iiif-presentation-3', context: 'add' }).json;

/**
 * Reads the annotation a host handed back after a write.
 *
 * A host may return the stored annotation, only an assigned id, or nothing at
 * all. Returning nothing means "what you sent is what I stored", which is the
 * common case for a host that lets the client mint identifiers.
 */
const readWriteResult = (
  sent: CanonicalAnnotation,
  result: { annotation?: unknown; id?: string; version?: string } | void,
): StoredAnnotation => {
  if (!result) return { annotation: sent };
  if (result.annotation) {
    const { annotations } = resolvePageJson(result.annotation, { provenance: 'persisted' });
    const stored = annotations[0]?.document;
    if (stored) return { annotation: stored, version: result.version };
  }
  if (result.id && result.id !== sent.id) {
    return { annotation: { ...sent, id: result.id }, version: result.version };
  }
  return { annotation: sent, version: result.version };
};

export const createHostRepository = (
  callbacks: AnnotationHostCallbacks,
): AnnotationRepository => ({
  async loadPage(pageId, options) {
    if (!callbacks.loadPage) unsupported('loading annotation pages');
    try {
      const json = await callbacks.loadPage(pageId, options?.signal);
      const { page, annotations } = resolvePageJson(json, { provenance: 'persisted' });
      if (!page) throw new RepositoryError('rejected', 'The page could not be read.');
      return { page, annotations, versions: new Map() };
    } catch (error) {
      throw toRepositoryError(error);
    }
  },

  async listPages(canvasId, options) {
    if (!callbacks.listPages) return [];
    try {
      return await callbacks.listPages(canvasId, options?.signal);
    } catch (error) {
      throw toRepositoryError(error);
    }
  },

  async create(annotation, options) {
    if (!callbacks.create) unsupported('creating annotations');
    try {
      const result = await callbacks.create(serialize(annotation), {
        pageId: options?.pageId,
        signal: options?.signal,
      });
      return readWriteResult(annotation, result);
    } catch (error) {
      throw toRepositoryError(error);
    }
  },

  async update(annotation, options) {
    if (!callbacks.update) unsupported('updating annotations');
    try {
      const result = await callbacks.update(serialize(annotation), {
        version: options?.version,
        signal: options?.signal,
      });
      return readWriteResult(annotation, result);
    } catch (error) {
      throw toRepositoryError(error);
    }
  },

  async delete(annotationId, options) {
    if (!callbacks.delete) unsupported('deleting annotations');
    try {
      await callbacks.delete(annotationId, {
        version: options?.version,
        signal: options?.signal,
      });
    } catch (error) {
      throw toRepositoryError(error);
    }
  },
});

/**
 * Swaps a draft identifier for the one the server assigned.
 *
 * Done across the page rather than on the annotation alone, so page membership
 * and any reference to the draft id move together. Half-updating leaves the
 * page pointing at an identifier that no longer exists, which surfaces later as
 * an annotation that cannot be selected.
 */
export const adoptAssignedId = (
  page: CanonicalAnnotationPage,
  draftId: string,
  assignedId: string,
): CanonicalAnnotationPage =>
  draftId === assignedId ? page : replaceAnnotationId(page, draftId, assignedId).document;
