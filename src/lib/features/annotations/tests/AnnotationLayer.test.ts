import { mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import AnnotationLayer from '../AnnotationLayer.svelte';

describe('AnnotationLayer search highlighting', () => {
  it('marks search hits independently of their annotation colour', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const component = mount(AnnotationLayer, {
      target,
      props: {
        annotations: [
          {
            id: 'search-hit',
            rect: { x: 10, y: 20, w: 30, h: 40 },
            targetStyle: 'stroke: #facc15; fill: rgba(250, 204, 21, 0.18);',
          },
        ],
        viewBox: { x: 0, y: 0, w: 100, h: 100 },
        width: 500,
        height: 500,
        highlightIds: ['search-hit'],
      },
    });

    expect(
      target
        .querySelector('rect')
        ?.classList.contains('annotation-layer__shape--hit'),
    ).toBe(true);

    unmount(component);
    target.remove();
  });
});
