import { validateStory } from "./validation";
import type { StoryState } from "../core/types/story";
import type { CapturePayload } from "../core/state/story.svelte";
import {
  W3CParser,
  type RectGeometry,
  type TemporalFragment,
} from "@mango-iiif/w3c-parser";
import {
  createMangoViewerStateBody,
  IIIF_PRESENTATION_3_CONTEXT,
  MANGO_STORY_CONTEXT,
  MANGO_STORY_VERSION,
  type MangoViewerStateBody,
} from "./storyAnnotationProfile";

export type SaveConfig = {
  endpoint?: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  enabled?: boolean;
};

export type StorySelector = {
  type?: string;
  conformsTo?: string;
  value?: string;
  [key: string]: unknown;
};

export type StoryTarget = {
  source?: string;
  type?: string;
  partOf?: { id: string; type: "Manifest" };
  selector?: StorySelector | StorySelector[];
  [key: string]: unknown;
};

export type StoryAnnotation = {
  id: string;
  type: "Annotation";
  motivation: "supplementing" | "describing";
  "mango:role"?: "overlay";
  "mango:chapterId"?: string;
  label?: Record<string, string[]>;
  summary?: Record<string, string[]>;
  body?:
    | Record<string, unknown>
    | MangoViewerStateBody
    | Array<Record<string, unknown> | MangoViewerStateBody>;
  target: StoryTarget | string;
};

export type StoryAnnotationPage = {
  "@context": [typeof IIIF_PRESENTATION_3_CONTEXT, typeof MANGO_STORY_CONTEXT];
  id: string;
  type: "AnnotationPage";
  "mango:storyVersion": typeof MANGO_STORY_VERSION;
  label: Record<string, string[]>;
  items: StoryAnnotation[];
};

export type SerializeStoryOptions = {
  /** Public HTTP(S) identifier for the exported AnnotationPage. */
  id?: string;
};

export type ExportEnvelope = StoryAnnotationPage;

export type SaveResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; code?: string };

export type SaveState =
  | { status: "idle"; message?: string; code?: string }
  | { status: "saving"; message?: string; code?: string }
  | { status: "success"; message?: string }
  | { status: "error"; message?: string; code?: string };

const normaliseStoryFragment = (value: string): string =>
  value.replace("xywh=pixel:", "xywh=");

const serializeFragment = (
  id: string,
  canvasId: string,
  rect?: RectGeometry,
  temporal?: TemporalFragment,
): string => {
  const annotation = W3CParser.serialize({
    id,
    canvasId,
    text: "",
    shape: rect ? { type: "rect", geometry: rect } : { type: "none" },
    temporal,
  });
  if (typeof annotation.target === "string") return "";
  const selectors = Array.isArray(annotation.target.selector)
    ? annotation.target.selector
    : annotation.target.selector
      ? [annotation.target.selector]
      : [];
  return normaliseStoryFragment(
    selectors
      .map((selector) => selector.value)
      .filter(Boolean)
      .join("&"),
  );
};

const normaliseStoryTarget = (target: unknown): StoryTarget | string => {
  if (typeof target === "string") return target;
  if (!target || typeof target !== "object") return {};
  const record = target as StoryTarget;
  const selectors = Array.isArray(record.selector)
    ? record.selector
    : [record.selector];
  const normalized = selectors
    .filter((selector): selector is StorySelector => Boolean(selector))
    .map((selector) => ({
      ...selector,
      ...(typeof selector.value === "string"
        ? { value: normaliseStoryFragment(selector.value) }
        : {}),
    }));
  return {
    ...record,
    selector: Array.isArray(record.selector) ? normalized : normalized[0],
  };
};

