import type {
  ChapterCameraKeyframe,
  ChapterCameraTrack,
} from '../core/types/story';
import type { ViewBox } from '../core/types/viewer';

export type CameraTrackSample = Pick<
  ChapterCameraKeyframe,
  'viewBox' | 'model' | 'layerOpacities'
>;

export const retimeCameraKeyframes = (
  keyframes: ChapterCameraKeyframe[],
  durationMs: number,
): ChapterCameraKeyframe[] => {
  const duration = Math.max(1, durationMs);
  if (keyframes.length <= 1) {
    return keyframes.map((point) => ({ ...point, timeMs: 0 }));
  }
  return keyframes.map((point, index) => ({
    ...point,
    timeMs: Math.round((index / (keyframes.length - 1)) * duration),
  }));
};

const lerp = (from: number, to: number, progress: number): number =>
  from + (to - from) * progress;

const interpolateViewBox = (from: ViewBox, to: ViewBox, progress: number): ViewBox => ({
  x: lerp(from.x, to.x, progress),
  y: lerp(from.y, to.y, progress),
  w: lerp(from.w, to.w, progress),
  h: lerp(from.h, to.h, progress),
});

const ease = (value: number, easing: ChapterCameraTrack['easing']): number => {
  if (easing === 'linear') return value;
  if (easing === 'ease-in') return value * value;
  if (easing === 'ease-out') return 1 - (1 - value) * (1 - value);
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
};

export const generateCameraPreset = (
  preset: NonNullable<ChapterCameraTrack['preset']>,
  viewBox: ViewBox,
  durationMs = 5000,
): ChapterCameraTrack => {
  const inset = (box: ViewBox, amount: number): ViewBox => ({
    x: box.x + box.w * amount,
    y: box.y + box.h * amount,
    w: box.w * (1 - amount * 2),
    h: box.h * (1 - amount * 2),
  });
  const drift: ViewBox = {
    x: viewBox.x + viewBox.w * 0.12,
    y: viewBox.y + viewBox.h * 0.06,
    w: viewBox.w,
    h: viewBox.h,
  };
  const close = inset(viewBox, 0.12);
  const [start, end] =
    preset === 'zoom-in'
      ? [viewBox, close]
      : preset === 'zoom-out'
        ? [close, viewBox]
        : preset === 'pan'
          ? [viewBox, drift]
          : preset === 'drift-zoom'
            ? [viewBox, { ...close, x: close.x + viewBox.w * 0.06 }]
            : [viewBox, viewBox];
  return {
    preset,
    durationMs: Math.max(1, durationMs),
    easing: 'ease-in-out',
    keyframes: [
      {
        id: `${preset}-start`,
        timeMs: 0,
        focus: { x: start.x + start.w / 2, y: start.y + start.h / 2 },
        viewBox: start,
      },
      {
        id: `${preset}-end`,
        timeMs: Math.max(1, durationMs),
        focus: { x: end.x + end.w / 2, y: end.y + end.h / 2 },
        viewBox: end,
      },
    ],
  };
};

export const configureCameraTrackPreset = (
  track: ChapterCameraTrack | undefined,
  preset: NonNullable<ChapterCameraTrack['preset']>,
  currentView: ViewBox,
  durationMs = 5000,
): ChapterCameraTrack => {
  const duration = Math.max(1, track?.durationMs ?? durationMs);
  const points = track?.keyframes ?? [];
  const keyframes = points.map((point, index) => {
    const focus = point.focus ?? {
      x: (point.viewBox?.x ?? currentView.x) + (point.viewBox?.w ?? currentView.w) / 2,
      y: (point.viewBox?.y ?? currentView.y) + (point.viewBox?.h ?? currentView.h) / 2,
    };
    if (preset === 'custom') return { ...point, focus };
    const ratio = points.length > 1 ? index / (points.length - 1) : 0;
    const scale =
      preset === 'zoom-in'
        ? 1 - ratio * 0.3
        : preset === 'zoom-out'
          ? 0.7 + ratio * 0.3
          : preset === 'drift-zoom'
            ? 1 - ratio * 0.18
            : 1;
    const w = currentView.w * scale;
    const h = currentView.h * scale;
    return {
      ...point,
      focus,
      viewBox: { x: focus.x - w / 2, y: focus.y - h / 2, w, h },
    };
  });
  return {
    durationMs: duration,
    preset,
    easing: preset === 'pan' ? 'linear' : 'ease-in-out',
    keyframes: retimeCameraKeyframes(keyframes, duration),
  };
};

/** Deterministically samples an in-chapter camera path at a presentation time. */
export const sampleCameraTrack = (
  track: ChapterCameraTrack,
  timeMs: number,
): CameraTrackSample | null => {
  const points = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);
  if (!points.length) return null;
  const time = Math.max(0, Math.min(track.durationMs, Number.isFinite(timeMs) ? timeMs : 0));
  const toIndex = points.findIndex((point) => point.timeMs >= time);
  if (toIndex <= 0) {
    const point = toIndex === 0 ? points[0] : points[points.length - 1];
    return point
      ? { viewBox: point.viewBox, model: point.model, layerOpacities: point.layerOpacities }
      : null;
  }
  const from = points[toIndex - 1];
  const to = points[toIndex];
  if (!from || !to) return null;
  const span = Math.max(1, to.timeMs - from.timeMs);
  const progress = ease(
    Math.max(0, Math.min(1, (time - from.timeMs) / span)),
    track.easing ?? 'ease-in-out',
  );
  const layerIds = new Set([
    ...Object.keys(from.layerOpacities ?? {}),
    ...Object.keys(to.layerOpacities ?? {}),
  ]);
  const layerOpacities = Object.fromEntries(
    [...layerIds].map((id) => [
      id,
      lerp(from.layerOpacities?.[id] ?? 0, to.layerOpacities?.[id] ?? 0, progress),
    ]),
  );
  return {
    ...(from.viewBox && to.viewBox
      ? { viewBox: interpolateViewBox(from.viewBox, to.viewBox, progress) }
      : { viewBox: to.viewBox ?? from.viewBox }),
    // 3D string poses remain at the preceding point until renderer-safe
    // interpolation is introduced; the exact destination is still sampled.
    model: progress >= 1 ? (to.model ?? from.model) : (from.model ?? to.model),
    ...(layerIds.size ? { layerOpacities } : {}),
  };
};
