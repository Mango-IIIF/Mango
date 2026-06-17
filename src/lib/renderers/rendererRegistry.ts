import type { MediaType } from '../iiif/mediaResolver';
import ImageRenderer from './ImageRenderer.svelte';
import VideoRenderer from './VideoRenderer.svelte';
import AudioRenderer from './AudioRenderer.svelte';
import PdfRenderer from './PdfRenderer.svelte';
import ModelRenderer from './ModelRenderer.svelte';
import type { RendererCapabilities } from '../core/types/renderer';
import { DEFAULT_RENDERER_CAPABILITIES } from '../core/types/renderer';

const imageCapabilities: RendererCapabilities = {
  supportsZoom: true,
  supportsFilters: true,
  supportsPan: true,
  supportsViewBox: true,
  supportsRotation: true,
  isInteractive: true,
};

const mediaCapabilities: RendererCapabilities = {
  supportsZoom: false,
  supportsFilters: false,
  supportsPan: false,
  supportsViewBox: false,
  supportsRotation: false,
  isInteractive: true,
};

const pdfCapabilities: RendererCapabilities = {
  supportsZoom: true,
  supportsFilters: false,
  supportsPan: true,
  supportsViewBox: true,
  supportsRotation: false,
  isInteractive: true,
};

const modelCapabilities: RendererCapabilities = {
  supportsZoom: false,
  supportsFilters: false,
  supportsPan: false,
  supportsViewBox: false,
  supportsRotation: true,
  isInteractive: true,
};

export const getRendererComponent = (type: MediaType) => {
  switch (type) {
    case 'video':
      return VideoRenderer;
    case 'audio':
      return AudioRenderer;
    case 'pdf':
      return PdfRenderer;
    case 'model':
      return ModelRenderer;
    case 'image':
    default:
      return ImageRenderer;
  }
};

/**
 * Get the capabilities for a specific media type renderer
 * @param type - The media type
 * @returns The renderer capabilities
 */
export const getRendererCapabilities = (type: MediaType): RendererCapabilities => {
  switch (type) {
    case 'video':
    case 'audio':
      return mediaCapabilities;
    case 'pdf':
      return pdfCapabilities;
    case 'model':
      return modelCapabilities;
    case 'image':
      return imageCapabilities;
    default:
      return DEFAULT_RENDERER_CAPABILITIES;
  }
};
