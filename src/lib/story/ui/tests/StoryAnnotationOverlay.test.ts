import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { createStoryStoreForTest } from './testHelpers';
import StoryAnnotationOverlay from '../StoryAnnotationOverlay.svelte';

const createTarget = (): HTMLDivElement => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return target;
};

describe('StoryAnnotationOverlay', () => {
  it('positions annotation based on placement', async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: 'chapter-1',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          annotationPlacement: { x: 0.75, y: 0.05, w: 0.2, h: 0.2 },
          annotations: {
            en: {
              text: 'Note',
            },
          },
        },
      ],
    });
    const target = createTarget();

    const instance = mount(StoryAnnotationOverlay, {
      target,
      props: {
        story: store.story,
        chapterId: 'chapter-1',
        language: 'en',
      },
    });

    await tick();
    const note = target.querySelector(
      '[data-testid="story-annotation-note"]',
    ) as HTMLElement;
    expect(note).toBeTruthy();
    expect(note.style.left).toContain('85');
    expect(note.style.top).toContain('15');

    unmount(instance);
    target.remove();
  });
});
