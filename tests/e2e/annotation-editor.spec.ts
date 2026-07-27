import { expect, test, type Page } from "@playwright/test";

const openExampleStoryBuilder = async (page: Page) => {
  await page.goto("/story-builder.html?iiif-content=test-story/demo.json");
  await expect(page.getByRole("button", { name: /Annotations/ })).toBeVisible();
  let previous = "";
  let stableSamples = 0;
  await expect
    .poll(
      async () => {
        const view = await page
          .locator("mango-viewer")
          .evaluate((element: any) => element.getViewBox());
        const signature = view
          ? [view.x, view.y, view.w, view.h]
              .map((value) => Number(value).toFixed(2))
              .join(":")
          : "";
        stableSamples =
          signature && signature === previous ? stableSamples + 1 : 0;
        previous = signature;
        return stableSamples;
      },
      { timeout: 15_000, intervals: [150] },
    )
    .toBeGreaterThanOrEqual(2);
};

test("creates and saves an annotation with the package editor", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("ERR_BLOCKED_BY_RESPONSE")
    ) {
      runtimeErrors.push(message.text());
    }
  });

  await page.goto("/annotation-editor-wellcome.html");

  await expect(page.locator(".annotation-workspace")).toBeVisible();
  const editor = page.locator(".mango-annotation-editor");
  await expect(editor).toBeAttached();

  // Let the OpenSeadragon canvas dimensions settle before starting an interaction.
  await page.waitForTimeout(1_500);

  // Selecting a tool also verifies that toolbar state reaches the package editor.
  await page.getByRole("button", { name: "Point" }).click();
  await expect(page.locator(".left-sidebar__tool--active")).toHaveText("Point");
  await page.waitForTimeout(200);

  const drawingSurface = page.locator(".mango-annotation-editor__svg");
  const bounds = await drawingSurface.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;

  const savedRows = page.locator(".annotation-table tbody tr");
  const rowsBefore = await savedRows.count();
  const pointsBefore = await drawingSurface.locator("circle").count();

  await drawingSurface.click({
    position: { x: bounds.width * 0.5, y: bounds.height * 0.5 },
  });

  await expect
    .poll(() => drawingSurface.locator("circle").count())
    .toBeGreaterThan(pointsBefore);
  await expect(drawingSurface.locator("circle").first()).toHaveAttribute(
    "fill",
    "rgba(167, 139, 250, 0.18)",
  );

  await page.getByRole("button", { name: "Save Annotation" }).click();

  await expect(savedRows).toHaveCount(rowsBefore + 1);
  await expect
    .poll(() => drawingSurface.locator("circle").count())
    .toBeGreaterThan(pointsBefore);
  expect(runtimeErrors).toEqual([]);
});

