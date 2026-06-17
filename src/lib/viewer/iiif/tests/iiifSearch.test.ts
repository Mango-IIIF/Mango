import { describe, it, expect } from 'vitest';
import { getSearchServiceUrl, searchIIIF } from '../iiifSearch';

describe('getSearchServiceUrl', () => {
  it('should extract search service URL from IIIF v2 manifest', () => {
    const manifest = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'http://example.org/manifest',
      service: [
        {
          '@context': 'http://iiif.io/api/search/0/context.json',
          '@id': 'https://example.org/search/v0/manifest1',
          profile: 'http://iiif.io/api/search/0/search',
          label: 'Search within this manifest',
        },
      ],
    };

    const url = getSearchServiceUrl(manifest);
    expect(url).toBe('https://example.org/search/v0/manifest1');
  });

  it('should extract search service URL from IIIF v3 manifest', () => {
    const manifest = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'http://example.org/manifest',
      service: [
        {
          id: 'https://example.org/search/v1/manifest1',
          type: 'SearchService1',
          profile: 'http://iiif.io/api/search/1/search',
        },
      ],
    };

    const url = getSearchServiceUrl(manifest);
    expect(url).toBe('https://example.org/search/v1/manifest1');
  });

  it('should return null when no search service exists', () => {
    const manifest = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'http://example.org/manifest',
    };

    const url = getSearchServiceUrl(manifest);
    expect(url).toBeNull();
  });

  it('should handle multiple services and find search service', () => {
    const manifest = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'http://example.org/manifest',
      service: [
        {
          '@id': 'https://example.org/image/service',
          profile: 'http://iiif.io/api/image/2/level1.json',
        },
        {
          '@context': 'http://iiif.io/api/search/0/context.json',
          '@id': 'https://example.org/search/v0/manifest1',
          profile: 'http://iiif.io/api/search/0/search',
        },
      ],
    };

    const url = getSearchServiceUrl(manifest);
    expect(url).toBe('https://example.org/search/v0/manifest1');
  });
});

describe('searchIIIF', () => {
  it('should parse IIIF search results correctly', async () => {
    const mockResponse = {
      '@context': 'http://iiif.io/api/search/0/context.json',
      '@id': 'https://example.org/search/v0/manifest1?q=test',
      '@type': 'sc:AnnotationList',
      within: {
        '@type': 'sc:Layer',
        total: 2,
      },
      resources: [
        {
          '@id': 'https://example.org/annotation/1',
          '@type': 'oa:Annotation',
          motivation: 'sc:painting',
          resource: {
            '@type': 'cnt:ContentAsText',
            chars: 'This is a test annotation',
          },
          on: 'https://example.org/canvas/1#xywh=100,200,300,400',
        },
        {
          '@id': 'https://example.org/annotation/2',
          '@type': 'oa:Annotation',
          motivation: 'sc:painting',
          resource: {
            '@type': 'cnt:ContentAsText',
            chars: 'Another test result',
          },
          on: 'https://example.org/canvas/2',
        },
      ],
    };

    const mockFetch = async () => ({
      ok: true,
      json: async () => mockResponse,
    });

    const results = await searchIIIF(
      'https://example.org/search/v0/manifest1',
      'test',
      mockFetch as any,
    );

    expect(results).toHaveLength(2);
    expect(results[0].text).toBe('This is a test annotation');
    expect(results[0].rect).toEqual({ x: 100, y: 200, w: 300, h: 400 });
    expect(results[1].text).toBe('Another test result');
    expect(results[1].rect).toBeUndefined();
  });

  it('should handle empty search results', async () => {
    const mockResponse = {
      '@context': 'http://iiif.io/api/search/0/context.json',
      '@id': 'https://example.org/search/v0/manifest1?q=nonexistent',
      '@type': 'sc:AnnotationList',
      within: {
        '@type': 'sc:Layer',
        total: 0,
      },
      resources: [],
    };

    const mockFetch = async () => ({
      ok: true,
      json: async () => mockResponse,
    });

    const results = await searchIIIF(
      'https://example.org/search/v0/manifest1',
      'nonexistent',
      mockFetch as any,
    );

    expect(results).toHaveLength(0);
  });

  it('should handle fetch errors gracefully', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 500,
    });

    const results = await searchIIIF(
      'https://example.org/search/v0/manifest1',
      'test',
      mockFetch as any,
    );

    expect(results).toHaveLength(0);
  });

  it('should return empty array for empty query', async () => {
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({}),
    });

    const results = await searchIIIF(
      'https://example.org/search/v0/manifest1',
      '',
      mockFetch as any,
    );

    expect(results).toHaveLength(0);
  });
});
