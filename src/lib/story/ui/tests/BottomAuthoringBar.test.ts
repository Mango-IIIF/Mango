import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import BottomAuthoringBar from '../BottomAuthoringBar.svelte';

const createTarget = (): HTMLDivElement => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return target;
};

describe('BottomAuthoringBar', () => {
  it('shows AV controls only for audio/video media types', () => {
    const target = createTarget();
    const instance = mount(BottomAuthoringBar, {
      target,
      props: {
        mediaType: 'image',
      },
    });

    expect(target.querySelector('[data-testid="authoring-av-controls"]')).toBeNull();

    unmount(instance);

    const instanceAv = mount(BottomAuthoringBar, {
      target,
      props: {
        mediaType: 'audio',
      },
    });

    expect(target.querySelector('[data-testid="authoring-av-controls"]')).toBeTruthy();

    unmount(instanceAv);
    target.remove();
  });

  it('disables update when no chapter is selected', () => {
    const target = createTarget();
    const instance = mount(BottomAuthoringBar, {
      target,
      props: {
        hasSelectedChapter: false,
      },
    });

    const updateButton = target.querySelector(
      '[data-testid="authoring-update-chapter"]',
    ) as HTMLButtonElement;
    expect(updateButton).toBeTruthy();
    expect(updateButton.disabled).toBe(true);

    unmount(instance);
    target.remove();
  });

  it('shows guidance when audio/video marks are missing', () => {
    const target = createTarget();
    const instance = mount(BottomAuthoringBar, {
      target,
      props: {
        mediaType: 'audio',
        avMarksValid: false,
      },
    });

    const hint = target.querySelector('[data-testid="authoring-guidance"]');
    expect(hint?.textContent).toContain('Use Mark In/Out');

    unmount(instance);
    target.remove();
  });
});
