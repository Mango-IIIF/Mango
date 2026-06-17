import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import Viewer from '../Viewer.svelte';

const createTarget = (): HTMLDivElement => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return target;
};

const waitFor = async (predicate: () => boolean): Promise<void> => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 1000) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

describe('Viewer (story-viewer mode)', () => {
  it('renders only stage and story controls', async () => {
    const target = createTarget();

    const instance = mount(Viewer, {
      target,
      props: {
        mode: 'story-viewer',
      },
    });

    await waitFor(() => Boolean(target.querySelector('[data-testid="story-controls-stage"]')));

    expect(target.querySelector('[data-testid="story-controls-stage"]')).toBeTruthy();
    expect(target.querySelector('.stage__toolbar')).toBeNull();
    expect(target.querySelector('.stage__counter')).toBeNull();
    expect(target.querySelector('.panel-stack')).toBeNull();
    expect(target.querySelector('.viewer__header')).toBeNull();

    unmount(instance);
    target.remove();
  });
});
