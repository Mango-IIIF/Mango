let cssText = '';

export function setCssText(text: string): void {
  cssText = text;
}

if (typeof window !== 'undefined') {
  (window as any).__setMangoViewerCss = setCssText;
}

export function injectViewerCss(host: HTMLElement, attempts = 12): void {
  const root = host && host.shadowRoot;
  if (!root) {
    if (attempts > 0) {
      requestAnimationFrame(() => injectViewerCss(host, attempts - 1));
    }
    return;
  }

  // Use Adopted Stylesheets if supported (immune to VDOM updates)
  if ('adoptedStyleSheets' in root && typeof CSSStyleSheet !== 'undefined') {
    const r = root as any;
    if (r.__mangoCssAdopted) return;
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(cssText);
      r.adoptedStyleSheets = [...r.adoptedStyleSheets, sheet];
      r.__mangoCssAdopted = true;
      return;
    } catch (e) {
      console.warn('[Browser Inject] CSSStyleSheet adoption failed, falling back:', e);
    }
  }

  // Fallback to style tag insertion
  const inject = () => {
    if (root.querySelector('style[data-mango-viewer-css]')) return;
    const style = document.createElement('style');
    style.dataset.mangoViewerCss = 'mango-viewer-css';
    style.textContent = cssText;
    root.prepend(style);
  };

  inject();

  const r = root as any;
  if (!r.__mangoCssObserver) {
    r.__mangoCssObserver = new MutationObserver(() => inject());
    r.__mangoCssObserver.observe(root, { childList: true });
  }
}
