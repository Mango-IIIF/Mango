import { describe, expect, it } from 'vitest';
import type { StoryState } from '../../core/types/story';
import {
  buildChapterAnnotationId,
  deriveChapterAnnotationBase,
  validatePublicationIdentifiers,
} from '../publicIdentifiers';
import { serializeStoryToIiif } from '../storySerializer';
import { normaliseStoryInput } from '../viewer/storyLoader';

const story: StoryState = {
  id: 'https://museum.example/stories/one',
  chapters: [
    {
      id: 'stable id',
      manifest: 'https://museum.example/manifest',
      canvasIndex: 0,
      viewBox: { x: 0, y: 0, w: 10, h: 10 },
    },
  ],
};

describe('public story identifiers', () => {
  it('derives stable chapter annotation IDs from the canonical story ID', () => {
    expect(deriveChapterAnnotationBase(story)).toBe(
      'https://museum.example/stories/one/annotation/',
    );
    expect(buildChapterAnnotationId(story, 'stable id')).toBe(
      'https://museum.example/stories/one/annotation/stable%20id',
    );
  });

  it('supports a separately configured chapter annotation base', () => {
    const configured = {
      ...story,
      publication: { annotationBase: 'https://annotations.example/story-one/' },
    };
    expect(buildChapterAnnotationId(configured, 'stable id')).toBe(
      'https://annotations.example/story-one/stable%20id',
    );
    const roundTrip = normaliseStoryInput(serializeStoryToIiif(configured));
    expect(roundTrip.story?.publication?.annotationBase).toBe(
      'https://annotations.example/story-one/',
    );
  });

  it('marks a local export as draft instead of using an example domain', () => {
    const exported = serializeStoryToIiif({ ...story, id: undefined });
    expect(exported.id).toBe('urn:mango:draft:story');
    expect(exported['mango:draft']).toBe(true);
    expect(exported.items[0].id).toBe('urn:mango:draft:annotation/stable%20id');
    const reloaded = normaliseStoryInput(exported);
    expect(reloaded.story?.id).toBeUndefined();
    expect(reloaded.story?.publication?.annotationBase).toBeUndefined();
  });

  it('rejects localhost and malformed publication identifiers', () => {
    expect(
      validatePublicationIdentifiers({
        ...story,
        id: 'http://localhost:3000/story',
        publication: { annotationBase: 'not a URL', status: 'published' },
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('localhost'),
        expect.stringContaining('absolute HTTP(S)'),
      ]),
    );
  });
});
