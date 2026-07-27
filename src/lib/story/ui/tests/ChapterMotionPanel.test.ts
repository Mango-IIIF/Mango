import { describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import ChapterMotionPanel from '../ChapterMotionPanel.svelte';

describe('ChapterMotionPanel', () => {
  it('updates duration when input value changes', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onUpdateDuration = vi.fn();
    const instance = mount(ChapterMotionPanel, {
      target,
      props: {
        track: { durationMs: 5000, keyframes: [] },
        onUpdateDuration,
        onApplyPreset: vi.fn(),
        onPreview: vi.fn(),
        onStopPreview: vi.fn(),
      },
    });
    const input = target.querySelector('[data-testid="motion-duration"]') as HTMLInputElement;
    input.value = '8';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onUpdateDuration).toHaveBeenCalledWith(8000);
    unmount(instance);
    target.remove();
  });

  it('offers presets and preview when a path has two points', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onApplyPreset = vi.fn();
    const onPreview = vi.fn();
    const instance = mount(ChapterMotionPanel, {
      target,
      props: {
        track: {
          durationMs: 5000,
          preset: 'ken-burns',
          keyframes: [
            { id: 'one', timeMs: 0, viewBox: { x: 0, y: 0, w: 100, h: 100 } },
            {
              id: 'two',
              timeMs: 5000,
              viewBox: { x: 10, y: 10, w: 50, h: 50 },
            },
          ],
        },
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
    unmount(instance);
    target.remove();
  });

  it('updates path, dwell, and easing with accessible selected states', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onUpdatePathType = vi.fn();
    const onUpdateDwell = vi.fn();
    const onUpdateEasing = vi.fn();
    const instance = mount(ChapterMotionPanel, {
      target,
      props: {
        track: {
          durationMs: 6000,
          preset: 'custom',
          pathType: 'spline',
          easing: 'ease-out',
          keyframes: [
            {
              id: 'one',
              timeMs: 0,
              dwellMs: 1000,
              viewBox: { x: 0, y: 0, w: 100, h: 100 },
            },
            {
              id: 'two',
              timeMs: 3000,
              viewBox: { x: 10, y: 10, w: 80, h: 80 },
            },
            {
              id: 'three',
              timeMs: 6000,
              viewBox: { x: 20, y: 20, w: 60, h: 60 },
            },
          ],
        },
        onUpdateDuration: vi.fn(),
        onUpdatePathType,
        onUpdateDwell,
        onUpdateEasing,
        onApplyPreset: vi.fn(),
        onPreview: vi.fn(),
        onStopPreview: vi.fn(),
      },
    });

    const curved = [...target.querySelectorAll('button')].find(
      (button) => button.textContent === 'Curved Spline',
    ) as HTMLButtonElement;
    expect(curved.getAttribute('aria-pressed')).toBe('true');
    (
      [...target.querySelectorAll('button')].find(
        (button) => button.textContent === 'Straight Linear',
      ) as HTMLButtonElement
    ).click();
    (
      [...target.querySelectorAll('button')].find(
        (button) => button.textContent === '2.0s',
      ) as HTMLButtonElement
    ).click();
    (
      [...target.querySelectorAll('button')].find(
        (button) => button.textContent === 'Ease in',
      ) as HTMLButtonElement
    ).click();

    expect(onUpdatePathType).toHaveBeenCalledWith('linear');
    expect(onUpdateDwell).toHaveBeenCalledWith(2000);
    expect(onUpdateEasing).toHaveBeenCalledWith('ease-in');
    unmount(instance);
    target.remove();
  });

  it('explains point requirements and rejects a duration shorter than the dwell interval', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onUpdateDuration = vi.fn();
    const instance = mount(ChapterMotionPanel, {
      target,
      props: {
        track: {
          durationMs: 5000,
          preset: 'custom',
          keyframes: [
            {
              id: 'one',
              timeMs: 0,
              dwellMs: 2000,
              viewBox: { x: 0, y: 0, w: 100, h: 100 },
            },
            {
              id: 'two',
              timeMs: 5000,
              viewBox: { x: 10, y: 10, w: 80, h: 80 },
            },
          ],
        },
        onUpdateDuration,
        onApplyPreset: vi.fn(),
        onPreview: vi.fn(),
        onStopPreview: vi.fn(),
      },
    });

    const arc = [...target.querySelectorAll('button')].find(
      (button) => button.textContent === 'Arc sweep',
    ) as HTMLButtonElement;
    expect(arc.disabled).toBe(true);
    expect(target.textContent).toContain('Arc sweep needs at least three camera points');

    const input = target.querySelector('[data-testid="motion-duration"]') as HTMLInputElement;
    input.value = '1';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(onUpdateDuration).not.toHaveBeenCalled();
    expect(input.value).toBe('5');
    expect(target.textContent).toContain('Duration must leave time to move');
    unmount(instance);
    target.remove();
  });
});
