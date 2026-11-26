/**
 * Building blocks for packages that compose the viewer into a larger surface
 * (for example `@mango-iiif/story`). Everything here is public API: hosts
 * mount `ViewerCore` headless and drive it through `ViewerApi`, sharing the
 * viewer's locale, manifest cache and annotation model rather than copying
 * them.
 */
import type { Component } from 'svelte';
import './core/themes.css';
import ViewerLayout from './features/viewer/ViewerLayout.svelte';
import ViewerHeaderComponent from './viewer/ui/ViewerHeader.svelte';
import MangoFooterBrandComponent from './viewer/ui/MangoFooterBrand.svelte';
import MangoAboutModalComponent from './viewer/ui/MangoAboutModal.svelte';
import MangoLogoIconComponent from './viewer/ui/MangoLogoIcon.svelte';
import type { ManifestEntry } from './core/state/manifests';
import type { ViewerConfig } from './core/types/config';
import type { ViewerPlugin } from './core/types/plugin';
import type { ViewerApi } from './core/types/viewer-api';
import type { ResolvedAnnotation } from './iiif/annotationResolver';

export type ViewerCoreProps = {
  manifestId?: string;
  config?: ViewerConfig;
  plugins?: ViewerPlugin[];
  /** Render the viewer's own header, sidebar and panels. Off for hosts. */
  chrome?: boolean;
  /** Show the stage toolbar. Defaults to `chrome`. */
  toolbar?: boolean;
  canvasIndex?: number;
  oncanvaschange?: (detail: { canvasIndex: number }) => void;
  /** Draw annotations on the stage. Off for hosts that draw their own, such as an editor. */
  annotationOverlay?: boolean;
  /** Asked before the viewer's own controls turn the page. Return false to stay. */
  onbeforecanvaschange?: (detail: { canvasIndex: number }) => boolean | void;
};

export type ViewerCoreInstance = ViewerApi &
  Required<
    Pick<
      ViewerApi,
      | 'goHome'
      | 'zoomIn'
      | 'zoomOut'
      | 'getZoom'
      | 'setZoom'
      | 'panTo'
      | 'getTheme'
      | 'setTheme'
      | 'getCanvasCount'
      | 'setMediaSegment'
    >
  > & {
    setEventTarget: (target: EventTarget) => void;
    /** Replaces an annotation wholesale. For undo and redo. */
    replaceAnnotation: (annotationId: string, annotation: ResolvedAnnotation) => Promise<void>;
    /** Commits the edits already applied to an annotation as one save. */
    commitAnnotation: (annotationId: string) => Promise<void>;
    /** Every annotation the user has made or edited, across all canvases. */
    getUserAnnotations: () => ResolvedAnnotation[];
  };

export const ViewerCore = ViewerLayout as unknown as Component<
  ViewerCoreProps,
  ViewerCoreInstance,
  'manifestId'
>;
export default ViewerCore;

export type ViewerHeaderProps = {
  manifestId?: string;
  manifestEntry?: ManifestEntry;
  brand?: string;
  buttonTitle?: string;
  buttonLabel?: string;
  aboutTitle?: string;
  aboutDescription?: string;
  aboutVersion?: string;
  aboutHomepage?: string;
  aboutVisitLabel?: string;
};

export type MangoFooterBrandProps = {
  position?: 'fixed' | 'absolute' | 'relative' | 'inline';
  size?: number;
  brand?: string;
  buttonTitle?: string;
  buttonLabel?: string;
  aboutTitle?: string;
  aboutDescription?: string;
  aboutVersion?: string;
  aboutHomepage?: string;
  aboutVisitLabel?: string;
};

export type MangoAboutModalProps = {
  open?: boolean;
  onClose?: () => void;
  version?: string;
  title?: string;
  description?: string;
  homepage?: string;
  visitLabel?: string;
};

export type MangoLogoIconProps = {
  size?: number;
  color?: string;
  className?: string;
};

