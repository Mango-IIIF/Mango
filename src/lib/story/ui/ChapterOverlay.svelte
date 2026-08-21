<script lang="ts">
  import { onDestroy } from "svelte";
  import { Play, Square } from "@lucide/svelte";
  import { readable, type Readable } from "svelte/store";
  import {
    type AnnotationPlacement,
    type ChapterAdvance,
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
  import ChapterPositionSection from "./ChapterPositionSection.svelte";
  import ChapterCameraConfig from "./ChapterCameraConfig.svelte";
  import InspectorSection from "./InspectorSection.svelte";
  import {
    evaluateChapterTasks,
    INSPECTOR_GROUPS,
    inspectorGroupForTask,
    isStageTool,
    type ChapterTaskEvaluation,
    type ChapterTaskId,
    type InspectorGroup,
  } from "../chapterTasks";
  import { resolvePresentationAspect } from "../framing";
  import { applyFrameField } from "../frameGeometry";
  import { t } from '../../core/i18n';

  export let story: Readable<StoryState>;
  export let layers: MediaSource[] = [];
  export let layerOpacities: Record<string, number> = {};
  export let onUpdateLayerOpacity:
    ((id: string, opacity: number) => void) | undefined = undefined;

  let manifestSupportsLayers = false;
  /* Comparison authoring remains implemented but is not ready to expose in
     Chapter tools yet. Keep this gate local so the section can be restored
     without removing its task evaluation or UI implementation. */
  const SHOW_COMPARISON_TOOL = false;
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
  export let onUpdateManifest:
    ((chapterId: string, manifest: string) => void) | undefined;
  export let onLoadManifest: ((manifest: string) => void) | undefined;
  export let onCreateChapter: (() => void) | undefined;
  export let onReloadManifest:
    | ((chapterId: string, manifest: string, canvasIndex: number) => void)
    | undefined;
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
  export let onSetChapterPosition:
    ((chapterId: string, viewBox: ViewBox) => void) | undefined = undefined;
  export let storyPreviewing: Readable<boolean> = readable(false);
  export let onPreviewChapter: ((chapterId: string) => void) | undefined =
    undefined;
  export let onStopChapterPreview: (() => void) | undefined = undefined;
  export let onRevertChapterPosition: ((chapterId: string) => void) | undefined;
  export let onSave: (() => void) | undefined;
  export let onCancel: (() => void) | undefined;
  /** Re-reads the chapter from the viewer after its source or canvas changed. */
  export let onChapterTaskChange:
    ((task: ChapterTaskId | null) => void) | undefined = undefined;

  let activeLanguage = language;
  let lastLanguageProp = language;
  let chapter: StoryState["chapters"][number] | null = null;
  let chapterValidationErrors: string[] = [];
  let chapterTitleDraft = "";

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
  let taskEvaluations: ChapterTaskEvaluation[] = [];
  let chapterIndex = -1;
  let chapterHasSavedPosition = false;

  /*
   * Exact by design. This keys "has the stored framing changed at all", which
   * decides whether to overwrite the author's in-progress form entry — a
   * tolerance here would silently discard a small manual edit. Use
   * `framingsWithin` when the question is whether the viewer has arrived
   * somewhere.
   */
  const positionSignature = (value: ViewBox | null | undefined): string =>
    value ? `${value.x}:${value.y}:${value.w}:${value.h}` : "";

  /*
   * One inspector, three groups, no back button. Everything about the
   * selected chapter is stacked under About, Timing and Source; the sections
   * that work on the stage — drawing, camera points, narration, media timing
   * — open their tool in place and the inspector follows the open tool into
   * its group, so a tool started from elsewhere (the annotation list, say) is
   * never out of sight.
  */
  let inspectorGroup: InspectorGroup = "about";
  let collapsedSections: Partial<Record<ChapterTaskId, boolean>> = {
    position: true,
    "transition-timing": true,
    layers: true,
    comparison: true,
  };

  const selectGroup = (group: InspectorGroup) => {
    inspectorGroup = group;
  };

  const toggleSection = (task: ChapterTaskId) => {
    collapsedSections = {
      ...collapsedSections,
      [task]: !collapsedSections[task],
    };
  };

  /*
   * Keyed for the template. A lookup function would hide the dependency on
   * `taskEvaluations` from the compiler, and a section rendered before the
   * viewer had settled on a media type would never learn that it had.
   */
  let evaluations: Partial<Record<ChapterTaskId, ChapterTaskEvaluation>> = {};
  $: evaluations = Object.fromEntries(
    taskEvaluations.map((evaluation) => [evaluation.id, evaluation]),
  ) as Partial<Record<ChapterTaskId, ChapterTaskEvaluation>>;
  const evaluationFor = (task: ChapterTaskId): ChapterTaskEvaluation | undefined =>
    evaluations[task];

  const activateTool = (task: ChapterTaskId) => {
    if (evaluationFor(task)?.availability.state !== "available") return;
    collapsedSections = { ...collapsedSections, [task]: false };
    onChapterTaskChange?.(task);
  };

  /** Closes whatever tool is open on the stage, keeping its edits. */
  const finishTool = () => {
    handleSave();
  };

  let followedTask: ChapterTaskId | null = null;
  $: {
    const task = $activeChapterTask;
    if (task && task !== followedTask) {
      const previousTask = followedTask;
      followedTask = task;
      inspectorGroup = inspectorGroupForTask(task);
      collapsedSections = {
        ...collapsedSections,
        ...(previousTask === "position" || task !== "position"
          ? { position: true }
          : {}),
        [task]: false,
      };
    } else if (!task) {
      if (followedTask === "position") {
        collapsedSections = { ...collapsedSections, position: true };
      }
      followedTask = null;
    }
  }

  let inspectorChapterId: string | null = null;
  $: if (chapterId !== inspectorChapterId) {
    inspectorChapterId = chapterId;
    collapsedSections = {
      ...collapsedSections,
      position: true,
      "transition-timing": true,
    };
    onChapterTaskChange?.(null);
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
  let narrationSectionCollapsed = false;
  let avSectionCollapsed = false;
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

  /*
   * A typed width or height pulls the other dimension along as the author
   * types, so the pair on screen always describes a frame the story can hold.
   * The frame's shape is locked to the story's presentation aspect; the
   * readout says so rather than quietly rewriting numbers on commit.
   */
  const handlePositionFieldInput = (
    field: "x" | "y" | "w" | "h",
    value: string,
  ) => {
    const next = { ...positionDrafts, [field]: value };
    const numeric = Number(value);
    if (
      presentationAspect &&
      value.trim() !== "" &&
      Number.isFinite(numeric) &&
      numeric > 0
    ) {
      if (field === "w") next.h = formatPositionValue(numeric / presentationAspect);
      if (field === "h") next.w = formatPositionValue(numeric * presentationAspect);
    }
    positionDrafts = next;
  };

  const commitPositionField = (field: "x" | "y" | "w" | "h") => {
    if (!chapterId || !chapter) return;
    const drafts = positionDrafts;
    const value = Number(drafts[field]);
    const valid =
      drafts[field].trim() !== "" &&
      Number.isFinite(value) &&
      (field === "x" || field === "y" || value > 0);
    if (!valid) {
      if (chapter.viewBox) {
        positionDrafts = positionDraftsFromViewBox(chapter.viewBox);
      }
      return;
    }
    if (chapter.viewBox) {
      const next = applyFrameField(
        chapter.viewBox,
        field,
        value,
        presentationAspect ?? Number.NaN,
      );
      if (positionSignature(next) === positionSignature(chapter.viewBox)) return;
      onSetChapterPosition?.(chapterId, next);
      return;
    }
    // No frame yet: the chapter needs all four numbers before it has one.
    const parsed = {
      x: Number(drafts.x),
      y: Number(drafts.y),
      w: Number(drafts.w),
      h: Number(drafts.h),
    };
    if (
      [drafts.x, drafts.y, drafts.w, drafts.h].every((entry) => entry.trim() !== "") &&
      [parsed.x, parsed.y, parsed.w, parsed.h].every(Number.isFinite) &&
      parsed.w > 0 &&
      parsed.h > 0
    ) {
      onSetChapterPosition?.(chapterId, parsed);
    }
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
  $: presentationAspect =
    $story.chapters.length > 0 || $story.presentationAspect
      ? resolvePresentationAspect($story)
      : null;
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
    onSave?.();
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

  /*
   * One line each for the stage tools while they are closed, so the inspector
   * says what a chapter has without the tool having to be opened to find out.
   */
  $: motionSummary = (() => {
    const track = chapter?.cameraTrack;
    const count = track?.keyframes.length ?? 0;
    if (count === 0) return $t('storyBuilder.inspector.motionNone');
    const style = $t(`storyBuilder.motion.preset.${track?.preset ?? "custom"}`);
    const seconds = Math.round((track?.durationMs ?? 0) / 100) / 10;
    return $t('storyBuilder.inspector.motionSummary', { count, style, seconds });
  })();
  $: narrationSummary = (() => {
    const segment = chapter?.narrationSegment?.[activeLanguage];
    if (!segment || !(segment.end > segment.start)) {
      return $t('storyBuilder.inspector.narrationNone', {
        language: activeLanguage.toUpperCase(),
      });
    }
    return $t('storyBuilder.inspector.narrationSummary', {
      language: activeLanguage.toUpperCase(),
      start: formatHms(segment.start),
      end: formatHms(segment.end),
    });
  })();
  $: mediaSummary = chapter?.media
    ? $t('storyBuilder.inspector.mediaSummary', {
        start: formatHms(chapter.media.start),
        end: formatHms(chapter.media.end),
      })
    : $t('storyBuilder.inspector.mediaWhole');

  $: {
    const nextSyncKey = `${open ? "1" : "0"}:${chapterId ?? ""}:${activeLanguage}`;
    if (nextSyncKey !== lastSectionSyncKey) {
      lastSectionSyncKey = nextSyncKey;
      narrationSectionCollapsed = false;
      avSectionCollapsed = !hasValidRange(markInDraft, markOutDraft);
    }
  }

  onDestroy(() => {
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
    if (!open || event.key !== "Escape") return;
    const task = $activeChapterTask;
    if (task && isStageTool(task)) {
      // Drawing is a transaction; leaving it by Escape discards, as Cancel does.
      if (task === "focus") onCancel?.();
      else onChapterTaskChange?.(null);
      return;
    }
    onClose?.();
  }}
/>

<div
  class="chapter-overlay"
  class:chapter-overlay--docked={docked}
  class:chapter-overlay--annotation-task={$activeChapterTask === "focus"}
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
        <div class="chapter-overlay__title" id="chapter-overlay-title">
          {chapter
            ? chapterTitleDraft.trim() || $t('storyBuilder.tasks.title')
            : $t('storyBuilder.overlay.loadSource')}
        </div>
      </div>
      {#if chapter && $activeChapterTask !== "focus"}
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
      {#if chapterValidationErrors.length > 0}
        <div class="chapter-overlay__validation" role="alert">
          <strong>{$t('storyBuilder.tasks.status.attention')}</strong>
          <ul>
            {#each chapterValidationErrors as message}
              <li>{message}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if !chapter}
        <div class="chapter-overlay__body">
          <div class="chapter-overlay__empty-source">
            <p class="chapter-overlay__hint">
              {$t('storyBuilder.overlay.sourceHint')}
            </p>
            <ChapterCameraConfig
              chapterExists={false}
              chapterCanvasIndex={0}
              {manifestDraft}
              sourceLoaded={Boolean(
                currentManifest && currentManifest === manifestDraft.trim(),
              )}
              onManifestInput={handleManifestInput}
              onReloadManifest={() => handleReload()}
              {onCreateChapter}
            />
          </div>
        </div>
      {:else}
        {#if $activeChapterTask !== "focus"}
          <div class="chapter-inspector__groups" role="tablist" aria-label={$t('storyBuilder.inspector.groupsLabel')}>
            {#each INSPECTOR_GROUPS as group (group)}
              <button
                class="chapter-inspector__group"
                class:chapter-inspector__group--active={inspectorGroup === group}
                type="button"
                role="tab"
                aria-selected={inspectorGroup === group}
                data-testid={`inspector-group-${group}`}
                on:click={() => selectGroup(group)}
              >
                {$t(`storyBuilder.inspector.groups.${group}`)}
              </button>
            {/each}
          </div>
        {/if}

        <div class="chapter-overlay__body chapter-inspector__sections" role="tabpanel">
          {#if inspectorGroup === "about"}
            {#if $activeChapterTask !== "focus"}
            <InspectorSection
              id="details"
              title={$t('storyBuilder.tasks.items.details.title')}
              status={evaluations["details"]?.status}
              availability={evaluations["details"]?.availability ?? { state: "available" }}
              collapsed={Boolean(collapsedSections.details)}
              onToggle={() => toggleSection("details")}
            >
              <ChapterTextForm
                {activeLanguage}
                {languages}
                {chapterTitleDraft}
                {chapterDescriptionDraft}
                onLanguageChange={handleLanguageChange}
                onChapterTitleInput={handleChapterTitleInput}
                onChapterDescriptionInput={handleChapterDescriptionInput}
              />
            </InspectorSection>

            <InspectorSection
              id="position"
              title={$t('storyBuilder.tasks.items.position.title')}
              status={evaluations["position"]?.status}
              availability={evaluations["position"]?.availability ?? { state: "available" }}
              collapsed={Boolean(collapsedSections.position)}
              onToggle={() => toggleSection("position")}
              active={$activeChapterTask === "position"}
              activateLabel={$t('storyBuilder.inspector.adjust')}
              onActivate={() => activateTool("position")}
              onDone={finishTool}
            >
              {#if positionSectionAvailable}
                <ChapterPositionSection
                  hasSavedPosition={chapterHasSavedPosition}
                  {positionDrafts}
                  aspect={presentationAspect}
                  onFieldInput={handlePositionFieldInput}
                  onCommit={commitPositionField}
                  onGoToPosition={handleRevertView}
                />
              {/if}
            </InspectorSection>
            {/if}

            <InspectorSection
              id="focus"
              title={$t('storyBuilder.tasks.items.focus.title')}
              status={evaluations["focus"]?.status}
              availability={evaluations["focus"]?.availability ?? { state: "available" }}
              collapsed={Boolean(collapsedSections.focus)}
              onToggle={() => toggleSection("focus")}
              active={$activeChapterTask === "focus"}
              activateLabel={$t('storyBuilder.inspector.open')}
              onActivate={() => activateTool("focus")}
              onDone={finishTool}
            >
              <p class="chapter-overlay__hint" data-testid="inspector-summary-focus">
                {$t('storyBuilder.inspector.annotationsSummary', {
                  count: chapter.drawingAnnotations?.length ?? 0,
                })}
              </p>
            </InspectorSection>
          {:else if inspectorGroup === "timing"}
            <InspectorSection
              id="transition-timing"
              title={$t('storyBuilder.tasks.items.transition-timing.title')}
              status={evaluations["transition-timing"]?.status}
              availability={evaluations["transition-timing"]?.availability ?? { state: "available" }}
              collapsed={Boolean(collapsedSections["transition-timing"])}
              onToggle={() => toggleSection("transition-timing")}
            >
              <p class="chapter-overlay__hint">
                {$t('storyBuilder.transition.description')}
              </p>
              <label class="chapter-overlay__label">
                {$t('storyBuilder.transition.delay')}
                <input
                  class="chapter-overlay__input"
                  type="number"
                  min="0"
                  step="0.5"
                  data-testid="chapter-transition-delay"
                  value={delayMs !== undefined ? (delayMs / 1000).toString() : ''}
                  on:input={handleDelaySecondsChange}
                />
              </label>
            </InspectorSection>

            <InspectorSection
              id="audio-timing"
              title={$t('storyBuilder.tasks.items.audio-timing.title')}
              status={evaluations["audio-timing"]?.status}
              availability={evaluations["audio-timing"]?.availability ?? { state: "available" }}
              collapsed={Boolean(collapsedSections["audio-timing"])}
              onToggle={() => toggleSection("audio-timing")}
              active={$activeChapterTask === "audio-timing"}
              activateLabel={$t('storyBuilder.inspector.edit')}
              onActivate={() => activateTool("audio-timing")}
              onDone={finishTool}
            >
              {#if $activeChapterTask === "audio-timing"}
                <div class="chapter-overlay__wide-tool-note">
                  <strong>{$t('storyBuilder.narration.editor')}</strong>
                  <span>{$t('storyBuilder.narration.editorHint')}</span>
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
              {:else}
                <p class="chapter-overlay__hint" data-testid="inspector-summary-audio-timing">
                  {narrationSummary}
                </p>
              {/if}
            </InspectorSection>

            <InspectorSection
              id="motion"
              title={$t('storyBuilder.tasks.items.motion.title')}
              status={evaluations["motion"]?.status}
              availability={evaluations["motion"]?.availability ?? { state: "available" }}
              collapsed={Boolean(collapsedSections.motion)}
              onToggle={() => toggleSection("motion")}
              active={$activeChapterTask === "motion"}
              activateLabel={$t('storyBuilder.inspector.edit')}
              onActivate={() => activateTool("motion")}
              onDone={finishTool}
            >
              <p class="chapter-overlay__hint" data-testid="inspector-summary-motion">
                {motionSummary}
              </p>
            </InspectorSection>

            <InspectorSection
              id="media-timing"
              title={$t('storyBuilder.tasks.items.media-timing.title')}
              status={evaluations["media-timing"]?.status}
              availability={evaluations["media-timing"]?.availability ?? { state: "hidden" }}
              collapsed={Boolean(collapsedSections["media-timing"])}
              onToggle={() => toggleSection("media-timing")}
              active={$activeChapterTask === "media-timing"}
              activateLabel={$t('storyBuilder.inspector.edit')}
              onActivate={() => activateTool("media-timing")}
              onDone={finishTool}
            >
              {#if $activeChapterTask === "media-timing"}
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
              {:else}
                <p class="chapter-overlay__hint" data-testid="inspector-summary-media-timing">
                  {mediaSummary}
                </p>
              {/if}
            </InspectorSection>
          {:else}
            <InspectorSection
              id="source"
              title={$t('storyBuilder.tasks.items.source.title')}
              status={evaluations["source"]?.status}
              availability={evaluations["source"]?.availability ?? { state: "available" }}
              collapsed={Boolean(collapsedSections.source)}
              onToggle={() => toggleSection("source")}
            >
              <ChapterCameraConfig
                embedded={true}
                chapterExists={true}
                chapterCanvasIndex={chapter.canvasIndex}
                {manifestDraft}
                onManifestInput={handleManifestInput}
                onReloadManifest={() => handleReload()}
              />
            </InspectorSection>

            <InspectorSection
              id="layers"
              title={$t('storyBuilder.tasks.items.layers.title')}
              availability={evaluations["layers"]?.availability ?? { state: "available" }}
              collapsed={Boolean(collapsedSections.layers)}
              onToggle={() => toggleSection("layers")}
            >
              {#if manifestSupportsLayers}
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
              {/if}
            </InspectorSection>

            {#if SHOW_COMPARISON_TOOL}
              <InspectorSection
                id="comparison"
                title={$t('storyBuilder.tasks.items.comparison.title')}
                availability={evaluations["comparison"]?.availability ?? { state: "available" }}
                collapsed={Boolean(collapsedSections.comparison)}
                onToggle={() => toggleSection("comparison")}
              >
                <p class="chapter-overlay__hint">
                  {$t('storyBuilder.comparison.hint')}
                </p>
              </InspectorSection>
            {/if}
          {/if}
        </div>

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

    /* Annotation editing is a focused workspace, not another dashboard view.
       Keep its chapter identity but give the list, tools and properties the
       vertical space otherwise spent on preview and inspector navigation. */
    .chapter-overlay--annotation-task .chapter-overlay__header {
      padding: 10px 14px;
    }

    .chapter-overlay--annotation-task .chapter-overlay__form {
      gap: 8px;
      padding: 8px 12px 0;
    }

    .chapter-overlay--annotation-task .chapter-overlay__body,
    .chapter-overlay--annotation-task .inspector-section__body {
      gap: 8px;
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

    /*
     * The three groups of the inspector: a segmented row that stays put while
     * the sections beneath it change, so there is no drill-down and nothing to
     * go back from.
     */
    .chapter-inspector__groups {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
      padding: 4px;
      border-radius: 12px;
      border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
      background: color-mix(in srgb, var(--viewer-text, #e8edf4) 3%, transparent);
    }

    .chapter-inspector__group {
      padding: 8px 6px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: var(--viewer-muted, #9aa6b2);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition:
        background-color 0.15s ease,
        color 0.15s ease;
    }

    .chapter-inspector__group:hover {
      color: var(--viewer-text, #e8edf4);
    }

    .chapter-inspector__group:focus-visible {
      outline: 2px solid var(--accent, var(--story-builder-accent, #e07a3f));
      outline-offset: -2px;
    }

    .chapter-inspector__group--active {
      background: var(--viewer-surface, #151d26);
      color: var(--viewer-text, #e8edf4);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
    }

    .chapter-inspector__sections {
      align-content: start;
    }

    .chapter-inspector__tool-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chapter-overlay--annotation-task .chapter-inspector__tool-actions {
      position: sticky;
      bottom: 0;
      z-index: 4;
      margin: 2px -14px -14px;
      padding: 10px 14px 12px;
      border-top: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
      background: color-mix(in srgb, var(--viewer-panel, #121922) 96%, transparent);
      box-shadow: 0 -10px 20px rgba(0, 0, 0, 0.16);
    }

    .chapter-inspector__tool-actions .chapter-overlay__button {
      flex: 1 1 120px;
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
    .chapter-overlay--annotation-task .chapter-overlay__annotation-tools {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-top: 3px;
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
