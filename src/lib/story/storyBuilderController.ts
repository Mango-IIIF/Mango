import {
  derived,
  get,
  writable,
  type Readable,
  type Writable,
} from "svelte/store";
import type { MediaSource, MediaType } from "../iiif/mediaResolver";
import { translate } from '../core/i18n';
import type { PluginContext } from "../core/types/plugin";
import { createStoryStore } from "../core/state/story.svelte";
import { createMediaMarks, type MediaMarksState } from "./mediaMarks";
import { createModelPose } from "./modelPose";
import { createNarrationPlayer } from "./narrationPlayer";
import { captureAudioVideo, captureImagePdf, captureModel } from "./capture";
import {
  fitViewBoxToContent,
  framingsWithin,
  inferPresentationAspect,
  normaliseStoryFraming,
  normaliseViewBox,
  viewBoxAspect,
} from "./framing";
import { nestedFrame } from "./frameGeometry";
import { createDraftStoryId } from "./publicIdentifiers";
import { resolveManifestForNewChapter } from "./manifestResolver";
import {
  animateViewBoxTransition,
  animateLayerOpacities,
} from "./viewBoxAnimation";
import { cloneStoryValue, createStoryHistory } from "./storyHistory";
import { createChapterActions } from "./chapterActions";
import { createStoryPreviewOrchestrator } from "./previewOrchestrator";
import { STAGE_CROSSFADE_MS } from "./viewer/chapterTransitionOrchestrator";
import type { StageFade } from "./viewer/storyViewerController";
import {
  configureCameraTrackPreset,
  generateCameraPreset,
  retimeCameraKeyframes,
  sampleCameraTrack,
} from "./cameraTrack";
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
  ChapterCameraTrack,
  ChapterAnnotationTool,
  ChapterAnnotationStrokeWidth,
  ChapterDrawingAnnotation,
  ChapterAdvance,
  ChapterModel,
  NarrationSegment,
  StoryFrame,
  StoryState,
} from "../core/types/story";
import type { ViewBox } from "../core/types/viewer";
import type { ViewerConfig } from "../core/types/config";
import type { ChapterTaskId } from "./chapterTasks";
import type { ResolvedAnnotation } from "../iiif/annotationResolver";
import { normalizeStoryAnnotations } from "./normalizeAnnotations";
import { storyDrawingToResolved } from "./storyDrawingAnnotations";
import { normaliseAuthoringLanguages } from "../features/annotations/languages";

export type StoryBuilderController = {
  story: Readable<StoryState>;
  currentManifest: Readable<string | null>;
  viewerCanvasIndex: Readable<number>;
  viewerCanvasCount: Readable<number>;
  selectedChapterId: Writable<string | null>;
  activeChapterTask: Writable<ChapterTaskId | null>;
  selectedDrawingAnnotationId: Writable<string | null>;
  chapterAnnotationTool: Writable<ChapterAnnotationTool>;
  uiMode: Writable<UIMode>;
  drawerOpen: Readable<boolean>;
  viewBox: Readable<ViewBox | null>;
  modelPoseDebug: Readable<string | null>;
  mediaType: Readable<MediaType | null>;
  mediaMarks: Readable<MediaMarksState>;
  transitionDelayDefault: Readable<number>;
  avMarksValid: Readable<boolean>;
  error: Writable<string | null>;
  validationErrors: Readable<string[]>;
  language: string;
  languages: string[];
  annotationLanguage: Writable<string>;
  saveState: Readable<SaveState>;
  saveConfigured: Readable<boolean>;
  dirty: Readable<boolean>;
  canUndo: Readable<boolean>;
  canRedo: Readable<boolean>;
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
  setChapterAnnotationTool: (tool: ChapterAnnotationTool) => void;
  deleteChapterDrawingAnnotation: (annotationId: string) => void;
  deleteChapterTextAnnotation: (lang: string) => void;
  editChapterDrawingAnnotation: (annotationId: string) => void;
  editChapterTextAnnotation: (lang: string) => void;
  setChapterDrawingAnnotationLabel: (
    annotationId: string,
    lang: string,
    value: string,
  ) => void;
  setChapterDrawingAnnotationStyle: (
    annotationId: string,
    style: {
      color?: string | null;
      strokeWidth?: ChapterAnnotationStrokeWidth;
      fillMode?: ChapterDrawingAnnotation["fillMode"];
      /** Null clears it, so the export goes back to inferring from shape. */
      motivation?: ChapterDrawingAnnotation["motivation"] | null;
    },
  ) => void;
  addChapter: () => void;
  updateChapter: () => void;
  /**
   * Sets the chapter frame — the canvas region this chapter opens on — in
   * canvas pixels. The frame is an object on the stage: this is how a drag of
   * it, or a typed value, lands on the chapter. It does not move the camera.
   */
  setChapterPosition: (viewBox: ViewBox) => void;
  deleteChapter: (chapterId: string) => void;
  duplicateChapter: (chapterId: string) => void;
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
  assignMediaSegment: (start: number, end: number) => void;
  previewMediaSegment: () => void;
  stopPreviewMediaSegment: () => void;
  setNarrationTrack: (lang: string, src: string) => void;
  updateStoryTitle: (lang: string, value: string) => void;
  updateStoryIdentifiers: (id: string, annotationBase: string) => void;
  /**
   * Adds a camera point. For an image chapter it starts as a frame nested
   * inside the previous point's (or the chapter's) frame, ready to be dragged
   * into place on the stage; for a 3D chapter it holds the current pose.
   */
  addMotionPoint: () => void;
  /** Where a camera point's frame was moved or resized to, in canvas pixels. */
  setMotionPointViewBox: (keyframeId: string, viewBox: ViewBox) => void;
  /** The camera point whose frame carries the handles on the stage. */
  selectedMotionPointId: Writable<string | null>;
  deleteMotionPoint: (keyframeId: string) => void;
  updateMotionDuration: (durationMs: number) => void;
  updateMotionPathType: (pathType: "linear" | "spline") => void;
  updateMotionInitialDwell: (dwellMs: number) => void;
  updateMotionEasing: (
    easing: NonNullable<ChapterCameraTrack["easing"]>,
  ) => void;
  goToMotionPoint: (keyframeId: string) => void;
  applyMotionPreset: (
    preset: NonNullable<Chapter["cameraTrack"]>["preset"],
  ) => void;
  motionPreviewing: Readable<boolean>;
  previewMotion: () => void;
  stopMotionPreview: () => void;
  updateChapterTitle: (lang: string, value: string) => void;
  updateChapterDescription: (lang: string, value: string) => void;
  assignNarrationSegment: (lang: string, start: number, end: number) => void;
  skipNarration: (lang: string) => void;
  updateAnnotationText: (lang: string, text: string) => void;
  updateAnnotationPlacement: (
    lang: string,
    placement: AnnotationPlacement,
  ) => void;
  updateAdvanceMode: (mode: ChapterAdvance["mode"]) => void;
  updateDelay: (delayMs?: number) => void;
  updateManifest: (manifest: string) => void;
  reloadManifest: (manifest: string, canvasIndex: number) => void;
  selectCanvas: (canvasIndex: number) => void;
  loadManifest: (manifest: string) => void;
  saveChapterSettings: () => void;
  cancelChapterSettings: () => void;
  saveExport: () => { ok: boolean; errors: string[] };
  exportStory: () => { ok: boolean; errors: string[] };
  /** A detached snapshot of the builder's editable story state. */
  getStory: () => StoryState;
  /** The current story serialized as a portable IIIF AnnotationPage. */
  getExportPayload: () => ExportEnvelope;
  saveStory: () => Promise<SaveResult>;
  undo: () => void;
  redo: () => void;
  isPreviewing: Readable<boolean>;
  /** Stage opacity while a chapter change swaps the Manifest or Canvas. */
  stageFade: Readable<StageFade>;
  startPreview: () => void;
  stopPreview: () => void;
  previewChapter: (chapterId?: string) => void;
  positioningLanguage: Readable<string | null>;
  startAnnotationPositioning: (lang: string) => void;
  confirmAnnotationPositioning: () => void;
  cancelAnnotationPositioning: () => void;
};

export type UIMode =
  | "idle"
  | "chapterEdit"
  | "narrationPanel"
  | "annotationPositioning";

export type StoryBuilderOptions = {
  language?: string;
  languages?: string[];
  annotationPageId?: string;
  annotationBase?: string;
  identifiersLocked?: boolean;
  initialStory?: StoryState;
  /** Receives the controller used by the first-party builder plugins. */
  onControllerReady?: (controller: StoryBuilderController) => void;
};

export const collectLatestNarrationSegments = (
  story: StoryState,
): Record<string, NarrationSegment> => {
  const latest: Record<string, NarrationSegment> = {};
  for (const chapter of story.chapters) {
    for (const [language, segment] of Object.entries(
      chapter.narrationSegment ?? {},
    )) {
      if (
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start
      ) {
        latest[language] = { start: segment.start, end: segment.end };
      }
    }
  }
  return latest;
};

const DEFAULT_CHAPTER_TRANSITION_DELAY_MS = 2000;

/**
 * How close the viewer has to be to a chapter's stored framing for the builder
 * to treat it as applied.
 *
 * Looser than playback's near-exact check because these callers are deciding
 * whether an apply has landed and whether a move is still needed, not whether
 * to animate: a retry loop that never accepts the framing as applied keeps
 * the stage hidden until it runs out of attempts.
 */
