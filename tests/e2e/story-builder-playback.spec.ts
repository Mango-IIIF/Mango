import { expect, test } from "@playwright/test";

test("previews saved chapter motion without showing authoring pins", async ({
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

  await page
    .getByRole("button", { name: "Add camera point", exact: true })
    .click();
  let surface = page.locator(".story-builder-motion-point-surface");
  let bounds = await surface.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await surface.click({
    position: { x: bounds.width * 0.35, y: bounds.height * 0.45 },
  });
  await page
    .getByRole("button", { name: "Use this point", exact: true })
    .click();

  await page
    .getByRole("button", { name: "Add camera point", exact: true })
    .click();
  surface = page.locator(".story-builder-motion-point-surface");
  bounds = await surface.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await surface.click({
    position: { x: bounds.width * 0.7, y: bounds.height * 0.55 },
  });
  await page
    .getByRole("button", { name: "Use this point", exact: true })
    .click();

  await expect(page.locator(".story-wide-authoring__point")).toHaveCount(2);
  await page.getByRole("button", { name: "Save motion", exact: true }).click();
  await expect(page.locator(".story-wide-authoring")).toHaveCount(0);

  const viewer = page.locator("mango-viewer");
  const viewBeforePreview = await viewer.evaluate((element: any) =>
    element.getViewBox(),
  );
  await page
    .getByRole("button", { name: "Preview story", exact: true })
    .click();
  await expect(page.locator(".story-builder-motion-marker")).toHaveCount(0);

  await expect
    .poll(() => viewer.evaluate((element: any) => element.getViewBox()), {
      timeout: 5_000,
      message: "expected the saved camera motion to change the preview view",
    })
    .not.toEqual(viewBeforePreview);

  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
});
