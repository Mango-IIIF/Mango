import { describe, it, expect, vi } from "vitest";
import { parseWebAnnotation, projectAnnotation } from "@mango-iiif/w3c-parser";
import chapter6Fixture from "./fixtures/chapter-6-multilingual-story.json";

/** The shape a serialized story overlay projects to, read back through the parser. */
const shapeOf = (annotation: unknown) =>
  projectAnnotation(parseWebAnnotation(annotation).document).targets[0].shape;
import { loadStoryIntoStore, serializeStoryToIiif } from "../storySerializer";
import { normaliseStoryInput } from "../viewer/storyLoader";
import type { StoryState } from "../../core/types/story";
import {
  MANGO_VIEWER_STATE_FORMAT,
  parseMangoViewerStateBody,
} from "../storyAnnotationProfile";

describe("Story IIIF Serialization and Parsing", () => {
  const sampleStory: StoryState = {
    id: "https://example.com/stories/my-story/chapters",
    title: { en: "My Awesome Story", cy: "Fy Stori Wych" },
    narration: {
      tracks: {
        en: { src: "https://example.com/audio-en.mp3" },
        cy: { src: "https://example.com/audio-cy.mp3" },
      },
    },
    chapters: [
      {
        id: "chapter_1",
        title: { en: "Chapter 1", cy: "Pennod 1" },
        description: {
          en: "This is the first chapter",
          cy: "Dyma y bennod gyntaf",
        },
        manifest: "https://manifests.collections.yale.edu/ycba/obj/34",
        canvasIndex: 0,
        canvasId: "https://manifests.collections.yale.edu/ycba/obj/34/canvas/0",
        transitionTimeMs: 2000,
        viewBox: { x: -500, y: 100, w: 1000, h: 500 }, // Has negative x to check clamping!
        media: { start: 170, end: 183 },
        narrationSegment: {
          en: { start: 0, end: 12.5 },
          cy: { start: 0, end: 14.2 },
        },
        annotations: {
          en: {
            text: "Look at this detail!",
            placement: { x: 4500, y: 6500, w: 800, h: 300 }, // Absolute canvas coords
          },
        },
        annotationPlacement: { x: 10, y: 20, w: 300, h: 200 },
        drawingAnnotations: [
          { id: "point-1", type: "point", point: { x: 120, y: 180 } },
          {
            id: "polygon-1",
            type: "polygon",
            points: [
              { x: 100, y: 100 },
              { x: 200, y: 100 },
              { x: 150, y: 220 },
            ],
          },
        ],
        advance: { mode: "auto", delayMs: 4500 },
        layerOpacities: {
          "https://example.com/layers/natural": 0.25,
          "https://example.com/layers/xray": 0.75,
        },
      },
      {
        id: "model chapter",
        title: { en: "Model detail" },
        manifest: "https://example.com/model-manifest",
        canvasIndex: 3,
        canvasId: "https://example.com/model-manifest/canvas/model",
        transitionTimeMs: 1200,
        model: {
          cameraOrbit: "45deg 30deg 2m",
          cameraTarget: "0m 1m 0m",
          fieldOfView: "45deg",
          orientation: "0deg 0deg 0deg",
        },
        modelOptions: { transition: "interpolate", interpolationDecay: 180 },
        advance: { mode: "manual" },
      },
    ],
  };

  it("should serialize story into a valid IIIF Presentation v3 AnnotationPage", () => {
    const serialized = serializeStoryToIiif(sampleStory);

    expect(serialized["@context"][0]).toBe(
      "http://www.w3.org/ns/anno.jsonld",
    );
    // Mango's own context sits in the middle; IIIF stays last, as
    // Presentation 3 requires.
    expect(serialized["@context"][1]).toBe(
      "https://mangoviewer.dev/schema/story/1/context.json",
    );
    expect(serialized["@context"][2]).toBe(
      "http://iiif.io/api/presentation/3/context.json",
    );
    expect(serialized.id).toBe(sampleStory.id);
    expect(serialized.type).toBe("AnnotationPage");
    expect(serialized.label.en[0]).toBe("My Awesome Story");
    expect(serialized.label.cy[0]).toBe("Fy Stori Wych");

    expect(serialized.items).toHaveLength(5);
    const annotation = serialized.items[0];
    expect(annotation.type).toBe("Annotation");
    expect(annotation.motivation).toBe("supplementing");
    expect(annotation.label.en[0]).toBe("Chapter 1");
    expect(annotation.summary.en[0]).toBe("This is the first chapter");

    // Clamping & media segment checks
    expect(annotation.target.source).toBe(
      "https://manifests.collections.yale.edu/ycba/obj/34/canvas/0#t=170,183",
    );
    expect(annotation.target.partOf.id).toBe(
      "https://manifests.collections.yale.edu/ycba/obj/34",
    );
    expect(annotation.target.selector.value).toBe(
      "xywh=0,100,1000,500&t=170,183",
    ); // x=-500 clamped to 0, temporal media appended!

    // Sound and Textual bodies checks
    expect(Array.isArray(annotation.body)).toBe(true);
    const soundEn = annotation.body.find(
      (b: any) => b.type === "Sound" && b.language === "en",
    );
    expect(soundEn).toBeDefined();
    expect(soundEn.id).toBe("https://example.com/audio-en.mp3#t=0,12.5");

    const soundCy = annotation.body.find(
      (b: any) => b.type === "Sound" && b.language === "cy",
    );
    expect(soundCy).toBeDefined();
    expect(soundCy.id).toBe("https://example.com/audio-cy.mp3#t=0,14.2");

    const textOverlay = serialized.items.find(
      (item) => item.id.includes("/overlay/en"),
    );
    expect(textOverlay).toBeDefined();
    expect((textOverlay?.body as any).value).toBe("Look at this detail!");
    expect((textOverlay?.target as any).selector.value).toBe(
      "xywh=4500,6500,800,300",
    );

    const drawingOverlays = serialized.items.filter((item) =>
      item.id.includes("/overlay/drawing/"),
    );
    expect(drawingOverlays).toHaveLength(2);
    expect(
      drawingOverlays.every((item) => item.motivation === "highlighting"),
    ).toBe(true);
    expect(shapeOf(drawingOverlays[0])).toEqual({
      type: "point",
      geometry: { x: 120, y: 180 },
    });
    expect(shapeOf(drawingOverlays[1])).toEqual({
      type: "polygon",
      geometry: {
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 150, y: 220 },
        ],
      },
    });

    const viewerState = annotation.body.find(
      (b: any) => b.format === MANGO_VIEWER_STATE_FORMAT,
    );
    expect(viewerState.format).toBe(MANGO_VIEWER_STATE_FORMAT);
    /*
     * No `chapterId` or `canvasId`: the annotation's own id ends in the
     * chapter id and the target's source is the canvas, so the state no
     * longer restates either. `canvasIndex` does stay — a canvas URI's last
     * segment is an index only by convention, so for many manifests this is
     * the only copy.
     */
    expect(parseMangoViewerStateBody(viewerState)).toEqual({
      canvasIndex: 0,
      viewBox: { x: -500, y: 100, w: 1000, h: 500 },
      layerOpacities: {
        "https://example.com/layers/natural": 0.25,
        "https://example.com/layers/xray": 0.75,
      },
      annotationPlacement: { x: 10, y: 20, w: 300, h: 200 },
      drawingAnnotations: [
        { id: "point-1", type: "point", point: { x: 120, y: 180 } },
        {
          id: "polygon-1",
          type: "polygon",
          points: [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 150, y: 220 },
          ],
        },
      ],
      playback: {
        advance: "auto",
        delayMs: 4500,
        transitionMs: 2000,
      },
    });

    const modelAnnotation = serialized.items.find(
      (item) => item.label?.en?.[0] === "Model detail",
    )!;
    expect(modelAnnotation.id).toContain("model%20chapter");
    expect(modelAnnotation.target.selector).toBeUndefined();
  });

  it("should round-trip parse the serialized AnnotationPage back into the same internal StoryState model", () => {
    const serialized = serializeStoryToIiif(sampleStory);
    const result = normaliseStoryInput(serialized);

    expect(result.ok).toBe(true);
    const parsed = result.story!;

    expect(parsed.title?.en).toBe("My Awesome Story");
    expect(parsed.id).toBe(sampleStory.id);
    expect(parsed.title?.cy).toBe("Fy Stori Wych");
    expect(parsed.narration?.tracks?.en.src).toBe(
      "https://example.com/audio-en.mp3",
    );
    expect(parsed.narration?.tracks?.cy.src).toBe(
      "https://example.com/audio-cy.mp3",
    );

    expect(parsed.chapters).toHaveLength(2);
    const chapter = parsed.chapters[0];
    expect(chapter.id).toBe("chapter_1");
    expect(chapter.title?.en).toBe("Chapter 1");
    expect(chapter.description?.en).toBe("This is the first chapter");
    expect(chapter.transitionTimeMs).toBe(2000);
    expect(chapter.manifest).toBe(
      "https://manifests.collections.yale.edu/ycba/obj/34",
    );
    expect(chapter.canvasIndex).toBe(0);
    expect(chapter.canvasId).toBe(
      "https://manifests.collections.yale.edu/ycba/obj/34/canvas/0",
    );

    // The standard target is clamped, while Mango state retains the exact pose.
    expect(chapter.viewBox).toEqual({ x: -500, y: 100, w: 1000, h: 500 });

    // Resolved media segment
    expect(chapter.media).toEqual({ start: 170, end: 183 });

    expect(chapter.narrationSegment?.en).toEqual({ start: 0, end: 12.5 });
    expect(chapter.narrationSegment?.cy).toEqual({ start: 0, end: 14.2 });

    expect(chapter.annotations).toBeUndefined();
    expect(chapter.annotationPlacement).toBeUndefined();
    expect(chapter.drawingAnnotations).toEqual([
      ...(sampleStory.chapters[0].drawingAnnotations ?? []),
      expect.objectContaining({
        type: "rectangle",
        rect: { x: 4500, y: 6500, w: 800, h: 300 },
        label: { en: "Look at this detail!" },
        fillMode: "solid",
      }),
    ]);
    expect(chapter.advance).toEqual({ mode: "auto", delayMs: 4500 });
    expect(chapter.layerOpacities).toEqual({
      "https://example.com/layers/natural": 0.25,
      "https://example.com/layers/xray": 0.75,
    });

    const modelChapter = parsed.chapters[1];
    expect(modelChapter.id).toBe("model chapter");
    expect(modelChapter.canvasIndex).toBe(3);
    expect(modelChapter.model).toEqual(sampleStory.chapters[1].model);
    expect(modelChapter.modelOptions).toEqual(
      sampleStory.chapters[1].modelOptions,
    );
    expect(modelChapter.advance).toEqual({ mode: "manual" });
    expect(modelChapter.transitionTimeMs).toBe(1200);
  });

  it("supports an explicit export identifier when the authoring state has none", () => {
    const story = { ...sampleStory, id: undefined };
    const serialized = serializeStoryToIiif(story, {
      id: "https://museum.example/stories/42/chapters",
    });

    expect(serialized.id).toBe("https://museum.example/stories/42/chapters");
    expect(serialized.items[0].id).toBe(
      "https://museum.example/stories/42/chapters/annotation/chapter_1",
    );
  });

  it("round-trips in-chapter camera points independently from entry timing", () => {
    const story: StoryState = {
      ...sampleStory,
      chapters: [
        {
          ...sampleStory.chapters[0],
          entryTransition: { type: "cut", durationMs: 0 },
          cameraTrack: {
            durationMs: 6000,
            keyframes: [
              {
                id: "point-a",
                timeMs: 0,
                focus: { x: 500, y: 250 },
                viewBox: { x: 0, y: 0, w: 1000, h: 500 },
              },
              {
                id: "point-b",
                timeMs: 6000,
                focus: { x: 450, y: 225 },
                viewBox: { x: 200, y: 100, w: 500, h: 250 },
              },
            ],
          },
        },
      ],
    };
    const result = normaliseStoryInput(serializeStoryToIiif(story));
    expect(result.story?.chapters[0].entryTransition).toEqual({
      type: "cut",
      durationMs: 0,
    });
    expect(result.story?.chapters[0].cameraTrack).toEqual(
      story.chapters[0].cameraTrack,
    );
  });

  it("exports rectangle, line, and freehand drawings as parseable Web Annotations", () => {
    const serialized = serializeStoryToIiif({
      id: "https://example.org/story/annotations",
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest",
          canvasIndex: 0,
          canvasId: "https://example.org/canvas/1",
          drawingAnnotations: [
            {
              id: "rect",
              type: "rectangle",
              rect: { x: 10, y: 20, w: 30, h: 40 },
            },
            {
              id: "line",
              type: "line",
              text: "A route",
              points: [
                { x: 5, y: 6 },
                { x: 50, y: 60 },
              ],
            },
            {
              id: "freehand",
              type: "freehand",
              points: [
                { x: 1, y: 2 },
                { x: 3, y: 5 },
                { x: 8, y: 13 },
              ],
            },
          ],
        },
      ],
    });

    const drawings = serialized.items.filter((item) =>
      item.id.includes("/overlay/drawing/"),
    );
    expect(drawings).toHaveLength(3);
    expect(
      drawings.map((item) => shapeOf(item).type),
    ).toEqual(["rect", "line", "freehand"]);
    expect(drawings[0].motivation).toBe("highlighting");
    expect(drawings[0].body).toBeUndefined();
    expect(drawings[1].motivation).toBe("commenting");
    expect((drawings[1].body as { value: string }).value).toBe("A route");
  });

  it("exports every story drawing translation and its portable appearance", () => {
    const serialized = serializeStoryToIiif(chapter6Fixture as StoryState);

    const drawing = serialized.items.find((item) =>
      item.id.includes("/overlay/drawing/"),
    )!;
    expect(drawing.motivation).toBe("commenting");
    expect(drawing.body).toEqual([
      expect.objectContaining({
        type: "TextualBody",
        value: "Annotations appear in context.",
        language: "en",
        purpose: "commenting",
      }),
      expect.objectContaining({
        type: "TextualBody",
        value: "Mae anodiadau yn ymddangos yn eu cyd-destun.",
        language: "cy",
        purpose: "commenting",
      }),
    ]);
    expect(JSON.stringify(drawing.stylesheet)).toContain("#e07a3f");
    expect(JSON.stringify(drawing.stylesheet)).toContain("stroke-width: 4px");
    expect((drawing.target as { styleClass?: string }).styleClass).toBe(
      "story-chapter_6-annotation",
    );
  });

  it("exports relative text-box placement as a valid spatial selector", () => {
    const withCapturedView = serializeStoryToIiif({
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest",
          canvasIndex: 0,
          canvasId: "https://example.org/canvas/1",
          viewBox: { x: 100, y: 200, w: 1000, h: 500 },
          annotations: {
            en: {
              text: "Relative note",
              placement: { x: 0.2, y: 0.3, w: 0.4, h: 0.2 },
            },
          },
        },
      ],
    });
    const overlay = withCapturedView.items.find(
      (item) => item.id.includes("/overlay/en"),
    )!;
    expect((overlay.target as any).selector.value).toBe("xywh=300,350,400,100");

    const withoutCapturedView = serializeStoryToIiif({
      chapters: [
        {
          id: "chapter-1",
          manifest: "https://example.org/manifest",
          canvasIndex: 0,
          canvasId: "https://example.org/canvas/1",
          annotations: {
            en: {
              text: "Percent note",
              placement: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
            },
          },
        },
      ],
    });
    const percentOverlay = withoutCapturedView.items.find(
      (item) => item.id.includes("/overlay/en"),
    )!;
    expect((percentOverlay.target as any).selector.value).toBe(
      "xywh=percent:10,20,30,40",
    );
  });

  it("restores builder advance delays without replacing them with transition timing", () => {
    const store = {
      loadStory: vi.fn(),
      addChapterFromCapture: vi.fn(),
      setNarrationTrack: vi.fn(),
      setChapterTitle: vi.fn(),
      setChapterDescription: vi.fn(),
      setNarrationSegment: vi.fn(),
      setAnnotationText: vi.fn(),
      setAnnotationPlacement: vi.fn(),
      setAdvanceMode: vi.fn(),
      setDelay: vi.fn(),
    };

    loadStoryIntoStore(sampleStory, store);

    expect(store.setDelay).toHaveBeenCalledWith({
      chapterId: "chapter_1",
      delayMs: 4500,
    });
    expect(store.setDelay).toHaveBeenCalledWith({
      chapterId: "model chapter",
      delayMs: 1200,
    });
    expect(store.addChapterFromCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        capture: expect.objectContaining({
          layerOpacities: sampleStory.chapters[0].layerOpacities,
        }),
      }),
    );
    expect(store.addChapterFromCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        capture: expect.objectContaining({
          model: sampleStory.chapters[1].model,
          modelOptions: sampleStory.chapters[1].modelOptions,
        }),
      }),
    );
  });
});
