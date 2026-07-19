import {
  derived,
  get,
  writable,
  type Readable,
  type Writable,
} from "svelte/store";
import type { MediaSource, MediaType } from "../iiif/mediaResolver";
import type { PluginContext } from "../core/types/plugin";
import { createStoryStore } from "../state/story.svelte";
import { createMediaMarks, type MediaMarksState } from "./mediaMarks";
import { createModelPose } from "./modelPose";
import { createNarrationPlayer } from "./narrationPlayer";
import { captureAudioVideo, captureImagePdf, captureModel } from "./capture";
import { resolveManifestForNewChapter } from "./manifestResolver";
import {
  animateViewBoxTransition,
  animateLayerOpacities,
} from "./viewBoxAnimation";
import { createStoryHistory } from "./storyHistory";
import { createChapterActions } from "./chapterActions";
import { createStoryPreviewOrchestrator } from "./previewOrchestrator";
import {
  buildExportEnvelope,
  loadStoryIntoStore,
  performFetchWithTimeout,
  validateStoryForExport,
  type ExportEnvelope,
  type SaveConfig,
  type SaveResult,
  type SaveState,
} from "./storySerializer";
import type {
  AnnotationPlacement,
  Chapter,
  ChapterAdvance,
  ChapterModel,
  StoryState,
} from "../core/types/story";
import type { ViewBox } from "../core/types/viewer";
import type { ViewerConfig } from "../core/types/config";

export type StoryBuilderController = {
  story: Readable<StoryState>;
  currentManifest: Readable<string | null>;
  selectedChapterId: Writable<string | null>;
  uiMode: Writable<UIMode>;
  drawerOpen: Readable<boolean>;
  viewBox: Readable<ViewBox | null>;
  modelPoseDebug: Readable<string | null>;
  mediaType: Readable<MediaType | null>;
  mediaMarks: Readable<MediaMarksState>;
  avMarksValid: Readable<boolean>;
  error: Writable<string | null>;
  language: string;
  languages: string[];
  annotationLanguage: Writable<string>;
  saveState: Readable<SaveState>;
  saveModalOpen: Readable<boolean>;
  saveModalPayload: Readable<ExportEnvelope | null>;
  setSaveConfig: (
    config: ViewerConfig["story"] extends infer S
      ? S extends { save?: infer T }
        ? T
        : Record<string, never>
      : Record<string, never>,
  ) => void;
  closeSaveModal: () => void;
  mediaSources: Readable<MediaSource[]>;
  layerOpacities: Readable<Record<string, number>>;
  updateLayerOpacity: (id: string, opacity: number) => void;
  attach: (ctx: PluginContext) => () => void;
  loadStory: (storyToLoad: StoryState) => void;
  setAnnotationLanguage: (lang: string) => void;
  addChapter: () => void;
  updateChapter: () => void;
  deleteChapter: (chapterId: string) => void;
  reorderChapter: (
    chapterId: string,
    targetChapterId: string,
    position?: "before" | "after",
  ) => void;
  selectChapter: (chapterId: string | null) => void;
  openNarration: () => void;
  backFromNarration: () => void;
  closeNarration: () => void;
  openChapter: () => void;
  closeChapter: () => void;
  markIn: () => void;
  markOut: () => void;
  setMediaMarks: (start: number | null, end: number | null) => void;
  previewMediaSegment: () => void;
  stopPreviewMediaSegment: () => void;
  setNarrationTrack: (lang: string, src: string) => void;
  updateChapterTitle: (lang: string, value: string) => void;
  updateChapterDescription: (lang: string, value: string) => void;
  assignNarrationSegment: (lang: string, start: number, end: number) => void;
  updateAnnotationText: (lang: string, text: string) => void;
  updateAnnotationPlacement: (
    lang: string,
    placement: AnnotationPlacement,
  ) => void;
  updateAdvanceMode: (mode: ChapterAdvance["mode"]) => void;
  updateDelay: (delayMs?: number) => void;
  updateManifest: (manifest: string) => void;
  reloadManifest: (manifest: string, canvasIndex: number) => void;
  loadManifest: (manifest: string) => void;
  saveChapterSettings: () => void;
  saveExport: () => { ok: boolean; errors: string[] };
  saveStory: () => Promise<SaveResult>;
  isPreviewing: Readable<boolean>;
  startPreview: () => void;
  stopPreview: () => void;
  positioningLanguage: Readable<string | null>;
  startAnnotationPositioning: (lang: string) => void;
  confirmAnnotationPositioning: () => void;
  cancelAnnotationPositioning: () => void;
};

export type UIMode =
  "idle" | "chapterEdit" | "narrationPanel" | "annotationPositioning";

export type StoryBuilderOptions = {
  language?: string;
  languages?: string[];
  annotationPageId?: string;
  initialStory?: StoryState;
};