export const ViewerHeader = ViewerHeaderComponent as unknown as Component<ViewerHeaderProps>;
export const MangoFooterBrand = MangoFooterBrandComponent as unknown as Component<MangoFooterBrandProps>;
export const MangoAboutModal = MangoAboutModalComponent as unknown as Component<MangoAboutModalProps>;
export const MangoLogoIcon = MangoLogoIconComponent as unknown as Component<MangoLogoIconProps>;

export {
  VIEWER_THEMES,
  VIEWER_THEME_IDS,
  isViewerTheme,
  resolveViewerTheme,
  type ViewerTheme,
} from './core/themes';

export type { ViewerApi } from './core/types/viewer-api';
export type { ViewerConfig } from './core/types/config';
export type {
  ImageRendererExtension,
  RendererExtension,
  StagePoint,
  StageSize,
} from './core/types/renderer';
export type { EventBus, ModelViewChange, ViewerEventMap } from './core/types/events';
export type {
  PluginCapabilities,
  PluginContext,
  PluginLifecycle,
  PluginSlot,
  ViewerPlugin,
} from './core/types/plugin';
export type { ContentSize, ViewBox, ViewerStateSnapshot } from './core/types/viewer';
export type { ModelPose, ModelPoseOptions, ModelPoseTransition } from './core/types/model';
export type { MediaSource, MediaType } from './iiif/mediaResolver';
export type { AnnotationPoint, ResolvedAnnotation } from './iiif/annotationResolver';
export type {
  AnnotationEditability,
  AnnotationProvenance,
  AnnotationSaveState,
  AnnotationTool,
} from './features/annotations/model';
export type { AnnotationPatchOptions } from './viewer/state/controllers/AnnotationController';

export {
  clearLocaleOverrides,
  createI18n,
  createViewerI18n,
  getLocale,
  locale,
  setLocale,
  setLocaleOverrides,
  supportedLocales,
  t,
  translate,
  viewerLocales,
  type CreateI18nOptions,
  type I18nInstance,
  type I18nParams,
  type LocaleCatalogues,
  type MessageTree,
  type TranslateFn,
} from './core/i18n';
export { createEventBus } from './core/events/eventBus';
export { normaliseViewerConfig, parseViewerConfig } from './core/config/normalise';
export { fetchManifest, manifestsStore } from './core/state/manifests';
export type { ManifestCache, ManifestEntry } from './core/state/manifests';
export { resolveCanvasThumbnail } from './viewer/iiif/thumbnails';
export {
  createViewerFullscreenController,
  isIPadLikeDevice,
  type ViewerFullscreenController,
  type ViewerFullscreenState,
} from './viewer/lifecycle/fullscreen';
export {
  applyPatch,
  applyResolvedPatch,
  createMangoAnnotation,
  projectToResolved,
  resolveAnnotationJson,
  resolvePageJson,
  searchTextFor,
  shapeFromResolved,
  shapeTool,
} from './features/annotations/canonical';
export { isForeign } from './features/annotations/model';
export {
  APPLICATION_EXTENSION_KEYS,
  AUTHORING_PURPOSES,
  DEFAULT_BODY_PURPOSE,
  DEFAULT_MOTIVATION,
  DRAFT_ID_PREFIX,
  DRAFT_PAGE_ID_PREFIX,
  MANGO_NOTE_KEY,
  PRIVATE_EXTENSION_KEYS,
  authoringMotivations,
  isDraftId,
  isExpertMotivation,
  isHttpId,
  mangoProfiles,
  mintDraftId,
  motivationPresets,
  presetForMotivation,
} from './features/annotations/profile';
export { w3cToResolved } from './features/annotations/w3c';
export {
  buildAnnotationStylesheet,
  buildLayerStylesheet,
  colorFromInlineStyle,
  hintsFromInlineStyle,
  parseAnnotationCss,
  rgbaFromHex,
  safeAnnotationColor,
  styleClassForLayer,
} from './features/annotations/style';
