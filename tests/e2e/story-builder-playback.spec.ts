import { expect, test } from "@playwright/test";

test("reader preserves the same IIIF chapter region on desktop, tablet, and phone", async ({
  page,
}) => {
  const saved = { x: 4333, y: 6393, w: 2494, h: 1245 };
  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/index.html?iiif-content=test-story/demo.json");
    const viewer = page.locator("mango-viewer");
    await viewer.locator('[data-testid="story-controls-page-6"]').click();
    await expect(viewer.locator('.story-shell__title')).toHaveText('Chapter 6');
    const pause = viewer.getByRole('button', { name: 'Pause', exact: true });
    if (await pause.isVisible()) await pause.click();

    await expect
      .poll(() =>
        viewer.evaluate((element: any) => {
          const current = element.getViewBox?.();
          if (!current) return Number.POSITIVE_INFINITY;
          const expected = { x: 4333, y: 6393, w: 2494, h: 1245 };
          return Math.max(
            Math.abs(Math.round(current.x) - expected.x),
            Math.abs(Math.round(current.y) - expected.y),
            Math.abs(Math.round(current.w) - expected.w),
            Math.abs(Math.round(current.h) - expected.h),
          );
        }),
      )
      .toBeLessThanOrEqual(2);

    const surfaceBox = await viewer
      .locator('[data-testid="story-stage-surface"]')
      .boundingBox();
    expect(surfaceBox).not.toBeNull();
    expect(surfaceBox!.width / surfaceBox!.height).toBeCloseTo(saved.w / saved.h, 2);
  }
});

test("keeps viewer zoom shortcuts scoped away from story metadata fields", async ({
  page,
}) => {
  await page.goto("/story-builder.html?iiif-content=test-story/demo.json");
  await page.getByRole("button", { name: "Story settings", exact: true }).click();

  const title = page.getByTestId("story-title");
  await title.fill("");
  await title.pressSequentially("A+B-C");
  await expect(title).toHaveValue("A+B-C");

  const stage = page.getByRole("application", { name: "Viewer stage" });
  await stage.focus();
  const viewer = page.locator("mango-viewer");
  const viewBefore = await viewer.evaluate((element: any) => element.getViewBox());
  await stage.press("+");
  await expect
    .poll(() => viewer.evaluate((element: any) => element.getViewBox()))
    .not.toEqual(viewBefore);
});

test("previews saved chapter motion without showing authoring frames", async ({
  page,
}) => {
  await page.goto("/story-builder.html?iiif-content=test-story/demo.json");
  await page.locator('[data-testid="inspector-group-timing"]').click();
  const motionTask = page.locator('[data-testid="inspector-activate-motion"]');
  await expect(motionTask).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("mango-viewer")
        .evaluate((element: any) => element.getViewBox()),
    )
    .not.toBeNull();
  await page.locator("mango-viewer").evaluate((element: any) => {
    const view = element.getViewBox();
    element.setViewBox({
      x: view.x + view.w * 0.2,
      y: view.y + view.h * 0.2,
      w: view.w * 0.6,
      h: view.h * 0.6,
    });
  });
  await page.waitForTimeout(300);
  await motionTask.click();

  // Capture two deliberately different views. Camera points are represented
  // by stable pins and timeline entries; rectangular keyframe overlays were
  // removed from the motion workflow.
  const addPoint = page.getByRole("button", {
    name: "Add camera point",
    exact: true,
  });
  await addPoint.click();
  await expect(page.locator(".story-wide-authoring__point")).toHaveCount(1);
  await page.locator("mango-viewer").evaluate((element: any) => {
    const view = element.getViewBox();
    element.setViewBox({
      x: view.x + view.w * 0.15,
      y: view.y + view.h * 0.1,
      w: view.w * 0.7,
      h: view.h * 0.7,
    });
  });
  await page.waitForTimeout(300);
  await addPoint.click();
  await expect(page.locator(".story-wide-authoring__point")).toHaveCount(2);
  await expect(page.locator(".story-builder-motion-marker--selected")).toHaveCount(1);
  await page.locator('[data-testid="inspector-done-motion"]').click();
  await expect(page.locator(".story-wide-authoring")).toHaveCount(0);
  // Out of the motion tool every editing object leaves the fixed output stage.
  await expect(page.locator(".story-frame--keyframe")).toHaveCount(0);
  await expect(page.locator(".story-frame--chapter")).toHaveCount(0);

  const viewer = page.locator("mango-viewer");
  const viewBeforePreview = await viewer.evaluate((element: any) =>
    element.getViewBox(),
  );
  await page
    .getByRole("button", { name: "Preview story", exact: true })
    .click();
  // Nothing is drawn on the stage while the preview drives it.
  await expect(page.locator(".story-frame")).toHaveCount(0);

  await expect
    .poll(() => viewer.evaluate((element: any) => element.getViewBox()), {
      timeout: 5_000,
      message: "expected the saved camera motion to change the preview view",
    })
    .not.toEqual(viewBeforePreview);

  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
});
