export type ModelCameraOrbit = {
  theta: number;
  phi: number;
  radius: number;
};

export type ModelCameraTarget = {
  x: number;
  y: number;
  z: number;
};

export type ModelCameraState = {
  orbit?: ModelCameraOrbit;
  target?: ModelCameraTarget;
  fovDeg?: number;
};

export type ModelViewerCameraLike = {
  cameraOrbit?: unknown;
  cameraTarget?: unknown;
  fieldOfView?: unknown;
  getCameraOrbit?: () => unknown;
  getCameraTarget?: () => unknown;
  getFieldOfView?: () => unknown;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const pickNumber = (value: any, keys: string[]): number | null => {
  for (const key of keys) {
    const candidate = value?.[key];
    if (isFiniteNumber(candidate)) return candidate;
  }
  return null;
};

const readOrbit = (value: unknown): ModelCameraOrbit | null => {
  if (!value || typeof value !== 'object') return null;
  const theta = pickNumber(value, ['theta', 'x', 'yaw']);
  const phi = pickNumber(value, ['phi', 'y', 'pitch']);
  const radius = pickNumber(value, ['radius', 'z', 'roll']);
  if (theta == null || phi == null || radius == null) return null;
  return { theta, phi, radius };
};

const readTarget = (value: unknown): ModelCameraTarget | null => {
  if (!value || typeof value !== 'object') return null;
  const x = pickNumber(value, ['x', 'theta', 'yaw']);
  const y = pickNumber(value, ['y', 'phi', 'pitch']);
  const z = pickNumber(value, ['z', 'radius', 'roll']);
  if (x == null || y == null || z == null) return null;
  return { x, y, z };
};

export const normaliseFovDeg = (value: unknown): number | null => {
  if (isFiniteNumber(value)) {
    const deg = value < 3.2 ? (value * 180) / Math.PI : value;
    if (!Number.isFinite(deg) || deg <= 0 || deg >= 180) return null;
    return deg;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    const match = trimmed.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const numeric = Number(match[0]);
    if (!Number.isFinite(numeric)) return null;
    if (trimmed.includes('rad')) {
      const deg = (numeric * 180) / Math.PI;
      if (!Number.isFinite(deg) || deg <= 0 || deg >= 180) return null;
      return deg;
    }
    if (trimmed.includes('deg')) {
      if (numeric <= 0 || numeric >= 180) return null;
      return numeric;
    }
    const deg = numeric < 3.2 ? (numeric * 180) / Math.PI : numeric;
    if (!Number.isFinite(deg) || deg <= 0 || deg >= 180) return null;
    return deg;
  }
  return null;
};

const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 1e6) / 1e6;
  return String(rounded);
};

export const formatOrbit = (orbit: ModelCameraOrbit): string =>
  `${formatNumber(orbit.theta)}rad ${formatNumber(orbit.phi)}rad ${formatNumber(
    orbit.radius,
  )}m`;

export const formatTarget = (target: ModelCameraTarget): string =>
  `${formatNumber(target.x)}m ${formatNumber(target.y)}m ${formatNumber(target.z)}m`;

export const formatFovDeg = (fovDeg: number): string => `${formatNumber(fovDeg)}deg`;

export const readCameraState = (viewer: ModelViewerCameraLike): ModelCameraState | null => {
  const orbit = readOrbit(viewer.getCameraOrbit?.() ?? viewer.cameraOrbit);
  const target = readTarget(viewer.getCameraTarget?.() ?? viewer.cameraTarget);
  const fovDeg = normaliseFovDeg(viewer.getFieldOfView?.() ?? viewer.fieldOfView);
  if (!orbit && !target && fovDeg == null) return null;
  return { orbit: orbit ?? undefined, target: target ?? undefined, fovDeg: fovDeg ?? undefined };
};

export const formatCameraState = (state: ModelCameraState | null): {
  cameraOrbit?: string;
  cameraTarget?: string;
  fieldOfView?: string;
} => {
  if (!state) return {};
  return {
    cameraOrbit: state.orbit ? formatOrbit(state.orbit) : undefined,
    cameraTarget: state.target ? formatTarget(state.target) : undefined,
    fieldOfView: state.fovDeg != null ? formatFovDeg(state.fovDeg) : undefined,
  };
};
