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
import { isGeneratedDraftId, isLegacyDraftId } from "../publicIdentifiers";
import {
  isDrawingOverlayId,
  parseStoryDrawingOverlay,
} from "../storyDrawingOverlay";
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

/**
 * Points out of an SvgSelector value.
 *
 * Handles the two shapes annotation tools actually emit — a `points` list on
 * a polygon or polyline, and a path of straight segments. Curves are not
 * flattened here: a region drawn with them keeps its bounding box as the
 * framing and simply is not redrawn, which is better than drawing it wrong.
 */
const parseSvgPoints = (value: string): Array<{ x: number; y: number }> => {
  if (!value.includes("<")) return [];
  const list = value.match(/points\s*=\s*["']([^"']+)["']/i)?.[1];
  const source =
    list ??
    (/[csqta]/i.test(value.match(/\sd\s*=\s*["']([^"']+)["']/i)?.[1] ?? "")
      ? undefined
      : value.match(/\sd\s*=\s*["']([^"']+)["']/i)?.[1]);
  if (!source) return [];
  const numbers = source.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    const x = Number.parseFloat(numbers[i]);
    const y = Number.parseFloat(numbers[i + 1]);
    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
  }
  return points;
};

/**
 * The rectangle a spatial media fragment names, or nothing.
 *
 * `pixel:` is the default unit and may be written or omitted, so both spellings
 * have to be read even though Mango writes only the bare form. Fractions are
 * accepted on the way in although Mango rounds on the way out: this is somebody
 * else's document as often as it is Mango's own. `percent:` deliberately does
 * not match — those values are a proportion of a canvas this function has no
 * dimensions for, and reading them as pixels would place the region silently
 * wrong rather than not at all.
 */
