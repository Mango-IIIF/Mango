import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import SaveExportModal from '../SaveExportModal.svelte';

describe('SaveExportModal', () => {
  it('marks the viewer grid as a focused modal workspace while open', async () => {
    const grid = document.createElement('div');
    grid.className = 'viewer__grid';
    const target = document.createElement('div');
    grid.appendChild(target);
    document.body.appendChild(grid);

    const instance = mount(SaveExportModal, {
      target,
      props: {
        open: true,
        payload: { id: 'https://example.org/story', type: 'AnnotationPage' },
      },
    });
    await tick();

    expect(grid.classList.contains('viewer__grid--export-modal')).toBe(true);

    unmount(instance);
    expect(grid.classList.contains('viewer__grid--export-modal')).toBe(false);
    grid.remove();
  });
});
