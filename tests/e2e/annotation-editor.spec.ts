import { expect, test, type Page } from "@playwright/test";

const openExampleStoryBuilder = async (page: Page) => {
  await page.goto("/story-builder.html?iiif-content=test-story/demo.json");
  await expect(page.locator('[data-testid="inspector-activate-focus"]')).toBeVisible();
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
      !message.text().includes("ERR_BLOCKED_BY_RESPONSE") &&
      // WebKit reports remote image-service HTTP failures as an anonymous
      // console resource error. Page exceptions are tracked separately above;
      // a third-party tile returning 403 is not an application runtime error.
      !message.text().startsWith("Failed to load resource:")
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

test("downloads the same draft payload it reports to the host", async ({ page }) => {
  await page.goto("/annotation-editor.html");
  const host = page.locator("mango-viewer");
  await host.evaluate((element: HTMLElement) => {
    element.addEventListener("exportAnnotationPage", ((event: CustomEvent) => {
      (window as typeof window & { annotationExport?: unknown }).annotationExport =
        event.detail;
    }) as EventListener);
  });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    host.getByRole("button", { name: "Download annotation draft" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("mango-annotations-draft.json");
  const detail = await page.evaluate(
    () => (window as typeof window & { annotationExport?: any }).annotationExport,
  );
  expect(detail.page.type).toBe("AnnotationPage");
  expect(detail.draftValid).toBe(true);
  expect(detail.publicationValid).toBe(false);
  await expect(host.getByRole("status")).toContainText(
    "Assign HTTP(S) page and annotation IDs",
  );
});

test("uses setup languages and preserves text while switching", async ({ page }) => {
  await page.goto("/annotation-editor.html");
  const host = page.locator("mango-viewer");
  await expect(host.locator(".annotation-workspace")).toBeVisible();
  await expect
    .poll(() => host.evaluate((element: any) => element.getCanvasId()))
    .not.toBeNull();

  await host.getByRole("button", { name: "Rectangle", exact: true }).click();
  await host
    .getByRole("button", {
      name: /Create Rectangle at the current view centre/,
    })
    .click();

  const english = host.locator('[data-testid="annotation-language-en"]');
  const welsh = host.locator('[data-testid="annotation-language-cy"]');
  await expect(english).toHaveAttribute("aria-selected", "true");
  await expect(welsh).toBeVisible();

  await welsh.click();
  const text = host.locator("#anno-text");
  await text.fill("Testun Cymraeg");
  await text.press("Backspace");
  await expect(text).toHaveValue("Testun Cymrae");
  await expect(host.getByText("New annotation", { exact: true })).toBeVisible();
  await english.click();
  await expect(text).toHaveValue("");
  await welsh.click();
  await expect(text).toHaveValue("Testun Cymrae");

  await host.getByRole("button", { name: "Save Annotation" }).click();
});

test("creates rectangles and points without pointer geometry gestures", async ({ page }) => {
  await page.goto("/annotation-editor.html");
  const host = page.locator("mango-viewer");
  await expect(host.locator(".annotation-workspace")).toBeVisible();
  await expect
    .poll(() => host.evaluate((element: any) => element.getCanvasId()))
    .not.toBeNull();

  await host.getByRole("button", { name: "Rectangle", exact: true }).click();
  await host
    .getByRole("button", {
      name: /Create Rectangle at the current view centre/,
    })
    .click();
  await expect(host.getByText("New annotation", { exact: true })).toBeVisible();
  await host.getByText("Position", { exact: true }).click();
  const rectangleCoordinates = host.locator(
    '[data-testid="annotation-geometry"] input',
  );
  await expect(rectangleCoordinates).toHaveCount(4);
  await rectangleCoordinates.first().fill("100");
  await rectangleCoordinates.first().blur();
  await host.getByRole("button", { name: "Cancel" }).click();

  await host.getByRole("button", { name: "Point", exact: true }).click();
  await host
    .getByRole("button", { name: /Create Point at the current view centre/ })
    .click();
  await host.getByText("Position", { exact: true }).click();
  await expect(
    host.locator('[data-testid="annotation-geometry"] input'),
  ).toHaveCount(2);
  await host.getByRole("button", { name: "Save Annotation" }).click();
});

test("moves, resizes, and persists a story annotation", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("ERR_BLOCKED_BY_RESPONSE") &&
      !message.text().startsWith("Failed to load resource:")
    ) {
      runtimeErrors.push(message.text());
    }
  });

  await openExampleStoryBuilder(page);
  await page.locator('[data-testid="inspector-activate-focus"]').click();

  // The chapter frame is drawn with the same editor; this is the drawing one.
  const drawingEditor = () =>
    page.locator(
      ".mango-annotation-editor:not(.story-frame-layer) .mango-annotation-editor__svg",
    );
  let editor = drawingEditor();
  await expect(editor).toBeVisible();
  const editorBounds = await editor.boundingBox();
  expect(editorBounds).not.toBeNull();
  if (!editorBounds) return;

  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.waitForTimeout(200);
  // Draw in the middle of the stage, clear of the floating chapters rail and
  // inspector on either side.
  await page.mouse.move(editorBounds.x + 450, editorBounds.y + 180);
  await page.mouse.down();
  await page.mouse.move(editorBounds.x + 700, editorBounds.y + 360, {
    steps: 8,
  });
  await page.mouse.up();

  const annotationShapes = editor.locator(
    "rect[data-annotation-id]:not([data-handle])",
  );
  await expect(annotationShapes).toHaveCount(1);

  await page.getByRole("button", { name: "Select / pan" }).click();
  let shape = annotationShapes.first();
  await shape.click();

  const storyText = page.locator(
    ".chapter-overlay__translation-field textarea",
  );
  await storyText.fill("Note");
  await storyText.press("Backspace");
  await expect(storyText).toHaveValue("Not");
  await expect(annotationShapes).toHaveCount(1);

  const geometry = async () =>
    shape.evaluate((element) => ({
      x: Number(element.getAttribute("x")),
      y: Number(element.getAttribute("y")),
      width: Number(element.getAttribute("width")),
      height: Number(element.getAttribute("height")),
    }));

  const beforeMove = await geometry();
  await expect(shape).toBeVisible();
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
  await expect(resizeHandle).toBeVisible();
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

  // The focus task is transactional: Save commits geometry; Cancel must
  // restore the chapter snapshot rather than silently committing it.
  await page.getByRole("button", { name: "Save annotation" }).click();
  await page.locator('[data-testid="inspector-activate-focus"]').click();
  editor = drawingEditor();
  shape = editor
    .locator("rect[data-annotation-id]:not([data-handle])")
    .first();
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
      !message.text().includes("ERR_BLOCKED_BY_RESPONSE") &&
      !message.text().startsWith("Failed to load resource:")
    ) {
      runtimeErrors.push(message.text());
    }
  });

  await openExampleStoryBuilder(page);
  await page.locator('[data-testid="inspector-activate-focus"]').click();

  const editor = page.locator(
    ".mango-annotation-editor:not(.story-frame-layer) .mango-annotation-editor__svg",
  );
  await expect(editor).toBeVisible();
  const editorBounds = await editor.boundingBox();
  expect(editorBounds).not.toBeNull();
  if (!editorBounds) return;

  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.waitForTimeout(200);
  // Clear of the floating chapters rail on the left.
  await page.mouse.move(editorBounds.x + 450, editorBounds.y + 180);
  await page.mouse.down();
  await page.mouse.move(editorBounds.x + 630, editorBounds.y + 320, {
    steps: 6,
  });
  await page.mouse.up();

  const footerItems = page.locator(".story-wide-annotations__item");
  await expect(footerItems).toHaveCount(1);
  const zoom = page.getByRole("textbox", { name: "Zoom percent" });
  const zoomBefore = Number((await zoom.inputValue()).replace(/[^0-9.]/g, ""));
  await page.getByRole("button", { name: /Edit Rectangle annotation/ }).click();
  await expect(editor.locator("[data-handle]")).toHaveCount(8);
  const zoomAfter = Number((await zoom.inputValue()).replace(/[^0-9.]/g, ""));
  // Opening the editor changes the available canvas width, which can adjust
  // the displayed fit percentage by a few points. Guard against an unwanted
  // zoom-to-annotation jump without requiring pixel-identical layout timing.
  expect(Math.abs(zoomAfter - zoomBefore)).toBeLessThanOrEqual(5);

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
