import { describe, expect, it, vi } from "vitest";
import { mount, unmount } from "svelte";
import { tick } from "svelte";
import { writable } from "svelte/store";
import type { ChapterAdvance, StoryState } from "../../../core/types/story";
import type { ChapterTaskId } from "../../chapterTasks";
import ChapterOverlay from "../ChapterOverlay.svelte";
import { ANNOTATION_TOOLS } from "../../../features/annotations/annotationTools";
import { createStoryStoreForTest } from "./testHelpers";

const createTarget = (): HTMLDivElement => {
  const target = document.createElement("div");
  document.body.appendChild(target);
  return target;
};

describe("ChapterOverlay", () => {
  it("renders its annotation palette from the shared tool list", async () => {
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
    const onSetAnnotationTool = vi.fn();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        docked: true,
        chapterId: "chapter-image",
        activeChapterTask: writable<ChapterTaskId | null>("focus"),
        onSetAnnotationTool,
      },
    });
    await tick();

    const palette = target.querySelector(".chapter-overlay__annotation-tools");
    const buttons = Array.from(palette?.querySelectorAll("button") ?? []);
    // One button per shared tool: the builder no longer keeps its own list.
    expect(buttons).toHaveLength(ANNOTATION_TOOLS.length);

    buttons[0].click();
    expect(onSetAnnotationTool).toHaveBeenCalledWith(ANNOTATION_TOOLS[0].id);

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

  it("no longer shows the viewer position changed notice", async () => {
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
    const viewBox = writable({ x: 0, y: 0, w: 100, h: 100 });
    const target = createTarget();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        docked: true,
        chapterId: "chapter-image",
        viewBox,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 550));
    viewBox.set({ x: 12, y: 18, w: 80, h: 80 });
    await tick();

    expect(
      target.querySelector('[data-testid="chapter-update-view"]'),
    ).toBeNull();
    expect(target.textContent).not.toContain("The viewer has moved");

    unmount(instance);
    target.remove();
  });

  it("shows the saved viewer position in its own panel and commits manual edits", async () => {
    const store = createStoryStoreForTest({
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
        viewBox: writable({ x: 5, y: 10, w: 90, h: 80 }),
        onSetChapterPosition,
      },
    });

    (
      target.querySelector(
        '[data-task-id="position"] button',
      ) as HTMLButtonElement
    ).click();
    await tick();

    const visibleTask = target.querySelector(
      ".chapter-overlay__task:not([hidden])",
    ) as HTMLElement;
    expect(visibleTask.textContent).toContain("Viewer position");
    expect(visibleTask.textContent).not.toContain("Content (EN)");

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
    expect(
      target.querySelector('[data-testid="chapter-position-current"]')
        ?.textContent,
    ).toContain("Current view: 5 · 10 · 90 · 80");

    wInput.value = "640";
    wInput.dispatchEvent(new Event("input"));
    wInput.dispatchEvent(new Event("change"));
    expect(onSetChapterPosition).toHaveBeenCalledWith("chapter-1", {
      x: 100,
      y: 200,
      w: 640,
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

  it("supports capture and manual entry when no position is saved", async () => {
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
    const onUpdateChapterPosition = vi.fn();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        language: "en",
        viewBox: writable({ x: 5, y: 10, w: 90, h: 80 }),
        onSetChapterPosition,
        onUpdateChapterPosition,
      },
    });

    const section = target.querySelector(
      '[data-testid="chapter-position-section"]',
    ) as HTMLElement;
    expect(section.textContent).toContain("No position is saved yet");
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

    const capture = target.querySelector(
      '[data-testid="chapter-position-capture"]',
    ) as HTMLButtonElement;
    capture.click();
    await tick();
    expect(onUpdateChapterPosition).toHaveBeenCalledWith("chapter-1");
    expect(capture.textContent).toContain("Position updated");

    unmount(instance);
    target.remove();
  });

  it("exposes viewer position as its own chapter tool, disabled for audio chapters", async () => {
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
    expect(card.textContent).toContain("Viewer position");
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
    expect(audioCard.textContent).toContain(
      "Viewer position is available for image and PDF chapters only.",
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
      },
    });

    const mediaTiming = Array.from(target.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Media timing"),
    ) as HTMLButtonElement;
    mediaTiming.click();
    await tick();

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
      },
    });

    const mediaTiming = Array.from(target.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Media timing"),
    ) as HTMLButtonElement;
    mediaTiming.click();
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

  it("creates the first chapter after the manifest canvases are ready", () => {
    const target = createTarget();
    const onCreateChapter = vi.fn();
    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: createStoryStoreForTest({ chapters: [] }).story,
        open: true,
        docked: true,
        chapterId: null,
        currentManifest: "https://example.org/manifest.json",
        canvasCount: 2,
        onCreateChapter,
      },
    });

    const onboarding = target.textContent?.replace(/\s+/g, " ") ?? "";
    expect(onboarding).toContain("Step 2 of 2");
    expect(onboarding).toContain("Image placement can be adjusted afterwards");
    const create = target.querySelector(
      '[data-testid="chapter-create-first"]',
    ) as HTMLButtonElement;
    create.click();
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
    let selectedCanvas = -1;

    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        canvasIndex: 2,
        canvasCount: 3,
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
        onSelectCanvas: (canvasIndex: number) => {
          selectedCanvas = canvasIndex;
        },
      },
    });

    const input = target.querySelector(
      '[data-testid="chapter-manifest"]',
    ) as HTMLInputElement;
    const canvasSelect = target.querySelector(
      '[data-testid="chapter-canvas-select"]',
    ) as HTMLSelectElement;
    expect(canvasSelect.options).toHaveLength(3);
    expect(canvasSelect.value).toBe("2");
    canvasSelect.value = "1";
    canvasSelect.dispatchEvent(new Event("change"));
    expect(selectedCanvas).toBe(1);
    input.value = "https://example.org/updated.json";
    input.dispatchEvent(new Event("input"));
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
      "https://example.org/updated.json",
    );
    expect(reloadPayload).toEqual({
      manifest: "https://example.org/updated.json",
      canvasIndex: 2,
    });

    unmount(instance);
    target.remove();
  });

  it("edits selected Mango annotation translations and appearance in the sidebar", async () => {
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
    const selectedDrawingAnnotationId = writable<string | null>("rectangle-1");
    const onSetDrawingAnnotationLabel = vi.fn();
    const onSetDrawingAnnotationStyle = vi.fn();

    const instance = mount(ChapterOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        chapterId: "chapter-1",
        language: "en",
        languages: ["en", "cy"],
        selectedDrawingAnnotationId,
        onSetDrawingAnnotationLabel,
        onSetDrawingAnnotationStyle,
      },
    });

    (
      target.querySelector('[data-task-id="focus"] button') as HTMLButtonElement
    ).click();
    await tick();

    const translationInputs = target.querySelectorAll<HTMLInputElement>(
      ".chapter-overlay__translation-field input",
    );
    expect(translationInputs).toHaveLength(2);
    translationInputs[1].value = "Nodyn";
    translationInputs[1].dispatchEvent(new Event("input"));
    expect(onSetDrawingAnnotationLabel).toHaveBeenCalledWith(
      "rectangle-1",
      "cy",
      "Nodyn",
    );

    const solidButton = Array.from(
      target.querySelectorAll<HTMLButtonElement>(
        ".chapter-overlay__segmented-control button",
      ),
    ).find((button) => button.textContent?.trim() === "Solid")!;
    solidButton.click();
    expect(onSetDrawingAnnotationStyle).toHaveBeenCalledWith("rectangle-1", {
      fillMode: "solid",
    });

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

    const transitionTiming = target.querySelector(
      '[data-task-id="transition-timing"] button',
    ) as HTMLButtonElement;
    transitionTiming.click();
    await tick();

    const visibleTask = target.querySelector(
      ".chapter-overlay__task:not([hidden])",
    ) as HTMLElement;
    expect(visibleTask.textContent).toContain("Chapter transition time");
    expect(visibleTask.textContent).not.toContain("Advance timing");

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

  it("collapses and expands metadata section", async () => {
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
      ".chapter-overlay__section-content",
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
