import { getContext, setContext } from "svelte";
import type { ViewerDerivedStores } from "./state/viewerDerived";
import type { ViewerStateStores } from "./state/viewerState";
import type { ViewerController } from "./state/viewerController";

export type ViewerSettingsLayout = "1x1" | "1x2" | "2x1" | "2x2";

export type ViewerContext = {
  state: ViewerStateStores;
  derived: ViewerDerivedStores;
  controller: ViewerController;
  settings: {
    layout: ViewerSettingsLayout;
    theme: "dark" | "light";
    locale: string;
    layoutMode: "single" | "two-page" | "continuous" | "gallery";
  };
  readonly canDrawAnnotations: boolean;
  readonly annotationMode: "edit" | "create";
};

export const VIEWER_CONTEXT_KEY = Symbol("mango-viewer-context");

export const setViewerContext = (context: ViewerContext): ViewerContext =>
  setContext(VIEWER_CONTEXT_KEY, context);

export const getViewerContext = (): ViewerContext => {
  const context = getContext<ViewerContext | undefined>(VIEWER_CONTEXT_KEY);
  if (!context) {
    throw new Error("Viewer context is unavailable outside a Mango viewer");
  }
  return context;
};
