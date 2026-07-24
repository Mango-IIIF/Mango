import { describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { writable } from 'svelte/store';
import type { ChapterAdvance, StoryState } from '../../../core/types/story';
import ChapterOverlay from '../ChapterOverlay.svelte';
import { createStoryStoreForTest } from './testHelpers';

const createTarget = (): HTMLDivElement => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return target;
};

describe('ChapterOverlay', () => {
  it('updates manifest and triggers reload', async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: 'chapter-1',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 2,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
        },
      ],
    });
    const target = createTarget();
    let reloadPayload: { manifest: string; canvasIndex: number } | null = null;

    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: 'chapter-1',
        language: 'en',
        onUpdateManifest: (chapterId: string, manifest: string) =>
          store.setChapterManifest({ chapterId, manifest }),
        onReloadManifest: (_chapterId: string, manifest: string, canvasIndex: number) => {
          reloadPayload = { manifest, canvasIndex };
        },
      },
    });

    const input = target.querySelector(
      '[data-testid="chapter-manifest"]',
    ) as HTMLInputElement;
    input.value = 'https://example.org/updated.json';
    input.dispatchEvent(new Event('input'));
    await tick();

    const reload = target.querySelector(
      '[data-testid="chapter-manifest-reload"]',
    ) as HTMLButtonElement;
    reload.click();

    await tick();
    const storyValue = await new Promise((resolve) => {
      store.story.subscribe((value) => resolve(value))();
    });
    expect((storyValue as any).chapters[0].manifest).toBe(
      'https://example.org/updated.json',
    );
    expect(reloadPayload).toEqual({
      manifest: 'https://example.org/updated.json',
      canvasIndex: 2,
    });

    unmount(instance);
    target.remove();
  });

  it('edits annotations with language-specific text and shared placement', async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: 'chapter-1',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
        },
      ],
    });
    const target = createTarget();
    let positioningTriggered = '';

    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: 'chapter-1',
        language: 'en',
        onUpdateAnnotationText: (chapterId: string, lang: string, text: string) =>
          store.setAnnotationText({ chapterId, language: lang, text }),
        onSetAnnotationPositioning: (lang: string) => {
          positioningTriggered = lang;
        },
      },
    });

    const textarea = target.querySelector(
      '[data-testid="chapter-annotation"]',
    ) as HTMLTextAreaElement;
    textarea.value = 'Note';
    textarea.dispatchEvent(new Event('input'));

    const setPositionButton = target.querySelector(
      '[data-testid="set-annotation-position"]',
    ) as HTMLButtonElement;
    expect(setPositionButton).toBeTruthy();
    setPositionButton.click();
    expect(positioningTriggered).toBe('en');

    const saveButton = target.querySelector('[data-testid="chapter-save"]') as HTMLButtonElement;
    saveButton.click();

    await tick();
    const storyValue = await new Promise((resolve) => {
      store.story.subscribe((value) => resolve(value))();
    });
    expect((storyValue as any).chapters[0].annotations.en.text).toBe('Note');

    unmount(instance);
    target.remove();
  });

  it('stores advance mode and delay', async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: 'chapter-1',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
        },
      ],
    });
    const target = createTarget();

    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: 'chapter-1',
        language: 'en',
        onUpdateAdvanceMode: (chapterId: string, mode: ChapterAdvance['mode']) =>
          store.setAdvanceMode({ chapterId, mode }),
        onUpdateDelay: (chapterId: string, delayMs: number | undefined) =>
          store.setDelay({ chapterId, delayMs }),
      },
    });

    const delayInput = target.querySelector(
      '[data-testid="chapter-advance-delay"]',
    ) as HTMLInputElement;
    delayInput.value = '3';
    delayInput.dispatchEvent(new Event('input'));

    await tick();
    const storyValue = await new Promise((resolve) => {
      store.story.subscribe((value) => resolve(value))();
    });
    expect((storyValue as any).chapters[0].advance.mode).toBe('auto');
    expect((storyValue as any).chapters[0].advance.delayMs).toBe(3000);

    unmount(instance);
    target.remove();
  });

  it('stores chapter title and description for active language', async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: 'chapter-1',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
        },
      ],
    });
    const target = createTarget();

    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: 'chapter-1',
        language: 'en',
        onUpdateChapterTitle: (chapterId: string, lang: string, value: string) =>
          store.setChapterTitle({ chapterId, language: lang, value }),
        onUpdateChapterDescription: (
          chapterId: string,
          lang: string,
          value: string,
        ) => store.setChapterDescription({ chapterId, language: lang, value }),
      },
    });

    const titleInput = target.querySelector(
      '[data-testid="chapter-title"]',
    ) as HTMLInputElement;
    titleInput.value = 'Chapter heading';
    titleInput.dispatchEvent(new Event('input'));

    const descriptionInput = target.querySelector(
      '[data-testid="chapter-description"]',
    ) as HTMLTextAreaElement;
    descriptionInput.value = 'Chapter summary';
    descriptionInput.dispatchEvent(new Event('input'));

    await tick();
    const storyValue = await new Promise((resolve) => {
      store.story.subscribe((value) => resolve(value))();
    });
    expect((storyValue as any).chapters[0].title.en).toBe('Chapter heading');
    expect((storyValue as any).chapters[0].description.en).toBe('Chapter summary');

    unmount(instance);
    target.remove();
  });

  it('collapses and expands metadata section', async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: 'chapter-1',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          title: { en: 'Title' },
        },
      ],
    });
    const target = createTarget();

    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: 'chapter-1',
        language: 'en',
      },
    });

    const titleInput = target.querySelector(
      '[data-testid="chapter-title"]',
    ) as HTMLInputElement;
    const sectionContent = titleInput.closest(
      '.chapter-overlay__section-content',
    ) as HTMLElement;
    expect(sectionContent.hidden).toBe(false);

    const collapseButton = target.querySelector(
      'button[aria-label="Collapse metadata section"]',
    ) as HTMLButtonElement;
    collapseButton.click();
    await tick();
    expect(sectionContent.hidden).toBe(true);

    const expandButton = target.querySelector(
      'button[aria-label="Expand metadata section"]',
    ) as HTMLButtonElement;
    expandButton.click();
    await tick();
    expect(sectionContent.hidden).toBe(false);

    unmount(instance);
    target.remove();
  });

  it('previews narration only between the selected start and end times', async () => {
    const story = writable<StoryState>({
      narration: {
        tracks: {
          en: { src: 'https://example.org/narration.mp3' },
        },
      },
      chapters: [
        {
          id: 'chapter-1',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          narrationSegment: { en: { start: 5, end: 10 } },
        },
      ],
    });
    const target = createTarget();

    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story,
        open: true,
        chapterId: 'chapter-1',
        language: 'en',
      },
    });
    await tick();

    story.update((value) => ({
      ...value,
      narration: {
        tracks: {
          en: { src: 'https://example.org/updated-narration.mp3' },
        },
      },
    }));
    await tick();

    const audio = target.querySelector(
      '.chapter-overlay__audio-source',
    ) as HTMLAudioElement;
    expect(target.textContent).toContain('Audio Narration');
    expect(
      (target.querySelector('[data-testid="chapter-narration-url"]') as HTMLInputElement).value,
    ).toBe('https://example.org/updated-narration.mp3');
    Object.defineProperty(audio, 'readyState', { configurable: true, value: 1 });
    const play = vi.spyOn(audio, 'play').mockResolvedValue(undefined);
    const pause = vi.spyOn(audio, 'pause').mockImplementation(() => undefined);
    const preview = target.querySelector(
      '[data-testid="chapter-narration-preview"]',
    ) as HTMLButtonElement;

    expect(preview.textContent?.trim()).toBe('Preview narration');
    expect(preview.disabled).toBe(false);

    preview.click();
    await tick();

    expect(audio.currentTime).toBe(5);
    expect(play).toHaveBeenCalledOnce();
    expect(preview.textContent?.trim()).toBe('Stop preview');

    audio.currentTime = 10;
    audio.dispatchEvent(new Event('timeupdate'));
    await tick();

    expect(pause).toHaveBeenCalledOnce();
    expect(preview.textContent?.trim()).toBe('Preview narration');

    unmount(instance);
    target.remove();
  });

  it('allows narration to be skipped for the current chapter', async () => {
    const story = writable<StoryState>({
      narration: { tracks: { en: { src: 'https://example.org/narration.mp3' } } },
      chapters: [
        {
          id: 'chapter-1',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 0,
          narrationSegment: { en: { start: 5, end: 10 } },
        },
      ],
    });
    const target = createTarget();
    const onSkipNarration = vi.fn();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story,
        open: true,
        chapterId: 'chapter-1',
        language: 'en',
        onSkipNarration,
      },
    });
    await tick();

    const skip = target.querySelector(
      '[data-testid="chapter-narration-skip"]',
    ) as HTMLButtonElement;
    skip.click();

    expect(onSkipNarration).toHaveBeenCalledWith('en');

    unmount(instance);
    target.remove();
  });
});
