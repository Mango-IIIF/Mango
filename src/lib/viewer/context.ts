import { getContext, setContext } from "svelte";
import type { ViewerDerivedStores } from "./state/viewerDerived";
import type { ViewerStateStores } from "./state/viewerState";
import type { ViewerController } from "./state/viewerController";

export type ViewerSettingsLayout = "1x1" | "1x2" | "2x1" | "1x2-panel" | "2x2";
/**
 * Every selectable theme, in the order the settings panel offers them. Adding a
 * theme means adding it here, defining its `--viewer-*`/`--story-*` tokens in
 * ViewerLayout, and adding a `workspace.theme*` label to the locale catalogues.
 */
export const viewerSettingsThemes = [
  "dark",
  "light",
  "sepia",
  "midnight",
  "ringo",
] as const;

export type ViewerSettingsTheme = (typeof viewerSettingsThemes)[number];

export const isViewerSettingsTheme = (
  value: string | undefined | null,
): value is ViewerSettingsTheme =>
  !!value && (viewerSettingsThemes as readonly string[]).includes(value);

export type ViewerContext = {
  state: ViewerStateStores;
  derived: ViewerDerivedStores;
  controller: ViewerController;
  settings: {
    layout: ViewerSettingsLayout;
    theme: ViewerSettingsTheme;
    locale: string;
    layoutMode: "single" | "two-page" | "continuous" | "gallery";
  };
  readonly canDrawAnnotations: boolean;
  readonly annotationMode: "edit" | "create";
};

const VIEWER_CONTEXT_KEY = Symbol("mango-viewer-context");

export const setViewerContext = (context: ViewerContext): ViewerContext =>
  setContext(VIEWER_CONTEXT_KEY, context);

export const getViewerContext = (): ViewerContext => {
  const context = getContext<ViewerContext | undefined>(VIEWER_CONTEXT_KEY);
  if (!context) {
    throw new Error("Viewer context is unavailable outside a Mango viewer");
  }
  return context;
};
