import type {
  LanguageMap,
  AnnotationPlacement,
  StoryState,
  Chapter,
} from "../../core/types/story";
import type { ViewBox } from "../../core/types/viewer";
import {
  MANGO_STORY_VERSION,
  parseMangoViewerStateBody,
} from "../storyAnnotationProfile";

export type StoryWithDefaults = StoryState & {
  chapters: Array<Chapter & { transitionTimeMs: number }>;
};

type IiifStoryTarget = {
  source?: string | { id?: string };
  partOf?: { id?: string };
  selector?: { value?: string } | Array<{ value?: string }>;
};

type IiifStoryBody = {
  type?: string;
  id?: string;
  language?: string;
  value?: string;
  target?: IiifStoryTarget;
  [key: string]: unknown;
};

type IiifStoryItem = {
  id?: string;
  motivation?: string;
  "mango:role"?: string;
  "mango:chapterId"?: string;
  label?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  target?: string | IiifStoryTarget;
  body?: IiifStoryBody | IiifStoryBody[];
};

type IiifStoryPage = {
  id?: string;
  type: "AnnotationPage";
  "mango:storyVersion"?: string;
  label?: Record<string, unknown>;
  items?: IiifStoryItem[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const isIiifStoryPage = (value: unknown): value is IiifStoryPage => {
  const record = asRecord(value);
  return (
    record?.type === "AnnotationPage" &&
    (record.items === undefined || Array.isArray(record.items))
  );
};

const parseIiifStory = (input: IiifStoryPage): StoryState => {
  const titleMap: LanguageMap = {};
  if (input.label) {
    for (const [lang, arr] of Object.entries(input.label)) {
      if (Array.isArray(arr) && arr.length > 0) {
        titleMap[lang] = arr[0];
      }
    }
  }

  const narrationTracks: Record<string, { src: string }> = {};

  const pageItems = input.items || [];
  const overlayItems = pageItems.filter(
    (item) => item["mango:role"] === "overlay",
  );
  const chapterItems = pageItems.filter(
    (item) => item["mango:role"] !== "overlay",
  );

  const chapters = chapterItems.map((item, index) => {
    const bodies = item.body
      ? Array.isArray(item.body)
        ? item.body
        : [item.body]
      : [];
    const viewerState = bodies
      .map((body) => parseMangoViewerStateBody(body))
      .find((state) => state !== undefined);
    const encodedChapterId = item.id?.split("/").pop();
    let fallbackChapterId = encodedChapterId || `chapter_${index + 1}`;
    try {
      fallbackChapterId = decodeURIComponent(fallbackChapterId);
    } catch {
      // Keep malformed external IDs usable instead of rejecting the story.
    }
    const chapterId = viewerState?.chapterId || fallbackChapterId;
    const title: LanguageMap = {};
    if (item.label) {
      for (const [lang, arr] of Object.entries(item.label)) {
        if (Array.isArray(arr) && arr.length > 0) {
          title[lang] = arr[0];
        }
      }
    }

    const description: LanguageMap = {};
    if (item.summary) {
      for (const [lang, arr] of Object.entries(item.summary)) {
        if (Array.isArray(arr) && arr.length > 0) {
          description[lang] = arr[0];
        }
      }
    }

    const transitionTimeMs = viewerState?.playback?.transitionMs ?? 2000;

    // Parse target (canvas and viewBox)
    let targetCanvasId = "";
    let manifest = "";
    let canvasIndex = viewerState?.canvasIndex ?? 0;
    let viewBox: ViewBox | undefined;

    let targetSource = item.target;
    if (!targetSource && item.body) {
      const bodyWithTarget = bodies.find((body) => body.target);
      if (bodyWithTarget) {
        targetSource = bodyWithTarget.target;
      }
    }

    let media: { start: number; end: number } | undefined;

    if (targetSource) {
      const rawSource =
        typeof targetSource === "string" ? targetSource : targetSource.source;
      const source = typeof rawSource === "string" ? rawSource : rawSource?.id;
      targetCanvasId = source || "";

      if (targetCanvasId.includes("#")) {
        const parts = targetCanvasId.split("#");
        targetCanvasId = parts[0];
        const fragment = parts[1];
        const tMatch = fragment.match(/t=(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/);
        if (tMatch) {
          const start = parseFloat(tMatch[1]);
          const end = parseFloat(tMatch[2]);
          if (!Number.isNaN(start) && !Number.isNaN(end)) {
            media = { start, end };
          }
        }
      }

      const targetObj = typeof targetSource === "object" ? targetSource : null;

      // Resolve manifest ID and canvasIndex
      if (targetObj && targetObj.partOf && targetObj.partOf.id) {
        manifest = targetObj.partOf.id;
      } else if (targetCanvasId && targetCanvasId.includes("/canvas/")) {
        const parts = targetCanvasId.split("/canvas/");
        manifest = parts[0];
        const idxVal = parseInt(parts[1], 10);
        canvasIndex = Number.isNaN(idxVal) ? 0 : idxVal;
      }

      const selectors = targetObj?.selector
        ? Array.isArray(targetObj.selector)
          ? targetObj.selector
          : [targetObj.selector]
        : [];
      for (const selector of selectors) {
        if (!selector.value) continue;
        const val = selector.value;
        const match = val.match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
        if (match) {
          viewBox = {
            x: parseInt(match[1], 10),
            y: parseInt(match[2], 10),
            w: parseInt(match[3], 10),
            h: parseInt(match[4], 10),
          };
        }

        const tMatch = val.match(/t=(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/);
        if (tMatch) {
          const start = parseFloat(tMatch[1]);
          const end = parseFloat(tMatch[2]);
          if (!Number.isNaN(start) && !Number.isNaN(end)) {
            media = { start, end };
          }
        }
      }
    }

    if (viewerState?.viewBox) viewBox = viewerState.viewBox;
    const canvasId = viewerState
      ? (viewerState.canvasId ?? "")
      : targetCanvasId;

    // Parse body for narration segment and annotations
    const narrationSegment: Record<string, { start: number; end: number }> = {};
    const annotations: Record<
      string,
      { text: string; placement: AnnotationPlacement }
    > = {};

    const processBodyItem = (
      bodyItem: IiifStoryBody,
      annotationTarget?: string | IiifStoryTarget,
    ) => {
      if (bodyItem.type === "Sound") {
        const urlWithFragment = bodyItem.id || "";
        const lang = bodyItem.language || "en";
        const urlParts = urlWithFragment.split("#t=");
        const audioUrl = urlParts[0];

        narrationTracks[lang] = { src: audioUrl };

        if (urlParts[1]) {
          const times = urlParts[1].split(",");
          const start = parseFloat(times[0]);
          const end = parseFloat(times[1]);
          if (!Number.isNaN(start) && !Number.isNaN(end)) {
            narrationSegment[lang] = { start, end };
          }
        }
      } else if (bodyItem.type === "TextualBody") {
        const text = bodyItem.value || "";
        const lang = bodyItem.language || "en";
        let placement: AnnotationPlacement = {
          x: 0.33,
          y: 0.33,
          w: 0.34,
          h: 0.34,
        };

        const placementTarget = bodyItem.target ?? annotationTarget;
        if (
          placementTarget &&
          typeof placementTarget === "object" &&
          placementTarget.selector
        ) {
          const selectors = Array.isArray(placementTarget.selector)
            ? placementTarget.selector
            : [placementTarget.selector];
          for (const selector of selectors) {
            const match = selector.value?.match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
            if (match) {
              placement = {
                x: parseInt(match[1], 10),
                y: parseInt(match[2], 10),
                w: parseInt(match[3], 10),
                h: parseInt(match[4], 10),
              };
              break;
            }
          }
        }

        annotations[lang] = { text, placement };
      }
    };

    bodies.forEach((body) => processBodyItem(body));
    for (const overlay of overlayItems) {
      if (overlay["mango:chapterId"] !== chapterId || !overlay.body) continue;
      const overlayBodies = Array.isArray(overlay.body)
        ? overlay.body
        : [overlay.body];
      overlayBodies.forEach((body) => processBodyItem(body, overlay.target));
    }

    const advance = viewerState?.playback?.advance
      ? {
          mode: viewerState.playback.advance,
          ...(viewerState.playback.delayMs !== undefined
            ? { delayMs: viewerState.playback.delayMs }
            : {}),
        }
      : undefined;

    return {
      id: chapterId,
      title,
      description,
      manifest,
      canvasIndex,
      canvasId,
      transitionTimeMs,
      viewBox,
      media,
      model: viewerState?.modelPose,
      modelOptions: viewerState?.modelOptions,
      layerOpacities: viewerState?.layerOpacities,
      annotationPlacement: viewerState?.annotationPlacement,
      advance,
      narrationSegment:
        Object.keys(narrationSegment).length > 0 ? narrationSegment : undefined,
      annotations:
        Object.keys(annotations).length > 0 ? annotations : undefined,
    };
  });

  return {
    id: input.id,
    title: titleMap,
    narration:
      Object.keys(narrationTracks).length > 0
        ? { tracks: narrationTracks }
        : undefined,
    chapters,
  };
};

const withChapterDefaults = (story: StoryState): StoryWithDefaults => ({
  ...story,
  chapters: (story.chapters ?? []).map((chapter) => ({
    ...chapter,
    transitionTimeMs: chapter.transitionTimeMs ?? 2000,
  })),
});

export const normaliseStoryInput = (
  input: unknown,
): { ok: boolean; story?: StoryWithDefaults; error?: string } => {
  if (!isIiifStoryPage(input)) {
    return {
      ok: false,
      error: "Invalid story shape: expected a Mango story AnnotationPage",
    };
  }
  if (input["mango:storyVersion"] === undefined) {
    return { ok: false, error: "Missing Mango story version" };
  }
  if (input["mango:storyVersion"] !== MANGO_STORY_VERSION) {
    return {
      ok: false,
      error: `Unsupported Mango story version: ${input["mango:storyVersion"]}`,
    };
  }

  const chapterItems = (input.items ?? []).filter(
    (item) => item["mango:role"] !== "overlay",
  );
  const hasInvalidChapterState = chapterItems.some((item) => {
    const bodies = item.body
      ? Array.isArray(item.body)
        ? item.body
        : [item.body]
      : [];
    return !bodies.some((body) => parseMangoViewerStateBody(body));
  });
  if (hasInvalidChapterState) {
    return { ok: false, error: "Invalid Mango story chapter state" };
  }

  return { ok: true, story: withChapterDefaults(parseIiifStory(input)) };
};

export const validateStoryViewer = (
  story: StoryWithDefaults,
): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!Array.isArray(story.chapters) || story.chapters.length === 0) {
    errors.push("Story: must have at least one chapter");
  }

  const chapters = story.chapters ?? [];
  chapters.forEach((chapter, index) => {
    const prefix = `Chapter ${index + 1}`;
    if (!chapter.id) errors.push(`${prefix}: missing id`);
    if (!chapter.manifest) errors.push(`${prefix}: missing manifest`);
    if (chapter.canvasIndex == null || Number.isNaN(chapter.canvasIndex)) {
      errors.push(`${prefix}: invalid canvas index`);
    }
    const hasCapture = Boolean(
      chapter.viewBox ||
      chapter.media ||
      chapter.model ||
      chapter.narrationSegment,
    );
    if (!hasCapture) {
      errors.push(
        `${prefix}: must have viewBox, media, model, or narration segment`,
      );
    }
    if (chapter.media) {
      const { start, end } = chapter.media;
      if (
        !(typeof start === "number" && typeof end === "number") ||
        end <= start
      ) {
        errors.push(`${prefix}: media end must be greater than start`);
      }
    }
    if (chapter.transitionTimeMs != null && chapter.transitionTimeMs <= 0) {
      errors.push(`${prefix}: transitionTimeMs must be positive`);
    }
    if (chapter.narrationSegment) {
      for (const [lang, segment] of Object.entries(chapter.narrationSegment)) {
        if (segment.end <= segment.start) {
          errors.push(`${prefix}: narration segment invalid for ${lang}`);
        }
      }
    }
  });

  return {
    ok: errors.length === 0,
    errors,
  };
};
