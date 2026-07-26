import { tick } from "svelte";
import { mount, unmount } from "svelte";
import { writable } from "svelte/store";
import { describe, expect, it, vi } from "vitest";
import type { StoryState } from "../../../core/types/story";
import type { MediaType } from "../../../iiif/mediaResolver";
import type { ChapterTaskId } from "../../chapterTasks";
import StoryBuilderWideAuthoring from "../StoryBuilderWideAuthoring.svelte";

describe("StoryBuilderWideAuthoring", () => {
  it("only renders the editor for the active wide chapter tool", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const story = writable<StoryState>({
      narration: {
        tracks: { en: { src: "https://example.org/narration.mp3" } },
      },
      chapters: [
        {
          id: "chapter-two",
          manifest: "https://example.org/manifest",
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
          annotations: { en: { text: "A text annotation" } },
          drawingAnnotations: [
            {
              id: "rectangle-one",
              type: "rectangle",
              rect: { x: 10, y: 10, w: 20, h: 20 },
            },
          ],
          cameraTrack: {
            durationMs: 5000,
            keyframes: [
              { id: "one", timeMs: 0, viewBox: { x: 0, y: 0, w: 100, h: 100 } },
              { id: "two", timeMs: 5000, viewBox: { x: 25, y: 25, w: 50, h: 50 } },
            ],
          },
          narrationSegment: { en: { start: 1, end: 4 } },
          media: { start: 5, end: 25 },
        },
      ],
    });
    const selectedChapterId = writable<string | null>("chapter-two");
    const activeTask = writable<ChapterTaskId | null>(null);
    const mediaType = writable<MediaType | null>("audio");
    const mediaSources = writable([
      {
        id: "source-audio",
        src: "https://example.org/source.mp4",
        type: "audio" as const,
        duration: 120,
      },
    ]);
    const mediaMarks = writable({ lastTime: 12, markIn: 5, markOut: 25 });
    const onAssignMediaSegment = vi.fn();
    const onPreviewMediaSegment = vi.fn();
    const onStopPreviewMediaSegment = vi.fn();
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
        mediaType,
        mediaSources,
        mediaMarks,
        avMarksValid: writable(true),
        onAddPoint: vi.fn(),
        onGoToPoint: vi.fn(),
        onSetNarrationTrack: vi.fn(),
        onAssignNarrationSegment: vi.fn(),
        onAssignMediaSegment,
        onPreviewMediaSegment,
        onStopPreviewMediaSegment,
        onDeleteDrawingAnnotation,
        onDeleteTextAnnotation,
        onEditDrawingAnnotation,
        onEditTextAnnotation,
      },
    });

    expect(target.querySelector(".story-wide-authoring")).toBeNull();
    expect(target.querySelector(".story-wide-narration")).toBeNull();

    activeTask.set("motion");
    await tick();
    expect(target.querySelector(".story-wide-authoring")).toBeTruthy();
    expect(target.querySelector(".story-wide-narration")).toBeNull();
    expect(target.textContent).toContain("1.00× zoom");
    expect(target.textContent).toContain("2.00× zoom");

    activeTask.set("audio-timing");
    await tick();
    expect(target.querySelector(".story-wide-authoring")).toBeNull();
    expect(target.querySelector(".story-wide-narration")).toBeTruthy();
    expect(
      target.querySelector('[data-testid="chapter-narration-waveform"]'),
    ).toBeTruthy();
    expect(
      target.querySelectorAll(".story-wide-narration__range input"),
    ).toHaveLength(2);
    expect(
      Array.from(
        target.querySelectorAll<HTMLInputElement>(
          ".story-wide-narration__range input",
        ),
      ).map((input) => input.value),
    ).toEqual(["1.00", "4.00"]);
    expect(target.textContent).toContain("Preview");

    // The media-timing footer remains available while an audio source is resolving.
    mediaSources.set([]);
    activeTask.set("media-timing");
    await tick();
    expect(
      target.querySelector('[data-testid="chapter-media-timing-editor"]'),
    ).toBeTruthy();
    expect(
      target.querySelector('[data-testid="chapter-media-waveform"]'),
    ).toBeTruthy();
    expect(target.textContent).not.toContain("manifest audio");
    expect(target.textContent).not.toContain(
      "Drag or resize the waveform region",
    );
    expect(
      target.querySelectorAll('.story-wide-media__range input[type="number"]'),
    ).toHaveLength(2);
    expect(target.textContent).not.toContain("Narration is edited separately");
    expect(target.textContent).not.toContain("Apply segment");
    const mediaInputs = target.querySelectorAll<HTMLInputElement>(
      '.story-wide-media__range input[type="number"]',
    );
    expect(Array.from(mediaInputs).map((input) => input.value)).toEqual([
      "5.00",
      "25.00",
    ]);
    mediaInputs[0].value = "6";
    mediaInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    mediaInputs[0].dispatchEvent(new Event("change", { bubbles: true }));
    mediaInputs[1].value = "24";
    mediaInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    mediaInputs[1].dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    expect(onAssignMediaSegment).toHaveBeenLastCalledWith(6, 24);
    expect(Array.from(mediaInputs).map((input) => input.value)).toEqual([
      "6.00",
      "24.00",
    ]);
    const previewMedia = Array.from(target.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Preview segment"),
    ) as HTMLButtonElement;
    const stopMedia = Array.from(target.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Stop"),
    ) as HTMLButtonElement;
    previewMedia.click();
    expect(onAssignMediaSegment).toHaveBeenLastCalledWith(6, 24);
    expect(onPreviewMediaSegment).toHaveBeenCalledOnce();
    stopMedia.click();
    expect(onStopPreviewMediaSegment).toHaveBeenCalledOnce();

    mediaType.set("video");
    mediaSources.set([
      {
        id: "source-video",
        src: "https://example.org/source.mp4",
        type: "video",
        duration: 120,
      },
    ]);
    await tick();
    expect(
      target.querySelector('[data-testid="chapter-media-waveform"]'),
    ).toBeTruthy();
    expect(target.querySelector(".story-wide-media__track")).toBeNull();
    expect(target.querySelector(".story-wide-media__sliders")).toBeNull();

    activeTask.set("focus");
    await tick();
    expect(target.querySelector(".story-wide-annotations")).toBeTruthy();
    expect(target.textContent).toContain("Rectangle");
    expect(target.textContent).toContain("A text annotation");
    expect(
      target.querySelector(".story-wide-annotations__tool-grid"),
    ).toBeNull();
    expect(
      target.querySelectorAll(".story-wide-annotations__group"),
    ).toHaveLength(0);
    expect(
      target.querySelectorAll(".story-wide-annotations__item"),
    ).toHaveLength(2);

    const editButtons = target.querySelectorAll<HTMLButtonElement>(
      ".story-wide-annotations__item-select",
    );
    editButtons[0].click();
    editButtons[1].click();
    expect(onEditTextAnnotation).toHaveBeenCalledWith("en");
    expect(onEditDrawingAnnotation).toHaveBeenCalledWith("rectangle-one");

    const deleteButtons = target.querySelectorAll<HTMLButtonElement>(
      ".story-wide-annotations__item-delete",
    );
    deleteButtons[0].click();
    deleteButtons[1].click();
    expect(onDeleteTextAnnotation).toHaveBeenCalledWith("en");
    expect(onDeleteDrawingAnnotation).toHaveBeenCalledWith("rectangle-one");

    story.update((state) => ({
      ...state,
      chapters: state.chapters.map((chapter) => ({
        ...chapter,
        annotations: {},
        drawingAnnotations: [],
      })),
    }));
    await tick();
    expect(
      target.querySelector("#story-wide-annotations-title")?.textContent,
    ).toContain("0");
    expect(target.textContent).not.toContain("No annotations yet");
    expect(target.querySelector(".story-wide-annotations__items")).toBeNull();

    activeTask.set("details");
    await tick();
    expect(target.querySelector(".story-wide-authoring")).toBeNull();
    expect(target.querySelector(".story-wide-narration")).toBeNull();

    selectedChapterId.set(null);
    await tick();
    expect(target.querySelector(".story-wide-authoring--empty")).toBeTruthy();

    unmount(instance);
    target.remove();
  });
});
