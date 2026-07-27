import type { ChapterCameraKeyframe, ChapterCameraTrack } from '../core/types/story';
import type { ViewBox } from '../core/types/viewer';

export type CameraTrackSample = Pick<ChapterCameraKeyframe, 'viewBox' | 'model' | 'layerOpacities'>;

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

export const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
};

const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const interpolateViewBox = (from: ViewBox, to: ViewBox, progress: number): ViewBox => ({
  x: lerp(from.x, to.x, progress),
  y: lerp(from.y, to.y, progress),
  w: lerp(from.w, to.w, progress),
  h: lerp(from.h, to.h, progress),
});

const clampMonotonic = (val: number, bound1: number, bound2: number, flex = 0.15): number => {
  const minVal = Math.min(bound1, bound2);
  const maxVal = Math.max(bound1, bound2);
  const margin = Math.abs(bound2 - bound1) * flex;
  return Math.max(minVal - margin, Math.min(maxVal + margin, val));
};

const interpolateCatmullRomViewBox = (
  p0: ViewBox,
  p1: ViewBox,
  p2: ViewBox,
  p3: ViewBox,
  t: number,
): ViewBox => {
  const rawX = catmullRom(p0.x, p1.x, p2.x, p3.x, t);
  const rawY = catmullRom(p0.y, p1.y, p2.y, p3.y, t);
  const x = clampMonotonic(rawX, p1.x, p2.x, 0.2);
  const y = clampMonotonic(rawY, p1.y, p2.y, 0.2);

  // Zoom level width (w) is monotonically bounded between p1.w and p2.w
  const rawW = catmullRom(p0.w, p1.w, p2.w, p3.w, t);
  const w = clampMonotonic(rawW, p1.w, p2.w, 0.05);

  // Interpolate the aspect ratio from the segment start (p1) towards the
  // segment end (p2) so the height actually reaches p2.h at t=1. Locking to
  // p1's aspect caused a vertical "pop" at segment ends whenever consecutive
  // keyframes were captured at different viewer aspect ratios.
  const aspect1 = p1.h > 0 ? p1.w / p1.h : 1;
  const aspect2 = p2.h > 0 ? p2.w / p2.h : aspect1;
  const aspect = lerp(aspect1, aspect2, t);
  const h = Math.max(1, w / (aspect || 1));

  return { x, y, w, h };
};

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
  initialDwellMs?: number,
): ChapterCameraTrack => {
  const inset = (box: ViewBox, amount: number): ViewBox => ({
    x: box.x + box.w * amount,
    y: box.y + box.h * amount,
    w: box.w * (1 - amount * 2),
    h: box.h * (1 - amount * 2),
  });
  const panEnd: ViewBox = {
    x: viewBox.x + viewBox.w * 0.25,
    y: viewBox.y + viewBox.h * 0.1,
    w: viewBox.w,
    h: viewBox.h,
  };
  const deepZoom = inset(viewBox, 0.28);
  const heroStart = inset(viewBox, 0.32);
  const kenBurnsEnd = {
    x: viewBox.x + viewBox.w * 0.18,
    y: viewBox.y + viewBox.h * 0.1,
    w: viewBox.w * 0.7,
    h: viewBox.h * 0.7,
  };

  const dwellMs = initialDwellMs ?? (preset === 'hero-reveal' ? 1500 : undefined);

  if (preset === 'hero-reveal') {
    return {
      preset: 'hero-reveal',
      durationMs: Math.max(1, durationMs),
      pathType: 'spline',
      easing: 'ease-out',
      keyframes: [
        {
          id: 'hero-start',
          timeMs: 0,
          ...(dwellMs ? { dwellMs } : {}),
          focus: {
            x: heroStart.x + heroStart.w / 2,
            y: heroStart.y + heroStart.h / 2,
          },
          viewBox: heroStart,
        },
        {
          id: 'hero-end',
          timeMs: Math.max(1, durationMs),
          focus: { x: viewBox.x + viewBox.w / 2, y: viewBox.y + viewBox.h / 2 },
          viewBox,
        },
      ],
    };
  }

  if (preset === 'arc-sweep') {
    const halfDuration = Math.round(durationMs / 2);
    const midView: ViewBox = {
      x: viewBox.x + viewBox.w * 0.2,
      y: viewBox.y - viewBox.h * 0.15,
      w: viewBox.w * 0.8,
      h: viewBox.h * 0.8,
    };
    return {
      preset: 'arc-sweep',
      durationMs: Math.max(1, durationMs),
      pathType: 'spline',
      easing: 'ease-in-out',
      keyframes: [
        {
          id: 'arc-start',
          timeMs: 0,
          ...(dwellMs ? { dwellMs } : {}),
          focus: { x: viewBox.x + viewBox.w / 2, y: viewBox.y + viewBox.h / 2 },
          viewBox,
        },
        {
          id: 'arc-mid',
          timeMs: halfDuration,
          focus: { x: midView.x + midView.w / 2, y: midView.y + midView.h / 2 },
          viewBox: midView,
        },
        {
          id: 'arc-end',
          timeMs: Math.max(1, durationMs),
          focus: { x: panEnd.x + panEnd.w / 2, y: panEnd.y + panEnd.h / 2 },
          viewBox: panEnd,
        },
      ],
    };
  }

  const [start, end] =
    preset === 'ken-burns'
      ? [viewBox, kenBurnsEnd]
      : preset === 'zoom-in'
        ? [viewBox, deepZoom]
        : preset === 'zoom-out'
          ? [deepZoom, viewBox]
          : preset === 'pan'
            ? [viewBox, panEnd]
            : preset === 'drift-zoom'
              ? [viewBox, { ...deepZoom, x: deepZoom.x + viewBox.w * 0.1 }]
              : [viewBox, viewBox];

  return {
    preset,
    durationMs: Math.max(1, durationMs),
    pathType: preset === 'ken-burns' ? 'spline' : 'linear',
    easing: preset === 'pan' ? 'linear' : 'ease-in-out',
    keyframes: [
      {
        id: `${preset}-start`,
        timeMs: 0,
        ...(dwellMs ? { dwellMs } : {}),
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
  options: { preservePoints?: boolean } = {},
): ChapterCameraTrack => {
  const duration = Math.max(1, track?.durationMs ?? durationMs);
  const points = track?.keyframes ?? [];
  const existingDwell = points[0]?.dwellMs;
  const generatedPointIds = new Set([
    'ken-burns-start',
    'ken-burns-end',
    'hero-start',
    'hero-end',
    'arc-start',
    'arc-mid',
    'arc-end',
    'zoom-in-start',
    'zoom-in-end',
    'zoom-out-start',
    'zoom-out-end',
    'pan-start',
    'pan-end',
    'drift-zoom-start',
    'drift-zoom-end',
    'static-start',
    'static-end',
    'custom-start',
    'custom-end',
  ]);
  const generatedTrack =
    points.length > 0 && points.every((point) => generatedPointIds.has(point.id));

  if (preset === 'static' || points.length < 2 || (generatedTrack && !options.preservePoints)) {
    return generateCameraPreset(preset, currentView, duration, existingDwell);
  }

  if (preset === 'custom') {
    return {
      ...track,
      durationMs: duration,
      preset,
      keyframes: retimeCameraKeyframes(points, duration),
    };
  }

  const keyframes = points.map((point, index) => {
    const focus = point.focus ?? {
      x: (point.viewBox?.x ?? currentView.x) + (point.viewBox?.w ?? currentView.w) / 2,
      y: (point.viewBox?.y ?? currentView.y) + (point.viewBox?.h ?? currentView.h) / 2,
    };

    const ratio = points.length > 1 ? index / (points.length - 1) : 0;
    const scale =
      preset === 'ken-burns'
        ? 1 - ratio * 0.3
        : preset === 'hero-reveal'
          ? 0.44 + ratio * 0.56
          : preset === 'zoom-in'
            ? 1 - ratio * 0.56
            : preset === 'zoom-out'
              ? 0.44 + ratio * 0.56
              : preset === 'drift-zoom'
                ? 1 - ratio * 0.28
                : 1;

    const w = currentView.w * scale;
    const h = currentView.h * scale;

    const dwellMs =
      index === 0
        ? (point.dwellMs ?? (preset === 'hero-reveal' ? 1500 : undefined))
        : point.dwellMs;

    return {
      ...point,
      focus,
      ...(dwellMs ? { dwellMs } : {}),
      viewBox: { x: focus.x - w / 2, y: focus.y - h / 2, w, h },
    };
  });

  return {
    durationMs: duration,
    preset,
    pathType:
      preset === 'ken-burns' || preset === 'arc-sweep' || preset === 'hero-reveal'
        ? 'spline'
        : (track?.pathType ?? 'linear'),
    easing: preset === 'hero-reveal' ? 'ease-out' : preset === 'pan' ? 'linear' : 'ease-in-out',
    keyframes: retimeCameraKeyframes(keyframes, duration),
  };
};

/**
 * Samples the raw (un-eased) camera path at an absolute presentation time.
 * Segments are traversed with LINEAR time progress; global easing is applied
 * separately by {@link sampleCameraTrack} via a time-warp. Keeping the
 * per-segment progress linear is what removes the "dead stop" the camera used
 * to make at every interior keyframe (each segment previously eased 0→1, so
 * ease-in-out drove velocity to zero at both ends of every segment).
 */
const samplePositionAtTime = (
  points: ChapterCameraKeyframe[],
  pathType: ChapterCameraTrack['pathType'],
  time: number,
): CameraTrackSample | null => {
  let toIndex = points.findIndex((point) => point.timeMs > time);
  if (toIndex === -1) {
    toIndex = points.length - 1;
  }

  if (toIndex === 0) {
    const first = points[0];
    return {
      viewBox: first.viewBox,
      model: first.model,
      layerOpacities: first.layerOpacities,
    };
  }

  const fromIndex = toIndex - 1;
  const from = points[fromIndex];
  const to = points[toIndex];
  if (!from || !to) return null;

  const dwell = from.dwellMs ?? 0;
  if (time >= to.timeMs) {
    return {
      viewBox: to.viewBox,
      model: to.model,
      layerOpacities: to.layerOpacities,
    };
  }
  if (time < from.timeMs + dwell) {
    return {
      viewBox: from.viewBox,
      model: from.model,
      layerOpacities: from.layerOpacities,
    };
  }

  const effectiveStart = from.timeMs + dwell;
  const span = Math.max(1, to.timeMs - effectiveStart);
  const progress = Math.max(0, Math.min(1, (time - effectiveStart) / span));

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

  let viewBoxResult: ViewBox | undefined = undefined;
  if (from.viewBox && to.viewBox) {
    const isSpline = pathType ? pathType === 'spline' : points.length >= 3;
    if (isSpline) {
      const p1 = from.viewBox;
      const p2 = to.viewBox;
      const p0Candidate = points[fromIndex - 1]?.viewBox;
      const p3Candidate = points[toIndex + 1]?.viewBox;

      const p0 = p0Candidate ?? p1;
      const p3 = p3Candidate ?? p2;

      viewBoxResult = interpolateCatmullRomViewBox(p0, p1, p2, p3, progress);
    } else {
      viewBoxResult = interpolateViewBox(from.viewBox, to.viewBox, progress);
    }
  }

  return {
    ...(viewBoxResult ? { viewBox: viewBoxResult } : { viewBox: to.viewBox ?? from.viewBox }),
    model: progress >= 1 ? (to.model ?? from.model) : (from.model ?? to.model),
    ...(layerIds.size ? { layerOpacities } : {}),
  };
};

/**
 * Deterministically samples an in-chapter camera path at a presentation time.
 *
 * Easing is applied once, across the whole track, by warping the presentation
 * time before locating the position. This produces a smooth acceleration at
 * the very start and deceleration at the very end of the chapter's motion while
 * keeping a continuous, non-zero velocity through interior keyframes — unlike
 * the previous per-segment easing, which decelerated to a full stop at every
 * intermediate camera point.
 */
export const sampleCameraTrack = (
  track: ChapterCameraTrack,
  timeMs: number,
): CameraTrackSample | null => {
  const points = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);
  if (!points.length) return null;

  const duration = Math.max(1, track.durationMs);
  const time = Math.max(0, Math.min(duration, Number.isFinite(timeMs) ? timeMs : 0));

  const easedProgress = ease(time / duration, track.easing ?? 'ease-in-out');
  const warpedTime = easedProgress * duration;

  return samplePositionAtTime(points, track.pathType, warpedTime);
};
