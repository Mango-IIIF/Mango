import { expect, test } from "@playwright/test";

test("previews saved chapter motion without showing authoring pins", async ({ page }) => {
  await page.goto("/story-builder.html?iiif-content=test-story/demo.json");
  const motionTask = page.locator('[data-task-id="motion"] button');
  await expect(motionTask).toBeVisible();
  await expect
    .poll(() => page.locator("mango-viewer").evaluate((element: any) => element.getViewBox()))
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

  await page.getByRole("button", { name: "Add first point", exact: true }).click();
  let surface = page.locator(".story-builder-motion-point-surface");
  let bounds = await surface.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await surface.click({ position: { x: bounds.width * 0.35, y: bounds.height * 0.45 } });
  await page.getByRole("button", { name: "Use this point", exact: true }).click();

  await page.getByRole("button", { name: "Add another point", exact: true }).click();
  surface = page.locator(".story-builder-motion-point-surface");
  bounds = await surface.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await surface.click({ position: { x: bounds.width * 0.7, y: bounds.height * 0.55 } });
  await page.getByRole("button", { name: "Use this point", exact: true }).click();

  await expect(page.locator(".story-wide-authoring__point")).toHaveCount(2);
  await page.getByRole("button", { name: "Save motion", exact: true }).click();
  await expect(page.locator(".story-wide-authoring")).toHaveCount(0);

  await page.getByRole("button", { name: "Preview story", exact: true }).click();
  await page.waitForTimeout(1_200);
  await expect(page.locator(".story-builder-motion-marker")).toHaveCount(0);

  const viewAtStart = await page.locator("mango-viewer").evaluate((element: any) =>
    element.getViewBox(),
  );
  await page.waitForTimeout(1_000);
  const viewDuringMotion = await page.locator("mango-viewer").evaluate((element: any) =>
    element.getViewBox(),
  );
  expect(viewDuringMotion).not.toEqual(viewAtStart);

  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
});
