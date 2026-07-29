import { afterEach, describe, expect, it, vi } from "vitest";

import { observeResponsiveLayout } from "../responsiveLayout";

describe("observeResponsiveLayout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tracks both content-box width and height changes", () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);

    const root = document.createElement("div");
    root.style.padding = "10px 20px";
    Object.defineProperties(root, {
      clientWidth: { configurable: true, value: 1240 },
      clientHeight: { configurable: true, value: 720 },
    });
    const onChange = vi.fn();
    const onBlockChange = vi.fn();
    const onEnterMobile = vi.fn();

    const stop = observeResponsiveLayout({
      root,
      breakpoint: 1024,
      blockBreakpoint: 500,
      wasMobile: false,
      onChange,
      onBlockChange,
      onEnterMobile,
    });

    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(onBlockChange).toHaveBeenLastCalledWith(false);
    expect(observe).toHaveBeenCalledWith(root);

    resizeCallback?.(
      [
        {
          contentBoxSize: [{ inlineSize: 800, blockSize: 400 }],
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );

    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(onBlockChange).toHaveBeenLastCalledWith(true);
    expect(onEnterMobile).toHaveBeenCalledTimes(1);

    resizeCallback?.(
      [
        {
          contentBoxSize: [{ inlineSize: 800, blockSize: 520 }],
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
    expect(onBlockChange).toHaveBeenLastCalledWith(false);
    expect(onEnterMobile).toHaveBeenCalledTimes(1);

    stop();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
