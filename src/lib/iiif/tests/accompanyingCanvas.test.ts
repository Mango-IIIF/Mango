import { describe, expect, it } from 'vitest';
import * as manifesto from 'manifesto.js';
import { resolveAccompanyingCanvasMedia } from '../avResolver';
import { resolveMediaFromCanvas } from '../mediaResolver';

const accompanyingCanvas = {
  id: 'https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/canvas/accompanying',
  type: 'Canvas',
  label: {
    en: ['First page of score for Gustav Mahler, Symphony No. 3'],
  },
  height: 998,
  width: 772,
  items: [
    {
      id: 'https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/canvas/accompanying/annotation/page',
      type: 'AnnotationPage',
      items: [
        {
          id: 'https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/canvas/accompanying/annotation/image',
          type: 'Annotation',
          motivation: 'painting',
          body: {
            id: 'https://iiif.io/api/image/3.0/example/reference/4b45bba3ea612ee46f5371ce84dbcd89-mahler-0/full/,998/0/default.jpg',
            type: 'Image',
            format: 'image/jpeg',
            height: 998,
            width: 772,
            service: [
              {
                id: 'https://iiif.io/api/image/3.0/example/reference/4b45bba3ea612ee46f5371ce84dbcd89-mahler-0',
                type: 'ImageService3',
                profile: 'level1',
              },
            ],
          },
          target: 'https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/canvas/accompanying',
        },
      ],
    },
  ],
};

const manifestJson = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/manifest.json',
  type: 'Manifest',
  label: {
    en: ["Partial audio recording of Gustav Mahler's _Symphony No. 3_"],
  },
  items: [
    {
      id: 'https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/canvas/p1',
      type: 'Canvas',
      label: {
        en: ['Gustav Mahler, Symphony No. 3, CD 1'],
      },
      duration: 1985.024,
      accompanyingCanvas,
      items: [
        {
          id: 'https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/canvas/page/p1',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/canvas/page/annotation/segment1-audio',
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: 'https://fixtures.iiif.io/audio/indiana/mahler-symphony-3/CD1/medium/128Kbps.mp4',
                type: 'Sound',
                duration: 1985.024,
                format: 'video/mp4',
              },
              target: 'https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/canvas/p1',
            },
          ],
        },
      ],
    },
  ],
};

const manifest = manifesto.parseManifest(manifestJson);

describe('accompanyingCanvas media resolution', () => {
  it('resolves image media from a plain IIIF canvas object', () => {
    const resolved = resolveMediaFromCanvas(accompanyingCanvas);

    expect(resolved.primary).toEqual({
      type: 'image',
      id: 'https://iiif.io/api/image/3.0/example/reference/4b45bba3ea612ee46f5371ce84dbcd89-mahler-0/full/,998/0/default.jpg',
      src: 'https://iiif.io/api/image/3.0/example/reference/4b45bba3ea612ee46f5371ce84dbcd89-mahler-0/info.json',
      format: 'image/jpeg',
      width: 772,
      height: 998,
      label: undefined,
    });
  });

  it('resolves the cookbook accompanying image from the audio canvas', () => {
    const source = resolveAccompanyingCanvasMedia(
      manifest,
      'https://iiif.io/api/cookbook/recipe/0014-accompanyingcanvas/canvas/p1',
    );

    expect(source?.type).toBe('image');
    expect(source?.src).toBe(
      'https://iiif.io/api/image/3.0/example/reference/4b45bba3ea612ee46f5371ce84dbcd89-mahler-0/info.json',
    );
  });
});
