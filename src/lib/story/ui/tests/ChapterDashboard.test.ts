import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { writable } from 'svelte/store';
import ChapterOverlay from '../ChapterOverlay.svelte';
import type { ChapterAnnotationTool, StoryState } from '../../../core/types/story';

describe('Chapter dashboard navigation', () => {
  it('opens one focused task and returns to the dashboard', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const story = writable<StoryState>({
      chapters: [
        {
          id: 'chapter-one',
          manifest: 'https://example.org/manifest',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
        },
      ],
    });
    const annotationTool = writable<ChapterAnnotationTool>('select');
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story,
        open: true,
        docked: true,
        chapterId: 'chapter-one',
        languages: ['en', 'cy'],
        annotationTool,
        onSetAnnotationTool: (tool: ChapterAnnotationTool) => annotationTool.set(tool),
      },
    });

    expect(target.querySelector('#chapter-dashboard-title')?.textContent).toContain(
      'Chapter tools',
    );
    const details = target.querySelector('[data-task-id="details"] button') as HTMLButtonElement;
    expect(details.getAttribute('aria-label')).toContain('0/2 languages');
    details.click();
    await tick();

    const detailsPanel = target
      .querySelector('[data-testid="chapter-title"]')
      ?.closest('.chapter-overlay__task') as HTMLElement;
    expect(detailsPanel.hidden).toBe(false);
    expect(target.querySelector('#chapter-dashboard-title')).toBeNull();

    const back = detailsPanel.querySelector('.chapter-overlay__task-back') as HTMLButtonElement;
    expect(back.textContent).toContain('Back to chapter tools');
    back.click();
    await tick();
    expect(target.querySelector('#chapter-dashboard-title')).toBeTruthy();

    const annotations = target.querySelector('[data-task-id="focus"] button') as HTMLButtonElement;
    annotations.click();
    await tick();
    const annotationPanel = target.querySelector(
      '.chapter-overlay__task:not([hidden])',
    ) as HTMLElement;
    expect(annotationPanel.textContent).toContain('Drawing annotations');
    expect(annotationPanel.textContent).toContain('Text box annotation');
    expect(annotationPanel.textContent).toContain('separate from the drawing tools');
    const rectangle = Array.from(
      annotationPanel.querySelectorAll('.chapter-overlay__annotation-tools button'),
    ).find((button) => button.textContent?.includes('Rectangle')) as HTMLButtonElement;
    rectangle.click();
    await tick();
    expect(rectangle.getAttribute('aria-pressed')).toBe('true');
    expect(
      (target.querySelector('[data-testid="chapter-save"]') as HTMLButtonElement).textContent,
    ).toContain('Save annotations');

    unmount(instance);
    target.remove();
  });

  it('keeps unavailable tasks visible with a reason and next action', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const story = writable<StoryState>({
      chapters: [
        {
          id: 'chapter-one',
          manifest: 'https://example.org/manifest',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
        },
      ],
    });
    const instance = mount(ChapterOverlay, {
      target,
      props: { story, open: true, docked: true, chapterId: 'chapter-one' },
    });
    const comparison = target.querySelector('[data-task-id="comparison"]') as HTMLElement;
    expect(comparison.textContent).toContain('at least two loaded sources');
    expect(comparison.textContent).toContain('Load another compatible source');
    expect((comparison.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
    unmount(instance);
    target.remove();
  });
});
