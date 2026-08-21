import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import StoryStage from '../StoryStage.svelte';

describe('StoryStage', () => {
  it('exposes one positive authored aspect to the fixed output surface', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(StoryStage, {
      target,
      props: { aspect: 2, label: 'Story frame · 2.00:1' },
    });

    const stage = target.querySelector('[data-testid="story-stage"]') as HTMLElement;
    expect(stage.dataset.storyAspect).toBe('2');
    expect(stage.style.getPropertyValue('--story-stage-aspect')).toBe('2');
    expect(target.querySelector('[data-testid="story-stage-surface"]')).toBeTruthy();

    unmount(instance);
    target.remove();
  });

  it('falls back to 16:9 rather than producing an invalid CSS/data aspect', () => {
    const target = document.createElement('div');
    const instance = mount(StoryStage, { target, props: { aspect: 0 } });
    const stage = target.querySelector('[data-testid="story-stage"]') as HTMLElement;
    expect(Number(stage.dataset.storyAspect)).toBeCloseTo(16 / 9, 9);
    unmount(instance);
  });

  it('can fill an authoring workspace without applying the output aspect', () => {
    const target = document.createElement('div');
    const instance = mount(StoryStage, {
      target,
      props: { aspect: 4 / 3, fluid: true },
    });
    const stage = target.querySelector('[data-testid="story-stage"]') as HTMLElement;
    expect(stage.classList.contains('story-stage--fluid')).toBe(true);
    expect(target.querySelector('[data-testid="story-stage-label"]')).toBeNull();
    unmount(instance);
  });
});
