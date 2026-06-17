import { describe, expect, it } from 'vitest';
import type { ViewerApi } from '../../core/types/viewer-api';
import { captureAudioVideo, captureImagePdf, captureModel } from '../capture';

const createViewer = (overrides: Partial<ViewerApi>): ViewerApi => ({
  getViewBox: () => ({ x: 1, y: 2, w: 300, h: 200 }),
  setViewBox: () => undefined,
  getMediaType: () => 'image',
  getState: () => null,
  getCanvasIndex: () => 0,
  getCanvasId: () => null,
  setCanvasByIndex: () => undefined,
  setCanvasById: () => undefined,
  setManifest: () => undefined,
  getManifestId: () => 'https://example.org/manifest.json',
  setModelOrbit: () => undefined,
  setModelTarget: () => undefined,
  setModelOrientation: () => undefined,
  addAnnotation: () => Promise.resolve(),
  removeAnnotation: () => Promise.resolve(),
  on: () => () => undefined,
  off: () => undefined,
  ...overrides,
});

describe('captureImagePdf', () => {
  it('captures viewBox for image media', () => {
    const viewer = createViewer({});
    const result = captureImagePdf(viewer);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capture.viewBox).toEqual({ x: 1, y: 2, w: 300, h: 200 });
      expect(result.capture.manifest).toBe('https://example.org/manifest.json');
    }
  });

  it('accepts manifest override when viewer manifest missing', () => {
    const viewer = createViewer({ getManifestId: () => null });
    const result = captureImagePdf(viewer, 'https://example.org/fallback.json');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capture.manifest).toBe('https://example.org/fallback.json');
    }
  });

  it('captures viewBox for pdf media', () => {
    const viewer = createViewer({ getMediaType: () => 'pdf' });
    const result = captureImagePdf(viewer);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capture.viewBox).toEqual({ x: 1, y: 2, w: 300, h: 200 });
    }
  });

  it('returns error when viewBox is missing', () => {
    const viewer = createViewer({ getViewBox: () => null });
    const result = captureImagePdf(viewer);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing-viewbox');
    }
  });
});

describe('captureAudioVideo', () => {
  it('captures media segments for audio', () => {
    const viewer = createViewer({ getMediaType: () => 'audio' });
    const result = captureAudioVideo(viewer, { start: 12.5, end: 28.0 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capture.media).toEqual({ start: 12.5, end: 28.0 });
    }
  });

  it('captures media segments for video', () => {
    const viewer = createViewer({ getMediaType: () => 'video' });
    const result = captureAudioVideo(viewer, { start: 1, end: 3 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capture.media).toEqual({ start: 1, end: 3 });
    }
  });

  it('rejects missing or invalid marks', () => {
    const viewer = createViewer({ getMediaType: () => 'audio' });
    const missing = captureAudioVideo(viewer, null);
    const invalid = captureAudioVideo(viewer, { start: 5, end: 2 });

    expect(missing.ok).toBe(false);
    expect(invalid.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.reason).toBe('invalid-media-marks');
    }
    if (!invalid.ok) {
      expect(invalid.reason).toBe('invalid-media-marks');
    }
  });
});

describe('captureModel', () => {
  it('captures model pose for 3D media', () => {
    const viewer = createViewer({ getMediaType: () => 'model' });
    const result = captureModel(viewer, {
      cameraOrbit: '45deg 30deg 2m',
      cameraTarget: '0m 1m 0m',
      fieldOfView: '45deg',
      orientation: '0deg 0deg 0deg',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capture.model).toEqual({
        cameraOrbit: '45deg 30deg 2m',
        cameraTarget: '0m 1m 0m',
        fieldOfView: '45deg',
        orientation: '0deg 0deg 0deg',
      });
    }
  });

  it('rejects capture when pose is missing', () => {
    const viewer = createViewer({ getMediaType: () => 'model' });
    const result = captureModel(viewer, null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing-model-pose');
    }
  });

  it('prefers viewer pose when available', () => {
    const viewer = createViewer({
      getMediaType: () => 'model',
      getModelPose: () => ({
        cameraOrbit: '10deg 20deg 3m',
        cameraTarget: '1m 2m 3m',
        fieldOfView: '60deg',
      }),
    });

    const result = captureModel(viewer, {
      cameraOrbit: '45deg 30deg 2m',
      cameraTarget: '0m 1m 0m',
      fieldOfView: '45deg',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capture.model).toEqual({
        cameraOrbit: '10deg 20deg 3m',
        cameraTarget: '1m 2m 3m',
        fieldOfView: '60deg',
        orientation: undefined,
      });
    }
  });
});
