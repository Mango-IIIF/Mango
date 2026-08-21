import { describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { createEventBus } from "../../core/events/eventBus";
import type { PluginContext } from "../../core/types/plugin";
import {
  collectLatestNarrationSegments,
  createStoryBuilderController,
} from "../storyBuilderController";
import { DEFAULT_PRESENTATION_ASPECT } from "../framing";

describe("story builder narration defaults", () => {
  it("opens settings for a new story and toggles it from the top-bar action", () => {
    const controller = createStoryBuilderController({
      initialStory: { chapters: [] },
    });

    expect(get(controller.uiMode)).toBe("narrationPanel");
    controller.openNarration();
    expect(get(controller.uiMode)).toBe("idle");
    controller.openNarration();
    expect(get(controller.uiMode)).toBe("narrationPanel");
  });

  it("loads a first source and captures the viewer's active canvas in one action", async () => {
    vi.useFakeTimers();
    const manifest = "https://example.org/manifest.json";
    let ready = false;
    const controller = createStoryBuilderController({
      initialStory: { chapters: [] },
    });
    const events = createEventBus();
    const viewer = {
      getManifestId: () => (ready ? manifest : null),
      getState: () => null,
      getViewBox: () => (ready ? { x: 0, y: 0, w: 100, h: 80 } : null),
      getContentSize: () => ({ width: 100, height: 80 }),
      getCanvasIndex: () => 2,
      getCanvasCount: () => (ready ? 3 : 0),
      getCanvasId: () => (ready ? "canvas-3" : null),
      getMediaType: () => "image",
      getMediaSources: () => [],
      getLayerOpacities: () => ({}),
      setManifest: vi.fn(() => {
        setTimeout(() => {
          ready = true;
        }, 150);
      }),
    };
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);

    controller.loadManifestAndAddChapter(manifest);
    expect(get(controller.story).chapters).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(500);

    expect(get(controller.story).chapters).toHaveLength(1);
    expect(get(controller.story).chapters[0]).toMatchObject({
      manifest,
      canvasIndex: 2,
      canvasId: "canvas-3",
    });
    expect(get(controller.story).presentationAspect).toBe(
      DEFAULT_PRESENTATION_ASPECT,
    );
    const viewBox = get(controller.story).chapters[0].viewBox!;
    expect(viewBox.w / viewBox.h).toBeCloseTo(DEFAULT_PRESENTATION_ASPECT, 6);

    detach();
    vi.useRealTimers();
  });

  it("saves through a host persistence handler without requiring an HTTP endpoint", async () => {
    const handler = vi.fn().mockResolvedValue({
      ok: true,
      message: "Stored locally",
    });
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          {
            id: "chapter-1",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 0,
            viewBox: { x: 0, y: 0, w: 100, h: 100 },
          },
        ],
      },
    });
    controller.setSaveConfig({ handler });

    expect(get(controller.saveConfigured)).toBe(true);
    await expect(controller.saveStory()).resolves.toEqual({
      ok: true,
      message: "Stored locally",
    });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toMatchObject({
      type: "AnnotationPage",
      items: expect.any(Array),
    });
    expect(get(controller.saveState)).toEqual({
      status: "success",
      message: "Stored locally",
    });
  });

  it("reports host persistence failures through the existing save state", async () => {
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          {
            id: "chapter-1",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 0,
            viewBox: { x: 0, y: 0, w: 100, h: 100 },
          },
        ],
      },
    });
    controller.setSaveConfig({
      handler: async () => {
        throw new Error("IndexedDB unavailable");
      },
    });

    await expect(controller.saveStory()).resolves.toEqual({
      ok: false,
      message: "IndexedDB unavailable",
      code: "handler",
    });
    expect(get(controller.saveState)).toEqual({
      status: "error",
      message: "IndexedDB unavailable",
      code: "handler",
    });
  });

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

    // Dragging the point's frame on the stage lands here; its focus follows.
    controller.setMotionPointViewBox("one", { x: 10, y: 15, w: 100, h: 100 });
    expect(
      get(controller.story).chapters[0].cameraTrack?.keyframes[0],
    ).toMatchObject({
      id: "one",
      dwellMs: 1000,
      focus: { x: 60, y: 65 },
      viewBox: { x: 10, y: 15, w: 100, h: 100 },
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
    // The point's frame is dragged, same size, to a new centre.
    controller.setMotionPointViewBox("ken-burns-end", { x: 450, y: 75, w: 700, h: 350 });

    const track = get(controller.story).chapters[0].cameraTrack;
    expect(track?.preset).toBe("ken-burns");
    expect(track?.keyframes[0].viewBox?.w).toBe(1000);
    expect(track?.keyframes[1].viewBox?.w).toBe(700);
    expect(track?.keyframes[1].focus).toEqual({ x: 800, y: 250 });
  });

  it("hands zoom to the author when a styled point's frame is resized", () => {
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
    // A named style sizes its own points; resizing one is a decision about
    // zoom the style cannot honour, so the track becomes custom and keeps it.
    controller.setMotionPointViewBox("ken-burns-end", { x: 400, y: 150, w: 400, h: 200 });

    const track = get(controller.story).chapters[0].cameraTrack;
    expect(track?.preset).toBe("custom");
    expect(track?.keyframes[1].viewBox).toEqual({ x: 400, y: 150, w: 400, h: 200 });
    expect(track?.keyframes[1].focus).toEqual({ x: 600, y: 250 });
    // The other point is left exactly as it was.
    expect(track?.keyframes[0].viewBox).toEqual({ x: 0, y: 0, w: 1000, h: 500 });
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

    expect(get(controller.chapterAnnotationTool)).toBe("select");
    expect(viewer.setAnnotationTool).toHaveBeenLastCalledWith("select");
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
          text: "Edited rectangle",
          styleHints: expect.objectContaining({ strokeColor: "#39b57e" }),
          document: expect.objectContaining({ motivation: ["commenting"] }),
        }),
      ]),
    );
    expect(viewer.setStoryAnnotations).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rectangle-1",
          styleHints: expect.objectContaining({ strokeWidth: 4 }),
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

    controller.finishChapterDrawingAnnotationEdit();
    expect(get(controller.activeChapterTask)).toBe("focus");
    expect(get(controller.selectedDrawingAnnotationId)).toBeNull();
    expect(viewer.setStoryAnnotationSelection).toHaveBeenLastCalledWith(null);

    controller.editChapterDrawingAnnotation("rectangle-1");
    controller.saveChapterSettings();
    expect(get(controller.activeChapterTask)).toBeNull();
    expect(get(controller.selectedDrawingAnnotationId)).toBeNull();
    expect(viewer.setStoryAnnotationSelection).toHaveBeenLastCalledWith(null);

    // The closed inspector list is a direct route to existing content. It
    // opens the annotation workspace and selects the row in one action.
    controller.editChapterDrawingAnnotation("rectangle-1");
    expect(get(controller.activeChapterTask)).toBe("focus");
    expect(get(controller.selectedDrawingAnnotationId)).toBe("rectangle-1");
    controller.saveChapterSettings();

    controller.updateLayerOpacity("painting-layer", 0.35);
    expect(viewer.updateLayerOpacity).toHaveBeenCalledWith(
      "painting-layer",
      0.35,
    );
    expect(get(controller.story).chapters[0].layerOpacities).toEqual({
      "painting-layer": 0.35,
    });

    // A region typed into the frame readout that does not match the story's
    // shape is still brought to it.
    controller.setChapterPosition({ x: 12, y: 18, w: 60, h: 55 });
    const stored = get(controller.story).chapters[0];
    expect(stored).toMatchObject({
      manifest: "https://example.org/manifest.json",
      canvasIndex: 0,
      layerOpacities: { "painting-layer": 0.35 },
    });
    // Stored at the story's canonical aspect (1:1 here, from the chapter's
    // existing framing) keeping the centre and the amount of image covered.
    expect(stored.viewBox!.w / stored.viewBox!.h).toBeCloseTo(1, 6);
    expect(stored.viewBox!.w * stored.viewBox!.h).toBeCloseTo(60 * 55, 4);
    expect(stored.viewBox!.x + stored.viewBox!.w / 2).toBeCloseTo(12 + 30, 6);
    expect(stored.viewBox!.y + stored.viewBox!.h / 2).toBeCloseTo(18 + 27.5, 6);
    detach();
  });

  it("cancels a story annotation transaction without leaving partial text edits", () => {
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          {
            id: "chapter-1",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 0,
            drawingAnnotations: [
              {
                id: "drawing-1",
                type: "rectangle",
                rect: { x: 10, y: 20, w: 30, h: 40 },
                label: { en: "Original" },
              },
            ],
          },
        ],
      },
    });
    controller.selectedChapterId.set("chapter-1");
    controller.activeChapterTask.set("focus");

    controller.setChapterDrawingAnnotationLabel("drawing-1", "en", "E");
    controller.setChapterDrawingAnnotationLabel("drawing-1", "en", "Edited");
    expect(
      get(controller.story).chapters[0].drawingAnnotations?.[0].label?.en,
    ).toBe("Edited");

    controller.cancelChapterSettings();

    expect(
      get(controller.story).chapters[0].drawingAnnotations?.[0].label?.en,
    ).toBe("Original");
    expect(get(controller.activeChapterTask)).toBeNull();
  });

  it("commits a story annotation typing sequence as one undo step", () => {
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          {
            id: "chapter-1",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 0,
            drawingAnnotations: [
              {
                id: "drawing-1",
                type: "rectangle",
                rect: { x: 10, y: 20, w: 30, h: 40 },
                label: { en: "Original" },
              },
            ],
          },
        ],
      },
    });
    controller.selectedChapterId.set("chapter-1");
    controller.activeChapterTask.set("focus");
    controller.setChapterDrawingAnnotationLabel("drawing-1", "en", "E");
    controller.setChapterDrawingAnnotationLabel("drawing-1", "en", "Edited");

    controller.saveChapterSettings();
    expect(get(controller.canUndo)).toBe(true);
    controller.undo();

    expect(
      get(controller.story).chapters[0].drawingAnnotations?.[0].label?.en,
    ).toBe("Original");
    expect(get(controller.canUndo)).toBe(false);
  });

  it("keeps a new story's frame independent of its source canvas", () => {
    const controller = createStoryBuilderController({
      initialStory: { chapters: [] },
    });
    const events = createEventBus();
    const viewer = {
      getManifestId: () => "https://example.org/manifest.json",
      getState: () => null,
      // A stage caught mid-layout: tall and narrow, nothing like the image.
      getViewBox: vi.fn(() => ({ x: 0, y: 0, w: 300, h: 900 })),
      getContentSize: vi.fn(() => ({ width: 9310, height: 6237 })),
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

    controller.addChapter();
    const framing = get(controller.story).chapters[0].viewBox!;
    expect(framing.w / framing.h).toBeCloseTo(DEFAULT_PRESENTATION_ASPECT, 6);
    expect(get(controller.story).presentationAspect).toBe(
      DEFAULT_PRESENTATION_ASPECT,
    );

    detach();
  });

  it("keeps the default frame when content size is unavailable and conforms later captures", () => {
    const controller = createStoryBuilderController({
      initialStory: { chapters: [] },
    });
    const events = createEventBus();
    const viewer = {
      getManifestId: () => "https://example.org/manifest.json",
      getState: () => null,
      // The editor stage is 1.7 wide when the first chapter is captured.
      getViewBox: vi.fn(() => ({ x: 0, y: 0, w: 1700, h: 1000 })),
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

    controller.addChapter();
    const first = get(controller.story).chapters[0].viewBox!;
    // Neither a transient viewport nor missing source dimensions may redefine
    // the frame that was already shown for this new story.
    expect(first.w / first.h).toBeCloseTo(DEFAULT_PRESENTATION_ASPECT, 6);
    expect(get(controller.story).presentationAspect).toBe(
      DEFAULT_PRESENTATION_ASPECT,
    );

    // The stage is now a different shape — a panel opened, or the window was
    // resized. The second chapter must still be stored at the story's shape.
    viewer.getViewBox.mockReturnValue({ x: 0, y: 0, w: 1288, h: 1000 });
    controller.addChapter();
    const second = get(controller.story).chapters[1].viewBox!;
    expect(second.w / second.h).toBeCloseTo(DEFAULT_PRESENTATION_ASPECT, 6);
    // ...while still covering what the author had on screen.
    expect(second.w * second.h).toBeCloseTo(1288 * 1000, 2);

    detach();
  });

  it("sets an explicit chapter position and keeps preset motion in sync", () => {
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          {
            id: "manual-position",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 0,
            viewBox: { x: 0, y: 0, w: 1000, h: 500 },
            cameraTrack: {
              durationMs: 5000,
              preset: "zoom-in",
              keyframes: [
                {
                  id: "zoom-in-start",
                  timeMs: 0,
                  focus: { x: 500, y: 250 },
                  viewBox: { x: 0, y: 0, w: 1000, h: 500 },
                },
                {
                  id: "zoom-in-end",
                  timeMs: 5000,
                  focus: { x: 500, y: 250 },
                  viewBox: { x: 280, y: 140, w: 440, h: 220 },
                },
              ],
            },
          },
        ],
      },
    });
    controller.selectedChapterId.set("manual-position");

    controller.setChapterPosition({ x: 40, y: 60, w: 800, h: 400 });

    const chapter = get(controller.story).chapters[0];
    expect(chapter.viewBox).toEqual({ x: 40, y: 60, w: 800, h: 400 });
    expect(chapter.cameraTrack?.preset).toBe("zoom-in");
    expect(chapter.cameraTrack?.keyframes[0].viewBox).toEqual({
      x: 100,
      y: 50,
      w: 800,
      h: 400,
    });

    controller.setChapterPosition({ x: 0, y: 0, w: 0, h: 400 });
    controller.setChapterPosition({ x: Number.NaN, y: 0, w: 100, h: 100 });
    expect(get(controller.story).chapters[0].viewBox).toEqual({
      x: 40,
      y: 60,
      w: 800,
      h: 400,
    });
  });

  it("restarts chapter playback when the same chapter is previewed twice", async () => {
    vi.useFakeTimers();
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          {
            id: "replayed",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 0,
            media: { start: 0, end: 3 },
            advance: { mode: "auto", delayMs: 0 },
          },
        ],
      },
    });
    const events = createEventBus();
    const viewer = {
      getManifestId: () => "https://example.org/manifest.json",
      getState: () => null,
      getViewBox: () => null,
      getCanvasIndex: () => 0,
      getCanvasCount: () => 1,
      getCanvasId: () => "canvas-1",
      getMediaType: () => "audio",
      getMediaSources: () => [],
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

    controller.selectChapter("replayed");
    viewer.play.mockClear();

    controller.previewChapter("replayed");
    await vi.advanceTimersByTimeAsync(4000);
    expect(viewer.play).toHaveBeenCalled();

    // The first preview has finished on its own by now. Previewing the very
    // same chapter again has to play it again rather than fall through the
    // "this chapter is already playing" guard.
    viewer.play.mockClear();
    controller.previewChapter("replayed");
    await vi.advanceTimersByTimeAsync(4000);
    expect(viewer.play).toHaveBeenCalled();

    detach();
    vi.useRealTimers();
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

describe("story builder source task", () => {
  const createSourceViewer = () => {
    const canvases = [
      { id: "https://example.org/canvas/1", viewBox: { x: 0, y: 0, w: 80, h: 80 } },
      { id: "https://example.org/canvas/2", viewBox: { x: 5, y: 5, w: 40, h: 40 } },
    ];
    let index = 0;
    return {
      canvases,
      getManifestId: () => "https://example.org/manifest.json",
      getState: () => null,
      getViewBox: vi.fn(() => ({ ...canvases[index].viewBox })),
      getCanvasIndex: () => index,
      getCanvasCount: () => canvases.length,
      getCanvasId: () => canvases[index].id,
      getMediaType: () => "image",
      getMediaSources: () => [],
      getLayerOpacities: () => ({}),
      setStoryAnnotations: vi.fn(),
      setStoryAnnotationEditing: vi.fn(),
      setStoryAnnotationSelection: vi.fn(),
      setAnnotationTool: vi.fn(),
      setCanvasByIndex: vi.fn((next: number) => {
        index = next;
      }),
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
  };

  const attachSourceController = (viewer: ReturnType<typeof createSourceViewer>) => {
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          {
            id: "chapter-1",
            manifest: "https://example.org/manifest.json",
            canvasIndex: 0,
            canvasId: "https://example.org/canvas/1",
            viewBox: { x: 0, y: 0, w: 80, h: 80 },
          },
        ],
      },
    });
    const detach = controller.attach({
      mount: document.createElement("div"),
      events: createEventBus(),
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectChapter("chapter-1");
    controller.activeChapterTask.set("source");
    return { controller, detach };
  };

  it("stores the chosen canvas without requiring a second source action", async () => {
    vi.useFakeTimers();
    const viewer = createSourceViewer();
    const { controller, detach } = attachSourceController(viewer);

    controller.selectCanvas(1);
    await vi.advanceTimersByTimeAsync(100);

    const chapter = get(controller.story).chapters[0];
    expect(chapter.canvasIndex).toBe(1);
    expect(chapter.canvasId).toBe("https://example.org/canvas/2");
    // The old framing belonged to the previous canvas, so it is re-read too.
    expect(chapter.viewBox).toMatchObject({ x: 5, y: 5 });
    detach();
    vi.useRealTimers();
  });

  it("leaves a chapter untouched when the source task is saved on the same canvas", () => {
    const viewer = createSourceViewer();
    const { controller, detach } = attachSourceController(viewer);
    const before = get(controller.story).chapters[0];

    controller.saveChapterSettings();

    expect(get(controller.story).chapters[0]).toEqual(before);
    detach();
  });
});

