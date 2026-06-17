import { validateStory } from './validation';
import type { Story } from '../core/types/story';
import type { CapturePayload } from '../core/state/story.svelte';

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

export const buildExportEnvelope = (
  raw: Story,
  appVersion?: string,
): ExportEnvelope => {
  const mapped = {
    ...raw,
    chapters: raw.chapters.map((chapter, index) => {
      const { advance, annotationPlacement, annotations, ...rest } = chapter as any;
      const transitionTimeMs = advance?.delayMs;
      const next: any = { ...rest, id: `chapter_${index + 1}` };
      const mergedAnnotations = { ...(annotations ?? {}) };

      if (annotationPlacement) {
        for (const lang of Object.keys(mergedAnnotations)) {
          mergedAnnotations[lang] = {
            ...(mergedAnnotations[lang] ?? {}),
            placement: mergedAnnotations[lang]?.placement ?? annotationPlacement,
          };
        }
        if (Object.keys(mergedAnnotations).length === 0) {
          mergedAnnotations._default = { placement: annotationPlacement };
        }
      }

      if (Object.keys(mergedAnnotations).length > 0) {
        next.annotations = mergedAnnotations;
      }
      if (transitionTimeMs !== undefined) {
        next.transitionTimeMs = transitionTimeMs;
      }
      return next;
    }),
  };

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    meta: {
      source: 'storybuilder',
      ...(appVersion ? { appVersion } : {}),
    },
    data: mapped as Story,
  };
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