export const createStoryBuilderController = (
  options: StoryBuilderOptions = {},
): StoryBuilderController => {
  const initialStoryData: StoryState = options.initialStory
    ? {
        ...options.initialStory,
        id: options.annotationPageId ?? options.initialStory.id,
      }
    : {
        id: options.annotationPageId,
        chapters: [],
      };

  const runesStore = createStoryStore(initialStoryData);

  // Create a writable store that wraps the runes store for backward compatibility
  const storyStore = writable(runesStore.story);

  const wrapMutation =
    <Payload>(
      mutation: (payload: Payload) => void,
    ): ((payload: Payload) => void) =>
    (payload) => {
      mutation(payload);
      storyStore.set(runesStore.story);
    };

  // Wrap the runes store methods to update the writable store
  const storyStoreWrapper = {
    addChapterFromCapture: wrapMutation(runesStore.addChapterFromCapture),
    updateChapterFromCapture: wrapMutation(runesStore.updateChapterFromCapture),
    deleteChapter: wrapMutation(runesStore.deleteChapter),
    reorderChapter: wrapMutation(runesStore.reorderChapter),
    setNarrationTrack: wrapMutation(runesStore.setNarrationTrack),
    setNarrationSegment: wrapMutation(runesStore.setNarrationSegment),
    setAnnotationText: wrapMutation(runesStore.setAnnotationText),
    setAnnotationPlacement: wrapMutation(runesStore.setAnnotationPlacement),
    setAdvanceMode: wrapMutation(runesStore.setAdvanceMode),
    setDelay: wrapMutation(runesStore.setDelay),
    setChapterManifest: wrapMutation(runesStore.setChapterManifest),
    setChapterTitle: wrapMutation(runesStore.setChapterTitle),
    setChapterDescription: wrapMutation(runesStore.setChapterDescription),
    setLayerOpacities: wrapMutation(runesStore.setLayerOpacities),
    exportStory: () => runesStore.exportStory(),
    loadStory: (next: StoryState) => {
      runesStore.loadStory(next);
      storyStore.set(runesStore.story);
    },
  };

  const selectedChapterId = writable<string | null>(null);
  const uiMode = writable<UIMode>("idle");
  const positioningLanguage = writable<string | null>(null);
  const drawerOpen = derived(
    uiMode,
    (mode) => mode !== "idle" && mode !== "annotationPositioning",
  );
  const viewBox = writable<ViewBox | null>(null);
  const mediaType = writable<MediaType | null>(null);
  const avMarksValid = writable(true);
  const error = writable<string | null>(null);
  const currentManifest = writable<string | null>(null);
  const modelPoseDebug = writable<string | null>(null);
  const annotationLanguage = writable(options.language ?? "en");
  const saveState = writable<SaveState>({ status: "idle" });
  const saveModalOpen = writable(false);
  const saveModalPayload = writable<ExportEnvelope | null>(null);
  const mediaSourcesStore = writable<MediaSource[]>([]);
  const layerOpacitiesStore = writable<Record<string, number>>({});
  let saveConfig: SaveConfig | null = null;

  const mediaMarks = createMediaMarks();
  const mediaMarksState = writable<MediaMarksState>(mediaMarks.getState());
  const modelPose = createModelPose();
  const narrationPlayer = createNarrationPlayer();

  const language = options.language ?? "en";
  const languages = options.languages ?? ["en"];
  const history = createStoryHistory(initialStoryData);

  let viewer: PluginContext["viewer"] | null = null;
  let attachedCount = 0;
  let detachEvents: (() => void) | null = null;
  let lastManifest: string | null = null;
  let pendingChapterApply: Chapter | null = null;
  let pendingApplyToken = 0;
  let pendingApplyRetries = 0;
  const maxPendingApplyRetries = 8;
  let pendingAddChapter = false;
  let pendingUpdateChapter = false;
  let activePlaybackToken = 0;
  let activePlaybackChapterId: string | null = null;
  let activeMediaEnd: number | null = null;
  let pendingMediaSyncToken = 0; // Token for media type sync (safety timeout only)

  const preview = createStoryPreviewOrchestrator({
    getStory: () => get(storyStore),
    selectChapter: (chapterId) => selectedChapterId.set(chapterId),
    applyChapter: (chapter) => applyChapter(chapter),
    getNarrationSegment: (chapter) => getNarrationSegment(chapter),
    closeEditors: () => uiMode.set("idle"),
    stopPlayback: () => stopChapterPlayback(),
  });
  const isPreviewing = preview.isPreviewing;

  const setError = (message: string | null) => {
    error.set(message);
  };

  const saveStory = async (): Promise<SaveResult> => {
    const payload = buildExportEnvelope(storyStoreWrapper.exportStory());
    const hasEndpoint =
      saveConfig?.endpoint && (saveConfig.enabled ?? true) ? true : false;
    if (!hasEndpoint) {
      saveModalPayload.set(payload);
      saveModalOpen.set(true);
      saveState.set({ status: "idle" });
      return { ok: true };
    }
    saveState.set({ status: "saving" });
    const result = await performFetchWithTimeout(
      saveConfig as SaveConfig,
      payload,
    );
    if (result.ok) {
      saveState.set({ status: "success", message: result.message });
    } else {
      saveState.set({
        status: "error",
        message: result.message,
        code: result.code,
      });
    }
    return result;
  };

  const setSaveConfig = (config: SaveConfig) => {
    saveConfig = config;
  };

  const closeSaveModal = () => {
    saveModalOpen.set(false);
  };

  const setAnnotationLanguage = (lang: string) => {
    annotationLanguage.set(lang);
  };

  const pushHistorySnapshot = () => {
    history.push(storyStoreWrapper.exportStory());
  };

  const chapterActions = createChapterActions({
    getSelectedChapterId: () => get(selectedChapterId),
    storyStoreWrapper,
  });

  const syncMediaMarks = () => {
    mediaMarksState.set(mediaMarks.getState());
    avMarksValid.set(mediaMarks.hasValidMarks());
  };

  const isValidSegment = (start?: number, end?: number) =>
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    (end as number) > (start as number);

  const getNarrationSegment = (chapter: Chapter) => {
    const lang = get(annotationLanguage);
    const segment = chapter.narrationSegment?.[lang];
    const src = get(storyStore).narration?.tracks?.[lang]?.src ?? "";
    if (!src || !segment || !isValidSegment(segment.start, segment.end))
      return null;
    return { src, start: segment.start, end: segment.end };
  };

  const stopChapterPlayback = () => {
    activePlaybackToken += 1;
    activePlaybackChapterId = null;
    activeMediaEnd = null;
    narrationPlayer.stop();
    viewer?.pause?.();
  };

  const startMediaSegment = (chapter: Chapter) => {
    if (!viewer || !chapter.media) return;
    const currentType = viewer.getMediaType?.() ?? null;
    if (currentType && currentType !== "audio" && currentType !== "video")
      return;
    if (!isValidSegment(chapter.media.start, chapter.media.end)) return;
    activeMediaEnd = chapter.media.end;
    activePlaybackChapterId = chapter.id;
    viewer.seekTo?.(chapter.media.start);
    viewer.play?.();
  };

  const startPlaybackForChapter = (chapter: Chapter) => {
    activePlaybackChapterId = chapter.id;
    // Update selected chapter so UI shows which chapter is playing and annotations appear
    selectedChapterId.set(chapter.id);
    const token = ++activePlaybackToken;
    const narration = getNarrationSegment(chapter);
    const run = async () => {
      if (narration) {
        await narrationPlayer.playSegment(narration);
        if (token !== activePlaybackToken) return;
      }
      if (chapter.media) {
        startMediaSegment(chapter);
      }
    };
    void run();
  };

  const maybeStartPlayback = (chapter: Chapter) => {
    // In preview mode, we want audio/narration to play
    if (get(isPreviewing)) {
      startPlaybackForChapter(chapter);
      return;
    }

    // Outside preview mode, story builder should not auto-play audio/narration
    // Audio playback is only for story viewer mode and preview mode
    return;
  };

  const updateMediaType = (next: MediaType | null) => {
    mediaType.set(next);
    if (next !== "audio" && next !== "video") {
      mediaMarks.clear();
    } else {
      // When media type is audio/video, restore marks from the selected chapter if available
      const id = get(selectedChapterId);
      const storyValue = get(storyStore);
      const chapter = id
        ? storyValue.chapters.find((item) => item.id === id)
        : null;
      if (chapter?.media) {
        mediaMarks.setSegment(chapter.media.start, chapter.media.end);
      }
    }
    if (next !== "model") {
      modelPose.clear();
    }
    syncMediaMarks();
  };

  /**
   * Wait for media type to become available via state change events.
   * No polling - uses event-driven approach with safety timeout.
   */
  const scheduleMediaTypeSync = (attempts = 12, delayMs = 200) => {
    if (!viewer) return;
    const token = ++pendingMediaSyncToken;
    let count = 0;
    let lastSeenType: MediaType | null = null;

    // Safety timeout-based bounded wait (not for readiness detection)
    const tick = () => {
      if (token !== pendingMediaSyncToken) return;
      const next = viewer?.getMediaType?.() ?? null;

      // Update if media type changed or if this is the first check
      if (next !== lastSeenType) {
        lastSeenType = next;
        updateMediaType(next);
      }

      // Keep checking until we reach max attempts
      if (count < attempts) {
        count += 1;
        setTimeout(tick, delayMs);
      }
    };
    tick();
  };

  // Event-driven media type updates (no polling interval)
  // Media type changes are detected via stateChange and mediaChange events

  const formatModelPose = (pose: ChapterModel | null) => {
    if (!pose) return null;
    const payload = {
      cameraOrbit: pose.cameraOrbit ?? null,
      cameraTarget: pose.cameraTarget ?? null,
      fieldOfView: pose.fieldOfView ?? null,
      orientation: pose.orientation ?? null,
    };
    return JSON.stringify(payload);
  };

  const updateModelPoseDebug = (pose: ChapterModel | null) => {
    modelPoseDebug.set(formatModelPose(pose));
  };

  const syncManifestFromViewer = () => {
    if (!viewer) return;
    const manifest =
      viewer.getManifestId?.() ?? viewer.getState?.()?.manifestId ?? null;
    if (manifest) {
      lastManifest = manifest;
      currentManifest.set(manifest);
    }
  };

  const applyChapterView = (chapter: Chapter) => {
    if (!viewer) return;
    if (chapter.viewBox) {
      viewer.setViewBox(chapter.viewBox);
    }
    if (chapter.model) {
      if (viewer.setModelPose) {
        viewer.setModelPose(chapter.model, { transition: "interpolate" });
      } else {
        if (chapter.model.cameraOrbit) {
          viewer.setModelOrbit(chapter.model.cameraOrbit);
        }
        if (chapter.model.cameraTarget) {
          viewer.setModelTarget(chapter.model.cameraTarget);
        }
        if (chapter.model.orientation) {
          viewer.setModelOrientation(chapter.model.orientation);
        }
      }
    }
    if (chapter.layerOpacities) {
      for (const [id, opacity] of Object.entries(chapter.layerOpacities)) {
        viewer.updateLayerOpacity?.(id, opacity);
      }
    }
  };

  const viewBoxMatches = (a: ViewBox | null, b: ViewBox | undefined) => {
    if (!a || !b) return false;
    const epsilon = 0.5;
    return (
      Math.abs(a.x - b.x) <= epsilon &&
      Math.abs(a.y - b.y) <= epsilon &&
      Math.abs(a.w - b.w) <= epsilon &&
      Math.abs(a.h - b.h) <= epsilon
    );
  };

  const getCurrentModelPose = (): ChapterModel | null => {
    if (!viewer) return null;
    const pose = viewer.getModelPose?.() ?? null;
    const cameraOrbit =
      pose?.cameraOrbit ?? viewer.getModelOrbit?.() ?? undefined;
    const cameraTarget =
      pose?.cameraTarget ?? viewer.getModelTarget?.() ?? undefined;
    const fieldOfView = pose?.fieldOfView ?? undefined;
    const orientation =
      pose?.orientation ?? viewer.getModelOrientation?.() ?? undefined;
    if (!cameraOrbit && !cameraTarget && !orientation && !fieldOfView)
      return null;
    return { cameraOrbit, cameraTarget, fieldOfView, orientation };
  };

  const beginPendingModelApply = (chapter: Chapter) => {
    if (!viewer || !chapter.model) return;
    applyChapterView({ ...chapter, viewBox: undefined });
    pendingChapterApply = null;
  };

  let cancelAnimation: (() => void) | null = null;
  let cancelLayersAnimation: (() => void) | null = null;

  const animateViewBox = (from: ViewBox, to: ViewBox, durationMs = 320) => {
    if (!viewer) return;
    pendingApplyToken += 1;

    // Cancel any previous animation
    if (cancelAnimation) {
      cancelAnimation();
    }

    // Start new animation with cancel function
    cancelAnimation = animateViewBoxTransition(viewer, to, durationMs);
  };

  const beginPendingApply = (chapter: Chapter) => {
    if (!viewer) return;
    if (chapter.model && !chapter.viewBox) {
      beginPendingModelApply(chapter);
      maybeStartPlayback(chapter);
      return;
    }
    pendingApplyToken += 1;
    pendingApplyRetries = 0;
    const token = pendingApplyToken;

    const attempt = () => {
      if (!viewer || token !== pendingApplyToken) return;
      applyChapterView(chapter);
      maybeStartPlayback(chapter);
      if (!chapter.viewBox) {
        pendingChapterApply = null;
        return;
      }
      const current = viewer.getViewBox?.() ?? null;
      if (viewBoxMatches(current, chapter.viewBox)) {
        pendingChapterApply = null;
        return;
      }
      if (pendingApplyRetries >= maxPendingApplyRetries) {
        pendingChapterApply = null;
        return;
      }
      pendingApplyRetries += 1;
      setTimeout(attempt, 80);
    };

    if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
      window.requestAnimationFrame(() => attempt());
    } else {
      setTimeout(attempt, 0);
    }
  };

  const applyChapter = (chapter: Chapter) => {
    if (!viewer) return;
    if (cancelLayersAnimation) {
      cancelLayersAnimation();
      cancelLayersAnimation = null;
    }
    const viewerManifest =
      viewer.getManifestId?.() ?? viewer.getState?.()?.manifestId ?? null;
    if (chapter.manifest && chapter.manifest !== viewerManifest) {
      pendingChapterApply = chapter;
      viewer.setManifest(chapter.manifest);
      currentManifest.set(chapter.manifest);
      return;
    }
    const currentIndex = viewer.getCanvasIndex?.() ?? -1;
    if (
      typeof chapter.canvasIndex === "number" &&
      chapter.canvasIndex !== currentIndex
    ) {
      pendingChapterApply = chapter;
      viewer.setCanvasByIndex(chapter.canvasIndex);
      return;
    }
    pendingChapterApply = null;

    if (chapter.layerOpacities) {
      const fromOpacities = viewer.getLayerOpacities?.() ?? {};
      cancelLayersAnimation = animateLayerOpacities(
        viewer,
        fromOpacities,
        chapter.layerOpacities,
      );
    }

    if (chapter.viewBox) {
      const currentViewBox = viewer.getViewBox?.() ?? null;
      if (currentViewBox && !viewBoxMatches(currentViewBox, chapter.viewBox)) {
        animateViewBox(currentViewBox, chapter.viewBox);
        if (chapter.model) {
          applyChapterView({ ...chapter, viewBox: undefined });
        }
        maybeStartPlayback(chapter);
        return;
      }
    }
    if (chapter.model) {
      beginPendingModelApply(chapter);
      maybeStartPlayback(chapter);
      return;
    }
    beginPendingApply(chapter);
    maybeStartPlayback(chapter);
  };

  const waitForManifest = (timeoutMs = 2000): Promise<boolean> => {
    return new Promise((resolve) => {
      let settled = false;
      let unsubscribe: () => void = () => undefined;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(false);
      }, timeoutMs);

      unsubscribe = currentManifest.subscribe((value) => {
        if (settled) return;
        if (value) {
          settled = true;
          clearTimeout(timer);
          unsubscribe();
          resolve(true);
        }
      });
    });
  };

  const handleCaptureResult = (result: ReturnType<typeof capture>) => {
    if (!result.ok) {
      if (result.reason === "missing-manifest") {
        setError(null);
        selectedChapterId.set(null);
        uiMode.set("chapterEdit");
      } else {
        setError(`Capture blocked: ${result.reason}`);
      }
      return false;
    }
    setError(null);
    storyStoreWrapper.addChapterFromCapture({ capture: result.capture });
    const storyValue = get(storyStore);
    const lastId = storyValue.chapters[storyValue.chapters.length - 1]?.id;
    if (lastId) {
      selectedChapterId.set(lastId);
    }
    setTimeout(() => {
      if (get(selectedChapterId) === lastId) {
        uiMode.set("chapterEdit");
      }
    }, 0);
    return true;
  };

  const handleUpdateResult = (
    result: ReturnType<typeof capture>,
    chapterId: string,
  ) => {
    if (!result.ok) {
      if (result.reason === "missing-manifest") {
        setError(null);
        uiMode.set("chapterEdit");
      } else {
        setError(`Capture blocked: ${result.reason}`);
      }
      return false;
    }
    setError(null);
    storyStoreWrapper.updateChapterFromCapture({
      chapterId,
      capture: result.capture,
    });
    return true;
  };

  const resolveManifest = () => {
    if (!viewer) {
      return { ok: false as const, reason: "missing-manifest" as const };
    }
    const storyValue = get(storyStore);
    const previousChapterManifest =
      storyValue.chapters[storyValue.chapters.length - 1]?.manifest ?? null;
    const viewerManifest = viewer.getManifestId?.() ?? null;
    const stateManifest = viewer.getState?.()?.manifestId ?? null;
    const effectiveManifest =
      viewerManifest ||
      stateManifest ||
      lastManifest ||
      get(currentManifest) ||
      null;
    return resolveManifestForNewChapter(
      effectiveManifest,
      previousChapterManifest,
    );
  };

  const capture = () => {
    if (!viewer)
      return { ok: false as const, reason: "missing-manifest" as const };
    const manifestResolution = resolveManifest();
    if (!manifestResolution.ok) {
      return { ok: false as const, reason: "missing-manifest" as const };
    }
    const manifestOverride = viewer.getManifestId()
      ? undefined
      : manifestResolution.manifest;

    const type = viewer.getMediaType();
    if (type === "audio" || type === "video") {
      return captureAudioVideo(
        viewer,
        mediaMarks.getSegment(),
        manifestOverride,
      );
    }
    if (type === "model") {
      return captureModel(viewer, modelPose.getPose(), manifestOverride);
    }
    return captureImagePdf(viewer, manifestOverride);
  };

  const attach = (ctx: PluginContext) => {
    if (!ctx?.viewer) {
      return () => undefined;
    }
    viewer = ctx.viewer;
    lastManifest =
      ctx.viewer.getManifestId?.() ??
      ctx.viewer.getState?.()?.manifestId ??
      null;
    currentManifest.set(lastManifest);
    viewBox.set(
      ctx.viewer.getViewBox?.() ?? ctx.viewer.getState?.()?.viewBox ?? null,
    );
    mediaSourcesStore.set(ctx.viewer.getMediaSources?.() ?? []);
    layerOpacitiesStore.set(ctx.viewer.getLayerOpacities?.() ?? {});
    const initialMediaType = ctx.viewer.getMediaType?.() ?? null;
    updateMediaType(initialMediaType);
    if (!initialMediaType) {
      scheduleMediaTypeSync();
    }
    // No mediaTypePolling interval - use event-driven updates via stateChange/mediaChange
    attachedCount += 1;
    if (attachedCount === 1) {
      const offState = ctx.events.on("stateChange", ({ snapshot }) => {
        updateMediaType(snapshot.mediaType);
        lastManifest = snapshot.manifestId || null;
        currentManifest.set(lastManifest);
        viewBox.set(snapshot.viewBox ?? null);
        mediaSourcesStore.set(ctx.viewer.getMediaSources?.() ?? []);
        layerOpacitiesStore.set(ctx.viewer.getLayerOpacities?.() ?? {});
        if (snapshot.mediaType === "model") {
          updateModelPoseDebug(getCurrentModelPose() ?? modelPose.getPose());
        }
        if (pendingChapterApply && snapshot.manifestId) {
          if (snapshot.manifestId === pendingChapterApply.manifest) {
            if (snapshot.canvasIndex !== pendingChapterApply.canvasIndex) {
              viewer?.setCanvasByIndex(pendingChapterApply.canvasIndex);
            } else {
              const pending = pendingChapterApply;
              pendingChapterApply = null;
              beginPendingApply(pending);
            }
          }
        }
        setError(null);
      });
      const offManifest = ctx.events.on("manifestChange", ({ manifestId }) => {
        lastManifest = manifestId || null;
        currentManifest.set(lastManifest);
        updateMediaType(null);
        scheduleMediaTypeSync();
        if (
          pendingChapterApply &&
          pendingChapterApply.manifest === manifestId
        ) {
          viewer?.setCanvasByIndex(pendingChapterApply.canvasIndex);
        }
        setError(null);
      });
      const offPage = ctx.events.on("pageChange", ({ index }) => {
        // Update media type when navigating to different canvas
        // The media type might not be immediately available, so poll for it
        scheduleMediaTypeSync(12, 100); // Check more frequently (100ms intervals)
        if (pendingChapterApply && pendingChapterApply.canvasIndex === index) {
          const pending = pendingChapterApply;
          pendingChapterApply = null;
          beginPendingApply(pending);
        }
      });
      const offViewBox = ctx.events.on(
        "viewBoxChange",
        ({ viewBox: nextViewBox }) => {
          viewBox.set(nextViewBox ?? null);
        },
      );
      const offZoom = ctx.events.on(
        "zoomChange",
        ({ viewBox: nextViewBox }) => {
          viewBox.set(nextViewBox ?? null);
        },
      );
      const offTime = ctx.events.on("mediaTimeUpdate", ({ time }) => {
        mediaMarks.updateTime(time);
        syncMediaMarks();
        if (
          activeMediaEnd != null &&
          activePlaybackChapterId === get(selectedChapterId) &&
          time >= activeMediaEnd - 0.05
        ) {
          activeMediaEnd = null;
          viewer?.pause?.();
        }
      });
      const offModel = ctx.events.on(
        "modelChange",
        ({ cameraOrbit, cameraTarget, fieldOfView, orientation }) => {
          modelPose.updateFromEvent({
            cameraOrbit,
            cameraTarget,
            fieldOfView,
            orientation,
          });
          updateModelPoseDebug(modelPose.getPose());
        },
      );
      const offMedia = ctx.events.on("mediaChange", ({ mediaType }) => {
        updateMediaType(mediaType);
      });

      const offMediaPlay = ctx.events.on("mediaPlay", ({ time }) => {
        // When user manually starts audio/video playback, seek to Mark In if set
        const id = get(selectedChapterId);
        const storyValue = get(storyStore);
        const chapter = id
          ? storyValue.chapters.find((item) => item.id === id)
          : null;

        if (chapter?.media && time < chapter.media.start) {
          // If playback started before Mark In, seek to Mark In
          viewer?.seekTo?.(chapter.media.start);
        }

        // Set up auto-stop at Mark Out
        if (chapter?.media) {
          activeMediaEnd = chapter.media.end;
          activePlaybackChapterId = chapter.id;
        }
      });

      detachEvents = () => {
        offState();
        offManifest();
        offPage();
        offViewBox();
        offZoom();
        offTime();
        offModel();
        offMedia();
        offMediaPlay();
      };

      // Auto-select the first chapter on initial attach so editor shows content
      autoSelectFirstChapterIfNeeded();
    }

    return () => {
      attachedCount = Math.max(0, attachedCount - 1);
      if (attachedCount === 0) {
        // No polling to stop - cleanup handled by event unsubscribes
        detachEvents?.();
        detachEvents = null;
      }
    };
  };

  const addChapter = () => {
    if (pendingAddChapter) return;
    pushHistorySnapshot();
    let result = capture();
    if (result.ok) {
      handleCaptureResult(result);
      return;
    }
    if (result.reason !== "missing-manifest") {
      handleCaptureResult(result);
      return;
    }
    pendingAddChapter = true;
    syncManifestFromViewer();
    void waitForManifest().then(() => {
      pendingAddChapter = false;
      result = capture();
      handleCaptureResult(result);
    });
  };

  const updateChapter = () => {
    const id = get(selectedChapterId);
    if (!id) return;
    if (pendingUpdateChapter) return;
    pushHistorySnapshot();
    let result = capture();
    if (result.ok) {
      handleUpdateResult(result, id);
      return;
    }
    if (result.reason !== "missing-manifest") {
      handleUpdateResult(result, id);
      return;
    }
    pendingUpdateChapter = true;
    syncManifestFromViewer();
    void waitForManifest().then(() => {
      pendingUpdateChapter = false;
      result = capture();
      handleUpdateResult(result, id);
    });
  };

  const deleteChapter = (chapterId: string) => {
    pushHistorySnapshot();
    chapterActions.deleteChapter(chapterId, () => {
      selectedChapterId.set(null);
    });
  };

  const reorderChapter = (
    chapterId: string,
    targetChapterId: string,
    position: "before" | "after" = "before",
  ) => {
    pushHistorySnapshot();
    chapterActions.reorderChapter(chapterId, targetChapterId, position);
  };

  /**
   * Auto-select the first chapter if available and no chapter is currently selected.
   * This ensures the editor shows content on load instead of placeholder messages.
   */
  const autoSelectFirstChapterIfNeeded = () => {
    const currentStory = get(storyStore);
    const firstChapter = currentStory.chapters?.[0];
    if (firstChapter?.id && get(selectedChapterId) === null) {
      // Use setTimeout to ensure viewer is fully initialized after attach
      setTimeout(() => {
        selectChapter(firstChapter.id);
      }, 0);
    }
  };

  const selectChapter = (chapterId: string | null) => {
    selectedChapterId.set(chapterId);
    if (!chapterId) {
      stopChapterPlayback();
      mediaMarks.clear();
      syncMediaMarks();
      return;
    }
    const storyValue = get(storyStore);
    const chapter = storyValue.chapters.find((item) => item.id === chapterId);
    stopChapterPlayback();
    if (chapter?.media) {
      mediaMarks.setSegment(chapter.media.start, chapter.media.end);
    } else {
      mediaMarks.clear();
    }
    syncMediaMarks();
    if (chapter) {
      applyChapter(chapter);
    }
  };

  const openNarration = () => uiMode.set("narrationPanel");
  const backFromNarration = () =>
    uiMode.set(get(selectedChapterId) ? "chapterEdit" : "idle");
  const closeNarration = () => uiMode.set("idle");
  const openChapter = () => {
    setTimeout(() => {
      if (get(selectedChapterId)) {
        uiMode.set("chapterEdit");
      }
    }, 0);
  };
  const closeChapter = () => uiMode.set("idle");

  const startPreview = preview.start;
  const stopPreview = preview.stop;

  const markIn = () => {
    mediaMarks.markIn();
    syncMediaMarks();
  };

  const markOut = () => {
    mediaMarks.markOut();
    syncMediaMarks();
  };

  const setMediaMarks = (start: number | null, end: number | null) => {
    mediaMarks.setSegment(start, end);
    syncMediaMarks();
  };

  const previewMediaSegment = () => {
    if (!viewer) return;
    const state = mediaMarks.getState();
    const start = state.markIn;
    const end = state.markOut;
    if (start == null || end == null || end <= start) return;
    const currentType = viewer.getMediaType?.() ?? null;
    if (currentType !== "audio" && currentType !== "video") return;

    // Set the active playback chapter ID so the time update handler works
    const currentChapterId = get(selectedChapterId);
    if (currentChapterId) {
      activePlaybackChapterId = currentChapterId;
    }

    activeMediaEnd = end;
    viewer.seekTo?.(start);
    viewer.play?.();
  };

  const stopPreviewMediaSegment = () => {
    if (!viewer) return;
    viewer.pause?.();
    activeMediaEnd = null;
    activePlaybackChapterId = null;

    // Reset to start position
    const state = mediaMarks.getState();
    const start = state.markIn;
    if (start != null) {
      viewer.seekTo?.(start);
    }
  };

  const setNarrationTrack = (lang: string, src: string) => {
    pushHistorySnapshot();
    chapterActions.setNarrationTrack(lang, src);
  };

  const updateChapterTitle = (lang: string, value: string) => {
    pushHistorySnapshot();
    chapterActions.updateChapterTitle(lang, value);
  };

  const updateChapterDescription = (lang: string, value: string) => {
    pushHistorySnapshot();
    chapterActions.updateChapterDescription(lang, value);
  };

  const assignNarrationSegment = (lang: string, start: number, end: number) => {
    pushHistorySnapshot();
    chapterActions.assignNarrationSegment(lang, start, end);
  };

  const updateAnnotationText = (lang: string, text: string) => {
    pushHistorySnapshot();
    chapterActions.updateAnnotationText(lang, text);
  };

  const updateAnnotationPlacement = (
    lang: string,
    placement: AnnotationPlacement,
  ) => {
    pushHistorySnapshot();
    chapterActions.updateAnnotationPlacement(lang, placement);
  };

  const updateAdvanceMode = (mode: ChapterAdvance["mode"]) => {
    pushHistorySnapshot();
    chapterActions.updateAdvanceMode(mode);
  };

  const updateDelay = (delayMs?: number) => {
    pushHistorySnapshot();
    chapterActions.updateDelay(delayMs);
  };

  const startAnnotationPositioning = (lang: string) => {
    uiMode.set("annotationPositioning");
    positioningLanguage.set(lang);
  };

  const confirmAnnotationPositioning = () => {
    uiMode.set("chapterEdit");
    positioningLanguage.set(null);
  };

  const cancelAnnotationPositioning = () => {
    uiMode.set("chapterEdit");
    positioningLanguage.set(null);
  };

  const updateManifest = (manifest: string) => {
    pushHistorySnapshot();
    chapterActions.updateManifest(manifest);
  };

  const updateLayerOpacity = (id: string, opacity: number) => {
    viewer?.updateLayerOpacity?.(id, opacity);
    layerOpacitiesStore.set(viewer?.getLayerOpacities?.() ?? {});
  };

  const reloadManifest = (manifest: string, canvasIndex: number) => {
    if (!viewer) {
      setError("Viewer not ready.");
      return;
    }
    if (!manifest.trim()) {
      setError("Manifest URL is required.");
      return;
    }
    viewer.setManifest(manifest);
    viewer.setCanvasByIndex(canvasIndex);
  };

  const loadManifest = (manifest: string) => {
    if (!viewer) {
      setError("Viewer not ready.");
      return;
    }
    const trimmed = manifest.trim();
    if (!trimmed) {
      setError("Manifest URL is required.");
      return;
    }
    viewer.setManifest(trimmed);
    lastManifest = trimmed;
    currentManifest.set(trimmed);
    setError(null);
  };

  const saveChapterSettings = () => {
    setError(null);
    uiMode.set("idle");
  };

  const saveExport = () => {
    const storyValue = storyStoreWrapper.exportStory();
    const validation = validateStoryForExport(storyValue);
    if (!validation.ok) {
      setError(validation.errors.join(" · "));
    } else {
      setError(null);
    }
    return validation;
  };

  const loadStory = (storyToLoad: StoryState) => {
    pushHistorySnapshot();
    loadStoryIntoStore(storyToLoad, storyStoreWrapper);

    // Load the first chapter's manifest if available
    const firstChapter = storyToLoad.chapters?.[0];
    if (firstChapter?.manifest && viewer) {
      viewer.setManifest?.(firstChapter.manifest);
      if (typeof firstChapter.canvasIndex === "number") {
        viewer.setCanvasByIndex?.(firstChapter.canvasIndex);
      }
    }

    // Auto-select the first chapter so the editor shows content on load
    autoSelectFirstChapterIfNeeded();
    history.reset(storyStoreWrapper.exportStory());
  };

  return {
    story: storyStore,
    currentManifest,
    selectedChapterId,
    uiMode,
    drawerOpen,
    viewBox,
    mediaType,
    mediaMarks: mediaMarksState,
    avMarksValid,
    error,
    language,
    languages,
    saveState,
    saveModalOpen,
    saveModalPayload,
    closeSaveModal,
    mediaSources: mediaSourcesStore,
    layerOpacities: layerOpacitiesStore,
    updateLayerOpacity,
    attach,
    addChapter,
    updateChapter,
    deleteChapter,
    reorderChapter,
    selectChapter,
    openNarration,
    backFromNarration,
    closeNarration,
    openChapter,
    closeChapter,
    markIn,
    markOut,
    setMediaMarks,
    previewMediaSegment,
    stopPreviewMediaSegment,
    setNarrationTrack,
    updateChapterTitle,
    updateChapterDescription,
    assignNarrationSegment,
    updateAnnotationText,
    updateAnnotationPlacement,
    updateAdvanceMode,
    updateDelay,
    updateManifest,
    reloadManifest,
    loadManifest,
    saveChapterSettings,
    saveExport,
    saveStory,
    setSaveConfig,
    setAnnotationLanguage,
    annotationLanguage,
    modelPoseDebug,
    loadStory,
    isPreviewing,
    startPreview,
    stopPreview,
    positioningLanguage: { subscribe: positioningLanguage.subscribe },
    startAnnotationPositioning,
    confirmAnnotationPositioning,
    cancelAnnotationPositioning,
  };
};
