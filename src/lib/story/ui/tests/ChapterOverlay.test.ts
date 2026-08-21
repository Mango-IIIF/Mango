import { describe, expect, it, vi } from "vitest";
import { mount, unmount } from "svelte";
import { tick } from "svelte";
import { writable } from "svelte/store";
import type { ChapterAdvance, StoryState } from "../../../core/types/story";
import type { ChapterTaskId } from "../../chapterTasks";
import ChapterOverlay from "../ChapterOverlay.svelte";
import { createStoryStoreForTest } from "./testHelpers";

const createTarget = (): HTMLDivElement => {
  const target = document.createElement("div");
  document.body.appendChild(target);
  return target;
};

describe("ChapterOverlay", () => {
  it("keeps annotation tools and inventory out of the inspector workspace", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-image",
          manifest: "https://example.org/image-manifest.json",
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          drawingAnnotations: [
            {
              id: "drawing-1",
              type: "rectangle",
              rect: { x: 10, y: 10, w: 20, h: 20 },
              label: { en: "First detail" },
            },
          ],
        },
      ],
    });
    const target = createTarget();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        docked: true,
        chapterId: "chapter-image",
        activeChapterTask: writable<ChapterTaskId | null>("focus"),
      },
    });
    await tick();

    expect(target.querySelector(".chapter-overlay__annotation-tools")).toBeNull();
    expect(target.querySelector(".story-wide-annotations")).toBeNull();
    expect(target.querySelector('[data-testid="inspector-summary-focus"]')).toBeTruthy();
    expect(target.textContent).toContain("1 annotation");

    unmount(instance);
    target.remove();
  });

  it("previews the selected chapter on its own and toggles to stop", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-image",
          manifest: "https://example.org/image-manifest.json",
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
        },
      ],
    });
    const target = createTarget();
    const storyPreviewing = writable(false);
    const onPreviewChapter = vi.fn();
    const onStopChapterPreview = vi.fn();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        docked: true,
        chapterId: "chapter-image",
        storyPreviewing,
        onPreviewChapter,
        onStopChapterPreview,
      },
    });

    const preview = target.querySelector(
      '[data-testid="chapter-preview"]',
    ) as HTMLButtonElement;
    expect(preview.textContent).toContain("Preview chapter");
    expect(preview.textContent).toContain("exactly as the story presents it");

    preview.click();
    expect(onPreviewChapter).toHaveBeenCalledWith("chapter-image");
    expect(onStopChapterPreview).not.toHaveBeenCalled();

    storyPreviewing.set(true);
    await tick();
    expect(preview.textContent).toContain("Stop preview");

    preview.click();
    expect(onStopChapterPreview).toHaveBeenCalledOnce();
    expect(onPreviewChapter).toHaveBeenCalledOnce();

    unmount(instance);
    target.remove();
  });

  it("has no capture control anywhere: the frame is edited on the stage", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-image",
          manifest: "https://example.org/image-manifest.json",
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
        },
      ],
    });
    const target = createTarget();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        docked: true,
        chapterId: "chapter-image",
      },
    });
    await tick();

    expect(target.querySelector('[data-testid="inspector-section-position"]')).toBeTruthy();
    expect(target.querySelector('[data-testid="chapter-update-view"]')).toBeNull();
    expect(target.querySelector('[data-testid="chapter-position-capture"]')).toBeNull();
    expect(target.textContent).not.toContain("Use current view");
    expect(target.textContent).not.toContain("Current view:");
    // Nothing to save either: every edit lands on the chapter as it happens.
    expect(target.querySelector('[data-testid="chapter-save"]')).toBeNull();

    unmount(instance);
    target.remove();
  });

  it("shows the frame's numbers in their own panel and keeps typed edits at the story's aspect", async () => {
    const store = createStoryStoreForTest({
      presentationAspect: 3 / 4,
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
          canvasIndex: 0,
          viewBox: { x: 100.4, y: 200, w: 300, h: 400 },
        },
      ],
    });
    const target = createTarget();
    const onSetChapterPosition = vi.fn();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        language: "en",
        onSetChapterPosition,
      },
    });

    await tick();

    // The frame sits in About alongside the details, no drill-down needed.
    const section = target.querySelector(
      '[data-testid="inspector-section-position"]',
    ) as HTMLElement;
    expect(section.textContent).toContain("Frame");
    expect(section.textContent).not.toContain("Content (EN)");
    const frameToggle = target.querySelector(
      '[data-testid="inspector-toggle-position"]',
    ) as HTMLButtonElement;
    expect(frameToggle.getAttribute("aria-expanded")).toBe("false");
    frameToggle.click();
    await tick();
    expect(frameToggle.getAttribute("aria-expanded")).toBe("true");

    const xInput = target.querySelector(
      '[data-testid="chapter-position-x"]',
    ) as HTMLInputElement;
    const yInput = target.querySelector(
      '[data-testid="chapter-position-y"]',
    ) as HTMLInputElement;
    const wInput = target.querySelector(
      '[data-testid="chapter-position-w"]',
    ) as HTMLInputElement;
    const hInput = target.querySelector(
      '[data-testid="chapter-position-h"]',
    ) as HTMLInputElement;
    expect(xInput.value).toBe("100");
    expect(yInput.value).toBe("200");
    expect(wInput.value).toBe("300");
    expect(hInput.value).toBe("400");
    // What is drawn is what is stored, so there is no second set of numbers.
    expect(target.querySelector('[data-testid="chapter-position-current"]')).toBeNull();
    expect(target.querySelector('[data-testid="chapter-position-stored"]')).toBeNull();
    expect(target.querySelector('[data-testid="chapter-position-note"]')).toBeNull();
    expect(
      target.querySelector('[data-testid="chapter-position-aspect"]')?.textContent,
    ).toContain("3:4");

    /*
     * A typed width pulls the height along at the story's aspect, so the
     * numbers on screen always describe a frame the story can hold and the
     * value typed is the value kept — nothing is rewritten on commit.
     */
    wInput.value = "600";
    wInput.dispatchEvent(new Event("input"));
    await tick();
    expect(hInput.value).toBe("800");
    wInput.dispatchEvent(new Event("change"));
    expect(onSetChapterPosition).toHaveBeenCalledWith("chapter-1", {
      x: 100.4,
      y: 200,
      w: 600,
      h: 800,
    });

    onSetChapterPosition.mockClear();
    xInput.value = "50";
    xInput.dispatchEvent(new Event("input"));
    xInput.dispatchEvent(new Event("change"));
    expect(onSetChapterPosition).toHaveBeenCalledWith("chapter-1", {
      x: 50,
      y: 200,
      w: 300,
      h: 400,
    });

    onSetChapterPosition.mockClear();
    hInput.value = "-5";
    hInput.dispatchEvent(new Event("input"));
    await tick();
    hInput.dispatchEvent(new Event("change"));
    await tick();
    expect(onSetChapterPosition).not.toHaveBeenCalled();
    expect(hInput.value).toBe("400");

    unmount(instance);
    target.remove();
  });

  it("closes Frame again whenever its tool is no longer active", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
        },
      ],
    });
    const target = createTarget();
    const activeChapterTask = writable<ChapterTaskId | null>(null);
    const onChapterTaskChange = vi.fn((task: ChapterTaskId | null) =>
      activeChapterTask.set(task),
    );
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        activeChapterTask,
        onChapterTaskChange,
      },
    });
    await tick();

    const frameToggle = target.querySelector(
      '[data-testid="inspector-toggle-position"]',
    ) as HTMLButtonElement;
    expect(frameToggle.getAttribute("aria-expanded")).toBe("false");

    (
      target.querySelector(
        '[data-testid="inspector-activate-position"]',
      ) as HTMLButtonElement
    ).click();
    await tick();
    expect(onChapterTaskChange).toHaveBeenLastCalledWith("position");
    expect(frameToggle.getAttribute("aria-expanded")).toBe("true");

    activeChapterTask.set(null);
    await tick();
    expect(frameToggle.getAttribute("aria-expanded")).toBe("false");

    frameToggle.click();
    await tick();
    expect(frameToggle.getAttribute("aria-expanded")).toBe("true");
    activeChapterTask.set("focus");
    await tick();
    expect(
      target.querySelector('[data-testid="inspector-toggle-position"]'),
    ).toBeNull();
    activeChapterTask.set(null);
    await tick();
    expect(
      target
        .querySelector('[data-testid="inspector-toggle-position"]')
        ?.getAttribute("aria-expanded"),
    ).toBe("false");

    unmount(instance);
    target.remove();
  });

  it("lets a frame be typed in when the chapter has none", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
          canvasIndex: 0,
        },
      ],
    });
    const target = createTarget();
    const onSetChapterPosition = vi.fn();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        language: "en",
        onSetChapterPosition,
      },
    });

    const section = target.querySelector(
      '[data-testid="chapter-position-section"]',
    ) as HTMLElement;
    expect(section.textContent).toContain("No frame yet");
    const goTo = target.querySelector(
      '[data-testid="chapter-position-goto"]',
    ) as HTMLButtonElement;
    expect(goTo.disabled).toBe(true);

    const inputs = Object.fromEntries(
      (["x", "y", "w", "h"] as const).map((field) => [
        field,
        target.querySelector(
          `[data-testid="chapter-position-${field}"]`,
        ) as HTMLInputElement,
      ]),
    );
    for (const input of Object.values(inputs)) {
      expect(input.value).toBe("");
    }

    inputs.x.value = "10";
    inputs.x.dispatchEvent(new Event("input"));
    inputs.x.dispatchEvent(new Event("change"));
    await tick();
    expect(onSetChapterPosition).not.toHaveBeenCalled();
    expect(inputs.x.value).toBe("10");

    inputs.y.value = "20";
    inputs.y.dispatchEvent(new Event("input"));
    inputs.w.value = "800";
    inputs.w.dispatchEvent(new Event("input"));
    inputs.h.value = "600";
    inputs.h.dispatchEvent(new Event("input"));
    inputs.h.dispatchEvent(new Event("change"));
    expect(onSetChapterPosition).toHaveBeenCalledWith("chapter-1", {
      x: 10,
      y: 20,
      w: 800,
      h: 600,
    });
    expect(target.querySelector('[data-testid="chapter-position-capture"]')).toBeNull();

    unmount(instance);
    target.remove();
  });

  it("exposes the frame as its own chapter tool, disabled for audio chapters", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
        },
      ],
    });
    const target = createTarget();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        language: "en",
      },
    });

    const card = target.querySelector(
      '[data-task-id="position"]',
    ) as HTMLElement;
    expect(card.textContent).toContain("Frame");
    expect(card.textContent).toContain("Configured");
    expect(
      (card.querySelector("button") as HTMLButtonElement).disabled,
    ).toBe(false);

    unmount(instance);
    target.remove();

    const audioTarget = createTarget();
    const audioInstance = mount(ChapterOverlay, {
      target: audioTarget,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        language: "en",
        mediaType: writable("audio"),
      },
    });

    const audioCard = audioTarget.querySelector(
      '[data-task-id="position"]',
    ) as HTMLElement;
    expect(
      audioCard
        .querySelector('[data-testid="inspector-toggle-position"]')
        ?.getAttribute("aria-expanded"),
    ).toBe("false");
    (
      audioCard.querySelector(
        '[data-testid="inspector-toggle-position"]',
      ) as HTMLButtonElement
    ).click();
    await tick();
    expect(audioCard.textContent).toContain(
      "available for image and PDF chapters only.",
    );

    unmount(audioInstance);
    audioTarget.remove();
  });

  it("routes go-to-saved-position through the revert callback and hides the section for audio", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
        },
      ],
    });
    const target = createTarget();
    const onRevertChapterPosition = vi.fn();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        language: "en",
        onRevertChapterPosition,
      },
    });

    const goTo = target.querySelector(
      '[data-testid="chapter-position-goto"]',
    ) as HTMLButtonElement;
    expect(goTo.disabled).toBe(false);
    goTo.click();
    expect(onRevertChapterPosition).toHaveBeenCalledWith("chapter-1");

    unmount(instance);
    target.remove();

    const audioTarget = createTarget();
    const audioInstance = mount(ChapterOverlay, {
      target: audioTarget,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        language: "en",
        mediaType: writable("audio"),
      },
    });
    expect(
      audioTarget.querySelector('[data-testid="chapter-position-section"]'),
    ).toBeNull();

    unmount(audioInstance);
    audioTarget.remove();
  });

  it("shows manifest audio editing instructions in the media timing sidebar", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-audio",
          manifest: "https://example.org/audio-manifest.json",
          canvasIndex: 0,
          media: { start: 170, end: 183 },
        },
      ],
    });
    const target = createTarget();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-audio",
        mediaType: writable("audio"),
        activeChapterTask: writable<ChapterTaskId | null>("media-timing"),
      },
    });
    await tick();
    // The inspector follows the open tool into its group.
    expect(
      target.querySelector('[data-testid="inspector-group-timing"]')?.getAttribute("aria-selected"),
    ).toBe("true");

    const instructions = target.textContent?.replace(/\s+/g, " ") ?? "";
    expect(instructions).toContain("Manifest audio timing");
    expect(instructions).toContain("Drag the shaded selection");
    expect(instructions).toContain("zoom and scroll the waveform");
    expect(instructions).toContain("exact time edits are saved automatically");

    unmount(instance);
    target.remove();
  });

  it("shows the same waveform editing instructions for manifest video", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-video",
          manifest: "https://example.org/video-manifest.json",
          canvasIndex: 0,
          media: { start: 10, end: 20 },
        },
      ],
    });
    const target = createTarget();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-video",
        mediaType: writable("video"),
        activeChapterTask: writable<ChapterTaskId | null>("media-timing"),
      },
    });
    await tick();

    const instructions = target.textContent?.replace(/\s+/g, " ") ?? "";
    expect(instructions).toContain("Manifest video timing");
    expect(instructions).toContain("Drag the shaded selection");
    expect(instructions).toContain("zoom and scroll the waveform");
    expect(instructions).toContain("exact time edits are saved automatically");

    unmount(instance);
    target.remove();
  });

  it("loads the first manifest from the empty story state", async () => {
    const store = createStoryStoreForTest({ chapters: [] });
    const target = createTarget();
    const onLoadManifest = vi.fn();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: null,
        onLoadManifest,
      },
    });

    expect(target.textContent).toContain("Load a source");
    const input = target.querySelector(
      '[data-testid="chapter-manifest"]',
    ) as HTMLInputElement;
    const load = target.querySelector(
      '[data-testid="chapter-manifest-reload"]',
    ) as HTMLButtonElement;
    expect(input.getAttribute("aria-label")).toBe("Manifest URL");
    expect(load.textContent?.trim()).toBe("Load manifest");
    expect(load.disabled).toBe(true);

    input.value = "https://example.org/manifest.json";
    input.dispatchEvent(new Event("input"));
    await tick();
    expect(load.disabled).toBe(false);
    load.click();
    expect(onLoadManifest).toHaveBeenCalledWith(
      "https://example.org/manifest.json",
    );

    unmount(instance);
    target.remove();
  });

  it("loads the first source and creates its chapter in one action", () => {
    const target = createTarget();
    const onLoadManifest = vi.fn();
    const onCreateChapter = vi.fn();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: createStoryStoreForTest({ chapters: [] }).story,
        open: true,
        docked: true,
        chapterId: null,
        currentManifest: "https://example.org/manifest.json",
        onLoadManifest,
        onCreateChapter,
      },
    });

    expect(target.querySelector('[data-testid="chapter-canvas-select"]')).toBeNull();
    const load = target.querySelector(
      '[data-testid="chapter-manifest-reload"]',
    ) as HTMLButtonElement;
    load.click();
    expect(onLoadManifest).toHaveBeenCalledWith(
      "https://example.org/manifest.json",
    );
    expect(onCreateChapter).toHaveBeenCalledOnce();

    unmount(instance);
    target.remove();
  });

  it("updates manifest and triggers reload", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
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
        chapterId: "chapter-1",
        language: "en",
        onUpdateManifest: (chapterId: string, manifest: string) =>
          store.setChapterManifest({ chapterId, manifest }),
        onReloadManifest: (
          _chapterId: string,
          manifest: string,
          canvasIndex: number,
        ) => {
          reloadPayload = { manifest, canvasIndex };
        },
      },
    });

    (
      target.querySelector('[data-testid="inspector-group-source"]') as HTMLButtonElement
    ).click();
    await tick();

    const input = target.querySelector(
      '[data-testid="chapter-manifest"]',
    ) as HTMLInputElement;
    expect(target.querySelector('[data-testid="chapter-canvas-select"]')).toBeNull();
    input.value = "https://example.org/updated.json";
    input.dispatchEvent(new Event("input"));
    await tick();

    const reload = target.querySelector(
      '[data-testid="chapter-manifest-reload"]',
    ) as HTMLButtonElement;
    expect(target.querySelector('[data-testid="chapter-apply-source"]')).toBeNull();
    reload.click();

    await tick();
    const storyValue = await new Promise((resolve) => {
      store.story.subscribe((value) => resolve(value))();
    });
    expect((storyValue as any).chapters[0].manifest).toBe(
      "https://example.org/updated.json",
    );
    expect(reloadPayload).toEqual({
      manifest: "https://example.org/updated.json",
      canvasIndex: 2,
    });

    unmount(instance);
    target.remove();
  });

  it("does not duplicate selected annotation options in the sidebar", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          drawingAnnotations: [
            {
              id: "rectangle-1",
              type: "rectangle",
              rect: { x: 1, y: 1, w: 4, h: 3 },
              label: { en: "Note" },
            },
          ],
        },
      ],
    });
    const target = createTarget();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        language: "en",
        languages: ["en", "cy"],
        activeChapterTask: writable<ChapterTaskId | null>("focus"),
      },
    });
    await tick();

    expect(target.querySelector('[data-testid="drawing-language-cy"]')).toBeNull();
    expect(target.querySelector(".chapter-overlay__annotation-editor")).toBeNull();
    expect(target.querySelector('[data-testid="inspector-summary-focus"]')).toBeTruthy();

    unmount(instance);
    target.remove();
  });

  it("stores chapter transition time independently", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
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
        chapterId: "chapter-1",
        language: "en",
        onUpdateAdvanceMode: (
          chapterId: string,
          mode: ChapterAdvance["mode"],
        ) => store.setAdvanceMode({ chapterId, mode }),
        onUpdateDelay: (chapterId: string, delayMs: number | undefined) =>
          store.setDelay({ chapterId, delayMs }),
      },
    });

    (
      target.querySelector('[data-testid="inspector-group-timing"]') as HTMLButtonElement
    ).click();
    await tick();

    const visibleTask = target.querySelector(
      '[data-testid="inspector-section-transition-timing"]',
    ) as HTMLElement;
    expect(visibleTask.textContent).toContain("Chapter transition time");
    expect(visibleTask.textContent).not.toContain("Advance timing");
    const transitionToggle = visibleTask.querySelector(
      '[data-testid="inspector-toggle-transition-timing"]',
    ) as HTMLButtonElement;
    expect(transitionToggle.getAttribute("aria-expanded")).toBe("false");
    expect(
      visibleTask.querySelector('#inspector-section-transition-timing')?.hasAttribute('hidden'),
    ).toBe(true);
    transitionToggle.click();
    await tick();
    expect(transitionToggle.getAttribute("aria-expanded")).toBe("true");

    const delayInput = visibleTask.querySelector(
      '[data-testid="chapter-transition-delay"]',
    ) as HTMLInputElement;
    expect(delayInput.value).toBe("2");
    delayInput.value = "3";
    delayInput.dispatchEvent(new Event("input"));

    await tick();
    const storyValue = await new Promise((resolve) => {
      store.story.subscribe((value) => resolve(value))();
    });
    expect((storyValue as any).chapters[0].advance.mode).toBe("auto");
    expect((storyValue as any).chapters[0].advance.delayMs).toBe(3000);

    unmount(instance);
    target.remove();
  });

  it("stores chapter title and description for active language", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
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
        chapterId: "chapter-1",
        language: "en",
        onUpdateChapterTitle: (
          chapterId: string,
          lang: string,
          value: string,
        ) => store.setChapterTitle({ chapterId, language: lang, value }),
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
    titleInput.value = "Chapter heading";
    titleInput.dispatchEvent(new Event("input"));

    const descriptionInput = target.querySelector(
      '[data-testid="chapter-description"]',
    ) as HTMLTextAreaElement;
    descriptionInput.value = "Chapter summary";
    descriptionInput.dispatchEvent(new Event("input"));

    await tick();
    const storyValue = await new Promise((resolve) => {
      store.story.subscribe((value) => resolve(value))();
    });
    expect((storyValue as any).chapters[0].title.en).toBe("Chapter heading");
    expect((storyValue as any).chapters[0].description.en).toBe(
      "Chapter summary",
    );

    unmount(instance);
    target.remove();
  });

  it("collapses and expands the details section", async () => {
    const store = createStoryStoreForTest({
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 10, h: 10 },
          title: { en: "Title" },
        },
      ],
    });
    const target = createTarget();

    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        language: "en",
      },
    });

    const titleInput = target.querySelector(
      '[data-testid="chapter-title"]',
    ) as HTMLInputElement;
    const sectionContent = titleInput.closest(
      ".inspector-section__body",
    ) as HTMLElement;
    expect(sectionContent.hidden).toBe(false);

    const toggle = target.querySelector(
      '[data-testid="inspector-toggle-details"]',
    ) as HTMLButtonElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    toggle.click();
    await tick();
    expect(sectionContent.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    toggle.click();
    await tick();
    expect(sectionContent.hidden).toBe(false);

    unmount(instance);
    target.remove();
  });

  it("previews narration only between the selected start and end times", async () => {
    const story = writable<StoryState>({
      narration: {
        tracks: {
          en: { src: "https://example.org/narration.mp3" },
        },
      },
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
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
        chapterId: "chapter-1",
        language: "en",
        activeChapterTask: writable<ChapterTaskId | null>("audio-timing"),
      },
    });
    await tick();

    story.update((value) => ({
      ...value,
      narration: {
        tracks: {
          en: { src: "https://example.org/updated-narration.mp3" },
        },
      },
    }));
    await tick();

    const audio = target.querySelector(
      ".chapter-overlay__audio-source",
    ) as HTMLAudioElement;
    expect(target.textContent).toContain("Chapter narration");
    expect(
      (
        target.querySelector(
          '[data-testid="chapter-narration-url"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("https://example.org/updated-narration.mp3");
    Object.defineProperty(audio, "readyState", {
      configurable: true,
      value: 1,
    });
    const play = vi.spyOn(audio, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(audio, "pause").mockImplementation(() => undefined);
    const preview = target.querySelector(
      '[data-testid="chapter-narration-preview"]',
    ) as HTMLButtonElement;

    expect(preview.textContent?.trim()).toBe("Preview narration");
    expect(preview.disabled).toBe(false);

    preview.click();
    await tick();

    expect(audio.currentTime).toBe(5);
    expect(play).toHaveBeenCalledOnce();
    expect(preview.textContent?.trim()).toBe("Stop preview");

    audio.currentTime = 10;
    audio.dispatchEvent(new Event("timeupdate"));
    await tick();

    expect(pause).toHaveBeenCalledOnce();
    expect(preview.textContent?.trim()).toBe("Preview narration");

    unmount(instance);
    target.remove();
  });

  it("allows narration to be skipped for the current chapter", async () => {
    const story = writable<StoryState>({
      narration: {
        tracks: { en: { src: "https://example.org/narration.mp3" } },
      },
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest.json",
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
        chapterId: "chapter-1",
        language: "en",
        onSkipNarration,
        activeChapterTask: writable<ChapterTaskId | null>("audio-timing"),
      },
    });
    await tick();

    const skip = target.querySelector(
      '[data-testid="chapter-narration-skip"]',
    ) as HTMLButtonElement;
    skip.click();

    expect(onSkipNarration).toHaveBeenCalledWith("en");

    unmount(instance);
    target.remove();
  });
});
