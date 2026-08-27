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
  const dwellMs = initialDwellMs;

  const [start, end] =
    preset === 'zoom-in'
      ? [viewBox, deepZoom]
      : preset === 'zoom-out'
        ? [deepZoom, viewBox]
        : preset === 'pan'
          ? [viewBox, panEnd]
          : [viewBox, viewBox];

  return {
    preset,
    durationMs: Math.max(1, durationMs),
    pathType: 'linear',
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

/**
 * How long a track actually animates for, which is what a chapter's length
 * should be measured against.
 *
 * A track needs two keyframes to move between — the motion editor says as much
 * before it enables its controls. Opening the motion tools and setting a
 * duration without placing points leaves a track that animates nothing, and
 * counting its duration held chapters on screen long after their narration had
 * finished, with no camera movement to show for it.
 */
export const animatableCameraDurationMs = (
  track: ChapterCameraTrack | undefined,
): number => {
  if (!track || (track.keyframes?.length ?? 0) < 2) return 0;
  const durationMs = track.durationMs;
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
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
    'zoom-in-start',
    'zoom-in-end',
    'zoom-out-start',
    'zoom-out-end',
    'pan-start',
    'pan-end',
    'static-start',
    'static-end',
    'custom-start',
    'custom-end',
  ]);
  const generatedTrack =
    track?.preset !== 'custom' &&
    points.length > 0 &&
    points.every((point) => generatedPointIds.has(point.id));

  // Custom means "use only the points I placed". It must never manufacture a
  // two-point static track when the author has not placed enough points yet.
  if (preset === 'custom') {
    return {
      ...track,
      durationMs: duration,
      preset,
      keyframes: retimeCameraKeyframes(points, duration),
    };
  }

  if (points.length < 2 || (generatedTrack && !options.preservePoints)) {
    return generateCameraPreset(preset, currentView, duration, existingDwell);
  }

  return {
    ...track,
    durationMs: duration,
    preset,
    pathType: track?.pathType ?? 'linear',
    easing: preset === 'pan' ? 'linear' : (track?.easing ?? 'ease-in-out'),
    keyframes: retimeCameraKeyframes(points, duration),
  };
};

/**
 * Applies a movement rule to authored points for playback only. The stored
 * view boxes remain untouched, so changing styles never destroys framing the
 * author captured and Custom can always return to it.
 */
const styleCameraKeyframes = (
  track: ChapterCameraTrack,
  points: ChapterCameraKeyframe[],
): ChapterCameraKeyframe[] => {
  const preset = track.preset ?? 'custom';
  if (preset === 'custom' || points.length < 2) return points;

  const firstView = points.find((point) => point.viewBox)?.viewBox;
  if (!firstView) return points;

  return points.map((point, index) => {
    if (preset === 'static') {
      return { ...point, viewBox: { ...firstView } };
    }

    const focus = point.focus ?? (point.viewBox
      ? {
          x: point.viewBox.x + point.viewBox.w / 2,
          y: point.viewBox.y + point.viewBox.h / 2,
        }
      : {
          x: firstView.x + firstView.w / 2,
          y: firstView.y + firstView.h / 2,
        });
    const ratio = index / (points.length - 1);
    const scale =
      preset === 'zoom-in'
        ? 1 - ratio * 0.56
        : preset === 'zoom-out'
          ? 1 + ratio * (1 / 0.44 - 1)
          : 1;
    const w = firstView.w * scale;
    const h = firstView.h * scale;
    return {
      ...point,
      focus,
      viewBox: {
        x: focus.x - w / 2,
        y: focus.y - h / 2,
        w,
        h,
      },
    };
  });
};

/** Samples one camera segment without changing the track's absolute clock. */
const samplePositionAtTime = (
  points: ChapterCameraKeyframe[],
  pathType: ChapterCameraTrack['pathType'],
  easing: ChapterCameraTrack['easing'],
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
  const linearProgress = Math.max(0, Math.min(1, (time - effectiveStart) / span));
  const progress = ease(linearProgress, easing ?? 'ease-in-out');

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
 * Keyframe times are contracts: sampling at a point's `timeMs` must return
 * that exact point. Easing therefore belongs to the segment between two
 * points, never to the track's clock. Warping the whole timeline made an
 * ease-out track reach every interior point early (the supplied chapter data,
 * for example, reached its midpoint camera position at 29% of playback rather
 * than 50%).
 */
export const sampleCameraTrack = (
  track: ChapterCameraTrack,
  timeMs: number,
): CameraTrackSample | null => {
  const points = styleCameraKeyframes(
    track,
    [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs),
  );
  if (!points.length) return null;

  const duration = Math.max(1, track.durationMs);
  const time = Math.max(0, Math.min(duration, Number.isFinite(timeMs) ? timeMs : 0));

  return samplePositionAtTime(points, track.pathType, track.easing, time);
};
