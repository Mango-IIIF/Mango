/**
 * MediaController
 * 
 * Manages media sources, playback events, and media state tracking.
 * Handles media selection, playback control, and model changes.
 */

import { derived, get } from 'svelte/store';
import type { ViewerStateStores } from '../viewerState';
import type { ViewerDerivedStores } from '../viewerDerived';
import type { MediaSource, MediaType } from '../../../iiif/mediaResolver';

export type MediaControllerConfig = {
  state: ViewerStateStores;
  derived: ViewerDerivedStores;
  emitEvent: <K extends string>(event: K, payload: any) => void;
  emitStateChange: () => void;
  getCanvasId: () => string | null;
};

export type MediaController = {
  handleMediaPlay: (detail: { time: number }) => void;
  handleMediaPause: (detail: { time: number }) => void;
  handleMediaTimeUpdate: (detail: { time: number; duration?: number }) => void;
  handleMediaSeek: (detail: { from: number; to: number }) => void;
  handleMediaSegmentEnd: () => void;
  handleModelChange: (detail: {
    source?: string;
    cameraOrbit?: string;
    cameraTarget?: string;
    fieldOfView?: string;
    orientation?: string;
  }) => void;
  getMediaLabel: (source: MediaSource, translate: (key: string) => string) => string;
  getMediaTypeLabel: (type: MediaType | null, translate: (key: string) => string) => string;
  setupMediaEffects: () => (() => void)[];
};

export const createMediaController = ({
  state,
  derived: derivedStores,
  emitEvent,
  emitStateChange,
  getCanvasId,
}: MediaControllerConfig): MediaController => {
  let lastMediaKey = '';

  const emitMediaEvent = <K extends 'mediaPlay' | 'mediaPause' | 'mediaTimeUpdate' | 'mediaSeek' | 'mediaSegmentEnd'>(
    event: K,
    detail: any,
  ) => {
    const canvasId = getCanvasId();
    if (!canvasId) return;
    emitEvent(event, { canvasId, ...detail });
  };

  const handleMediaPlay = (detail: { time: number }) => {
    emitMediaEvent('mediaPlay', { time: detail.time });
  };

  const handleMediaPause = (detail: { time: number }) => {
    emitMediaEvent('mediaPause', { time: detail.time });
  };

  const handleMediaTimeUpdate = (detail: { time: number; duration?: number }) => {
    state.mediaTime.set(detail.time);
    if (detail.duration != null) {
      state.mediaDuration.set(detail.duration);
    }
    emitMediaEvent('mediaTimeUpdate', detail);
  };

  const handleMediaSeek = (detail: { from: number; to: number }) => {
    state.mediaTime.set(detail.to);
    emitMediaEvent('mediaSeek', detail);
  };

  const handleMediaSegmentEnd = () => {
    emitMediaEvent('mediaSegmentEnd', {});
  };

  const handleModelChange = (detail: {
    source?: string;
    cameraOrbit?: string;
    cameraTarget?: string;
    fieldOfView?: string;
    orientation?: string;
  }) => {
    const canvasId = getCanvasId();
    if (!canvasId) return;
    emitEvent('modelChange', { canvasId, ...detail });
  };

  const getMediaLabel = (
    source: MediaSource,
    translate: (key: string) => string,
  ): string => {
    if (typeof source.label === 'string' && source.label.trim()) {
      return source.label;
    }
    if (source.format) return source.format;
    return translate(`media.type.${source.type}`);
  };

  const getMediaTypeLabel = (
    type: MediaType | null,
    translate: (key: string) => string,
  ): string => {
    if (!type) return translate('common.emptyValue');
    return translate(`media.type.${type}`);
  };

  const setupMediaEffects = (): (() => void)[] => {
    const unsubscribers: Array<() => void> = [];

    // Clamp media index when sources change
    const mediaClamp = derived(
      [derivedStores.mediaSources, state.selectedMediaIndex],
      ([sources, index]) => {
        if (sources.length > 0 && index >= sources.length) {
          state.selectedMediaIndex.set(0);
        }
        if (sources.length === 0 && index !== 0) {
          state.selectedMediaIndex.set(0);
        }
      },
    );
    unsubscribers.push(mediaClamp.subscribe(() => undefined));

    // Handle media change side effects
    const mediaChange = derived(
      [
        derivedStores.mediaSource,
        derivedStores.mediaType,
        derivedStores.canvases,
        state.selectedCanvasIndex,
      ],
      ([source, type, canvases, index]) => {
        const key = source ? `${source.type}:${source.src}` : '';
        if (key && key !== lastMediaKey) {
          lastMediaKey = key;
          state.viewBox.set(null);
          state.zoom.set(0);
          state.mediaTime.set(0);
          state.mediaDuration.set(undefined);
          const canvas = canvases[index];
          if (canvas?.id && type) {
            emitEvent('mediaChange', { canvasId: canvas.id, mediaType: type });
            emitStateChange();
          }
        } else if (!key) {
          lastMediaKey = '';
        }
      },
    );
    unsubscribers.push(mediaChange.subscribe(() => undefined));

    return unsubscribers;
  };

  return {
    handleMediaPlay,
    handleMediaPause,
    handleMediaTimeUpdate,
    handleMediaSeek,
    handleMediaSegmentEnd,
    handleModelChange,
    getMediaLabel,
    getMediaTypeLabel,
    setupMediaEffects,
  };
};
