import { describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { writable } from 'svelte/store';
import StoryBuilderOverlay from '../StoryBuilderOverlay.svelte';

describe('motion authoring surfaces', () => {
  it('forwards trajectory, dwell, and easing controls through the inspector surface', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onUpdateMotionPathType = vi.fn();
    const onUpdateMotionInitialDwell = vi.fn();
    const onUpdateMotionEasing = vi.fn();
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
        onUpdateMotionPathType,
        onUpdateMotionInitialDwell,
        onUpdateMotionEasing,
      } as never,
    });
    await tick();

    const button = (label: string) =>
      [...target.querySelectorAll('button')].find(
        (entry) => entry.textContent === label,
      ) as HTMLButtonElement;
    button('Curved Spline').click();
    button('1.0s').click();
    button('Ease out').click();

    expect(onUpdateMotionPathType).toHaveBeenCalledWith('spline');
    expect(onUpdateMotionInitialDwell).toHaveBeenCalledWith(1000);
    expect(onUpdateMotionEasing).toHaveBeenCalledWith('ease-out');
    unmount(instance);
    target.remove();
  });

  it('draws no pins of its own: camera points are frames on the stage', async () => {
    /*
     * Keyframes used to be projected onto this overlay as pins, and placed
     * through a click-to-position mode that read the viewport for the box.
     * They are now frames drawn on the stage by the frame layer, so the
     * overlay has nothing to show for motion and no positioning mode.
     */
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
        activeChapterTask: writable('motion'),
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

    expect(target.querySelectorAll('.story-builder-motion-marker')).toHaveLength(0);
    expect(target.querySelector('.story-builder-motion-point-surface')).toBeNull();
    expect(target.querySelector('.story-builder-motion-placement')).toBeNull();
    unmount(instance);
    target.remove();
  });
});
