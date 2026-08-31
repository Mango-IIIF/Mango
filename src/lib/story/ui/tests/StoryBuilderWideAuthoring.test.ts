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
              {
                id: "two",
                timeMs: 5000,
                viewBox: { x: 25, y: 25, w: 50, h: 50 },
              },
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
    const selectedPointId = writable<string | null>(null);
    const motionPreviewing = writable(false);
    const motionPreviewPinsVisible = writable(false);
    const selectedAnnotationId = writable<string | null>(null);
    const annotationTool = writable("select" as const);
    const onSetAnnotationTool = vi.fn((tool) => annotationTool.set(tool));
    const onSetAnnotationLabel = vi.fn();
    const onSetAnnotationStyle = vi.fn();
    const onEditAnnotation = vi.fn((annotationId: string) =>
      selectedAnnotationId.set(annotationId),
    );
    const onFinishAnnotationEdit = vi.fn(() =>
      selectedAnnotationId.set(null),
    );
    const onUpdatePointFromView = vi.fn();
    const onDeletePoint = vi.fn();
    const onUpdateMotionPathType = vi.fn();
    const onUpdateMotionInitialDwell = vi.fn();
    const onUpdateMotionEasing = vi.fn();
    const onSetMotionPreviewPinsVisible = vi.fn((visible: boolean) =>
      motionPreviewPinsVisible.set(visible),
    );
    const onPreviewMotion = vi.fn();
    const onStopMotionPreview = vi.fn();
    const onSkipNarration = vi.fn();
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
        languages: ["en", "cy"],
        selectedPointId,
        onAddPoint: vi.fn(),
        onDeletePoint,
        onGoToPoint: vi.fn(),
        onUpdatePointFromView,
        motionPreviewing,
        motionPreviewPinsVisible,
        onSetMotionPreviewPinsVisible,
        onUpdateMotionPathType,
        onUpdateMotionInitialDwell,
        onUpdateMotionEasing,
        onUpdateMotionDuration: vi.fn(),
        onApplyMotionPreset: vi.fn(),
        onPreviewMotion,
        onStopMotionPreview,
        annotationTool,
        selectedAnnotationId,
        onSetAnnotationTool,
        onSetAnnotationLabel,
        onSetAnnotationStyle,
        onDeleteAnnotation: vi.fn(),
        onEditAnnotation,
        onFinishAnnotationEdit,
        onSetNarrationTrack: vi.fn(),
        onAssignNarrationSegment: vi.fn(),
        onSkipNarration,
        onAssignMediaSegment,
        onPreviewMediaSegment,
        onStopPreviewMediaSegment,
      },
    });

    expect(target.querySelector(".story-wide-authoring")).toBeNull();
    expect(target.querySelector(".story-wide-narration")).toBeNull();

    activeTask.set("motion");
    await tick();
    expect(target.querySelector(".story-wide-authoring")).toBeTruthy();
    expect(target.querySelector(".story-wide-narration")).toBeNull();
    const previewNextToDone = target.querySelector<HTMLButtonElement>(
      '[data-testid="motion-preview-next-to-done"]',
    )!;
    expect(previewNextToDone.nextElementSibling?.getAttribute('data-testid')).toBe(
      'story-wide-done',
    );
    expect(target.querySelector('[data-testid="motion-preview-pins-toggle"]')).toBeNull();
    expect(target.querySelector('[data-testid="story-wide-done"]')).toBeTruthy();
    previewNextToDone.click();
    expect(onPreviewMotion).toHaveBeenCalledOnce();
    expect(target.textContent).toContain("1.00× zoom");
    expect(target.textContent).toContain("2.00× zoom");
    const updatePoint = [...target.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.includes("Save current zoom"),
    )!;
    expect(updatePoint.disabled).toBe(true);
    expect(target.querySelector('[data-testid="motion-delete-selected"]')).toBeNull();
    selectedPointId.set("one");
    await tick();
    expect(updatePoint.disabled).toBe(false);
    const deleteSelected = target.querySelector<HTMLButtonElement>(
      '[data-testid="motion-delete-selected"]',
    )!;
    expect(deleteSelected.textContent).toContain("Delete camera point 1");
    expect(target.querySelector(".story-wide-authoring__point-delete")).toBeNull();
    deleteSelected.click();
    expect(onDeletePoint).toHaveBeenCalledWith("one");
    updatePoint.click();
    expect(onUpdatePointFromView).toHaveBeenCalledWith("one");

    const tab = (label: string) =>
      [...target.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
        (button) => button.textContent?.trim() === label,
      )!;
    expect(tab("Pins").getAttribute("aria-selected")).toBe("true");
    tab("Options").click();
    await tick();
    expect(target.querySelector("#motion-pins-panel")).toBeNull();
    expect(target.querySelector("#motion-options-panel .motion-panel--wide")).toBeTruthy();
    expect(target.querySelector(".motion-panel__fine-tuning-grid")).toBeTruthy();
    const motionOption = (label: string) =>
      [...target.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.trim() === label,
      )!;
    motionOption("Curved Spline").click();
    motionOption("1.0s").click();
    motionOption("Ease out").click();
    expect(onUpdateMotionPathType).toHaveBeenCalledWith("spline");
    expect(onUpdateMotionInitialDwell).toHaveBeenCalledWith(1000);
    expect(onUpdateMotionEasing).toHaveBeenCalledWith("ease-out");
    motionPreviewing.set(true);
    await tick();
    expect(target.querySelector(".story-wide-authoring")).toBeNull();
    expect(target.querySelector('[data-testid="story-wide-done"]')).toBeTruthy();
    expect(target.querySelector(".story-wide-preview-controls")).toBeTruthy();
    const pinToggle = target.querySelector<HTMLButtonElement>(
      '[data-testid="motion-preview-pins-toggle"]',
    )!;
    pinToggle.click();
    expect(onSetMotionPreviewPinsVisible).toHaveBeenCalledWith(true);
    expect(previewNextToDone.textContent).toContain('Stop preview');
    previewNextToDone.click();
    expect(onStopMotionPreview).toHaveBeenCalledOnce();
    motionPreviewing.set(false);
    await tick();
    expect(target.querySelector("#motion-options-panel")).toBeTruthy();
    tab("Pins").click();
    await tick();
    expect(target.querySelector("#motion-pins-panel")).toBeTruthy();
    expect(target.querySelector("#motion-options-panel")).toBeNull();

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
    const noNarration = target.querySelector(
      '[data-testid="chapter-narration-none"]',
    ) as HTMLButtonElement;
    noNarration.click();
    await tick();
    expect(onSkipNarration).toHaveBeenCalledWith("en");
    expect(
      target.querySelector('[data-testid="chapter-narration-editor"]')
        ?.getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      target.querySelector<HTMLInputElement>(
        ".story-wide-narration__track input",
      )?.disabled,
    ).toBe(true);
    expect(
      target.querySelector('[data-testid="chapter-narration-waveform"]')
        ?.getAttribute("aria-disabled"),
    ).toBe("true");
    (
      target.querySelector(
        '[data-testid="chapter-narration-use"]',
      ) as HTMLButtonElement
    ).click();
    await tick();
    expect(
      target.querySelector<HTMLInputElement>(
        ".story-wide-narration__track input",
      )?.disabled,
    ).toBe(false);
    expect(
      target.querySelector('.story-wide-modal__panel')?.getAttribute('role'),
    ).toBe('dialog');
    expect(
      target.querySelector('.story-wide-modal__panel')?.getAttribute('aria-modal'),
    ).toBe('true');

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
    expect(target.querySelector('.story-wide-modal__panel')).toBeTruthy();
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
    const videoPreview = target.querySelector<HTMLVideoElement>(
      '[data-testid="chapter-media-video-preview"]',
    );
    expect(videoPreview).toBeTruthy();
    expect(videoPreview?.getAttribute('src')).toBe(
      'https://example.org/source.mp4',
    );
    expect(target.querySelector('.story-wide-modal--video')).toBeTruthy();
    const playVideo = vi.fn().mockResolvedValue(undefined);
    const pauseVideo = vi.fn();
    Object.defineProperty(videoPreview!, 'play', { value: playVideo });
    Object.defineProperty(videoPreview!, 'pause', { value: pauseVideo });
    videoPreview!.currentTime = 12;
    videoPreview!.dispatchEvent(new Event('timeupdate'));
    (
      target.querySelectorAll<HTMLButtonElement>('.story-wide-media__current')[0]
    ).click();
    await tick();
    expect(onAssignMediaSegment).toHaveBeenLastCalledWith(12, 25);
    const stagePreviewCalls = onPreviewMediaSegment.mock.calls.length;
    const stopStageCalls = onStopPreviewMediaSegment.mock.calls.length;
    const previewVideo = Array.from(target.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Preview segment'),
    ) as HTMLButtonElement;
    previewVideo.click();
    await tick();
    expect(playVideo).toHaveBeenCalledOnce();
    expect(onPreviewMediaSegment).toHaveBeenCalledTimes(stagePreviewCalls);
    expect(onStopPreviewMediaSegment.mock.calls.length).toBeGreaterThan(
      stopStageCalls,
    );
    expect(target.querySelector(".story-wide-media__track")).toBeNull();
    expect(target.querySelector(".story-wide-media__sliders")).toBeNull();

    activeTask.set("focus");
    await tick();
    expect(target.querySelector(".story-wide-authoring--annotations")).toBeTruthy();
    expect(target.querySelector('[data-testid="story-wide-done"]')).toBeTruthy();
    expect(target.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(target.querySelector(".story-wide-authoring__annotation-intro")?.textContent)
      .toContain("Add annotation");
    expect(target.querySelectorAll(".story-wide-authoring__annotation-tool")).toHaveLength(6);
    (
      [...target.querySelectorAll<HTMLButtonElement>(
        ".story-wide-authoring__annotation-tools button",
      )].find((button) => button.textContent?.trim() === "Rectangle")!
    ).click();
    expect(onSetAnnotationTool).toHaveBeenCalledWith("rectangle");
    await tick();
    expect(target.querySelector(".story-wide-authoring--annotations")).toBeNull();
    expect(
      target.querySelector(".story-wide-authoring--annotation-placing"),
    ).toBeTruthy();
    // The viewer returns to Select after committing the new shape.
    annotationTool.set("select");
    await tick();
    (
      target.querySelector(".story-wide-annotations__select") as HTMLButtonElement
    ).click();
    await tick();
    expect(onEditAnnotation).toHaveBeenCalledWith("rectangle-one");
    expect(target.querySelector("#annotation-options-panel")).toBeTruthy();
    expect(
      target.querySelector(".story-wide-authoring__annotation-context")
        ?.textContent,
    ).toContain("Edit annotation");
    expect(
      target.querySelector(".story-wide-authoring__annotation-context")
        ?.textContent,
    ).toContain("Rectangle");
    const appearance = target.querySelector(".annotation-options__appearance")!;
    expect(
      appearance.querySelectorAll(".annotation-options__field--nested"),
    ).toHaveLength(2);
    expect(appearance.textContent).toContain("Background");
    expect(appearance.textContent).toContain("Stroke");
    (
      target.querySelector('[data-testid="drawing-language-cy"]') as HTMLButtonElement
    ).click();
    await tick();
    const translation = target.querySelector<HTMLTextAreaElement>(
      ".annotation-options__translation textarea",
    )!;
    expect(translation.rows).toBe(2);
    translation.value = "Nodyn";
    translation.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onSetAnnotationLabel).toHaveBeenCalledWith(
      "rectangle-one",
      "cy",
      "Nodyn",
    );
    const solid = [...target.querySelectorAll<HTMLButtonElement>(
      ".annotation-options__segments button",
    )].find((button) => button.textContent?.trim() === "Solid")!;
    solid.click();
    expect(onSetAnnotationStyle).toHaveBeenCalledWith("rectangle-one", {
      fillMode: "solid",
    });
    (
      target.querySelector('[data-testid="annotation-edit-done"]') as HTMLButtonElement
    ).click();
    await tick();
    expect(onFinishAnnotationEdit).toHaveBeenCalledOnce();
    expect(target.querySelector("#annotation-list-panel")).toBeTruthy();
    expect(target.querySelector("#annotation-options-panel")).toBeNull();

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
