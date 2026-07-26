import { describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import ChapterMotionPanel from '../ChapterMotionPanel.svelte';

describe('ChapterMotionPanel', () => {
  it('starts a viewer-placement workflow instead of silently capturing a point', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onPositionPoint = vi.fn();
    const instance = mount(ChapterMotionPanel, {
      target,
      props: {
        track: undefined,
        onPositionPoint,
        onDeletePoint: vi.fn(),
        onGoToPoint: vi.fn(),
        onUpdateDuration: vi.fn(),
        onApplyPreset: vi.fn(),
        onPreview: vi.fn(),
        onStopPreview: vi.fn(),
      },
    });
    (target.querySelector('[data-testid="motion-add-point"]') as HTMLButtonElement).click();
    expect(onPositionPoint).toHaveBeenCalledWith();
    unmount(instance);
    target.remove();
  });

  it('offers presets and preview when a path has two points', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onApplyPreset = vi.fn();
    const onPreview = vi.fn();
    const onGoToPoint = vi.fn();
    const instance = mount(ChapterMotionPanel, {
      target,
      props: {
        track: {
          durationMs: 5000,
          preset: 'custom',
          keyframes: [
            { id: 'one', timeMs: 0, viewBox: { x: 0, y: 0, w: 100, h: 100 } },
            { id: 'two', timeMs: 5000, viewBox: { x: 10, y: 10, w: 50, h: 50 } },
          ],
        },
        onPositionPoint: vi.fn(),
        onDeletePoint: vi.fn(),
        onGoToPoint,
        onUpdateDuration: vi.fn(),
        onApplyPreset,
        onPreview,
        onStopPreview: vi.fn(),
      },
    });
    const zoomIn = [...target.querySelectorAll('.motion-panel__presets button')].find(
      (button) => button.textContent === 'Zoom in',
    ) as HTMLButtonElement;
    zoomIn.click();
    expect(onApplyPreset).toHaveBeenCalledWith('zoom-in');
    const preview = [...target.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Preview'),
    ) as HTMLButtonElement;
    expect(preview.disabled).toBe(false);
    preview.click();
    expect(onPreview).toHaveBeenCalledOnce();
    (target.querySelector('[aria-label="Go to camera point 1"]') as HTMLButtonElement).click();
    expect(onGoToPoint).toHaveBeenCalledWith('one');
    unmount(instance);
    target.remove();
  });
});
