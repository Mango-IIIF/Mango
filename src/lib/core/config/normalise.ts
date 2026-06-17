import type { ViewerConfig } from '../types/config';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseViewerConfig = (
  value: string | ViewerConfig | undefined,
  onError?: (error: unknown) => void,
): ViewerConfig | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as ViewerConfig;
    } catch (error) {
      onError?.(error);
      return undefined;
    }
  }
  return value;
};

export const normaliseViewerConfig = (
  value?: ViewerConfig | null,
): ViewerConfig => {
  if (!isRecord(value)) return {};
  if (value.plugins === undefined) return value as ViewerConfig;
  if (!isRecord(value.plugins)) {
    return { ...(value as ViewerConfig), plugins: {} };
  }
  return value as ViewerConfig;
};
