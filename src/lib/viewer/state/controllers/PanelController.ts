/**
 * PanelController
 *
 * Manages panel visibility and state, including enforcement of single left panel rule.
 * Handles panel permissions and panel toggle events.
 */

import { derived, get } from "svelte/store";
import type { ViewerStateStores } from "../viewerState";
import type { ViewerDerivedStores } from "../viewerDerived";
import type { ViewerEventEmitter } from "../../../core/types/events";

export type ViewerPanel =
  | "thumbnails"
  | "collection"
  | "contents"
  | "search"
  | "metadata"
  | "annotations"
  | "tools"
  | "settings"
  | "layers";

export type PanelControllerConfig = {
  state: ViewerStateStores;
  derived: ViewerDerivedStores;
  emitEvent: ViewerEventEmitter;
  emitStateChange: () => void;
  initialOpen?: boolean;
  initialActivePanel?: string;
};

export type PanelController = {
  setPanelOpen: (panel: ViewerPanel, open: boolean) => void;
  setupPanelEffects: () => (() => void)[];
};

export const createPanelController = ({
  state,
  derived: derivedStores,
  emitEvent,
  emitStateChange,
  initialOpen = true,
  initialActivePanel = "metadata",
}: PanelControllerConfig): PanelController => {
  const leftPanelOrder: ViewerPanel[] = [
    "collection",
    "contents",
    "annotations",
    "tools",
    "settings",
    "search",
    "metadata",
    "layers",
    "thumbnails",
  ];

  /* Thumbnails are a sidebar panel only when configured so; otherwise a strip that sits alongside any panel. */
  const thumbnailsInSidebar = (): boolean =>
    get(derivedStores.thumbnailsInSidebar);
  const leftPanels = (): ViewerPanel[] =>
    thumbnailsInSidebar()
      ? leftPanelOrder
      : leftPanelOrder.filter((panel) => panel !== "thumbnails");

  const configuredInitialPanel = leftPanelOrder.includes(
    initialActivePanel as ViewerPanel,
  )
    ? (initialActivePanel as ViewerPanel)
    : "metadata";
  let lastOpenedLeftPanel: ViewerPanel | null = configuredInitialPanel;
  let awaitingInitialPanel = initialOpen;

  const leftPanelStores: Partial<
    Record<ViewerPanel, typeof state.showContents>
  > = {
    collection: state.showCollection,
    contents: state.showContents,
    annotations: state.showAnnotations,
    tools: state.showTools,
    search: state.showSearch,
    metadata: state.showMetadata,
    settings: state.showSettings,
    layers: state.showLayers,
    thumbnails: state.showThumbnails,
  };

  const isLeftPanel = (
    panel: ViewerPanel,
  ): boolean => panel !== "thumbnails" || thumbnailsInSidebar();

  const leftPanelAllowed = (panel: ViewerPanel): boolean => {
    if (get(state.config)?.sidebar?.enabled === false) return false;
    switch (panel) {
      case "collection":
        return get(derivedStores.allowCollection);
      case "contents":
        return get(derivedStores.contentsAvailable);
      case "annotations":
        return get(derivedStores.allowAnnotations);
      case "tools":
        return get(derivedStores.allowTools);
      case "search":
        return get(derivedStores.allowSearch);
      case "metadata":
        return get(derivedStores.allowMetadata);
      case "layers":
        return get(derivedStores.allowLayers);
      case "settings":
        return get(state.config)?.showSettings !== false;
      case "thumbnails":
        return thumbnailsInSidebar() && get(derivedStores.allowThumbnails);
      default:
        return false;
    }
  };

  const hasOpenLeftPanel = (): boolean =>
    leftPanels().some((panel) => {
      const store = leftPanelStores[panel];
      return store ? get(store) : false;
    });

  const resolveActiveLeftPanel = (
    preferred?: ViewerPanel | null,
    useFallback = true,
  ): ViewerPanel | null => {
    if (preferred && isLeftPanel(preferred) && leftPanelAllowed(preferred)) {
      return preferred;
    }

    const openAndAllowed = leftPanels().find((panel) => {
      const store = leftPanelStores[panel];
      if (!store) return false;
      return get(store) && leftPanelAllowed(panel);
    });
    if (openAndAllowed) return openAndAllowed;

    if (!useFallback) return null;

    const firstAllowed = leftPanels().find((panel) =>
      leftPanelAllowed(panel),
    );
    return firstAllowed ?? null;
  };

  const enforceSingleLeftPanel = (
    preferred?: ViewerPanel | null,
    useFallback = true,
  ) => {
    const target = resolveActiveLeftPanel(preferred, useFallback);

    leftPanels().forEach((panel) => {
      const store = leftPanelStores[panel];
      if (!store) return;
      const shouldOpen = target === panel;
      if (get(store) !== shouldOpen) {
        store.set(shouldOpen);
      }
    });

    if (target && isLeftPanel(target)) {
      lastOpenedLeftPanel = target;
    }
  };

  // Initialize panel state. A configured panel may become available after the manifest loads.
  if (initialOpen && leftPanelAllowed(configuredInitialPanel)) {
    enforceSingleLeftPanel(configuredInitialPanel);
    awaitingInitialPanel = false;
  } else {
    enforceSingleLeftPanel(null, false);
  }

  const setPanelOpen = (panel: ViewerPanel, open: boolean) => {
    if (!isLeftPanel(panel)) {
      state.showThumbnails.set(open);
    } else {
      const store = leftPanelStores[panel];
      if (open) {
        lastOpenedLeftPanel = panel;
        enforceSingleLeftPanel(panel);
      } else if (store) {
        store.set(false);
      }
    }

    emitEvent("panelToggle", { panel, open });
    emitStateChange();
  };

  const setupPanelEffects = (): (() => void)[] => {
    const unsubscribers: Array<() => void> = [];

    // Sync panel visibility updates with the single left panel rule
    leftPanelOrder.forEach((panel) => {
      const store = leftPanelStores[panel];
      if (!store) return;
      unsubscribers.push(
        store.subscribe((open) => {
          if (open && isLeftPanel(panel)) {
            if (lastOpenedLeftPanel !== panel) {
              lastOpenedLeftPanel = panel;
              enforceSingleLeftPanel(panel);
            }
          }
        }),
      );
    });

    // Enforce single left panel when permissions change
    const leftPanelGuard = derived(
      [
        derivedStores.allowCollection,
        derivedStores.allowAnnotations,
        derivedStores.allowSearch,
        derivedStores.allowMetadata,
        derivedStores.allowTools,
        derivedStores.contentsAvailable,
        derivedStores.allowLayers,
        derivedStores.allowThumbnails,
        derivedStores.thumbnailsInSidebar,
      ],
      () => {
        if (awaitingInitialPanel && leftPanelAllowed(configuredInitialPanel)) {
          enforceSingleLeftPanel(configuredInitialPanel, false);
          awaitingInitialPanel = false;
          return;
        }
        enforceSingleLeftPanel(
          hasOpenLeftPanel() ? lastOpenedLeftPanel : null,
          false,
        );
      },
    );
    unsubscribers.push(leftPanelGuard.subscribe(() => undefined));

    return unsubscribers;
  };

  return {
    setPanelOpen,
    setupPanelEffects,
  };
};
