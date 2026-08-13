import { validateStory } from './validation';
import type { StoryState } from '../core/types/story';
import type { CapturePayload } from '../core/state/story.svelte';
import {
  createSelectors,
  serializeWebAnnotation,
  type CanonicalStylesheet,
  type NeutralShape,
  type RectGeometry,
  type TemporalFragment,
} from '@mango-iiif/w3c-parser';
import { createMangoAnnotation } from '../features/annotations/canonical';
import {
  createMangoViewerStateBody,
  IIIF_PRESENTATION_3_CONTEXT,
  MANGO_STORY_CONTEXT_URL,
  W3C_WEB_ANNOTATION_CONTEXT,
  type MangoViewerStateBody,
} from './storyAnnotationProfile';
import { buildChapterAnnotationId, deriveChapterAnnotationBase } from './publicIdentifiers';
import { translate } from '../core/i18n';
import { storyDrawingDocument } from './storyDrawingAnnotations';

export type SaveConfig = {
  endpoint?: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  enabled?: boolean;
  /** Host-owned persistence, for example IndexedDB or a native application store. */
  handler?: StorySaveHandler;
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
  partOf?: { id: string; type: 'Manifest' };
  selector?: StorySelector | StorySelector[];
  [key: string]: unknown;
};

export type StoryAnnotation = {
  id: string;
  type: 'Annotation';
  motivation: 'supplementing' | 'describing' | 'highlighting' | 'commenting';
  label?: Record<string, string[]>;
  summary?: Record<string, string[]>;
  stylesheet?: Record<string, unknown> | string | Array<Record<string, unknown> | string>;
  body?:
    | Record<string, unknown>
    | MangoViewerStateBody
    | Array<Record<string, unknown> | MangoViewerStateBody>;
  target: StoryTarget | string;
};

export type StoryAnnotationPage = {
  '@context': [
    typeof W3C_WEB_ANNOTATION_CONTEXT,
    typeof MANGO_STORY_CONTEXT_URL,
    typeof IIIF_PRESENTATION_3_CONTEXT,
  ];
  id: string;
  type: 'AnnotationPage';
  label: Record<string, string[]>;
  items: StoryAnnotation[];
};

export type SerializeStoryOptions = {
  /** Public HTTP(S) identifier for the exported AnnotationPage. */
  id?: string;
};

export type ExportEnvelope = StoryAnnotationPage;

export type SaveResult =
  { ok: true; message?: string } | { ok: false; message: string; code?: string };

export type StorySaveHandler = (
  payload: ExportEnvelope,
) => SaveResult | void | Promise<SaveResult | void>;

export type SaveState =
  | { status: 'idle'; message?: string; code?: string }
  | { status: 'saving'; message?: string; code?: string }
  | { status: 'success'; message?: string }
  | { status: 'error'; message?: string; code?: string };

const normaliseStoryFragment = (value: string): string => value.replace('xywh=pixel:', 'xywh=');

/**
 * The media fragment for a framing, written by the parser's selector codecs.
 *
 * Built from the selectors directly rather than from a whole annotation: a
 * story framing is not an annotation, and constructing one to read a string
 * back off it was how this ended up depending on the serializer's target shape.
 */
const serializeFragment = (rect?: RectGeometry, temporal?: TemporalFragment): string => {
  const shape: NeutralShape = rect ? { type: 'rect', geometry: rect } : { type: 'none' };
  const selectors = createSelectors(shape, temporal, '$.target.selector');
  return normaliseStoryFragment(
    selectors
      .map((selector) => selector.value)
      .filter(Boolean)
      .join('&'),
  );
};

