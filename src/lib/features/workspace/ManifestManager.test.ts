import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import ManifestManager from './ManifestManager.svelte';
import { manifestsStore } from '../../core/state/manifests';

const FAVOURITES_STORAGE_KEY = 'mango-workspace-manifest-favourites:v1';
const FIRST_SEEDED_ID =
  'https://iiif.wellcomecollection.org/presentation/v2/b18035723';

const createTarget = (): HTMLDivElement => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return target;
};

describe('ManifestManager', () => {
  beforeEach(() => {
    localStorage.clear();
    manifestsStore.set({});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const id = String(input);
        return new Response(
          JSON.stringify({
            id,
            type: 'Manifest',
            label: { en: ['Test manifest'] },
            items: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('persists favourite manifests and filters the library to them', async () => {
    const target = createTarget();
    const instance = mount(ManifestManager, { target });
    await tick();

    const favouriteButton = target.querySelector(
      '.manifest-card__favourite[aria-label*="Wellcome Collection"]',
    ) as HTMLButtonElement;
    expect(favouriteButton).toBeTruthy();
    expect(favouriteButton.getAttribute('aria-pressed')).toBe('false');

    favouriteButton.click();
    await tick();
    expect(JSON.parse(localStorage.getItem(FAVOURITES_STORAGE_KEY) ?? '[]')).toEqual([
      FIRST_SEEDED_ID,
    ]);

    const favouritesTab = Array.from(target.querySelectorAll('.filter-tabs button')).find(
      (button) => button.textContent === 'Favourites',
    ) as HTMLButtonElement;
    favouritesTab.click();
    await tick();

    expect(target.querySelectorAll('.manifest-card')).toHaveLength(1);
    expect(target.textContent).toContain('Wellcome Collection');
    unmount(instance);
  });

  it('restores favourites from local storage', async () => {
    localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify([FIRST_SEEDED_ID]));
    const target = createTarget();
    const instance = mount(ManifestManager, { target });
    await tick();

    const favouriteButton = target.querySelector(
      '.manifest-card__favourite[aria-label*="Wellcome Collection"]',
    ) as HTMLButtonElement;
    expect(favouriteButton.getAttribute('aria-pressed')).toBe('true');
    unmount(instance);
  });

  it('switches to the add manifest URL form', async () => {
    const target = createTarget();
    const instance = mount(ManifestManager, { target });

    const addButton = Array.from(target.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Add manifest URL'),
    ) as HTMLButtonElement;
    addButton.click();
    await tick();

    expect(target.querySelector('#manifest-manager-url')).toBeTruthy();
    expect(target.querySelector('h2')?.textContent).toContain('Add manifest URL');
    unmount(instance);
  });
});
