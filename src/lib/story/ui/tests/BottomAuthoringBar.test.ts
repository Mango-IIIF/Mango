import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import BottomAuthoringBar from '../BottomAuthoringBar.svelte';

const createTarget = (): HTMLDivElement => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return target;
};

describe('BottomAuthoringBar', () => {
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

});
