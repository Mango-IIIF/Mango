import { get } from 'svelte/store';
import { mount, unmount } from 'svelte';
import type { PluginContext, ViewerPlugin } from '../core/types/plugin';
import {
  createStoryBuilderController,
  type StoryBuilderOptions,
} from '../story/storyBuilderController';
import StoryBuilderSidebar from '../story/ui/StoryBuilderSidebar.svelte';
import StoryBuilderOverlay from '../story/ui/StoryBuilderOverlay.svelte';
import StoryBuilderTopBar from '../story/ui/StoryBuilderTopBar.svelte';
import StoryBuilderWideAuthoring from '../story/ui/StoryBuilderWideAuthoring.svelte';

export const createStoryBuilderPlugins = (options: StoryBuilderOptions = {}): ViewerPlugin[] => {
  const controller = createStoryBuilderController(options);

  const makePlugin = (
    id: string,
    label: string,
    slot: ViewerPlugin['slot'],
    createMount: (target: HTMLElement, ctx: PluginContext) => { destroy: () => void },
  ): ViewerPlugin => {
    let detach: (() => void) | null = null;
    let handle: { destroy: () => void } | null = null;

    return {
      id,
      label,
      slot,
      init(ctx) {
        detach = controller.attach(ctx);
        handle = createMount(ctx.mount, ctx);
      },
      destroy() {
        handle?.destroy();
        handle = null;
        detach?.();
        detach = null;
      },
    };
  };

  const sidebar = makePlugin('story-builder-sidebar', 'Story Builder', 'left', (target, ctx) => {
    controller.setSaveConfig(ctx.config?.story?.save ?? {});
    const instance = mount(StoryBuilderSidebar, {
      target,
      props: {
        story: controller.story,
        selectedChapterId: controller.selectedChapterId,
        error: controller.error,
        validationErrors: controller.validationErrors,
        modelPoseDebug: controller.modelPoseDebug,
        language: controller.language,
        showDebug: Boolean(ctx.config?.story?.showDebug),
        onAddChapter: controller.addChapter,
        onSelectChapter: (chapterId: string) => {
          controller.activeChapterTask.set(null);
          if (get(controller.selectedChapterId) !== chapterId) {
            controller.selectChapter(chapterId);
          }
          controller.openChapter();
        },
        onDeleteChapter: controller.deleteChapter,
        onDuplicateChapter: controller.duplicateChapter,
        onReorderChapter: controller.reorderChapter,
      },
    });
    return { destroy: () => unmount(instance) };
  });

  const topBar = makePlugin('story-builder-topbar', 'Story Builder Actions', 'top', (target) => {
    const instance = mount(StoryBuilderTopBar, {
      target,
      props: {
        story: controller.story,
        isPreviewing: controller.isPreviewing,
        saveState: controller.saveState,
        saveConfigured: controller.saveConfigured,
        dirty: controller.dirty,
        canUndo: controller.canUndo,
        canRedo: controller.canRedo,
        language: controller.language,
        onUndo: controller.undo,
        onRedo: controller.redo,
        onNarration: controller.openNarration,
        onPreview: controller.startPreview,
        onStopPreview: controller.stopPreview,
        onSave: () => void controller.saveStory(),
        onExport: controller.exportStory,
      },
    });
    return { destroy: () => unmount(instance) };
  });

  const createEditorSurface = (target: HTMLElement, surface: 'overlay' | 'inspector') => {
    const instance = mount(StoryBuilderOverlay, {
      target,
      props: {
        surface,
        story: controller.story,
        currentManifest: controller.currentManifest,
        viewerCanvasIndex: controller.viewerCanvasIndex,
        viewerCanvasCount: controller.viewerCanvasCount,
        viewBox: controller.viewBox,
        selectedChapterId: controller.selectedChapterId,
        activeChapterTask: controller.activeChapterTask,
        onChapterTaskChange: controller.activeChapterTask.set,
        validationErrors: controller.validationErrors,
        uiMode: controller.uiMode,
        mediaType: controller.mediaType,
        mediaMarks: controller.mediaMarks,
        avMarksValid: controller.avMarksValid,
        transitionDelayDefault: controller.transitionDelayDefault,
        annotationLanguage: controller.annotationLanguage,
        annotationTool: controller.chapterAnnotationTool,
        saveModalOpen: controller.saveModalOpen,
        saveModalPayload: controller.saveModalPayload,
        onCloseSaveModal: controller.closeSaveModal,
        onSetAnnotationLanguage: controller.setAnnotationLanguage,
        onSetAnnotationTool: controller.setChapterAnnotationTool,
        language: controller.language,
        languages: controller.languages,
        onBackNarration: controller.backFromNarration,
        onCloseNarration: controller.closeNarration,
        onCloseChapter: controller.closeChapter,
        onSetMediaMarks: controller.setMediaMarks,
        onPreviewMediaSegment: controller.previewMediaSegment,
        onStopPreviewMediaSegment: controller.stopPreviewMediaSegment,
        onSetNarrationTrack: controller.setNarrationTrack,
        onUpdateStoryTitle: controller.updateStoryTitle,
        onUpdateStoryIdentifiers: controller.updateStoryIdentifiers,
        onAssignSegment: controller.assignNarrationSegment,
        onSkipNarration: controller.skipNarration,
        onUpdateManifest: controller.updateManifest,
        onReloadManifest: controller.reloadManifest,
        onSelectCanvas: controller.selectCanvas,
        onLoadManifest: controller.loadManifest,
        onAddChapter: controller.addChapter,
        onUpdateChapterTitle: controller.updateChapterTitle,
        onUpdateChapterDescription: controller.updateChapterDescription,
        onUpdateAnnotationText: controller.updateAnnotationText,
        onUpdateAnnotationPlacement: controller.updateAnnotationPlacement,
        onUpdateAdvanceMode: controller.updateAdvanceMode,
        onUpdateDelay: controller.updateDelay,
        onUpdateChapterPosition: controller.updateChapter,
        onRevertChapterPosition: () => {
          const chapterId = get(controller.selectedChapterId);
          if (chapterId) controller.selectChapter(chapterId);
        },
        onSaveChapterSettings: controller.saveChapterSettings,
        layers: controller.mediaSources,
        layerOpacities: controller.layerOpacities,
        onUpdateLayerOpacity: controller.updateLayerOpacity,
        onDeleteMotionPoint: controller.deleteMotionPoint,
        onUpdateMotionDuration: controller.updateMotionDuration,
        onGoToMotionPoint: controller.goToMotionPoint,
        motionPreviewing: controller.motionPreviewing,
        motionPointDraft: controller.motionPointDraft,
        onApplyMotionPreset: controller.applyMotionPreset,
        onPreviewMotion: controller.previewMotion,
        onStopMotionPreview: controller.stopMotionPreview,
        onStartMotionPointPositioning: controller.startMotionPointPositioning,
        onConfirmMotionPointPositioning: controller.confirmMotionPointPositioning,
        onCancelMotionPointPositioning: controller.cancelMotionPointPositioning,
        positioningLanguage: controller.positioningLanguage,
        onStartAnnotationPositioning: controller.startAnnotationPositioning,
        onConfirmAnnotationPositioning: controller.confirmAnnotationPositioning,
        onCancelAnnotationPositioning: controller.cancelAnnotationPositioning,
      },
    });
    return { destroy: () => unmount(instance) };
  };

  const inspector = makePlugin('story-builder-inspector', 'Chapter Inspector', 'right', (target) =>
    createEditorSurface(target, 'inspector'),
  );

  const overlay = makePlugin(
    'story-builder-overlay',
    'Story Builder Overlay',
    'overlay',
    (target) => createEditorSurface(target, 'overlay'),
  );

  const wideAuthoring = makePlugin(
    'story-builder-wide-authoring',
    'Chapter timeline',
    'bottom',
    (target) => {
      const instance = mount(StoryBuilderWideAuthoring, {
        target,
        props: {
          story: controller.story,
          selectedChapterId: controller.selectedChapterId,
          activeTask: controller.activeChapterTask,
          previewing: controller.motionPreviewing,
          mediaType: controller.mediaType,
          mediaSources: controller.mediaSources,
          mediaMarks: controller.mediaMarks,
          avMarksValid: controller.avMarksValid,
          language: controller.language,
          languages: controller.languages,
          onSetNarrationTrack: controller.setNarrationTrack,
          onAssignNarrationSegment: controller.assignNarrationSegment,
          onAssignMediaSegment: controller.assignMediaSegment,
          onPreviewMediaSegment: controller.previewMediaSegment,
          onStopPreviewMediaSegment: controller.stopPreviewMediaSegment,
          onDeleteDrawingAnnotation: controller.deleteChapterDrawingAnnotation,
          onDeleteTextAnnotation: controller.deleteChapterTextAnnotation,
          onEditDrawingAnnotation: controller.editChapterDrawingAnnotation,
          onEditTextAnnotation: controller.editChapterTextAnnotation,
          onAddPoint: () => controller.startMotionPointPositioning(),
          onGoToPoint: controller.goToMotionPoint,
          onPreview: controller.previewMotion,
          onStopPreview: controller.stopMotionPreview,
        },
      });
      return { destroy: () => unmount(instance) };
    },
  );

  return [topBar, sidebar, inspector, overlay, wideAuthoring];
};
