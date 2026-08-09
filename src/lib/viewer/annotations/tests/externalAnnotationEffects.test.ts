import { describe, expect, it, vi } from 'vitest';
import { writable } from 'svelte/store';
import { createExternalAnnotationEffects } from '../externalAnnotations';

describe('external annotation stylesheet safety', () => {
  it('preserves stylesheet references as data without fetching or injecting them', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const annotations = writable([
      {
        id: 'https://example.org/annotation/1',
        stylesheets: ['https://attacker.example/annotation.css'],
      },
    ]);
    const effects = createExternalAnnotationEffects({
      state: {
        selectedCanvasIndex: writable(0),
        externalAnnotations: writable({}),
      } as never,
      derived: {
        manifestEntry: writable(null),
        canvases: writable([]),
        annotations,
      } as never,
    });

    annotations.set([
      {
        id: 'https://example.org/annotation/1',
        stylesheets: ['https://attacker.example/changed.css'],
      },
    ]);
    await Promise.resolve();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelector('[data-annotation-stylesheet]')).toBeNull();
    effects.destroy();
    fetchSpy.mockRestore();
  });
});
