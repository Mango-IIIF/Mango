import { describe, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import RectanglePlacementEditor from '../RectanglePlacementEditor.svelte';

describe('RectanglePlacementEditor', () => {
  it('renders annotation text inside the editable rectangle', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const instance = mount(RectanglePlacementEditor, {
      target,
      props: {
        value: { x: 0.2, y: 0.3, w: 0.4, h: 0.25 },
        text: 'Existing annotation',
        allowCreate: false,
      },
    });

    await tick();

    const label = target.querySelector(
      '[data-testid="rect-placement-editor-label"]',
    ) as HTMLElement | null;
    expect(label?.textContent?.trim()).toBe('Existing annotation');
    expect(label?.style.left).toBe('20%');
    expect(label?.style.top).toBe('30%');
    expect(label?.style.width).toBe('40%');
    expect(label?.style.height).toBe('25%');
    expect(target.querySelector('svg text')).toBeNull();

    const container = target.querySelector(
      '.rect-placement-editor',
    ) as HTMLDivElement;
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        toJSON: () => ({}),
      }),
    });
    window.dispatchEvent(new Event('resize'));

    const svg = target.querySelector('svg') as SVGElement;
    svg.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        clientX: 40,
        clientY: 40,
      }),
    );
    svg.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 50,
        clientY: 50,
      }),
    );
    await tick();

    const movedLabel = target.querySelector(
      '[data-testid="rect-placement-editor-label"]',
    ) as HTMLElement | null;
    expect(movedLabel?.style.left).toBe('30%');
    expect(movedLabel?.style.top).toBe('40%');

    unmount(instance);
    target.remove();
  });
});
