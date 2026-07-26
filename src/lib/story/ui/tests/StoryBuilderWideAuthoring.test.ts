import { tick } from 'svelte';
import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import type { StoryState } from '../../../core/types/story';
import type { MediaType } from '../../../iiif/mediaResolver';
import type { ChapterTaskId } from '../../chapterTasks';
import StoryBuilderWideAuthoring from '../StoryBuilderWideAuthoring.svelte';

describe('StoryBuilderWideAuthoring', () => {
  it('only renders the editor for the active wide chapter tool', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const story = writable<StoryState>({
      narration: { tracks: { en: { src: 'https://example.org/narration.mp3' } } },
      chapters: [
        {
          id: 'chapter-two',
          manifest: 'https://example.org/manifest',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          annotations: { en: { text: 'A text annotation' } },
          drawingAnnotations: [
            { id: 'rectangle-one', type: 'rectangle', rect: { x: 10, y: 10, w: 20, h: 20 } },
          ],
          cameraTrack: { durationMs: 5000, keyframes: [] },
          narrationSegment: { en: { start: 1, end: 4 } },
          media: { start: 5, end: 25 },
        },
      ],
    });
    const selectedChapterId = writable<string | null>('chapter-two');
    const activeTask = writable<ChapterTaskId | null>(null);
    const mediaType = writable<MediaType | null>('audio');
    const mediaMarks = writable({ lastTime: 12, markIn: 5, markOut: 25 });
    const onAssignMediaSegment = vi.fn();
    const onDeleteDrawingAnnotation = vi.fn();
    const onDeleteTextAnnotation = vi.fn();
    const onEditDrawingAnnotation = vi.fn();
    const onEditTextAnnotation = vi.fn();
    const instance = mount(StoryBuilderWideAuthoring, {
      target,
      props: {
        story,
        selectedChapterId,
        activeTask,
        previewing: writable(false),
        mediaType,
        mediaSources: writable([
          {
            id: 'source-audio',
            src: 'https://example.org/source.mp4',
            type: 'audio',
            duration: 120,
          },
        ]),
        mediaMarks,
        avMarksValid: writable(true),
        onAddPoint: vi.fn(),
        onGoToPoint: vi.fn(),
        onPreview: vi.fn(),
        onStopPreview: vi.fn(),
        onSetNarrationTrack: vi.fn(),
        onAssignNarrationSegment: vi.fn(),
        onAssignMediaSegment,
        onPreviewMediaSegment: vi.fn(),
        onStopPreviewMediaSegment: vi.fn(),
        onDeleteDrawingAnnotation,
        onDeleteTextAnnotation,
        onEditDrawingAnnotation,
        onEditTextAnnotation,
      },
    });

    expect(target.querySelector('.story-wide-authoring')).toBeNull();
    expect(target.querySelector('.story-wide-narration')).toBeNull();

    activeTask.set('motion');
    await tick();
    expect(target.querySelector('.story-wide-authoring')).toBeTruthy();
    expect(target.querySelector('.story-wide-narration')).toBeNull();

    activeTask.set('audio-timing');
    await tick();
    expect(target.querySelector('.story-wide-authoring')).toBeNull();
    expect(target.querySelector('.story-wide-narration')).toBeTruthy();
    expect(target.querySelector('[data-testid="chapter-narration-waveform"] svg')).toBeTruthy();
    expect(target.querySelectorAll('.story-wide-narration__sliders input')).toHaveLength(2);
    expect(target.textContent).toContain('Preview');

    activeTask.set('media-timing');
    await tick();
    expect(target.querySelector('[data-testid="chapter-media-timing-editor"]')).toBeTruthy();
    expect(target.textContent).toContain('Narration is edited separately');
    const applyMedia = Array.from(target.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Apply segment'),
    ) as HTMLButtonElement;
    applyMedia.click();
    expect(onAssignMediaSegment).toHaveBeenCalledWith(5, 25);

    activeTask.set('focus');
    await tick();
    expect(target.querySelector('.story-wide-annotations')).toBeTruthy();
    expect(target.textContent).toContain('Rectangle');
    expect(target.textContent).toContain('A text annotation');
    expect(target.querySelector('.story-wide-annotations__tool-grid')).toBeNull();
    expect(target.querySelectorAll('.story-wide-annotations__group')).toHaveLength(0);
    expect(target.querySelectorAll('.story-wide-annotations__item')).toHaveLength(2);

    const editButtons = target.querySelectorAll<HTMLButtonElement>(
      '.story-wide-annotations__item-select',
    );
    editButtons[0].click();
    editButtons[1].click();
    expect(onEditTextAnnotation).toHaveBeenCalledWith('en');
    expect(onEditDrawingAnnotation).toHaveBeenCalledWith('rectangle-one');

    const deleteButtons = target.querySelectorAll<HTMLButtonElement>(
      '.story-wide-annotations__item-delete',
    );
    deleteButtons[0].click();
    deleteButtons[1].click();
    expect(onDeleteTextAnnotation).toHaveBeenCalledWith('en');
    expect(onDeleteDrawingAnnotation).toHaveBeenCalledWith('rectangle-one');

    story.update((state) => ({
      ...state,
      chapters: state.chapters.map((chapter) => ({
        ...chapter,
        annotations: {},
        drawingAnnotations: [],
      })),
    }));
    await tick();
    expect(target.querySelector('#story-wide-annotations-title')?.textContent).toContain('0');
    expect(target.textContent).not.toContain('No annotations yet');
    expect(target.querySelector('.story-wide-annotations__items')).toBeNull();

    activeTask.set('details');
    await tick();
    expect(target.querySelector('.story-wide-authoring')).toBeNull();
    expect(target.querySelector('.story-wide-narration')).toBeNull();

    selectedChapterId.set(null);
    await tick();
    expect(target.querySelector('.story-wide-authoring--empty')).toBeTruthy();

    unmount(instance);
    target.remove();
  });
});