describe("story builder stage crossfade", () => {
  const createFadeViewer = () => {
    let canvasIndex = 0;
    let viewBox = { x: 0, y: 0, w: 100, h: 100 };
    const viewer = {
      getManifestId: () => "https://example.org/manifest.json",
      getState: () => null,
      getViewBox: vi.fn(() => viewBox),
      getCanvasIndex: () => canvasIndex,
      getCanvasCount: () => 2,
      getCanvasId: () => `https://example.org/canvas/${canvasIndex}`,
      getMediaType: () => "image",
      getMediaSources: () => [],
      getLayerOpacities: () => ({}),
      setStoryAnnotations: vi.fn(),
      setStoryAnnotationEditing: vi.fn(),
      setStoryAnnotationSelection: vi.fn(),
      setAnnotationTool: vi.fn(),
      setCanvasByIndex: vi.fn((next: number) => {
        canvasIndex = next;
      }),
      setCanvasById: vi.fn(),
      setManifest: vi.fn(),
      setViewBox: vi.fn((next: typeof viewBox) => {
        viewBox = next;
      }),
      updateLayerOpacity: vi.fn(),
      setModelOrbit: vi.fn(),
      setModelTarget: vi.fn(),
      setModelOrientation: vi.fn(),
      addAnnotation: vi.fn(),
      removeAnnotation: vi.fn(),
      pause: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
    return viewer;
  };

  const twoCanvasStory = {
    chapters: [
      {
        id: "chapter-1",
        manifest: "https://example.org/manifest.json",
        canvasIndex: 0,
        canvasId: "https://example.org/canvas/0",
        viewBox: { x: 0, y: 0, w: 100, h: 100 },
      },
      {
        id: "chapter-2",
        manifest: "https://example.org/manifest.json",
        canvasIndex: 1,
        canvasId: "https://example.org/canvas/1",
        viewBox: { x: 10, y: 10, w: 40, h: 40 },
      },
    ],
  };

  it("hides the stage before the canvas swap and reveals it once framed", () => {
    vi.useFakeTimers();
    const controller = createStoryBuilderController({ initialStory: twoCanvasStory });
    const viewer = createFadeViewer();
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);

    const fades: { opacity: number; durationMs: number }[] = [];
    const unsubscribe = controller.stageFade.subscribe((value) => {
      fades.push({ ...value });
    });

    controller.selectChapter("chapter-2");

    // The stage goes down first and nothing has moved yet.
    expect(fades[fades.length - 1].opacity).toBe(0);
    expect(viewer.setCanvasByIndex).not.toHaveBeenCalled();

    // The swap lands once the stage is hidden.
    vi.advanceTimersByTime(300);
    expect(viewer.setCanvasByIndex).toHaveBeenCalledWith(1);
    expect(fades[fades.length - 1].opacity).toBe(0);

    // The viewer reports the page change, which resumes the apply.
    events.emit("pageChange", { canvasId: "https://example.org/canvas/1", index: 1 });
    vi.advanceTimersByTime(300);

    expect(viewer.setViewBox).toHaveBeenCalledWith({ x: 10, y: 10, w: 40, h: 40 });
    expect(fades[fades.length - 1].opacity).toBe(1);

    unsubscribe();
    detach();
    vi.useRealTimers();
  });

  it("leaves the stage alone when the chapter stays on the same canvas", () => {
    vi.useFakeTimers();
    const controller = createStoryBuilderController({
      initialStory: {
        chapters: [
          twoCanvasStory.chapters[0],
          { ...twoCanvasStory.chapters[1], canvasIndex: 0, canvasId: "https://example.org/canvas/0" },
        ],
      },
    });
    const viewer = createFadeViewer();
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);

    const opacities: number[] = [];
    const unsubscribe = controller.stageFade.subscribe((value) => {
      opacities.push(value.opacity);
    });

    controller.selectChapter("chapter-2");
    vi.advanceTimersByTime(600);

    expect(opacities.every((opacity) => opacity === 1)).toBe(true);
    expect(viewer.setCanvasByIndex).not.toHaveBeenCalled();

    unsubscribe();
    detach();
    vi.useRealTimers();
  });

  it("drops a swap that a newer chapter has superseded", () => {
    vi.useFakeTimers();
    const controller = createStoryBuilderController({ initialStory: twoCanvasStory });
    const viewer = createFadeViewer();
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);

    // Move to canvas 2, then change our mind before the fade has finished.
    controller.selectChapter("chapter-2");
    vi.advanceTimersByTime(100);
    controller.selectChapter("chapter-1");
    vi.advanceTimersByTime(1000);

    // The abandoned swap must not land after the chapter that replaced it.
    const targets = viewer.setCanvasByIndex.mock.calls.map(([index]: [number]) => index);
    expect(targets).not.toContain(1);

    detach();
    vi.useRealTimers();
  });

  it("never leaves the stage hidden when a source never arrives", () => {
    vi.useFakeTimers();
    const controller = createStoryBuilderController({ initialStory: twoCanvasStory });
    const viewer = createFadeViewer();
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);

    let opacity = 1;
    const unsubscribe = controller.stageFade.subscribe((value) => {
      opacity = value.opacity;
    });

    controller.selectChapter("chapter-2");
    expect(opacity).toBe(0);

    // No pageChange ever arrives; the deadline releases the stage.
    vi.advanceTimersByTime(6000);
    expect(opacity).toBe(1);

    unsubscribe();
    detach();
    vi.useRealTimers();
  });
});