const APPLIED_FRAMING_TOLERANCE = 0.5;

const collectLatestTransitionDelay = (story: StoryState): number => {
  let latest = DEFAULT_CHAPTER_TRANSITION_DELAY_MS;
  for (const chapter of story.chapters) {
    const delay = chapter.advance?.delayMs;
    if (
      chapter.advance?.mode === "auto" &&
      Number.isFinite(delay) &&
      (delay as number) >= 0
    ) {
      latest = delay as number;
    }
  }
  return latest;
};

export const createStoryBuilderController = (
  options: StoryBuilderOptions = {},
): StoryBuilderController => {
  const language = options.language ?? "en";
  const languages = normaliseAuthoringLanguages(options.languages, language);
  const initialStoryData: StoryState = normalizeStoryAnnotations(
    options.initialStory
      ? {
          ...options.initialStory,
          id:
            options.annotationPageId ??
            options.initialStory.id ??
            createDraftStoryId(),
          publication: {
            ...options.initialStory.publication,
            ...(options.annotationBase
              ? { annotationBase: options.annotationBase }
              : {}),
            ...(options.identifiersLocked ? { identifiersLocked: true } : {}),
          },
        }
      : {
          id: options.annotationPageId ?? createDraftStoryId(),
          publication:
            options.annotationBase || options.identifiersLocked
              ? {
                  ...(options.annotationBase
                    ? { annotationBase: options.annotationBase }
                    : {}),
                  ...(options.identifiersLocked
                    ? { identifiersLocked: true }
                    : {}),
                }
              : undefined,
          chapters: [],
        },
  );

  const runesStore = createStoryStore(initialStoryData);

  // Create a writable store that wraps the runes store for backward compatibility
  const storyStore = writable(runesStore.story);
  const dirty = writable(false);

  const wrapMutation =
    <Payload>(
      mutation: (payload: Payload) => void,
    ): ((payload: Payload) => void) =>
    (payload) => {
      mutation(payload);
      storyStore.set(runesStore.story);
      dirty.set(true);
    };

  // Wrap the runes store methods to update the writable store
  const storyStoreWrapper = {
    addChapterFromCapture: wrapMutation(runesStore.addChapterFromCapture),
    updateChapterFromCapture: wrapMutation(runesStore.updateChapterFromCapture),
    deleteChapter: wrapMutation(runesStore.deleteChapter),
    reorderChapter: wrapMutation(runesStore.reorderChapter),
    setNarrationTrack: wrapMutation(runesStore.setNarrationTrack),
    setNarrationSegment: wrapMutation(runesStore.setNarrationSegment),
    removeNarrationSegment: wrapMutation(runesStore.removeNarrationSegment),
    setAnnotationText: wrapMutation(runesStore.setAnnotationText),
    setAnnotationPlacement: wrapMutation(runesStore.setAnnotationPlacement),
    setAdvanceMode: wrapMutation(runesStore.setAdvanceMode),
    setDelay: wrapMutation(runesStore.setDelay),
    setChapterManifest: wrapMutation(runesStore.setChapterManifest),
    setChapterTitle: wrapMutation(runesStore.setChapterTitle),
    setStoryTitle: wrapMutation(runesStore.setStoryTitle),
    setStoryIdentifiers: wrapMutation(runesStore.setStoryIdentifiers),
    setChapterCameraTrack: wrapMutation(runesStore.setChapterCameraTrack),
    setChapterViewBox: wrapMutation(runesStore.setChapterViewBox),
    setChapterDescription: wrapMutation(runesStore.setChapterDescription),
    setLayerOpacities: wrapMutation(runesStore.setLayerOpacities),
    exportStory: () => runesStore.exportStory(),
    loadStory: (next: StoryState) => {
      runesStore.loadStory(normalizeStoryAnnotations(next));
      storyStore.set(runesStore.story);
      dirty.set(false);
    },
  };

  const selectedChapterId = writable<string | null>(null);
  const activeChapterTask = writable<ChapterTaskId | null>(null);
  const selectedDrawingAnnotationId = writable<string | null>(null);
  const chapterAnnotationTool = writable<ChapterAnnotationTool>("select");
  const uiMode = writable<UIMode>("idle");
  const positioningLanguage = writable<string | null>(null);
  const selectedMotionPointId = writable<string | null>(null);
  const motionPreviewing = writable(false);
  const drawerOpen = derived(
    uiMode,
    (mode) => mode !== "idle" && mode !== "annotationPositioning",
  );
  const viewBox = writable<ViewBox | null>(null);
  const mediaType = writable<MediaType | null>(null);
  const avMarksValid = writable(true);
  const transitionDelayDefault = writable(
    collectLatestTransitionDelay(initialStoryData),
  );
  const error = writable<string | null>(null);
  const validationErrors = writable<string[]>([]);
  const currentManifest = writable<string | null>(null);
  const viewerCanvasIndex = writable(0);
  const viewerCanvasCount = writable(0);
  const modelPoseDebug = writable<string | null>(null);
  const annotationLanguage = writable(languages[0]);
  const saveState = writable<SaveState>({ status: "idle" });
  const saveConfigured = writable(false);
  const canUndo = writable(false);
  const canRedo = writable(false);
  const saveModalOpen = writable(false);
  const saveModalPayload = writable<ExportEnvelope | null>(null);
  const mediaSourcesStore = writable<MediaSource[]>([]);
  const layerOpacitiesStore = writable<Record<string, number>>({});
  let saveConfig: SaveConfig | null = null;

  const mediaMarks = createMediaMarks();
  const mediaMarksState = writable<MediaMarksState>(mediaMarks.getState());
  const modelPose = createModelPose();
  const narrationPlayer = createNarrationPlayer();

  const history = createStoryHistory(initialStoryData);
  let latestNarrationSegments =
    collectLatestNarrationSegments(initialStoryData);

  let viewer: PluginContext["viewer"] | null = null;
  let eventBus: PluginContext["events"] | null = null;
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
  let motionPreviewFrame: number | null = null;
  let annotationTransactionSnapshot: StoryState | null = null;
  let annotationTransactionWasDirty = false;
  let annotationTransactionChanged = false;

  const syncEditableStoryAnnotations = () => {
    const chapterId = get(selectedChapterId);
    const chapter = get(storyStore).chapters.find(
      (entry) => entry.id === chapterId,
    );
    const canvasId = chapter
      ? chapter.canvasId || `${chapter.manifest}/canvas/${chapter.canvasIndex}`
      : '';
    const preferredLanguages = [get(annotationLanguage), language, ...languages];
    const annotations: ResolvedAnnotation[] = (chapter?.drawingAnnotations ?? []).flatMap(
      (drawing) => {
        const annotation = storyDrawingToResolved(
          drawing,
          canvasId,
          preferredLanguages,
        );
        return annotation ? [annotation] : [];
      },
    );
    viewer?.setStoryAnnotations?.(annotations);
  };

  activeChapterTask.subscribe((task) => {
    if (task === "focus") {
      if (!annotationTransactionSnapshot) {
        annotationTransactionSnapshot = cloneStoryValue(
          storyStoreWrapper.exportStory(),
        );
        annotationTransactionWasDirty = get(dirty);
        annotationTransactionChanged = false;
        // The open annotation transaction becomes one undo step when saved.
        // Older story history must not be applied through the middle of it.
        canUndo.set(false);
        canRedo.set(false);
      }
      viewer?.setStoryAnnotationEditing?.(true);
      syncEditableStoryAnnotations();
      return;
    }
    // Closing the task through a host control is an implicit commit. The
    // in-panel Cancel path clears the snapshot before changing the task, so it
    // never reaches this branch.
    if (annotationTransactionSnapshot) {
      if (annotationTransactionChanged) history.push(annotationTransactionSnapshot);
      annotationTransactionSnapshot = null;
      annotationTransactionChanged = false;
      canUndo.set(history.canUndo());
      canRedo.set(history.canRedo());
    }
    chapterAnnotationTool.set("select");
    selectedDrawingAnnotationId.set(null);
    viewer?.setAnnotationTool?.("select");
    viewer?.setStoryAnnotationEditing?.(false);
  });

  const preview = createStoryPreviewOrchestrator({
    getStory: () => get(storyStore),
    getSelectedChapterId: () => get(selectedChapterId),
    selectChapter: (chapterId) => selectedChapterId.set(chapterId),
    applyChapter: (chapter) => applyChapter(chapter),
    getNarrationSegment: (chapter) => getNarrationSegment(chapter),
    closeEditors: () => {
      activeChapterTask.set(null);
      uiMode.set("idle");
    },
    stopPlayback: () => stopChapterPlayback(),
  });
  const isPreviewing = preview.isPreviewing;

  const setError = (message: string | null) => {
    error.set(message);
  };

  const saveStory = async (): Promise<SaveResult> => {
    const validation = saveExport();
    if (!validation.ok) {
      saveState.set({
        status: "error",
        message: validation.errors.join(" · "),
      });
      return { ok: false, message: validation.errors.join(" · ") };
    }
    const payload = buildExportEnvelope(storyStoreWrapper.exportStory());
    const saveHandler = saveConfig?.handler;
    const hasHandler =
      typeof saveHandler === "function" && (saveConfig?.enabled ?? true);
    const hasEndpoint =
      saveConfig?.endpoint && (saveConfig.enabled ?? true) ? true : false;
    if (hasEndpoint && !hasHandler && !get(storyStore).id) {
      const message = translate('storyBuilder.errors.missingPublicId');
      saveState.set({ status: "error", message, code: "missing_public_id" });
      return { ok: false, message, code: "missing_public_id" };
    }
    if (!hasEndpoint && !hasHandler) {
      saveModalPayload.set(payload);
      saveModalOpen.set(true);
      saveState.set({ status: "idle" });
      return { ok: true };
    }
    saveState.set({ status: "saving" });
    let result: SaveResult;
    if (hasHandler) {
      try {
        result = (await saveHandler!(payload)) ?? { ok: true };
      } catch (error) {
        result = {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          code: "handler",
        };
      }
    } else {
      result = await performFetchWithTimeout(saveConfig as SaveConfig, payload);
    }
    if (result.ok) {
      saveState.set({ status: "success", message: result.message });
      dirty.set(false);
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
    saveConfigured.set(
      (typeof config?.handler === "function" && (config.enabled ?? true)) ||
        Boolean(config?.endpoint && (config.enabled ?? true)),
    );
  };

  const closeSaveModal = () => {
    saveModalOpen.set(false);
  };

  const setAnnotationLanguage = (lang: string) => {
    annotationLanguage.set(lang);
    if (get(activeChapterTask) === "focus") syncEditableStoryAnnotations();
  };

  const setChapterAnnotationTool = (tool: ChapterAnnotationTool) => {
    if (
      tool !== "select" &&
      (!get(selectedChapterId) || get(activeChapterTask) !== "focus")
    )
      return;
    chapterAnnotationTool.set(tool);
    viewer?.setStoryAnnotationEditing?.(get(activeChapterTask) === "focus");
    viewer?.setAnnotationTool?.(tool);
  };

  const mutateChapterDrawingAnnotations = (
    transform: (
      items: ChapterDrawingAnnotation[],
    ) => ChapterDrawingAnnotation[],
  ) => {
    const chapterId = get(selectedChapterId);
    if (!chapterId) return;
    const current = storyStoreWrapper.exportStory();
    const chapterIndex = current.chapters.findIndex(
      (entry) => entry.id === chapterId,
    );
    if (chapterIndex < 0) return;
    if (get(activeChapterTask) === "focus" && annotationTransactionSnapshot) {
      annotationTransactionChanged = true;
    } else {
      pushHistorySnapshot();
    }
    const next = cloneStoryValue(current);
    const chapter = next.chapters[chapterIndex];
    chapter.drawingAnnotations = transform(chapter.drawingAnnotations ?? []);
    runesStore.loadStory(next);
    storyStore.set(runesStore.story);
    dirty.set(true);
    syncEditableStoryAnnotations();
  };

  const addChapterDrawingAnnotation = (
    annotation: ResolvedAnnotation,
    createdTool?: ChapterAnnotationTool,
  ) => {
    const tool = createdTool ?? get(chapterAnnotationTool);
    if (tool === "select") return;
    const drawing: ChapterDrawingAnnotation = {
      id: annotation.id,
      type: tool,
      ...(annotation.text ? { text: annotation.text } : {}),
      ...(annotation.rect ? { rect: annotation.rect } : {}),
      ...(annotation.point ? { point: annotation.point } : {}),
      ...(annotation.polygon?.points
        ? { points: annotation.polygon.points }
        : {}),
    };
    if (!drawing.rect && !drawing.point && !drawing.points?.length) return;
    mutateChapterDrawingAnnotations((items) => [
      ...items.filter((entry) => entry.id !== drawing.id),
      drawing,
    ]);
    selectedDrawingAnnotationId.set(drawing.id);
    viewer?.setStoryAnnotationSelection?.(drawing.id);
    chapterAnnotationTool.set("select");
  };

  const deleteChapterDrawingAnnotation = (annotationId: string) => {
    mutateChapterDrawingAnnotations((items) =>
      items.filter((entry) => entry.id !== annotationId),
    );
    if (get(selectedDrawingAnnotationId) === annotationId) {
      selectedDrawingAnnotationId.set(null);
      viewer?.setStoryAnnotationSelection?.(null);
    }
  };

  const deleteChapterTextAnnotation = (lang: string) => {
    const chapterId = get(selectedChapterId);
    if (!chapterId) return;
    const current = storyStoreWrapper.exportStory();
    const chapterIndex = current.chapters.findIndex(
      (entry) => entry.id === chapterId,
    );
    if (chapterIndex < 0 || !current.chapters[chapterIndex].annotations?.[lang])
      return;
    pushHistorySnapshot();
    const next = cloneStoryValue(current);
    const annotations = { ...(next.chapters[chapterIndex].annotations ?? {}) };
    delete annotations[lang];
    if (Object.keys(annotations).length > 0)
      next.chapters[chapterIndex].annotations = annotations;
    else delete next.chapters[chapterIndex].annotations;
    runesStore.loadStory(next);
    storyStore.set(runesStore.story);
    dirty.set(true);
    if (get(positioningLanguage) === lang) {
      positioningLanguage.set(null);
      uiMode.set("chapterEdit");
    }
  };

  const focusViewerOnBounds = (bounds: ViewBox) => {
    if (!viewer) return;
    const current = viewer.getViewBox?.();
    const currentWidth = Math.max(1, current?.w ?? (bounds.w || 100));
    const currentHeight = Math.max(1, current?.h ?? (bounds.h || 100));
    const aspect = currentWidth / currentHeight;
    let width = Math.max(bounds.w * 1.5, currentWidth * 0.18, 24);
    let height = Math.max(bounds.h * 1.5, currentHeight * 0.18, 24);
    if (width / height > aspect) height = width / aspect;
    else width = height * aspect;
    const centreX = bounds.x + bounds.w / 2;
    const centreY = bounds.y + bounds.h / 2;
    viewer.setViewBox?.({
      x: centreX - width / 2,
      y: centreY - height / 2,
      w: width,
      h: height,
    });
  };

  const editChapterDrawingAnnotation = (annotationId: string) => {
    const chapterId = get(selectedChapterId);
    const drawing = get(storyStore)
      .chapters.find((entry) => entry.id === chapterId)
      ?.drawingAnnotations?.find((entry) => entry.id === annotationId);
    if (!drawing || get(activeChapterTask) !== "focus") return;
    setChapterAnnotationTool("select");
    selectedDrawingAnnotationId.set(annotationId);
    syncEditableStoryAnnotations();
    viewer?.setStoryAnnotationSelection?.(annotationId);
  };

  const editChapterTextAnnotation = (lang: string) => {
    const chapterId = get(selectedChapterId);
    const chapter = get(storyStore).chapters.find(
      (entry) => entry.id === chapterId,
    );
    const annotation = chapter?.annotations?.[lang];
    if (
      !chapter ||
      !annotation?.text?.trim() ||
      get(activeChapterTask) !== "focus"
    )
      return;
    setAnnotationLanguage(lang);
    const placement = annotation.placement ?? chapter.annotationPlacement;
    if (placement) {
      const absolute =
        placement.x > 1 || placement.y > 1 || placement.w > 1 || placement.h > 1
          ? placement
          : chapter.viewBox
            ? {
                x: chapter.viewBox.x + placement.x * chapter.viewBox.w,
                y: chapter.viewBox.y + placement.y * chapter.viewBox.h,
                w: placement.w * chapter.viewBox.w,
                h: placement.h * chapter.viewBox.h,
              }
            : null;
      if (absolute) focusViewerOnBounds(absolute);
    }
    viewer?.setStoryAnnotationSelection?.(null);
    uiMode.set("annotationPositioning");
    positioningLanguage.set(lang);
  };

  const updateChapterDrawingAnnotation = (
    annotationId: string,
    patch: Partial<ResolvedAnnotation>,
  ) => {
    mutateChapterDrawingAnnotations((items) =>
      items.map((drawing) => {
        if (drawing.id !== annotationId) return drawing;
        // Spread the existing drawing so styling/label metadata (label, color,
        // strokeWidth, text) survives a geometry edit; only the geometry keys
        // are swapped out for the shape that was actually changed.
        if (patch.rect) {
          const next = {
            ...drawing,
            type: "rectangle" as const,
            rect: patch.rect,
          };
          delete next.point;
          delete next.points;
          return next;
        }
        if (patch.point) {
          const next = {
            ...drawing,
            type: "point" as const,
            point: patch.point,
          };
          delete next.rect;
          delete next.points;
          return next;
        }
        if (patch.polygon?.points) {
          const polygonType: ChapterDrawingAnnotation["type"] =
            drawing.type === "line" || drawing.type === "freehand"
              ? drawing.type
              : "polygon";
          const next = {
            ...drawing,
            type: polygonType,
            points: patch.polygon.points,
          };
          delete next.rect;
          delete next.point;
          return next;
        }
        return drawing;
      }),
    );
  };

  const setChapterDrawingAnnotationLabel = (
    annotationId: string,
    lang: string,
    value: string,
  ) => {
    const text = value.trim();
    mutateChapterDrawingAnnotations((items) =>
      items.map((drawing) => {
        if (drawing.id !== annotationId) return drawing;
        const label: Record<string, string> = { ...(drawing.label ?? {}) };
        if (text) label[lang] = text;
        else delete label[lang];
        const next = { ...drawing };
        if (Object.keys(label).length > 0) next.label = label;
        else delete next.label;
        // A per-language label supersedes the legacy single-language `text`.
        delete next.text;
        return next;
      }),
    );
  };

  const setChapterDrawingAnnotationStyle = (
    annotationId: string,
    style: {
      motivation?: ChapterDrawingAnnotation["motivation"] | null;
      color?: string | null;
      strokeWidth?: ChapterAnnotationStrokeWidth;
      fillMode?: ChapterDrawingAnnotation["fillMode"];
    },
  ) => {
    mutateChapterDrawingAnnotations((items) =>
      items.map((drawing) => {
        if (drawing.id !== annotationId) return drawing;
        const next = { ...drawing };
        if (style.color !== undefined) {
          const color = style.color?.trim();
          if (color) next.color = color;
          else delete next.color;
        }
        if (style.strokeWidth !== undefined)
          next.strokeWidth = style.strokeWidth;
        if (style.fillMode !== undefined) next.fillMode = style.fillMode;
        if (style.motivation !== undefined) {
          // Null is "unset", not "empty": the annotation goes back to having
          // its motivation inferred rather than carrying a blank one.
          if (style.motivation) next.motivation = style.motivation;
          else delete next.motivation;
        }
        return next;
      }),
    );
  };

  const pushHistorySnapshot = () => {
    history.push(storyStoreWrapper.exportStory());
    canUndo.set(history.canUndo());
    canRedo.set(history.canRedo());
  };

  const restoreHistoryStory = (next: StoryState | null) => {
    if (!next) return;
    activeChapterTask.set(null);
    runesStore.loadStory(next);
    storyStore.set(runesStore.story);
    dirty.set(true);
    const selectedId = get(selectedChapterId);
    const selectedStillExists = next.chapters.some(
      (chapter) => chapter.id === selectedId,
    );
    const nextSelection = selectedStillExists
      ? selectedId
      : (next.chapters[0]?.id ?? null);
    selectedChapterId.set(nextSelection);
    if (nextSelection) {
      const chapter = next.chapters.find((entry) => entry.id === nextSelection);
      if (chapter) applyChapter(chapter);
    }
    canUndo.set(history.canUndo());
    canRedo.set(history.canRedo());
  };

  const undo = () =>
    restoreHistoryStory(history.undo(storyStoreWrapper.exportStory()));
  const redo = () =>
    restoreHistoryStory(history.redo(storyStoreWrapper.exportStory()));

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
    stopMotionPreview();
    // Leaving a preview part-way through a swap must not strand a blank stage.
    revealStage(0);
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
    if (activePlaybackChapterId === chapter.id) return;
    stopChapterPlayback();
    activePlaybackChapterId = chapter.id;
    // Update selected chapter so UI shows which chapter is playing and annotations appear
    selectedChapterId.set(chapter.id);
    const token = ++activePlaybackToken;
    const narration = getNarrationSegment(chapter);
    startMotionTrackPlayback(chapter);
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

  const viewBoxMatches = (a: ViewBox | null, b: ViewBox | undefined) =>
    a && b ? framingsWithin(a, b, APPLIED_FRAMING_TOLERANCE) : false;

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
    revealStageWhenPainted();
  };

  let cancelAnimation: (() => void) | null = null;
  let cancelLayersAnimation: (() => void) | null = null;

  const animateViewBox = (to: ViewBox, durationMs = 320) => {
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
      // Every terminal branch reveals: this is the one place the incoming
      // framing is known to have landed, which is what a hidden stage is
      // waiting for. Both source-swap resume paths end up here.
      if (!chapter.viewBox) {
        pendingChapterApply = null;
        revealStageWhenPainted();
        return;
      }
      const current = viewer.getViewBox?.() ?? null;
      if (viewBoxMatches(current, chapter.viewBox)) {
        pendingChapterApply = null;
        revealStageWhenPainted();
        return;
      }
      if (pendingApplyRetries >= maxPendingApplyRetries) {
        pendingChapterApply = null;
        revealStageWhenPainted();
        return;
      }
      pendingApplyRetries += 1;
      setTimeout(attempt, 80);
    };

    // A frame is the natural moment to read the viewer back, but frame
    // callbacks stop arriving in a background tab. Racing a short timer keeps
    // the apply — and the stage reveal that follows it — from stalling there.
    let started = false;
    const startAttempt = () => {
      if (started || token !== pendingApplyToken) return;
      started = true;
      attempt();
    };
    if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
      window.requestAnimationFrame(startAttempt);
    }
    setTimeout(startAttempt, 32);
  };

  /**
   * Stage crossfade, matching the story viewer.
   *
   * The editor swaps its source through the same viewer the reader sees, so a
   * chapter that changes Manifest or Canvas cuts between two unrelated images
   * mid-preview. Fading the stage down for the swap and back up once the new
   * framing is set makes the editor show what a reader will get.
   */
  const stageFade = writable<StageFade>({ opacity: 1, durationMs: 0 });
  let stageHidden = false;
  let stageRevealTimer: ReturnType<typeof setTimeout> | null = null;
  let stageSwapTimer: ReturnType<typeof setTimeout> | null = null;

  const crossfadeMs = () => {
    const reduceMotion = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    return reduceMotion ? 0 : STAGE_CROSSFADE_MS;
  };

  // The stage belongs to the viewer layout, not to any builder panel, so the
  // request travels on the viewer's own event bus.
  const setStageFade = (opacity: number, durationMs: number) => {
    stageFade.set({ opacity, durationMs });
    eventBus?.emit("stageFade", { opacity, durationMs });
  };

  const revealStage = (durationMs = crossfadeMs()) => {
    if (stageRevealTimer) {
      clearTimeout(stageRevealTimer);
      stageRevealTimer = null;
    }
    // Revealing abandons the swap this fade was covering — stopping a preview
    // must not have the source change land afterwards.
    if (stageSwapTimer) {
      clearTimeout(stageSwapTimer);
      stageSwapTimer = null;
    }
    if (!stageHidden) return;
    stageHidden = false;
    setStageFade(1, durationMs);
  };

  /**
   * Hides the stage, then runs the swap once it is actually hidden. A source
   * that never arrives must not stall the editor behind a blank stage, so the
   * hide carries its own deadline.
   */
  const afterStageHidden = (swap: () => void) => {
    const ms = crossfadeMs();
    // A swap still waiting on the fade belongs to a chapter that has since been
    // superseded. Letting it land would move the viewer back to the old source
    // after the new one had already arrived.
    if (stageSwapTimer) {
      clearTimeout(stageSwapTimer);
      stageSwapTimer = null;
    }
    if (stageHidden) {
      swap();
      return;
    }
    stageHidden = true;
    setStageFade(0, ms);
    if (stageRevealTimer) clearTimeout(stageRevealTimer);
    stageRevealTimer = setTimeout(() => {
      stageRevealTimer = null;
      revealStage(0);
    }, ms + 4000);
    if (ms <= 0) {
      swap();
      return;
    }
    stageSwapTimer = setTimeout(() => {
      stageSwapTimer = null;
      swap();
    }, ms);
  };

  const revealStageWhenPainted = () => {
    if (!stageHidden) return;
    // A frame after the framing call, so what fades up is the new canvas in
    // position rather than the tail of the viewer settling onto it. Frame
    // callbacks stop arriving in a background tab, so a short timer races them
    // — otherwise the stage waits on the deadline below to be released.
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      revealStage();
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(reveal));
    }
    setTimeout(reveal, 120);
  };

  const applyChapter = (chapter: Chapter) => {
    if (!viewer) return;
    if (cancelLayersAnimation) {
      cancelLayersAnimation();
      cancelLayersAnimation = null;
    }

    // A source swap is a two-phase affair here: the branches below hand off to
    // the viewer and return, and a manifest or page event resumes the apply
    // through `beginPendingApply`, which is where the stage is revealed.
    const viewerManifest =
      viewer.getManifestId?.() ?? viewer.getState?.()?.manifestId ?? null;
    if (chapter.manifest && chapter.manifest !== viewerManifest) {
      pendingChapterApply = chapter;
      // Abandon any apply still retrying for the outgoing chapter. Its framing
      // belongs to the source being replaced, and letting it finish would also
      // reveal the stage this swap has just hidden.
      pendingApplyToken += 1;
      afterStageHidden(() => {
        viewer?.setManifest(chapter.manifest);
        currentManifest.set(chapter.manifest);
      });
      return;
    }
    const currentIndex = viewer.getCanvasIndex?.() ?? -1;
    if (
      typeof chapter.canvasIndex === "number" &&
      chapter.canvasIndex !== currentIndex
    ) {
      pendingChapterApply = chapter;
      pendingApplyToken += 1;
      afterStageHidden(() => {
        viewer?.setCanvasByIndex(chapter.canvasIndex);
      });
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
        animateViewBox(chapter.viewBox);
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
        setError(translate('storyBuilder.errors.captureBlocked', {
          reason: translate(`storyBuilder.errors.capture.${result.reason}`),
        }));
      }
      return false;
    }
    setError(null);
    const activeLanguage = get(annotationLanguage);
    const latestNarrationSegment = latestNarrationSegments[activeLanguage];
    const transitionDelay = get(transitionDelayDefault);
    storyStoreWrapper.addChapterFromCapture({ capture: result.capture });
    const storyValue = get(storyStore);
    const lastId = storyValue.chapters[storyValue.chapters.length - 1]?.id;
    if (lastId) {
      storyStoreWrapper.setAdvanceMode({ chapterId: lastId, mode: "auto" });
      storyStoreWrapper.setDelay({
        chapterId: lastId,
        delayMs: transitionDelay,
      });
      if (latestNarrationSegment) {
        storyStoreWrapper.setNarrationSegment({
          chapterId: lastId,
          language: activeLanguage,
          start: latestNarrationSegment.start,
          end: latestNarrationSegment.end,
        });
      }
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
        setError(translate('storyBuilder.errors.captureBlocked', {
          reason: translate(`storyBuilder.errors.capture.${result.reason}`),
        }));
      }
      return false;
    }
    setError(null);
    storyStoreWrapper.updateChapterFromCapture({
      chapterId,
      capture: result.capture,
    });
    const updatedChapter = get(storyStore).chapters.find(
      (chapter) => chapter.id === chapterId,
    );
    const track = updatedChapter?.cameraTrack;
    const stableViewBox = result.capture.viewBox;
    if (track?.preset && track.preset !== "custom" && stableViewBox) {
      storyStoreWrapper.setChapterCameraTrack({
        chapterId,
        cameraTrack: configureCameraTrackPreset(
          track,
          track.preset,
          stableViewBox,
          track.durationMs,
          { preservePoints: true },
        ),
      });
    }
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

  /**
   * Brings a capture's framing to the story's canonical aspect. Captures read
   * the live viewport, so without this a chapter created with the inspector or
   * the motion timeline open is stored at a different shape from its
   * neighbours and reframes differently for a reader.
   */
  const withNormalisedFraming = <T extends { ok: boolean }>(result: T): T => {
    if (!result.ok) return result;
    const captured = (result as { capture?: { viewBox?: ViewBox } }).capture;
    if (!captured?.viewBox) return result;
    const normalised = normaliseViewBox(
      captured.viewBox,
      presentationAspectFor(captured.viewBox),
    );
    // Normalising can push a box back over the edge of the image; the
    // default frame should start where every later edit will keep it.
    const contentSize = viewer?.getContentSize?.() ?? null;
    return {
      ...result,
      capture: {
        ...captured,
        viewBox: contentSize ? fitViewBoxToContent(normalised, contentSize) : normalised,
      },
    };
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
      const markedSegment = mediaMarks.getSegment();
      const availableSources =
        viewer.getMediaSources?.() ?? get(mediaSourcesStore);
      mediaSourcesStore.set(availableSources);
      const sourceDuration = availableSources.find(
        (source) => source.type === type && Number.isFinite(source.duration),
      )?.duration;
      const segment =
        markedSegment ??
        (sourceDuration != null && sourceDuration > 0
          ? { start: 0, end: sourceDuration }
          : null);
      return captureAudioVideo(viewer, segment, manifestOverride);
    }
    if (type === "model") {
      return captureModel(viewer, modelPose.getPose(), manifestOverride);
    }
    return withNormalisedFraming(captureImagePdf(viewer, manifestOverride));
  };

  /*
   * What the stage draws as frames.
   *
   * The chapter frame is always there for a spatial chapter — a default
   * nobody moved is visible rather than silently recorded — and it is the
   * thing with handles unless the author is working on something else on the
   * canvas: drawing annotations, or placing camera points, when it steps back
   * to a passive outline and the keyframes take the handles instead. Nothing
   * is drawn while a preview is driving the viewer or a text box is being
   * placed, because then the stage is not the author's to edit.
   */
  const CHAPTER_FRAME_ID = "chapter";
  const KEYFRAME_FRAME_PREFIX = "keyframe:";
  const keyframeIdFromFrame = (frameId: string): string | null =>
    frameId.startsWith(KEYFRAME_FRAME_PREFIX)
      ? frameId.slice(KEYFRAME_FRAME_PREFIX.length)
      : null;

  const stageFrames = derived(
    [
      storyStore,
      selectedChapterId,
      activeChapterTask,
      isPreviewing,
      uiMode,
      selectedMotionPointId,
      mediaType,
    ],
    ([
      $story,
      $chapterId,
      $task,
      $previewing,
      $mode,
      $motionPoint,
      $mediaType,
    ]): { frames: StoryFrame[]; selection: string | null } => {
      const none = { frames: [] as StoryFrame[], selection: null };
      const chapter = $story.chapters.find((entry) => entry.id === $chapterId);
      if (!chapter?.viewBox || $previewing || $mode === "annotationPositioning") {
        return none;
      }
      if (
        $mediaType === "audio" ||
        $mediaType === "video" ||
        $mediaType === "model" ||
        chapter.model
      ) {
        return none;
      }
      const aspect = frameAspect();
      const frames: StoryFrame[] = [
        {
          id: CHAPTER_FRAME_ID,
          kind: "chapter",
          viewBox: chapter.viewBox,
          aspect,
          editable: $task !== "focus" && $task !== "motion",
        },
      ];
      if ($task === "motion") {
        (chapter.cameraTrack?.keyframes ?? []).forEach((point, index) => {
          if (!point.viewBox) return;
          frames.push({
            id: `${KEYFRAME_FRAME_PREFIX}${point.id}`,
            kind: "keyframe",
            viewBox: point.viewBox,
            aspect,
            label: String(index + 1),
            editable: true,
          });
        });
      }
      const selection =
        $task === "motion"
          ? $motionPoint
            ? `${KEYFRAME_FRAME_PREFIX}${$motionPoint}`
            : null
          : $task === "focus"
            ? null
            : CHAPTER_FRAME_ID;
      return { frames, selection };
    },
  );
  let lastPushedFrames = "";
  const pushStageFrames = ({
    frames,
    selection,
  }: {
    frames: StoryFrame[];
    selection: string | null;
  }) => {
    if (!viewer) return;
    const key = JSON.stringify({ frames, selection });
    if (key === lastPushedFrames) return;
    lastPushedFrames = key;
    viewer.setStoryFrames?.(frames);
    viewer.setStoryFrameSelection?.(selection);
  };

  const attach = (ctx: PluginContext) => {
    if (!ctx?.viewer) {
      return () => undefined;
    }
    viewer = ctx.viewer;
    eventBus = ctx.events;
    viewer.setStoryAnnotationEditing?.(get(activeChapterTask) === "focus");
    syncEditableStoryAnnotations();
    lastManifest =
      ctx.viewer.getManifestId?.() ??
      ctx.viewer.getState?.()?.manifestId ??
      null;
    currentManifest.set(lastManifest);
    viewerCanvasIndex.set(ctx.viewer.getCanvasIndex?.() ?? 0);
    viewerCanvasCount.set(ctx.viewer.getCanvasCount?.() ?? 0);
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
        viewerCanvasIndex.set(
          snapshot.canvasIndex ?? ctx.viewer.getCanvasIndex?.() ?? 0,
        );
        viewerCanvasCount.set(ctx.viewer.getCanvasCount?.() ?? 0);
        viewBox.set(
          snapshot.viewBox ?? ctx.viewer.getViewBox?.() ?? get(viewBox),
        );
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
        viewerCanvasCount.set(ctx.viewer.getCanvasCount?.() ?? 0);
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
        viewerCanvasIndex.set(index);
        viewerCanvasCount.set(ctx.viewer.getCanvasCount?.() ?? 0);
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
        mediaSourcesStore.set(ctx.viewer.getMediaSources?.() ?? []);
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
      const offAnnotationCreate = ctx.events.on(
        "annotationCreate",
        ({ annotation, tool }) => {
          if (
            get(activeChapterTask) !== "focus" ||
            !annotation ||
            typeof annotation !== "object"
          ) {
            return;
          }
          addChapterDrawingAnnotation(annotation as ResolvedAnnotation, tool);
        },
      );
      const offAnnotationUpdate = ctx.events.on(
        "annotationUpdate",
        ({ annotationId, patch }) => {
          if (get(activeChapterTask) === "focus") {
            updateChapterDrawingAnnotation(annotationId, patch);
          }
        },
      );
      const offAnnotationDelete = ctx.events.on(
        "annotationDelete",
        ({ annotationId }) => {
          if (get(activeChapterTask) === "focus")
            deleteChapterDrawingAnnotation(annotationId);
        },
      );
      const offFrameChange = ctx.events.on(
        "storyFrameChange",
        ({ frameId, viewBox: nextViewBox }) => {
          if (frameId === CHAPTER_FRAME_ID) {
            setChapterPosition(nextViewBox);
            return;
          }
          const keyframeId = keyframeIdFromFrame(frameId);
          if (keyframeId) setMotionPointViewBox(keyframeId, nextViewBox);
        },
      );
      const offFrameSelect = ctx.events.on("storyFrameSelect", ({ frameId }) => {
        const keyframeId = frameId ? keyframeIdFromFrame(frameId) : null;
        if (keyframeId) selectedMotionPointId.set(keyframeId);
      });
      const offFrames = stageFrames.subscribe(pushStageFrames);

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
        offAnnotationCreate();
        offAnnotationUpdate();
        offAnnotationDelete();
        offFrameChange();
        offFrameSelect();
        offFrames();
        lastPushedFrames = "";
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
        // Detaching mid-fade must not leave a swap or a reveal queued against a
        // viewer that is going away.
        revealStage(0);
        eventBus = null;
      }
    };
  };

  const addChapter = () => {
    if (pendingAddChapter) return;
    activeChapterTask.set(null);
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

  /**
   * The source task can retarget a chapter at a different Manifest or Canvas,
   * but the canvas the chapter stores is only ever written by a capture. Moving
   * the dropdown moves the viewer alone, so without this the chapter keeps the
   * canvas it was created on and silently replays the wrong image. A full
   * re-capture is the right tool because the stored framing belongs to the old
   * canvas too, and only re-reading the viewer brings both back into agreement.
   */
  const captureSourceRetarget = () => {
    const chapterId = get(selectedChapterId);
    if (!chapterId || !viewer) return;
    const chapter = get(storyStore).chapters.find(
      (entry) => entry.id === chapterId,
    );
    if (!chapter) return;

    const canvasId = viewer.getCanvasId?.() ?? null;
    const canvasIndex = viewer.getCanvasIndex?.() ?? -1;
    // A viewer that has not settled on a canvas has nothing to capture from.
    if (!canvasId && canvasIndex < 0) return;

    const unchanged =
      chapter.canvasId && canvasId
        ? chapter.canvasId === canvasId
        : chapter.canvasIndex === canvasIndex;
    if (unchanged) return;

    updateChapter();
  };

  /**
   * The aspect a framing should be stored at.
   *
   * An empty story has nothing to conform to, and the obvious candidate — the
   * framing being captured — is the shape of the editor stage at that instant.
   * Capture during a panel animation or before layout settles would then define
   * the whole story. The canvas image is the one signal that does not move, so
   * a new story takes its shape from the source it is about.
   */
  const presentationAspectFor = (box: ViewBox): number => {
    const current = get(storyStore);
    if (Number.isFinite(current.presentationAspect) && (current.presentationAspect ?? 0) > 0) {
      return current.presentationAspect as number;
    }
    const inferred = inferPresentationAspect(current);
    if (inferred !== null) return inferred;

    const contentSize = viewer?.getContentSize?.() ?? null;
    if (contentSize && contentSize.width > 0 && contentSize.height > 0) {
      return contentSize.width / contentSize.height;
    }
    return viewBoxAspect(box) ?? 4 / 3;
  };

  const commitChapterViewBox = (chapterId: string, requested: ViewBox) => {
    // Stored at the story's canonical aspect so every chapter responds to a
    // reader's window the same way. A capture carries the editor stage's shape
    // and manual entry carries whatever was typed; neither should decide how
    // this chapter is framed relative to the others.
    /*
     * Normalise first so the chapter is comparable with its siblings, then
     * bring it inside the canvas: a framing is a region of the image, and one
     * that hangs outside it cannot be written as a Media Fragment without
     * being silently truncated on the way out. Fitted, not clamped, so the
     * shape the frame was drawn at survives meeting the edge of the picture.
     */
    const contentSize = viewer?.getContentSize?.() ?? null;
    const normalised = normaliseViewBox(requested, presentationAspectFor(requested));
    const viewBox = contentSize
      ? fitViewBoxToContent(normalised, contentSize)
      : normalised;
    pushHistorySnapshot();
    storyStoreWrapper.setChapterViewBox({ chapterId, viewBox });
    const chapter = get(storyStore).chapters.find(
      (entry) => entry.id === chapterId,
    );
    const track = chapter?.cameraTrack;
    if (track?.preset && track.preset !== "custom") {
      storyStoreWrapper.setChapterCameraTrack({
        chapterId,
        cameraTrack: configureCameraTrackPreset(
          track,
          track.preset,
          viewBox,
          track.durationMs,
          {
            preservePoints: true,
          },
        ),
      });
    }
    setError(null);
  };

  /*
   * The camera is deliberately left where it is. The frame is an object on
   * the canvas the author has just placed by looking at it; flying the view to
   * it would move the very thing they are judging it against. "Go to frame"
   * in the inspector is the camera convenience, not this.
   */
  const setChapterPosition = (nextViewBox: ViewBox) => {
    const chapterId = get(selectedChapterId);
    if (!chapterId) return;
    const viewBox = { ...nextViewBox };
    if (
      ![viewBox.x, viewBox.y, viewBox.w, viewBox.h].every(Number.isFinite) ||
      viewBox.w <= 0 ||
      viewBox.h <= 0
    )
      return;
    commitChapterViewBox(chapterId, viewBox);
  };

  const deleteChapter = (chapterId: string) => {
    activeChapterTask.set(null);
    pushHistorySnapshot();
    const chapters = get(storyStore).chapters;
    const deletedIndex = chapters.findIndex(
      (chapter) => chapter.id === chapterId,
    );
    const fallbackId =
      chapters[deletedIndex + 1]?.id ?? chapters[deletedIndex - 1]?.id ?? null;
    chapterActions.deleteChapter(chapterId, () => {
      selectedChapterId.set(fallbackId);
      if (fallbackId) selectChapter(fallbackId);
    });
  };

  const duplicateChapter = (chapterId: string) => {
    const current = storyStoreWrapper.exportStory();
    const sourceIndex = current.chapters.findIndex(
      (chapter) => chapter.id === chapterId,
    );
    const source = current.chapters[sourceIndex];
    if (!source) return;
    activeChapterTask.set(null);
    pushHistorySnapshot();
    const duplicateId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `chapter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const duplicate: Chapter = {
      ...cloneStoryValue(source),
      id: duplicateId,
      title: source.title
        ? Object.fromEntries(
            Object.entries(source.title).map(([lang, value]) => [
              lang,
              `${value} copy`,
            ]),
          )
        : undefined,
    };
    const next = cloneStoryValue(current);
    next.chapters.splice(sourceIndex + 1, 0, duplicate);
    runesStore.loadStory(next);
    storyStore.set(runesStore.story);
    dirty.set(true);
    selectedChapterId.set(duplicateId);
    applyChapter(duplicate);
    uiMode.set("chapterEdit");
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
    // Deferred so the viewer is fully initialised after attach. The guard is
    // re-checked on arrival rather than when scheduling, so a selection made in
    // the meantime is not overridden by the chapter that was first at load.
    setTimeout(() => {
      const firstChapter = get(storyStore).chapters?.[0];
      if (firstChapter?.id && get(selectedChapterId) === null) {
        selectChapter(firstChapter.id);
      }
    }, 0);
  };

  const selectChapter = (chapterId: string | null) => {
    stopMotionPreview();
    selectedMotionPointId.set(null);
    activeChapterTask.set(null);
    setChapterAnnotationTool("select");
    selectedChapterId.set(chapterId);
    syncEditableStoryAnnotations();
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

  const openNarration = () => {
    activeChapterTask.set(null);
    uiMode.set("narrationPanel");
  };
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
  const closeChapter = () => {
    stopMotionPreview();
    selectedMotionPointId.set(null);
    activeChapterTask.set(null);
    uiMode.set("idle");
  };

  const startPreview = () => {
    void preview.start();
  };
  const stopPreview = preview.stop;

  /** Plays a single chapter exactly as the story viewer would present it. */
  const previewChapter = (chapterId?: string) => {
    const targetId = chapterId ?? get(selectedChapterId);
    if (!targetId) return;
    void preview.start({ chapterId: targetId, singleChapter: true });
  };

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

  const assignMediaSegment = (start: number, end: number) => {
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start
    )
      return;
    setMediaMarks(start, end);
    viewer?.setMediaSegment?.(start, end);
    const chapterId = get(selectedChapterId);
    if (!chapterId) return;
    const current = storyStoreWrapper.exportStory();
    const chapterIndex = current.chapters.findIndex(
      (entry) => entry.id === chapterId,
    );
    if (chapterIndex < 0) return;
    pushHistorySnapshot();
    const next = cloneStoryValue(current);
    next.chapters[chapterIndex].media = { start, end };
    runesStore.loadStory(next);
    storyStore.set(runesStore.story);
    dirty.set(true);
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

  const updateStoryTitle = (lang: string, value: string) => {
    pushHistorySnapshot();
    storyStoreWrapper.setStoryTitle({ language: lang, value });
  };

  const updateStoryIdentifiers = (id: string, annotationBase: string) => {
    if (get(storyStore).publication?.identifiersLocked) return;
    pushHistorySnapshot();
    storyStoreWrapper.setStoryIdentifiers({ id, annotationBase });
  };

  const motionPointId = (): string =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `camera-point-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const updateCameraTrack = (
    transform: (chapter: Chapter) => Chapter["cameraTrack"] | undefined,
  ) => {
    const chapterId = get(selectedChapterId);
    const chapter = get(storyStore).chapters.find(
      (item) => item.id === chapterId,
    );
    if (!chapterId || !chapter) return;
    pushHistorySnapshot();
    storyStoreWrapper.setChapterCameraTrack({
      chapterId,
      cameraTrack: transform(chapter),
    });
  };

  /** The aspect every frame on the stage is held to. */
  const frameAspect = (): number => {
    const current = get(storyStore);
    if (Number.isFinite(current.presentationAspect) && (current.presentationAspect ?? 0) > 0) {
      return current.presentationAspect as number;
    }
    const inferred = inferPresentationAspect(current);
    if (inferred !== null) return inferred;
    const contentSize = viewer?.getContentSize?.() ?? null;
    if (contentSize && contentSize.width > 0 && contentSize.height > 0) {
      return contentSize.width / contentSize.height;
    }
    return 4 / 3;
  };

  /** A keyframe box as it is stored: at the lock, and inside the canvas. */
  const settleKeyframeBox = (box: ViewBox): ViewBox => {
    const normalised = normaliseViewBox(box, frameAspect());
    const contentSize = viewer?.getContentSize?.() ?? null;
    return contentSize
      ? fitViewBoxToContent(normalised, contentSize)
      : normalised;
  };

  const centreOf = (box: ViewBox): { x: number; y: number } => ({
    x: box.x + box.w / 2,
    y: box.y + box.h / 2,
  });

  /**
   * A new camera point is not captured from the viewport. It starts as a
   * frame nested inside the previous point's — or, for the first point, the
   * chapter's — so it is visibly a distinct object the author can take hold
   * of and drag into place. A 3D chapter has no frame; its point holds the
   * pose the viewer is currently in, which is the only thing it can mean.
   */
  const addMotionPoint = () => {
    const created: { id: string | null } = { id: null };
    updateCameraTrack((chapter) => {
      const durationMs = Math.max(
        1,
        chapter.cameraTrack?.durationMs ??
          chapter.presentationDurationMs ??
          5000,
      );
      const existing = chapter.cameraTrack?.keyframes ?? [];
      const activePreset = chapter.cameraTrack?.preset ?? "custom";
      const reference =
        [...existing].reverse().find((point) => point.viewBox)?.viewBox ??
        chapter.viewBox;
      const viewBox = reference ? settleKeyframeBox(nestedFrame(reference)) : undefined;
      const model = viewer?.getModelPose?.() ?? chapter.model;
      const capturedLayers =
        viewer?.getLayerOpacities?.() ?? chapter.layerOpacities;
      if (!viewBox && !model) return chapter.cameraTrack;
      const point = {
        id: motionPointId(),
        timeMs: 0,
        ...(viewBox ? { focus: centreOf(viewBox), viewBox } : {}),
        ...(model ? { model } : {}),
        ...(capturedLayers ? { layerOpacities: capturedLayers } : {}),
      };
      created.id = point.id;
      const nextTrack: NonNullable<Chapter["cameraTrack"]> = {
        ...chapter.cameraTrack,
        durationMs,
        preset: activePreset,
        easing: chapter.cameraTrack?.easing ?? "ease-in-out",
        keyframes: retimeCameraKeyframes([...existing, point], durationMs),
      };
      return activePreset !== "custom" && chapter.viewBox
        ? configureCameraTrackPreset(
            nextTrack,
            activePreset,
            chapter.viewBox,
            durationMs,
            { preservePoints: true },
          )
        : nextTrack;
    });
    if (created.id) selectedMotionPointId.set(created.id);
  };

  /**
   * Commits a keyframe frame that was moved or resized on the stage.
   *
   * A named motion style sizes its points itself and only asks where they
   * look, so moving a point keeps the style and only its focus changes.
   * Resizing one is a different statement — the author wants this point at
   * this zoom — and the track becomes custom so the size is kept.
   */
  const setMotionPointViewBox = (keyframeId: string, nextViewBox: ViewBox) => {
    if (
      ![nextViewBox.x, nextViewBox.y, nextViewBox.w, nextViewBox.h].every(
        Number.isFinite,
      ) ||
      nextViewBox.w <= 0 ||
      nextViewBox.h <= 0
    )
      return;
    updateCameraTrack((chapter) => {
      const track = chapter.cameraTrack;
      const existing = track?.keyframes ?? [];
      const point = existing.find((entry) => entry.id === keyframeId);
      if (!track || !point) return track;
      const viewBox = settleKeyframeBox(nextViewBox);
      const tolerance = Math.max(1, viewBox.w * 0.005);
      const resized =
        !point.viewBox ||
        Math.abs(point.viewBox.w - viewBox.w) > tolerance ||
        Math.abs(point.viewBox.h - viewBox.h) > tolerance;
      const activePreset = track.preset ?? "custom";
      const preset = resized && activePreset !== "custom" ? "custom" : activePreset;
      const keyframes = existing.map((entry) =>
        entry.id === keyframeId
          ? { ...entry, focus: centreOf(viewBox), viewBox }
          : entry,
      );
      const nextTrack: NonNullable<Chapter["cameraTrack"]> = {
        ...track,
        preset,
        keyframes,
      };
      return preset !== "custom" && chapter.viewBox
        ? configureCameraTrackPreset(
            nextTrack,
            preset,
            chapter.viewBox,
            track.durationMs,
            { preservePoints: true },
          )
        : nextTrack;
    });
  };

  const deleteMotionPoint = (keyframeId: string) => {
    if (get(selectedMotionPointId) === keyframeId) selectedMotionPointId.set(null);
    updateCameraTrack((chapter) => {
      if (!chapter.cameraTrack) return undefined;
      const keyframes = chapter.cameraTrack.keyframes.filter(
        (point) => point.id !== keyframeId,
      );
      return {
        ...chapter.cameraTrack,
        preset: "custom",
        keyframes: retimeCameraKeyframes(
          keyframes,
          chapter.cameraTrack.durationMs,
        ),
      };
    });
  };

  const updateMotionDuration = (durationMs: number) => {
    updateCameraTrack((chapter) => {
      const safeDuration = Math.max(
        1,
        Number.isFinite(durationMs) ? durationMs : 5000,
      );
      return {
        ...chapter.cameraTrack,
        durationMs: safeDuration,
        preset: chapter.cameraTrack?.preset ?? "ken-burns",
        easing: chapter.cameraTrack?.easing ?? "ease-in-out",
        keyframes: retimeCameraKeyframes(
          chapter.cameraTrack?.keyframes ?? [],
          safeDuration,
        ),
      };
    });
  };

  const updateMotionPathType = (pathType: "linear" | "spline") => {
    updateCameraTrack((chapter) => {
      const currentView = chapter.viewBox;
      const track =
        chapter.cameraTrack ??
        (currentView
          ? generateCameraPreset("ken-burns", currentView, 5000)
          : undefined);
      if (!track) return undefined;
      return {
        ...track,
        pathType,
      };
    });
  };

  const updateMotionInitialDwell = (dwellMs: number) => {
    updateCameraTrack((chapter) => {
      const currentView = chapter.viewBox;
      const track =
        chapter.cameraTrack ??
        (currentView
          ? generateCameraPreset("ken-burns", currentView, 5000)
          : undefined);
      if (!track || !track.keyframes.length) return track;
      const keyframes = track.keyframes.map((point, index) => {
        if (index !== 0) return point;
        const { dwellMs: _, ...rest } = point;
        return dwellMs > 0 ? { ...point, dwellMs } : rest;
      });
      return {
        ...track,
        keyframes,
      };
    });
  };

  const updateMotionEasing = (
    easing: NonNullable<ChapterCameraTrack["easing"]>,
  ) => {
    updateCameraTrack((chapter) => {
      if (!chapter.cameraTrack) return undefined;
      return {
        ...chapter.cameraTrack,
        easing,
      };
    });
  };

  const goToMotionPoint = (keyframeId: string) => {
    stopMotionPreview();
    const chapterId = get(selectedChapterId);
    const point = get(storyStore)
      .chapters.find((chapter) => chapter.id === chapterId)
      ?.cameraTrack?.keyframes.find((entry) => entry.id === keyframeId);
    if (!point) return;
    selectedMotionPointId.set(keyframeId);
    if (!viewer) return;
    if (point.viewBox) viewer.setViewBox?.(point.viewBox);
    if (point.model) viewer.setModelPose?.(point.model);
    for (const [id, opacity] of Object.entries(point.layerOpacities ?? {})) {
      viewer.updateLayerOpacity?.(id, opacity);
    }
  };

  const applyMotionPreset = (
    preset: NonNullable<Chapter["cameraTrack"]>["preset"],
  ) => {
    if (!preset) return;
    updateCameraTrack((chapter) => {
      // A preset is shaped from the chapter frame, never from the camera.
      const currentView = chapter.viewBox;
      if (!currentView) return chapter.cameraTrack;
      const duration =
        chapter.cameraTrack?.durationMs ??
        chapter.presentationDurationMs ??
        5000;
      return configureCameraTrackPreset(
        chapter.cameraTrack,
        preset,
        currentView,
        duration,
      );
    });
  };

  const stopMotionPreview = () => {
    if (
      motionPreviewFrame !== null &&
      typeof cancelAnimationFrame === "function"
    ) {
      cancelAnimationFrame(motionPreviewFrame);
    }
    motionPreviewFrame = null;
    motionPreviewing.set(false);
  };

  const previewMotion = () => {
    const chapterId = get(selectedChapterId);
    const chapter = get(storyStore).chapters.find(
      (item) => item.id === chapterId,
    );
    if (!chapter) return;
    startMotionTrackPlayback(chapter);
  };

  const startMotionTrackPlayback = (chapter: Chapter) => {
    if (
      !chapter.cameraTrack ||
      chapter.cameraTrack.keyframes.length < 2 ||
      !viewer
    )
      return;
    stopMotionPreview();
    pendingApplyToken += 1;
    if (cancelAnimation) {
      cancelAnimation();
      cancelAnimation = null;
    }
    const track = chapter.cameraTrack;
    const reduceMotion = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const applySample = (elapsedMs: number) => {
      const sample = sampleCameraTrack(track, elapsedMs);
      if (sample?.viewBox) viewer?.setViewBox?.(sample.viewBox);
      if (sample?.model) viewer?.setModelPose?.(sample.model);
      for (const [id, opacity] of Object.entries(
        sample?.layerOpacities ?? {},
      )) {
        viewer?.updateLayerOpacity?.(id, opacity);
      }
    };
    if (reduceMotion || typeof requestAnimationFrame !== "function") {
      applySample(track.durationMs);
      return;
    }
    applySample(0);
    motionPreviewing.set(true);
    const startedAt = performance.now();
    const frame = (time: number) => {
      const elapsed = Math.min(track.durationMs, time - startedAt);
      applySample(elapsed);
      if (elapsed < track.durationMs)
        motionPreviewFrame = requestAnimationFrame(frame);
      else {
        motionPreviewFrame = null;
        motionPreviewing.set(false);
      }
    };
    motionPreviewFrame = requestAnimationFrame(frame);
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
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      latestNarrationSegments = {
        ...latestNarrationSegments,
        [lang]: { start, end },
      };
    }
  };

  const skipNarration = (lang: string) => {
    pushHistorySnapshot();
    chapterActions.skipNarration(lang);
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
    if (Number.isFinite(delayMs) && (delayMs as number) >= 0) {
      transitionDelayDefault.set(delayMs as number);
    }
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
    const chapterId = get(selectedChapterId);
    if (!chapterId) return;
    const normalizedOpacity = Math.max(0, Math.min(1, opacity));
    const nextLayerOpacities = {
      ...get(layerOpacitiesStore),
      [id]: normalizedOpacity,
    };
    viewer?.updateLayerOpacity?.(id, normalizedOpacity);
    layerOpacitiesStore.set(nextLayerOpacities);
    storyStoreWrapper.setLayerOpacities({
      chapterId,
      layerOpacities: nextLayerOpacities,
    });
  };

  const reloadManifest = (manifest: string, canvasIndex: number) => {
    if (!viewer) {
      setError(translate('storyBuilder.errors.viewerNotReady'));
      return;
    }
    if (!manifest.trim()) {
      setError(translate('storyBuilder.errors.manifestRequired'));
      return;
    }
    viewer.setManifest(manifest);
    viewer.setCanvasByIndex(canvasIndex);
  };

  const selectCanvas = (canvasIndex: number) => {
    if (!viewer) return;
    const count = viewer.getCanvasCount?.() ?? 0;
    if (
      !Number.isInteger(canvasIndex) ||
      canvasIndex < 0 ||
      (count > 0 && canvasIndex >= count)
    ) {
      return;
    }
    viewerCanvasIndex.set(canvasIndex);
    viewer.setCanvasByIndex(canvasIndex);
  };

  const loadManifest = (manifest: string) => {
    if (!viewer) {
      setError(translate('storyBuilder.errors.viewerNotReady'));
      return;
    }
    const trimmed = manifest.trim();
    if (!trimmed) {
      setError(translate('storyBuilder.errors.manifestRequired'));
      return;
    }
    viewer.setManifest(trimmed);
    lastManifest = trimmed;
    currentManifest.set(trimmed);
    setError(null);
  };

  const saveChapterSettings = () => {
    setError(null);
    if (get(activeChapterTask) === "focus") {
      if (annotationTransactionSnapshot && annotationTransactionChanged) {
        history.push(annotationTransactionSnapshot);
      }
      annotationTransactionSnapshot = null;
      annotationTransactionChanged = false;
      selectedDrawingAnnotationId.set(null);
      viewer?.setStoryAnnotationSelection?.(null);
      activeChapterTask.set(null);
      uiMode.set(get(selectedChapterId) ? "chapterEdit" : "idle");
      canUndo.set(history.canUndo());
      canRedo.set(history.canRedo());
      return;
    }
    if (get(activeChapterTask) === "source") {
      captureSourceRetarget();
    }
    activeChapterTask.set(null);
    uiMode.set(get(selectedChapterId) ? "chapterEdit" : "idle");
  };

  const cancelChapterSettings = () => {
    if (get(activeChapterTask) !== "focus" || !annotationTransactionSnapshot) {
      activeChapterTask.set(null);
      uiMode.set(get(selectedChapterId) ? "chapterEdit" : "idle");
      return;
    }
    const snapshot = annotationTransactionSnapshot;
    annotationTransactionSnapshot = null;
    annotationTransactionChanged = false;
    runesStore.loadStory(snapshot);
    storyStore.set(runesStore.story);
    dirty.set(annotationTransactionWasDirty);
    selectedDrawingAnnotationId.set(null);
    viewer?.setStoryAnnotationSelection?.(null);
    activeChapterTask.set(null);
    uiMode.set(get(selectedChapterId) ? "chapterEdit" : "idle");
    syncEditableStoryAnnotations();
    canUndo.set(history.canUndo());
    canRedo.set(history.canRedo());
  };

  const saveExport = () => {
    const storyValue = storyStoreWrapper.exportStory();
    const validation = validateStoryForExport(storyValue);
    if (!validation.ok) {
      setError(null);
      validationErrors.set(validation.errors);
    } else {
      setError(null);
      validationErrors.set([]);
    }
    return validation;
  };

  const exportStory = () => {
    const validation = saveExport();
    if (!validation.ok) return validation;
    saveModalPayload.set(buildExportEnvelope(storyStoreWrapper.exportStory()));
    saveModalOpen.set(true);
    return validation;
  };

  const getStory = (): StoryState =>
    cloneStoryValue(storyStoreWrapper.exportStory());

  const getExportPayload = (): ExportEnvelope =>
    buildExportEnvelope(storyStoreWrapper.exportStory());

  const loadStory = (storyToLoad: StoryState) => {
    // Bring framings to the story's canonical aspect on the way in, so
    // everything captured from here on agrees and the next save writes them
    // back normalised.
    const normalizedStory = normalizeStoryAnnotations(
      normaliseStoryFraming(storyToLoad),
    );
    pushHistorySnapshot();
    loadStoryIntoStore(normalizedStory, storyStoreWrapper);
    latestNarrationSegments = collectLatestNarrationSegments(
      storyStoreWrapper.exportStory(),
    );
    transitionDelayDefault.set(
      collectLatestTransitionDelay(storyStoreWrapper.exportStory()),
    );

    // Load the first chapter's manifest if available
    const firstChapter = normalizedStory.chapters?.[0];
    if (firstChapter?.manifest && viewer) {
      viewer.setManifest?.(firstChapter.manifest);
      if (typeof firstChapter.canvasIndex === "number") {
        viewer.setCanvasByIndex?.(firstChapter.canvasIndex);
      }
    }

    // Auto-select the first chapter so the editor shows content on load
    autoSelectFirstChapterIfNeeded();
    history.reset(storyStoreWrapper.exportStory());
    canUndo.set(false);
    canRedo.set(false);
    dirty.set(false);
  };

  const controller: StoryBuilderController = {
    story: storyStore,
    currentManifest,
    viewerCanvasIndex,
    viewerCanvasCount,
    selectedChapterId,
    activeChapterTask,
    selectedDrawingAnnotationId,
    chapterAnnotationTool,
    uiMode,
    drawerOpen,
    viewBox,
    mediaType,
    mediaMarks: mediaMarksState,
    transitionDelayDefault,
    avMarksValid,
    error,
    validationErrors,
    language,
    languages,
    saveState,
    saveConfigured,
    dirty,
    canUndo,
    canRedo,
    saveModalOpen,
    saveModalPayload,
    closeSaveModal,
    mediaSources: mediaSourcesStore,
    layerOpacities: layerOpacitiesStore,
    updateLayerOpacity,
    attach,
    addChapter,
    updateChapter,
    setChapterPosition,
    deleteChapter,
    duplicateChapter,
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
    assignMediaSegment,
    previewMediaSegment,
    stopPreviewMediaSegment,
    setNarrationTrack,
    updateStoryTitle,
    updateStoryIdentifiers,
    addMotionPoint,
    setMotionPointViewBox,
    selectedMotionPointId,
    deleteMotionPoint,
    updateMotionDuration,
    updateMotionPathType,
    updateMotionInitialDwell,
    updateMotionEasing,
    goToMotionPoint,
    applyMotionPreset,
    motionPreviewing,
    previewMotion,
    stopMotionPreview,
    updateChapterTitle,
    updateChapterDescription,
    assignNarrationSegment,
    skipNarration,
    updateAnnotationText,
    updateAnnotationPlacement,
    updateAdvanceMode,
    updateDelay,
    updateManifest,
    reloadManifest,
    selectCanvas,
    loadManifest,
    saveChapterSettings,
    cancelChapterSettings,
    saveExport,
    exportStory,
    getStory,
    getExportPayload,
    saveStory,
    undo,
    redo,
    setSaveConfig,
    setAnnotationLanguage,
    setChapterAnnotationTool,
    deleteChapterDrawingAnnotation,
    deleteChapterTextAnnotation,
    editChapterDrawingAnnotation,
    editChapterTextAnnotation,
    setChapterDrawingAnnotationLabel,
    setChapterDrawingAnnotationStyle,
    annotationLanguage,
    modelPoseDebug,
    loadStory,
    isPreviewing,
    stageFade,
    startPreview,
    stopPreview,
    previewChapter,
    positioningLanguage: { subscribe: positioningLanguage.subscribe },
    startAnnotationPositioning,
    confirmAnnotationPositioning,
    cancelAnnotationPositioning,
  };
  options.onControllerReady?.(controller);
  return controller;
};
