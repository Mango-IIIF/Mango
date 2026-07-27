import { describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { createEventBus } from "../../core/events/eventBus";
import type { PluginContext } from "../../core/types/plugin";
import {
  collectLatestNarrationSegments,
  createStoryBuilderController,
} from "../storyBuilderController";

describe("story builder narration defaults", () => {
  it("preserves motion settings when duration and camera points are edited", () => {
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          {
            id: "motion-chapter",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 0,
            viewBox: { x: 0, y: 0, w: 100, h: 100 },
            cameraTrack: {
              durationMs: 5000,
              preset: "custom",
              pathType: "spline",
              easing: "ease-out",
              keyframes: [
                {
                  id: "one",
                  timeMs: 0,
                  dwellMs: 1000,
                  focus: { x: 50, y: 50 },
                  viewBox: { x: 0, y: 0, w: 100, h: 100 },
                },
                {
                  id: "two",
                  timeMs: 5000,
                  focus: { x: 70, y: 70 },
                  viewBox: { x: 20, y: 20, w: 100, h: 100 },
                },
              ],
            },
          },
        ],
      },
    });
    controller.selectedChapterId.set("motion-chapter");

    controller.updateMotionDuration(8000);
    expect(get(controller.story).chapters[0].cameraTrack).toMatchObject({
      durationMs: 8000,
      pathType: "spline",
      easing: "ease-out",
    });

    controller.captureMotionPoint("one", { x: 60, y: 65 });
    expect(
      get(controller.story).chapters[0].cameraTrack?.keyframes[0],
    ).toMatchObject({
      id: "one",
      dwellMs: 1000,
      focus: { x: 60, y: 65 },
    });

    controller.updateMotionEasing("linear");
    controller.updateMotionPathType("linear");
    controller.updateMotionInitialDwell(1500);
    expect(get(controller.story).chapters[0].cameraTrack?.easing).toBe(
      "linear",
    );
    expect(get(controller.story).chapters[0].cameraTrack?.pathType).toBe(
      "linear",
    );
    expect(
      get(controller.story).chapters[0].cameraTrack?.keyframes[0].dwellMs,
    ).toBe(1500);
  });

  it("keeps named motion styles in control of zoom when a focal point moves", () => {
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          {
            id: "styled-motion",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 0,
            viewBox: { x: 0, y: 0, w: 1000, h: 500 },
            cameraTrack: {
              durationMs: 5000,
              preset: "ken-burns",
              pathType: "spline",
              keyframes: [
                {
                  id: "ken-burns-start",
                  timeMs: 0,
                  focus: { x: 500, y: 250 },
                  viewBox: { x: 0, y: 0, w: 1000, h: 500 },
                },
                {
                  id: "ken-burns-end",
                  timeMs: 5000,
                  focus: { x: 600, y: 250 },
                  viewBox: { x: 250, y: 75, w: 700, h: 350 },
                },
              ],
            },
          },
        ],
      },
    });
    controller.selectedChapterId.set("styled-motion");
    controller.captureMotionPoint("ken-burns-end", { x: 800, y: 250 });

    const track = get(controller.story).chapters[0].cameraTrack;
    expect(track?.preset).toBe("ken-burns");
    expect(track?.keyframes[0].viewBox?.w).toBe(1000);
    expect(track?.keyframes[1].viewBox?.w).toBe(700);
    expect(track?.keyframes[1].focus).toEqual({ x: 800, y: 250 });
  });

  it("keeps the latest valid range for each language", () => {
    expect(
      collectLatestNarrationSegments({
        chapters: [
          {
            id: "chapter-1",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 0,
            narrationSegment: {
              en: { start: 2, end: 5 },
              cy: { start: 10, end: 14 },
            },
          },
          {
            id: "chapter-2",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 1,
            narrationSegment: { en: { start: 6, end: 9 } },
          },
        ],
      }),
    ).toEqual({
      en: { start: 6, end: 9 },
      cy: { start: 10, end: 14 },
    });
  });

  it("persists drawing geometry even when the editor has already returned to select mode", () => {
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          {
            id: "chapter-1",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 0,
            viewBox: { x: 0, y: 0, w: 100, h: 100 },
            annotations: {
              en: {
                text: "Editable text",
                placement: { x: 20, y: 30, w: 25, h: 15 },
              },
            },
          },
        ],
      },
    });
    const events = createEventBus();
    const viewer = {
      getManifestId: () => "https://example.org/manifest.json",
      getState: () => null,
      getViewBox: vi.fn(() => ({ x: 0, y: 0, w: 100, h: 100 })),
      getCanvasIndex: () => 0,
      getCanvasCount: () => 1,
      getCanvasId: () => "canvas-1",
      getMediaType: () => "image",
      getMediaSources: () => [],
      getLayerOpacities: () => ({}),
      setStoryAnnotations: vi.fn(),
      setStoryAnnotationEditing: vi.fn(),
      setStoryAnnotationSelection: vi.fn(),
      setAnnotationTool: vi.fn(),
      setCanvasByIndex: vi.fn(),
      setCanvasById: vi.fn(),
      setManifest: vi.fn(),
      setViewBox: vi.fn(),
      updateLayerOpacity: vi.fn(),
      setModelOrbit: vi.fn(),
      setModelTarget: vi.fn(),
      setModelOrientation: vi.fn(),
      addAnnotation: vi.fn(),
      removeAnnotation: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);

    controller.selectChapter("chapter-1");
    controller.activeChapterTask.set("focus");
    controller.chapterAnnotationTool.set("select");
    events.emit("annotationCreate", {
      annotation: { id: "rectangle-1", rect: { x: 10, y: 20, w: 30, h: 40 } },
      tool: "rectangle",
    });

    expect(get(controller.story).chapters[0].annotations).toBeUndefined();
    expect(get(controller.story).chapters[0].drawingAnnotations).toEqual([
      expect.objectContaining({
        id: "chapter-1-annotation",
        type: "rectangle",
        label: { en: "Editable text" },
        fillMode: "solid",
      }),
      {
        id: "rectangle-1",
        type: "rectangle",
        rect: { x: 10, y: 20, w: 30, h: 40 },
      },
    ]);
    events.emit("annotationUpdate", {
      annotationId: "rectangle-1",
      patch: { rect: { x: 15, y: 25, w: 45, h: 50 } },
    });
    expect(
      get(controller.story).chapters[0].drawingAnnotations?.[1].rect,
    ).toEqual({
      x: 15,
      y: 25,
      w: 45,
      h: 50,
    });
    expect(viewer.setStoryAnnotations).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rectangle-1",
          rect: { x: 15, y: 25, w: 45, h: 50 },
        }),
      ]),
    );

    controller.setChapterDrawingAnnotationLabel(
      "rectangle-1",
      "en",
      "Edited rectangle",
    );
    controller.setChapterDrawingAnnotationStyle("rectangle-1", {
      color: "#39b57e",
      strokeWidth: "thick",
    });
    expect(viewer.setStoryAnnotations).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rectangle-1",
          label: "Edited rectangle",
          targetStyle: expect.stringContaining("stroke: #39b57e"),
        }),
      ]),
    );
    expect(viewer.setStoryAnnotations).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rectangle-1",
          targetStyle: expect.stringContaining("stroke-width: 4"),
        }),
      ]),
    );

    controller.editChapterDrawingAnnotation("rectangle-1");
    expect(viewer.setStoryAnnotationSelection).toHaveBeenLastCalledWith(
      "rectangle-1",
    );
    expect(viewer.setViewBox).not.toHaveBeenCalled();

    expect(get(controller.selectedDrawingAnnotationId)).toBe("rectangle-1");
    expect(get(controller.story).chapters[0].annotations).toBeUndefined();

    controller.saveChapterSettings();
    expect(get(controller.activeChapterTask)).toBe("focus");
    expect(get(controller.selectedDrawingAnnotationId)).toBeNull();
    expect(viewer.setStoryAnnotationSelection).toHaveBeenLastCalledWith(null);

    controller.updateLayerOpacity("painting-layer", 0.35);
    expect(viewer.updateLayerOpacity).toHaveBeenCalledWith(
      "painting-layer",
      0.35,
    );
    expect(get(controller.story).chapters[0].layerOpacities).toEqual({
      "painting-layer": 0.35,
    });

    viewer.getViewBox.mockReturnValue({ x: 12, y: 18, w: 60, h: 55 });
    controller.updateChapterPosition();
    expect(get(controller.story).chapters[0]).toMatchObject({
      manifest: "https://example.org/manifest.json",
      canvasIndex: 0,
      viewBox: { x: 12, y: 18, w: 60, h: 55 },
      layerOpacities: { "painting-layer": 0.35 },
    });
    detach();
  });

  it("captures the full source by default and edits source-media timing independently", () => {
    const controller = createStoryBuilderController({
      initialStory: { chapters: [] },
    });
    const events = createEventBus();
    const viewer = {
      getManifestId: () =>
        "https://iiif.io/api/cookbook/recipe/0002-mvm-audio/manifest.json",
      getState: () => null,
      getViewBox: () => null,
      getCanvasIndex: () => 0,
      getCanvasCount: () => 1,
      getCanvasId: () =>
        "https://iiif.io/api/cookbook/recipe/0002-mvm-audio/canvas/1",
      getMediaType: () => "audio",
      getMediaSources: () => [
        {
          type: "audio",
          id: "audio-source",
          src: "https://fixtures.iiif.io/audio/indiana/donizetti-elixir.mp4",
          duration: 1985.024,
        },
      ],
      getLayerOpacities: () => ({}),
      setMediaSegment: vi.fn(),
      seekTo: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      setStoryAnnotations: vi.fn(),
      setStoryAnnotationEditing: vi.fn(),
      setStoryAnnotationSelection: vi.fn(),
      setAnnotationTool: vi.fn(),
      setCanvasByIndex: vi.fn(),
      setCanvasById: vi.fn(),
      setManifest: vi.fn(),
      setViewBox: vi.fn(),
      setModelOrbit: vi.fn(),
      setModelTarget: vi.fn(),
      setModelOrientation: vi.fn(),
      addAnnotation: vi.fn(),
      removeAnnotation: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);

    controller.addChapter();
    expect(get(controller.story).chapters[0].media).toEqual({
      start: 0,
      end: 1985.024,
    });
    expect(get(controller.story).chapters[0].advance).toEqual({
      mode: "auto",
      delayMs: 2000,
    });

    controller.assignMediaSegment(12.5, 42);
    expect(get(controller.story).chapters[0].media).toEqual({
      start: 12.5,
      end: 42,
    });
    expect(viewer.setMediaSegment).toHaveBeenLastCalledWith(12.5, 42);
    expect(get(controller.story).chapters[0].narrationSegment).toBeUndefined();

    controller.previewMediaSegment();
    expect(viewer.seekTo).toHaveBeenLastCalledWith(12.5);
    expect(viewer.play).toHaveBeenCalledOnce();

    controller.stopPreviewMediaSegment();
    expect(viewer.pause).toHaveBeenCalledOnce();
    expect(viewer.seekTo).toHaveBeenLastCalledWith(12.5);

    controller.updateAdvanceMode("auto");
    controller.updateDelay(3500);
    controller.addChapter();
    expect(get(controller.story).chapters[1].advance).toEqual({
      mode: "auto",
      delayMs: 3500,
    });
    detach();
  });
});
