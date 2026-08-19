import { describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import StoryFrameLayer from '../StoryFrameLayer.svelte';
import type { StoryFrame } from '../../../core/types/story';

/*
 * The layer is driven through the same pointer events an author produces.
 * The stand-in viewer has no viewport, so the editor projects the canvas
 * straight onto the container: with both 800×400, one canvas pixel is one
 * element pixel and the numbers below read directly.
 */
const createViewer = () => {
  const container = document.createElement('div');
  container.className = 'viewer';
  document.body.appendChild(container);
  Object.defineProperty(container, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 400,
      width: 800,
      height: 400,
      toJSON: () => ({}),
    }),
  });
  return { container };
};

const pointer = (target: Element, type: string, x: number, y: number) =>
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }),
  );

const chapterFrame = (overrides: Partial<StoryFrame> = {}): StoryFrame => ({
  id: 'chapter',
  kind: 'chapter',
  viewBox: { x: 100, y: 100, w: 400, h: 200 },
  aspect: 2,
  editable: true,
  ...overrides,
});

const mountLayer = (frames: StoryFrame[], selectedFrameId: string | null = 'chapter') => {
  const viewer = createViewer();
  const onframecommit = vi.fn();
  const onframeselect = vi.fn();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const instance = mount(StoryFrameLayer, {
    target: host,
    props: {
      viewer,
      canvasWidth: 800,
      canvasHeight: 400,
      frames,
      selectedFrameId,
      onframecommit,
      onframeselect,
    },
  });
  const svg = () => viewer.container.querySelector('svg') as SVGSVGElement;
  const handle = (name: string) =>
    viewer.container.querySelector(`[data-handle="${name}"]`) as SVGElement | null;
  const cleanup = () => {
    unmount(instance);
    host.remove();
    viewer.container.remove();
  };
  return { viewer, svg, handle, onframecommit, onframeselect, cleanup };
};

describe('StoryFrameLayer', () => {
  it('draws the frame as an unfilled outline with its label and handles', async () => {
    const { viewer, handle, cleanup } = mountLayer([chapterFrame()]);
    await tick();

    const shape = viewer.container.querySelector('.story-frame') as SVGGElement;
    expect(shape).toBeTruthy();
    expect(shape.classList.contains('story-frame--chapter')).toBe(true);
    expect(shape.classList.contains('story-frame--selected')).toBe(true);
    expect(shape.classList.contains('story-frame--editable')).toBe(true);
    // Nothing painted inside: the canvas underneath still takes the drag.
    for (const rect of shape.querySelectorAll('rect')) {
      expect(rect.getAttribute('fill')).toBe('none');
    }
    expect(shape.querySelector('.story-frame__line')).toBeTruthy();
    expect(shape.querySelector('.story-frame__halo')).toBeTruthy();
    expect(viewer.container.querySelector('.story-frame__label')?.textContent).toBe('Frame');
    // Selected from the start, so the handles are there to take hold of.
    expect(handle('se')).toBeTruthy();
    expect(handle('e')).toBeTruthy();
    cleanup();
  });

  it('holds a corner drag to the aspect, anchored on the opposite corner, and commits once', async () => {
    const { svg, handle, onframecommit, cleanup } = mountLayer([chapterFrame()]);
    await tick();

    // South-east handle sits at (500, 300). Drag it out along the diagonal.
    pointer(handle('se')!, 'pointerdown', 500, 300);
    pointer(svg(), 'pointermove', 700, 400);
    pointer(svg(), 'pointerup', 700, 400);
    await tick();

    expect(onframecommit).toHaveBeenCalledTimes(1);
    const { frameId, viewBox } = onframecommit.mock.calls[0][0];
    expect(frameId).toBe('chapter');
    expect(viewBox.x).toBeCloseTo(100, 6);
    expect(viewBox.y).toBeCloseTo(100, 6);
    expect(viewBox.w).toBeCloseTo(600, 6);
    expect(viewBox.h).toBeCloseTo(300, 6);
    expect(viewBox.w / viewBox.h).toBeCloseTo(2, 9);
    cleanup();
  });

  it('keeps an edge drag centred on the axis the handle did not touch', async () => {
    const { svg, handle, onframecommit, cleanup } = mountLayer([chapterFrame()]);
    await tick();

    // East handle sits at (500, 200).
    pointer(handle('e')!, 'pointerdown', 500, 200);
    pointer(svg(), 'pointermove', 600, 200);
    pointer(svg(), 'pointerup', 600, 200);
    await tick();

    const { viewBox } = onframecommit.mock.calls[0][0];
    expect(viewBox.w).toBeCloseTo(500, 6);
    expect(viewBox.h).toBeCloseTo(250, 6);
    expect(viewBox.x).toBeCloseTo(100, 6);
    // Vertical centre stays at 200.
    expect(viewBox.y + viewBox.h / 2).toBeCloseTo(200, 6);
    cleanup();
  });

  it('moves a frame by its outline without changing its size', async () => {
    const { viewer, svg, onframecommit, cleanup } = mountLayer([chapterFrame()]);
    await tick();

    // The halo band is the thing to take hold of: just inside the left edge,
    // clear of the edge handle at its midpoint.
    const halo = viewer.container.querySelector('.story-frame__halo') as SVGElement;
    pointer(halo, 'pointerdown', 102, 150);
    pointer(svg(), 'pointermove', 152, 180);
    pointer(svg(), 'pointerup', 152, 180);
    await tick();

    const { viewBox } = onframecommit.mock.calls[0][0];
    expect(viewBox).toEqual({ x: 150, y: 130, w: 400, h: 200 });
    cleanup();
  });

  it('keeps the selection when the author clicks the canvas to pan', async () => {
    const { viewer, handle, onframeselect, cleanup } = mountLayer([chapterFrame()]);
    await tick();
    expect(handle('se')).toBeTruthy();

    // A pointerdown on the container outside the editor's own root: the
    // editor deselects, the layer puts the selection straight back.
    pointer(viewer.container, 'pointerdown', 700, 50);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();

    expect(handle('se')).toBeTruthy();
    expect(onframeselect).not.toHaveBeenCalled();
    cleanup();
  });

  it('leaves a passive frame out of reach and a keyframe labelled by number', async () => {
    const { viewer, handle, cleanup } = mountLayer(
      [
        chapterFrame({ editable: false }),
        {
          id: 'keyframe:a',
          kind: 'keyframe',
          viewBox: { x: 200, y: 150, w: 200, h: 100 },
          aspect: 2,
          label: '1',
          editable: true,
        },
      ],
      'keyframe:a',
    );
    await tick();

    const chapter = viewer.container.querySelector('.story-frame--chapter') as SVGGElement;
    expect(chapter.classList.contains('story-frame--passive')).toBe(true);
    expect(chapter.style.pointerEvents).toBe('none');

    const keyframe = viewer.container.querySelector('.story-frame--keyframe') as SVGGElement;
    expect(keyframe.classList.contains('story-frame--selected')).toBe(true);
    const labels = [...viewer.container.querySelectorAll('.story-frame__label')].map(
      (label) => label.textContent,
    );
    expect(labels).toContain('1');
    expect(handle('nw')).toBeTruthy();
    cleanup();
  });
});
