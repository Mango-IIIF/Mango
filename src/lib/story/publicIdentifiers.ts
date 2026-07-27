import type { StoryState } from '../core/types/story';

export type IdentifierValidation = { ok: boolean; errors: string[] };

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validatePublicIdentifier = (value: string, label = 'Identifier'): string[] => {
  if (!isHttpUrl(value)) return [`${label}: must be an absolute HTTP(S) URL`];
  const url = new URL(value);
  const errors: string[] = [];
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    errors.push(`${label}: localhost cannot be used for a published story`);
  }
  if (url.username || url.password) errors.push(`${label}: credentials are not allowed`);
  if (url.hash || url.search) errors.push(`${label}: query strings and fragments are not allowed`);
  if (/\s/.test(value)) errors.push(`${label}: contains unsafe whitespace`);
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
    errors.push('Story ID: a published story requires a canonical HTTP(S) identifier');
  }
  if (story.id) errors.push(...validatePublicIdentifier(story.id, 'Story ID'));
  if (story.publication?.annotationBase) {
    errors.push(
      ...validatePublicIdentifier(story.publication.annotationBase, 'Chapter Annotation base'),
    );
  }
  const seen = new Set<string>();
  for (const chapter of story.chapters) {
    const hasControlCharacter = [...chapter.id].some((character) => character.charCodeAt(0) < 32);
    if (!chapter.id || hasControlCharacter) {
      errors.push(`Chapter ID: unsafe identifier "${chapter.id}"`);
      continue;
    }
    const id = buildChapterAnnotationId(story, chapter.id);
    if (seen.has(id)) errors.push(`Chapter ID collision: ${chapter.id}`);
    seen.add(id);
  }
  return { ok: errors.length === 0, errors };
};
