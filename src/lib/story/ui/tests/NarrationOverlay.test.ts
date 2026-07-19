import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { createStoryStoreForTest } from './testHelpers';
import NarrationOverlay from '../NarrationOverlay.svelte';

const createTarget = (): HTMLDivElement => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return target;
};

describe('NarrationOverlay', () => {
  it('updates narration track at story level', async () => {
    const store = createStoryStoreForTest();
    const target = createTarget();

    const instance = mount(NarrationOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        language: 'en',
        languages: ['en'],
        onSetNarrationTrack: (lang: string, src: string) =>
          store.setNarrationTrack({ language: lang, src }),
      },
    });

    const input = target.querySelector(
      '[data-testid="narration-url"]',
    ) as HTMLInputElement;
    input.value = 'https://example.org/audio.mp3';
    input.dispatchEvent(new Event('input'));

    await tick();
    const storyValue = await new Promise((resolve) => {
      store.story.subscribe((value) => resolve(value))();
    });

    expect((storyValue as any).narration.tracks.en.src).toBe(
      'https://example.org/audio.mp3',
    );

    unmount(instance);
    target.remove();
  });

  it('preserves URLs per language when switching', async () => {
    const store = createStoryStoreForTest({
      narration: {
        tracks: {
          en: { src: 'https://example.org/en.mp3' },
          cy: { src: 'https://example.org/cy.mp3' },
        },
      },
      chapters: [],
    });
    const target = createTarget();

    const instance = mount(NarrationOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        language: 'en',
        languages: ['en', 'cy'],
        onSetNarrationTrack: (lang: string, src: string) =>
          store.setNarrationTrack({ language: lang, src }),
      },
    });

    const select = target.querySelector(
      '[data-testid="narration-language"]',
    ) as HTMLSelectElement;
    const input = target.querySelector(
      '[data-testid="narration-url"]',
    ) as HTMLInputElement;

    expect(input.value).toBe('https://example.org/en.mp3');

    select.value = 'cy';
    select.dispatchEvent(new Event('change'));
    await tick();
    expect(input.value).toBe('https://example.org/cy.mp3');

    input.value = 'https://example.org/cy-new.mp3';
    input.dispatchEvent(new Event('input'));
    await tick();

    select.value = 'en';
    select.dispatchEvent(new Event('change'));
    await tick();
    expect(input.value).toBe('https://example.org/en.mp3');

    unmount(instance);
    target.remove();
  });
});
