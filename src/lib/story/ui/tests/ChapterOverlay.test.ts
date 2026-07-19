import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import type { ChapterAdvance } from '../../../core/types/story';
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
      version: '1.0',
      type: 'story',
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
      version: '1.0',
      type: 'story',
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
      version: '1.0',
      type: 'story',
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
      version: '1.0',
      type: 'story',
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
      version: '1.0',
      type: 'story',
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
});
