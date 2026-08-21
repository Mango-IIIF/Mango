import { describe, expect, it } from 'vitest';
import type { StoryState } from '../../core/types/story';
import {
  buildChapterAnnotationId,
  createDraftStoryId,
  deriveChapterAnnotationBase,
  isGeneratedDraftId,
  MANGO_DRAFT_FALLBACK_ID,
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

  it('gives a story with no publishing identifier a valid generated one', () => {
    const exported = serializeStoryToIiif({ ...story, id: undefined });
    expect(exported.id).toBe(MANGO_DRAFT_FALLBACK_ID);
    expect(exported.items[0].id).toBe(`${MANGO_DRAFT_FALLBACK_ID}/annotation/stable%20id`);

    /*
     * Kept on reload so a draft's ids stay stable across save/load. It is not
     * promoted to an authored identifier: no annotation base is derived from
     * it, and it still reads as generated everywhere that matters.
     */
    const reloaded = normaliseStoryInput(exported);
    expect(reloaded.story?.id).toBe(MANGO_DRAFT_FALLBACK_ID);
    expect(isGeneratedDraftId(reloaded.story?.id)).toBe(true);
    expect(reloaded.story?.publication?.annotationBase).toBeUndefined();

    // And re-exporting does not churn the identifier.
    expect(serializeStoryToIiif(reloaded.story!).id).toBe(MANGO_DRAFT_FALLBACK_ID);
  });

  /*
   * Stories written before drafts carried an HTTP(S) id. The URN is dropped so
   * the story picks up a generated one, rather than re-exporting an identifier
   * IIIF does not allow.
   */
  it('drops a legacy urn draft identifier on load', () => {
    const legacy = { ...serializeStoryToIiif({ ...story, id: undefined }), id: 'urn:mango:draft:story' };
    const reloaded = normaliseStoryInput(legacy);
    expect(reloaded.story?.id).toBeUndefined();
  });

  /*
   * Structural validity and publication readiness are separate checks. The
   * generated id passes the schema; it must still be refused here, or a story
   * could be published carrying identifiers in a domain its publisher does not
   * control.
   */
  it('refuses a generated draft identifier for publication', () => {
    const generated = createDraftStoryId();
    expect(generated).toMatch(/^https:\/\/mangoviewer\.dev\/stories\/draft\//);
    expect(isGeneratedDraftId(generated)).toBe(true);

    // Saving a working draft under a generated id is the normal case.
    expect(validatePublicationIdentifiers({ ...story, id: generated }).ok).toBe(true);

    // Asking whether it is publishable is a different question.
    const asked = validatePublicationIdentifiers(
      { ...story, id: generated },
      { requirePublishableId: true },
    );
    expect(asked.ok).toBe(false);
    expect(asked.errors.join(' ')).toMatch(/AnnotationPage ID/i);

    // A story that already claims to be published is held to it either way.
    const claimed = validatePublicationIdentifiers({
      ...story,
      id: generated,
      publication: { status: 'published' },
    });
    expect(claimed.ok).toBe(false);

    const authored = validatePublicationIdentifiers(
      { ...story, id: 'https://museum.example/stories/one' },
      { requirePublishableId: true },
    );
    expect(authored.ok).toBe(true);
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
