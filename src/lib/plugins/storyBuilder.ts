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
        viewBox: controller.viewBox,
        selectedChapterId: controller.selectedChapterId,
        validationErrors: controller.validationErrors,
        uiMode: controller.uiMode,
        mediaType: controller.mediaType,
        mediaMarks: controller.mediaMarks,
        avMarksValid: controller.avMarksValid,
        annotationLanguage: controller.annotationLanguage,
        saveModalOpen: controller.saveModalOpen,
        saveModalPayload: controller.saveModalPayload,
        onCloseSaveModal: controller.closeSaveModal,
        onSetAnnotationLanguage: controller.setAnnotationLanguage,
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
        onAssignSegment: controller.assignNarrationSegment,
        onSkipNarration: controller.skipNarration,
        onUpdateManifest: controller.updateManifest,
        onReloadManifest: controller.reloadManifest,
        onLoadManifest: controller.loadManifest,
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

  return [topBar, sidebar, inspector, overlay];
};
