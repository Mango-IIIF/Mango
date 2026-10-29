import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StageToolbar from './StageToolbar.svelte';

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(() => {
  mounted.splice(0).forEach((component) => unmount(component));
  document.body.replaceChildren();
});

describe('StageToolbar', () => {
  it('requests the next clockwise rotation', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onrotate = vi.fn();
    mounted.push(
      mount(StageToolbar, {
        target,
        props: {
          mediaType: 'image',
          hasSource: true,
          rotation: 90,
          onrotate,
        },
      }),
    );

    target.querySelector<HTMLButtonElement>('[aria-label="Rotate right"]')?.click();

    expect(onrotate).toHaveBeenCalledWith({ rotation: 180 });
  });
});
