<script lang="ts">
  import { onDestroy } from "svelte";
  import { Play, Square } from "@lucide/svelte";
  import {
    ANNOTATION_TOOLS,
    annotationToolLabelKey,
  } from "../../features/annotations/annotationTools";
  import { readable, type Readable } from "svelte/store";
  import {
    CHAPTER_ANNOTATION_MOTIVATIONS,
    type AnnotationPlacement,
    type ChapterAdvance,
    type ChapterAnnotationTool,
    type ChapterDrawingAnnotation,
    type StoryState,
  } from "../../core/types/story";
  import type { ViewBox } from "../../core/types/viewer";
  import type { MediaType, MediaSource } from "../../iiif/mediaResolver";
  import type { MediaMarksState } from "../mediaMarks";
  import {
    coerceAnnotationPlacement,
    cloneAnnotationPlacement,
    DEFAULT_ANNOTATION_PLACEMENT,
  } from "../annotationPlacement";
  import ChapterTimelineSection from "./ChapterTimelineSection.svelte";
  import ChapterTextForm from "./ChapterTextForm.svelte";
  import LanguageTabs from "../../features/annotations/LanguageTabs.svelte";
  import ChapterPositionSection from "./ChapterPositionSection.svelte";
  import ChapterCameraConfig from "./ChapterCameraConfig.svelte";
  import ChapterDashboard from "./ChapterDashboard.svelte";
  import ChapterMotionPanel from "./ChapterMotionPanel.svelte";
  import {
    evaluateChapterTasks,
    framingsDiffer,
    type ChapterInspectorView,
    type ChapterTaskEvaluation,
    type ChapterTaskId,
  } from "../chapterTasks";
  import { t } from '../../core/i18n';

  export let story: Readable<StoryState>;
  export let layers: MediaSource[] = [];
  export let layerOpacities: Record<string, number> = {};
  export let onUpdateLayerOpacity:
    ((id: string, opacity: number) => void) | undefined = undefined;

  let manifestSupportsLayers = false;
  $: manifestSupportsLayers =
    layers.length > 1 && layers.every((src) => src.type === "image");

  export let open = false;
  export let docked = false;
  export let chapterId: string | null = null;
  export let activeChapterTask: Readable<ChapterTaskId | null> = readable(null);
  export let validationErrors: string[] = [];
  export let mediaType: Readable<MediaType | null>;
  export let mediaMarks: Readable<MediaMarksState> = readable({
    lastTime: 0,
    markIn: null,
    markOut: null,
  });
  export let avMarksValid: Readable<boolean> = readable(true);
  export let transitionDelayDefaultMs = 2000;
  export let language = "en";
  export let languages: string[] = ["en"];
  export let currentManifest: string | null = null;
  export let viewBox: Readable<ViewBox | null> = readable(null);
  export let canvasIndex = 0;
  export let canvasCount = 0;
  export let onClose: (() => void) | undefined;
  export let onSetMediaMarks:
    ((start: number | null, end: number | null) => void) | undefined;
  export let onPreviewMediaSegment: (() => void) | undefined;
  export let onStopPreviewMediaSegment: (() => void) | undefined;
  export let onSetNarrationTrack:
    ((lang: string, src: string) => void) | undefined;
  export let onAssignSegment:
    ((lang: string, start: number, end: number) => void) | undefined;
  export let onSkipNarration: ((lang: string) => void) | undefined;
  export let onSetAnnotationLanguage: ((lang: string) => void) | undefined;
  export let annotationTool: Readable<ChapterAnnotationTool> =
    readable("select");
  export let selectedDrawingAnnotationId: Readable<string | null> = readable(null);
  export let onSetAnnotationTool:
    ((tool: ChapterAnnotationTool) => void) | undefined;
  export let onSetDrawingAnnotationLabel:
    ((annotationId: string, lang: string, value: string) => void) | undefined;
  export let onSetDrawingAnnotationStyle:
    ((
      annotationId: string,
      style: {
        color?: string | null;
        strokeWidth?: "thin" | "medium" | "thick";
        fillMode?: ChapterDrawingAnnotation["fillMode"];
        motivation?: ChapterDrawingAnnotation["motivation"] | null;
      },
    ) => void) | undefined;
  export let onUpdateManifest:
    ((chapterId: string, manifest: string) => void) | undefined;
  export let onLoadManifest: ((manifest: string) => void) | undefined;
  export let onCreateChapter: (() => void) | undefined;
  export let onReloadManifest:
    | ((chapterId: string, manifest: string, canvasIndex: number) => void)
    | undefined;
  export let onSelectCanvas: ((canvasIndex: number) => void) | undefined;
  export let onUpdateChapterTitle:
    ((chapterId: string, lang: string, value: string) => void) | undefined;
  export let onUpdateChapterDescription:
    ((chapterId: string, lang: string, value: string) => void) | undefined;
  export let onUpdateAnnotationText:
    ((chapterId: string, lang: string, text: string) => void) | undefined;
  export let onUpdateAnnotationPlacement:
    | ((
        chapterId: string,
        lang: string,
        placement: AnnotationPlacement,
      ) => void)
    | undefined;
  export let onUpdateAdvanceMode:
    ((chapterId: string, mode: ChapterAdvance["mode"]) => void) | undefined;
  export let onUpdateDelay:
    ((chapterId: string, delayMs?: number) => void) | undefined;
  export let onUpdateChapterPosition: ((chapterId: string) => void) | undefined;
  export let onSetChapterPosition:
    ((chapterId: string, viewBox: ViewBox) => void) | undefined = undefined;
  export let storyPreviewing: Readable<boolean> = readable(false);
  export let onPreviewChapter: ((chapterId: string) => void) | undefined =
    undefined;
  export let onStopChapterPreview: (() => void) | undefined = undefined;
  export let onRevertChapterPosition: ((chapterId: string) => void) | undefined;
  export let onSave: (() => void) | undefined;
  export let onCancel: (() => void) | undefined;
  export let onSetAnnotationPositioning: ((lang: string) => void) | undefined =
    undefined;
  export let onUpdateMotionDuration:
    ((durationMs: number) => void) | undefined = undefined;
  export let onUpdateMotionPathType:
    ((pathType: "linear" | "spline") => void) | undefined = undefined;
  export let onUpdateMotionInitialDwell:
    ((dwellMs: number) => void) | undefined = undefined;
  export let onUpdateMotionEasing:
    | ((easing: "linear" | "ease-in" | "ease-out" | "ease-in-out") => void)
    | undefined = undefined;
  export let motionPreviewing = false;
  export let onApplyMotionPreset:
    | ((
        preset: NonNullable<
          NonNullable<StoryState["chapters"][number]["cameraTrack"]>["preset"]
        >,
      ) => void)
    | undefined = undefined;
  export let onPreviewMotion: (() => void) | undefined = undefined;
  export let onStopMotionPreview: (() => void) | undefined = undefined;
  export let onChapterTaskChange:
    ((task: ChapterTaskId | null) => void) | undefined = undefined;

  let activeLanguage = language;
  let lastLanguageProp = language;
  let chapter: StoryState["chapters"][number] | null = null;
  let chapterValidationErrors: string[] = [];
  let chapterTitleDraft = "";

  const handleSetPositionClick = () => {
    onSetAnnotationPositioning?.(activeLanguage);
  };
  let chapterDescriptionDraft = "";
  let chapterTitleDrafts: Record<string, string> = {};
  let chapterDescriptionDrafts: Record<string, string> = {};
  let manifestDraft = "";
  let annotationDraft = "";
  let annotationDrafts: Record<string, string> = {};
  let placementDraft: AnnotationPlacement = cloneAnnotationPlacement(
    DEFAULT_ANNOTATION_PLACEMENT,
  );
  let advanceModeDraft: ChapterAdvance["mode"] = "manual";
  let delayDraft: number | undefined = undefined;
  let lastChapterId: string | null = null;
  let lastCurrentManifest: string | null = null;
  let saveDisabled = false;
  let markInDraft = "";
  let markOutDraft = "";
  let lastMarksApplied: { markIn: number | null; markOut: number | null } = {
    markIn: null,
    markOut: null,
  };
  let currentMarks: MediaMarksState = {
    lastTime: 0,
    markIn: null,
    markOut: null,
  };
  let hasAvMedia = false;
  let marksValid = true;
  let mediaTypeValue: MediaType | null = null;
  let inspectorView: ChapterInspectorView = { mode: "dashboard" };
  let taskEvaluations: ChapterTaskEvaluation[] = [];
  let chapterIndex = -1;
  let dashboardHeading: HTMLDivElement | null = null;
  let saveAcknowledged = false;
  let saveFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  let viewUpdateAcknowledged = false;
  let viewUpdateFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  let chapterHasSavedPosition = false;

  /*
   * Exact by design. This keys "has the stored framing changed at all", which
   * decides whether to overwrite the author's in-progress form entry — a
   * tolerance here would silently discard a small manual edit. Use
   * `framingsWithin` when the question is whether the viewer has arrived
   * somewhere, and `framingsDiffer` when it is whether the author reframed.
   */
  const positionSignature = (value: ViewBox | null | undefined): string =>
    value ? `${value.x}:${value.y}:${value.w}:${value.h}` : "";

  const annotationTools = ANNOTATION_TOOLS;
  const annotationPalette = ["#e07a3f", "#f6c343", "#39b57e", "#3aa0e0", "#a06eff", "#ef5f7a"];

  const openTask = (task: ChapterTaskId) => {
    const evaluation = taskEvaluations.find((item) => item.id === task);
    if (evaluation?.availability.state !== "available") return;
    inspectorView = { mode: "task", task };
    saveAcknowledged = false;
    viewUpdateAcknowledged = false;
    onChapterTaskChange?.(task);
  };

  const returnToDashboard = () => {
    const wasAnnotationTask =
      inspectorView.mode === "task" && inspectorView.task === "focus";
    inspectorView = { mode: "dashboard" };
    saveAcknowledged = false;
    viewUpdateAcknowledged = false;
    if (wasAnnotationTask) {
      onCancel?.();
    } else {
      onChapterTaskChange?.(null);
    }
    requestAnimationFrame(() => dashboardHeading?.focus());
  };

  let inspectorChapterId: string | null = null;
  $: if (chapterId !== inspectorChapterId) {
    inspectorChapterId = chapterId;
    inspectorView = { mode: "dashboard" };
    onChapterTaskChange?.(null);
  }
  $: if (
    onChapterTaskChange &&
    $activeChapterTask === null &&
    inspectorView.mode === "task"
  ) {
    inspectorView = { mode: "dashboard" };
  }

  let fallbackPlacement: AnnotationPlacement | undefined;
  let delayMs: number | undefined;

  let narrationUrls: Record<string, string> = {};
  let narrationStartDrafts: Record<string, string> = {};
  let narrationEndDrafts: Record<string, string> = {};
  let narrationLastTimes: Record<string, number> = {};
  let narrationAudioRefs: Record<string, HTMLAudioElement | null> = {};
  let currentNarrationAudioRef: HTMLAudioElement | null = null;
  let lastNarrationSyncKey = "";
  let lastActiveLanguage = activeLanguage;

  let narrationPreviewing = false;
  let narrationPreviewLanguage: string | null = null;
  let detachNarrationPreviewStop: (() => void) | null = null;

  let activeNarrationUrl = "";
  let metadataSectionCollapsed = false;
  let positionSectionCollapsed = false;
  let narrationSectionCollapsed = false;
  let avSectionCollapsed = false;
  let annotationSectionCollapsed = false;
  let lastSectionSyncKey = "";
  let positionDrafts: { x: string; y: string; w: string; h: string } = {
    x: "",
    y: "",
    w: "",
    h: "",
  };
  let lastPositionSyncKey = "";
  let positionSectionAvailable = false;

  const formatPositionValue = (value: number | undefined): string =>
    value === undefined || !Number.isFinite(value)
      ? ""
      : String(Math.round(value));

  const positionDraftsFromViewBox = (
    value: ViewBox | undefined,
  ): { x: string; y: string; w: string; h: string } => ({
    x: formatPositionValue(value?.x),
    y: formatPositionValue(value?.y),
    w: formatPositionValue(value?.w),
    h: formatPositionValue(value?.h),
  });

  const handlePositionFieldInput = (
    field: "x" | "y" | "w" | "h",
    value: string,
  ) => {
    positionDrafts = { ...positionDrafts, [field]: value };
  };

  const commitPositionDrafts = () => {
    if (!chapterId || !chapter) return;
    const drafts = positionDrafts;
    const parsed = {
      x: Number(drafts.x),
      y: Number(drafts.y),
      w: Number(drafts.w),
      h: Number(drafts.h),
    };
    const valid =
      [drafts.x, drafts.y, drafts.w, drafts.h].every(
        (entry) => entry.trim() !== "",
      ) &&
      [parsed.x, parsed.y, parsed.w, parsed.h].every(Number.isFinite) &&
      parsed.w > 0 &&
      parsed.h > 0;
    if (!valid) {
      // Keep partial manual entry while nothing is saved yet; otherwise snap
      // back to the stored position.
      if (chapter.viewBox) {
        positionDrafts = positionDraftsFromViewBox(chapter.viewBox);
      }
      return;
    }
    if (positionSignature(parsed) === positionSignature(chapter.viewBox)) return;
    onSetChapterPosition?.(chapterId, parsed);
  };

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
      "";
    const nextTitle =
      activeChapter?.title?.[activeLanguage] ??
      chapterTitleDrafts[activeLanguage] ??
      "";
    const nextDescription =
      activeChapter?.description?.[activeLanguage] ??
      chapterDescriptionDrafts[activeLanguage] ??
      "";

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
    if (!Number.isFinite(value ?? NaN)) return "";
    const total = Math.max(0, Math.floor(value as number));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
  };

  const parseHms = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(":").map((entry) => Number(entry));
    if (parts.some((entry) => Number.isNaN(entry) || entry < 0)) return null;
    if (parts.length > 3) return null;
    const [a = 0, b = 0, c = 0] =
      parts.length === 3
        ? parts
        : parts.length === 2
          ? [0, parts[0], parts[1]]
          : [0, 0, parts[0]];
    const totalSeconds = a * 3600 + b * 60 + c;
    return Number.isFinite(totalSeconds) ? totalSeconds : null;
  };

  const hasValidRange = (startValue: string, endValue: string): boolean => {
    const start = parseHms(startValue);
    const end = parseHms(endValue);
    return start != null && end != null && end > start;
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

  const useCurrentTime = (target: "in" | "out") => {
    const state = $mediaMarks;
    const time = Number.isFinite(state.lastTime) ? state.lastTime : null;
    if (target === "in") {
      onSetMediaMarks?.(time, state.markOut);
    } else {
      onSetMediaMarks?.(state.markIn, time);
    }
  };

  const getNarrationTrack = (lang: string): string => {
    return $story.narration?.tracks?.[lang]?.src ?? "";
  };

  const applyNarrationDrafts = (
    lang: string,
    start: number | null,
    end: number | null,
  ) => {
    narrationStartDrafts[lang] = formatHms(start);
    narrationEndDrafts[lang] = formatHms(end);
  };

  const commitNarrationMarks = (lang: string) => () => {
    const start = parseHms(narrationStartDrafts[lang] ?? "");
    const end = parseHms(narrationEndDrafts[lang] ?? "");
    if (start != null && end != null && end > start && chapterId) {
      onAssignSegment?.(lang, start, end);
    }
  };

  const updateNarrationFromState = (lang: string) => {
    narrationUrls[lang] = getNarrationTrack(lang);
    const chapterSegment = $story.chapters.find((item) => item.id === chapterId)
      ?.narrationSegment?.[lang];
    applyNarrationDrafts(
      lang,
      chapterSegment?.start ?? null,
      chapterSegment?.end ?? null,
    );
  };

  const narrationCurrentTime = (lang: string): number => {
    const ref = narrationAudioRefs[lang];
    if (
      ref &&
      ref.isConnected &&
      Number.isFinite(ref.currentTime) &&
      ref.readyState >= 1
    ) {
      return ref.currentTime;
    }
    return narrationLastTimes[lang] ?? 0;
  };

  const handleNarrationLoadedMetadata = (lang: string) => () => {
    const ref = narrationAudioRefs[lang];
    if (ref && Number.isFinite(ref.duration))
      narrationLastTimes[lang] = ref.currentTime;
  };

  const handleNarrationTimeUpdate = (lang: string) => () => {
    const ref = narrationAudioRefs[lang];
    if (ref && ref.isConnected && Number.isFinite(ref.currentTime)) {
      narrationLastTimes[lang] = ref.currentTime;
    }
  };

  const useNarrationCurrentTime =
    (lang: string, target: "start" | "end") => () => {
      const time = narrationCurrentTime(lang);
      if (!Number.isFinite(time)) return;
      if (target === "start") {
        narrationStartDrafts[lang] = formatHms(time);
      } else {
        narrationEndDrafts[lang] = formatHms(time);
      }
      commitNarrationMarks(lang)();
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

    const start = parseHms(narrationStartDrafts[lang] ?? "");
    const end = parseHms(narrationEndDrafts[lang] ?? "");
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

    ref.addEventListener("timeupdate", onTimeUpdate);
    detachNarrationPreviewStop = () => {
      ref.removeEventListener("timeupdate", onTimeUpdate);
    };

    void ref.play();
  };

  const toggleNarrationSegmentPlayback = (lang: string) => () => {
    if (narrationPreviewing && narrationPreviewLanguage === lang) {
      stopNarrationSegmentPlayback(lang);
      return;
    }
    startNarrationSegmentPlayback(lang);
  };

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

  $: chapter = $story.chapters.find((item) => item.id === chapterId) ?? null;
  $: selectedDrawingAnnotation =
    chapter?.drawingAnnotations?.find((item) => item.id === $selectedDrawingAnnotationId) ?? null;
  $: chapterHasSavedPosition = Boolean(chapter?.viewBox);
  $: {
    const positionSyncKey = `${chapterId ?? ""}:${positionSignature(chapter?.viewBox)}`;
    if (positionSyncKey !== lastPositionSyncKey) {
      lastPositionSyncKey = positionSyncKey;
      positionDrafts = positionDraftsFromViewBox(chapter?.viewBox);
    }
  }
  $: positionSectionAvailable =
    Boolean(chapter) &&
    mediaTypeValue !== "audio" &&
    mediaTypeValue !== "video" &&
    mediaTypeValue !== "model" &&
    !chapter?.model;
  $: {
    chapterIndex = $story.chapters.findIndex((item) => item.id === chapterId);
    const prefix = `Chapter ${chapterIndex + 1}:`;
    chapterValidationErrors =
      chapterIndex >= 0
        ? validationErrors
            .filter((message) => message.startsWith(prefix))
            .map((message) => message.slice(prefix.length).trim())
        : validationErrors.filter((message) => message.startsWith("Story:"));
  }

  $: if (chapterId !== lastChapterId) {
    lastChapterId = chapterId;
    inspectorView = { mode: "dashboard" };
    manifestDraft = chapter?.manifest ?? "";

    chapterTitleDrafts = {};
    if (chapter?.title) {
      for (const [lang, value] of Object.entries(chapter.title)) {
        chapterTitleDrafts[lang] = value ?? "";
      }
    }

    chapterDescriptionDrafts = {};
    if (chapter?.description) {
      for (const [lang, value] of Object.entries(chapter.description)) {
        chapterDescriptionDrafts[lang] = value ?? "";
      }
    }

    chapterTitleDraft = chapterTitleDrafts[activeLanguage] ?? "";
    chapterDescriptionDraft = chapterDescriptionDrafts[activeLanguage] ?? "";

    annotationDrafts = {};
    if (chapter?.annotations) {
      for (const [lang, entry] of Object.entries(chapter.annotations)) {
        annotationDrafts[lang] = entry?.text ?? "";
      }
    }

    annotationDraft = annotationDrafts[activeLanguage] ?? "";

    const activePlacement = coerceAnnotationPlacement(
      chapter?.annotations?.[activeLanguage]?.placement,
    );
    const chapterPlacementFallback = Object.values(chapter?.annotations ?? {})
      .map((entry) => coerceAnnotationPlacement(entry?.placement))
      .find((entry): entry is AnnotationPlacement => Boolean(entry));

    placementDraft =
      activePlacement ??
      coerceAnnotationPlacement(chapter?.annotationPlacement) ??
      chapterPlacementFallback ??
      cloneAnnotationPlacement(DEFAULT_ANNOTATION_PLACEMENT);

    advanceModeDraft = chapter?.advance?.mode ?? "auto";
    delayDraft =
      chapter?.advance?.mode === "manual"
        ? undefined
        : (chapter?.advance?.delayMs ?? transitionDelayDefaultMs);

    if (!chapter && currentManifest && manifestDraft.trim() === "") {
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
    const nextManifest = chapter.manifest ?? "";
    if (manifestDraft !== nextManifest) {
      manifestDraft = nextManifest;
    }

    const nextTitle = chapter.title?.[activeLanguage] ?? "";
    if (chapterTitleDraft !== nextTitle) {
      chapterTitleDraft = nextTitle;
    }
    chapterTitleDrafts[activeLanguage] = nextTitle;

    const nextDescription = chapter.description?.[activeLanguage] ?? "";
    if (chapterDescriptionDraft !== nextDescription) {
      chapterDescriptionDraft = nextDescription;
    }
    chapterDescriptionDrafts[activeLanguage] = nextDescription;

    const nextText = chapter.annotations?.[activeLanguage]?.text ?? "";
    if (annotationDraft !== nextText) {
      annotationDraft = nextText;
    }
    annotationDrafts[activeLanguage] = nextText;

    const activePlacement = coerceAnnotationPlacement(
      chapter.annotations?.[activeLanguage]?.placement,
    );
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

    const nextAdvanceMode = chapter.advance?.mode ?? "auto";
    if (advanceModeDraft !== nextAdvanceMode) {
      advanceModeDraft = nextAdvanceMode;
    }

    const nextDelay =
      chapter.advance?.mode === "manual"
        ? undefined
        : (chapter.advance?.delayMs ?? transitionDelayDefaultMs);
    if (delayDraft !== nextDelay) {
      delayDraft = nextDelay;
    }
  }

  $: if (
    !chapter &&
    currentManifest &&
    currentManifest !== lastCurrentManifest
  ) {
    if (manifestDraft.trim() === "" || manifestDraft === lastCurrentManifest) {
      manifestDraft = currentManifest;
      lastCurrentManifest = currentManifest;
    }
  }

  $: if (!chapter) {
    chapterTitleDraft = chapterTitleDrafts[activeLanguage] ?? "";
    chapterDescriptionDraft = chapterDescriptionDrafts[activeLanguage] ?? "";
    annotationDraft = annotationDrafts[activeLanguage] ?? "";
  }

  $: {
    const narrationSyncKey = JSON.stringify({
      chapterId,
      tracks: $story.narration?.tracks ?? {},
      segments: chapter?.narrationSegment ?? {},
    });
    if (narrationSyncKey !== lastNarrationSyncKey) {
      lastNarrationSyncKey = narrationSyncKey;
      stopNarrationSegmentPlayback();
      for (const lang of languages) {
        updateNarrationFromState(lang);
      }
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
  };

  $: fallbackPlacement = Object.values(chapter?.annotations ?? {})
    .map((entry) => coerceAnnotationPlacement(entry?.placement))
    .find((entry): entry is AnnotationPlacement => Boolean(entry));
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

  const handleDelaySecondsChange = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    const seconds = value === "" ? undefined : Number(value);
    const ms =
      seconds === undefined || !Number.isFinite(seconds)
        ? undefined
        : (seconds as number) * 1000;
    delayDraft = ms;
    advanceModeDraft = delayDraft !== undefined ? "auto" : "manual";
    if (chapterId) {
      onUpdateAdvanceMode?.(chapterId, advanceModeDraft);
      onUpdateDelay?.(chapterId, ms);
    }
  };

  const handleSave = () => {
    if (!chapterId || !chapter) return;
    commitMediaMarks();
    applyDrafts(chapterId);
    if (
      inspectorView.mode === "task" &&
      inspectorView.task === "transition-timing"
    ) {
      const nextDelay = delayDraft ?? transitionDelayDefaultMs;
      onUpdateAdvanceMode?.(chapterId, "auto");
      onUpdateDelay?.(chapterId, nextDelay);
    }
    saveAcknowledged = true;
    if (saveFeedbackTimeout) clearTimeout(saveFeedbackTimeout);
    saveFeedbackTimeout = setTimeout(() => {
      saveAcknowledged = false;
      saveFeedbackTimeout = null;
    }, 1800);
    onSave?.();
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const handleRevertView = () => {
    if (chapterId) onRevertChapterPosition?.(chapterId);
  };

  const handleChapterPreview = () => {
    if ($storyPreviewing) {
      onStopChapterPreview?.();
      return;
    }
    if (chapterId) onPreviewChapter?.(chapterId);
  };

  const handleUpdateView = () => {
    if (!chapterId) return;
    onUpdateChapterPosition?.(chapterId);
    viewUpdateAcknowledged = true;
    if (viewUpdateFeedbackTimeout) clearTimeout(viewUpdateFeedbackTimeout);
    viewUpdateFeedbackTimeout = setTimeout(() => {
      viewUpdateAcknowledged = false;
      viewUpdateFeedbackTimeout = null;
    }, 1800);
  };

  /*
   * Selecting a chapter flies the viewer to its saved frame, so the live and
   * saved boxes genuinely disagree for the length of that animation. Comparing
   * against a settled view stops the position card flashing a warning on every
   * chapter click, and stops it strobing while the author is mid-drag.
   */
  const VIEW_SETTLE_MS = 400;
  /*
   * The timer handle lives on an object rather than in a `let`. A `$:` block
   * that both reads and reassigns a component-level binding depends on itself
   * and re-runs when it changes, so clearing the handle from the reset below
   * immediately restarted the settle it had just cancelled — resurrecting the
   * stale comparison the chapter switch was meant to drop.
   */
  const viewSettle: { timer: ReturnType<typeof setTimeout> | null } = { timer: null };
  let settledViewBox: ViewBox | null = null;
  let viewAtSelection: ViewBox | null = null;
  let viewBaselineChapterId: string | null = null;

  /*
   * Selecting a chapter does not move the viewer, so straight after a switch
   * the framing on screen belongs to the chapter the author just left. That is
   * not a statement about this chapter, and treating it as one would leave the
   * warning permanently lit in any story with more than one chapter — a signal
   * as useless as the tick that could never go red. Start afresh on each
   * selection and stay quiet until the author actually moves the view.
   */
  $: if (chapterId !== viewBaselineChapterId) {
    viewBaselineChapterId = chapterId;
    if (viewSettle.timer) {
      clearTimeout(viewSettle.timer);
      viewSettle.timer = null;
    }
    viewAtSelection = $viewBox;
    settledViewBox = null;
  }

  /*
   * The framing only becomes a question about *this* chapter once the author
   * has moved since selecting it. Remembering where the view was at selection
   * is what makes that robust: the viewer republishes its position on selection
   * without actually moving, and comparing against the saved frame directly
   * would read that as the author having reframed the chapter.
   */
  $: authorHasMovedView = Boolean(
    settledViewBox && viewAtSelection && framingsDiffer(viewAtSelection, settledViewBox),
  );

  $: {
    const nextViewBox = $viewBox;
    if (viewSettle.timer) clearTimeout(viewSettle.timer);
    viewSettle.timer = setTimeout(() => {
      settledViewBox = nextViewBox;
      viewSettle.timer = null;
    }, VIEW_SETTLE_MS);
  }
  onDestroy(() => {
    if (viewSettle.timer) clearTimeout(viewSettle.timer);
  });

  $: mediaTypeValue = $mediaType;
  $: taskEvaluations = chapter
    ? evaluateChapterTasks({
        story: $story,
        chapter,
        chapterIndex,
        mediaType: mediaTypeValue,
        layers,
        loadedSources: layers,
        validationErrors: chapterValidationErrors,
        languages,
        // During a preview the viewer is following the story, not the author.
        currentViewBox:
          $storyPreviewing || !authorHasMovedView ? null : settledViewBox,
      })
    : [];
  $: hasAvMedia = mediaTypeValue === "audio" || mediaTypeValue === "video";
  $: marksValid = $avMarksValid;
  $: currentMarks = $mediaMarks;

  $: if (
    currentMarks.markIn !== lastMarksApplied.markIn ||
    currentMarks.markOut !== lastMarksApplied.markOut
  ) {
    applyMarkDrafts(currentMarks.markIn, currentMarks.markOut);
  }

  $: activeNarrationUrl = $story.narration?.tracks?.[activeLanguage]?.src ?? "";

  $: {
    const nextSyncKey = `${open ? "1" : "0"}:${chapterId ?? ""}:${activeLanguage}`;
    if (nextSyncKey !== lastSectionSyncKey) {
      lastSectionSyncKey = nextSyncKey;

      metadataSectionCollapsed = false;

      positionSectionCollapsed = false;

      narrationSectionCollapsed = false;

      avSectionCollapsed = !hasValidRange(markInDraft, markOutDraft);

      annotationSectionCollapsed = false;
    }
  }

  onDestroy(() => {
    if (saveFeedbackTimeout) clearTimeout(saveFeedbackTimeout);
    if (viewUpdateFeedbackTimeout) clearTimeout(viewUpdateFeedbackTimeout);
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
    narrationStartDrafts[activeLanguage] = (
      event.target as HTMLInputElement
    ).value;
  };

  const handleNarrationEndInput = (event: Event) => {
    narrationEndDrafts[activeLanguage] = (
      event.target as HTMLInputElement
    ).value;
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
    if (open && event.key === "Escape") {
      if (inspectorView.mode === "task") returnToDashboard();
      else onClose?.();
    }
  }}
/>

<div
  class="chapter-overlay"
  class:chapter-overlay--docked={docked}
  data-testid="chapter-overlay"
  aria-hidden={!open}
  hidden={!open}
>
  {#if !docked}
    <div
      class="chapter-overlay__scrim"
      role="button"
      tabindex="0"
      aria-label={$t('storyBuilder.overlay.closeMetadata')}
      on:click={() => onClose?.()}
      on:keydown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClose?.();
      }}
    ></div>
  {/if}

  <div
    class="chapter-overlay__panel"
    role={docked ? "region" : "dialog"}
    aria-modal="false"
    aria-labelledby="chapter-overlay-title"
  >
    <div class="chapter-overlay__header">
      {#if !docked}
        <button
          class="chapter-overlay__back"
          type="button"
          data-testid="chapter-overlay-back"
          on:click={() => onClose?.()}
        >
          {$t('common.back')}
        </button>
      {/if}
      <div>
        <div class="chapter-overlay__eyebrow">
          {chapterIndex >= 0
            ? $t('storyBuilder.chapters.number', { number: chapterIndex + 1 })
            : chapter
              ? $t('storyBuilder.overlay.selectedChapter')
              : $t('storyBuilder.overlay.newStory')}
        </div>
        <div
          class="chapter-overlay__title"
          id="chapter-overlay-title"
          tabindex="-1"
          bind:this={dashboardHeading}
        >
          {inspectorView.mode === "task"
            ? $t(`storyBuilder.tasks.items.${inspectorView.task}.title`)
            : chapter
              ? $t('storyBuilder.tasks.title')
              : $t('storyBuilder.overlay.loadSource')}
        </div>
      </div>
      {#if chapter}
        <button
          class="chapter-overlay__preview-chapter"
          type="button"
          data-testid="chapter-preview"
          on:click={handleChapterPreview}
        >
          {#if $storyPreviewing}
            <Square aria-hidden="true" />
          {:else}
            <Play aria-hidden="true" />
          {/if}
          <span>
            <strong>
              {$storyPreviewing
                ? $t('storyBuilder.overlay.stopChapterPreview')
                : $t('storyBuilder.overlay.previewChapter')}
            </strong>
            <small>
              {$storyPreviewing
                ? $t('storyBuilder.overlay.chapterPreviewPlaying')
                : $t('storyBuilder.overlay.previewChapterHint')}
            </small>
          </span>
        </button>
      {/if}
      {#if !docked}
        <button
          class="chapter-overlay__close"
          type="button"
          data-testid="chapter-overlay-close"
          on:click={() => onClose?.()}
          aria-label={$t('common.close')}
        >
          {$t('common.closeGlyph')}
        </button>
      {/if}
    </div>

    <form class="chapter-overlay__form" on:submit|preventDefault>
      {#if chapterValidationErrors.length > 0 && inspectorView.mode === "task"}
        <div class="chapter-overlay__validation" role="alert">
          <strong>{$t('storyBuilder.tasks.status.attention')}</strong>
          <ul>
            {#each chapterValidationErrors as message}
              <li>{message}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <div class="chapter-overlay__body">
        {#if inspectorView.mode === "dashboard" && chapter}
          <ChapterDashboard tasks={taskEvaluations} onOpenTask={openTask} />
        {:else if inspectorView.mode === "dashboard"}
          <div class="chapter-overlay__empty-source">
            <p class="chapter-overlay__hint">
              {$t('storyBuilder.overlay.sourceHint')}
            </p>
            <ChapterCameraConfig
              section="source"
              chapterExists={false}
              chapterCanvasIndex={0}
              {canvasIndex}
              {canvasCount}
              {manifestDraft}
              sourceLoaded={Boolean(
                currentManifest && currentManifest === manifestDraft.trim(),
              )}
              {delayMs}
              onManifestInput={handleManifestInput}
              onReloadManifest={() => handleReload()}
              {onSelectCanvas}
              onDelayChange={handleDelaySecondsChange}
              {onCreateChapter}
            />
          </div>
        {/if}

        <section
          class="chapter-overlay__task"
          hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "details"}
          aria-hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "details"}
        >
          <button
            class="chapter-overlay__task-back"
            type="button"
            on:click={returnToDashboard}
          >
            ← {$t('storyBuilder.overlay.backToTools')}
          </button>
          <ChapterTextForm
            section="details"
            {activeLanguage}
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
        </section>

        <section
          class="chapter-overlay__task"
          hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "position"}
          aria-hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "position"}
        >
          <button
            class="chapter-overlay__task-back"
            type="button"
            on:click={returnToDashboard}
          >
            ← {$t('storyBuilder.overlay.backToTools')}
          </button>
          {#if positionSectionAvailable}
            <ChapterPositionSection
              collapsed={positionSectionCollapsed}
              hasSavedPosition={chapterHasSavedPosition}
              {positionDrafts}
              currentViewBox={$viewBox}
              captureAcknowledged={viewUpdateAcknowledged}
              onToggle={() => {
                positionSectionCollapsed = !positionSectionCollapsed;
              }}
              onFieldInput={handlePositionFieldInput}
              onCommit={commitPositionDrafts}
              onCapture={handleUpdateView}
              onGoToPosition={handleRevertView}
            />
          {/if}
        </section>

        <section
          class="chapter-overlay__task"
          hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "media-timing"}
          aria-hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "media-timing"}
        >
          <button
            class="chapter-overlay__task-back"
            type="button"
            on:click={returnToDashboard}
          >
            ← {$t('storyBuilder.overlay.backToTools')}
          </button>
          <div class="chapter-overlay__section chapter-overlay__section--card">
            <div class="chapter-overlay__section-title">
              {mediaTypeValue === "video"
                ? $t('storyBuilder.media.videoTiming')
                : $t('storyBuilder.media.audioTiming')}
            </div>
            <div class="chapter-overlay__wide-tool-note">
              <strong
                >{$t('storyBuilder.media.chooseSegment', {
                  type: mediaTypeValue === 'video'
                    ? $t('media.type.video').toLowerCase()
                    : $t('media.type.audio').toLowerCase(),
                })}</strong
              >
              <span>
                {$t('storyBuilder.media.editorHint', {
                  type: mediaTypeValue === 'video'
                    ? $t('media.type.video').toLowerCase()
                    : $t('media.type.audio').toLowerCase(),
                })}
              </span>
              <ul>
                <li>
                  {$t('storyBuilder.media.dragSelection')}
                </li>
                <li>{$t('storyBuilder.media.dragEdge')}</li>
                <li>
                  {$t('storyBuilder.media.longMediaHint')}
                </li>
                <li>
                  {$t('storyBuilder.media.autoSaveHint')}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section
          class="chapter-overlay__task"
          hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "focus"}
          aria-hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "focus"}
        >
          <button
            class="chapter-overlay__task-back"
            type="button"
            on:click={returnToDashboard}
          >
            ← {$t('storyBuilder.overlay.backToTools')}
          </button>
          <div class="chapter-overlay__section chapter-overlay__section--card">
            <div class="chapter-overlay__section-title">
              {$t('storyBuilder.annotations.drawing')}
            </div>
            <p class="chapter-overlay__hint">
              {$t('storyBuilder.annotations.drawingHint')}
            </p>
            <div
              class="chapter-overlay__annotation-tools"
              aria-label={$t('storyBuilder.annotations.tools')}
            >
              {#each annotationTools as tool}
                <button
                  type="button"
                  class:chapter-overlay__annotation-tool--active={$annotationTool ===
                    tool.id}
                  aria-pressed={$annotationTool === tool.id}
                  on:click={() => onSetAnnotationTool?.(tool.id)}
                >
                  <svelte:component this={tool.icon} aria-hidden="true" />
                  <span>{$t(annotationToolLabelKey(tool.id))}</span>
                </button>
              {/each}
            </div>
          </div>
          {#if selectedDrawingAnnotation}
            <div class="chapter-overlay__section chapter-overlay__section--card chapter-overlay__annotation-editor">
              <div class="chapter-overlay__section-title">{$t('storyBuilder.annotations.edit')}</div>

              <div class="chapter-overlay__field">
                <span>{$t('storyBuilder.annotations.translations')}</span>
                <LanguageTabs
                  {languages}
                  activeLanguage={activeLanguage}
                  ariaLabel={$t('storyBuilder.annotations.translations')}
                  testIdPrefix="drawing-language"
                  onchange={handleLanguageChange}
                />
                <label class="chapter-overlay__translation-field">
                  <small>{activeLanguage.toUpperCase()}</small>
                  <textarea
                    rows="3"
                    value={selectedDrawingAnnotation.label?.[activeLanguage] ?? ""}
                    placeholder={$t('storyBuilder.annotations.textPlaceholder', { language: activeLanguage.toUpperCase() })}
                    on:input={(event) => onSetDrawingAnnotationLabel?.(
                      selectedDrawingAnnotation!.id,
                      activeLanguage,
                      (event.currentTarget as HTMLInputElement).value,
                    )}
                  ></textarea>
                </label>
              </div>

              <div class="chapter-overlay__field">
                <span>{$t('storyBuilder.annotations.colour')}</span>
                <div class="chapter-overlay__annotation-palette">
                  {#each annotationPalette as color}
                    <button
                      type="button"
                      style={`--annotation-color:${color}`}
                      class:chapter-overlay__annotation-swatch--active={(selectedDrawingAnnotation.color ?? "#e07a3f") === color}
                      aria-label={$t('storyBuilder.annotations.setColour', { colour: color })}
                      aria-pressed={(selectedDrawingAnnotation.color ?? "#e07a3f") === color}
                      on:click={() => onSetDrawingAnnotationStyle?.(selectedDrawingAnnotation!.id, { color })}
                    ></button>
                  {/each}
                  <input
                    type="color"
                    value={selectedDrawingAnnotation.color ?? "#e07a3f"}
                    aria-label={$t('storyBuilder.annotations.customColour')}
                    on:input={(event) => onSetDrawingAnnotationStyle?.(
                      selectedDrawingAnnotation!.id,
                      { color: (event.currentTarget as HTMLInputElement).value },
                    )}
                  />
                </div>
              </div>

              {#if selectedDrawingAnnotation.type === "rectangle" || selectedDrawingAnnotation.type === "polygon"}
                <div class="chapter-overlay__field">
                  <span>{$t('storyBuilder.annotations.background')}</span>
                  <div class="chapter-overlay__segmented-control">
                    <button
                      type="button"
                      class:chapter-overlay__segmented-control--active={selectedDrawingAnnotation.fillMode !== "solid"}
                      on:click={() => onSetDrawingAnnotationStyle?.(selectedDrawingAnnotation!.id, { fillMode: "transparent" })}
                    >{$t('storyBuilder.annotations.transparent')}</button>
                    <button
                      type="button"
                      class:chapter-overlay__segmented-control--active={selectedDrawingAnnotation.fillMode === "solid"}
                      on:click={() => onSetDrawingAnnotationStyle?.(selectedDrawingAnnotation!.id, { fillMode: "solid" })}
                    >{$t('storyBuilder.annotations.solid')}</button>
                  </div>
                </div>
              {/if}

              <div class="chapter-overlay__field">
                <span>{$t('storyBuilder.annotations.stroke')}</span>
                <div class="chapter-overlay__segmented-control">
                  {#each ["thin", "medium", "thick"] as width}
                    <button
                      type="button"
                      class:chapter-overlay__segmented-control--active={(selectedDrawingAnnotation.strokeWidth ?? "medium") === width}
                      on:click={() => onSetDrawingAnnotationStyle?.(
                        selectedDrawingAnnotation!.id,
                        { strokeWidth: width as "thin" | "medium" | "thick" },
                      )}
                    >{$t(`storyBuilder.annotations.strokeWidth.${width}`)}</button>
                  {/each}
                </div>
              </div>

              <!--
                Optional on purpose. Leaving it unset keeps the behaviour every
                existing story relies on, where the export infers a motivation
                from whether the shape carries words. Choosing one says
                something the geometry cannot.
              -->
              <div class="chapter-overlay__field">
                <label for="drawing-motivation">
                  {$t('storyBuilder.annotations.motivation')}
                </label>
                <select
                  id="drawing-motivation"
                  value={selectedDrawingAnnotation.motivation ?? ''}
                  on:change={(event) => onSetDrawingAnnotationStyle?.(
                    selectedDrawingAnnotation!.id,
                    {
                      motivation:
                        (event.currentTarget.value ||
                          null) as ChapterDrawingAnnotation["motivation"] | null,
                    },
                  )}
                >
                  <option value="">
                    {$t('storyBuilder.annotations.motivationAuto')}
                  </option>
                  {#each CHAPTER_ANNOTATION_MOTIVATIONS as motivation}
                    <option value={motivation}>
                      {$t(`storyBuilder.annotations.motivations.${motivation}`)}
                    </option>
                  {/each}
                </select>
              </div>
            </div>
          {:else}
            <p class="chapter-overlay__hint">{$t('storyBuilder.annotations.emptySelection')}</p>
          {/if}
        </section>

        {#if chapter}
          <section
            class="chapter-overlay__task"
            hidden={inspectorView.mode !== "task" ||
              inspectorView.task !== "source"}
            aria-hidden={inspectorView.mode !== "task" ||
              inspectorView.task !== "source"}
          >
            <button
              class="chapter-overlay__task-back"
              type="button"
              on:click={returnToDashboard}
            >
              ← {$t('storyBuilder.overlay.backToTools')}
            </button>
            <ChapterCameraConfig
              section="source"
              chapterExists={true}
              chapterCanvasIndex={chapter.canvasIndex}
              {canvasIndex}
              {canvasCount}
              {manifestDraft}
              {delayMs}
              onManifestInput={handleManifestInput}
              onReloadManifest={() => handleReload()}
              {onSelectCanvas}
              onDelayChange={handleDelaySecondsChange}
            />
          </section>
        {/if}

        <section
          class="chapter-overlay__task"
          hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "layers"}
          aria-hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "layers"}
        >
          <button
            class="chapter-overlay__task-back"
            type="button"
            on:click={returnToDashboard}
          >
            ← {$t('storyBuilder.overlay.backToTools')}
          </button>
          {#if manifestSupportsLayers}
            <div
              class="chapter-overlay__section chapter-overlay__section--card"
            >
              <div class="chapter-overlay__section-header">
                <div class="chapter-overlay__section-title">{$t('viewer.panels.layers.title')}</div>
              </div>
              <div class="chapter-overlay__section-content">
                {#each layers as layer, index (layer.id)}
                  {@const opacity =
                    layerOpacities[layer.id] !== undefined
                      ? layerOpacities[layer.id]
                      : index === 0
                        ? 1.0
                        : 0.0}
                  <div class="chapter-overlay__layer-item">
                    <div class="chapter-overlay__layer-info">
                      <span class="chapter-overlay__layer-name">
                        {layer.label ||
                          (index === 0
                            ? $t('viewer.panels.layers.baseImage')
                            : $t('viewer.panels.layers.layerNumber', { number: index + 1 }))}
                      </span>
                      <span class="chapter-overlay__layer-value"
                        >{Math.round(opacity * 100)}%</span
                      >
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
        </section>

        <section
          class="chapter-overlay__task"
          hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "audio-timing"}
          aria-hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "audio-timing"}
        >
          <button
            class="chapter-overlay__task-back"
            type="button"
            on:click={returnToDashboard}
          >
            ← {$t('storyBuilder.overlay.backToTools')}
          </button>
          <div class="chapter-overlay__wide-tool-note">
            <strong>{$t('storyBuilder.narration.editor')}</strong>
            <span
              >{$t('storyBuilder.narration.editorHint')}</span
            >
          </div>
          <div class="chapter-overlay__narration-compat">
            <ChapterTimelineSection
              {activeLanguage}
              {hasAvMedia}
              {marksValid}
              {markInDraft}
              {markOutDraft}
              {activeNarrationUrl}
              {narrationSectionCollapsed}
              {avSectionCollapsed}
              {narrationPreviewing}
              {narrationPreviewLanguage}
              narrationStartDraft={narrationStartDrafts[activeLanguage] ?? ""}
              narrationEndDraft={narrationEndDrafts[activeLanguage] ?? ""}
              bind:currentNarrationAudioRef
              {parseHms}
              onToggleNarration={() => {
                narrationSectionCollapsed = !narrationSectionCollapsed;
              }}
              onNarrationTrackInput={handleNarrationTrackInput}
              onNarrationTimeUpdate={handleNarrationTimeUpdate(activeLanguage)}
              onNarrationLoadedMetadata={handleNarrationLoadedMetadata(
                activeLanguage,
              )}
              onToggleNarrationPlayback={toggleNarrationSegmentPlayback(
                activeLanguage,
              )}
              onNarrationStartInput={handleNarrationStartInput}
              onNarrationEndInput={handleNarrationEndInput}
              onNarrationMarksCommit={commitNarrationMarks(activeLanguage)}
              onUseNarrationStartCurrent={useNarrationCurrentTime(
                activeLanguage,
                "start",
              )}
              onUseNarrationEndCurrent={useNarrationCurrentTime(
                activeLanguage,
                "end",
              )}
              onSkipNarration={() => onSkipNarration?.(activeLanguage)}
              onToggleAv={() => {
                avSectionCollapsed = !avSectionCollapsed;
              }}
              onCommitMediaMarks={commitMediaMarks}
              onMarkInInput={handleMarkInInput}
              onMarkOutInput={handleMarkOutInput}
              onUseMarkInCurrent={() => useCurrentTime("in")}
              onUseMarkOutCurrent={() => useCurrentTime("out")}
              onPreviewMedia={onPreviewMediaSegment}
              onStopPreviewMedia={onStopPreviewMediaSegment}
            />
          </div>
        </section>

        <section
          class="chapter-overlay__task"
          hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "transition-timing"}
          aria-hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "transition-timing"}
        >
          <button
            class="chapter-overlay__task-back"
            type="button"
            on:click={returnToDashboard}
          >
            ← {$t('storyBuilder.overlay.backToTools')}
          </button>
          <ChapterCameraConfig
            section="transition-timing"
            chapterExists={Boolean(chapter)}
            chapterCanvasIndex={chapter?.canvasIndex ?? 0}
            {manifestDraft}
            {delayMs}
            onManifestInput={handleManifestInput}
            onReloadManifest={() => handleReload()}
            onDelayChange={handleDelaySecondsChange}
          />
        </section>

        <section
          class="chapter-overlay__task"
          hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "motion"}
          aria-hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "motion"}
        >
          <button
            class="chapter-overlay__task-back"
            type="button"
            on:click={returnToDashboard}
          >
            ← {$t('storyBuilder.overlay.backToTools')}
          </button>
          <ChapterMotionPanel
            track={chapter?.cameraTrack}
            previewing={motionPreviewing}
            onUpdateDuration={(durationMs) =>
              onUpdateMotionDuration?.(durationMs)}
            onUpdatePathType={(pathType) => onUpdateMotionPathType?.(pathType)}
            onUpdateDwell={(dwellMs) => onUpdateMotionInitialDwell?.(dwellMs)}
            onUpdateEasing={(easing) => onUpdateMotionEasing?.(easing)}
            onApplyPreset={(preset) => onApplyMotionPreset?.(preset)}
            onPreview={() => onPreviewMotion?.()}
            onStopPreview={() => onStopMotionPreview?.()}
          />
        </section>

        <section
          class="chapter-overlay__task"
          hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "comparison"}
          aria-hidden={inspectorView.mode !== "task" ||
            inspectorView.task !== "comparison"}
        >
          <button
            class="chapter-overlay__task-back"
            type="button"
            on:click={returnToDashboard}
          >
            ← {$t('storyBuilder.overlay.backToTools')}
          </button>
          <div class="chapter-overlay__section chapter-overlay__section--card">
            <div class="chapter-overlay__section-title">{$t('storyBuilder.tasks.items.comparison.title')}</div>
            <p class="chapter-overlay__hint">
              {$t('storyBuilder.comparison.hint')}
            </p>
          </div>
        </section>
      </div>
      {#if inspectorView.mode === "task"}
        <div class="chapter-overlay__actions">
          <div class="chapter-overlay__actions-group">
            <button
              class="chapter-overlay__button chapter-overlay__button--accent"
              type="button"
              data-testid="chapter-save"
              disabled={saveDisabled}
              on:click={handleSave}
            >
              {saveAcknowledged
                ? $t('storyBuilder.topBar.saved')
                : inspectorView.mode === "task"
                  ? $t(`storyBuilder.tasks.items.${inspectorView.task}.save`)
                  : $t('storyBuilder.overlay.saveChapter')}
            </button>
            {#if inspectorView.mode === "task" && inspectorView.task === "focus"}
              <button
                class="chapter-overlay__button chapter-overlay__button--subtle"
                type="button"
                data-testid="chapter-cancel"
                on:click={handleCancel}
              >
                {$t('storyBuilder.chapters.cancel')}
              </button>
            {/if}
            {#if docked}
              <button
                class="chapter-overlay__button chapter-overlay__button--subtle"
                type="button"
                data-testid="chapter-revert-view"
                disabled={saveDisabled}
                on:click={handleRevertView}
              >
                {$t('storyBuilder.overlay.revertView')}
              </button>
            {/if}
          </div>
          {#if saveDisabled}
            <div class="chapter-overlay__hint">
              {$t('storyBuilder.chapter.saveHint')}
            </div>
          {/if}
        </div>
      {:else if chapter}
        <div class="chapter-overlay__dashboard-hint">
          {$t('storyBuilder.tasks.description')}
        </div>
        <button
          class="chapter-overlay__dashboard-save-compat"
          type="button"
          data-testid="chapter-save"
          tabindex="-1"
          aria-hidden="true"
          on:click={handleSave}>{$t('storyBuilder.overlay.saveChapter')}</button
        >
      {/if}
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

    .chapter-overlay--docked {
      position: relative;
      inset: auto;
      display: block;
      height: 100%;
      pointer-events: auto;
    }

    .chapter-overlay--docked .chapter-overlay__panel {
      width: 100%;
      max-width: none;
      border-left: 0;
      background: var(--viewer-panel, #121922);
    }

    .chapter-overlay--docked .chapter-overlay__header {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .chapter-overlay--docked .chapter-overlay__form {
      padding: 14px 14px 22px;
    }

    .chapter-overlay__scrim {
      position: absolute;
      inset: 0;
      background: var(--viewer-well-bg, rgba(5, 10, 22, 0.18));
      pointer-events: auto;
    }

    .chapter-overlay__panel {
      position: relative;
      pointer-events: auto;
      width: clamp(360px, 42cqw, 500px);
      max-width: 92cqw;
      height: 100%;
      min-height: 100%;
      align-self: stretch;
      border-radius: 0;
      border-left: 1px solid
        var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
      background: var(--viewer-panel, #121922);
      color: var(--viewer-text, #e8edf4);
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
      background: var(--viewer-panel, #121922);
      border-bottom: 1px solid
        var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    }

    .chapter-overlay__eyebrow {
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--viewer-muted, #9aa6b2);
    }

    .chapter-overlay__title {
      font-size: 18px;
      font-weight: 600;
      color: var(--viewer-text, #e8edf4);
      letter-spacing: 0.01em;
    }

    .chapter-overlay__preview-chapter {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      width: 100%;
      border: 1px solid color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 48%, transparent);
      border-radius: 11px;
      padding: 10px 12px;
      background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 10%, transparent);
      color: var(--viewer-text, #e8edf4);
      text-align: left;
      cursor: pointer;
    }

    .chapter-overlay__preview-chapter:hover,
    .chapter-overlay__preview-chapter:focus-visible {
      border-color: var(--accent, var(--story-builder-accent, #e07a3f));
      background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 16%, transparent);
    }

    .chapter-overlay__preview-chapter :global(svg) {
      width: 17px;
      height: 17px;
      color: var(--accent, var(--story-builder-accent, #e07a3f));
    }

    .chapter-overlay__preview-chapter span {
      display: grid;
      gap: 2px;
    }

    .chapter-overlay__preview-chapter strong {
      font-size: 12px;
    }

    .chapter-overlay__preview-chapter small {
      color: var(--viewer-muted, #9aa6b2);
      font-size: 10px;
      line-height: 1.35;
    }

    .chapter-overlay__back {
      border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
      border-radius: 10px;
      padding: 8px 10px;
      background: var(--viewer-panel-strong, #1b242e);
      color: var(--viewer-text, #e8edf4);
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
      border: 1px solid
        var(--viewer-close-button-border, rgba(255, 255, 255, 0.18));
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
      background: var(
        --viewer-close-button-hover-bg,
        rgba(255, 255, 255, 0.16)
      );
      border-color: var(
        --viewer-close-button-hover-border,
        rgba(255, 255, 255, 0.34)
      );
    }

    .chapter-overlay__close:focus-visible {
      outline: 2px solid
        var(--viewer-close-button-focus-ring, rgba(42, 199, 255, 0.55));
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

    .chapter-overlay__dashboard-hint {
      margin-top: auto;
      padding: 14px 0 2px;
      border-top: 1px solid
        var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
      color: var(--viewer-muted, #9aa6b2);
      font-size: 11px;
    }

    .chapter-overlay__dashboard-save-compat {
      display: none;
    }

    .chapter-overlay__wide-tool-note {
      display: grid;
      gap: 4px;
      padding: 13px;
      border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
      border-radius: 10px;
      background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 7%, transparent);
    }

    .chapter-overlay__wide-tool-note strong {
      font-size: 12px;
    }
    .chapter-overlay__wide-tool-note span {
      color: var(--viewer-muted, #9aa6b2);
      font-size: 10px;
      line-height: 1.4;
    }
    .chapter-overlay__wide-tool-note ul {
      display: grid;
      gap: 7px;
      margin: 6px 0 0;
      padding-left: 17px;
      color: var(--viewer-muted, #9aa6b2);
      font-size: 10px;
      line-height: 1.45;
    }
    .chapter-overlay__narration-compat {
      display: none;
    }
    .chapter-overlay__annotation-tools {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
      margin-top: 11px;
    }
    .chapter-overlay__annotation-tools button {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 7px;
      border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
      border-radius: 8px;
      padding: 8px;
      background: transparent;
      color: var(--viewer-muted, #9aa6b2);
      font-size: 10px;
      cursor: pointer;
    }
    .chapter-overlay__annotation-tools button :global(svg) {
      flex: 0 0 auto;
      width: 14px;
      height: 14px;
    }
    .chapter-overlay__annotation-tools
      .chapter-overlay__annotation-tool--active {
      border-color: var(--viewer-accent-2, #2ac7ff);
      background: color-mix(in srgb, var(--viewer-accent-2, #2ac7ff) 12%, transparent);
      color: var(--viewer-text, #e8edf4);
    }
    .chapter-overlay__annotation-editor { display:grid; gap:14px; }
    .chapter-overlay__field { display:grid; gap:7px; color:var(--viewer-muted, #9aa6b2); font-size:10px; font-weight:700; }
    .chapter-overlay__translation-field { display:grid; grid-template-columns:28px minmax(0,1fr); align-items:center; gap:7px; }
    .chapter-overlay__translation-field small { color:var(--viewer-muted, #9aa6b2); font-size:9px; }
    .chapter-overlay__translation-field :is(input, textarea) { min-width:0; box-sizing:border-box; border:1px solid var(--viewer-panel-border, rgba(255,255,255,.1)); border-radius:8px; padding:8px 9px; background:var(--viewer-well-bg, rgba(4, 9, 15, 0.35)); color:var(--viewer-text, #e8edf4); font:inherit; }
    .chapter-overlay__translation-field textarea { resize:vertical; line-height:1.4; }
    .chapter-overlay__annotation-palette { display:flex; flex-wrap:wrap; align-items:center; gap:7px; }
    .chapter-overlay__annotation-palette button { width:25px; height:25px; border:2px solid transparent; border-radius:999px; background:var(--annotation-color); cursor:pointer; }
    .chapter-overlay__annotation-palette .chapter-overlay__annotation-swatch--active { border-color:var(--viewer-text, #fff); box-shadow:0 0 0 2px var(--annotation-color); }
    .chapter-overlay__annotation-palette input[type="color"] { width:30px; height:27px; padding:1px; border:1px solid var(--viewer-panel-border, rgba(255,255,255,.1)); border-radius:7px; background:transparent; cursor:pointer; }
    .chapter-overlay__segmented-control { display:flex; gap:5px; }
    .chapter-overlay__segmented-control button { flex:1; border:1px solid var(--viewer-panel-border, rgba(255,255,255,.1)); border-radius:8px; padding:7px; background:transparent; color:var(--viewer-muted, #9aa6b2); text-transform:capitalize; cursor:pointer; }
    .chapter-overlay__segmented-control .chapter-overlay__segmented-control--active { border-color:var(--accent, var(--story-builder-accent, #e07a3f)); background:color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 14%, transparent); color:var(--viewer-text, #e8edf4); }

    .chapter-overlay__task {
      display: grid;
      gap: 12px;
    }

    .chapter-overlay__task[hidden] {
      display: none;
    }

    .chapter-overlay__task-back {
      justify-self: start;
      border: 0;
      padding: 4px 0;
      background: transparent;
      color: var(--viewer-muted, #9aa6b2);
      font-size: 12px;
      font-weight: 650;
      cursor: pointer;
    }

    .chapter-overlay__task-back:hover,
    .chapter-overlay__task-back:focus-visible {
      color: var(--viewer-text, #e8edf4);
    }

    .chapter-overlay__section {
      display: grid;
      gap: 12px;
    }

    .chapter-overlay__section--card {
      padding: 16px;
      border-radius: 12px;
      border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
      background: var(--viewer-surface, #151d26);
    }

    .chapter-overlay__section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--viewer-muted, #9aa6b2);
      font-weight: 700;
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

    .chapter-overlay__language-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chapter-overlay__language-tab {
      min-width: 48px;
      border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
      border-radius: 9px;
      padding: 8px 10px;
      background: var(--viewer-panel-strong, #1b242e);
      color: var(--viewer-muted, #9aa6b2);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .chapter-overlay__language-tab--active {
      border-color: var(--accent, var(--story-builder-accent, #e07a3f));
      background: color-mix(in srgb, var(--story-builder-accent, #e07a3f) 16%, transparent);
      /*
       * A 16% tint, so the label sits on the panel colour rather than on the
       * accent — white would disappear on the light themes' pale tint.
       */
      color: var(--viewer-text, #fff);
    }

    .chapter-overlay__collapse-toggle {
      width: 26px;
      height: 26px;
      border-radius: 9px;
      border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
      background: var(--viewer-panel-strong, #1b242e);
      color: var(--viewer-text, #e8edf4);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition:
        border-color 0.16s ease,
        background 0.16s ease;
    }

    .chapter-overlay__collapse-toggle:hover {
      border-color: color-mix(
        in srgb,
        var(--viewer-muted, #9aa6b2) 55%,
        transparent
      );
      background: color-mix(
        in srgb,
        var(--viewer-panel-strong, #1b242e) 80%,
        white
      );
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
      color: var(--viewer-muted, #9aa6b2);
    }

    .chapter-overlay__label--inline {
      width: 100%;
    }

    .chapter-overlay__hint {
      font-size: 12px;
      line-height: 1.45;
      color: var(--viewer-muted, #9aa6b2);
    }

    .chapter-overlay__validation {
      padding: 12px 14px;
      border: 1px solid color-mix(in srgb, var(--viewer-danger, #ffb8b8) 35%, transparent);
      border-radius: 12px;
      background: color-mix(in srgb, var(--viewer-danger, #ffb8b8) 10%, transparent);
      color: var(--viewer-danger, #ffd0d0);
      font-size: 12px;
    }

    .chapter-overlay__validation ul {
      margin: 6px 0 0;
      padding-left: 18px;
    }

    .chapter-overlay__input,
    .chapter-overlay__select,
    .chapter-overlay__textarea {
      border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
      border-radius: 12px;
      padding: 10px 12px;
      background: var(--viewer-panel, #121922);
      color: var(--viewer-text, #e8edf4);
      font-size: 13px;
      outline: none;
    }

    .chapter-overlay__input::placeholder,
    .chapter-overlay__textarea::placeholder {
      color: color-mix(in srgb, var(--viewer-muted, #9aa6b2) 45%, transparent);
    }

    .chapter-overlay__input:focus,
    .chapter-overlay__select:focus,
    .chapter-overlay__textarea:focus {
      border-color: var(--accent, var(--story-builder-accent, #e07a3f));
      box-shadow: 0 0 0 2px
        color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 18%, transparent);
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

    .chapter-overlay__onboarding-finish {
      display: grid;
      gap: 10px;
    }

    .chapter-overlay__onboarding-finish .chapter-overlay__button {
      justify-self: start;
    }

    .chapter-overlay__button {
      border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
      border-radius: 11px;
      padding: 8px 12px;
      background: var(--viewer-panel-strong, #1b242e);
      color: var(--viewer-text, #e8edf4);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      cursor: pointer;
      transition:
        background 0.16s ease,
        border-color 0.16s ease;
      white-space: nowrap;
    }

    .chapter-overlay__button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .chapter-overlay__button--primary,
    .chapter-overlay__button--accent {
      background: var(--accent, var(--story-builder-accent, #e07a3f));
      border-color: transparent;
      color: #fff;
    }

    .chapter-overlay__button--subtle {
      background: var(--viewer-panel-strong, #1b242e);
    }

    .chapter-overlay__button:not(:disabled):hover {
      background: color-mix(
        in srgb,
        var(--viewer-panel-strong, #1b242e) 82%,
        white
      );
      border-color: color-mix(
        in srgb,
        var(--viewer-muted, #9aa6b2) 45%,
        transparent
      );
    }

    .chapter-overlay__button--primary:not(:disabled):hover,
    .chapter-overlay__button--accent:not(:disabled):hover {
      /*
       * Darken on hover rather than lighten. These fills carry white labels, so
       * mixing toward white pushed the label under 4.5:1 exactly when the
       * pointer was on it; mixing toward black raises it instead.
       */
      background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 86%, black);
    }

    .chapter-overlay__audio-source {
      display: none;
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

    .chapter-overlay__timerow .chapter-overlay__input,
    .chapter-overlay__timerow .chapter-overlay__button {
      box-sizing: border-box;
      height: 38px;
    }

    .chapter-overlay__placement-editor {
      position: relative;
      width: 100%;
      height: 168px;
      border-radius: 12px;
      border: 1px solid color-mix(in srgb, var(--viewer-text, #e8edf4) 14%, transparent);
      background:
        linear-gradient(
          to right,
          color-mix(in srgb, var(--viewer-text, #e8edf4) 6%, transparent) 1px,
          transparent 1px
        ),
        linear-gradient(
          to bottom,
          color-mix(in srgb, var(--viewer-text, #e8edf4) 6%, transparent) 1px,
          transparent 1px
        ),
        var(--viewer-panel, #121922);
      background-size:
        16px 16px,
        16px 16px,
        auto;
      overflow: hidden;
    }

    .chapter-overlay__hint--placement {
      margin-top: -2px;
    }

    .chapter-overlay__actions {
      position: sticky;
      bottom: -22px;
      z-index: 2;
      display: grid;
      gap: 8px;
      margin: 0 -18px -22px;
      padding: 12px 18px 18px;
      border-top: 1px solid color-mix(in srgb, var(--viewer-text, #e8edf4) 10%, transparent);
      background: var(--viewer-panel, #121922);
    }

    .chapter-overlay__actions-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chapter-overlay__actions-group .chapter-overlay__button {
      flex: 1 1 150px;
    }

    .chapter-overlay__layer-item {
      display: grid;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--viewer-text, #e8edf4) 4%, transparent);
      border: 1px solid color-mix(in srgb, var(--viewer-text, #e8edf4) 3%, transparent);
      transition:
        background-color 0.2s ease,
        border-color 0.2s ease;
    }

    .chapter-overlay__layer-item:hover {
      background: color-mix(in srgb, var(--viewer-text, #e8edf4) 6%, transparent);
      border-color: color-mix(in srgb, var(--viewer-text, #e8edf4) 6%, transparent);
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
      color: color-mix(in srgb, var(--viewer-text, #e8edf4) 90%, transparent);
    }

    .chapter-overlay__layer-value {
      font-weight: 600;
      color: var(--viewer-muted, #9aa6b2);
      font-variant-numeric: tabular-nums;
    }

    .chapter-overlay__layer-slider {
      width: 100%;
      accent-color: var(--accent, var(--story-builder-accent, #e07a3f));
      cursor: pointer;
      background: color-mix(in srgb, var(--viewer-text, #e8edf4) 10%, transparent);
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

      .chapter-overlay__timerow,
      .chapter-overlay__row {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
