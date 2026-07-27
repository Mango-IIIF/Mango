import { mount, tick, unmount } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AudioRegionEditor from "../AudioRegionEditor.svelte";

const mocks = vi.hoisted(() => ({
  waveEvents: new Map<string, (...args: any[]) => void>(),
  regionEvents: new Map<string, (...args: any[]) => void>(),
  region: {
    start: 0,
    end: 0,
    drag: true,
    resize: true,
    setOptions: vi.fn(),
  },
  addRegion: vi.fn(),
  decodedDuration: 200,
  zoom: vi.fn(),
  setScrollTime: vi.fn(),
}));

vi.mock("wavesurfer.js/dist/plugins/regions.esm.js", () => ({
  default: {
    create: () => ({
      clearRegions: vi.fn(),
      addRegion: mocks.addRegion,
      on: (event: string, handler: (...args: any[]) => void) => {
        mocks.regionEvents.set(event, handler);
      },
    }),
  },
}));

vi.mock("wavesurfer.js", () => ({
  default: {
    create: () => ({
      on: (event: string, handler: (...args: any[]) => void) => {
        mocks.waveEvents.set(event, handler);
      },
      load: vi.fn(async () => {
        mocks.waveEvents.get("decode")?.(mocks.decodedDuration);
        mocks.waveEvents.get("ready")?.(mocks.decodedDuration);
      }),
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      zoom: mocks.zoom,
      setScrollTime: mocks.setScrollTime,
      empty: vi.fn(),
      destroy: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
    }),
  },
}));

describe("AudioRegionEditor", () => {
  beforeEach(() => {
    mocks.waveEvents.clear();
    mocks.regionEvents.clear();
    mocks.region.start = 0;
    mocks.region.end = 0;
    mocks.region.drag = true;
    mocks.region.resize = true;
    mocks.region.setOptions.mockReset();
    mocks.decodedDuration = 200;
    mocks.zoom.mockReset();
    mocks.setScrollTime.mockReset();
    mocks.addRegion.mockReset().mockImplementation((options) => {
      Object.assign(mocks.region, options);
      return mocks.region;
    });
  });

  it("creates a draggable region from the media start and end times", async () => {
    mocks.decodedDuration = 1985;
    const onChange = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const instance = mount(AudioRegionEditor, {
      target,
      props: {
        url: "https://example.org/manifest-audio.mp3",
        start: 170,
        end: 183,
        duration: 1985,
        onChange,
      },
    });

    await tick();
    await Promise.resolve();

    expect(mocks.addRegion).toHaveBeenCalledWith(
      expect.objectContaining({
        start: 170,
        end: 183,
        drag: true,
        resize: true,
        content: "Chapter selection",
      }),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    expect(mocks.zoom).toHaveBeenCalledWith(expect.any(Number));
    expect(mocks.setScrollTime).toHaveBeenCalledWith(expect.any(Number));
    expect(target.textContent).toContain("Show selection");

    mocks.region.start = 172;
    mocks.region.end = 185;
    mocks.regionEvents.get("region-updated")?.(mocks.region);
    expect(onChange).toHaveBeenCalledWith(172, 185, true);

    unmount(instance);
    target.remove();
  });
});
