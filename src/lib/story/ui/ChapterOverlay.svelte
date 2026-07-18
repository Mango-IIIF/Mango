<script lang="ts">
  import { onDestroy } from 'svelte';
  import { readable, type Readable } from 'svelte/store';
  import type { AnnotationPlacement, ChapterAdvance, Story } from '../../core/types/story';
  import type { MediaType, MediaSource } from '../../iiif/mediaResolver';
  import type { MediaMarksState } from '../mediaMarks';
  import {
    coerceAnnotationPlacement,
    cloneAnnotationPlacement,
    DEFAULT_ANNOTATION_PLACEMENT,
  } from '../annotationPlacement';
  import ChapterTimelineSection from './ChapterTimelineSection.svelte';
  import ChapterTextForm from './ChapterTextForm.svelte';
  import ChapterCameraConfig from './ChapterCameraConfig.svelte';

  export let story: Readable<Story>;
  export let layers: MediaSource[] = [];
  export let layerOpacities: Record<string, number> = {};
  export let onUpdateLayerOpacity: ((id: string, opacity: number) => void) | undefined = undefined;

  let manifestSupportsLayers = false;
  $: manifestSupportsLayers = layers.length > 1 && layers.every((src) => src.type === 'image');

  export let open = false;
  export let chapterId: string | null = null;
  export let mediaType: Readable<MediaType | null>;
  export let mediaMarks: Readable<MediaMarksState> = readable({
    lastTime: 0,
    markIn: null,
    markOut: null,
  });
  export let avMarksValid: Readable<boolean> = readable(true);
  export let language = 'en';
  export let languages: string[] = ['en'];
  export let currentManifest: string | null = null;
  export let onClose: (() => void) | undefined;
  export let onSetMediaMarks:
    | ((start: number | null, end: number | null) => void)
    | undefined;
  export let onPreviewMediaSegment: (() => void) | undefined;
  export let onStopPreviewMediaSegment: (() => void) | undefined;
  export let onSetNarrationTrack:
    | ((lang: string, src: string) => void)
    | undefined;
  export let onAssignSegment:
    | ((lang: string, start: number, end: number) => void)
    | undefined;
  export let onSetAnnotationLanguage:
    | ((lang: string) => void)
    | undefined;
  export let onUpdateManifest:
    | ((chapterId: string, manifest: string) => void)
    | undefined;
  export let onLoadManifest: ((manifest: string) => void) | undefined;
  export let onReloadManifest:
    | ((chapterId: string, manifest: string, canvasIndex: number) => void)
    | undefined;
  export let onUpdateChapterTitle:
    | ((chapterId: string, lang: string, value: string) => void)
    | undefined;
  export let onUpdateChapterDescription:
    | ((chapterId: string, lang: string, value: string) => void)
    | undefined;
  export let onUpdateAnnotationText:
    | ((chapterId: string, lang: string, text: string) => void)
    | undefined;
  export let onUpdateAnnotationPlacement:
    | ((chapterId: string, lang: string, placement: AnnotationPlacement) => void)
    | undefined;
  export let onUpdateAdvanceMode:
    | ((chapterId: string, mode: ChapterAdvance['mode']) => void)
    | undefined;
  export let onUpdateDelay: ((chapterId: string, delayMs?: number) => void) | undefined;
  export let onUpdateChapterPosition: ((chapterId: string) => void) | undefined;
  export let onSave: (() => void) | undefined;
  export let onSetAnnotationPositioning: ((lang: string) => void) | undefined = undefined;

  let activeLanguage = language;
  let lastLanguageProp = language;
  let chapter: Story['chapters'][number] | null = null;
  let chapterTitleDraft = '';

  const handleSetPositionClick = () => {
    onSetAnnotationPositioning?.(activeLanguage);
  };
  let chapterDescriptionDraft = '';
  let chapterTitleDrafts: Record<string, string> = {};
  let chapterDescriptionDrafts: Record<string, string> = {};
  let manifestDraft = '';
  let annotationDraft = '';
  let annotationDrafts: Record<string, string> = {};
  let placementDraft: AnnotationPlacement = cloneAnnotationPlacement(
    DEFAULT_ANNOTATION_PLACEMENT,
  );
  let advanceModeDraft: ChapterAdvance['mode'] = 'manual';
  let delayDraft: number | undefined = 2000;
  let lastChapterId: string | null = null;
  let lastCurrentManifest: string | null = null;
  let pendingDraftApply = false;
  let saveDisabled = false;
  let markInDraft = '';
  let markOutDraft = '';
  let lastMarksApplied: { markIn: number | null; markOut: number | null } = {
    markIn: null,
    markOut: null,
  };
  let currentMarks: MediaMarksState = { lastTime: 0, markIn: null, markOut: null };
  let hasAvMedia = false;
  let marksValid = true;
  let mediaTypeValue: MediaType | null = null;

  let fallbackPlacement: AnnotationPlacement | undefined;
  let placementValue: AnnotationPlacement | null = cloneAnnotationPlacement(
    DEFAULT_ANNOTATION_PLACEMENT,
  );
  let advanceMode: ChapterAdvance['mode'] = 'manual';
  let delayMs: number | undefined;

  let narrationUrls: Record<string, string> = {};
  let narrationStartDrafts: Record<string, string> = {};
  let narrationEndDrafts: Record<string, string> = {};
  let narrationLastTimes: Record<string, number> = {};
  let narrationAudioRefs: Record<string, HTMLAudioElement | null> = {};
  let currentNarrationAudioRef: HTMLAudioElement | null = null;
  let lastNarrationChapterId: string | null = null;
  let lastActiveLanguage = activeLanguage;
  let hasAnyNarration = false;

  let narrationWaveforms: Record<string, number[]> = {};
  let narrationWaveformUrls: Record<string, string> = {};
  let narrationDurations: Record<string, number> = {};
  let narrationWaveLoading: Record<string, boolean> = {};
  let narrationWaveCanvas: HTMLCanvasElement | null = null;
  let narrationWaveRequestToken = 0;
  let narrationWaveResizeTarget: HTMLCanvasElement | null = null;
  let narrationWaveResizeObserver: ResizeObserver | null = null;
  let narrationWaveDrawRaf = 0;

  let narrationPreviewing = false;
  let narrationPreviewLanguage: string | null = null;
  let detachNarrationPreviewStop: (() => void) | null = null;

  let activeNarrationUrl = '';
  let activeNarrationStartDraft = '';
  let activeNarrationEndDraft = '';
  let activeNarrationWave: number[] = [];
  let activeNarrationWaveLoading = false;
  let activeNarrationDurationSec = 0;
  let activeNarrationStartSec = 0;
  let activeNarrationEndSec = 0;
  let activeNarrationStartRatio = 0;
  let activeNarrationEndRatio = 0;
  let activeNarrationOverlayStyle = '--start-ratio:0; --end-ratio:0;';
  let metadataSectionCollapsed = false;
  let narrationSectionCollapsed = false;
  let avSectionCollapsed = false;
  let annotationSectionCollapsed = false;
  let transitionSectionCollapsed = false;
  let lastSectionSyncKey = '';

  $: if (currentNarrationAudioRef) {
    narrationAudioRefs[activeLanguage] = currentNarrationAudioRef;
  }

  $: if (language !== lastLanguageProp) {
    lastLanguageProp = language;
    activeLanguage = language;
    onSetAnnotationLanguage?.(language);
  }

  $: if (activeLanguage !== lastActiveLanguage) {
    const activeChapter = $story.chapters.find((item) => item.id === chapterId);
    const nextAnnotation =
      activeChapter?.annotations?.[activeLanguage]?.text ??
      annotationDrafts[activeLanguage] ??
      '';
    const nextTitle =
      activeChapter?.title?.[activeLanguage] ??
      chapterTitleDrafts[activeLanguage] ??
      '';
    const nextDescription =
      activeChapter?.description?.[activeLanguage] ??
      chapterDescriptionDrafts[activeLanguage] ??
      '';

    annotationDraft = nextAnnotation;
    annotationDrafts[activeLanguage] = nextAnnotation;
    chapterTitleDraft = nextTitle;
    chapterDescriptionDraft = nextDescription;
    chapterTitleDrafts[activeLanguage] = nextTitle;
    chapterDescriptionDrafts[activeLanguage] = nextDescription;
    narrationLastTimes[activeLanguage] = 0;

    lastActiveLanguage = activeLanguage;
    onSetAnnotationLanguage?.(activeLanguage);
  }

  const formatHms = (value: number | null | undefined): string => {
    if (!Number.isFinite(value ?? NaN)) return '';
    const total = Math.max(0, Math.floor(value as number));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  };

  const parseHms = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(':').map((entry) => Number(entry));
    if (parts.some((entry) => Number.isNaN(entry) || entry < 0)) return null;
    if (parts.length > 3) return null;
    const [a = 0, b = 0, c = 0] =
      parts.length === 3 ? parts : parts.length === 2 ? [0, parts[0], parts[1]] : [0, 0, parts[0]];
    const totalSeconds = a * 3600 + b * 60 + c;
    return Number.isFinite(totalSeconds) ? totalSeconds : null;
  };

  const hasTextValue = (value: string | null | undefined): boolean => {
    return (value ?? '').trim().length > 0;
  };

  const hasValidRange = (startValue: string, endValue: string): boolean => {
    const start = parseHms(startValue);
    const end = parseHms(endValue);
    return start != null && end != null && end > start;
  };

  const formatTimestamp = (value: number, withFraction = false): string => {
    if (!Number.isFinite(value) || value < 0) return '0:00';
    const safe = Math.max(0, value);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = Math.floor(safe % 60);
    const hundredths = Math.floor((safe - Math.floor(safe)) * 100);

    if (hours > 0) {
      if (withFraction) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
      }
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    if (withFraction) {
      return `${minutes}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const applyMarkDrafts = (markIn: number | null, markOut: number | null) => {
    lastMarksApplied = { markIn, markOut };
    markInDraft = formatHms(markIn);
    markOutDraft = formatHms(markOut);
  };

  const commitMediaMarks = () => {
    const start = parseHms(markInDraft);
    const end = parseHms(markOutDraft);
    onSetMediaMarks?.(start, end);
  };

  const useCurrentTime = (target: 'in' | 'out') => {
    const state = $mediaMarks;
    const time = Number.isFinite(state.lastTime) ? state.lastTime : null;
    if (target === 'in') {
      onSetMediaMarks?.(time, state.markOut);
    } else {
      onSetMediaMarks?.(state.markIn, time);
    }
  };

  const getNarrationTrack = (lang: string): string => {
    return $story.narration?.tracks?.[lang]?.src ?? '';
  };

  const applyNarrationDrafts = (lang: string, start: number | null, end: number | null) => {
    narrationStartDrafts[lang] = formatHms(start);
    narrationEndDrafts[lang] = formatHms(end);
  };

  const commitNarrationMarks = (lang: string) => () => {
    const start = parseHms(narrationStartDrafts[lang] ?? '');
    const end = parseHms(narrationEndDrafts[lang] ?? '');
    if (start != null && end != null && end > start && chapterId) {
      onAssignSegment?.(lang, start, end);
    }
  };

  const updateNarrationFromState = (lang: string) => {
    narrationUrls[lang] = getNarrationTrack(lang);
    const chapterSegment = $story.chapters
      .find((item) => item.id === chapterId)
      ?.narrationSegment?.[lang];
    applyNarrationDrafts(lang, chapterSegment?.start ?? null, chapterSegment?.end ?? null);
  };

  const narrationCurrentTime = (lang: string): number => {
    const ref = narrationAudioRefs[lang];
    if (ref && ref.isConnected && Number.isFinite(ref.currentTime) && ref.readyState >= 1) {
      return ref.currentTime;
    }
    return narrationLastTimes[lang] ?? 0;
  };

  const handleNarrationLoadedMetadata = (lang: string) => () => {
    const ref = narrationAudioRefs[lang];
    if (ref && Number.isFinite(ref.duration)) {
      narrationDurations = {
        ...narrationDurations,
        [lang]: ref.duration,
      };
    }
  };

  const handleNarrationTimeUpdate = (lang: string) => () => {
    const ref = narrationAudioRefs[lang];
    if (ref && ref.isConnected && Number.isFinite(ref.currentTime)) {
      narrationLastTimes[lang] = ref.currentTime;
    }
  };

  const useNarrationCurrentTime = (lang: string, target: 'start' | 'end') => () => {
    const time = narrationCurrentTime(lang);
    if (!Number.isFinite(time)) return;
    if (target === 'start') {
      narrationStartDrafts[lang] = formatHms(time);
    } else {
      narrationEndDrafts[lang] = formatHms(time);
    }
    commitNarrationMarks(lang)();
  };

  const hasValidNarrationSegment = (lang: string): boolean => {
    const start = parseHms(narrationStartDrafts[lang] ?? '');
    const end = parseHms(narrationEndDrafts[lang] ?? '');
    return start != null && end != null && end > start;
  };

  const createWaveformBins = (buffer: AudioBuffer, bins = 160): number[] => {
    const channel = buffer.getChannelData(0);
    if (!channel || channel.length === 0) return [];

    const points: number[] = [];
    const blockSize = Math.max(1, Math.floor(channel.length / bins));

    for (let i = 0; i < bins; i += 1) {
      const start = i * blockSize;
      const end = Math.min(channel.length, start + blockSize);
      let peak = 0;
      for (let j = start; j < end; j += 1) {
        const amplitude = Math.abs(channel[j] ?? 0);
        if (amplitude > peak) peak = amplitude;
      }
      points.push(peak);
    }

    const max = Math.max(...points, 0.0001);
    return points.map((value) => Math.max(0.08, value / max));
  };

  const createFallbackWaveform = (seedText: string, bins = 160): number[] => {
    let seed = 0;
    for (const char of seedText) {
      seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
    }
    let state = seed || 1;

    return Array.from({ length: bins }, (_, index) => {
      state = (state * 1664525 + 1013904223) >>> 0;
      const rand = state / 4294967296;
      const harmonic = Math.abs(Math.sin(index * 0.21 + rand * 6.2));
      return 0.16 + harmonic * 0.74;
    });
  };

  const ensureNarrationWaveform = async (lang: string, url: string): Promise<void> => {
    if (!url.trim()) return;
    if (narrationWaveformUrls[lang] === url && (narrationWaveforms[lang]?.length ?? 0) > 0) {
      return;
    }

    const token = ++narrationWaveRequestToken;
    narrationWaveLoading = {
      ...narrationWaveLoading,
      [lang]: true,
    };

    try {
      let bars: number[] | null = null;
      let duration: number | null = null;

      if (typeof window !== 'undefined' && typeof fetch === 'function') {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const bytes = await response.arrayBuffer();
        const AudioContextCtor =
          window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

        if (AudioContextCtor) {
          const context = new AudioContextCtor();
          try {
            const buffer = await context.decodeAudioData(bytes.slice(0));
            bars = createWaveformBins(buffer);
            duration = buffer.duration;
          } finally {
            void context.close();
          }
        }
      }

      if (!bars || bars.length === 0) {
        bars = createFallbackWaveform(url);
      }

      if (token !== narrationWaveRequestToken) return;

      narrationWaveforms = {
        ...narrationWaveforms,
        [lang]: bars,
      };
      narrationWaveformUrls = {
        ...narrationWaveformUrls,
        [lang]: url,
      };

      if (duration && Number.isFinite(duration)) {
        narrationDurations = {
          ...narrationDurations,
          [lang]: duration,
        };
      }
    } catch {
      if (token !== narrationWaveRequestToken) return;
      narrationWaveforms = {
        ...narrationWaveforms,
        [lang]: createFallbackWaveform(url),
      };
      narrationWaveformUrls = {
        ...narrationWaveformUrls,
        [lang]: url,
      };
    } finally {
      if (token !== narrationWaveRequestToken) return;
      narrationWaveLoading = {
        ...narrationWaveLoading,
        [lang]: false,
      };
    }
  };

  const drawNarrationWaveform = (
    canvas: HTMLCanvasElement | null,
    wave: number[],
    duration: number,
    start: number,
    end: number,
  ) => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = Math.floor(canvas.clientWidth);
    const height = Math.floor(canvas.clientHeight);
    if (width <= 1 || height <= 1) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const bars = wave.length > 0 ? wave : createFallbackWaveform('placeholder', 120);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(0, 0, width, height);

    const barWidth = width / bars.length;
    const centre = height / 2;

    for (let i = 0; i < bars.length; i += 1) {
      const value = Math.max(0.05, Math.min(1, bars[i] ?? 0.05));
      const x = i * barWidth;
      const barHeight = value * (height * 0.88);
      const y = centre - barHeight / 2;
      ctx.fillStyle = 'rgba(87, 158, 255, 0.72)';
      ctx.fillRect(x, y, Math.max(1, barWidth * 0.7), barHeight);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.moveTo(0, centre);
    ctx.lineTo(width, centre);
    ctx.stroke();
  };

  const disconnectNarrationWaveResizeObserver = () => {
    narrationWaveResizeObserver?.disconnect();
    narrationWaveResizeObserver = null;
    narrationWaveResizeTarget = null;
  };

  const cancelNarrationWaveDraw = () => {
    if (narrationWaveDrawRaf) {
      cancelAnimationFrame(narrationWaveDrawRaf);
      narrationWaveDrawRaf = 0;
    }
  };

  const scheduleNarrationWaveDraw = (
    wave: number[] = activeNarrationWave,
    duration: number = activeNarrationDurationSec,
    start: number = activeNarrationStartSec,
    end: number = activeNarrationEndSec,
    canvas: HTMLCanvasElement | null = narrationWaveCanvas,
  ) => {
    if (typeof window === 'undefined') return;
    cancelNarrationWaveDraw();
    narrationWaveDrawRaf = window.requestAnimationFrame(() => {
      narrationWaveDrawRaf = 0;
      drawNarrationWaveform(
        canvas,
        wave,
        duration,
        start,
        end,
      );
    });
  };

  const clearNarrationPreviewListener = () => {
    detachNarrationPreviewStop?.();
    detachNarrationPreviewStop = null;
  };

  const stopNarrationSegmentPlayback = (lang?: string) => {
    const key = lang ?? narrationPreviewLanguage;
    if (!key) return;

    const ref = narrationAudioRefs[key];
    ref?.pause();

    clearNarrationPreviewListener();
    narrationPreviewLanguage = null;
    narrationPreviewing = false;
  };

  const startNarrationSegmentPlayback = (lang: string) => {
    const ref = narrationAudioRefs[lang];
    if (!ref || !ref.isConnected || ref.readyState < 1) return;

    const start = parseHms(narrationStartDrafts[lang] ?? '');
    const end = parseHms(narrationEndDrafts[lang] ?? '');
    if (start == null || end == null || end <= start) return;

    stopNarrationSegmentPlayback();

    ref.currentTime = start;
    narrationPreviewLanguage = lang;
    narrationPreviewing = true;

    const stopAt = end;
    const onTimeUpdate = () => {
      if (!ref.isConnected) return;
      if (ref.currentTime >= stopAt) {
        stopNarrationSegmentPlayback(lang);
      }
    };

    ref.addEventListener('timeupdate', onTimeUpdate);
    detachNarrationPreviewStop = () => {
      ref.removeEventListener('timeupdate', onTimeUpdate);
    };

    void ref.play();
  };

  const previewNarrationSegment = (lang: string) => () => {
    startNarrationSegmentPlayback(lang);
  };

  const toggleNarrationSegmentPlayback = (lang: string) => () => {
    if (narrationPreviewing && narrationPreviewLanguage === lang) {
      stopNarrationSegmentPlayback(lang);
      return;
    }
    startNarrationSegmentPlayback(lang);
  };

  const updateNarrationRangeFromSlider = (target: 'start' | 'end', rawValue: number) => {
    const duration = Math.max(0, activeNarrationDurationSec);
    const minGap = duration > 1 ? 1 : 0;
    const safeStart = parseHms(activeNarrationStartDraft) ?? 0;
    const safeEnd = parseHms(activeNarrationEndDraft) ?? duration;

    if (target === 'start') {
      const maxStart = Math.max(0, safeEnd - minGap);
      const next = Math.max(0, Math.min(maxStart, rawValue));
      narrationStartDrafts = {
        ...narrationStartDrafts,
        [activeLanguage]: formatHms(next),
      };
    } else {
      const minEnd = Math.max(0, safeStart + minGap);
      const next = Math.max(minEnd, Math.min(duration, rawValue));
      narrationEndDrafts = {
        ...narrationEndDrafts,
        [activeLanguage]: formatHms(next),
      };
    }

    commitNarrationMarks(activeLanguage)();
  };

  const handleNarrationStartRangeInput = (event: Event) => {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    updateNarrationRangeFromSlider('start', value);
  };

  const handleNarrationEndRangeInput = (event: Event) => {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    updateNarrationRangeFromSlider('end', value);
  };

  const syncNarrationWaveResizeObserver = () => {
    if (typeof ResizeObserver === 'undefined') return;
    if (narrationWaveResizeTarget === narrationWaveCanvas) return;

    disconnectNarrationWaveResizeObserver();
    if (!narrationWaveCanvas) return;

    narrationWaveResizeTarget = narrationWaveCanvas;
    narrationWaveResizeObserver = new ResizeObserver(() => {
      scheduleNarrationWaveDraw(
        activeNarrationWave,
        activeNarrationDurationSec,
        activeNarrationStartSec,
        activeNarrationEndSec,
        narrationWaveCanvas,
      );
    });
    narrationWaveResizeObserver.observe(narrationWaveCanvas);
    scheduleNarrationWaveDraw(
      activeNarrationWave,
      activeNarrationDurationSec,
      activeNarrationStartSec,
      activeNarrationEndSec,
      narrationWaveCanvas,
    );
  };

  $: if (activeNarrationUrl) {
    void ensureNarrationWaveform(activeLanguage, activeNarrationUrl);
  }

  $: if (!open && narrationPreviewing) {
    stopNarrationSegmentPlayback();
  }

  $: if (
    narrationPreviewing &&
    narrationPreviewLanguage &&
    narrationPreviewLanguage !== activeLanguage
  ) {
    stopNarrationSegmentPlayback(narrationPreviewLanguage);
  }

  $: syncNarrationWaveResizeObserver();
  $: if (open) {
    scheduleNarrationWaveDraw(
      activeNarrationWave,
      activeNarrationDurationSec,
      activeNarrationStartSec,
      activeNarrationEndSec,
      narrationWaveCanvas,
    );
  }

  $: chapter = $story.chapters.find((item) => item.id === chapterId) ?? null;

  $: if (chapterId !== lastChapterId) {
    lastChapterId = chapterId;
    manifestDraft = chapter?.manifest ?? '';

    chapterTitleDrafts = {};
    if (chapter?.title) {
      for (const [lang, value] of Object.entries(chapter.title)) {
        chapterTitleDrafts[lang] = value ?? '';
      }
    }

    chapterDescriptionDrafts = {};
    if (chapter?.description) {
      for (const [lang, value] of Object.entries(chapter.description)) {
        chapterDescriptionDrafts[lang] = value ?? '';
      }
    }

    chapterTitleDraft = chapterTitleDrafts[activeLanguage] ?? '';
    chapterDescriptionDraft = chapterDescriptionDrafts[activeLanguage] ?? '';

    annotationDrafts = {};
    if (chapter?.annotations) {
      for (const [lang, entry] of Object.entries(chapter.annotations)) {
        annotationDrafts[lang] = entry?.text ?? '';
      }
    }

    annotationDraft = annotationDrafts[activeLanguage] ?? '';

    const activePlacement = coerceAnnotationPlacement(chapter?.annotations?.[activeLanguage]?.placement);
    const chapterPlacementFallback = Object.values(chapter?.annotations ?? {})
      .map((entry) => coerceAnnotationPlacement(entry?.placement))
      .find((entry): entry is AnnotationPlacement => Boolean(entry));

    placementDraft =
      activePlacement ??
      coerceAnnotationPlacement(chapter?.annotationPlacement) ??
      chapterPlacementFallback ??
      cloneAnnotationPlacement(DEFAULT_ANNOTATION_PLACEMENT);

    advanceModeDraft = chapter?.advance?.mode ?? advanceModeDraft ?? 'manual';
    delayDraft =
      chapter?.advance?.delayMs ?? (delayDraft === undefined ? 2000 : delayDraft);

    if (!chapter && currentManifest && manifestDraft.trim() === '') {
      manifestDraft = currentManifest;
      lastCurrentManifest = currentManifest;
    }

    const marks = $mediaMarks;
    applyMarkDrafts(
      chapter?.media?.start ?? marks.markIn ?? null,
      chapter?.media?.end ?? marks.markOut ?? null,
    );
  }

  $: if (chapter && chapterId === lastChapterId) {
    const nextManifest = chapter.manifest ?? '';
    if (manifestDraft !== nextManifest) {
      manifestDraft = nextManifest;
    }

    const nextTitle = chapter.title?.[activeLanguage] ?? '';
    if (chapterTitleDraft !== nextTitle) {
      chapterTitleDraft = nextTitle;
    }
    chapterTitleDrafts[activeLanguage] = nextTitle;

    const nextDescription = chapter.description?.[activeLanguage] ?? '';
    if (chapterDescriptionDraft !== nextDescription) {
      chapterDescriptionDraft = nextDescription;
    }
    chapterDescriptionDrafts[activeLanguage] = nextDescription;

    const nextText = chapter.annotations?.[activeLanguage]?.text ?? '';
    if (annotationDraft !== nextText) {
      annotationDraft = nextText;
    }
    annotationDrafts[activeLanguage] = nextText;

    const activePlacement = coerceAnnotationPlacement(chapter.annotations?.[activeLanguage]?.placement);
    const nextPlacement =
      activePlacement ??
      coerceAnnotationPlacement(chapter.annotationPlacement) ??
      fallbackPlacement ??
      cloneAnnotationPlacement(DEFAULT_ANNOTATION_PLACEMENT);
    if (
      placementDraft.x !== nextPlacement.x ||
      placementDraft.y !== nextPlacement.y ||
      placementDraft.w !== nextPlacement.w ||
      placementDraft.h !== nextPlacement.h
    ) {
      placementDraft = nextPlacement;
    }

    if (chapter.advance?.mode && advanceModeDraft !== chapter.advance.mode) {
      advanceModeDraft = chapter.advance.mode;
    }

    if (chapter.advance?.delayMs !== undefined && delayDraft !== chapter.advance.delayMs) {
      delayDraft = chapter.advance.delayMs;
    }
  }

  $: if (!chapter && currentManifest && currentManifest !== lastCurrentManifest) {
    if (manifestDraft.trim() === '' || manifestDraft === lastCurrentManifest) {
      manifestDraft = currentManifest;
      lastCurrentManifest = currentManifest;
    }
  }

  $: if (!chapter) {
    chapterTitleDraft = chapterTitleDrafts[activeLanguage] ?? '';
    chapterDescriptionDraft = chapterDescriptionDrafts[activeLanguage] ?? '';
    annotationDraft = annotationDrafts[activeLanguage] ?? '';
  }

  $: if (chapterId !== lastNarrationChapterId) {
    lastNarrationChapterId = chapterId;
    stopNarrationSegmentPlayback();
    for (const lang of languages) {
      updateNarrationFromState(lang);
    }
  }

  const applyDrafts = (targetId: string) => {
    if (manifestDraft.trim()) {
      onUpdateManifest?.(targetId, manifestDraft.trim());
    }

    for (const [lang, value] of Object.entries(chapterTitleDrafts)) {
      onUpdateChapterTitle?.(targetId, lang, value);
    }

    for (const [lang, value] of Object.entries(chapterDescriptionDrafts)) {
      onUpdateChapterDescription?.(targetId, lang, value);
    }

    for (const [lang, text] of Object.entries(annotationDrafts)) {
      if (text.trim()) {
        onUpdateAnnotationText?.(targetId, lang, text);
      }
    }

    onUpdateAnnotationPlacement?.(targetId, activeLanguage, placementDraft);
    onUpdateAdvanceMode?.(targetId, advanceModeDraft);
    onUpdateDelay?.(targetId, delayDraft);
  };

  $: if (pendingDraftApply && chapterId && chapter) {
    pendingDraftApply = false;
    applyDrafts(chapterId);
  }

  $: fallbackPlacement = Object.values(chapter?.annotations ?? {})
    .map((entry) => coerceAnnotationPlacement(entry?.placement))
    .find((entry): entry is AnnotationPlacement => Boolean(entry));
  $: placementValue = cloneAnnotationPlacement(placementDraft);
  $: advanceMode = advanceModeDraft;
  $: delayMs = delayDraft;
  $: saveDisabled = !chapterId || !chapter;

  const handleManifestInput = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    manifestDraft = value;
    if (chapterId) {
      onUpdateManifest?.(chapterId, value);
    }
  };

  const handleReload = () => {
    if (!manifestDraft.trim()) return;
    if (!chapterId || !chapter) {
      onLoadManifest?.(manifestDraft);
      return;
    }
    onReloadManifest?.(chapterId, manifestDraft, chapter.canvasIndex);
  };

  const handleAnnotationInput = (event: Event) => {
    const value = (event.target as HTMLTextAreaElement).value;
    annotationDraft = value;
    annotationDrafts[activeLanguage] = value;
    if (chapterId) {
      onUpdateAnnotationText?.(chapterId, activeLanguage, value);
    }
  };

  const handleChapterTitleInput = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    chapterTitleDraft = value;
    chapterTitleDrafts[activeLanguage] = value;
    if (chapterId) {
      onUpdateChapterTitle?.(chapterId, activeLanguage, value);
    }
  };

  const handleChapterDescriptionInput = (event: Event) => {
    const value = (event.target as HTMLTextAreaElement).value;
    chapterDescriptionDraft = value;
    chapterDescriptionDrafts[activeLanguage] = value;
    if (chapterId) {
      onUpdateChapterDescription?.(chapterId, activeLanguage, value);
    }
  };

  const handlePlacementChange = (value: AnnotationPlacement) => {
    placementDraft = value;
  };

  const handlePlacementCommit = (value: AnnotationPlacement) => {
    placementDraft = value;
    if (!chapterId) return;
    onUpdateAnnotationPlacement?.(chapterId, activeLanguage, value);
  };

  const handleDelaySecondsChange = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    const seconds = value === '' ? undefined : Number(value);
    const ms =
      seconds === undefined || !Number.isFinite(seconds) ? undefined : (seconds as number) * 1000;
    delayDraft = ms;
    advanceModeDraft = delayDraft !== undefined ? 'auto' : 'manual';
    if (chapterId) {
      onUpdateAdvanceMode?.(chapterId, advanceModeDraft);
      onUpdateDelay?.(chapterId, ms);
    }
  };

  const handleSave = () => {
    if (!chapterId || !chapter) return;
    commitMediaMarks();
    onUpdateChapterPosition?.(chapterId);
    applyDrafts(chapterId);
    onSave?.();
  };

  $: mediaTypeValue = $mediaType;
  $: hasAvMedia = mediaTypeValue === 'audio' || mediaTypeValue === 'video';
  $: marksValid = $avMarksValid;
  $: currentMarks = $mediaMarks;

  $: if (
    currentMarks.markIn !== lastMarksApplied.markIn ||
    currentMarks.markOut !== lastMarksApplied.markOut
  ) {
    applyMarkDrafts(currentMarks.markIn, currentMarks.markOut);
  }

  $: hasAnyNarration = Object.values(narrationUrls).some((url) => url && url !== '');

  $: activeNarrationUrl = narrationUrls[activeLanguage] ?? '';
  $: activeNarrationStartDraft = narrationStartDrafts[activeLanguage] ?? '';
  $: activeNarrationEndDraft = narrationEndDrafts[activeLanguage] ?? '';

  $: activeNarrationWave = narrationWaveforms[activeLanguage] ?? [];
  $: activeNarrationWaveLoading = narrationWaveLoading[activeLanguage] ?? false;

  $: activeNarrationDurationSec = Math.max(
    narrationDurations[activeLanguage] ?? 0,
    parseHms(activeNarrationStartDraft) ?? 0,
    parseHms(activeNarrationEndDraft) ?? 0,
  );

  $: activeNarrationStartSec = Math.max(
    0,
    Math.min(parseHms(activeNarrationStartDraft) ?? 0, activeNarrationDurationSec || 0),
  );

  $: activeNarrationEndSec = Math.max(
    activeNarrationStartSec,
    Math.min(
      parseHms(activeNarrationEndDraft) ?? activeNarrationDurationSec,
      activeNarrationDurationSec || 0,
    ),
  );

  $: {
    if (activeNarrationDurationSec <= 0) {
      activeNarrationStartRatio = 0;
      activeNarrationEndRatio = 0;
    } else {
      activeNarrationStartRatio = Math.max(
        0,
        Math.min(1, activeNarrationStartSec / activeNarrationDurationSec),
      );
      activeNarrationEndRatio = Math.max(
        activeNarrationStartRatio,
        Math.min(1, activeNarrationEndSec / activeNarrationDurationSec),
      );
    }
  }

  $: activeNarrationOverlayStyle = `--start-ratio:${activeNarrationStartRatio}; --end-ratio:${activeNarrationEndRatio};`;

  $: if (activeNarrationDurationSec > 0 && activeNarrationEndSec === 0) {
    narrationEndDrafts[activeLanguage] = formatHms(activeNarrationDurationSec);
  }

  $: {
    const nextSyncKey = `${open ? '1' : '0'}:${chapterId ?? ''}:${activeLanguage}`;
    if (nextSyncKey !== lastSectionSyncKey) {
      lastSectionSyncKey = nextSyncKey;

      metadataSectionCollapsed =
        !hasTextValue(chapterTitleDrafts[activeLanguage] ?? chapterTitleDraft) &&
        !hasTextValue(chapterDescriptionDrafts[activeLanguage] ?? chapterDescriptionDraft);

      narrationSectionCollapsed = !hasValidRange(
        narrationStartDrafts[activeLanguage] ?? '',
        narrationEndDrafts[activeLanguage] ?? '',
      );

      avSectionCollapsed = !hasValidRange(markInDraft, markOutDraft);

      annotationSectionCollapsed = false;

      transitionSectionCollapsed = delayDraft === undefined;
    }
  }

  onDestroy(() => {
    cancelNarrationWaveDraw();
    disconnectNarrationWaveResizeObserver();
    clearNarrationPreviewListener();
  });

  const handleNarrationTrackInput = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    narrationUrls = {
      ...narrationUrls,
      [activeLanguage]: value,
    };
    onSetNarrationTrack?.(activeLanguage, value);
  };

  const handleLanguageChange = (value: string) => {
    activeLanguage = value;
    onSetAnnotationLanguage?.(value);
  };

  const handleNarrationStartInput = (event: Event) => {
    narrationStartDrafts[activeLanguage] = (event.target as HTMLInputElement).value;
  };

  const handleNarrationEndInput = (event: Event) => {
    narrationEndDrafts[activeLanguage] = (event.target as HTMLInputElement).value;
  };

  const handleMarkInInput = (event: Event) => {
    markInDraft = (event.target as HTMLInputElement).value;
  };

  const handleMarkOutInput = (event: Event) => {
    markOutDraft = (event.target as HTMLInputElement).value;
  };
</script>

<svelte:window
  on:keydown={(event) => {
    if (open && event.key === 'Escape') {
      onClose?.();
    }
  }}
/>

<div
  class="chapter-overlay"
  data-testid="chapter-overlay"
  aria-hidden={!open}
  hidden={!open}
>
  <div
    class="chapter-overlay__scrim"
    role="button"
    tabindex="0"
    on:click={() => onClose?.()}
    on:keydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') onClose?.();
    }}
  ></div>

  <div class="chapter-overlay__panel" role="dialog" aria-modal="false">
    <div class="chapter-overlay__header">
      <button
        class="chapter-overlay__back"
        type="button"
        data-testid="chapter-overlay-back"
        on:click={() => onClose?.()}
      >
        Back
      </button>
      <div>
        <div class="chapter-overlay__eyebrow">Story Editor</div>
        <div class="chapter-overlay__title">Chapter Metadata</div>
      </div>
      <button
        class="chapter-overlay__close"
        type="button"
        data-testid="chapter-overlay-close"
        on:click={() => onClose?.()}
        aria-label="Close"
      >
        ×
      </button>
    </div>

    <form class="chapter-overlay__form" on:submit|preventDefault>
      <div class="chapter-overlay__body">
        <ChapterCameraConfig
          chapterExists={Boolean(chapter)}
          chapterCanvasIndex={chapter?.canvasIndex ?? 0}
          manifestDraft={manifestDraft}
          transitionSectionCollapsed={transitionSectionCollapsed}
          delayMs={delayMs}
          onManifestInput={handleManifestInput}
          onReloadManifest={() => handleReload()}
          onToggleTransition={() => {
            transitionSectionCollapsed = !transitionSectionCollapsed;
          }}
          onDelayChange={handleDelaySecondsChange}
        />

        {#if manifestSupportsLayers}
          <div class="chapter-overlay__section chapter-overlay__section--card">
            <div class="chapter-overlay__section-header">
              <div class="chapter-overlay__section-title">Layers</div>
            </div>
            <div class="chapter-overlay__section-content">
              {#each layers as layer, index (layer.id)}
                {@const opacity = layerOpacities[layer.id] !== undefined ? layerOpacities[layer.id] : (index === 0 ? 1.0 : 0.0)}
                <div class="chapter-overlay__layer-item">
                  <div class="chapter-overlay__layer-info">
                    <span class="chapter-overlay__layer-name">
                      {layer.label || (index === 0 ? 'Base Image' : `Layer ${index + 1}`)}
                    </span>
                    <span class="chapter-overlay__layer-value">{Math.round(opacity * 100)}%</span>
                  </div>
                  <input
                    class="chapter-overlay__layer-slider"
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(opacity * 100)}
                    on:input={(event) => {
                      const val = Number(event.currentTarget.value) / 100;
                      onUpdateLayerOpacity?.(layer.id, val);
                    }}
                  />
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <ChapterTextForm
          activeLanguage={activeLanguage}
          {languages}
          {metadataSectionCollapsed}
          {annotationSectionCollapsed}
          {chapterTitleDraft}
          {chapterDescriptionDraft}
          {annotationDraft}
          hasChapter={Boolean(chapter)}
          onLanguageChange={handleLanguageChange}
          onToggleMetadata={() => {
            metadataSectionCollapsed = !metadataSectionCollapsed;
          }}
          onToggleAnnotation={() => {
            annotationSectionCollapsed = !annotationSectionCollapsed;
          }}
          onChapterTitleInput={handleChapterTitleInput}
          onChapterDescriptionInput={handleChapterDescriptionInput}
          onAnnotationInput={handleAnnotationInput}
          onSetPositionClick={handleSetPositionClick}
        />

        <ChapterTimelineSection
          activeLanguage={activeLanguage}
          {hasAvMedia}
          {marksValid}
          {markInDraft}
          {markOutDraft}
          {activeNarrationUrl}
          {narrationSectionCollapsed}
          {avSectionCollapsed}
          {narrationPreviewing}
          {narrationPreviewLanguage}
          {activeNarrationStartSec}
          {activeNarrationEndSec}
          {activeNarrationDurationSec}
          {activeNarrationWaveLoading}
          {activeNarrationOverlayStyle}
          narrationStartDraft={narrationStartDrafts[activeLanguage] ?? ''}
          narrationEndDraft={narrationEndDrafts[activeLanguage] ?? ''}
          bind:currentNarrationAudioRef
          bind:narrationWaveCanvas
          {formatTimestamp}
          {hasValidNarrationSegment}
          {parseHms}
          onToggleNarration={() => {
            narrationSectionCollapsed = !narrationSectionCollapsed;
          }}
          onNarrationTrackInput={handleNarrationTrackInput}
          onNarrationTimeUpdate={handleNarrationTimeUpdate(activeLanguage)}
          onNarrationLoadedMetadata={handleNarrationLoadedMetadata(activeLanguage)}
          onToggleNarrationPlayback={toggleNarrationSegmentPlayback(activeLanguage)}
          onNarrationStartRangeInput={handleNarrationStartRangeInput}
          onNarrationEndRangeInput={handleNarrationEndRangeInput}
          onNarrationStartInput={handleNarrationStartInput}
          onNarrationEndInput={handleNarrationEndInput}
          onNarrationMarksCommit={commitNarrationMarks(activeLanguage)}
          onUseNarrationStartCurrent={useNarrationCurrentTime(activeLanguage, 'start')}
          onUseNarrationEndCurrent={useNarrationCurrentTime(activeLanguage, 'end')}
          onToggleAv={() => {
            avSectionCollapsed = !avSectionCollapsed;
          }}
          onCommitMediaMarks={commitMediaMarks}
          onMarkInInput={handleMarkInInput}
          onMarkOutInput={handleMarkOutInput}
          onUseMarkInCurrent={() => useCurrentTime('in')}
          onUseMarkOutCurrent={() => useCurrentTime('out')}
          onPreviewMedia={onPreviewMediaSegment}
          onStopPreviewMedia={onStopPreviewMediaSegment}
        />
      </div>
      <div class="chapter-overlay__actions">
        <div class="chapter-overlay__actions-group">
          <button
            class="chapter-overlay__button chapter-overlay__button--accent"
            type="button"
            data-testid="chapter-save"
            disabled={saveDisabled}
            on:click={handleSave}
          >
            Save
          </button>
        </div>
        {#if saveDisabled}
          <div class="chapter-overlay__hint">Select a chapter to save settings.</div>
        {/if}
      </div>
    </form>
  </div>
</div>

<style>
  :global {
  .chapter-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    justify-content: flex-end;
    z-index: 12;
    width: 100%;
    height: 100%;
  }

  .chapter-overlay[hidden] {
    display: none;
  }

  .chapter-overlay__scrim {
    position: absolute;
    inset: 0;
    background: rgba(5, 10, 22, 0.18);
    pointer-events: auto;
  }

  .chapter-overlay__panel {
    position: relative;
    pointer-events: auto;
    width: clamp(360px, 42vw, 500px);
    max-width: 92vw;
    height: 100%;
    min-height: 100%;
    align-self: stretch;
    border-radius: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.14);
    background: #071428;
    color: #eaf1ff;
    box-shadow: none;
    overflow: auto;
    box-sizing: border-box;
  }

  .chapter-overlay__header {
    position: sticky;
    top: 0;
    z-index: 3;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 16px 18px;
    background: #08182d;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .chapter-overlay__eyebrow {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.62);
  }

  .chapter-overlay__title {
    font-size: 18px;
    font-weight: 600;
    color: #f3f8ff;
    letter-spacing: 0.01em;
  }

  .chapter-overlay__back {
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 10px;
    padding: 8px 10px;
    background: #0b1b31;
    color: rgba(232, 237, 246, 0.9);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }

  .chapter-overlay__close {
    width: var(--viewer-close-button-size, 28px);
    height: var(--viewer-close-button-size, 28px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--viewer-close-button-border, rgba(255, 255, 255, 0.18));
    border-radius: var(--viewer-close-button-radius, 10px);
    background: var(--viewer-close-button-bg, rgba(255, 255, 255, 0.1));
    color: var(--viewer-close-button-color, rgba(232, 237, 246, 0.9));
    font-size: var(--viewer-close-button-glyph-size, 15px);
    line-height: 1;
    text-transform: none;
    letter-spacing: 0;
    padding: 0;
    cursor: pointer;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      transform 0.08s ease;
  }

  .chapter-overlay__close:hover:not(:disabled) {
    background: var(--viewer-close-button-hover-bg, rgba(255, 255, 255, 0.16));
    border-color: var(--viewer-close-button-hover-border, rgba(255, 255, 255, 0.34));
  }

  .chapter-overlay__close:focus-visible {
    outline: 2px solid var(--viewer-close-button-focus-ring, rgba(42, 199, 255, 0.55));
    outline-offset: 2px;
  }

  .chapter-overlay__close:active:not(:disabled) {
    transform: translateY(1px);
  }

  .chapter-overlay__form {
    display: grid;
    gap: 14px;
    padding: 14px 18px 22px;
  }

  .chapter-overlay__body {
    display: grid;
    gap: 12px;
  }

  .chapter-overlay__section {
    display: grid;
    gap: 12px;
  }

  .chapter-overlay__section--card {
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: #0a1a2f;
  }

  .chapter-overlay__section-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: rgba(230, 236, 246, 0.72);
  }

  .chapter-overlay__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .chapter-overlay__section-content {
    display: grid;
    gap: 10px;
  }

  .chapter-overlay__section-content[hidden] {
    display: none;
  }

  .chapter-overlay__collapse-toggle {
    width: 26px;
    height: 26px;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: #0d1d33;
    color: rgba(230, 236, 246, 0.88);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.16s ease, background 0.16s ease;
  }

  .chapter-overlay__collapse-toggle:hover {
    border-color: rgba(255, 255, 255, 0.3);
    background: #13243c;
  }

  .chapter-overlay__collapse-icon {
    font-size: 13px;
    line-height: 1;
    transform: rotate(0deg);
    transition: transform 0.14s ease;
  }

  .chapter-overlay__collapse-icon--collapsed {
    transform: rotate(-90deg);
  }

  .chapter-overlay__label {
    display: grid;
    gap: 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(222, 229, 239, 0.72);
  }

  .chapter-overlay__label--inline {
    width: 100%;
  }

  .chapter-overlay__hint {
    font-size: 12px;
    line-height: 1.45;
    color: rgba(216, 224, 236, 0.72);
  }

  .chapter-overlay__input,
  .chapter-overlay__select,
  .chapter-overlay__textarea {
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    padding: 10px 12px;
    background: #08192f;
    color: #f0f6ff;
    font-size: 13px;
    outline: none;
  }

  .chapter-overlay__input::placeholder,
  .chapter-overlay__textarea::placeholder {
    color: rgba(213, 221, 234, 0.45);
  }

  .chapter-overlay__input:focus,
  .chapter-overlay__select:focus,
  .chapter-overlay__textarea:focus {
    border-color: rgba(255, 255, 255, 0.34);
    box-shadow: none;
  }

  .chapter-overlay__textarea {
    resize: vertical;
    min-height: 94px;
  }

  .chapter-overlay__input:disabled,
  .chapter-overlay__select:disabled,
  .chapter-overlay__textarea:disabled {
    opacity: 0.56;
    cursor: not-allowed;
  }

  .chapter-overlay__row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: end;
  }

  .chapter-overlay__row--tight {
    align-items: center;
  }

  .chapter-overlay__button {
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 11px;
    padding: 8px 12px;
    background: #102039;
    color: #e8edf6;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: background 0.16s ease, border-color 0.16s ease;
    white-space: nowrap;
  }

  .chapter-overlay__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chapter-overlay__button--primary,
  .chapter-overlay__button--accent {
    background: #1d395c;
    border-color: rgba(255, 255, 255, 0.2);
    color: #fafdff;
  }

  .chapter-overlay__button--subtle {
    background: #102039;
  }

  .chapter-overlay__button:not(:disabled):hover {
    background: #173053;
    border-color: rgba(255, 255, 255, 0.28);
  }

  .chapter-overlay__button--primary:not(:disabled):hover,
  .chapter-overlay__button--accent:not(:disabled):hover {
    background: #274974;
  }

  .chapter-overlay__audio-source {
    display: none;
  }

  .chapter-overlay__wave-shell {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 12px;
    align-items: center;
  }

  .chapter-overlay__wave-play {
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    width: 48px;
    height: 48px;
    background: #102039;
    color: #f3f7ff;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .chapter-overlay__wave-play:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .chapter-overlay__wave-main {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .chapter-overlay__wave-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    font-size: 12px;
    color: rgba(226, 232, 241, 0.86);
  }

  .chapter-overlay__wave-summary strong {
    display: block;
    margin-top: 2px;
    font-size: 16px;
    color: #f3f8ff;
    font-weight: 500;
  }

  .chapter-overlay__wave-summary-end {
    text-align: right;
  }

  .chapter-overlay__wave-caption {
    display: block;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 10px;
    color: rgba(205, 214, 228, 0.66);
  }

  .chapter-overlay__wave-track {
    position: relative;
    --wave-thumb-size: 14px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: #07172d;
    overflow: hidden;
  }

  .chapter-overlay__wave-canvas {
    width: 100%;
    height: 108px;
    display: block;
  }

  .chapter-overlay__wave-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .chapter-overlay__wave-selection {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(
      (var(--start-ratio) * (100% - var(--wave-thumb-size))) + (var(--wave-thumb-size) / 2)
    );
    right: calc(
      ((1 - var(--end-ratio)) * (100% - var(--wave-thumb-size))) + (var(--wave-thumb-size) / 2)
    );
    background: rgba(255, 255, 255, 0.08);
  }

  .chapter-overlay__wave-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    transform: translateX(-50%);
    background: #d94b4b;
  }

  .chapter-overlay__wave-marker--start {
    left: calc(
      (var(--start-ratio) * (100% - var(--wave-thumb-size))) + (var(--wave-thumb-size) / 2)
    );
  }

  .chapter-overlay__wave-marker--end {
    left: calc(
      (var(--end-ratio) * (100% - var(--wave-thumb-size))) + (var(--wave-thumb-size) / 2)
    );
  }

  .chapter-overlay__wave-loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(222, 230, 241, 0.72);
    background: rgba(7, 23, 45, 0.9);
  }

  .chapter-overlay__wave-axis {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: rgba(208, 217, 231, 0.72);
  }

  .chapter-overlay__wave-sliders {
    position: relative;
    height: 28px;
    display: grid;
  }

  .chapter-overlay__range {
    grid-area: 1 / 1;
    width: 100%;
    margin: 0;
    background: transparent;
    appearance: none;
    pointer-events: none;
  }

  .chapter-overlay__range::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    margin-top: -5px;
    border-radius: 999px;
    border: 2px solid rgba(236, 241, 248, 0.92);
    background: #d3dae6;
    box-shadow: none;
    pointer-events: auto;
    cursor: grab;
  }

  .chapter-overlay__range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    border: 2px solid rgba(236, 241, 248, 0.92);
    background: #d3dae6;
    box-shadow: none;
    pointer-events: auto;
    cursor: grab;
  }

  .chapter-overlay__range:active::-webkit-slider-thumb {
    cursor: grabbing;
  }

  .chapter-overlay__range:active::-moz-range-thumb {
    cursor: grabbing;
  }

  .chapter-overlay__range::-webkit-slider-runnable-track,
  .chapter-overlay__range::-moz-range-track {
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
  }

  .chapter-overlay__timegrid {
    display: grid;
    gap: 10px;
  }

  .chapter-overlay__timerow {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: end;
  }

  .chapter-overlay__input--time {
    width: 100%;
  }

  .chapter-overlay__placement-editor {
    position: relative;
    width: 100%;
    height: 168px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background:
      linear-gradient(to right, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
      #08192f;
    background-size: 16px 16px, 16px 16px, auto;
    overflow: hidden;
  }

  .chapter-overlay__hint--placement {
    margin-top: -2px;
  }

  .chapter-overlay__actions {
    display: grid;
    gap: 8px;
    padding-top: 4px;
  }

  .chapter-overlay__actions-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chapter-overlay__layer-item {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.03);
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .chapter-overlay__layer-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.06);
  }

  .chapter-overlay__layer-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .chapter-overlay__layer-name {
    font-weight: 700;
    color: rgba(230, 236, 246, 0.9);
  }

  .chapter-overlay__layer-value {
    font-weight: 600;
    color: #ffbf4d;
    font-variant-numeric: tabular-nums;
  }

  .chapter-overlay__layer-slider {
    width: 100%;
    accent-color: #ffbf4d;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.1);
    height: 4px;
    border-radius: 2px;
    outline: none;
  }

  @media (max-width: 860px) {
    .chapter-overlay__panel {
      width: 100%;
      max-width: 100%;
      border-radius: 0;
    }

    .chapter-overlay__wave-shell {
      grid-template-columns: 1fr;
    }

    .chapter-overlay__wave-play {
      width: 100%;
      border-radius: 10px;
      height: 40px;
    }

    .chapter-overlay__timerow,
    .chapter-overlay__row {
      grid-template-columns: 1fr;
    }
  }
}
</style>
