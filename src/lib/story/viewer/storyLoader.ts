import type {
  LanguageMap,
  AnnotationPlacement,
  Story,
  Chapter,
} from "../../core/types/story";
import type { ViewBox } from "../../core/types/viewer";

export type StoryWithDefaults = Story & {
  chapters: Array<Chapter & { transitionTimeMs: number }>;
};

type IiifStoryTarget = {
  source?: string;
  partOf?: { id?: string };
  selector?: { value?: string };
};

type IiifStoryBody = {
  type?: string;
  id?: string;
  language?: string;
  value?: string;
  target?: IiifStoryTarget;
};

type IiifStoryItem = {
  id?: string;
  label?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  transitionTimeMs?: number;
  target?: string | IiifStoryTarget;
  body?: IiifStoryBody | IiifStoryBody[];
};

type IiifStoryPage = {
  type: "AnnotationPage";
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

const parseIiifStory = (input: IiifStoryPage): Story => {
  const titleMap: LanguageMap = {};
  if (input.label) {
    for (const [lang, arr] of Object.entries(input.label)) {
      if (Array.isArray(arr) && arr.length > 0) {
        titleMap[lang] = arr[0];
      }
    }
  }

  const narrationTracks: Record<string, { src: string }> = {};

  const chapters = (input.items || []).map((item, index) => {
    const chapterId = item.id?.split("/").pop() || `chapter_${index + 1}`;
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

    const transitionTimeMs = item.transitionTimeMs ?? 2000;

    // Parse target (canvas and viewBox)
    let canvasId = "";
    let manifest = "";
    let canvasIndex = 0;
    let viewBox: ViewBox | undefined;

    let targetSource = item.target;
    if (!targetSource && item.body) {
      const bodies = Array.isArray(item.body) ? item.body : [item.body];
      const bodyWithTarget = bodies.find((body) => body.target);
      if (bodyWithTarget) {
        targetSource = bodyWithTarget.target;
      }
    }

    let media: { start: number; end: number } | undefined;

    if (targetSource) {
      const source =
        typeof targetSource === "string" ? targetSource : targetSource.source;
      canvasId = source || "";

      if (canvasId.includes("#")) {
        const parts = canvasId.split("#");
        canvasId = parts[0];
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
      } else if (canvasId && canvasId.includes("/canvas/")) {
        const parts = canvasId.split("/canvas/");
        manifest = parts[0];
        const idxVal = parseInt(parts[1], 10);
        canvasIndex = Number.isNaN(idxVal) ? 0 : idxVal;
      }

      const selector = targetObj?.selector;
      if (selector && selector.value) {
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

    // Parse body for narration segment and annotations
    const narrationSegment: Record<string, { start: number; end: number }> = {};
    const annotations: Record<
      string,
      { text: string; placement: AnnotationPlacement }
    > = {};

    const processBodyItem = (bodyItem: IiifStoryBody) => {
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

        if (
          bodyItem.target &&
          bodyItem.target.selector &&
          bodyItem.target.selector.value
        ) {
          const val = bodyItem.target.selector.value;
          const match = val.match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
          if (match) {
            placement = {
              x: parseInt(match[1], 10),
              y: parseInt(match[2], 10),
              w: parseInt(match[3], 10),
              h: parseInt(match[4], 10),
            };
          }
        }

        annotations[lang] = { text, placement };
      }
    };

    if (item.body) {
      if (Array.isArray(item.body)) {
        item.body.forEach(processBodyItem);
      } else {
        processBodyItem(item.body);
      }
    }

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
      narrationSegment:
        Object.keys(narrationSegment).length > 0 ? narrationSegment : undefined,
      annotations:
        Object.keys(annotations).length > 0 ? annotations : undefined,
    };
  });

  return {
    version: "1.0",
    type: "story",
    title: titleMap,
    narration:
      Object.keys(narrationTracks).length > 0
        ? { tracks: narrationTracks }
        : undefined,
    chapters,
  };
};

const extractStoryObject = (input: unknown): Story | null => {
  const record = asRecord(input);
  if (!record) return null;
  if (isIiifStoryPage(input)) {
    return parseIiifStory(input);
  }
  const maybeWrapped = asRecord(record.data);
  if (maybeWrapped?.type === "story") {
    return maybeWrapped as Story;
  }
  if (isIiifStoryPage(maybeWrapped)) {
    return parseIiifStory(maybeWrapped);
  }
  if (record.type === "story") {
    return input as Story;
  }
  return null;
};

const withChapterDefaults = (story: Story): StoryWithDefaults => ({
  ...story,
  chapters: (story.chapters ?? []).map((chapter) => ({
    ...chapter,
    transitionTimeMs: chapter.transitionTimeMs ?? 2000,
  })),
});

export const normaliseStoryInput = (
  input: unknown,
): { ok: boolean; story?: StoryWithDefaults; error?: string } => {
  const story = extractStoryObject(input);
  if (!story) {
    return { ok: false, error: "Invalid story shape" };
  }
  return { ok: true, story: withChapterDefaults(story) };
};

export const validateStoryViewer = (
  story: StoryWithDefaults,
): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!story || story.type !== "story") {
    errors.push("Story: invalid type");
  }
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
