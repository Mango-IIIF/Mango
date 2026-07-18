import { afterEach, describe, expect, it } from "vitest";
import { createViewerFullscreenController } from "../fullscreen";

describe("createViewerFullscreenController", () => {
  afterEach(() => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  });

  it("uses and cleans up the document-level fallback", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const states: Array<{ active: boolean; fallback: boolean }> = [];
    const controller = createViewerFullscreenController({
      getRoot: () => root,
      getShadowHost: () => null,
      onChange: (state) => states.push(state),
    });
    const detach = controller.attach();

    await controller.toggle();
    expect(states.at(-1)).toEqual({ active: true, fallback: true });
    expect(document.body.style.overflow).toBe("hidden");

    detach();
    expect(states.at(-1)).toEqual({ active: false, fallback: false });
    expect(document.body.style.overflow).toBe("");
    root.remove();
  });
});
