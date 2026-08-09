import type {
  LanguageMap,
  AnnotationPlacement,
  StoryState,
  Chapter,
} from "../../core/types/story";
import type { ViewBox } from "../../core/types/viewer";
import {
  MANGO_STORY_VERSION,
  mangoViewerStateVersion,
  parseMangoViewerStateBody,
} from "../storyAnnotationProfile";
import { normalizeChapterAnnotations } from "../normalizeAnnotations";
import { normaliseStoryFraming } from "../framing";
import { translate } from '../../core/i18n';

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
  "mango:draft"?: boolean;
  "mango:presentationAspect"?: number;
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
  const carriesViewerState = (item: IiifStoryItem): boolean => {
    const bodies = item.body ? (Array.isArray(item.body) ? item.body : [item.body]) : [];
    return bodies.some((body) => mangoViewerStateVersion(body) !== undefined);
  };
  const legacyEnvelope = input["mango:storyVersion"] !== undefined;
  /*
   * A page with no Mango enrichment anywhere is somebody else's annotation
   * page, and it is still a story: an ordered run of framed regions with
   * captions. `items` is `@container: @list` in both the IIIF and Web
   * Annotation contexts, so document order is the sequence and needs no
   * index property to make it so.
   *
   * Every item becomes a chapter in that case. Splitting into chapters and
   * overlays is a distinction only Mango draws, and there is nothing here
   * marking which is which.
   */
  const hasMangoEnrichment =
    legacyEnvelope || pageItems.some((item) => carriesViewerState(item));
  const chapterItems = !hasMangoEnrichment
    ? pageItems
    : legacyEnvelope
      ? pageItems.filter((item) => item["mango:role"] !== "overlay")
      : pageItems.filter(carriesViewerState);
  const overlayItems = !hasMangoEnrichment
    ? []
    : legacyEnvelope
      ? pageItems.filter((item) => item["mango:role"] === "overlay")
      : pageItems.filter((item) => !carriesViewerState(item));

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
    /*
     * `summary` is IIIF vocabulary, so a page written to the Web Annotation
     * model alone puts its caption in a textual body instead. Read that when
     * there is no summary, keyed by the body's own language.
     */
    if (Object.keys(description).length === 0) {
      for (const body of bodies) {
        if (body.type !== "TextualBody") continue;
        const value = typeof body.value === "string" ? body.value.trim() : "";
        if (!value) continue;
        const lang = body.language || "en";
        if (!description[lang]) description[lang] = value;
      }
    }

    const transitionTimeMs = viewerState?.playback?.transitionMs;
    const entryTransition = viewerState?.playback?.entryTransition;
    const presentationDurationMs =
      viewerState?.playback?.presentationDurationMs;

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
        /*
         * A bare `canvas#xywh=` string is the most widely written target
         * there is, and the framing is the whole point of it for a story.
         * Reading it only from a FragmentSelector meant such a chapter
         * loaded with no framing at all.
         */
        const xywhMatch = fragment.match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
        if (xywhMatch) {
          viewBox = {
            x: parseInt(xywhMatch[1], 10),
            y: parseInt(xywhMatch[2], 10),
            w: parseInt(xywhMatch[3], 10),
            h: parseInt(xywhMatch[4], 10),
          };
        }
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

      // Resolve manifest ID and canvasIndex. `partOf` is an array in IIIF
      // Presentation 3; the single-object form is accepted because Mango
      // wrote it that way and existing stories carry it.
      const partOf = Array.isArray(targetObj?.partOf)
        ? targetObj?.partOf[0]
        : targetObj?.partOf;
      if (partOf?.id) {
        manifest = partOf.id;
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

    /*
     * Only the narration is read off the chapter's own bodies. A textual body
     * here is the chapter's caption — it is what `description` was taken from
     * — and treating it as an overlay invented a rectangle nobody drew, which
     * then re-exported as a real annotation. Overlays are separate items with
     * their own targets.
     */
    bodies.forEach((body) => {
      if (body.type === "TextualBody") return;
      processBodyItem(body);
    });
    for (const overlay of overlayItems) {
      const belongsToChapter =
        overlay["mango:chapterId"] === chapterId ||
        Boolean(item.id && overlay.id?.startsWith(`${item.id}/overlay/`));
      if (!belongsToChapter || !overlay.body) continue;
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

    return normalizeChapterAnnotations({
      id: chapterId,
      title,
      description,
      manifest,
      canvasIndex,
      canvasId,
      ...(transitionTimeMs !== undefined ? { transitionTimeMs } : {}),
      ...(entryTransition ? { entryTransition } : {}),
      ...(presentationDurationMs !== undefined
        ? { presentationDurationMs }
        : {}),
      viewBox,
      media,
      model: viewerState?.modelPose,
      modelOptions: viewerState?.modelOptions,
      layerOpacities: viewerState?.layerOpacities,
      annotationPlacement: viewerState?.annotationPlacement,
      cameraTrack: viewerState?.cameraTrack,
      drawingAnnotations: viewerState?.drawingAnnotations,
      advance,
      narrationSegment:
        Object.keys(narrationSegment).length > 0 ? narrationSegment : undefined,
      annotations:
        Object.keys(annotations).length > 0 ? annotations : undefined,
    });
  });

  const firstChapter = chapters[0];
  const firstAnnotationId = chapterItems[0]?.id;
  let customAnnotationBase: string | undefined;
  const isDraft = !input.id || input.id.startsWith("urn:mango:draft:");
  if (!isDraft && firstChapter && firstAnnotationId) {
    const suffix = encodeURIComponent(firstChapter.id);
    if (firstAnnotationId.endsWith(suffix)) {
      const candidate = firstAnnotationId.slice(0, -suffix.length);
      const derived = input.id
        ? `${input.id.replace(/\/$/, "")}/annotation/`
        : undefined;
      if (candidate && candidate !== derived) customAnnotationBase = candidate;
    }
  }

  const declaredAspect =
    chapterItems
      .flatMap((item) => item.body ? (Array.isArray(item.body) ? item.body : [item.body]) : [])
      .map(parseMangoViewerStateBody)
      .find((state) => state?.presentationAspect !== undefined)?.presentationAspect ??
    input["mango:presentationAspect"];

  return {
    id: isDraft ? undefined : input.id,
    ...(customAnnotationBase
      ? { publication: { annotationBase: customAnnotationBase } }
      : {}),
    ...(typeof declaredAspect === "number" &&
    Number.isFinite(declaredAspect) &&
    declaredAspect > 0
      ? { presentationAspect: declaredAspect }
      : {}),
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
    transitionTimeMs:
      chapter.transitionTimeMs ?? chapter.entryTransition?.durationMs ?? 2000,
  })),
});

