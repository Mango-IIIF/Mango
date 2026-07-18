import { describe, expect, it, vi } from "vitest";
import type { ViewerApiTarget } from "../../../core/types/viewer-api";
import { ViewerApiAdapter } from "../ViewerApiAdapter";

describe("ViewerApiAdapter", () => {
  it("provides stable defaults before an entrypoint is mounted", async () => {
    const api = new ViewerApiAdapter(() => null);
    expect(api.getCanvasIndex()).toBe(-1);
    expect(api.getCanvasCount()).toBe(0);
    expect(api.getMediaSources()).toEqual([]);
    await expect(api.removeAnnotation("missing")).resolves.toBeUndefined();
  });

  it("forwards API calls to the current target", async () => {
    const removeAnnotation = vi.fn(async () => undefined);
    const target: ViewerApiTarget = {
      getCanvasCount: () => 4,
      removeAnnotation,
    };
    const api = new ViewerApiAdapter(() => target);

    expect(api.getCanvasCount()).toBe(4);
    await api.removeAnnotation("anno-1");
    expect(removeAnnotation).toHaveBeenCalledWith("anno-1");
  });
});
