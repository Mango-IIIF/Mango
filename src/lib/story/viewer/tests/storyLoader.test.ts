import { describe, expect, it } from 'vitest';
import { normaliseStoryInput, validateStoryViewer } from '../storyLoader';

const annotationPage = {
  type: 'AnnotationPage',
  'mango:storyVersion': '1.0',
  items: [
    {
      id: 'https://example.org/story/annotation/chapter-1',
      type: 'Annotation',
      motivation: 'supplementing',
      target: {
        type: 'SpecificResource',
        source: 'https://example.org/canvas/1',
        partOf: { id: 'https://example.org/manifest.json', type: 'Manifest' },
        selector: { value: 'xywh=0,0,100,80' },
      },
      body: {
        type: 'mango:ViewerState',
        format: 'application/vnd.mango.story-state+json',
        'mango:storyVersion': '1.0',
        mangoState: {
          chapterId: 'chapter-1',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 80 },
          playback: { transitionMs: 2000 },
        },
      },
    },
  ],
};

describe('storyLoader.normaliseStoryInput', () => {
  it('accepts the Mango AnnotationPage profile', () => {
    const result = normaliseStoryInput(annotationPage);
    expect(result.ok).toBe(true);
    expect(result.story?.chapters[0]).toEqual(
      expect.objectContaining({
        id: 'chapter-1',
        manifest: 'https://example.org/manifest.json',
        transitionTimeMs: 2000,
      }),
    );
  });

  it('rejects the retired native story object and data wrapper', () => {
    const retiredStory = {
      version: '1.0',
      type: 'story',
      chapters: [],
    };
    expect(normaliseStoryInput(retiredStory)).toEqual({
      ok: false,
      error: 'Invalid story shape: expected a Mango story AnnotationPage',
    });
    expect(normaliseStoryInput({ data: retiredStory })).toEqual({
      ok: false,
      error: 'Invalid story shape: expected a Mango story AnnotationPage',
    });
  });

  it('rejects AnnotationPages without the Mango profile', () => {
    const result = normaliseStoryInput({
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://example.org/legacy-story',
      type: 'AnnotationPage',
      label: { en: ['Legacy story'] },
      items: [
        {
          id: 'https://example.org/legacy-story/chapter-1',
          type: 'Annotation',
          motivation: 'supplementing',
          target: {
            type: 'SpecificResource',
            source: 'https://example.org/canvas/1',
            partOf: { id: 'https://example.org/manifest', type: 'Manifest' },
            selector: { value: 'xywh=1,2,30,40' },
          },
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: 'Missing Mango story version',
    });
  });

  it('rejects an unsupported version of the Mango AnnotationPage profile', () => {
    const result = normaliseStoryInput({
      type: 'AnnotationPage',
      'mango:storyVersion': '2.0',
      items: [],
    });

    expect(result).toEqual({
      ok: false,
      error: 'Unsupported Mango story version: 2.0',
    });
  });

  it('rejects chapters without a versioned Mango viewer state body', () => {
    const invalidPage = structuredClone(annotationPage) as any;
    delete invalidPage.items[0].body['mango:storyVersion'];

    expect(normaliseStoryInput(invalidPage)).toEqual({
      ok: false,
      error: 'Invalid Mango story chapter state',
    });
  });

  it('rejects chapter state bodies with the wrong media type', () => {
    const invalidPage = structuredClone(annotationPage) as any;
    invalidPage.items[0].body.format = 'application/json';

    expect(normaliseStoryInput(invalidPage)).toEqual({
      ok: false,
      error: 'Invalid Mango story chapter state',
    });
  });
});

describe('storyLoader.validateStoryViewer', () => {
  it('accepts valid story', () => {
    const normalised = normaliseStoryInput(annotationPage);
    expect(normalised.ok).toBe(true);
    const validation = validateStoryViewer(normalised.story!);
    expect(validation.ok).toBe(true);
  });

  it('rejects missing chapters', () => {
    const normalised = normaliseStoryInput({
      type: 'AnnotationPage',
      'mango:storyVersion': '1.0',
      items: [],
    });
    const validation = normalised.story
      ? validateStoryViewer(normalised.story)
      : { ok: false, errors: [] };
    expect(validation.ok).toBe(false);
  });

  it('validates the actual demo.json', () => {
    const fs = require('fs');
    const path = require('path');
    const raw = fs.readFileSync(
      path.resolve(__dirname, '../../../../../apps/demo/test-story/demo.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw);
    const normalised = normaliseStoryInput(parsed);
    expect(normalised.ok).toBe(true);
    const validation = validateStoryViewer(normalised.story!);
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
  });

  it('loads the AnnotationPage layer demo with its opacity states', () => {
    const fs = require('fs');
    const path = require('path');
    const raw = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../../apps/demo/test-story/layers.json',
      ),
      'utf8',
    );
    const normalised = normaliseStoryInput(JSON.parse(raw));

    expect(normalised.ok).toBe(true);
    expect(normalised.story?.chapters).toHaveLength(4);
    expect(normalised.story?.chapters[1].layerOpacities).toEqual({
      'https://iiif.io/api/image/3.0/example/reference/421e65be2ce95439b3ad6ef1f2ab87a9-dee-xray/full/max/0/default.jpg': 0.3,
      'https://iiif.io/api/image/3.0/example/reference/421e65be2ce95439b3ad6ef1f2ab87a9-dee-natural/full/max/0/default.jpg': 0.59,
    });
  });
});
