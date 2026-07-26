import { describe, it, expect, vi } from 'vitest';
import { mount } from 'svelte';
import MangoFooterBrand from '../MangoFooterBrand.svelte';
import MangoAboutModal from '../MangoAboutModal.svelte';

describe('MangoFooterBrand & MangoAboutModal', () => {
  it('renders the Mango footer brand button and opens modal when clicked', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const instance = mount(MangoFooterBrand, {
      target,
      props: {
        position: 'fixed',
      },
    });

    const button = target.querySelector('.mango-footer-brand__button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Mango');

    // Click button to open modal
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const modal = document.querySelector('.mango-about-modal');
    expect(modal).not.toBeNull();

    const title = document.querySelector('#mango-about-title');
    expect(title?.textContent).toBe('Mango Viewer');

    const versionBadge = document.querySelector('.mango-about-modal__version');
    expect(versionBadge?.textContent).toBe('v0.0.4');

    const link = document.querySelector('.mango-about-modal__link') as HTMLAnchorElement;
    expect(link?.href).toBe('https://mangoviewer.dev/');

    // Click close button
    const closeBtn = document.querySelector('.mango-about-modal__close') as HTMLButtonElement;
    closeBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.querySelector('.mango-about-modal')).toBeNull();
  });

  it('renders MangoAboutModal directly and handles close trigger', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onClose = vi.fn();

    mount(MangoAboutModal, {
      target,
      props: {
        open: true,
        onClose,
      },
    });

    const title = document.querySelector('#mango-about-title');
    expect(title?.textContent).toBe('Mango Viewer');

    const closeBtn = document.querySelector('.mango-about-modal__close') as HTMLButtonElement;
    closeBtn.click();
    expect(onClose).toHaveBeenCalled();
  });
});
