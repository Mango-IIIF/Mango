import { describe, it, expect } from 'vitest';
import * as manifesto from 'manifesto.js';
import { resolveMedia } from '../mediaResolver';

const manifestJson = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  'id': 'https://example.org/manifest.json',
  'type': 'Manifest',
  items: [
    {
      id: 'canvas-image',
      type: 'Canvas',
      items: [
        {
          type: 'AnnotationPage',
          items: [
            {
              id: 'anno-image',
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: 'https://example.org/iiif/image/abc/full/full/0/default.jpg',
                type: 'Image',
                format: 'image/jpeg',
                service: [
                  {
                    id: 'https://example.org/iiif/image/abc',
                    type: 'ImageService2',
                  },
                ],
              },
              target: 'canvas-image',
            },
          ],
        },
      ],
      rendering: [
        {
          id: 'https://example.org/download/image.tif',
          type: 'Image',
          format: 'image/tiff',
        },
      ],
    },
    {
      id: 'canvas-video',
      type: 'Canvas',
      items: [
        {
          type: 'AnnotationPage',
          items: [
            {
              id: 'anno-video',
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: 'https://example.org/media/video.mp4',
                type: 'Video',
                format: 'video/mp4',
              },
              target: 'canvas-video',
            },
          ],
        },
      ],
    },
    {
      id: 'canvas-audio',
      type: 'Canvas',
      items: [
        {
          type: 'AnnotationPage',
          items: [
            {
              id: 'anno-audio',
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: 'https://example.org/media/audio.mp3',
                type: 'Sound',
                format: 'audio/mpeg',
              },
              target: 'canvas-audio',
            },
          ],
        },
      ],
    },
    {
      id: 'canvas-pdf',
      type: 'Canvas',
      rendering: [
        {
          id: 'https://example.org/documents/sample.pdf',
          type: 'Document',
          format: 'application/pdf',
        },
      ],
    },
    {
      id: 'canvas-model',
      type: 'Canvas',
      items: [
        {
          type: 'AnnotationPage',
          items: [
            {
              id: 'anno-model',
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: 'https://example.org/models/ship.glb',
                type: 'Model',
                format: 'model/gltf-binary',
              },
              target: 'canvas-model',
            },
          ],
        },
      ],
    },
  ],
};

const manifest = manifesto.parseManifest(manifestJson);

describe('resolveMedia', () => {
  it('resolves IIIF image services', () => {
    const resolved = resolveMedia(manifest, 'canvas-image');
    expect(resolved.primary?.type).toBe('image');
    expect(resolved.primary?.src).toBe('https://example.org/iiif/image/abc/info.json');
    expect(resolved.alternates).toEqual([]);
  });

  it('resolves video bodies', () => {
    const resolved = resolveMedia(manifest, 'canvas-video');
    expect(resolved.primary?.type).toBe('video');
    expect(resolved.primary?.src).toBe('https://example.org/media/video.mp4');
  });

  it('resolves audio bodies', () => {
    const resolved = resolveMedia(manifest, 'canvas-audio');
    expect(resolved.primary?.type).toBe('audio');
    expect(resolved.primary?.src).toBe('https://example.org/media/audio.mp3');
  });

  it('resolves PDF renderings', () => {
    const resolved = resolveMedia(manifest, 'canvas-pdf');
    expect(resolved.primary?.type).toBe('pdf');
    expect(resolved.primary?.src).toBe('https://example.org/documents/sample.pdf');
  });

  it('resolves 3D model bodies', () => {
    const resolved = resolveMedia(manifest, 'canvas-model');
    expect(resolved.primary?.type).toBe('model');
    expect(resolved.primary?.src).toBe('https://example.org/models/ship.glb');
  });
});
