import { describe, it, expect } from 'vitest';
import { serializeStoryToIiif } from '../storySerializer';
import { normaliseStoryInput } from '../viewer/storyLoader';
import type { Story } from '../../core/types/story';

describe('Story IIIF Serialization and Parsing', () => {
  const sampleStory: Story = {
    version: '1.0',
    type: 'story',
    title: { en: 'My Awesome Story', cy: 'Fy Stori Wych' },
    narration: {
      tracks: {
        en: { src: 'https://example.com/audio-en.mp3' },
        cy: { src: 'https://example.com/audio-cy.mp3' }
      }
    },
    chapters: [
      {
        id: 'chapter_1',
        title: { en: 'Chapter 1', cy: 'Pennod 1' },
        description: { en: 'This is the first chapter', cy: 'Dyma y bennod gyntaf' },
        manifest: 'https://manifests.collections.yale.edu/ycba/obj/34',
        canvasIndex: 0,
        canvasId: 'https://manifests.collections.yale.edu/ycba/obj/34/canvas/0',
        transitionTimeMs: 2000,
        viewBox: { x: -500, y: 100, w: 1000, h: 500 }, // Has negative x to check clamping!
        media: { start: 170, end: 183 },
        narrationSegment: {
          en: { start: 0, end: 12.5 },
          cy: { start: 0, end: 14.2 }
        },
        annotations: {
          en: {
            text: 'Look at this detail!',
            placement: { x: 4500, y: 6500, w: 800, h: 300 } // Absolute canvas coords
          }
        }
      }
    ]
  };

  it('should serialize story into a valid IIIF Presentation v3 AnnotationPage', () => {
    const serialized = serializeStoryToIiif(sampleStory);

    expect(serialized['@context']).toBe('http://iiif.io/api/presentation/3/context.json');
    expect(serialized.type).toBe('AnnotationPage');
    expect(serialized.label.en[0]).toBe('My Awesome Story');
    expect(serialized.label.cy[0]).toBe('Fy Stori Wych');

    expect(serialized.items).toHaveLength(1);
    const annotation = serialized.items[0];
    expect(annotation.type).toBe('Annotation');
    expect(annotation.motivation).toBe('supplementing');
    expect(annotation.label.en[0]).toBe('Chapter 1');
    expect(annotation.summary.en[0]).toBe('This is the first chapter');
    expect(annotation.transitionTimeMs).toBe(2000);

    // Clamping & media segment checks
    expect(annotation.target.source).toBe('https://manifests.collections.yale.edu/ycba/obj/34/canvas/0#t=170,183');
    expect(annotation.target.partOf.id).toBe('https://manifests.collections.yale.edu/ycba/obj/34');
    expect(annotation.target.selector.value).toBe('xywh=0,100,1000,500&t=170,183'); // x=-500 clamped to 0, temporal media appended!

    // Sound and Textual bodies checks
    expect(Array.isArray(annotation.body)).toBe(true);
    const soundEn = annotation.body.find((b: any) => b.type === 'Sound' && b.language === 'en');
    expect(soundEn).toBeDefined();
    expect(soundEn.id).toBe('https://example.com/audio-en.mp3#t=0,12.5');

    const soundCy = annotation.body.find((b: any) => b.type === 'Sound' && b.language === 'cy');
    expect(soundCy).toBeDefined();
    expect(soundCy.id).toBe('https://example.com/audio-cy.mp3#t=0,14.2');

    const textEn = annotation.body.find((b: any) => b.type === 'TextualBody' && b.language === 'en');
    expect(textEn).toBeDefined();
    expect(textEn.value).toBe('Look at this detail!');
    expect(textEn.target.selector.value).toBe('xywh=4500,6500,800,300');
  });

  it('should round-trip parse the serialized AnnotationPage back into the same internal Story model', () => {
    const serialized = serializeStoryToIiif(sampleStory);
    const result = normaliseStoryInput(serialized);

    expect(result.ok).toBe(true);
    const parsed = result.story!;

    expect(parsed.title?.en).toBe('My Awesome Story');
    expect(parsed.title?.cy).toBe('Fy Stori Wych');
    expect(parsed.narration?.tracks?.en.src).toBe('https://example.com/audio-en.mp3');
    expect(parsed.narration?.tracks?.cy.src).toBe('https://example.com/audio-cy.mp3');

    expect(parsed.chapters).toHaveLength(1);
    const chapter = parsed.chapters[0];
    expect(chapter.id).toBe('chapter_1');
    expect(chapter.title?.en).toBe('Chapter 1');
    expect(chapter.description?.en).toBe('This is the first chapter');
    expect(chapter.transitionTimeMs).toBe(2000);
    expect(chapter.manifest).toBe('https://manifests.collections.yale.edu/ycba/obj/34');
    expect(chapter.canvasIndex).toBe(0);
    expect(chapter.canvasId).toBe('https://manifests.collections.yale.edu/ycba/obj/34/canvas/0');

    // Clamped viewBox (it is parsed as the clamped value xywh=0,100,1000,500)
    expect(chapter.viewBox).toEqual({ x: 0, y: 100, w: 1000, h: 500 });

    // Resolved media segment
    expect(chapter.media).toEqual({ start: 170, end: 183 });

    expect(chapter.narrationSegment?.en).toEqual({ start: 0, end: 12.5 });
    expect(chapter.narrationSegment?.cy).toEqual({ start: 0, end: 14.2 });

    expect(chapter.annotations?.en.text).toBe('Look at this detail!');
    expect(chapter.annotations?.en.placement).toEqual({ x: 4500, y: 6500, w: 800, h: 300 });
  });
});
