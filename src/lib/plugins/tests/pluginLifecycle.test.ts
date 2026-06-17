// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import ViewerComponent from '../../components/Viewer.svelte';
import type { ViewerPlugin } from '../../core/types/plugin';

describe('viewer plugin lifecycle', () => {
  it('calls init and destroy once', async () => {
    const calls = { init: 0, destroy: 0 };
    const plugin: ViewerPlugin = {
      id: 'lifecycle-test',
      label: 'Lifecycle Test',
      slot: 'left',
      init() {
        calls.init += 1;
      },
      destroy() {
        calls.destroy += 1;
      },
    };

    const target = document.createElement('div');
    document.body.appendChild(target);

    const instance = mount(ViewerComponent, {
      target,
      props: {
        manifestId: '',
        config: {},
        plugins: [plugin],
      },
    });

    await tick();
    expect(calls.init).toBe(1);

    unmount(instance);
    expect(calls.destroy).toBe(1);

    target.remove();
  });
});
