import { get, writable } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { parseSearchResponse } from '@mango-iiif/iiif-search-client';
import { createViewerState } from '../../state/viewerState';
import {
  createAnnotationDerivedStores,
  createIIIFSearchClient,
  mapIIIFSearchResult,
} from '../derived';

describe('IIIF search package adapter', () => {
  it('maps normalized package hits into Mango annotations', () => {
    const normalized = parseSearchResponse({
      '@context': 'http://iiif.io/api/search/1/context.json',
      '@id': 'https://example.org/search?q=detail',
      '@type': 'sc:AnnotationList',
      within: { total: 1 },
      hits: [
        {
          '@type': 'search:Hit',
          annotations: ['annotation-1'],
          match: 'matching detail',
        },
      ],
      resources: [
        {
          '@id': 'annotation-1',
          '@type': 'oa:Annotation',
          resource: { '@type': 'cnt:ContentAsText', chars: 'result text' },
          on: 'https://example.org/canvas/1#xywh=10,20,30,40',
        },
      ],
    });

    expect(mapIIIFSearchResult(normalized)).toEqual([
      expect.objectContaining({
        id: 'annotation-1',
        text: 'result text',
        canvasId: 'https://example.org/canvas/1',
        rect: { x: 10, y: 20, w: 30, h: 40 },
      }),
    ]);
  });

  it('falls back to searching annotations across every canvas', () => {
    const annotationFor = (id: string, canvasId: string, text: string) => ({
      id,
      type: 'Annotation',
      body: { type: 'TextualBody', value: text },
      target: `${canvasId}#xywh=10,20,30,40`,
    });
    const canvasObjects = [
      {
        id: 'canvas-1',
        getAnnotations: () => [
          { getItems: () => [annotationFor('annotation-1', 'canvas-1', 'Shared term one')] },
        ],
        getOtherContent: () => [],
      },
      {
        id: 'canvas-2',
        getAnnotations: () => [
          { getItems: () => [annotationFor('annotation-2', 'canvas-2', 'Shared term two')] },
        ],
        getOtherContent: () => [],
      },
    ];
    const canvases = [
      { id: 'canvas-1', index: 0 },
      { id: 'canvas-2', index: 1 },
    ];
    const manifestEntry = writable({
      id: 'manifest-1',
      manifesto: {
        getSequences: () => [{ getCanvases: () => canvasObjects }],
      },
      canvases,
      isFetching: false,
    });
    const state = createViewerState();
    state.showSearch.set(true);
    state.searchQuery.set('shared term');

    const stores = createAnnotationDerivedStores({
      manifestEntry,
      canvases: writable(canvases),
      state,
    });

    expect(get(stores.searchHits)).toEqual([
      expect.objectContaining({ id: 'annotation-1', canvasId: 'canvas-1' }),
      expect.objectContaining({ id: 'annotation-2', canvasId: 'canvas-2' }),
    ]);
  });

  it('uses the package client with a legacy Search 0 service URL', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          '@type': 'sc:AnnotationList',
          within: { total: 1 },
          hits: [{ annotations: ['annotation-1'], match: 'term' }],
          resources: [
            {
              '@id': 'annotation-1',
              resource: { chars: 'term' },
              on: 'canvas-2#xywh=1,2,3,4',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = createIIIFSearchClient(
      {
        service: {
          '@id': 'https://example.org/search/v0',
          profile: 'http://iiif.io/api/search/0/search',
        },
      },
      fetcher,
    );

    const response = await client.search({ q: 'term' });

    expect(fetcher).toHaveBeenCalledOnce();
    const [requestUrl, requestInit] = fetcher.mock.calls[0];
    expect(requestUrl.toString()).toBe('https://example.org/search/v0?q=term');
    expect((requestInit?.headers as Record<string, string>).Accept).toContain(
      'application/json',
    );
    expect(mapIIIFSearchResult(response)).toEqual([
      expect.objectContaining({ id: 'annotation-1', canvasId: 'canvas-2' }),
    ]);
  });
});
