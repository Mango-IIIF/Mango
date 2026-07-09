import type { ModelPose } from '../core/types/model';
import type { ViewerApi } from '../core/types/viewer-api';
import type { CapturePayload } from '../state/story.svelte';

export type CaptureErrorReason =
  | 'unsupported-media'
  | 'missing-manifest'
  | 'missing-viewbox'
  | 'invalid-media-marks'
  | 'missing-model-pose';

export type CaptureResult =
  | { ok: true; capture: CapturePayload }
  | { ok: false; reason: CaptureErrorReason };

export const captureImagePdf = (
  viewer: ViewerApi,
  manifestOverride?: string,
): CaptureResult => {
  const mediaType = viewer.getMediaType();
  if (mediaType !== 'image' && mediaType !== 'pdf') {
    return { ok: false, reason: 'unsupported-media' };
  }

  const manifest = viewer.getManifestId() ?? manifestOverride;
  if (!manifest) {
    return { ok: false, reason: 'missing-manifest' };
  }

  const viewBox = viewer.getViewBox();
  if (!viewBox) {
    return { ok: false, reason: 'missing-viewbox' };
  }

  const canvasIndex = viewer.getCanvasIndex();
  const canvasId = viewer.getCanvasId() ?? undefined;
  const layerOpacities = viewer.getLayerOpacities?.() ?? {};

  return {
    ok: true,
    capture: {
      manifest,
      canvasIndex: canvasIndex < 0 ? 0 : canvasIndex,
      canvasId,
      viewBox,
      layerOpacities: Object.keys(layerOpacities).length > 0 ? layerOpacities : undefined,
    },
  };
};

export const captureAudioVideo = (
  viewer: ViewerApi,
  segment: { start: number; end: number } | null,
  manifestOverride?: string,
): CaptureResult => {
  const mediaType = viewer.getMediaType();
  if (mediaType !== 'audio' && mediaType !== 'video') {
    return { ok: false, reason: 'unsupported-media' };
  }

  const manifest = viewer.getManifestId() ?? manifestOverride;
  if (!manifest) {
    return { ok: false, reason: 'missing-manifest' };
  }

  if (!segment || !Number.isFinite(segment.start) || !Number.isFinite(segment.end)) {
    return { ok: false, reason: 'invalid-media-marks' };
  }
  if (segment.end <= segment.start) {
    return { ok: false, reason: 'invalid-media-marks' };
  }

  const canvasIndex = viewer.getCanvasIndex();
  const canvasId = viewer.getCanvasId() ?? undefined;
  const layerOpacities = viewer.getLayerOpacities?.() ?? {};

  return {
    ok: true,
    capture: {
      manifest,
      canvasIndex: canvasIndex < 0 ? 0 : canvasIndex,
      canvasId,
      media: {
        start: segment.start,
        end: segment.end,
      },
      layerOpacities: Object.keys(layerOpacities).length > 0 ? layerOpacities : undefined,
    },
  };
};

export const captureModel = (
  viewer: ViewerApi,
  pose: ModelPose | null,
  manifestOverride?: string,
): CaptureResult => {
  const mediaType = viewer.getMediaType();
  if (mediaType !== 'model') {
    return { ok: false, reason: 'unsupported-media' };
  }

  const manifest = viewer.getManifestId() ?? manifestOverride;
  if (!manifest) {
    return { ok: false, reason: 'missing-manifest' };
  }

  const viewerPose = viewer.getModelPose?.() ?? null;
  const cameraOrbit = viewerPose?.cameraOrbit ?? viewer.getModelOrbit?.() ?? pose?.cameraOrbit;
  const cameraTarget =
    viewerPose?.cameraTarget ?? viewer.getModelTarget?.() ?? pose?.cameraTarget;
  const fieldOfView = viewerPose?.fieldOfView ?? pose?.fieldOfView;
  const orientation =
    viewerPose?.orientation ?? viewer.getModelOrientation?.() ?? pose?.orientation;

  if (!cameraOrbit && !cameraTarget && !orientation && !fieldOfView) {
    return { ok: false, reason: 'missing-model-pose' };
  }

  const canvasIndex = viewer.getCanvasIndex();
  const canvasId = viewer.getCanvasId() ?? undefined;
  const layerOpacities = viewer.getLayerOpacities?.() ?? {};

  return {
    ok: true,
    capture: {
      manifest,
      canvasIndex: canvasIndex < 0 ? 0 : canvasIndex,
      canvasId,
      model: {
        cameraOrbit,
        cameraTarget,
        fieldOfView,
        orientation,
      },
      layerOpacities: Object.keys(layerOpacities).length > 0 ? layerOpacities : undefined,
    },
  };
};
