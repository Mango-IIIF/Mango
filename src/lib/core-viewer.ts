export { default, default as ViewerCore } from './features/viewer/ViewerLayout.svelte';
export type { ViewerApi } from './core/types/viewer-api';
export type {
  ImageRendererExtension,
  RendererExtension,
  StagePoint,
  StageSize,
} from './core/types/renderer';
export type { ViewerEventMap } from './core/types/events';
export type { ViewerPlugin } from './core/types/plugin';
export type { ResolvedAnnotation } from './iiif/annotationResolver';