test("moves, resizes, and persists a story annotation", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("ERR_BLOCKED_BY_RESPONSE")
    ) {
      runtimeErrors.push(message.text());
    }
  });

  await openExampleStoryBuilder(page);
  await page.getByRole("button", { name: /Annotations/ }).click();

  let editor = page.locator(".mango-annotation-editor__svg");
  await expect(editor).toBeVisible();
  const editorBounds = await editor.boundingBox();
  expect(editorBounds).not.toBeNull();
  if (!editorBounds) return;

  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.waitForTimeout(200);
  await page.mouse.move(editorBounds.x + 250, editorBounds.y + 180);
  await page.mouse.down();
  await page.mouse.move(editorBounds.x + 500, editorBounds.y + 360, {
    steps: 8,
  });
  await page.mouse.up();

  const annotationShapes = editor.locator(
    "[data-annotation-id]:not([data-handle])",
  );
  await expect(annotationShapes).toHaveCount(1);

  await page.getByRole("button", { name: "Select / pan" }).click();
  let shape = annotationShapes.first();
  await shape.click();

  const geometry = async () =>
    shape.evaluate((element) => ({
      x: Number(element.getAttribute("x")),
      y: Number(element.getAttribute("y")),
      width: Number(element.getAttribute("width")),
      height: Number(element.getAttribute("height")),
    }));

  const beforeMove = await geometry();
  const shapeBounds = await shape.boundingBox();
  expect(shapeBounds).not.toBeNull();
  if (!shapeBounds) return;
  await page.mouse.move(
    shapeBounds.x + shapeBounds.width / 2,
    shapeBounds.y + shapeBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    shapeBounds.x + shapeBounds.width / 2 + 70,
    shapeBounds.y + shapeBounds.height / 2 + 45,
    { steps: 8 },
  );
  await page.mouse.up();

  const afterMove = await geometry();
  expect(afterMove.x).toBeGreaterThan(beforeMove.x + 20);
  expect(afterMove.y).toBeGreaterThan(beforeMove.y + 15);

  const resizeHandle = editor.locator('[data-handle="se"]');
  const resizeBounds = await resizeHandle.boundingBox();
  expect(resizeBounds).not.toBeNull();
  if (!resizeBounds) return;
  await page.mouse.move(
    resizeBounds.x + resizeBounds.width / 2,
    resizeBounds.y + resizeBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    resizeBounds.x + resizeBounds.width / 2 + 55,
    resizeBounds.y + resizeBounds.height / 2 + 35,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.waitForTimeout(150);

  const afterResize = await geometry();
  expect(afterResize.width).toBeGreaterThan(afterMove.width + 20);
  expect(afterResize.height).toBeGreaterThan(afterMove.height + 15);

  await page.getByRole("button", { name: /Back to chapter tools/ }).click();
  await page.getByRole("button", { name: /Annotations/ }).click();
  editor = page.locator(".mango-annotation-editor__svg");
  shape = editor.locator("[data-annotation-id]:not([data-handle])").first();
  const reopened = await geometry();
  expect(Math.abs(reopened.x - afterMove.x)).toBeLessThan(2);
  expect(reopened.width).toBeGreaterThan(afterMove.width + 15);
  expect(reopened.height).toBeGreaterThan(afterMove.height + 10);
  expect(runtimeErrors).toEqual([]);
});

test("opens and deletes a Mango annotation from the story footer", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("ERR_BLOCKED_BY_RESPONSE")
    ) {
      runtimeErrors.push(message.text());
    }
  });

  await openExampleStoryBuilder(page);
  await page.getByRole("button", { name: /Annotations/ }).click();

  const editor = page.locator(".mango-annotation-editor__svg");
  const editorBounds = await editor.boundingBox();
  expect(editorBounds).not.toBeNull();
  if (!editorBounds) return;

  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.waitForTimeout(200);
  await page.mouse.move(editorBounds.x + 250, editorBounds.y + 180);
  await page.mouse.down();
  await page.mouse.move(editorBounds.x + 430, editorBounds.y + 320, {
    steps: 6,
  });
  await page.mouse.up();

  const footerItems = page.locator(".story-wide-annotations__item");
  await expect(footerItems).toHaveCount(1);
  const zoom = page.getByRole("textbox", { name: "Zoom percent" });
  const zoomBefore = Number((await zoom.inputValue()).replace(/[^0-9.]/g, ""));
  await page.getByRole("button", { name: /Edit Rectangle annotation/ }).click();
  await expect(editor.locator("[data-handle]")).toHaveCount(8);
  expect(Number((await zoom.inputValue()).replace(/[^0-9.]/g, ""))).toBe(
    zoomBefore,
  );

  await page
    .getByRole("button", { name: /Delete Rectangle annotation/ })
    .click();
  await expect(editor.locator("[data-annotation-id]")).toHaveCount(0);
  await expect(footerItems).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});

test("opens an off-canvas search hit, zooms to it, and highlights it", async ({
  page,
}) => {
  await page.goto("/viewer.html");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  const query = page.getByRole("searchbox", { name: "Search annotations" });
  await query.fill("Vererbung");

  const results = page.locator(".search-list__button");
  await expect(results.first()).toBeVisible();
  expect(await results.count()).toBeGreaterThan(1);

  const canvasNumber = page.getByRole("textbox", { name: "Canvas number" });
  await expect(canvasNumber).toHaveValue("1");
  await results.first().click();

  await expect(canvasNumber).not.toHaveValue("1");
  await expect(page.locator(".annotation--active")).toBeVisible();
  await expect(page.locator(".annotation--hit")).toBeVisible();

  const zoom = page.getByRole("textbox", { name: "Zoom percent" });
  await expect(zoom).not.toHaveValue("100");
});
