import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ViewerDock from './ViewerDock.svelte';

const mounted: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];

afterEach(() => {
  mounted.splice(0).forEach((component) => unmount(component));
  targets.splice(0).forEach((target) => target.remove());
});

const renderDock = (props: Record<string, unknown> = {}) => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  targets.push(target);
  mounted.push(
    mount(ViewerDock, {
      target,
      props: { variant: 'sidebar', ...props },
    }),
  );
  return target;
};

describe('ViewerDock navigation availability', () => {
  it('does not render controls without an implemented action', () => {
    const target = renderDock();

    expect(target.textContent).toContain('IIIF manifests');
    expect(target.textContent).not.toContain('Download');
    expect(target.textContent).not.toContain('Share');
    expect(target.textContent).not.toContain('Cite');
  });

});
