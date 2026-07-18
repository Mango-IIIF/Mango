let cssText = "";
let adoptedSheet: CSSStyleSheet | null = null;
const roots = new Set<ShadowRoot>();
type MangoShadowRoot = ShadowRoot & {
  __mangoCssAdopted?: boolean;
  __mangoCssObserver?: MutationObserver;
};
type MangoWindow = Window &
  typeof globalThis & {
    __setMangoViewerCss?: typeof setCssText;
  };

export function setCssText(text: string): void {
  cssText = text;
  if (adoptedSheet) {
    try {
      adoptedSheet.replaceSync(cssText);
    } catch {
      adoptedSheet = null;
    }
  }
  roots.forEach((root) => applyCss(root));
}

if (typeof window !== "undefined") {
  (window as MangoWindow).__setMangoViewerCss = setCssText;
}

export function injectViewerCss(host: HTMLElement, attempts = 12): void {
  const root = host && host.shadowRoot;
  if (!root) {
    if (attempts > 0) {
      requestAnimationFrame(() => injectViewerCss(host, attempts - 1));
    }
    return;
  }

  roots.add(root);
  applyCss(root);
}

function applyCss(root: ShadowRoot): void {
  if (!cssText) return;

  // Use Adopted Stylesheets if supported (immune to VDOM updates)
  if ("adoptedStyleSheets" in root && typeof CSSStyleSheet !== "undefined") {
    const r = root as MangoShadowRoot;
    try {
      if (!adoptedSheet) {
        adoptedSheet = new CSSStyleSheet();
        adoptedSheet.replaceSync(cssText);
      }
      if (r.adoptedStyleSheets.includes(adoptedSheet)) return;
      r.adoptedStyleSheets = [...r.adoptedStyleSheets, adoptedSheet];
      r.__mangoCssAdopted = true;
      return;
    } catch (e) {
      console.warn(
        "[Browser Inject] CSSStyleSheet adoption failed, falling back:",
        e,
      );
    }
  }

  // Fallback to style tag insertion
  const inject = () => {
    if (root.querySelector("style[data-mango-viewer-css]")) return;
    const style = document.createElement("style");
    style.dataset.mangoViewerCss = "mango-viewer-css";
    style.textContent = cssText;
    root.prepend(style);
  };

  inject();

  const r = root as MangoShadowRoot;
  if (!r.__mangoCssObserver) {
    r.__mangoCssObserver = new MutationObserver(() => inject());
    r.__mangoCssObserver.observe(root, { childList: true });
  }
}
