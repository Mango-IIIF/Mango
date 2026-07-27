import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import type { SaveState } from '../../storySerializer';
import StoryBuilderTopBar from '../StoryBuilderTopBar.svelte';

const createTarget = (): HTMLDivElement => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return target;
};

describe('StoryBuilderTopBar', () => {
  it('separates configured save from export and exposes preview controls', () => {
    const target = createTarget();
    const onSave = vi.fn();
    const onExport = vi.fn();
    const onPreview = vi.fn();

    const instance = mount(StoryBuilderTopBar, {
      target,
      props: {
        story: writable({
          title: { en: 'The whole story' },
          chapters: [
            {
              id: 'chapter-1',
              manifest: 'https://example.org/manifest',
              canvasIndex: 0,
            },
          ],
        }),
        isPreviewing: writable(false),
        saveState: writable<SaveState>({ status: 'idle' }),
        saveConfigured: writable(true),
        dirty: writable(true),
        canUndo: writable(false),
        canRedo: writable(false),
        onSave,
        onExport,
        onPreview,
      },
    });

    expect(target.textContent).toContain('Unsaved changes');
    expect(target.querySelector('[data-testid="story-builder-title"]')?.textContent).toBe(
      'The whole story',
    );

    const buttons = Array.from(target.querySelectorAll('button'));
    buttons.find((button) => button.textContent?.includes('Save'))?.click();
    buttons.find((button) => button.textContent?.includes('Export'))?.click();
    buttons.find((button) => button.textContent?.includes('Preview story'))?.click();

    expect(onSave).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledOnce();
    expect(onPreview).toHaveBeenCalledOnce();

    unmount(instance);
    target.remove();
  });

  it('omits remote save when no endpoint is configured', () => {
    const target = createTarget();
    const instance = mount(StoryBuilderTopBar, {
      target,
      props: {
        story: writable({ chapters: [] }),
        isPreviewing: writable(false),
        saveState: writable<SaveState>({ status: 'idle' }),
        saveConfigured: writable(false),
        dirty: writable(false),
        canUndo: writable(false),
        canRedo: writable(false),
      },
    });

    expect(target.textContent).not.toContain('Save');
    expect(target.textContent).toContain('Export');

    unmount(instance);
    target.remove();
  });
});
