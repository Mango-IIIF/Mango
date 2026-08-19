import type { StoryState } from '../core/types/story';
import { translate } from '../core/i18n';

export type IdentifierValidation = { ok: boolean; errors: string[] };

/**
 * Namespace for identifiers Mango generates itself, before an author has said
 * where the story will actually live.
 *
 * These are real HTTP(S) URIs so that a draft export is structurally valid
 * IIIF rather than a document nothing can read. They are deliberately *not* a
 * substitute for a publisher's own identifiers: they sit in a domain the
 * publisher does not control, so `validatePublicationIdentifiers` rejects them
 * for anything heading to publication. The `/stories/draft/` segment is what
 * makes that check possible, so it is load-bearing — a generated id must stay
 * recognisable as generated.
 *
 * A URN was the obvious alternative and was tried first. It is honest about
 * being unresolvable, but it makes every draft fail IIIF's requirement that an
 * AnnotationPage and an Annotation carry an HTTP(S) id, which in turn made the
 * whole draft profile unvalidatable. `localhost` was rejected for the opposite
 * reason: it passes a syntax check while pointing at whatever happens to be
 * running on the reader's machine — `validatePublicIdentifier` already refuses
 * it for author-supplied ids for exactly that reason.
 */
export const MANGO_DRAFT_ID_BASE = 'https://mangoviewer.dev/stories/draft/';

/**
 * Last-resort id for a story that reached serialisation without one. Stable
 * rather than freshly generated: serialisation has to be deterministic, or
 * every export of the same story would differ and round-trip comparisons
 * would be meaningless. Stories created through the builder are given their
 * own generated id up front, so this is a safety net, not the normal path.
 */
export const MANGO_DRAFT_FALLBACK_ID = `${MANGO_DRAFT_ID_BASE}untitled`;

/**
 * Identifiers written before drafts carried an HTTP(S) id. Dropped on load
 * rather than preserved, so the story picks up a generated one and its next
 * export is valid IIIF instead of inheriting a URN that never was.
 */
export const LEGACY_DRAFT_ID_PREFIX = 'urn:mango:draft:';

export const isLegacyDraftId = (value: string | undefined | null): boolean =>
  typeof value === 'string' && value.startsWith(LEGACY_DRAFT_ID_PREFIX);

/** True for an id Mango generated, as opposed to one an author chose. */
export const isGeneratedDraftId = (value: string | undefined | null): boolean =>
  typeof value === 'string' && value.startsWith(MANGO_DRAFT_ID_BASE);

/** A fresh draft identifier for a story that has just been created. */
export const createDraftStoryId = (): string => {
  const unique =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${MANGO_DRAFT_ID_BASE}${unique}`;
};

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validatePublicIdentifier = (
  value: string,
  label = translate('validation.identifiers.identifier'),
): string[] => {
  if (!isHttpUrl(value)) return [translate('validation.identifiers.absoluteUrl', { label })];
  const url = new URL(value);
  const errors: string[] = [];
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    errors.push(translate('validation.identifiers.localhost', { label }));
  }
  if (url.username || url.password) errors.push(translate('validation.identifiers.credentials', { label }));
  if (url.hash || url.search) errors.push(translate('validation.identifiers.query', { label }));
  if (/\s/.test(value)) errors.push(translate('validation.identifiers.whitespace', { label }));
  return errors;
};

export const deriveChapterAnnotationBase = (story: StoryState): string | undefined => {
  const configured = story.publication?.annotationBase?.trim();
  if (configured) return configured.endsWith('/') ? configured : `${configured}/`;
  const pageId = story.id?.trim();
  return pageId ? `${pageId.replace(/\/$/, '')}/annotation/` : undefined;
};

export const buildChapterAnnotationId = (story: StoryState, chapterId: string): string => {
  const base =
    deriveChapterAnnotationBase(story) ?? `${MANGO_DRAFT_FALLBACK_ID}/annotation/`;
  return `${base}${encodeURIComponent(chapterId)}`;
};

export type PublicationValidationOptions = {
  /*
   * Whether a Mango-generated identifier counts as an error.
   *
   * Off by default because this runs on the ordinary save path, and saving a
   * working draft under a generated id is the normal case — failing it there
   * would make an unpublished story unsaveable. A host asking "can I publish
   * this?" passes `true`, and a story that already claims to be published is
   * held to it regardless.
   */
  requirePublishableId?: boolean;
};

export const validatePublicationIdentifiers = (
  story: StoryState,
  options: PublicationValidationOptions = {},
): IdentifierValidation => {
  const errors: string[] = [];
  const published = story.publication?.status === 'published';
  if (published && !story.id) {
    errors.push(translate('validation.identifiers.publishedStory'));
  }
  if (isGeneratedDraftId(story.id)) {
    if (options.requirePublishableId || published) {
      errors.push(translate('validation.identifiers.generatedDraft'));
    }
  } else if (story.id) {
    errors.push(...validatePublicIdentifier(story.id, translate('storyBuilder.settings.storyId')));
  }
  if (story.publication?.annotationBase) {
    errors.push(
      ...validatePublicIdentifier(story.publication.annotationBase, translate('storyBuilder.settings.annotationBase')),
    );
  }
  const seen = new Set<string>();
  for (const chapter of story.chapters) {
    const hasControlCharacter = [...chapter.id].some((character) => character.charCodeAt(0) < 32);
    if (!chapter.id || hasControlCharacter) {
      errors.push(translate('validation.identifiers.unsafeChapter', { id: chapter.id }));
      continue;
    }
    const id = buildChapterAnnotationId(story, chapter.id);
    if (seen.has(id)) errors.push(translate('validation.identifiers.collision', { id: chapter.id }));
    seen.add(id);
  }
  return { ok: errors.length === 0, errors };
};