const normaliseStoryTarget = (target: unknown): StoryTarget | string => {
  if (typeof target === 'string') return target;
  if (!target || typeof target !== 'object') return {};
  const record = target as StoryTarget;
  const selectors = Array.isArray(record.selector) ? record.selector : [record.selector];
  const normalized = selectors
    .filter((selector): selector is StorySelector => Boolean(selector))
    .map((selector) => ({
      ...selector,
      ...(typeof selector.value === 'string'
        ? { value: normaliseStoryFragment(selector.value) }
        : {}),
    }));
  return {
    ...record,
    selector: Array.isArray(record.selector) ? normalized : normalized[0],
  };
};

/**
 * Standards-shaped body and target for one story overlay.
 *
 * Story overlays go through the same builders as ordinary annotations so that a
 * drawing exported from a story and the same drawing exported from the editor
 * are byte-identical in their target. They were not, and a story drawing that
 * round-tripped through another viewer came back in a different place.
 */
const serializeOverlay = (input: {
  id: string;
  canvasId: string;
  shape: NeutralShape;
  text?: string;
  textBodies?: readonly {
    value: string;
    language?: string;
    purpose?: string;
  }[];
  motivation: string;
  bodyPurpose?: string;
  language?: string;
  styleClass?: string;
  stylesheet?: CanonicalStylesheet;
}): {
  body?: Record<string, unknown> | Array<Record<string, unknown>>;
  target: unknown;
  stylesheet?: Record<string, unknown> | string | Array<Record<string, unknown> | string>;
} => {
  const document = createMangoAnnotation({
    id: input.id,
    canvasId: input.canvasId,
    shape: input.shape,
    text: input.text,
    textBodies: input.textBodies,
    motivation: input.motivation,
    bodyPurpose: input.bodyPurpose,
    language: input.language,
    styleClass: input.styleClass,
    stylesheet: input.stylesheet,
  });
  const { json } = serializeWebAnnotation(document, { profile: 'iiif-presentation-3' });
  const body = json.body;
  return {
    body:
      body && typeof body === 'object'
        ? (body as Record<string, unknown> | Array<Record<string, unknown>>)
        : undefined,
    target: json.target,
    ...(json.stylesheet && typeof json.stylesheet === 'object'
      ? {
          stylesheet: json.stylesheet as
            | Record<string, unknown>
            | Array<Record<string, unknown> | string>,
        }
      : {}),
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

  const pageId = options.id ?? raw.id ?? 'urn:mango:draft:story';
  const exportStory: StoryState = options.id ? { ...raw, id: options.id } : raw;
  const annotationBase = deriveChapterAnnotationBase(exportStory);

  const items: StoryAnnotation[] = raw.chapters.flatMap((chapter, index) => {
    const chapterId = chapter.id || `chapter_${index + 1}`;
    const annotationId = annotationBase
      ? buildChapterAnnotationId(exportStory, chapterId)
      : `urn:mango:draft:annotation/${encodeURIComponent(chapterId)}`;

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
    const canvasId = chapter.canvasId || `${chapter.manifest}/canvas/${chapter.canvasIndex}`;

    let viewBoxValue: string | undefined;
    if (chapter.viewBox) {
      const vx = Math.round(Math.max(0, chapter.viewBox.x));
      const vy = Math.round(Math.max(0, chapter.viewBox.y));
      const vw = Math.round(chapter.viewBox.w);
      const vh = Math.round(chapter.viewBox.h);
      viewBoxValue = serializeFragment({ x: vx, y: vy, w: vw, h: vh });
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
      type: 'SpecificResource',
      partOf: {
        id: chapter.manifest,
        type: 'Manifest',
      },
      ...(selectorValue
        ? {
            selector: {
              type: 'FragmentSelector',
              conformsTo: 'http://www.w3.org/TR/media-frags/',
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
            type: 'Sound',
            format: 'audio/mp3',
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
          const placement = annotation.placement ?? chapter.annotationPlacement ?? {
            x: 0.33,
            y: 0.33,
            w: 0.34,
            h: 0.34,
          };
          const relativePlacement =
            placement.x <= 1 && placement.y <= 1 && placement.w <= 1 && placement.h <= 1;
          const resolvedPlacement =
            relativePlacement && chapter.viewBox
              ? {
                  x: chapter.viewBox.x + placement.x * chapter.viewBox.w,
                  y: chapter.viewBox.y + placement.y * chapter.viewBox.h,
                  w: placement.w * chapter.viewBox.w,
                  h: placement.h * chapter.viewBox.h,
                }
              : placement;
          const px = Number.isFinite(resolvedPlacement.x) ? Math.round(resolvedPlacement.x) : 0;
          const py = Number.isFinite(resolvedPlacement.y) ? Math.round(resolvedPlacement.y) : 0;
          const pw =
            Number.isFinite(resolvedPlacement.w) && resolvedPlacement.w > 0
              ? Math.max(1, Math.round(resolvedPlacement.w))
              : 1;
          const ph =
            Number.isFinite(resolvedPlacement.h) && resolvedPlacement.h > 0
              ? Math.max(1, Math.round(resolvedPlacement.h))
              : 1;
          const serializedText = serializeOverlay({
            id: `${annotationId}-${lang}`,
            canvasId,
            text: annotation.text,
            motivation: 'describing',
            bodyPurpose: 'describing',
            language: lang,
            shape: { type: 'rect', geometry: { x: px, y: py, w: pw, h: ph } },
          });
          overlayAnnotations.push({
            id: `${annotationId}/overlay/${encodeURIComponent(lang)}`,
            type: 'Annotation',
            motivation: 'describing',
            body: serializedText.body,
            target:
              relativePlacement && !chapter.viewBox
                ? {
                    source: canvasId,
                    type: 'SpecificResource',
                    selector: {
                      type: 'FragmentSelector',
                      conformsTo: 'http://www.w3.org/TR/media-frags/',
                      value: `xywh=percent:${placement.x * 100},${placement.y * 100},${placement.w * 100},${placement.h * 100}`,
                    },
                  }
                : normaliseStoryTarget(serializedText.target),
          });
        }
      }
    }

    // Drawing annotations are exported as standard Web Annotations so other
    // IIIF clients can consume their spatial targets without understanding the
    // Mango viewer-state extension used for exact story round-tripping.
    for (const drawing of chapter.drawingAnnotations ?? []) {
      const drawingId = `${annotationId}/overlay/drawing/${encodeURIComponent(drawing.id)}`;
      const document = storyDrawingDocument(drawing, canvasId, drawingId);
      if (!document) continue;
      const { json: serializedDrawing } = serializeWebAnnotation(document, {
        profile: 'iiif-presentation-3',
      });
      const textBody = serializedDrawing.body as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | undefined;
      const drawingStylesheet = serializedDrawing.stylesheet as
        | Record<string, unknown>
        | string
        | Array<Record<string, unknown> | string>
        | undefined;
      overlayAnnotations.push({
        id: drawingId,
        type: 'Annotation',
        motivation: document.motivation.includes('commenting')
          ? 'commenting'
          : 'highlighting',
        ...(textBody ? { body: textBody } : {}),
        ...(drawingStylesheet ? { stylesheet: drawingStylesheet } : {}),
        target: normaliseStoryTarget(serializedDrawing.target),
      });
    }

    bodyItems.push(
      createMangoViewerStateBody(
        { ...chapter, id: chapterId },
        raw.presentationAspect,
        annotationId,
      ),
    );

    const chapterAnnotation: StoryAnnotation = {
      id: annotationId,
      type: 'Annotation',
      motivation: 'supplementing',
      label: Object.keys(labelMap).length > 0 ? labelMap : undefined,
      summary: Object.keys(summaryMap).length > 0 ? summaryMap : undefined,
      body: bodyItems.length === 1 ? bodyItems[0] : bodyItems.length > 1 ? bodyItems : undefined,
      target,
    };
    return [chapterAnnotation, ...overlayAnnotations];
  });

  return {
    /*
     * The Web Annotation context makes nested SpecificResource and TextualBody
     * terms expand independently. Mango's own context sits between the two so
     * `mangoState` is defined as a JSON literal before IIIF's terms layer on,
     * and it is where the profile version is declared. IIIF remains last, as
     * Presentation 3 requires.
     */
    '@context': [
      W3C_WEB_ANNOTATION_CONTEXT,
      MANGO_STORY_CONTEXT_URL,
      IIIF_PRESENTATION_3_CONTEXT,
    ],
    id: pageId,
    type: 'AnnotationPage',
    label: Object.keys(label).length > 0 ? label : { en: [translate('storyBuilder.export.trackLabel')] },
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
      method: cfg.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.headers ?? {}),
      },
      credentials: cfg.credentials,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { ok: false, message: translate('storyBuilder.errors.saveStatus', { status: res.status }) };
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { ok: false, message: translate('storyBuilder.errors.invalidSaveResponse') };
    }

    const response =
      body && typeof body === 'object'
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
        message: typeof response.message === 'string' ? response.message : translate('storyBuilder.actions.saveSuccess'),
      };
    }

    return {
      ok: false,
      message:
        (typeof response.error?.message === 'string' && response.error.message) ||
        (typeof response.message === 'string' && response.message) ||
        translate('storyBuilder.actions.saveFailed'),
      code: typeof response.error?.code === 'string' ? response.error.code : undefined,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, message: translate('storyBuilder.errors.saveTimeout'), code: 'timeout' };
    }
    return { ok: false, message: translate('storyBuilder.errors.network'), code: 'network' };
  }
};

