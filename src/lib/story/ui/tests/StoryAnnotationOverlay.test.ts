import { describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { createStoryStoreForTest } from './testHelpers';
import { writable } from 'svelte/store';
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
    const note = target.querySelector('[data-testid="story-annotation-note"]') as HTMLElement;
    expect(note).toBeTruthy();
    expect(note.style.left).toContain('75');
    expect(note.style.top).toContain('5');

    unmount(instance);
    target.remove();
  });

  it('scales with the artwork and opens its move/resize editor when clicked', async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: 'chapter-1',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          annotations: {
            en: {
              text: 'Editable note',
              placement: { x: 0.2, y: 0.3, w: 0.4, h: 0.2 },
            },
          },
        },
      ],
    });
    const target = createTarget();
    const onEditText = vi.fn();
    const instance = mount(StoryAnnotationOverlay, {
      target,
      props: {
        story: store.story,
        viewBox: writable({ x: 20, y: 25, w: 40, h: 40 }),
        chapterId: 'chapter-1',
        language: 'en',
        editable: true,
        onEditText,
      },
    });

    await tick();
    const note = target.querySelector('[data-testid="story-annotation-note"]') as HTMLButtonElement;
    expect(note.style.left).toBe('0%');
    expect(note.style.top).toBe('12.5%');
    expect(note.style.width).toBe('100%');
    expect(note.style.height).toBe('50%');
    expect(note.style.getPropertyValue('--annotation-scale')).toBe('2.5');

    note.click();
    expect(onEditText).toHaveBeenCalledWith('en');

    unmount(instance);
    target.remove();
  });

  it('renders every drawing annotation owned by the chapter', async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: 'chapter-1',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          drawingAnnotations: [
            {
              id: 'rect',
              type: 'rectangle',
              label: { en: 'Rectangle label' },
              color: '#39b57e',
              rect: { x: 10, y: 20, w: 30, h: 25 },
            },
            { id: 'point', type: 'point', point: { x: 50, y: 60 } },
            {
              id: 'line',
              type: 'line',
              points: [
                { x: 5, y: 5 },
                { x: 80, y: 90 },
              ],
            },
          ],
        },
      ],
    });
    const target = createTarget();
    const instance = mount(StoryAnnotationOverlay, {
      target,
      props: {
        story: store.story,
        viewBox: writable({ x: 0, y: 0, w: 100, h: 100 }),
        chapterId: 'chapter-1',
      },
    });
    await tick();
    expect(target.querySelectorAll('.story-annotation-overlay__shape')).toHaveLength(1);
    expect(target.querySelectorAll('.story-annotation-overlay__point')).toHaveLength(1);
    expect(target.querySelectorAll('.story-annotation-overlay__line')).toHaveLength(1);
    const rectangleLabel = target.querySelector(
      '.story-annotation-overlay__label--rectangle',
    );
    expect(rectangleLabel?.textContent?.trim()).toBe('Rectangle label');
    unmount(instance);
    target.remove();
  });
});
