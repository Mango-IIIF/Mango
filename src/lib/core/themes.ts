/**
 * Canonical colour themes for the Mango ecosystem.
 *
 * Mango (`@mango-iiif/iiif-viewer`) owns the theme list, swatches, and
 * `--viewer-*` CSS tokens (`themes.css`). Host packages such as Lychee and
 * Papaya consume these directly so every surface shares one palette.
 */
export const VIEWER_THEMES = [
  { id: 'dark', background: '#0f141b', accent: '#2ac7ff' },
  { id: 'light', background: '#f3f5f8', accent: '#53719c' },
  { id: 'sepia', background: '#eee4d2', accent: '#a86f46' },
  { id: 'midnight', background: '#07111f', accent: '#a78bfa' },
] as const;

export type ViewerTheme = (typeof VIEWER_THEMES)[number]['id'];

export const VIEWER_THEME_IDS: readonly ViewerTheme[] = VIEWER_THEMES.map((theme) => theme.id);

export const isViewerTheme = (value: unknown): value is ViewerTheme =>
  typeof value === 'string' && VIEWER_THEMES.some((theme) => theme.id === value);

export const resolveViewerTheme = (value: string | undefined | null): ViewerTheme => {
  const normalized = value?.toLowerCase();
  return isViewerTheme(normalized) ? normalized : 'dark';
};
