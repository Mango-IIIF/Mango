import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createViewerFullscreenController,
  isIPadLikeDevice,
} from "../fullscreen";

describe("isIPadLikeDevice", () => {
  it("recognises classic and desktop-style iPadOS identities", () => {
    expect(
      isIPadLikeDevice({
        userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)",
        platform: "iPad",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
    expect(
      isIPadLikeDevice({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
    expect(
      isIPadLikeDevice({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});

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

  it("does not request native fullscreen when fallback is preferred", async () => {
    const root = document.createElement("div");
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(root, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    document.body.append(root);
    const states: Array<{ active: boolean; fallback: boolean }> = [];
    const controller = createViewerFullscreenController({
      getRoot: () => root,
      getShadowHost: () => null,
      preferFallback: () => true,
      onChange: (state) => states.push(state),
    });

    await controller.toggle();

    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(states.at(-1)).toEqual({ active: true, fallback: true });
    expect(document.body.style.overflow).toBe("hidden");
    root.remove();
  });
});
