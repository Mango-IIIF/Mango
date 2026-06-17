import { describe, expect, it } from 'vitest';
import * as manifesto from 'manifesto.js';
import { resolveMedia } from '../mediaResolver';

const cookbookAudioManifestJson = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://iiif.io/api/cookbook/recipe/0002-mvm-audio/manifest.json',
  type: 'Manifest',
  label: { en: ['Simplest Audio Example 1'] },
  items: [
    {
      id: 'https://iiif.io/api/cookbook/recipe/0002-mvm-audio/canvas',
      type: 'Canvas',
      duration: 1985.024,
      items: [
        {
          id: 'https://iiif.io/api/cookbook/recipe/0002-mvm-audio/canvas/page',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://iiif.io/api/cookbook/recipe/0002-mvm-audio/canvas/page/annotation',
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: 'https://fixtures.iiif.io/audio/indiana/mahler-symphony-3/CD1/medium/128Kbps.mp4',
                type: 'Sound',
                format: 'audio/mp4',
                duration: 1985.024,
              },
              target: 'https://iiif.io/api/cookbook/recipe/0002-mvm-audio/canvas',
            },
          ],
        },
      ],
    },
  ],
};

const cookbookAudioManifest = manifesto.parseManifest(cookbookAudioManifestJson);

describe('resolveMedia (cookbook audio manifest)', () => {
  it('resolves the primary audio source from the cookbook manifest', () => {
    const resolved = resolveMedia(
      cookbookAudioManifest,
      'https://iiif.io/api/cookbook/recipe/0002-mvm-audio/canvas',
    );

    expect(resolved.primary?.type).toBe('audio');
    expect(resolved.primary?.src).toBe(
      'https://fixtures.iiif.io/audio/indiana/mahler-symphony-3/CD1/medium/128Kbps.mp4',
    );
    expect(resolved.primary?.format).toBe('audio/mp4');
    expect(resolved.primary?.duration).toBe(1985.024);
  });
});