describe("story builder chapter frame", () => {
  const frameStory = {
    presentationAspect: 2,
    chapters: [
      {
        id: "chapter-1",
        manifest: "https://example.org/manifest.json",
        canvasIndex: 0,
        viewBox: { x: 100, y: 100, w: 800, h: 400 },
        cameraTrack: {
          durationMs: 4000,
          preset: "custom" as const,
          keyframes: [
            {
              id: "kf-1",
              timeMs: 0,
              focus: { x: 500, y: 300 },
              viewBox: { x: 300, y: 200, w: 400, h: 200 },
            },
          ],
        },
      },
    ],
  };

  const createFrameViewer = (viewBox = { x: 0, y: 0, w: 1200, h: 900 }) => ({
    getManifestId: () => "https://example.org/manifest.json",
    getState: () => null,
    getViewBox: vi.fn(() => viewBox),
    getContentSize: vi.fn(() => ({ width: 2000, height: 1000 })),
    getCanvasIndex: () => 0,
    getCanvasCount: () => 1,
    getCanvasId: () => "canvas-1",
    getMediaType: () => "image",
    getMediaSources: () => [],
    getLayerOpacities: () => ({}),
    setStoryAnnotations: vi.fn(),
    setStoryAnnotationEditing: vi.fn(),
    setStoryAnnotationSelection: vi.fn(),
    setStoryPresentationAspect: vi.fn(),
    setStoryFrames: vi.fn(),
    setStoryFrameSelection: vi.fn(),
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
  });

  const lastFrames = (viewer: ReturnType<typeof createFrameViewer>) =>
    viewer.setStoryFrames.mock.calls.at(-1)?.[0] ?? [];
  const lastSelection = (viewer: ReturnType<typeof createFrameViewer>) =>
    viewer.setStoryFrameSelection.mock.calls.at(-1)?.[0];

  it("uses the fixed stage as the chapter frame instead of drawing a second rectangle", () => {
    const controller = createStoryBuilderController({ initialStory: frameStory });
    const viewer = createFrameViewer();
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);

    controller.selectedChapterId.set("chapter-1");

    expect(lastFrames(viewer)).toEqual([]);
    expect(viewer.setStoryPresentationAspect).toHaveBeenLastCalledWith(2);
    expect(lastSelection(viewer)).toBeNull();

    controller.activeChapterTask.set("position");
    expect(lastFrames(viewer)).toEqual([]);
    // The sentinel only focuses the builder chrome; there is no matching SVG
    // frame for it to render or drag.
    expect(lastSelection(viewer)).toBe("chapter");
    detach();
  });

  it("keeps motion points out of the rectangular frame layer", () => {
    const controller = createStoryBuilderController({ initialStory: frameStory });
    const viewer = createFrameViewer();
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectedChapterId.set("chapter-1");

    controller.activeChapterTask.set("focus");
    expect(lastFrames(viewer)).toEqual([]);
    expect(lastSelection(viewer)).toBeNull();

    controller.activeChapterTask.set("motion");
    expect(lastFrames(viewer)).toEqual([]);
    expect(lastSelection(viewer)).toBeNull();

    controller.goToMotionPoint("kf-1");
    expect(get(controller.selectedMotionPointId)).toBe("kf-1");
    expect(lastFrames(viewer)).toEqual([]);
    expect(lastSelection(viewer)).toBeNull();

    controller.activeChapterTask.set(null);
    expect(lastFrames(viewer)).toEqual([]);
    expect(lastSelection(viewer)).toBeNull();
    detach();
  });

  it("keeps the camera in place when Frame opens and captures the fixed-stage view on Done", () => {
    const controller = createStoryBuilderController({ initialStory: frameStory });
    const viewer = createFrameViewer({ x: 400, y: 300, w: 600, h: 300 });
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectedChapterId.set("chapter-1");
    viewer.setViewBox.mockClear();

    controller.activeChapterTask.set("position");
    expect(viewer.setViewBox).not.toHaveBeenCalled();
    controller.saveChapterSettings();
    expect(get(controller.story).chapters[0].viewBox).toEqual({
      x: 400,
      y: 300,
      w: 600,
      h: 300,
    });
    detach();
  });

  it("does not introduce rectangular motion frames around preview", () => {
    const controller = createStoryBuilderController({ initialStory: frameStory });
    const viewer = createFrameViewer();
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectedChapterId.set("chapter-1");
    controller.activeChapterTask.set("motion");
    expect(lastFrames(viewer)).toEqual([]);

    controller.startPreview();
    expect(lastFrames(viewer)).toEqual([]);
    controller.stopPreview();
    expect(lastFrames(viewer)).toEqual([]);
    detach();
  });

  it("starts a motion preview at the first pin's exact captured frame", () => {
    const start = { x: 320, y: 180, w: 480, h: 240 };
    const controller = createStoryBuilderController({
      initialStory: {
        ...frameStory,
        chapters: [
          {
            ...frameStory.chapters[0],
            cameraTrack: {
              durationMs: 4000,
              preset: "custom" as const,
              keyframes: [
                { id: "start", timeMs: 0, viewBox: start },
                {
                  id: "end",
                  timeMs: 4000,
                  viewBox: { x: 900, y: 350, w: 240, h: 120 },
                },
              ],
            },
          },
        ],
      },
    });
    const viewer = createFrameViewer();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events: createEventBus(),
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectedChapterId.set("chapter-1");
    const previousRaf = globalThis.requestAnimationFrame;
    const previousCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = vi.fn(() => 1);
    globalThis.cancelAnimationFrame = vi.fn();

    controller.previewMotion();

    expect(viewer.setViewBox).toHaveBeenLastCalledWith(start);
    expect(get(controller.motionPreviewing)).toBe(true);
    controller.stopMotionPreview();
    expect(get(controller.motionPreviewing)).toBe(false);
    if (previousRaf) globalThis.requestAnimationFrame = previousRaf;
    else delete (globalThis as Partial<typeof globalThis>).requestAnimationFrame;
    if (previousCancelRaf) globalThis.cancelAnimationFrame = previousCancelRaf;
    else delete (globalThis as Partial<typeof globalThis>).cancelAnimationFrame;
    detach();
  });

  it("accepts a legacy chapter-frame commit without restoring the removed overlay", () => {
    const controller = createStoryBuilderController({ initialStory: frameStory });
    const viewer = createFrameViewer();
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectedChapterId.set("chapter-1");
    viewer.setViewBox.mockClear();

    events.emit("storyFrameChange", {
      frameId: "chapter",
      viewBox: { x: 400, y: 300, w: 600, h: 300 },
    });

    expect(get(controller.story).chapters[0].viewBox).toEqual({
      x: 400,
      y: 300,
      w: 600,
      h: 300,
    });
    expect(viewer.setViewBox).not.toHaveBeenCalled();
    expect(lastFrames(viewer)).toEqual([]);
    detach();
  });

  it("commits a dragged keyframe frame to that keyframe", () => {
    const controller = createStoryBuilderController({ initialStory: frameStory });
    const viewer = createFrameViewer();
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectedChapterId.set("chapter-1");
    controller.activeChapterTask.set("motion");

    events.emit("storyFrameChange", {
      frameId: "keyframe:kf-1",
      viewBox: { x: 1000, y: 500, w: 500, h: 250 },
    });

    const point = get(controller.story).chapters[0].cameraTrack?.keyframes[0];
    expect(point?.viewBox).toEqual({ x: 1000, y: 500, w: 500, h: 250 });
    expect(point?.focus).toEqual({ x: 1250, y: 625 });
    // The chapter's own frame is not touched by a keyframe edit.
    expect(get(controller.story).chapters[0].viewBox).toEqual({ x: 100, y: 100, w: 800, h: 400 });
    detach();
  });

  it("moves a motion pin without changing that point's zoom", () => {
    const controller = createStoryBuilderController({ initialStory: frameStory });
    const viewer = createFrameViewer();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events: createEventBus(),
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectedChapterId.set("chapter-1");

    controller.setMotionPointFocus("kf-1", { x: 1900, y: 500 });

    const point = get(controller.story).chapters[0].cameraTrack?.keyframes[0];
    // A focal pin may sit at the image edge. Applying the old rectangular
    // frame constraint here snapped it back inward and made dragging appear
    // not to update at all for wide camera frames.
    expect(point?.viewBox).toEqual({ x: 1700, y: 400, w: 400, h: 200 });
    expect(point?.focus).toEqual({ x: 1900, y: 500 });
    expect(get(controller.selectedMotionPointId)).toBe("kf-1");
    detach();
  });

  it("holds every stored frame to the presentation aspect, whatever was asked for", () => {
    const controller = createStoryBuilderController({ initialStory: frameStory });
    const viewer = createFrameViewer();
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectedChapterId.set("chapter-1");

    controller.setChapterPosition({ x: 200, y: 200, w: 300, h: 300 });
    const chapterBox = get(controller.story).chapters[0].viewBox!;
    expect(chapterBox.w / chapterBox.h).toBeCloseTo(2, 9);

    controller.setMotionPointViewBox("kf-1", { x: 200, y: 200, w: 300, h: 300 });
    const pointBox = get(controller.story).chapters[0].cameraTrack!.keyframes[0].viewBox!;
    expect(pointBox.w / pointBox.h).toBeCloseTo(2, 9);
    // ...and inside the canvas.
    expect(pointBox.x).toBeGreaterThanOrEqual(0);
    expect(pointBox.x + pointBox.w).toBeLessThanOrEqual(2000);
    detach();
  });

  it("starts a new camera point at the current viewport centre and stores its zoom", () => {
    const controller = createStoryBuilderController({ initialStory: frameStory });
    const viewer = createFrameViewer({ x: 800, y: 300, w: 600, h: 300 });
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectedChapterId.set("chapter-1");
    controller.activeChapterTask.set("motion");

    controller.addMotionPoint();

    const keyframes = get(controller.story).chapters[0].cameraTrack!.keyframes;
    expect(keyframes).toHaveLength(2);
    const added = keyframes[1];
    expect(added.viewBox).toEqual({ x: 800, y: 300, w: 600, h: 300 });
    expect(added.focus).toEqual({ x: 1100, y: 450 });
    expect(get(controller.selectedMotionPointId)).toBe(added.id);
    expect(lastSelection(viewer)).toBeNull();

    controller.deleteMotionPoint(added.id);
    expect(get(controller.selectedMotionPointId)).toBeNull();
    detach();
  });

  it("updates a selected pin from the current viewport and takes zoom control from a preset", () => {
    const controller = createStoryBuilderController({
      initialStory: {
        ...frameStory,
        chapters: frameStory.chapters.map((chapter) => ({
          ...chapter,
          cameraTrack: { ...chapter.cameraTrack, preset: "ken-burns" as const },
        })),
      },
    });
    const viewer = createFrameViewer({ x: 800, y: 300, w: 600, h: 300 });
    const detach = controller.attach({
      mount: document.createElement("div"),
      events: createEventBus(),
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectedChapterId.set("chapter-1");

    controller.updateMotionPointFromViewport("kf-1");

    const track = get(controller.story).chapters[0].cameraTrack;
    expect(track?.preset).toBe("custom");
    expect(track?.keyframes[0].viewBox).toEqual({ x: 800, y: 300, w: 600, h: 300 });
    expect(track?.keyframes[0].focus).toEqual({ x: 1100, y: 450 });
    expect(get(controller.selectedMotionPointId)).toBe("kf-1");
    detach();
  });

  it("reads the camera only when capturing a new chapter or motion point", () => {
    /*
     * The acceptance check for the frame being an object: with the viewport
     * parked on a sentinel box, nothing that edits a chapter or keyframe
     * framing may store that sentinel. New chapters and new motion points are
     * the two deliberate captures of what is currently on screen.
     */
    // Inside the canvas, so a capture of it survives the content constraint.
    const sentinel = { x: 1234, y: 321, w: 640, h: 480 };
    const controller = createStoryBuilderController({ initialStory: frameStory });
    const viewer = createFrameViewer(sentinel);
    const events = createEventBus();
    const detach = controller.attach({
      mount: document.createElement("div"),
      events,
      viewer,
      config: {},
    } as unknown as PluginContext);
    controller.selectedChapterId.set("chapter-1");

    const storedBoxes = () => {
      const chapters = get(controller.story).chapters;
      return chapters.flatMap((chapter) => [
        chapter.viewBox,
        ...(chapter.cameraTrack?.keyframes ?? []).map((point) => point.viewBox),
      ]);
    };
    const carriesSentinel = () =>
      storedBoxes().some(
        (box) =>
          box &&
          Math.abs(box.x + box.w / 2 - (sentinel.x + sentinel.w / 2)) < 1 &&
          Math.abs(box.y + box.h / 2 - (sentinel.y + sentinel.h / 2)) < 1,
      );

    controller.activeChapterTask.set("motion");
    controller.addMotionPoint();
    expect(carriesSentinel()).toBe(true);
    const addedPoint = get(controller.story).chapters[0].cameraTrack!.keyframes.at(-1)!;
    controller.deleteMotionPoint(addedPoint.id);
    expect(carriesSentinel()).toBe(false);

    controller.setMotionPointViewBox("kf-1", { x: 10, y: 10, w: 200, h: 100 });
    controller.applyMotionPreset("ken-burns");
    controller.updateMotionPathType("linear");
    controller.updateMotionInitialDwell(500);
    controller.applyMotionPreset("custom");
    controller.setChapterPosition({ x: 50, y: 50, w: 400, h: 200 });
    expect(carriesSentinel()).toBe(false);

    // A brand-new chapter also starts from the view.
    controller.addChapter();
    expect(carriesSentinel()).toBe(true);
    detach();
  });
});
