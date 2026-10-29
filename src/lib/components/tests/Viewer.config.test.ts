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
  it('applies the configured theme to the viewer shell', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targets.push(target);
    mounted.push(mount(Viewer, { target, props: { config: { theme: 'light' } } }));

    const shell = target.querySelector<HTMLElement>('.viewer');
    expect(shell?.dataset.theme).toBe('light');
  });

  it('does not render the legacy stage dock alongside the viewer sidebar', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targets.push(target);
    mounted.push(mount(Viewer, { target }));

    expect(target.querySelector('.viewer-sidebar')).toBeTruthy();
    expect(target.querySelector('.viewer__dock')).toBeNull();
  });

  it('opens and closes the IIIF manifest manager', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targets.push(target);
    mounted.push(mount(Viewer, { target }));

    const toggle = target.querySelector<HTMLButtonElement>(
      '[aria-label="IIIF manifests"]',
    );
    expect(toggle).toBeTruthy();
    toggle?.click();
    await tick();
    expect(target.querySelector('.viewer__manifest-overlay')).toBeTruthy();

    target.querySelector<HTMLButtonElement>('[aria-label="Close manifest manager"]')?.click();
    await tick();
    expect(target.querySelector('.viewer__manifest-overlay')).toBeNull();
  });

  it('collapses and restores the viewer sidebar', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targets.push(target);
    mounted.push(mount(Viewer, { target }));

    target.querySelector<HTMLButtonElement>('.viewer-sidebar__collapse')?.click();
    await tick();
    expect(target.querySelector('.viewer__control-rail')).toBeNull();

    const expand = target.querySelector<HTMLButtonElement>('.viewer__expand-sidebar');
    expect(expand).toBeTruthy();
    expand?.click();
    await tick();
    expect(target.querySelector('.viewer__control-rail')).toBeTruthy();
  });

  it('opens the multi-manifest workspace from viewer settings', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targets.push(target);
    mounted.push(mount(Viewer, { target }));

    const settingsButton = Array.from(
      target.querySelectorAll<HTMLButtonElement>('.viewer-sidebar__button'),
    ).find((button) => button.textContent?.includes('View settings'));
    settingsButton?.click();
    await tick();

    const layout = target.querySelector<HTMLSelectElement>(
      '[aria-label="Comparison layout"]',
    );
    expect(layout).toBeTruthy();
    const pageLayout = target.querySelector('[aria-label="Page layout"]');
    expect(
      pageLayout?.compareDocumentPosition(layout!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    layout!.value = '1x2';
    layout!.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(target.querySelector('.workspace-grid--column')).toBeTruthy();
    expect(target.querySelectorAll('.workspace-window')).toHaveLength(2);
  });

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

    const toggle = target.querySelector<HTMLButtonElement>('[data-tone="info"]');
    expect(toggle).toBeTruthy();
    if (toggle?.getAttribute('aria-pressed') !== 'true') {
      toggle!.click();
      await tick();
    }

    await vi.waitFor(() => {
      expect(target.querySelector('.panel--metadata')).toBeTruthy();
    });
    const panel = target.querySelector('.panel--metadata');
    expect(panel).toBeTruthy();
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');

    toggle!.click();
    await tick();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    expect(panel?.isConnected).toBe(true);

    toggle!.click();
    await tick();
    expect(target.querySelector('.panel--metadata')).toBe(panel);
  });
});
