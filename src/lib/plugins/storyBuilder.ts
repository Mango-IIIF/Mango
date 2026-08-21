import { get } from "svelte/store";
import { mount, unmount } from "svelte";
import type { PluginContext, ViewerPlugin } from "../core/types/plugin";
import {
  createStoryBuilderController,
  type StoryBuilderOptions,
} from "../story/storyBuilderController";
import StoryBuilderSidebar from "../story/ui/StoryBuilderSidebar.svelte";
import StoryBuilderOverlay from "../story/ui/StoryBuilderOverlay.svelte";
import StoryBuilderTopBar from "../story/ui/StoryBuilderTopBar.svelte";
import StoryBuilderWideAuthoring from "../story/ui/StoryBuilderWideAuthoring.svelte";
import { translate } from '../core/i18n';

export const createStoryBuilderPlugins = (
  options: StoryBuilderOptions = {},
): ViewerPlugin[] => {
  const controller = createStoryBuilderController(options);

  const makePlugin = (
    id: string,
    label: string,
    slot: ViewerPlugin["slot"],
    createMount: (
      target: HTMLElement,
      ctx: PluginContext,
    ) => { destroy: () => void },
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

  const sidebar = makePlugin(
    "story-builder-sidebar",
    translate('plugins.storyBuilder.sidebar'),
    "left",
    (target, ctx) => {
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
    },
  );

  const topBar = makePlugin(
    "story-builder-topbar",
    translate('plugins.storyBuilder.actions'),
    "top",
    (target, ctx) => {
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
          onSave: () => {
            const validation = controller.saveExport();
            if (validation.ok) {
              ctx.events.emit('storySaveRequest', {
                story: controller.getExportPayload(),
              });
            }
            void controller.saveStory();
          },
          onExport: () => {
            const result = controller.exportStory();
            if (result.ok) {
              ctx.events.emit('storyExport', {
                story: controller.getExportPayload(),
              });
            }
            return result;
          },
        },
      });
      return { destroy: () => unmount(instance) };
    },
  );

  const createEditorSurface = (
    target: HTMLElement,
    surface: "overlay" | "inspector",
  ) => {
    const instance = mount(StoryBuilderOverlay, {
      target,
      props: {
        surface,
        story: controller.story,
        currentManifest: controller.currentManifest,
        viewBox: controller.viewBox,
        selectedChapterId: controller.selectedChapterId,
        activeChapterTask: controller.activeChapterTask,
        selectedMotionPointId: controller.selectedMotionPointId,
        onGoToMotionPoint: controller.goToMotionPoint,
        onMoveMotionPoint: controller.setMotionPointFocus,
        onChapterTaskChange: controller.activeChapterTask.set,
        validationErrors: controller.validationErrors,
        uiMode: controller.uiMode,
        mediaType: controller.mediaType,
        mediaMarks: controller.mediaMarks,
        avMarksValid: controller.avMarksValid,
        transitionDelayDefault: controller.transitionDelayDefault,
        annotationLanguage: controller.annotationLanguage,
        saveModalOpen: controller.saveModalOpen,
        saveModalPayload: controller.saveModalPayload,
        onCloseSaveModal: controller.closeSaveModal,
        onSetAnnotationLanguage: controller.setAnnotationLanguage,
        language: controller.language,
        languages: controller.languages,
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
        onLoadManifest: controller.loadManifest,
        onLoadSource: controller.loadManifestAndAddChapter,
        onAddChapter: controller.addChapter,
        onUpdateChapterTitle: controller.updateChapterTitle,
        onUpdateChapterDescription: controller.updateChapterDescription,
        onUpdateAnnotationText: controller.updateAnnotationText,
        onUpdateAnnotationPlacement: controller.updateAnnotationPlacement,
        onUpdateAdvanceMode: controller.updateAdvanceMode,
        onUpdateDelay: controller.updateDelay,
        onSetChapterPosition: controller.setChapterPosition,
        storyPreviewing: controller.isPreviewing,
        onPreviewChapter: controller.previewChapter,
        onStopChapterPreview: controller.stopPreview,
        onRevertChapterPosition: () => {
          const chapterId = get(controller.selectedChapterId);
          if (chapterId) controller.selectChapter(chapterId);
        },
        onSaveChapterSettings: controller.saveChapterSettings,
        onCancelChapterSettings: controller.cancelChapterSettings,
        layers: controller.mediaSources,
        layerOpacities: controller.layerOpacities,
        onUpdateLayerOpacity: controller.updateLayerOpacity,
        motionPreviewing: controller.motionPreviewing,
        positioningLanguage: controller.positioningLanguage,
        onStartAnnotationPositioning: controller.startAnnotationPositioning,
        onConfirmAnnotationPositioning: controller.confirmAnnotationPositioning,
        onCancelAnnotationPositioning: controller.cancelAnnotationPositioning,
      },
    });
    return { destroy: () => unmount(instance) };
  };

  const inspector = makePlugin(
    "story-builder-inspector",
    translate('plugins.storyBuilder.inspector'),
    "right",
    (target) => createEditorSurface(target, "inspector"),
  );

  const overlay = makePlugin(
    "story-builder-overlay",
    translate('plugins.storyBuilder.overlay'),
    "overlay",
    (target) => createEditorSurface(target, "overlay"),
  );

  const wideAuthoring = makePlugin(
    "story-builder-wide-authoring",
    translate('plugins.storyBuilder.timeline'),
    "bottom",
    (target) => {
      const instance = mount(StoryBuilderWideAuthoring, {
        target,
        props: {
          story: controller.story,
          selectedChapterId: controller.selectedChapterId,
          activeTask: controller.activeChapterTask,
          mediaType: controller.mediaType,
          mediaSources: controller.mediaSources,
          mediaMarks: controller.mediaMarks,
          avMarksValid: controller.avMarksValid,
          language: controller.language,
          languages: controller.languages,
          onSetNarrationTrack: controller.setNarrationTrack,
          onAssignNarrationSegment: controller.assignNarrationSegment,
          onSkipNarration: controller.skipNarration,
          onAssignMediaSegment: controller.assignMediaSegment,
          onPreviewMediaSegment: controller.previewMediaSegment,
          onStopPreviewMediaSegment: controller.stopPreviewMediaSegment,
          selectedPointId: controller.selectedMotionPointId,
          onDone: controller.saveChapterSettings,
          onAddPoint: controller.addMotionPoint,
          onDeletePoint: controller.deleteMotionPoint,
          onGoToPoint: controller.goToMotionPoint,
          onUpdatePointFromView: controller.updateMotionPointFromViewport,
          motionPreviewing: controller.motionPreviewing,
          onUpdateMotionDuration: controller.updateMotionDuration,
          onUpdateMotionPathType: controller.updateMotionPathType,
          onUpdateMotionInitialDwell: controller.updateMotionInitialDwell,
          onUpdateMotionEasing: controller.updateMotionEasing,
          onApplyMotionPreset: controller.applyMotionPreset,
          onPreviewMotion: controller.previewMotion,
          onStopMotionPreview: controller.stopMotionPreview,
          annotationTool: controller.chapterAnnotationTool,
          selectedAnnotationId: controller.selectedDrawingAnnotationId,
          onSetAnnotationTool: controller.setChapterAnnotationTool,
          onSetAnnotationLabel: controller.setChapterDrawingAnnotationLabel,
          onSetAnnotationStyle: controller.setChapterDrawingAnnotationStyle,
          onDeleteAnnotation: controller.deleteChapterDrawingAnnotation,
          onEditAnnotation: controller.editChapterDrawingAnnotation,
          onFinishAnnotationEdit: controller.finishChapterDrawingAnnotationEdit,
        },
      });
      return { destroy: () => unmount(instance) };
    },
  );

  return [topBar, sidebar, inspector, overlay, wideAuthoring];
};