export const normaliseStoryInput = (
  input: unknown,
): { ok: boolean; story?: StoryWithDefaults; error?: string } => {
  if (!isIiifStoryPage(input)) {
    return {
      ok: false,
      error: translate('storyViewer.errors.shape'),
    };
  }
  const bodyChapterItems = (input.items ?? []).filter((item) => {
    const bodies = item.body ? (Array.isArray(item.body) ? item.body : [item.body]) : [];
    return bodies.some((body) => mangoViewerStateVersion(body) !== undefined);
  });
  const bodyVersion = bodyChapterItems
    .flatMap((item) => item.body ? (Array.isArray(item.body) ? item.body : [item.body]) : [])
    .map(mangoViewerStateVersion)
    .find((version) => version !== undefined);
  const storyVersion = input["mango:storyVersion"] ?? bodyVersion;
  /*
   * No Mango version means somebody else's annotation page, which is read as
   * a plain story rather than refused. The version is only consulted to
   * reject enrichment this build cannot understand; its absence says there
   * is no enrichment to misread.
   */
  if (storyVersion !== undefined && storyVersion !== MANGO_STORY_VERSION) {
    return {
      ok: false,
      error: translate('storyViewer.errors.unsupportedVersion', { version: String(storyVersion) }),
    };
  }
  if (storyVersion === undefined) {
    return {
      ok: true,
      story: withChapterDefaults(normaliseStoryFraming(parseIiifStory(input))),
    };
  }
  const chapterItems = input["mango:storyVersion"] !== undefined
    ? (input.items ?? []).filter((item) => item["mango:role"] !== "overlay")
    : bodyChapterItems;
  const hasInvalidChapterState = chapterItems.some((item) => {
    const bodies = item.body
      ? Array.isArray(item.body)
        ? item.body
        : [item.body]
      : [];
    return !bodies.some((body) => parseMangoViewerStateBody(body));
  });
  if (hasInvalidChapterState) {
    return { ok: false, error: translate('storyViewer.errors.chapterState') };
  }

  // Framings are normalised on the way in so a story authored across several
  // stage shapes presents consistently, without waiting for it to be re-saved.
  return {
    ok: true,
    story: withChapterDefaults(normaliseStoryFraming(parseIiifStory(input))),
  };
};

export const validateStoryViewer = (
  story: StoryWithDefaults,
): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!Array.isArray(story.chapters) || story.chapters.length === 0) {
    errors.push(translate('validation.storyEmpty'));
  }

  const chapters = story.chapters ?? [];
  chapters.forEach((chapter, index) => {
    const prefix = translate('validation.chapter', { number: index + 1 });
    if (!chapter.id) errors.push(translate('validation.missingId', { prefix }));
    if (!chapter.manifest) errors.push(translate('validation.missingManifest', { prefix }));
    if (chapter.canvasIndex == null || Number.isNaN(chapter.canvasIndex)) {
      errors.push(translate('validation.invalidCanvas', { prefix }));
    }
    const hasCapture = Boolean(
      chapter.viewBox ||
      chapter.media ||
      chapter.model ||
      chapter.narrationSegment,
    );
    if (!hasCapture) {
      errors.push(translate('validation.captureRequired', { prefix }));
    }
    if (chapter.media) {
      const { start, end } = chapter.media;
      if (
        !(typeof start === "number" && typeof end === "number") ||
        end <= start
      ) {
        errors.push(translate('validation.invalidMedia', { prefix }));
      }
    }
    if (chapter.transitionTimeMs != null && chapter.transitionTimeMs <= 0) {
      errors.push(translate('validation.transitionPositive', { prefix }));
    }
    if (chapter.narrationSegment) {
      for (const [lang, segment] of Object.entries(chapter.narrationSegment)) {
        if (segment.end <= segment.start) {
          errors.push(translate('validation.invalidNarration', { prefix, language: lang }));
        }
      }
    }
  });

  return {
    ok: errors.length === 0,
    errors,
  };
};
