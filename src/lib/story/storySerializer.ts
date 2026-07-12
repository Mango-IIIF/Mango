import { validateStory } from './validation';
import type { Story } from '../core/types/story';
import type { CapturePayload } from '../core/state/story.svelte';
import { W3CParser, type RectGeometry, type TemporalFragment } from '@mango-iiif/w3c-parser';

export type SaveConfig = {
  endpoint?: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  enabled?: boolean;
};

export type ExportEnvelope = {
  version: 1;
  exportedAt: string;
  meta: {
    source: 'storybuilder';
    appVersion?: string;
  };
  data: Story;
};

export type SaveResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; code?: string };

export type SaveState =
  | { status: 'idle'; message?: string; code?: string }
  | { status: 'saving'; message?: string; code?: string }
  | { status: 'success'; message?: string }
  | { status: 'error'; message?: string; code?: string };

const normaliseStoryFragment = (value: string): string =>
  value.replace('xywh=pixel:', 'xywh=');

const serializeFragment = (
  id: string,
  canvasId: string,
  rect?: RectGeometry,
  temporal?: TemporalFragment,
): string => {
  const annotation = W3CParser.serialize({
    id,
    canvasId,
    text: '',
    shape: rect ? { type: 'rect', geometry: rect } : { type: 'none' },
    temporal,
  });
  if (typeof annotation.target === 'string') return '';
  const selectors = Array.isArray(annotation.target.selector)
    ? annotation.target.selector
    : annotation.target.selector
      ? [annotation.target.selector]
      : [];
  return normaliseStoryFragment(
    selectors.map((selector) => selector.value).filter(Boolean).join('&'),
  );
};

const normaliseStoryTarget = (target: any): any => {
  if (!target || typeof target === 'string') return target;
  const selectors = Array.isArray(target.selector) ? target.selector : [target.selector];
  const normalized = selectors.filter(Boolean).map((selector: any) => ({
    ...selector,
    value: normaliseStoryFragment(selector.value),
  }));
  return {
    ...target,
    selector: Array.isArray(target.selector) ? normalized : normalized[0],
  };
};

export const serializeStoryToIiif = (raw: Story): any => {
  const label: Record<string, string[]> = {};
  if (raw.title) {
    for (const [lang, val] of Object.entries(raw.title)) {
      label[lang] = [val];
    }
  }

  const items = raw.chapters.map((chapter, index) => {
    const chapterId = chapter.id || `chapter_${index + 1}`;
    const annotationId = `https://example.org/stories/story-2/annotation/${chapterId}`;

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
    
    let viewBoxValue = 'xywh=0,0,0,0';
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

    const target: any = {
      source: sourceUrl,
      type: 'SpecificResource',
      partOf: {
        id: chapter.manifest,
        type: 'Manifest'
      },
      selector: {
        type: 'FragmentSelector',
        conformsTo: 'http://www.w3.org/TR/media-frags/',
        value: selectorValue
      }
    };

    // Build body list
    const bodyItems: any[] = [];

    // Add narration segment
    if (chapter.narrationSegment) {
      for (const [lang, segment] of Object.entries(chapter.narrationSegment)) {
        const track = raw.narration?.tracks?.[lang];
        if (track && track.src) {
          bodyItems.push({
            id: `${track.src}#t=${segment.start},${segment.end}`,
            type: 'Sound',
            format: 'audio/mp3',
            language: lang
          });
        }
      }
    }

    // Add annotations
    if (chapter.annotations) {
      for (const [lang, annotation] of Object.entries(chapter.annotations)) {
        if (annotation.text) {
          const placement = annotation.placement || { x: 4500, y: 6500, w: 800, h: 300 };
          const px = Number.isFinite(placement.x) ? Math.round(placement.x) : 4500;
          const py = Number.isFinite(placement.y) ? Math.round(placement.y) : 6500;
          const pw = Number.isFinite(placement.w) && placement.w > 0 ? Math.round(placement.w) : 800;
          const ph = Number.isFinite(placement.h) && placement.h > 0 ? Math.round(placement.h) : 300;
          const serializedText = W3CParser.serialize({
            id: `${annotationId}-${lang}`,
            canvasId,
            text: annotation.text,
            shape: {
              type: 'rect',
              geometry: { x: px, y: py, w: pw, h: ph },
            },
          });
          bodyItems.push({
            ...serializedText.body[0],
            purpose: 'describing',
            language: lang,
            target: normaliseStoryTarget(serializedText.target),
          });
        }
      }
    }

    return {
      id: annotationId,
      type: 'Annotation',
      motivation: 'supplementing',
      label: Object.keys(labelMap).length > 0 ? labelMap : undefined,
      summary: Object.keys(summaryMap).length > 0 ? summaryMap : undefined,
      transitionTimeMs: chapter.transitionTimeMs ?? 2000,
      body: bodyItems.length === 1 ? bodyItems[0] : (bodyItems.length > 1 ? bodyItems : undefined),
      target
    };
  });

  return {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: 'https://404mike.github.io/uv4-manifest/annotationList.json',
    type: 'AnnotationPage',
    label: Object.keys(label).length > 0 ? label : { en: ['Story Annotation Track'] },
    items
  };
};

export const buildExportEnvelope = (raw: Story): any => {
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
      return { ok: false, message: `Save failed (${res.status})` };
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { ok: false, message: 'Save failed (invalid JSON response)' };
    }

    const success = (body as any)?.success === true;
    if (success) {
      return { ok: true, message: (body as any)?.message ?? 'Saved successfully' };
    }

    return {
      ok: false,
      message: (body as any)?.error?.message || (body as any)?.message || 'Save failed',
      code: (body as any)?.error?.code,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, message: 'Save timed out', code: 'timeout' };
    }
    return { ok: false, message: 'Could not reach server', code: 'network' };
  }
};

export const validateStoryForExport = (story: Story) => validateStory(story);

export type StoryStoreWrapper = {
  loadStory: (next: Story) => void;
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
    placement: any;
  }) => void;
  setAdvanceMode: (payload: { chapterId: string; mode: any }) => void;
  setDelay: (payload: { chapterId: string; delayMs?: number }) => void;
};

export const loadStoryIntoStore = (
  storyToLoad: Story,
  storyStoreWrapper: StoryStoreWrapper,
): void => {
  storyStoreWrapper.loadStory({
    version: '1.0',
    type: 'story',
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
      media: chapter.media,
      layerOpacities: chapter.layerOpacities,
    };

    storyStoreWrapper.addChapterFromCapture({ capture, id: chapter.id });

    if (chapter.title) {
      for (const [lang, value] of Object.entries(chapter.title)) {
        storyStoreWrapper.setChapterTitle({ chapterId: chapter.id, language: lang, value });
      }
    }

    if (chapter.description) {
      for (const [lang, value] of Object.entries(chapter.description)) {
        storyStoreWrapper.setChapterDescription({ chapterId: chapter.id, language: lang, value });
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
      storyStoreWrapper.setAdvanceMode({ chapterId: chapter.id, mode: chapter.advance.mode });
    }

    if (chapter.transitionTimeMs !== undefined) {
      storyStoreWrapper.setDelay({ chapterId: chapter.id, delayMs: chapter.transitionTimeMs });
    }
  }
};
