import { describe, expect, it, vi } from 'vitest';
import { parseWebAnnotationPage, projectAnnotation } from '@mango-iiif/w3c-parser';
import { createMangoAnnotation, projectToResolved } from '../canonical';
import { exportAnnotationPage, isPublishable } from '../export';
import { createHostRepository, RepositoryError, adoptAssignedId } from '../repository';
import { MANGO_NOTE_KEY, DRAFT_ID_PREFIX } from '../profile';
import { buildLayerStylesheet, styleClassForLayer } from '../style';

const CANVAS = 'https://example.org/canvas/1';

const resolved = (overrides: Parameters<typeof createMangoAnnotation>[0]) =>
  projectToResolved(createMangoAnnotation(overrides), { provenance: 'local' })!;

describe('standards-shaped export', () => {
  it('produces an AnnotationPage a conformant reader can parse back', () => {
    const result = exportAnnotationPage([
      resolved({
        id: 'https://example.org/anno/1',
        canvasId: CANVAS,
        shape: { type: 'rect', geometry: { x: 10, y: 20, w: 30, h: 40 } },
        text: 'A note',
      }),
    ]);

    expect(result.page.type).toBe('AnnotationPage');
    const { document } = parseWebAnnotationPage(result.page);
    expect(document.items).toHaveLength(1);
    const projection = projectAnnotation(document.items[0]);
    expect(projection.text).toBe('A note');
    expect(projection.targets[0].shape).toEqual({
      type: 'rect',
      geometry: { x: 10, y: 20, w: 30, h: 40 },
    });
  });

  it('withholds private notes and says that it did', () => {
    const result = exportAnnotationPage([
      resolved({
        id: 'https://example.org/anno/2',
        canvasId: CANVAS,
        shape: { type: 'point', geometry: { x: 1, y: 2 } },
        text: 'Public',
        note: 'Private',
      }),
    ]);

    expect(JSON.stringify(result.page)).not.toContain('Private');
    expect(result.excludedPrivateFields).toEqual([
      { annotationId: 'https://example.org/anno/2', keys: [MANGO_NOTE_KEY] },
    ]);
  });

  it('includes private notes only when explicitly asked', () => {
    const annotation = resolved({
      id: 'https://example.org/anno/3',
      canvasId: CANVAS,
      shape: { type: 'point', geometry: { x: 1, y: 2 } },
      note: 'Private',
    });

    const withheld = exportAnnotationPage([annotation]);
    const included = exportAnnotationPage([annotation], { includePrivate: true });

    expect(JSON.stringify(withheld.page)).not.toContain('Private');
    expect(JSON.stringify(included.page)).toContain('Private');
    expect(included.excludedPrivateFields).toEqual([]);
  });

  it('reports annotations that still need a server-assigned identifier', () => {
    const result = exportAnnotationPage([
      resolved({
        canvasId: CANVAS,
        shape: { type: 'rect', geometry: { x: 0, y: 0, w: 5, h: 5 } },
      }),
    ]);

    expect(result.unresolvedIdentities).toHaveLength(1);
    expect(result.unresolvedIdentities[0]).toContain(DRAFT_ID_PREFIX);
    expect(isPublishable(result)).toBe(false);
  });

  it('carries layer colour as a stylesheet and a class, not an inline style', () => {
    const layer = { id: 'research', color: '#fb7185' };
    const result = exportAnnotationPage([
      resolved({
        id: 'https://example.org/anno/4',
        canvasId: CANVAS,
        shape: { type: 'rect', geometry: { x: 0, y: 0, w: 5, h: 5 } },
        styleClass: styleClassForLayer(layer.id),
        stylesheet: buildLayerStylesheet([layer]),
      }),
    ]);

    const annotation = (result.page.items as Array<Record<string, unknown>>)[0];
    expect((annotation.target as { styleClass?: string }).styleClass).toBe('research');
    expect(JSON.stringify(annotation.stylesheet)).toContain('#fb7185');
    expect((annotation.target as { style?: string }).style).toBeUndefined();
  });

  it('never exports an ordinary comment as painting', () => {
    const result = exportAnnotationPage([
      resolved({
        id: 'https://example.org/anno/5',
        canvasId: CANVAS,
        shape: { type: 'rect', geometry: { x: 0, y: 0, w: 5, h: 5 } },
        text: 'Commentary',
      }),
    ]);

    const annotation = (result.page.items as Array<Record<string, unknown>>)[0];
    expect(annotation.motivation).toBe('commenting');
    expect(result.validation.valid).toBe(true);
  });
});

describe('host repository', () => {
  const annotation = createMangoAnnotation({
    id: `${DRAFT_ID_PREFIX}1`,
    canvasId: CANVAS,
    shape: { type: 'rect', geometry: { x: 0, y: 0, w: 5, h: 5 } },
    text: 'Draft',
  });

  it('hands the host portable JSON rather than Mango internals', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    await createHostRepository({ create }).create(annotation);

    const sent = create.mock.calls[0][0];
    expect(sent.type).toBe('Annotation');
    expect(sent['@context']).toBeTruthy();
    expect(sent).not.toHaveProperty('shapeType');
  });

  it('adopts a server-assigned identifier', async () => {
    const repository = createHostRepository({
      create: async () => ({ id: 'https://example.org/anno/99', version: 'W/"1"' }),
    });

    const stored = await repository.create(annotation);
    expect(stored.annotation.id).toBe('https://example.org/anno/99');
    expect(stored.version).toBe('W/"1"');
  });

  it('reports a version conflict as a conflict rather than a failure', async () => {
    const repository = createHostRepository({
      update: async () => {
        throw Object.assign(new Error('Precondition Failed'), { status: 412 });
      },
    });

    await expect(repository.update(annotation)).rejects.toMatchObject({
      kind: 'conflict',
    });
  });

  it('marks a transport failure as retryable and a rejection as not', async () => {
    const network = createHostRepository({
      update: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const rejected = createHostRepository({
      update: async () => {
        throw Object.assign(new Error('Bad Request'), { status: 400 });
      },
    });

    await expect(network.update(annotation)).rejects.toSatisfy(
      (error: RepositoryError) => error.retryable,
    );
    await expect(rejected.update(annotation)).rejects.toSatisfy(
      (error: RepositoryError) => !error.retryable,
    );
  });

  it('refuses an unsupported operation instead of failing silently', async () => {
    await expect(createHostRepository({}).create(annotation)).rejects.toMatchObject({
      kind: 'forbidden',
    });
  });

  it('replaces a draft id across the page it belongs to', () => {
    const { document: page } = parseWebAnnotationPage({
      type: 'AnnotationPage',
      id: 'https://example.org/page/1',
      items: [
        {
          id: `${DRAFT_ID_PREFIX}1`,
          type: 'Annotation',
          motivation: 'commenting',
          body: { type: 'TextualBody', value: 'Draft' },
          target: CANVAS,
        },
      ],
    });

    const updated = adoptAssignedId(page, `${DRAFT_ID_PREFIX}1`, 'https://example.org/anno/7');
    expect(updated.items[0].id).toBe('https://example.org/anno/7');
  });
});
