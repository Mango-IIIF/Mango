import { describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { writable } from 'svelte/store';
import StoryBuilderOverlay from '../StoryBuilderOverlay.svelte';

describe('motion point viewer markers', () => {
  it('shows movable pins only while the motion authoring tool is active', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onStartMotionPointPositioning = vi.fn();
    const activeChapterTask = writable<'motion' | null>('motion');
    const motionPreviewing = writable(false);
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
              { id: 'two', timeMs: 5000, viewBox: { x: 25, y: 25, w: 50, h: 50 } },
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
        validationErrors: writable([]),
        uiMode: writable('chapterEdit'),
        mediaType: writable('image'),
        mediaMarks: writable({ lastTime: 0, markIn: null, markOut: null }),
        avMarksValid: writable(true),
        saveModalOpen: writable(false),
        saveModalPayload: writable(null),
        annotationLanguage: writable('en'),
        positioningLanguage: writable(null),
        motionPreviewing,
        motionPointDraft: writable(null),
        onStartMotionPointPositioning,
      } as never,
    });
    const pins = target.querySelectorAll('.story-builder-motion-marker');
    expect(pins).toHaveLength(2);
    expect(pins[0].textContent).toContain('1');
    expect(pins[1].textContent).toContain('2');
    (pins[1] as HTMLButtonElement).click();
    expect(onStartMotionPointPositioning).toHaveBeenCalledWith('two');
    expect((pins[0] as HTMLElement).style.cssText).not.toBe((pins[1] as HTMLElement).style.cssText);

    motionPreviewing.set(true);
    await tick();
    expect(target.querySelectorAll('.story-builder-motion-marker')).toHaveLength(0);

    motionPreviewing.set(false);
    activeChapterTask.set(null);
    await tick();
    expect(target.querySelectorAll('.story-builder-motion-marker')).toHaveLength(0);
    unmount(instance);
    target.remove();
  });

  it('places a visible numbered pin by clicking directly on the canvas', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onConfirmMotionPointPositioning = vi.fn();
    const story = writable({
      chapters: [
        {
          id: 'chapter',
          manifest: 'https://example.org/manifest',
          canvasIndex: 0,
          viewBox: { x: 100, y: 200, w: 1000, h: 500 },
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
        viewBox: writable({ x: 100, y: 200, w: 1000, h: 500 }),
        selectedChapterId: writable('chapter'),
        activeChapterTask: writable('motion'),
        validationErrors: writable([]),
        uiMode: writable('motionPointPositioning'),
        mediaType: writable('image'),
        mediaMarks: writable({ lastTime: 0, markIn: null, markOut: null }),
        avMarksValid: writable(true),
        saveModalOpen: writable(false),
        saveModalPayload: writable(null),
        annotationLanguage: writable('en'),
        positioningLanguage: writable(null),
        motionPreviewing: writable(false),
        motionPointDraft: writable({}),
        onConfirmMotionPointPositioning,
      } as never,
    });
    const surface = target.querySelector('.story-builder-motion-point-surface') as HTMLElement;
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 400,
      width: 800,
      height: 400,
      toJSON: () => ({}),
    });
    surface.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 100 }));
    await tick();
    const pin = target.querySelector('.story-builder-motion-placement-pin') as HTMLElement;
    expect(pin).toBeTruthy();
    expect(pin.textContent).toContain('1');
    const confirm = [...target.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Use this point'),
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    confirm.click();
    expect(onConfirmMotionPointPositioning).toHaveBeenCalledWith({ x: 350, y: 325 });
    unmount(instance);
    target.remove();
  });
});
