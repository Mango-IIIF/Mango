import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Viewer from '../Viewer.svelte';

const mounted: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

afterEach(() => {
  mounted.splice(0).forEach((component) => unmount(component));
  targets.splice(0).forEach((target) => target.remove());
});

describe('Viewer config', () => {
  it('places the sidebar on the right', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targets.push(target);
    mounted.push(
      mount(Viewer, {
        target,
        props: { config: { sidebar: { position: 'right' } } },
      }),
    );

    expect(target.querySelector('.viewer__grid--sidebar-right')).toBeTruthy();
  });

  it('hides the settings button when showSettings is false', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targets.push(target);
    mounted.push(
      mount(Viewer, {
        target,
        props: { config: { showSettings: false } },
      }),
    );

    expect(target.querySelector('[aria-label="Toggle settings"]')).toBeNull();
  });

  it('removes the sidebar and its control rail when sidebar.enabled is false', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targets.push(target);
    mounted.push(
      mount(Viewer, {
        target,
        props: { config: { sidebar: { enabled: false } } },
      }),
    );

    expect(target.querySelector('.viewer__control-rail')).toBeNull();
    expect(target.querySelector('.panel-stack--left')).toBeNull();
    expect(target.querySelector('.viewer__grid--left')).toBeNull();
  });

  it('keeps an invoked panel mounted when it is closed and reopened', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targets.push(target);
    mounted.push(mount(Viewer, { target }));
    await tick();

    const toggle = target.querySelector<HTMLButtonElement>('[aria-label="Toggle metadata"]');
    expect(toggle).toBeTruthy();
    if (toggle?.getAttribute('aria-pressed') !== 'true') {
      toggle!.click();
      await tick();
    }

    const panel = target.querySelector('[aria-label="Metadata panel"]');
    expect(panel).toBeTruthy();
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');

    toggle!.click();
    await tick();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    expect(panel?.isConnected).toBe(true);

    toggle!.click();
    await tick();
    expect(target.querySelector('[aria-label="Metadata panel"]')).toBe(panel);
  });
});
