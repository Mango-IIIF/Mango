import { expect, test, type Locator } from "@playwright/test";

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
 * Poll the vertical centre of the framed region.
 *
 * Vertical is the axis worth asserting: the bug being guarded here centred the
 * view on the whole image, and on a portrait scan that is hundreds of pixels
 * away from any configured region. Horizontally the two are near enough to each
 * other to prove nothing, because fitBounds clamps a region near the edge back
 * towards the middle.
 *
 * Polled rather than sampled once, and it deliberately asserts the goal instead
 * of waiting for the viewport to hold perfectly still: tiles stream in for a
 * while and the box keeps drifting fractionally long after it looks settled.
 */
const expectFramedOnY = async (
  viewer: Locator,
  centreY: number,
  tolerance: number,
) => {
  await expect
    .poll(
      async () => {
        const box = await viewer.evaluate((element: any) => element.getViewBox());
        if (!box) return Number.POSITIVE_INFINITY;
        return Math.abs(box.y + box.h / 2 - centreY);
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

    /*
     * Placement, not just zoom. The startup centering pass used to drag a
     * configured framing back to the middle of the image while keeping the zoom,
     * so the zoom assertions above would have passed with the bug present.
     *
     * The region is `y: 500, h: 1300`, so its centre sits at 1150. Centred on
     * the image instead it would be 1686 — a 536px error against the 40px
     * tolerance, which is what makes this worth asserting.
     *
     * This deliberately checks the Wellcome-backed embed rather than the other
     * collections on the page: their image services are not reliably reachable
     * from CI, and a test that cannot load tiles guards nothing. See the note in
     * the demo page about which embeds are covered here.
     */
    await expectFramedOnY(viewer, 500 + 1300 / 2, 40);
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
