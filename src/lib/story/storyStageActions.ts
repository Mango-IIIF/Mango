/*
 * A bridge for stage controls that belong to the builder but are rendered by
 * the viewer layout.
 *
 * The "save this view" button sits in the stage toolbar, next to the zoom
 * controls the author is already using, but the thing it does — store the
 * framing on the selected chapter — belongs to the story builder controller,
 * which the layout has no reference to.
 *
 * Keyed on the element root rather than held in a module-level variable so
 * that two viewers on one page cannot capture into each other's stories.
 */
type CaptureHandler = () => void;

const handlers = new WeakMap<HTMLElement, CaptureHandler>();

export const registerStoryCapture = (
  root: HTMLElement | null,
  handler: CaptureHandler,
): (() => void) => {
  if (!root) return () => undefined;
  handlers.set(root, handler);
  return () => {
    if (handlers.get(root) === handler) handlers.delete(root);
  };
};

export const requestStoryCapture = (root: HTMLElement | null): void => {
  if (!root) return;
  handlers.get(root)?.();
};
