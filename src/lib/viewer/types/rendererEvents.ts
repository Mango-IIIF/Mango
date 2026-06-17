import type { ModelViewChange } from '../../core/types/events';

export type RendererEventHandlers = {
  onMediaPlay?: (detail: { time: number }) => void;
  onMediaPause?: (detail: { time: number }) => void;
  onMediaTimeUpdate?: (detail: { time: number; duration?: number }) => void;
  onMediaSeek?: (detail: { from: number; to: number }) => void;
  onMediaSegmentEnd?: () => void;
  onAnnotationHover?: (detail: { id: string | null }) => void;
  onAnnotationSelect?: (detail: { id: string }) => void;
  onAnnotationClear?: () => void;
  onModelChange?: (detail: ModelViewChange) => void;
};
