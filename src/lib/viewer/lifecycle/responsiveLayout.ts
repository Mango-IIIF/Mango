export const observeResponsiveLayout = ({
  root,
  breakpoint,
  wasMobile,
  onChange,
  onEnterMobile,
}: {
  root: HTMLElement | null;
  breakpoint: number;
  wasMobile: boolean;
  onChange: (isMobile: boolean) => void;
  onEnterMobile: () => void;
}): (() => void) => {
  if (!root) return () => undefined;
  let previous = wasMobile;
  // Measure the content-box inline size so this JS breakpoint agrees with the
  // CSS `@container mango-viewer (max-width: N)` query, which also resolves
  // against the content box. `clientWidth` includes horizontal padding, so the
  // two disagreed by exactly the container's padding — opening a padding-wide
  // window where the grid collapsed to one column (container query) while the
  // chrome stayed in desktop mode (this observer).
  const contentInlineSize = (): number => {
    const style = getComputedStyle(root);
    const padding =
      parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0");
    return root.clientWidth - (Number.isFinite(padding) ? padding : 0);
  };
  const evaluate = (inlineSize: number) => {
    const next = inlineSize <= breakpoint;
    if (next && !previous) onEnterMobile();
    previous = next;
    onChange(next);
  };
  evaluate(contentInlineSize());
  if (typeof ResizeObserver === "undefined") return () => undefined;
  const observer = new ResizeObserver((entries) => {
    const inline = entries[0]?.contentBoxSize?.[0]?.inlineSize;
    evaluate(typeof inline === "number" ? inline : contentInlineSize());
  });
  observer.observe(root);
  return () => observer.disconnect();
};
