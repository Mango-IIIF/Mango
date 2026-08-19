import { expect, test } from "@playwright/test";

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

test("lets the narration editor resize without clipping the viewer or its controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto("/story-builder.html?iiif-content=test-story/demo.json");
  await page.locator('[data-task-id="audio-timing"] button').click();

  const stage = page.locator(".stage--story-builder");
  const viewerFrame = stage.locator(".stage__primary");
  const narration = stage.locator(".story-wide-narration");
  const apply = narration.getByRole("button", { name: "Apply to chapter" });
  await expect(narration).toBeVisible();
  await expect(viewerFrame).toBeVisible();

  const layout = await narration.evaluate((element) => ({
    resize: getComputedStyle(element).resize,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(layout.resize).toBe("vertical");
  expect(layout.overflowY).toBe("auto");

  await narration.evaluate((element: HTMLElement) => {
    element.style.height = "280px";
  });
  const compactViewerHeight = await viewerFrame.evaluate(
    (element) => element.getBoundingClientRect().height,
  );

  await narration.evaluate((element: HTMLElement) => {
    element.style.height = "380px";
  });
  const expandedViewerHeight = await viewerFrame.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(compactViewerHeight).toBeGreaterThanOrEqual(220);
  expect(expandedViewerHeight).toBeGreaterThanOrEqual(220);
  expect(expandedViewerHeight).toBeLessThanOrEqual(compactViewerHeight);

  await apply.scrollIntoViewIfNeeded();
  await expect(apply).toBeVisible();
  const stageCanScroll = await stage.evaluate(
    (element) =>
      getComputedStyle(element).overflowY === "auto" &&
      element.scrollHeight >= element.clientHeight,
  );
  expect(stageCanScroll).toBe(true);
});

test("previews saved chapter motion without showing authoring frames", async ({
  page,
}) => {
  await page.goto("/story-builder.html?iiif-content=test-story/demo.json");
  const motionTask = page.locator('[data-task-id="motion"] button');
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

  /*
   * A camera point is a frame on the stage, not a pin placed by clicking:
   * each new point starts nested inside the last and is dragged into place.
   * Two points nested one inside the other are already a zoom, which is all
   * the preview below needs.
   */
  const addPoint = page.getByRole("button", {
    name: "Add camera point",
    exact: true,
  });
  await addPoint.click();
  await expect(page.locator(".story-frame--keyframe")).toHaveCount(1);
  await addPoint.click();
  await expect(page.locator(".story-frame--keyframe")).toHaveCount(2);
  // The point just added carries the handles.
  await expect(
    page.locator(".story-frame--keyframe.story-frame--selected"),
  ).toHaveCount(1);

  await expect(page.locator(".story-wide-authoring__point")).toHaveCount(2);
  await page.getByRole("button", { name: "Save motion", exact: true }).click();
  await expect(page.locator(".story-wide-authoring")).toHaveCount(0);
  // Out of the motion tool the keyframes leave the stage; the chapter frame stays.
  await expect(page.locator(".story-frame--keyframe")).toHaveCount(0);
  await expect(page.locator(".story-frame--chapter")).toHaveCount(1);

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
