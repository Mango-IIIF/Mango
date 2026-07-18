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
  const update = () => {
    const next = root.clientWidth <= breakpoint;
    if (next && !previous) onEnterMobile();
    previous = next;
    onChange(next);
  };
  update();
  if (typeof ResizeObserver === "undefined") return () => undefined;
  const observer = new ResizeObserver(update);
  observer.observe(root);
  return () => observer.disconnect();
};
