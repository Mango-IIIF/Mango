import type { StoryState } from '../core/types/story';
import { translate } from '../i18n';

export type IdentifierValidation = { ok: boolean; errors: string[] };

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
  const base = deriveChapterAnnotationBase(story) ?? 'urn:mango:draft:annotation/';
  return `${base}${encodeURIComponent(chapterId)}`;
};

export const validatePublicationIdentifiers = (story: StoryState): IdentifierValidation => {
  const errors: string[] = [];
  if (story.publication?.status === 'published' && !story.id) {
    errors.push(translate('validation.identifiers.publishedStory'));
  }
  if (story.id) errors.push(...validatePublicIdentifier(story.id, translate('storyBuilder.settings.storyId')));
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
