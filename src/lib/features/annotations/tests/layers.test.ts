import { describe, expect, it } from 'vitest';
import {
  archiveLayer,
  createLayer,
  mergeDiscoveredLayers,
  moveLayer,
  parseLayers,
  recolourLayer,
  renameLayer,
  resolveActiveLayer,
  serializeLayers,
  setLayerReadOnly,
  writableLayers,
  type AnnotationLayer,
} from '../layers';

const layers: AnnotationLayer[] = [
  { id: 'research', name: 'Research Notes', color: '#fb7185', visible: true },
  { id: 'mine', name: 'My Annotations', color: '#a78bfa', visible: true },
];

describe('durable layers', () => {
  it('keeps identity across a rename and a recolour', () => {
    const renamed = renameLayer(layers, 'research', 'Reading notes');
    const recoloured = recolourLayer(renamed, 'research', '#00ff00');

    // The id is what annotations reference. If either of these changed it, every
    // annotation in the layer would be orphaned.
    expect(recoloured[0].id).toBe('research');
    expect(recoloured[0].name).toBe('Reading notes');
    expect(recoloured[0].color).toBe('#00ff00');
  });

  it('refuses to rename a layer to nothing', () => {
    expect(renameLayer(layers, 'research', '   ')[0].name).toBe('Research Notes');
  });

  it('reorders without touching identity', () => {
    const moved = moveLayer(layers, 'mine', -1);
    expect(moved.map((layer) => layer.id)).toEqual(['mine', 'research']);

    // At the edges, nothing moves rather than wrapping around.
    expect(moveLayer(moved, 'mine', -1).map((layer) => layer.id)).toEqual(['mine', 'research']);
  });

  it('archives a layer instead of deleting it', () => {
    const archived = archiveLayer(layers, 'research');
    expect(archived[0].archived).toBe(true);
    expect(archived[0].visible).toBe(false);
    // The layer is still there, so its annotations are still reachable.
    expect(archived).toHaveLength(2);
  });

  it('does not offer archived or read-only layers for drawing', () => {
    const guarded = setLayerReadOnly(archiveLayer(layers, 'research'), 'mine', true);
    expect(writableLayers(guarded)).toHaveLength(0);
  });

  it('falls forward when the active layer stops being writable', () => {
    const guarded = archiveLayer(layers, 'research');
    expect(resolveActiveLayer(guarded, 'research')).toBe('mine');
    expect(resolveActiveLayer(guarded, 'mine')).toBe('mine');
  });

  it('adopts a layer an imported annotation names', () => {
    const merged = mergeDiscoveredLayers(layers, [{ id: 'wellcome-ocr', color: '#123456' }]);
    expect(merged).toHaveLength(3);
    expect(merged[2]).toMatchObject({ id: 'wellcome-ocr', name: 'Wellcome Ocr' });
  });

  it('does not duplicate a layer it already knows', () => {
    expect(mergeDiscoveredLayers(layers, [{ id: 'mine' }])).toHaveLength(2);
  });

  it('mints ids that do not collide', () => {
    const first = createLayer(layers);
    const second = createLayer([...layers, first]);
    expect(second.id).not.toBe(first.id);
  });

  it('round-trips through storage', () => {
    const stored = serializeLayers(archiveLayer(layers, 'research'));
    const restored = parseLayers(JSON.parse(JSON.stringify(stored)));
    expect(restored).toEqual(stored.layers);
  });

  it('survives a corrupt record without throwing', () => {
    // Layer state is convenience. Losing it should cost colour choices, not
    // annotations, so a bad record reads as "no stored layers".
    expect(parseLayers(null)).toBeNull();
    expect(parseLayers({ version: 99, layers: [] })).toBeNull();
    expect(parseLayers({ version: 1, layers: [{ name: 'no id' }] })).toBeNull();
    expect(parseLayers({ version: 1, layers: [{ id: 'ok' }] })).toEqual([
      { id: 'ok', name: 'Ok', color: '#a78bfa', visible: true },
    ]);
  });
});