const PIXEL_FRAGMENT =
  /xywh=(?:pixel:)?(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/;

const matchPixelFragment = (value: string | undefined): ViewBox | undefined => {
  const match = value?.match(PIXEL_FRAGMENT);
  if (!match) return undefined;
  const [, x, y, w, h] = match;
  return {
    x: Number.parseFloat(x),
    y: Number.parseFloat(y),
    w: Number.parseFloat(w),
    h: Number.parseFloat(h),
  };
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
  /*
   * An absent label means an untitled story, and it has to stay untitled. The
   * AnnotationPage label *is* the story title by contract, so anything invented
   * here to stand in for one becomes a real, persisted title on the next save —
   * which is how every untitled story ended up called "Story Annotation Track",
   * in whichever language the editor happened to be in.
   */
  const titleMap: LanguageMap = {};
  if (input.label) {
    for (const [lang, arr] of Object.entries(input.label)) {
      const value = Array.isArray(arr) && typeof arr[0] === "string" ? arr[0].trim() : "";
      if (value) titleMap[lang] = value;
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
        const value = Array.isArray(arr) && typeof arr[0] === "string" ? arr[0].trim() : "";
        if (value) title[lang] = value;
      }
    }

    const description: LanguageMap = {};
    if (item.summary) {
      for (const [lang, arr] of Object.entries(item.summary)) {
        const value = Array.isArray(arr) && typeof arr[0] === "string" ? arr[0].trim() : "";
        if (value) description[lang] = value;
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
    let shapePoints: Array<{ x: number; y: number }> | undefined;

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
        viewBox = matchPixelFragment(fragment) ?? viewBox;
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
      }
      /*
       * The trailing segment of a canvas URI is a canvas index only by
       * convention, which is why it is read even when `partOf` already named
       * the manifest: the index is not recoverable any other way once the
       * state stopped restating it. A non-numeric segment — `p1` in the IIIF
       * cookbook, for instance — simply leaves it at zero.
       */
      if (targetCanvasId.includes("/canvas/")) {
        const parts = targetCanvasId.split("/canvas/");
        if (!manifest) manifest = parts[0];
        if (viewerState?.canvasIndex === undefined) {
          const idxVal = parseInt(parts[1], 10);
          if (!Number.isNaN(idxVal)) canvasIndex = idxVal;
        }
      }

      const selectors = targetObj?.selector
        ? Array.isArray(targetObj.selector)
          ? targetObj.selector
          : [targetObj.selector]
        : [];
      for (const selector of selectors) {
        if (!selector.value) continue;
        const val = selector.value;
        /*
         * An SvgSelector is how an annotation says its region is not a
         * rectangle. The points are kept so the shape can be drawn as the
         * document meant it, and their bounding box becomes the framing,
         * since a camera can only be given a rectangle.
         */
        const points = parseSvgPoints(val);
        if (points.length >= 2) {
          shapePoints = points;
          const xs = points.map((p) => p.x);
          const ys = points.map((p) => p.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          viewBox = {
            x: minX,
            y: minY,
            w: Math.max(...xs) - minX,
            h: Math.max(...ys) - minY,
          };
          continue;
        }
        viewBox = matchPixelFragment(val) ?? viewBox;

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
    /*
     * The target is the canvas. State written before the move restated it,
     * and is still preferred so those stories load byte-identically, but its
     * absence now means "read the target" rather than "there is no canvas" —
     * which is what emptied the manifest when the duplicate was dropped.
     */
    const canvasId = viewerState?.canvasId ?? targetCanvasId;

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
            const match = matchPixelFragment(selector.value);
            if (match) {
              placement = match;
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
    /*
     * Drawings and captions are both overlays and both live in `items`, so the
     * split has to happen before either is read. Feeding a drawing through the
     * caption pass is what let its own text be mistaken for the retired
     * text-box model, minted as a fresh rectangle nobody drew, and then written
     * back out — one more copy on every save, without bound.
     */
    const chapterOverlays = overlayItems.filter(
      (overlay) =>
        overlay["mango:chapterId"] === chapterId ||
        Boolean(item.id && overlay.id?.startsWith(`${item.id}/overlay/`)),
    );
    const drawingOverlays = chapterOverlays.filter((overlay) =>
      isDrawingOverlayId(overlay.id, item.id),
    );
    for (const overlay of chapterOverlays) {
      if (isDrawingOverlayId(overlay.id, item.id) || !overlay.body) continue;
      const overlayBodies = Array.isArray(overlay.body)
        ? overlay.body
        : [overlay.body];
      overlayBodies.forEach((body) => processBodyItem(body, overlay.target));
    }

    /*
     * The published annotations are the drawings, not a second rendering of
     * them. `mangoState.drawingAnnotations` is only consulted for stories
     * written before that was true — a document carrying both agrees with
     * itself, and preferring `items` is what keeps the IIIF copy exercised.
     */
    const overlayDrawings = drawingOverlays.flatMap((overlay) => {
      const drawing = parseStoryDrawingOverlay(overlay, {
        canvasId: viewerState?.canvasId ?? targetCanvasId,
        chapterAnnotationId: item.id,
      });
      return drawing ? [drawing] : [];
    });

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
      /*
       * On a page Mango did not author, the annotation's target region is
       * both where to look and what the annotation is about, so it is drawn
       * as well as framed. A Mango story keeps the two separate — the
       * chapter framing is the camera and drawings are their own thing —
       * which is why this only applies where there is no enrichment.
       *
       * No label: these captions run to a paragraph, and a paragraph set
       * inside the region it describes is unreadable. The chapter panel is
       * already showing it.
       */
      drawingAnnotations:
        (overlayDrawings.length > 0 ? overlayDrawings : undefined) ??
        viewerState?.drawingAnnotations ??
        (!hasMangoEnrichment && viewBox
          ? [
              shapePoints && shapePoints.length >= 2
                ? {
                    id: `${chapterId}-region`,
                    type: "polygon" as const,
                    points: shapePoints,
                  }
                : {
                    id: `${chapterId}-region`,
                    type: "rectangle" as const,
                    rect: viewBox,
                  },
            ]
          : undefined),
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
  /*
   * A generated id is kept so a draft's identifiers stay stable across
   * save/load — dropping it would mint a new one every cycle and churn every
   * id in the document. It stays recognisable as generated, so the settings
   * panel still shows the field empty and publication validation still
   * refuses it. A legacy URN is dropped instead: preserving it would keep
   * writing an id IIIF does not allow.
   */
  const generatedDraft = isGeneratedDraftId(input.id);
  const legacyDraft = isLegacyDraftId(input.id);
  const isDraft = !input.id || generatedDraft || legacyDraft;
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
    id: !input.id || legacyDraft ? undefined : input.id,
    ...(customAnnotationBase
      ? { publication: { annotationBase: customAnnotationBase } }
      : {}),
    ...(typeof declaredAspect === "number" &&
    Number.isFinite(declaredAspect) &&
    declaredAspect > 0
      ? { presentationAspect: declaredAspect }
      : {}),
    ...(Object.keys(titleMap).length > 0 ? { title: titleMap } : {}),
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
