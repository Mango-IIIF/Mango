import { derived, get, writable, type Readable, type Writable } from 'svelte/store';
import type { MediaSource, MediaType } from '../iiif/mediaResolver';
import type { PluginContext } from '../core/types/plugin';
import { createStoryStore } from '../state/story.svelte';
import { createMediaMarks, type MediaMarksState } from './mediaMarks';
import { createModelPose } from './modelPose';
import { createNarrationPlayer } from './narrationPlayer';
import { captureAudioVideo, captureImagePdf, captureModel } from './capture';
import { resolveManifestForNewChapter } from './manifestResolver';
import { animateViewBoxTransition, animateLayerOpacities } from './viewBoxAnimation';
import { cloneStoryValue, createStoryHistory } from './storyHistory';
import { createChapterActions } from './chapterActions';
import { createStoryPreviewOrchestrator } from './previewOrchestrator';
import {
  configureCameraTrackPreset,
  generateCameraPreset,
  retimeCameraKeyframes,
  sampleCameraTrack,
} from './cameraTrack';
import {
  buildExportEnvelope,
  loadStoryIntoStore,
  performFetchWithTimeout,
  validateStoryForExport,
  type ExportEnvelope,
  type SaveConfig,
  type SaveResult,
  type SaveState,
} from './storySerializer';
import type {
  AnnotationPlacement,
  Chapter,
  ChapterCameraTrack,
  ChapterAnnotationTool,
  ChapterDrawingAnnotation,
  ChapterAdvance,
  ChapterModel,
  NarrationSegment,
  StoryState,
} from '../core/types/story';
import type { ViewBox } from '../core/types/viewer';
import type { ViewerConfig } from '../core/types/config';
import type { ChapterTaskId } from './chapterTasks';
import type { ResolvedAnnotation } from '../iiif/annotationResolver';

