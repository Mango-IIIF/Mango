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
  await expect(viewer.locator(".panel-stack--left")).toHaveCSS("display", "none");
  await expect(viewer.locator(".panel-stack--right")).toHaveCSS("display", "none");
  await expect(viewer.locator(".stage__bottom")).toHaveCSS("display", "none");
  await expect(viewer.locator(".stage__toolbar--below")).toHaveCSS("display", "none");

  await expect
    .poll(() => viewer.evaluate((element: any) => element.getViewBox()), {
      timeout: 5_000,
      message: "expected the saved camera motion to change the preview view",
    })
    .not.toEqual(viewBeforePreview);

  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
});

test("authors stable diagonal motion with independent pin position and zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/story-builder.html?iiif-content=test-story/demo.json");
  const viewer = page.locator("mango-viewer");
  await viewer.locator('[data-testid="inspector-group-timing"]').click();
  const motionTask = viewer.locator('[data-testid="inspector-activate-motion"]');
  await expect(motionTask).toBeVisible();
  await expect.poll(() => viewer.evaluate((element: any) => element.getViewBox())).not.toBeNull();
  await motionTask.click();

  const initialView = await viewer.evaluate((element: any) => element.getViewBox());
  const addPoint = viewer.getByRole("button", { name: "Add camera point", exact: true });
  await addPoint.click();
  const marker = viewer.locator(".story-builder-motion-marker").first();
  await expect(marker).toBeVisible();
  await expect(marker).not.toHaveAttribute("title");
  await expect(viewer.locator(".story-wide-authoring__point-delete")).toHaveCount(0);
  const deleteSelected = viewer.getByTestId("motion-delete-selected");
  await expect(deleteSelected).toBeVisible();
  const [timelineBox, deleteBox] = await Promise.all([
    viewer.locator(".story-wide-authoring__timeline").boundingBox(),
    deleteSelected.boundingBox(),
  ]);
  expect(timelineBox && deleteBox).toBeTruthy();
  if (!timelineBox || !deleteBox) return;
  expect(Math.abs(timelineBox.x + timelineBox.width - (deleteBox.x + deleteBox.width))).toBeLessThanOrEqual(12);
  expect(Math.abs(timelineBox.y + timelineBox.height - (deleteBox.y + deleteBox.height))).toBeLessThanOrEqual(2);

  const beforeHover = await marker.boundingBox();
  expect(beforeHover).toBeTruthy();
  if (!beforeHover) return;
  await page.mouse.move(beforeHover.x + beforeHover.width / 2, beforeHover.y + beforeHover.height / 2);
  await page.mouse.move(beforeHover.x + beforeHover.width / 2 + 3, beforeHover.y + beforeHover.height / 2 + 2);
  const afterHover = await marker.boundingBox();
  expect(afterHover).toBeTruthy();
  if (!afterHover) return;
  expect(Math.abs(afterHover.x - beforeHover.x)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(afterHover.y - beforeHover.y)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(afterHover.width - beforeHover.width)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(afterHover.height - beforeHover.height)).toBeLessThanOrEqual(0.5);

  const overlay = viewer.locator(".story-builder-overlay-root");
  const overlayBox = await overlay.boundingBox();
  expect(overlayBox).toBeTruthy();
  if (!overlayBox) return;
  await page.mouse.move(beforeHover.x + beforeHover.width / 2, beforeHover.y + beforeHover.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    overlayBox.x + overlayBox.width * 0.2,
    overlayBox.y + overlayBox.height * 0.75,
    { steps: 8 },
  );
  // The marker must visibly follow while the button is still held; checking
  // only after mouse-up would miss the original release-only rendering bug.
  const heldMarkerBox = await marker.boundingBox();
  expect(heldMarkerBox).toBeTruthy();
  if (!heldMarkerBox) return;
  expect(heldMarkerBox.x).toBeLessThan(beforeHover.x - overlayBox.width * 0.15);
  expect(heldMarkerBox.y).toBeGreaterThan(beforeHover.y + overlayBox.height * 0.15);
  await page.mouse.up();

  const firstBeforeZoom = await viewer.evaluate((element: any) =>
    element.getStory().chapters[0].cameraTrack.keyframes[0],
  );
  const centredHalfView = {
    x: initialView.x + initialView.w * 0.25,
    y: initialView.y + initialView.h * 0.25,
    w: initialView.w * 0.5,
    h: initialView.h * 0.5,
  };
  await viewer.evaluate((element: any, next) => element.setViewBox(next), centredHalfView);
  await expect.poll(() => viewer.evaluate((element: any) => element.getViewBox().w)).toBeLessThan(initialView.w * 0.7);
  await viewer.locator('[data-testid="motion-save-zoom"]').click();

  const firstAfterZoom = await viewer.evaluate((element: any) =>
    element.getStory().chapters[0].cameraTrack.keyframes[0],
  );
  expect(firstAfterZoom.focus.x).toBeCloseTo(firstBeforeZoom.focus.x, 5);
  expect(firstAfterZoom.focus.y).toBeCloseTo(firstBeforeZoom.focus.y, 5);
  expect(firstAfterZoom.viewBox.x + firstAfterZoom.viewBox.w / 2).toBeCloseTo(firstAfterZoom.focus.x, 5);
  expect(firstAfterZoom.viewBox.y + firstAfterZoom.viewBox.h / 2).toBeCloseTo(firstAfterZoom.focus.y, 5);
  expect(firstAfterZoom.viewBox.w).toBeLessThan(firstBeforeZoom.viewBox.w);

  await addPoint.click();
  await expect(viewer.locator(".story-wide-authoring__point")).toHaveCount(2);
  const secondMarker = viewer.locator(".story-builder-motion-marker--selected");
  const secondBox = await secondMarker.boundingBox();
  expect(secondBox).toBeTruthy();
  if (!secondBox) return;
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    overlayBox.x + overlayBox.width * 0.8,
    overlayBox.y + overlayBox.height * 0.2,
    { steps: 8 },
  );
  await page.mouse.up();

  const centredThirdView = {
    x: initialView.x + initialView.w * 0.35,
    y: initialView.y + initialView.h * 0.35,
    w: initialView.w * 0.3,
    h: initialView.h * 0.3,
  };
  await viewer.evaluate((element: any, next) => element.setViewBox(next), centredThirdView);
  await expect.poll(() => viewer.evaluate((element: any) => element.getViewBox().w)).toBeLessThan(initialView.w * 0.45);
  await viewer.locator('[data-testid="motion-save-zoom"]').click();

  const authored = await viewer.evaluate((element: any) => element.getStory().chapters[0].cameraTrack);
  expect(authored.keyframes[1].focus.x).toBeGreaterThan(authored.keyframes[0].focus.x);
  expect(authored.keyframes[1].focus.y).toBeLessThan(authored.keyframes[0].focus.y);
  expect(authored.keyframes[1].viewBox.w).toBeLessThan(authored.keyframes[0].viewBox.w);

  await viewer.getByRole("tab", { name: "Options", exact: true }).click();
  const fineTuning = viewer.locator(".motion-panel__fine-tuning");
  const options = viewer.locator(".motion-panel__options");
  await fineTuning.locator("summary").click();
  const [fineBox, optionsBox] = await Promise.all([fineTuning.boundingBox(), options.boundingBox()]);
  expect(fineBox && optionsBox).toBeTruthy();
  if (!fineBox || !optionsBox) return;
  expect(fineBox.width).toBeGreaterThan(optionsBox.width * 0.9);
  const tuningCards = fineTuning.locator(".motion-panel__fine-tuning-grid > section");
  await expect(tuningCards).toHaveCount(3);
  const cardTops = await tuningCards.evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().top));
  expect(Math.max(...cardTops) - Math.min(...cardTops)).toBeLessThanOrEqual(2);

  const duration = viewer.getByTestId("motion-duration");
  await duration.fill("3");
  await duration.blur();
  await viewer.getByTestId("motion-preview-next-to-done").click();
  const viewerRoot = viewer.locator(".viewer");
  await expect(viewerRoot).toHaveClass(/viewer--story-preview/);
  await expect(viewer.locator(".panel-stack--left")).toHaveCSS("display", "none");
  await expect(viewer.locator(".panel-stack--right")).toHaveCSS("display", "none");
  await expect(viewer.locator(".stage__bottom")).not.toHaveCSS("display", "none");
  await expect(viewer.locator(".stage__toolbar--below")).toHaveCSS("display", "none");
  await expect(viewer.locator(".story-wide-authoring")).toHaveCount(0);
  const previewPinsToggle = viewer.getByTestId("motion-preview-pins-toggle");
  await expect(previewPinsToggle).toBeVisible();
  await expect(viewer.locator(".story-builder-motion-marker")).toHaveCount(0);
  await previewPinsToggle.click();
  // Pins outside the moving viewport are naturally clipped; every pin that
  // is currently in view is reference-only during preview.
  await expect(viewer.locator(".story-builder-motion-marker").first()).toBeDisabled();

  const centre = async () => viewer.evaluate((element: any) => {
    const box = element.getViewBox();
    return { x: box.x + box.w / 2, y: box.y + box.h / 2, w: box.w };
  });
  await page.waitForTimeout(250);
  const early = await centre();
  await page.waitForTimeout(550);
  const late = await centre();
  // OpenSeadragon's own camera spring can briefly lag behind the sampled
  // track, so assert real pan/zoom progress rather than a brittle per-frame
  // direction while that spring catches up.
  expect(Math.hypot(late.x - early.x, late.y - early.y)).toBeGreaterThan(10);
  expect(Math.abs(late.w - early.w)).toBeGreaterThan(10);

  await viewer.getByTestId("motion-preview-next-to-done").click();
  await expect(viewerRoot).not.toHaveClass(/viewer--story-preview/);
  await expect(viewer.locator(".panel-stack--left")).not.toHaveCSS("display", "none");
  await expect(viewer.locator(".stage__toolbar--below")).not.toHaveCSS("display", "none");
});