export const serializeStoryToIiif = (
  raw: StoryState,
  options: SerializeStoryOptions = {},
): StoryAnnotationPage => {
  const label: Record<string, string[]> = {};
  if (raw.title) {
    for (const [lang, val] of Object.entries(raw.title)) {
      label[lang] = [val];
    }
  }

  const pageId =
    options.id ??
    raw.id ??
    "https://mango-iiif.github.io/examples/stories/untitled/chapters";
  const annotationBase = pageId.replace(/\/$/, "");

  const items: StoryAnnotation[] = raw.chapters.flatMap((chapter, index) => {
    const chapterId = chapter.id || `chapter_${index + 1}`;
    const annotationId = `${annotationBase}/annotation/${encodeURIComponent(chapterId)}`;

    const labelMap: Record<string, string[]> = {};
    if (chapter.title) {
      for (const [lang, val] of Object.entries(chapter.title)) {
        labelMap[lang] = [val];
      }
    }

    const summaryMap: Record<string, string[]> = {};
    if (chapter.description) {
      for (const [lang, val] of Object.entries(chapter.description)) {
        summaryMap[lang] = [val];
      }
    }

    // Build target
    const canvasId =
      chapter.canvasId || `${chapter.manifest}/canvas/${chapter.canvasIndex}`;

    let viewBoxValue: string | undefined;
    if (chapter.viewBox) {
      const vx = Math.round(Math.max(0, chapter.viewBox.x));
      const vy = Math.round(Math.max(0, chapter.viewBox.y));
      const vw = Math.round(chapter.viewBox.w);
      const vh = Math.round(chapter.viewBox.h);
      viewBoxValue = serializeFragment(annotationId, canvasId, {
        x: vx,
        y: vy,
        w: vw,
        h: vh,
      });
    }

    let sourceUrl = canvasId;
    let selectorValue = viewBoxValue;
    if (chapter.media) {
      const mediaFragment = `t=${chapter.media.start},${chapter.media.end}`;
      sourceUrl = `${canvasId}#${mediaFragment}`;
      if (chapter.viewBox) {
        selectorValue = `${viewBoxValue}&${mediaFragment}`;
      } else {
        selectorValue = mediaFragment;
      }
    }

    const target: StoryTarget = {
      source: sourceUrl,
      type: "SpecificResource",
      partOf: {
        id: chapter.manifest,
        type: "Manifest",
      },
      ...(selectorValue
        ? {
            selector: {
              type: "FragmentSelector",
              conformsTo: "http://www.w3.org/TR/media-frags/",
              value: selectorValue,
            },
          }
        : {}),
    };

    // Build body list
    const bodyItems: Array<Record<string, unknown> | MangoViewerStateBody> = [];

    // Add narration segment
    if (chapter.narrationSegment) {
      for (const [lang, segment] of Object.entries(chapter.narrationSegment)) {
        const track = raw.narration?.tracks?.[lang];
        if (track && track.src) {
          bodyItems.push({
            id: `${track.src}#t=${segment.start},${segment.end}`,
            type: "Sound",
            format: "audio/mp3",
            language: lang,
          });
        }
      }
    }

    const overlayAnnotations: StoryAnnotation[] = [];

    // Text overlays are independent Web Annotations because each one has its
    // own spatial target. The Mango chapter link keeps them out of sequencing.
    if (chapter.annotations) {
      for (const [lang, annotation] of Object.entries(chapter.annotations)) {
        if (annotation.text) {
          const placement = annotation.placement || {
            x: 4500,
            y: 6500,
            w: 800,
            h: 300,
          };
          const px = Number.isFinite(placement.x)
            ? Math.round(placement.x)
            : 4500;
          const py = Number.isFinite(placement.y)
            ? Math.round(placement.y)
            : 6500;
          const pw =
            Number.isFinite(placement.w) && placement.w > 0
              ? Math.round(placement.w)
              : 800;
          const ph =
            Number.isFinite(placement.h) && placement.h > 0
              ? Math.round(placement.h)
              : 300;
          const serializedText = W3CParser.serialize({
            id: `${annotationId}-${lang}`,
            canvasId,
            text: annotation.text,
            shape: {
              type: "rect",
              geometry: { x: px, y: py, w: pw, h: ph },
            },
          });
          overlayAnnotations.push({
            id: `${annotationId}/overlay/${encodeURIComponent(lang)}`,
            type: "Annotation",
            motivation: "describing",
            "mango:role": "overlay",
            "mango:chapterId": chapterId,
            body: {
              ...serializedText.body[0],
              purpose: "describing",
              language: lang,
            },
            target: normaliseStoryTarget(serializedText.target),
          });
        }
      }
    }

    bodyItems.push(createMangoViewerStateBody({ ...chapter, id: chapterId }));

    const chapterAnnotation: StoryAnnotation = {
      id: annotationId,
      type: "Annotation",
      motivation: "supplementing",
      label: Object.keys(labelMap).length > 0 ? labelMap : undefined,
      summary: Object.keys(summaryMap).length > 0 ? summaryMap : undefined,
      body:
        bodyItems.length === 1
          ? bodyItems[0]
          : bodyItems.length > 1
            ? bodyItems
            : undefined,
      target,
    };
    return [chapterAnnotation, ...overlayAnnotations];
  });

  return {
    "@context": [IIIF_PRESENTATION_3_CONTEXT, MANGO_STORY_CONTEXT],
    id: pageId,
    type: "AnnotationPage",
    "mango:storyVersion": MANGO_STORY_VERSION,
    label:
      Object.keys(label).length > 0
        ? label
        : { en: ["Story Annotation Track"] },
    items,
  };
};

export const buildExportEnvelope = (raw: StoryState): ExportEnvelope => {
  return serializeStoryToIiif(raw);
};

