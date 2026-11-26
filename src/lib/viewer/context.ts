import { getContext, setContext } from "svelte";
import type { ViewerDerivedStores } from "./state/viewerDerived";
import type { ViewerStateStores } from "./state/viewerState";
import type { ViewerController } from "./state/viewerController";
import {
  VIEWER_THEME_IDS,
  isViewerTheme,
  type ViewerTheme,
} from "../core/themes";

export type ViewerSettingsLayout = "1x1" | "1x2" | "2x1" | "1x2-panel" | "2x2";
/**
 * Every selectable theme, in the order the settings panel offers them. Defined
 * once in `core/themes.ts` alongside the canonical CSS tokens in `core/themes.css`.
 */
export const viewerSettingsThemes = VIEWER_THEME_IDS;

export type ViewerSettingsTheme = ViewerTheme;

export const isViewerSettingsTheme = isViewerTheme;

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
