// Monkey-patch customElements.define to prevent crashes during Hot Module Replacement (HMR)
// and patch lifecycle callbacks before the browser registers and caches them.
if (typeof window !== 'undefined' && window.customElements) {
  const originalDefine = window.customElements.define;
  window.customElements.define = function (name, constructor, options) {
    if (window.customElements.get(name)) {
      console.warn(`Custom element "${name}" is already registered. Ignoring re-registration during HMR.`);
      return;
    }

    if (name === 'mango-viewer') {
      const originalConnected = constructor.prototype.connectedCallback;
      constructor.prototype.connectedCallback = function (...args) {
        const result = originalConnected ? originalConnected.apply(this, args) : undefined;
        if (window.__injectMangoViewerCss) {
          window.__injectMangoViewerCss(this);
        }
        return result;
      };
    }

    return originalDefine.call(this, name, constructor, options);
  };
}
