import { describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { createStoryStoreForTest } from './testHelpers';
import MainSidebar from '../MainSidebar.svelte';
import { manifestsStore } from '../../../state/manifests';

const createTarget = (): HTMLDivElement => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return target;
};

describe('MainSidebar', () => {
  it('updates chapter thumbnails when manifest cache resolves', async () => {
    const manifestId = 'https://example.org/manifest-thumb.json';
    manifestsStore.set({});

    const store = createStoryStoreForTest({
      chapters: [
        {
          id: 'chapter-thumb',
          manifest: manifestId,
          canvasIndex: 0,
        },
      ],
    });
    const target = createTarget();

    const instance = mount(MainSidebar, {
      target,
      props: {
        story: store.story,
        language: 'en',
      },
    });

    expect(target.querySelector('[data-testid="chapter-row-chapter-thumb"] img')).toBeNull();

    manifestsStore.set({
      [manifestId]: {
        id: manifestId,
        json: {},
        isFetching: false,
        canvases: [],
        manifesto: {
          getSequences: () => [
            {
              getCanvases: () => [
                {
                  id: 'canvas-1',
                  getThumbUri: () => 'https://example.org/thumb.jpg',
                },
              ],
            },
          ],
        },
      },
    });

    await tick();
    const image = target.querySelector(
      '[data-testid="chapter-row-chapter-thumb"] img',
    ) as HTMLImageElement | null;
    expect(image).toBeTruthy();
    expect(image?.getAttribute('src')).toBe('https://example.org/thumb.jpg');

    unmount(instance);
    target.remove();
    manifestsStore.set({});
  });

  it('keeps a fixed sidebar width', () => {
    const store = createStoryStoreForTest();
    const target = createTarget();

    const instance = mount(MainSidebar, {
      target,
      props: {
        story: store.story,
        sidebarWidth: 320,
      },
    });

    const sidebar = target.querySelector('[data-testid="story-sidebar"]') as HTMLElement;
    expect(sidebar).toBeTruthy();
    expect(sidebar.style.width).toBe('320px');
    expect(sidebar.style.flex).toBe('0 0 320px');

    unmount(instance);
    target.remove();
  });

  it('renders chapters as soon as they are added', async () => {
    const store = createStoryStoreForTest();
    const target = createTarget();

    const instance = mount(MainSidebar, {
      target,
      props: {
        story: store.story,
        language: 'en',
      },
    });

    expect(target.querySelectorAll('[data-testid^="chapter-row-"]')).toHaveLength(0);

    store.addChapterFromCapture({
      id: 'chapter-1',
      capture: {
        manifest: 'https://example.org/manifest.json',
        canvasIndex: 0,
        viewBox: { x: 0, y: 0, w: 100, h: 80 },
      },
    });

    await tick();
    expect(target.querySelectorAll('[data-testid^="chapter-row-"]')).toHaveLength(1);
    expect(target.querySelector('[data-testid="chapter-title-chapter-1"]')?.textContent).toBe(
      'Chapter 1',
    );

    unmount(instance);
    target.remove();
  });

  it('deletes chapters from the list', async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: 'chapter-delete',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 1,
          viewBox: { x: 0, y: 0, w: 80, h: 60 },
        },
      ],
    });
    const target = createTarget();

    const instance = mount(MainSidebar, {
      target,
      props: {
        story: store.story,
        onDeleteChapter: (chapterId: string) => {
          store.deleteChapter({ chapterId });
        },
      },
    });

    expect(target.querySelectorAll('[data-testid^="chapter-row-"]')).toHaveLength(1);

    const deleteButton = target.querySelector(
      '[data-testid="chapter-menu-chapter-delete"]',
    ) as HTMLButtonElement;
    deleteButton?.click();
    await tick();

    const deleteMenuAction = target.querySelector(
      '[data-testid="chapter-delete-menu-chapter-delete"]',
    ) as HTMLButtonElement;
    deleteMenuAction?.click();
    await tick();

    const confirmDeleteButton = target.querySelector(
      '[data-testid="chapter-delete-confirm"]',
    ) as HTMLButtonElement;
    confirmDeleteButton?.click();

    await tick();
    expect(target.querySelectorAll('[data-testid^="chapter-row-"]')).toHaveLength(0);

    unmount(instance);
    target.remove();
  });

  it('emits reorder callback on chapter drag and drop', async () => {
    const target = createTarget();
    const onReorderChapter = vi.fn();

    const instance = mount(MainSidebar, {
      target,
      props: {
        story: createStoryStoreForTest({
          chapters: [
            {
              id: 'chapter-a',
              manifest: 'https://example.org/manifest-a.json',
              canvasIndex: 0,
            },
            {
              id: 'chapter-b',
              manifest: 'https://example.org/manifest-b.json',
              canvasIndex: 1,
            },
          ],
        }).story,
        onReorderChapter,
      },
    });

    const chapterA = target.querySelector('[data-testid="chapter-row-chapter-a"]');
    const chapterB = target.querySelector('[data-testid="chapter-row-chapter-b"]');
    expect(chapterA).toBeTruthy();
    expect(chapterB).toBeTruthy();

    const dataTransfer = {
      payload: {} as Record<string, string>,
      effectAllowed: 'none',
      setData(type: string, value: string) {
        this.payload[type] = value;
      },
      getData(type: string) {
        return this.payload[type] ?? '';
      },
    };

    const createDragLikeEvent = (name: string, clientY = 0): Event => {
      const event = new Event(name, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: dataTransfer as unknown as DataTransfer,
      });
      Object.defineProperty(event, 'clientY', {
        value: clientY,
      });
      return event;
    };

    chapterA?.dispatchEvent(createDragLikeEvent('dragstart'));
    chapterB?.dispatchEvent(createDragLikeEvent('dragover', 10));
    chapterB?.dispatchEvent(createDragLikeEvent('drop', 10));

    await tick();
    expect(onReorderChapter).toHaveBeenCalledWith('chapter-a', 'chapter-b', 'after');

    unmount(instance);
    target.remove();
  });
});
