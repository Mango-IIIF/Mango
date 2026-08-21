import { describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { writable } from 'svelte/store';
import StoryBuilderOverlay from '../StoryBuilderOverlay.svelte';

describe('motion authoring surfaces', () => {
  it('keeps motion options in the wide workspace instead of duplicating them in the inspector', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const story = writable({
      chapters: [
        {
          id: 'chapter',
          manifest: 'https://example.org/manifest',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          cameraTrack: {
            durationMs: 5000,
            preset: 'custom' as const,
            keyframes: [
              { id: 'one', timeMs: 0, viewBox: { x: 0, y: 0, w: 100, h: 100 } },
              {
                id: 'two',
                timeMs: 2500,
                viewBox: { x: 10, y: 10, w: 80, h: 80 },
              },
              {
                id: 'three',
                timeMs: 5000,
                viewBox: { x: 20, y: 20, w: 60, h: 60 },
              },
            ],
          },
        },
      ],
    });
    const instance = mount(StoryBuilderOverlay, {
      target,
      props: {
        surface: 'inspector',
        story,
        layers: writable([]),
        layerOpacities: writable({}),
        currentManifest: writable('https://example.org/manifest'),
        viewerCanvasIndex: writable(0),
        viewerCanvasCount: writable(1),
        viewBox: writable({ x: 0, y: 0, w: 100, h: 100 }),
        selectedChapterId: writable('chapter'),
        activeChapterTask: writable('motion'),
        validationErrors: writable([]),
        uiMode: writable('chapterEdit'),
        mediaType: writable('image'),
        mediaMarks: writable({ lastTime: 0, markIn: null, markOut: null }),
        avMarksValid: writable(true),
        transitionDelayDefault: writable(2000),
        saveModalOpen: writable(false),
        saveModalPayload: writable(null),
        annotationLanguage: writable('en'),
        positioningLanguage: writable(null),
        motionPreviewing: writable(false),
      } as never,
    });
    await tick();

    const button = (label: string) =>
      [...target.querySelectorAll('button')].find(
        (entry) => entry.textContent === label,
      ) as HTMLButtonElement;
    expect(button('Curved Spline')).toBeUndefined();
    expect(button('1.0s')).toBeUndefined();
    expect(button('Ease out')).toBeUndefined();
    expect(target.querySelector('[data-testid="inspector-summary-motion"]')).toBeTruthy();
    unmount(instance);
    target.remove();
  });

  it('shows camera points as numbered pins only while Motion is active', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const activeChapterTask = writable<null | 'motion'>('motion');
    const selectedMotionPointId = writable<string | null>('two');
    const onGoToMotionPoint = vi.fn();
    const onMoveMotionPoint = vi.fn();
    const story = writable({
      chapters: [
        {
          id: 'chapter',
          manifest: 'https://example.org/manifest',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          cameraTrack: {
            durationMs: 5000,
            keyframes: [
              { id: 'one', timeMs: 0, viewBox: { x: 0, y: 0, w: 100, h: 100 } },
              {
                id: 'two',
                timeMs: 5000,
                viewBox: { x: 25, y: 25, w: 50, h: 50 },
              },
            ],
          },
        },
      ],
    });
    const instance = mount(StoryBuilderOverlay, {
      target,
      props: {
        story,
        layers: writable([]),
        layerOpacities: writable({}),
        currentManifest: writable('https://example.org/manifest'),
        viewBox: writable({ x: 0, y: 0, w: 100, h: 100 }),
        selectedChapterId: writable('chapter'),
        activeChapterTask,
        selectedMotionPointId,
        onGoToMotionPoint,
        onMoveMotionPoint,
        validationErrors: writable([]),
        uiMode: writable('chapterEdit'),
        mediaType: writable('image'),
        mediaMarks: writable({ lastTime: 0, markIn: null, markOut: null }),
        avMarksValid: writable(true),
        saveModalOpen: writable(false),
        saveModalPayload: writable(null),
        annotationLanguage: writable('en'),
        positioningLanguage: writable(null),
        motionPreviewing: writable(false),
      } as never,
    });
    await tick();

    const pins = target.querySelectorAll<HTMLButtonElement>('.story-builder-motion-marker');
    expect(pins).toHaveLength(2);
    expect(pins[0].textContent?.trim()).toBe('1');
    expect(pins[1].textContent?.trim()).toBe('2');
    expect(pins[1].classList.contains('story-builder-motion-marker--selected')).toBe(true);

    pins[0].click();
    expect(onGoToMotionPoint).toHaveBeenCalledWith('one');

    const overlay = target.querySelector('.story-builder-overlay-root') as HTMLDivElement;
    overlay.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    }));
    const pointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
      Object.defineProperty(event, 'pointerId', { value: 7 });
      return event;
    };
    pins[1].dispatchEvent(pointer('pointerdown', 100, 50));
    pins[1].dispatchEvent(pointer('pointermove', 150, 25));
    pins[1].dispatchEvent(pointer('pointerup', 150, 25));

    expect(onMoveMotionPoint).toHaveBeenCalledWith('two', { x: 75, y: 25 });
    pins[1].click();
    expect(onGoToMotionPoint).toHaveBeenCalledTimes(1);

    activeChapterTask.set(null);
    await tick();
    expect(target.querySelectorAll('.story-builder-motion-marker')).toHaveLength(0);
    unmount(instance);
    target.remove();
  });
});
