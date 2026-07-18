export type ViewerFullscreenState = {
  active: boolean;
  fallback: boolean;
};

export type ViewerFullscreenController = {
  toggle: () => Promise<void>;
  attach: () => () => void;
};

const allowsTouchInteraction = (target: EventTarget): boolean =>
  target instanceof Element &&
  (target.classList.contains("gallery__list") ||
    target.classList.contains("panel-stack--left") ||
    target.classList.contains("stage-gallery-view") ||
    target.classList.contains("osd") ||
    target.classList.contains("osd__viewport") ||
    target.classList.contains("openseadragon-canvas"));

export const createViewerFullscreenController = ({
  getRoot,
  getShadowHost,
  onChange,
}: {
  getRoot: () => HTMLElement | null;
  getShadowHost: () => Element | null;
  onChange: (state: ViewerFullscreenState) => void;
}): ViewerFullscreenController => {
  let fallback = false;
  let restoreDocumentOverflow: (() => void) | null = null;

  const isNativeActive = (): boolean => {
    const root = getRoot();
    if (!root || typeof document === "undefined") return false;
    const rootNode = root.getRootNode();
    const shadowFullscreenElement =
      rootNode instanceof ShadowRoot ? rootNode.fullscreenElement : null;
    return (
      document.fullscreenElement === root ||
      document.fullscreenElement === getShadowHost() ||
      shadowFullscreenElement === root
    );
  };

  const notify = () =>
    onChange({ active: fallback || isNativeActive(), fallback });

  const setFallback = (active: boolean): void => {
    if (typeof document === "undefined") return;
    restoreDocumentOverflow?.();
    restoreDocumentOverflow = null;
    fallback = active;
    if (active) {
      const previousBodyOverflow = document.body.style.overflow;
      const previousRootOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      restoreDocumentOverflow = () => {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousRootOverflow;
      };
    }
    notify();
  };

  const toggle = async (): Promise<void> => {
    if (typeof document === "undefined") return;
    if (fallback) {
      setFallback(false);
      return;
    }
    if (isNativeActive()) {
      await document.exitFullscreen?.();
      notify();
      return;
    }
    const root = getRoot();
    if (!root) return;
    if (root.requestFullscreen && document.fullscreenEnabled !== false) {
      try {
        await root.requestFullscreen({ navigationUI: "hide" });
        notify();
        if (!isNativeActive()) setFallback(true);
        return;
      } catch {
        setFallback(true);
        return;
      }
    }
    setFallback(true);
  };

  const guardDrag = (event: TouchEvent | PointerEvent): void => {
    if (!(fallback || isNativeActive())) return;
    if ("pointerType" in event && event.pointerType !== "touch") return;
    if (!event.composedPath().some(allowsTouchInteraction))
      event.preventDefault();
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !fallback) return;
    event.preventDefault();
    setFallback(false);
  };

  const attach = (): (() => void) => {
    if (typeof document === "undefined") return () => undefined;
    const root = getRoot();
    notify();
    document.addEventListener("fullscreenchange", notify);
    document.addEventListener("keydown", handleKeydown, { capture: true });
    root?.addEventListener("touchmove", guardDrag, {
      capture: true,
      passive: false,
    });
    root?.addEventListener("pointermove", guardDrag, { capture: true });
    return () => {
      document.removeEventListener("fullscreenchange", notify);
      document.removeEventListener("keydown", handleKeydown, { capture: true });
      root?.removeEventListener("touchmove", guardDrag, { capture: true });
      root?.removeEventListener("pointermove", guardDrag, { capture: true });
      setFallback(false);
    };
  };

  return { toggle, attach };
};
