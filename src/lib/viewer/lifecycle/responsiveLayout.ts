export const observeResponsiveLayout = ({
  root,
  breakpoint,
  wasMobile,
  onChange,
  onEnterMobile,
  blockBreakpoint,
  onBlockChange,
}: {
  root: HTMLElement | null;
  breakpoint: number;
  wasMobile: boolean;
  onChange: (isMobile: boolean) => void;
  onEnterMobile: () => void;
  blockBreakpoint?: number;
  onBlockChange?: (isShort: boolean) => void;
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
  const contentBlockSize = (): number => {
    const style = getComputedStyle(root);
    const padding =
      parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0");
    return root.clientHeight - (Number.isFinite(padding) ? padding : 0);
  };
  const evaluate = (inlineSize: number, blockSize: number) => {
    const next = inlineSize <= breakpoint;
    if (next && !previous) onEnterMobile();
    previous = next;
    onChange(next);
    if (typeof blockBreakpoint === "number") {
      onBlockChange?.(blockSize <= blockBreakpoint);
    }
  };
  evaluate(contentInlineSize(), contentBlockSize());
  if (typeof ResizeObserver === "undefined") return () => undefined;
  const observer = new ResizeObserver((entries) => {
    const inline = entries[0]?.contentBoxSize?.[0]?.inlineSize;
    const block = entries[0]?.contentBoxSize?.[0]?.blockSize;
    evaluate(
      typeof inline === "number" ? inline : contentInlineSize(),
      typeof block === "number" ? block : contentBlockSize(),
    );
  });
  observer.observe(root);
  return () => observer.disconnect();
};
