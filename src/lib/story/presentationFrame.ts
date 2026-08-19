/** The element story-stage actions are keyed on, found from any descendant. */
export const findPresentationRoot = (node: Element | null): HTMLElement | null => {
  if (!node) return null;
  const root = node.closest('.element-root');
  return root instanceof HTMLElement ? root : null;
};
