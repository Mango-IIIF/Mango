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
 * Poll until the embed is framed on the region its config asked for.
 *
 * This deliberately asserts the goal rather than waiting for the viewport to
 * hold perfectly still. These embeds stream tiles from live image services, and
 * on a slow or loaded machine the box keeps drifting by a fraction long after it
 * is visually settled — an earlier version waited for two identical samples and
 * timed out in CI for that reason. Landing on the region is what the fix
 * guarantees; absolute stillness is not.
 */
const expectFramedOn = async (
  viewer: Locator,
  region: { x: number; y: number; w: number; h: number },
  tolerance: number,
) => {
  await expect
    .poll(
      async () => {
        const box = await viewer.evaluate((element: any) => element.getViewBox());
        if (!box) return Number.POSITIVE_INFINITY;
        // fitBounds grows the box on one axis to match the stage aspect, so the
        // centre is the part the embed actually controls.
        return Math.max(
          Math.abs(box.x + box.w / 2 - (region.x + region.w / 2)),
          Math.abs(box.y + box.h / 2 - (region.y + region.h / 2)),
        );
      },
      { timeout: 30_000, intervals: [250] },
    )
    .toBeLessThan(tolerance);
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

    // initialViewBox frames a 1900-wide region, so the embed must not be
    // sitting at fit-to-view. Polled rather than sampled once: the framing lands
    // a moment after the canvas count does, and more slowly on a cold runner.
    await expect
      .poll(async () => (await state(viewer)).zoom, { timeout: 20_000 })
      .toBeGreaterThan(120);
    await expect
      .poll(
        async () => (await state(viewer)).viewBox?.w ?? Number.POSITIVE_INFINITY,
        { timeout: 20_000 },
      )
      .toBeLessThan(2411);

    expect((await state(viewer)).count).toBe(36);
  });

  test("honours the configured region on other collections", async ({ page }) => {
    // Two embeds, each waiting on a different institution's image service. The
    // default per-test budget is not enough for that on a cold CI runner.
    test.setTimeout(150_000);
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

    for (const { id, ...region } of cases) {
      const viewer = page.locator(id);
      await settled(viewer);
      await expectFramedOn(viewer, region, tolerance);
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