export type StoryBuilderController = {
  story: Readable<StoryState>;
  currentManifest: Readable<string | null>;
  viewerCanvasIndex: Readable<number>;
  viewerCanvasCount: Readable<number>;
  selectedChapterId: Writable<string | null>;
  activeChapterTask: Writable<ChapterTaskId | null>;
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
    config: ViewerConfig['story'] extends infer S
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
  addChapter: () => void;
  updateChapter: () => void;
  deleteChapter: (chapterId: string) => void;
  duplicateChapter: (chapterId: string) => void;
  reorderChapter: (
    chapterId: string,
    targetChapterId: string,
    position?: 'before' | 'after',
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
  captureMotionPoint: (keyframeId?: string, focus?: { x: number; y: number }) => void;
  deleteMotionPoint: (keyframeId: string) => void;
  updateMotionDuration: (durationMs: number) => void;
  updateMotionPathType: (pathType: 'linear' | 'spline') => void;
  updateMotionInitialDwell: (dwellMs: number) => void;
  updateMotionEasing: (easing: NonNullable<ChapterCameraTrack['easing']>) => void;
  goToMotionPoint: (keyframeId: string) => void;
  applyMotionPreset: (preset: NonNullable<Chapter['cameraTrack']>['preset']) => void;
  motionPreviewing: Readable<boolean>;
  previewMotion: () => void;
  stopMotionPreview: () => void;
  motionPointDraft: Readable<MotionPointDraft | null>;
  startMotionPointPositioning: (keyframeId?: string) => void;
  confirmMotionPointPositioning: (focus: { x: number; y: number }) => void;
  cancelMotionPointPositioning: () => void;
  updateChapterTitle: (lang: string, value: string) => void;
  updateChapterDescription: (lang: string, value: string) => void;
  assignNarrationSegment: (lang: string, start: number, end: number) => void;
  skipNarration: (lang: string) => void;
  updateAnnotationText: (lang: string, text: string) => void;
  updateAnnotationPlacement: (lang: string, placement: AnnotationPlacement) => void;
  updateAdvanceMode: (mode: ChapterAdvance['mode']) => void;
  updateDelay: (delayMs?: number) => void;
  updateManifest: (manifest: string) => void;
  reloadManifest: (manifest: string, canvasIndex: number) => void;
  selectCanvas: (canvasIndex: number) => void;
  loadManifest: (manifest: string) => void;
  saveChapterSettings: () => void;
  saveExport: () => { ok: boolean; errors: string[] };
  exportStory: () => { ok: boolean; errors: string[] };
  saveStory: () => Promise<SaveResult>;
  undo: () => void;
  redo: () => void;
  isPreviewing: Readable<boolean>;
  startPreview: () => void;
  stopPreview: () => void;
  positioningLanguage: Readable<string | null>;
  startAnnotationPositioning: (lang: string) => void;
  confirmAnnotationPositioning: () => void;
  cancelAnnotationPositioning: () => void;
};

export type UIMode =
  'idle' | 'chapterEdit' | 'narrationPanel' | 'annotationPositioning' | 'motionPointPositioning';

export type MotionPointDraft = {
  keyframeId?: string;
  focus?: { x: number; y: number };
};

export type StoryBuilderOptions = {
  language?: string;
  languages?: string[];
  annotationPageId?: string;
  annotationBase?: string;
  identifiersLocked?: boolean;
  initialStory?: StoryState;
};

export const collectLatestNarrationSegments = (
  story: StoryState,
): Record<string, NarrationSegment> => {
  const latest: Record<string, NarrationSegment> = {};
  for (const chapter of story.chapters) {
    for (const [language, segment] of Object.entries(chapter.narrationSegment ?? {})) {
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

export const DEFAULT_CHAPTER_TRANSITION_DELAY_MS = 2000;

export const collectLatestTransitionDelay = (story: StoryState): number => {
  let latest = DEFAULT_CHAPTER_TRANSITION_DELAY_MS;
  for (const chapter of story.chapters) {
    const delay = chapter.advance?.delayMs;
    if (chapter.advance?.mode === 'auto' && Number.isFinite(delay) && (delay as number) >= 0) {
      latest = delay as number;
    }
  }
  return latest;
};

export const createStoryBuilderController = (
  options: StoryBuilderOptions = {},
): StoryBuilderController => {
  const initialStoryData: StoryState = options.initialStory
    ? {
        ...options.initialStory,
        id: options.annotationPageId ?? options.initialStory.id,
        publication: {
          ...options.initialStory.publication,
          ...(options.annotationBase ? { annotationBase: options.annotationBase } : {}),
          ...(options.identifiersLocked ? { identifiersLocked: true } : {}),
        },
      }
    : {
        id: options.annotationPageId,
        publication:
          options.annotationBase || options.identifiersLocked
            ? {
                ...(options.annotationBase ? { annotationBase: options.annotationBase } : {}),
                ...(options.identifiersLocked ? { identifiersLocked: true } : {}),
              }
            : undefined,
        chapters: [],
      };

  const runesStore = createStoryStore(initialStoryData);

  // Create a writable store that wraps the runes store for backward compatibility
  const storyStore = writable(runesStore.story);
  const dirty = writable(false);

  const wrapMutation =
    <Payload>(mutation: (payload: Payload) => void): ((payload: Payload) => void) =>
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
    setChapterDescription: wrapMutation(runesStore.setChapterDescription),
    setLayerOpacities: wrapMutation(runesStore.setLayerOpacities),
    exportStory: () => runesStore.exportStory(),
    loadStory: (next: StoryState) => {
      runesStore.loadStory(next);
      storyStore.set(runesStore.story);
      dirty.set(false);
    },
  };

  const selectedChapterId = writable<string | null>(null);
  const activeChapterTask = writable<ChapterTaskId | null>(null);
  const chapterAnnotationTool = writable<ChapterAnnotationTool>('select');
  const uiMode = writable<UIMode>('idle');
  const positioningLanguage = writable<string | null>(null);
  const motionPointDraft = writable<MotionPointDraft | null>(null);
  const motionPreviewing = writable(false);
  const drawerOpen = derived(
    uiMode,
    (mode) =>
      mode !== 'idle' && mode !== 'annotationPositioning' && mode !== 'motionPointPositioning',
  );
  const viewBox = writable<ViewBox | null>(null);
  const mediaType = writable<MediaType | null>(null);
  const avMarksValid = writable(true);
  const transitionDelayDefault = writable(collectLatestTransitionDelay(initialStoryData));
  const error = writable<string | null>(null);
  const validationErrors = writable<string[]>([]);
  const currentManifest = writable<string | null>(null);
  const viewerCanvasIndex = writable(0);
  const viewerCanvasCount = writable(0);
  const modelPoseDebug = writable<string | null>(null);
  const annotationLanguage = writable(options.language ?? 'en');
  const saveState = writable<SaveState>({ status: 'idle' });
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

  const language = options.language ?? 'en';
  const languages = options.languages ?? ['en'];
  const history = createStoryHistory(initialStoryData);
  let latestNarrationSegments = collectLatestNarrationSegments(initialStoryData);

  let viewer: PluginContext['viewer'] | null = null;
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

  const syncEditableStoryAnnotations = () => {
    const chapterId = get(selectedChapterId);
    const chapter = get(storyStore).chapters.find((entry) => entry.id === chapterId);
    const annotations: ResolvedAnnotation[] = (chapter?.drawingAnnotations ?? []).map(
      (drawing) => ({
        id: drawing.id,
        shapeType: drawing.type === 'rectangle' ? 'rect' : drawing.type,
        ...(drawing.text ? { text: drawing.text } : {}),
        ...(drawing.rect ? { rect: drawing.rect } : {}),
        ...(drawing.point ? { point: drawing.point } : {}),
        ...(drawing.points ? { polygon: { points: drawing.points } } : {}),
      }),
    );
    viewer?.setStoryAnnotations?.(annotations);
  };

  activeChapterTask.subscribe((task) => {
    if (task === 'focus') {
      viewer?.setStoryAnnotationEditing?.(true);
      syncEditableStoryAnnotations();
      return;
    }
    chapterAnnotationTool.set('select');
    viewer?.setAnnotationTool?.('select');
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
      uiMode.set('idle');
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
        status: 'error',
        message: validation.errors.join(' · '),
      });
      return { ok: false, message: validation.errors.join(' · ') };
    }
    const payload = buildExportEnvelope(storyStoreWrapper.exportStory());
    const hasEndpoint = saveConfig?.endpoint && (saveConfig.enabled ?? true) ? true : false;
    if (hasEndpoint && !get(storyStore).id) {
      const message = 'Set a canonical Story ID in Story settings before publishing.';
      saveState.set({ status: 'error', message, code: 'missing_public_id' });
      return { ok: false, message, code: 'missing_public_id' };
    }
    if (!hasEndpoint) {
      saveModalPayload.set(payload);
      saveModalOpen.set(true);
      saveState.set({ status: 'idle' });
      return { ok: true };
    }
    saveState.set({ status: 'saving' });
    const result = await performFetchWithTimeout(saveConfig as SaveConfig, payload);
    if (result.ok) {
      saveState.set({ status: 'success', message: result.message });
      dirty.set(false);
    } else {
      saveState.set({
        status: 'error',
        message: result.message,
        code: result.code,
      });
    }
    return result;
  };

  const setSaveConfig = (config: SaveConfig) => {
    saveConfig = config;
    saveConfigured.set(Boolean(config?.endpoint && (config.enabled ?? true)));
  };

  const closeSaveModal = () => {
    saveModalOpen.set(false);
  };

  const setAnnotationLanguage = (lang: string) => {
    annotationLanguage.set(lang);
  };

  const setChapterAnnotationTool = (tool: ChapterAnnotationTool) => {
    if (tool !== 'select' && (!get(selectedChapterId) || get(activeChapterTask) !== 'focus'))
      return;
    chapterAnnotationTool.set(tool);
    viewer?.setStoryAnnotationEditing?.(get(activeChapterTask) === 'focus');
    viewer?.setAnnotationTool?.(tool);
  };

  const mutateChapterDrawingAnnotations = (
    transform: (items: ChapterDrawingAnnotation[]) => ChapterDrawingAnnotation[],
  ) => {
    const chapterId = get(selectedChapterId);
    if (!chapterId) return;
    const current = storyStoreWrapper.exportStory();
    const chapterIndex = current.chapters.findIndex((entry) => entry.id === chapterId);
    if (chapterIndex < 0) return;
    pushHistorySnapshot();
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
    if (tool === 'select') return;
    const drawing: ChapterDrawingAnnotation = {
      id: annotation.id,
      type: tool,
      ...(annotation.text ? { text: annotation.text } : {}),
      ...(annotation.rect ? { rect: annotation.rect } : {}),
      ...(annotation.point ? { point: annotation.point } : {}),
      ...(annotation.polygon?.points ? { points: annotation.polygon.points } : {}),
    };
    if (!drawing.rect && !drawing.point && !drawing.points?.length) return;
    mutateChapterDrawingAnnotations((items) => [
      ...items.filter((entry) => entry.id !== drawing.id),
      drawing,
    ]);
    chapterAnnotationTool.set('select');
  };

  const deleteChapterDrawingAnnotation = (annotationId: string) => {
    mutateChapterDrawingAnnotations((items) => items.filter((entry) => entry.id !== annotationId));
  };

  const deleteChapterTextAnnotation = (lang: string) => {
    const chapterId = get(selectedChapterId);
    if (!chapterId) return;
    const current = storyStoreWrapper.exportStory();
    const chapterIndex = current.chapters.findIndex((entry) => entry.id === chapterId);
    if (chapterIndex < 0 || !current.chapters[chapterIndex].annotations?.[lang]) return;
    pushHistorySnapshot();
    const next = cloneStoryValue(current);
    const annotations = { ...(next.chapters[chapterIndex].annotations ?? {}) };
    delete annotations[lang];
    if (Object.keys(annotations).length > 0) next.chapters[chapterIndex].annotations = annotations;
    else delete next.chapters[chapterIndex].annotations;
    runesStore.loadStory(next);
    storyStore.set(runesStore.story);
    dirty.set(true);
    if (get(positioningLanguage) === lang) {
      positioningLanguage.set(null);
      uiMode.set('chapterEdit');
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

  const drawingBounds = (drawing: ChapterDrawingAnnotation): ViewBox | null => {
    if (drawing.rect) return drawing.rect;
    if (drawing.point) return { x: drawing.point.x, y: drawing.point.y, w: 0, h: 0 };
    if (!drawing.points?.length) return null;
    const xs = drawing.points.map((point) => point.x);
    const ys = drawing.points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };

  const editChapterDrawingAnnotation = (annotationId: string) => {
    const chapterId = get(selectedChapterId);
    const drawing = get(storyStore)
      .chapters.find((entry) => entry.id === chapterId)
      ?.drawingAnnotations?.find((entry) => entry.id === annotationId);
    if (!drawing || get(activeChapterTask) !== 'focus') return;
    setChapterAnnotationTool('select');
    syncEditableStoryAnnotations();
    viewer?.setStoryAnnotationSelection?.(annotationId);
    const bounds = drawingBounds(drawing);
    if (bounds) focusViewerOnBounds(bounds);
  };

  const editChapterTextAnnotation = (lang: string) => {
    const chapterId = get(selectedChapterId);
    const chapter = get(storyStore).chapters.find((entry) => entry.id === chapterId);
    const annotation = chapter?.annotations?.[lang];
    if (!chapter || !annotation?.text?.trim() || get(activeChapterTask) !== 'focus') return;
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
    uiMode.set('annotationPositioning');
    positioningLanguage.set(lang);
  };

  const updateChapterDrawingAnnotation = (
    annotationId: string,
    patch: Partial<ResolvedAnnotation>,
  ) => {
    mutateChapterDrawingAnnotations((items) =>
      items.map((drawing) => {
        if (drawing.id !== annotationId) return drawing;
        if (patch.rect) {
          return {
            id: drawing.id,
            type: 'rectangle',
            rect: patch.rect,
            text: drawing.text,
          };
        }
        if (patch.point) {
          return {
            id: drawing.id,
            type: 'point',
            point: patch.point,
            text: drawing.text,
          };
        }
        if (patch.polygon?.points) {
          return {
            id: drawing.id,
            type: drawing.type === 'line' || drawing.type === 'freehand' ? drawing.type : 'polygon',
            points: patch.polygon.points,
            text: drawing.text,
          };
        }
        return drawing;
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
    const selectedStillExists = next.chapters.some((chapter) => chapter.id === selectedId);
    const nextSelection = selectedStillExists ? selectedId : (next.chapters[0]?.id ?? null);
    selectedChapterId.set(nextSelection);
    if (nextSelection) {
      const chapter = next.chapters.find((entry) => entry.id === nextSelection);
      if (chapter) applyChapter(chapter);
    }
    canUndo.set(history.canUndo());
    canRedo.set(history.canRedo());
  };

  const undo = () => restoreHistoryStory(history.undo(storyStoreWrapper.exportStory()));
  const redo = () => restoreHistoryStory(history.redo(storyStoreWrapper.exportStory()));

  const chapterActions = createChapterActions({
    getSelectedChapterId: () => get(selectedChapterId),
    storyStoreWrapper,
  });

  const syncMediaMarks = () => {
    mediaMarksState.set(mediaMarks.getState());
    avMarksValid.set(mediaMarks.hasValidMarks());
  };

  const isValidSegment = (start?: number, end?: number) =>
    Number.isFinite(start) && Number.isFinite(end) && (end as number) > (start as number);

  const getNarrationSegment = (chapter: Chapter) => {
    const lang = get(annotationLanguage);
    const segment = chapter.narrationSegment?.[lang];
    const src = get(storyStore).narration?.tracks?.[lang]?.src ?? '';
    if (!src || !segment || !isValidSegment(segment.start, segment.end)) return null;
    return { src, start: segment.start, end: segment.end };
  };

  const stopChapterPlayback = () => {
    activePlaybackToken += 1;
    activePlaybackChapterId = null;
    activeMediaEnd = null;
    narrationPlayer.stop();
    viewer?.pause?.();
    stopMotionPreview();
  };

  const startMediaSegment = (chapter: Chapter) => {
    if (!viewer || !chapter.media) return;
    const currentType = viewer.getMediaType?.() ?? null;
    if (currentType && currentType !== 'audio' && currentType !== 'video') return;
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
    if (next !== 'audio' && next !== 'video') {
      mediaMarks.clear();
    } else {
      // When media type is audio/video, restore marks from the selected chapter if available
      const id = get(selectedChapterId);
      const storyValue = get(storyStore);
      const chapter = id ? storyValue.chapters.find((item) => item.id === id) : null;
      if (chapter?.media) {
        mediaMarks.setSegment(chapter.media.start, chapter.media.end);
      }
    }
    if (next !== 'model') {
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
    const manifest = viewer.getManifestId?.() ?? viewer.getState?.()?.manifestId ?? null;
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
        viewer.setModelPose(chapter.model, { transition: 'interpolate' });
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
    const cameraOrbit = pose?.cameraOrbit ?? viewer.getModelOrbit?.() ?? undefined;
    const cameraTarget = pose?.cameraTarget ?? viewer.getModelTarget?.() ?? undefined;
    const fieldOfView = pose?.fieldOfView ?? undefined;
    const orientation = pose?.orientation ?? viewer.getModelOrientation?.() ?? undefined;
    if (!cameraOrbit && !cameraTarget && !orientation && !fieldOfView) return null;
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

    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
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
    const viewerManifest = viewer.getManifestId?.() ?? viewer.getState?.()?.manifestId ?? null;
    if (chapter.manifest && chapter.manifest !== viewerManifest) {
      pendingChapterApply = chapter;
      viewer.setManifest(chapter.manifest);
      currentManifest.set(chapter.manifest);
      return;
    }
    const currentIndex = viewer.getCanvasIndex?.() ?? -1;
    if (typeof chapter.canvasIndex === 'number' && chapter.canvasIndex !== currentIndex) {
      pendingChapterApply = chapter;
      viewer.setCanvasByIndex(chapter.canvasIndex);
      return;
    }
    pendingChapterApply = null;

    if (chapter.layerOpacities) {
      const fromOpacities = viewer.getLayerOpacities?.() ?? {};
      cancelLayersAnimation = animateLayerOpacities(viewer, fromOpacities, chapter.layerOpacities);
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
      if (result.reason === 'missing-manifest') {
        setError(null);
        selectedChapterId.set(null);
        uiMode.set('chapterEdit');
      } else {
        setError(`Capture blocked: ${result.reason}`);
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
      storyStoreWrapper.setAdvanceMode({ chapterId: lastId, mode: 'auto' });
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
        uiMode.set('chapterEdit');
      }
    }, 0);
    return true;
  };

  const handleUpdateResult = (result: ReturnType<typeof capture>, chapterId: string) => {
    if (!result.ok) {
      if (result.reason === 'missing-manifest') {
        setError(null);
        uiMode.set('chapterEdit');
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
    const updatedChapter = get(storyStore).chapters.find((chapter) => chapter.id === chapterId);
    const track = updatedChapter?.cameraTrack;
    const stableViewBox = result.capture.viewBox;
    if (track?.preset && track.preset !== 'custom' && stableViewBox) {
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
      return { ok: false as const, reason: 'missing-manifest' as const };
    }
    const storyValue = get(storyStore);
    const previousChapterManifest =
      storyValue.chapters[storyValue.chapters.length - 1]?.manifest ?? null;
    const viewerManifest = viewer.getManifestId?.() ?? null;
    const stateManifest = viewer.getState?.()?.manifestId ?? null;
    const effectiveManifest =
      viewerManifest || stateManifest || lastManifest || get(currentManifest) || null;
    return resolveManifestForNewChapter(effectiveManifest, previousChapterManifest);
  };

  const capture = () => {
    if (!viewer) return { ok: false as const, reason: 'missing-manifest' as const };
    const manifestResolution = resolveManifest();
    if (!manifestResolution.ok) {
      return { ok: false as const, reason: 'missing-manifest' as const };
    }
    const manifestOverride = viewer.getManifestId() ? undefined : manifestResolution.manifest;

    const type = viewer.getMediaType();
    if (type === 'audio' || type === 'video') {
      const markedSegment = mediaMarks.getSegment();
      const availableSources = viewer.getMediaSources?.() ?? get(mediaSourcesStore);
      mediaSourcesStore.set(availableSources);
      const sourceDuration = availableSources.find(
        (source) => source.type === type && Number.isFinite(source.duration),
      )?.duration;
      const segment =
        markedSegment ??
        (sourceDuration != null && sourceDuration > 0 ? { start: 0, end: sourceDuration } : null);
      return captureAudioVideo(viewer, segment, manifestOverride);
    }
    if (type === 'model') {
      return captureModel(viewer, modelPose.getPose(), manifestOverride);
    }
    return captureImagePdf(viewer, manifestOverride);
  };

  const attach = (ctx: PluginContext) => {
    if (!ctx?.viewer) {
      return () => undefined;
    }
    viewer = ctx.viewer;
    viewer.setStoryAnnotationEditing?.(get(activeChapterTask) === 'focus');
    syncEditableStoryAnnotations();
    lastManifest = ctx.viewer.getManifestId?.() ?? ctx.viewer.getState?.()?.manifestId ?? null;
    currentManifest.set(lastManifest);
    viewerCanvasIndex.set(ctx.viewer.getCanvasIndex?.() ?? 0);
    viewerCanvasCount.set(ctx.viewer.getCanvasCount?.() ?? 0);
    viewBox.set(ctx.viewer.getViewBox?.() ?? ctx.viewer.getState?.()?.viewBox ?? null);
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
      const offState = ctx.events.on('stateChange', ({ snapshot }) => {
        updateMediaType(snapshot.mediaType);
        lastManifest = snapshot.manifestId || null;
        currentManifest.set(lastManifest);
        viewerCanvasIndex.set(snapshot.canvasIndex ?? ctx.viewer.getCanvasIndex?.() ?? 0);
        viewerCanvasCount.set(ctx.viewer.getCanvasCount?.() ?? 0);
        viewBox.set(snapshot.viewBox ?? ctx.viewer.getViewBox?.() ?? get(viewBox));
        mediaSourcesStore.set(ctx.viewer.getMediaSources?.() ?? []);
        layerOpacitiesStore.set(ctx.viewer.getLayerOpacities?.() ?? {});
        if (snapshot.mediaType === 'model') {
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
      const offManifest = ctx.events.on('manifestChange', ({ manifestId }) => {
        lastManifest = manifestId || null;
        currentManifest.set(lastManifest);
        viewerCanvasCount.set(ctx.viewer.getCanvasCount?.() ?? 0);
        updateMediaType(null);
        scheduleMediaTypeSync();
        if (pendingChapterApply && pendingChapterApply.manifest === manifestId) {
          viewer?.setCanvasByIndex(pendingChapterApply.canvasIndex);
        }
        setError(null);
      });
      const offPage = ctx.events.on('pageChange', ({ index }) => {
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
      const offViewBox = ctx.events.on('viewBoxChange', ({ viewBox: nextViewBox }) => {
        viewBox.set(nextViewBox ?? null);
      });
      const offZoom = ctx.events.on('zoomChange', ({ viewBox: nextViewBox }) => {
        viewBox.set(nextViewBox ?? null);
      });
      const offTime = ctx.events.on('mediaTimeUpdate', ({ time }) => {
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
        'modelChange',
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
      const offMedia = ctx.events.on('mediaChange', ({ mediaType }) => {
        mediaSourcesStore.set(ctx.viewer.getMediaSources?.() ?? []);
        updateMediaType(mediaType);
      });

      const offMediaPlay = ctx.events.on('mediaPlay', ({ time }) => {
        // When user manually starts audio/video playback, seek to Mark In if set
        const id = get(selectedChapterId);
        const storyValue = get(storyStore);
        const chapter = id ? storyValue.chapters.find((item) => item.id === id) : null;

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
      const offAnnotationCreate = ctx.events.on('annotationCreate', ({ annotation, tool }) => {
        if (get(activeChapterTask) !== 'focus' || !annotation || typeof annotation !== 'object') {
          return;
        }
        addChapterDrawingAnnotation(annotation as ResolvedAnnotation, tool);
      });
      const offAnnotationUpdate = ctx.events.on('annotationUpdate', ({ annotationId, patch }) => {
        if (get(activeChapterTask) === 'focus') {
          updateChapterDrawingAnnotation(annotationId, patch);
        }
      });
      const offAnnotationDelete = ctx.events.on('annotationDelete', ({ annotationId }) => {
        if (get(activeChapterTask) === 'focus') deleteChapterDrawingAnnotation(annotationId);
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
        offAnnotationCreate();
        offAnnotationUpdate();
        offAnnotationDelete();
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
    activeChapterTask.set(null);
    pushHistorySnapshot();
    let result = capture();
    if (result.ok) {
      handleCaptureResult(result);
      return;
    }
    if (result.reason !== 'missing-manifest') {
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
    if (result.reason !== 'missing-manifest') {
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
    activeChapterTask.set(null);
    pushHistorySnapshot();
    const chapters = get(storyStore).chapters;
    const deletedIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
    const fallbackId = chapters[deletedIndex + 1]?.id ?? chapters[deletedIndex - 1]?.id ?? null;
    chapterActions.deleteChapter(chapterId, () => {
      selectedChapterId.set(fallbackId);
      if (fallbackId) selectChapter(fallbackId);
    });
  };

  const duplicateChapter = (chapterId: string) => {
    const current = storyStoreWrapper.exportStory();
    const sourceIndex = current.chapters.findIndex((chapter) => chapter.id === chapterId);
    const source = current.chapters[sourceIndex];
    if (!source) return;
    activeChapterTask.set(null);
    pushHistorySnapshot();
    const duplicateId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `chapter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const duplicate: Chapter = {
      ...cloneStoryValue(source),
      id: duplicateId,
      title: source.title
        ? Object.fromEntries(
            Object.entries(source.title).map(([lang, value]) => [lang, `${value} copy`]),
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
    uiMode.set('chapterEdit');
  };

  const reorderChapter = (
    chapterId: string,
    targetChapterId: string,
    position: 'before' | 'after' = 'before',
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
    stopMotionPreview();
    motionPointDraft.set(null);
    activeChapterTask.set(null);
    setChapterAnnotationTool('select');
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
    uiMode.set('narrationPanel');
  };
  const backFromNarration = () => uiMode.set(get(selectedChapterId) ? 'chapterEdit' : 'idle');
  const closeNarration = () => uiMode.set('idle');
  const openChapter = () => {
    setTimeout(() => {
      if (get(selectedChapterId)) {
        uiMode.set('chapterEdit');
      }
    }, 0);
  };
  const closeChapter = () => {
    stopMotionPreview();
    motionPointDraft.set(null);
    activeChapterTask.set(null);
    uiMode.set('idle');
  };

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

  const assignMediaSegment = (start: number, end: number) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return;
    setMediaMarks(start, end);
    viewer?.setMediaSegment?.(start, end);
    const chapterId = get(selectedChapterId);
    if (!chapterId) return;
    const current = storyStoreWrapper.exportStory();
    const chapterIndex = current.chapters.findIndex((entry) => entry.id === chapterId);
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
    if (currentType !== 'audio' && currentType !== 'video') return;

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
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `camera-point-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const updateCameraTrack = (
    transform: (chapter: Chapter) => Chapter['cameraTrack'] | undefined,
  ) => {
    const chapterId = get(selectedChapterId);
    const chapter = get(storyStore).chapters.find((item) => item.id === chapterId);
    if (!chapterId || !chapter) return;
    pushHistorySnapshot();
    storyStoreWrapper.setChapterCameraTrack({
      chapterId,
      cameraTrack: transform(chapter),
    });
  };

  const captureMotionPoint = (keyframeId?: string, focus?: { x: number; y: number }) => {
    updateCameraTrack((chapter) => {
      const durationMs = Math.max(
        1,
        chapter.cameraTrack?.durationMs ?? chapter.presentationDurationMs ?? 5000,
      );
      const existing = chapter.cameraTrack?.keyframes ?? [];
      const existingPoint = keyframeId
        ? existing.find((entry) => entry.id === keyframeId)
        : undefined;
      const currentViewBox = viewer?.getViewBox?.() ?? chapter.viewBox;
      const stableViewBox = chapter.viewBox ?? currentViewBox;
      const activePreset = chapter.cameraTrack?.preset ?? 'custom';
      const referenceViewBox =
        activePreset === 'custom'
          ? (currentViewBox ?? existingPoint?.viewBox ?? stableViewBox)
          : (existingPoint?.viewBox ?? stableViewBox);
      const viewBox =
        referenceViewBox && focus
          ? {
              x: focus.x - referenceViewBox.w / 2,
              y: focus.y - referenceViewBox.h / 2,
              w: referenceViewBox.w,
              h: referenceViewBox.h,
            }
          : referenceViewBox;
      const model = existingPoint?.model ?? viewer?.getModelPose?.() ?? chapter.model;
      const capturedLayers =
        existingPoint?.layerOpacities ?? viewer?.getLayerOpacities?.() ?? chapter.layerOpacities;
      const point = {
        ...existingPoint,
        id: keyframeId ?? motionPointId(),
        timeMs: existingPoint?.timeMs ?? 0,
        ...(focus ? { focus } : {}),
        ...(viewBox ? { viewBox } : {}),
        ...(model ? { model } : {}),
        ...(capturedLayers ? { layerOpacities: capturedLayers } : {}),
      };
      const nextPoints = keyframeId
        ? existing.map((entry) => (entry.id === keyframeId ? point : entry))
        : [...existing, point];
      const nextTrack: NonNullable<Chapter['cameraTrack']> = {
        ...chapter.cameraTrack,
        durationMs,
        preset: activePreset,
        easing: chapter.cameraTrack?.easing ?? 'ease-in-out',
        keyframes: retimeCameraKeyframes(nextPoints, durationMs),
      };
      return activePreset !== 'custom' && stableViewBox
        ? configureCameraTrackPreset(nextTrack, activePreset, stableViewBox, durationMs, {
            preservePoints: true,
          })
        : nextTrack;
    });
  };

  const deleteMotionPoint = (keyframeId: string) => {
    updateCameraTrack((chapter) => {
      if (!chapter.cameraTrack) return undefined;
      const keyframes = chapter.cameraTrack.keyframes.filter((point) => point.id !== keyframeId);
      return {
        ...chapter.cameraTrack,
        preset: 'custom',
        keyframes: retimeCameraKeyframes(keyframes, chapter.cameraTrack.durationMs),
      };
    });
  };

  const updateMotionDuration = (durationMs: number) => {
    updateCameraTrack((chapter) => {
      const safeDuration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 5000);
      return {
        ...chapter.cameraTrack,
        durationMs: safeDuration,
        preset: chapter.cameraTrack?.preset ?? 'ken-burns',
        easing: chapter.cameraTrack?.easing ?? 'ease-in-out',
        keyframes: retimeCameraKeyframes(chapter.cameraTrack?.keyframes ?? [], safeDuration),
      };
    });
  };

  const updateMotionPathType = (pathType: 'linear' | 'spline') => {
    updateCameraTrack((chapter) => {
      const currentView = chapter.viewBox ?? viewer?.getViewBox?.();
      const track =
        chapter.cameraTrack ??
        (currentView ? generateCameraPreset('ken-burns', currentView, 5000) : undefined);
      if (!track) return undefined;
      return {
        ...track,
        pathType,
      };
    });
  };

  const updateMotionInitialDwell = (dwellMs: number) => {
    updateCameraTrack((chapter) => {
      const currentView = chapter.viewBox ?? viewer?.getViewBox?.();
      const track =
        chapter.cameraTrack ??
        (currentView ? generateCameraPreset('ken-burns', currentView, 5000) : undefined);
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

  const updateMotionEasing = (easing: NonNullable<ChapterCameraTrack['easing']>) => {
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
    if (!point || !viewer) return;
    if (point.viewBox) viewer.setViewBox?.(point.viewBox);
    if (point.model) viewer.setModelPose?.(point.model);
    for (const [id, opacity] of Object.entries(point.layerOpacities ?? {})) {
      viewer.updateLayerOpacity?.(id, opacity);
    }
  };

  const applyMotionPreset = (preset: NonNullable<Chapter['cameraTrack']>['preset']) => {
    if (!preset) return;
    updateCameraTrack((chapter) => {
      const currentView = chapter.viewBox ?? viewer?.getViewBox?.();
      if (!currentView) return chapter.cameraTrack;
      const duration = chapter.cameraTrack?.durationMs ?? chapter.presentationDurationMs ?? 5000;
      return configureCameraTrackPreset(chapter.cameraTrack, preset, currentView, duration);
    });
  };

  const stopMotionPreview = () => {
    if (motionPreviewFrame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(motionPreviewFrame);
    }
    motionPreviewFrame = null;
    motionPreviewing.set(false);
  };

  const previewMotion = () => {
    const chapterId = get(selectedChapterId);
    const chapter = get(storyStore).chapters.find((item) => item.id === chapterId);
    if (!chapter) return;
    startMotionTrackPlayback(chapter);
  };

  const startMotionTrackPlayback = (chapter: Chapter) => {
    if (!chapter.cameraTrack || chapter.cameraTrack.keyframes.length < 2 || !viewer) return;
    stopMotionPreview();
    pendingApplyToken += 1;
    if (cancelAnimation) {
      cancelAnimation();
      cancelAnimation = null;
    }
    const track = chapter.cameraTrack;
    const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const applySample = (elapsedMs: number) => {
      const sample = sampleCameraTrack(track, elapsedMs);
      if (sample?.viewBox) viewer?.setViewBox?.(sample.viewBox);
      if (sample?.model) viewer?.setModelPose?.(sample.model);
      for (const [id, opacity] of Object.entries(sample?.layerOpacities ?? {})) {
        viewer?.updateLayerOpacity?.(id, opacity);
      }
    };
    if (reduceMotion || typeof requestAnimationFrame !== 'function') {
      applySample(track.durationMs);
      return;
    }
    applySample(0);
    motionPreviewing.set(true);
    const startedAt = performance.now();
    const frame = (time: number) => {
      const elapsed = Math.min(track.durationMs, time - startedAt);
      applySample(elapsed);
      if (elapsed < track.durationMs) motionPreviewFrame = requestAnimationFrame(frame);
      else {
        motionPreviewFrame = null;
        motionPreviewing.set(false);
      }
    };
    motionPreviewFrame = requestAnimationFrame(frame);
  };

  const startMotionPointPositioning = (keyframeId?: string) => {
    stopMotionPreview();
    const chapterId = get(selectedChapterId);
    const point = get(storyStore)
      .chapters.find((chapter) => chapter.id === chapterId)
      ?.cameraTrack?.keyframes.find((entry) => entry.id === keyframeId);
    const focus =
      point?.focus ??
      (point?.viewBox
        ? {
            x: point.viewBox.x + point.viewBox.w / 2,
            y: point.viewBox.y + point.viewBox.h / 2,
          }
        : undefined) ??
      (() => {
        const view = viewer?.getViewBox?.();
        return view ? { x: view.x + view.w / 2, y: view.y + view.h / 2 } : undefined;
      })();
    motionPointDraft.set({
      ...(keyframeId ? { keyframeId } : {}),
      ...(focus ? { focus } : {}),
    });
    uiMode.set('motionPointPositioning');
  };

  const confirmMotionPointPositioning = (focus: { x: number; y: number }) => {
    const draft = get(motionPointDraft);
    if (draft) captureMotionPoint(draft.keyframeId, focus);
    motionPointDraft.set(null);
    uiMode.set('chapterEdit');
  };

  const cancelMotionPointPositioning = () => {
    motionPointDraft.set(null);
    uiMode.set('chapterEdit');
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

  const updateAnnotationPlacement = (lang: string, placement: AnnotationPlacement) => {
    pushHistorySnapshot();
    chapterActions.updateAnnotationPlacement(lang, placement);
  };

  const updateAdvanceMode = (mode: ChapterAdvance['mode']) => {
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
    uiMode.set('annotationPositioning');
    positioningLanguage.set(lang);
  };

  const confirmAnnotationPositioning = () => {
    uiMode.set('chapterEdit');
    positioningLanguage.set(null);
  };

  const cancelAnnotationPositioning = () => {
    uiMode.set('chapterEdit');
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
      setError('Viewer not ready.');
      return;
    }
    if (!manifest.trim()) {
      setError('Manifest URL is required.');
      return;
    }
    viewer.setManifest(manifest);
    viewer.setCanvasByIndex(canvasIndex);
  };

  const selectCanvas = (canvasIndex: number) => {
    if (!viewer) return;
    const count = viewer.getCanvasCount?.() ?? 0;
    if (!Number.isInteger(canvasIndex) || canvasIndex < 0 || (count > 0 && canvasIndex >= count)) {
      return;
    }
    viewerCanvasIndex.set(canvasIndex);
    viewer.setCanvasByIndex(canvasIndex);
  };

  const loadManifest = (manifest: string) => {
    if (!viewer) {
      setError('Viewer not ready.');
      return;
    }
    const trimmed = manifest.trim();
    if (!trimmed) {
      setError('Manifest URL is required.');
      return;
    }
    viewer.setManifest(trimmed);
    lastManifest = trimmed;
    currentManifest.set(trimmed);
    setError(null);
  };

  const saveChapterSettings = () => {
    setError(null);
    activeChapterTask.set(null);
    uiMode.set(get(selectedChapterId) ? 'chapterEdit' : 'idle');
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

  const loadStory = (storyToLoad: StoryState) => {
    pushHistorySnapshot();
    loadStoryIntoStore(storyToLoad, storyStoreWrapper);
    latestNarrationSegments = collectLatestNarrationSegments(storyStoreWrapper.exportStory());
    transitionDelayDefault.set(collectLatestTransitionDelay(storyStoreWrapper.exportStory()));

    // Load the first chapter's manifest if available
    const firstChapter = storyToLoad.chapters?.[0];
    if (firstChapter?.manifest && viewer) {
      viewer.setManifest?.(firstChapter.manifest);
      if (typeof firstChapter.canvasIndex === 'number') {
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

  return {
    story: storyStore,
    currentManifest,
    viewerCanvasIndex,
    viewerCanvasCount,
    selectedChapterId,
    activeChapterTask,
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
    captureMotionPoint,
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
    motionPointDraft,
    startMotionPointPositioning,
    confirmMotionPointPositioning,
    cancelMotionPointPositioning,
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
    saveExport,
    exportStory,
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
