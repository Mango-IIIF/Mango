import { expect, test, type Locator } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */

const settled = async (viewer: Locator) => {
  await expect
    .poll(async () => viewer.evaluate((element: any) => element.getCanvasCount()), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
};

const state = (viewer: Locator) =>
  viewer.evaluate((element: any) => ({
    index: element.getCanvasIndex(),
    count: element.getCanvasCount(),
    zoom: element.getZoom(),
    viewBox: element.getViewBox(),
  }));

/**
 * Wait for the viewport to stop moving before measuring it.
 *
 * The initial framing is re-applied while the container size settles, and
 * these embeds pull tiles from live image services — under a loaded CI machine
 * that can take a while. Sampling on a fixed delay makes the geometry
 * assertions race the settle loop; wait for two identical samples instead.
 */
const settledViewBox = async (viewer: Locator) => {
  let previous = "";
  await expect
    .poll(
      async () => {
        const box = await viewer.evaluate((element: any) => element.getViewBox());
        const signature = box
          ? [box.x, box.y, box.w, box.h].map((n) => Number(n).toFixed(2)).join(":")
          : "";
        const stable = Boolean(signature) && signature === previous;
        previous = signature;
        return stable;
      },
      { timeout: 30_000, intervals: [250] },
    )
    .toBe(true);

  return (await state(viewer)).viewBox!;
};

test.describe("embed host API", () => {
  test("opens on the canvas and region named by the config attribute", async ({
    page,
  }) => {
    await page.goto("/embed-third-party.html");
    const viewer = page.locator("#deep-link-viewer");
    await settled(viewer);

    // The AV controller announces its own first canvas while the manifest
    // loads. Adopting that used to discard config.initialCanvasIndex and drop
    // the embed back to page 1.
    await expect
      .poll(async () => (await state(viewer)).index, { timeout: 15_000 })
      .toBe(6);

    const view = await state(viewer);
    expect(view.count).toBe(36);
    // initialViewBox frames a 1900-wide region, so the embed must not be
    // sitting at fit-to-view.
    expect(view.zoom).toBeGreaterThan(120);
    expect(view.viewBox!.w).toBeLessThan(2411);
  });

  test("honours the configured region on other collections", async ({ page }) => {
    await page.goto("/embed-third-party.html");

    // The startup centering pass used to pull a configured framing back to the
    // middle of the image, keeping the zoom but discarding the position.
    const cases = [
      { id: "#harvard-viewer", x: 560, y: 880, w: 980, h: 800 },
      { id: "#yale-viewer", x: 700, y: 3900, w: 2200, h: 1800 },
    ];

    // Image-space pixels. Generous enough to ride out sub-pixel settling on a
    // slow machine, far tighter than the failure it guards: discarding the
    // position re-centres the view, which is wrong by hundreds of pixels.
    const tolerance = 40;

    for (const { id, x, y, w, h } of cases) {
      const viewer = page.locator(id);
      await settled(viewer);
      const box = await settledViewBox(viewer);

      // fitBounds grows the box on one axis to match the stage aspect, so
      // compare the centre the embed asked for rather than the raw edges.
      expect(Math.abs(box.x + box.w / 2 - (x + w / 2))).toBeLessThan(tolerance);
      expect(Math.abs(box.y + box.h / 2 - (y + h / 2))).toBeLessThan(tolerance);
    }
  });

  test("sets page, zoom, and position through the element methods", async ({
    page,
  }) => {
    await page.goto("/embed-third-party.html");
    const viewer = page.locator("#controlled-viewer");
    await settled(viewer);

    await viewer.evaluate((element: any) => element.setCanvasByIndex(6));
    await expect
      .poll(async () => (await state(viewer)).index, { timeout: 15_000 })
      .toBe(6);

    await viewer.evaluate((element: any) => element.setZoom(200));
    await expect
      .poll(async () => Math.round((await state(viewer)).zoom), { timeout: 15_000 })
      .toBe(200);

    // zoomIn/zoomOut step in round percentages from wherever the view is.
    await viewer.evaluate((element: any) => element.zoomIn());
    await expect
      .poll(async () => Math.round((await state(viewer)).zoom), { timeout: 15_000 })
      .toBe(210);

    await viewer.evaluate((element: any) => element.zoomOut());
    await expect
      .poll(async () => Math.round((await state(viewer)).zoom), { timeout: 15_000 })
      .toBe(200);

    // panTo recentres vertically at the current zoom; horizontal movement is
    // clamped by the image edges on a portrait scan.
    const before = await state(viewer);
    const centreY = (box: { y: number; h: number }) => box.y + box.h / 2;
    await viewer.evaluate((element: any) => element.panTo(1205, 2600));
    await expect
      .poll(async () => centreY((await state(viewer)).viewBox!), { timeout: 15_000 })
      .toBeGreaterThan(centreY(before.viewBox!));

    await viewer.evaluate((element: any) =>
      element.setViewBox({ x: 250, y: 500, w: 1900, h: 1300 }),
    );
    await expect
      .poll(async () => (await state(viewer)).viewBox!.w, { timeout: 15_000 })
      .toBeCloseTo(1900, 0);
  });

  test("host buttons drive the viewer and the readout follows", async ({
    page,
  }) => {
    await page.goto("/embed-third-party.html");
    const viewer = page.locator("#controlled-viewer");
    await settled(viewer);

    const deck = page.locator("#control-deck");
    await expect(deck.locator("button").first()).toBeEnabled({ timeout: 30_000 });

    await deck.locator("button", { hasText: "Go to page 7" }).click();
    await expect(page.locator("#readout-page")).toHaveText("7 of 36");

    await deck.locator("button", { hasText: "200%" }).first().click();
    await expect(page.locator("#readout-zoom")).toHaveText("200%");
  });
});