export const performFetchWithTimeout = async (
  cfg: SaveConfig,
  payload: ExportEnvelope,
): Promise<SaveResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 10000);

  try {
    const res = await fetch(cfg.endpoint as string, {
      method: cfg.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.headers ?? {}),
      },
      credentials: cfg.credentials,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { ok: false, message: `Save failed (${res.status})` };
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { ok: false, message: "Save failed (invalid JSON response)" };
    }

    const response =
      body && typeof body === "object"
        ? (body as {
            success?: unknown;
            message?: unknown;
            error?: { message?: unknown; code?: unknown };
          })
        : {};
    const success = response.success === true;
    if (success) {
      return {
        ok: true,
        message:
          typeof response.message === "string"
            ? response.message
            : "Saved successfully",
      };
    }

    return {
      ok: false,
      message:
        (typeof response.error?.message === "string" &&
          response.error.message) ||
        (typeof response.message === "string" && response.message) ||
        "Save failed",
      code:
        typeof response.error?.code === "string"
          ? response.error.code
          : undefined,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, message: "Save timed out", code: "timeout" };
    }
    return { ok: false, message: "Could not reach server", code: "network" };
  }
};

export const validateStoryForExport = (story: StoryState) => validateStory(story);

export type StoryStoreWrapper = {
  loadStory: (next: StoryState) => void;
  addChapterFromCapture: (payload: {
    capture: CapturePayload;
    id?: string;
  }) => void;
  setNarrationTrack: (payload: { language: string; src: string }) => void;
  setChapterTitle: (payload: {
    chapterId: string;
    language: string;
    value: string;
  }) => void;
  setChapterDescription: (payload: {
    chapterId: string;
    language: string;
    value: string;
  }) => void;
  setNarrationSegment: (payload: {
    chapterId: string;
    language: string;
    start: number;
    end: number;
  }) => void;
  setAnnotationText: (payload: {
    chapterId: string;
    language: string;
    text: string;
  }) => void;
  setAnnotationPlacement: (payload: {
    chapterId: string;
    language: string;
    placement: import("../core/types/story").AnnotationPlacement;
  }) => void;
  setAdvanceMode: (payload: {
    chapterId: string;
    mode: import("../core/types/story").ChapterAdvance["mode"];
  }) => void;
  setDelay: (payload: { chapterId: string; delayMs?: number }) => void;
};

export const loadStoryIntoStore = (
  storyToLoad: StoryState,
  storyStoreWrapper: StoryStoreWrapper,
): void => {
  storyStoreWrapper.loadStory({
    id: storyToLoad.id,
    title: storyToLoad.title,
    chapters: [],
  });

  if (storyToLoad.narration) {
    for (const [lang, track] of Object.entries(
      storyToLoad.narration.tracks || {},
    )) {
      storyStoreWrapper.setNarrationTrack({ language: lang, src: track.src });
    }
  }

  for (const chapter of storyToLoad.chapters || []) {
    const capture: CapturePayload = {
      manifest: chapter.manifest || "",
      canvasIndex: chapter.canvasIndex || 0,
      canvasId: chapter.canvasId,
      viewBox: chapter.viewBox,
      model: chapter.model,
      modelOptions: chapter.modelOptions,
      media: chapter.media,
      layerOpacities: chapter.layerOpacities,
    };

    storyStoreWrapper.addChapterFromCapture({ capture, id: chapter.id });

    if (chapter.title) {
      for (const [lang, value] of Object.entries(chapter.title)) {
        storyStoreWrapper.setChapterTitle({
          chapterId: chapter.id,
          language: lang,
          value,
        });
      }
    }

    if (chapter.description) {
      for (const [lang, value] of Object.entries(chapter.description)) {
        storyStoreWrapper.setChapterDescription({
          chapterId: chapter.id,
          language: lang,
          value,
        });
      }
    }

    if (chapter.narrationSegment) {
      for (const [lang, segment] of Object.entries(chapter.narrationSegment)) {
        storyStoreWrapper.setNarrationSegment({
          chapterId: chapter.id,
          language: lang,
          start: segment.start,
          end: segment.end,
        });
      }
    }

    if (chapter.annotations) {
      for (const [lang, annotation] of Object.entries(chapter.annotations)) {
        if (annotation.text) {
          storyStoreWrapper.setAnnotationText({
            chapterId: chapter.id,
            language: lang,
            text: annotation.text,
          });
        }
        if (annotation.placement) {
          storyStoreWrapper.setAnnotationPlacement({
            chapterId: chapter.id,
            language: lang,
            placement: annotation.placement,
          });
        }
      }
    }

    if (chapter.advance?.mode) {
      storyStoreWrapper.setAdvanceMode({
        chapterId: chapter.id,
        mode: chapter.advance.mode,
      });
    }

    const delayMs = chapter.advance?.delayMs ?? chapter.transitionTimeMs;
    if (delayMs !== undefined) {
      storyStoreWrapper.setDelay({
        chapterId: chapter.id,
        delayMs,
      });
    }
  }
};