export const validateStoryForExport = (story: StoryState) => validateStory(story);

export type StoryStoreWrapper = {
  loadStory: (next: StoryState) => void;
  addChapterFromCapture: (payload: { capture: CapturePayload; id?: string }) => void;
  setNarrationTrack: (payload: { language: string; src: string }) => void;
  setChapterTitle: (payload: { chapterId: string; language: string; value: string }) => void;
  setChapterDescription: (payload: { chapterId: string; language: string; value: string }) => void;
  setNarrationSegment: (payload: {
    chapterId: string;
    language: string;
    start: number;
    end: number;
  }) => void;
  setAnnotationText: (payload: { chapterId: string; language: string; text: string }) => void;
  setAnnotationPlacement: (payload: {
    chapterId: string;
    language: string;
    placement: import('../core/types/story').AnnotationPlacement;
  }) => void;
  setAdvanceMode: (payload: {
    chapterId: string;
    mode: import('../core/types/story').ChapterAdvance['mode'];
  }) => void;
  setDelay: (payload: { chapterId: string; delayMs?: number }) => void;
};

export const loadStoryIntoStore = (
  storyToLoad: StoryState,
  storyStoreWrapper: StoryStoreWrapper,
): void => {
  storyStoreWrapper.loadStory({
    id: storyToLoad.id,
    publication: storyToLoad.publication,
    presentationAspect: storyToLoad.presentationAspect,
    title: storyToLoad.title,
    chapters: [],
  });

  if (storyToLoad.narration) {
    for (const [lang, track] of Object.entries(storyToLoad.narration.tracks || {})) {
      storyStoreWrapper.setNarrationTrack({ language: lang, src: track.src });
    }
  }

  for (const chapter of storyToLoad.chapters || []) {
    const capture: CapturePayload = {
      manifest: chapter.manifest || '',
      canvasIndex: chapter.canvasIndex || 0,
      canvasId: chapter.canvasId,
      viewBox: chapter.viewBox,
      model: chapter.model,
      modelOptions: chapter.modelOptions,
      media: chapter.media,
      layerOpacities: chapter.layerOpacities,
      entryTransition: chapter.entryTransition,
      presentationDurationMs: chapter.presentationDurationMs,
      transitionTimeMs: chapter.transitionTimeMs,
      cameraTrack: chapter.cameraTrack,
      drawingAnnotations: chapter.drawingAnnotations,
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
