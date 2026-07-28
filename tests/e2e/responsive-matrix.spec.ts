import { expect, test, type Locator, type Page } from "@playwright/test";

const viewports = [
  { name: "phone portrait", width: 390, height: 664 },
  { name: "phone landscape", width: 844, height: 390 },
  { name: "iPad portrait", width: 820, height: 1180 },
  { name: "iPad landscape", width: 1180, height: 820 },
  { name: "desktop", width: 1440, height: 900 },
];

const modes = [
  { name: "IIIF viewer", path: "/viewer.html", primary: ".stage__media" },
  { name: "story viewer", path: "/index.html", primary: ".story-shell" },
  {
    name: "story builder",
    path: "/story-builder.html",
    primary: ".viewer__grid",
  },
  {
    name: "annotation editor",
    path: "/annotation-editor.html",
    primary: ".annotation-workspace",
  },
];

const box = async (locator: Locator) => {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
};

const expectContained = async (
  child: Locator,
  parent: Locator,
  tolerance = 1,
) => {
  const [childBox, parentBox] = await Promise.all([box(child), box(parent)]);
  expect(childBox.x).toBeGreaterThanOrEqual(parentBox.x - tolerance);
  expect(childBox.y).toBeGreaterThanOrEqual(parentBox.y - tolerance);
  expect(childBox.x + childBox.width).toBeLessThanOrEqual(
    parentBox.x + parentBox.width + tolerance,
  );
  expect(childBox.y + childBox.height).toBeLessThanOrEqual(
    parentBox.y + parentBox.height + tolerance,
  );
};

const openAt = async (
  page: Page,
  path: string,
  viewport: { width: number; height: number },
) => {
  await page.setViewportSize(viewport);
  await page.goto(path);
  await expect(page.locator("mango-viewer")).toBeVisible();
};

test.describe("responsive mode matrix", () => {
  for (const viewport of viewports) {
    for (const mode of modes) {
      test(`${mode.name} is contained on ${viewport.name}`, async ({
        page,
      }) => {
        await openAt(page, mode.path, viewport);

        const host = page.locator("mango-viewer");
        const viewer = host.locator(".viewer");
        const primary = host.locator(mode.primary);
        await expect(primary).toBeVisible();

        const [hostBox, viewerBox, primaryBox] = await Promise.all([
          box(host),
          box(viewer),
          box(primary),
        ]);
        expect(viewerBox.height).toBe(hostBox.height);
        expect(viewerBox.x + viewerBox.width).toBeLessThanOrEqual(
          hostBox.x + hostBox.width + 1,
        );
        expect(viewerBox.y + viewerBox.height).toBeLessThanOrEqual(
          hostBox.y + hostBox.height + 1,
        );
        expect(primaryBox.width).toBeGreaterThan(100);
        expect(primaryBox.height).toBeGreaterThan(100);
        expect(
          await page.evaluate(() => document.body.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width);

        const fullscreen = host.getByRole("button", {
          name: /Enter fullscreen|Fullscreen/,
        });
        await expect(fullscreen).toBeVisible();
        await expectContained(fullscreen, viewer);
      });
    }
  }
});

test.describe("iPad fullscreen and story rail", () => {
  test.use({ viewport: { width: 1024, height: 1366 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "platform", {
        configurable: true,
        value: "MacIntel",
      });
      Object.defineProperty(window.navigator, "maxTouchPoints", {
        configurable: true,
        value: 5,
      });
      Object.defineProperty(Document.prototype, "fullscreenEnabled", {
        configurable: true,
        get: () => true,
      });
      Object.defineProperty(Element.prototype, "requestFullscreen", {
        configurable: true,
        value: () => {
          (
            window as typeof window & { nativeFullscreenRequests?: number }
          ).nativeFullscreenRequests =
            ((window as typeof window & { nativeFullscreenRequests?: number })
              .nativeFullscreenRequests ?? 0) + 1;
          return Promise.resolve();
        },
      });
    });
  });

  test("uses Mango fullscreen without invoking iPad native fullscreen chrome", async ({
    page,
  }) => {
    await page.goto("/viewer.html");
    const host = page.locator("mango-viewer");
    await host.getByRole("button", { name: "Enter fullscreen" }).click();

    const viewer = host.locator(".viewer");
    await expect(viewer).toHaveClass(/viewer--fullscreen-fallback/);
    await expect(
      host.getByRole("button", { name: "Close fullscreen" }),
    ).toBeVisible();
    await expect(
      host.getByRole("button", { name: "About Mango Viewer" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { nativeFullscreenRequests?: number })
            .nativeFullscreenRequests ?? 0,
      ),
    ).toBe(0);
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    await expectContained(
      host.getByRole("button", { name: "Close fullscreen" }),
      viewer,
    );
  });

  for (const viewport of [
    { name: "iPad", width: 1024, height: 1366 },
    { name: "phone", width: 390, height: 664 },
  ]) {
    test(`shows complete, loaded story thumbnails on ${viewport.name}`, async ({
      page,
    }) => {
      await openAt(page, "/index.html", viewport);
      const host = page.locator("mango-viewer");
      const viewer = host.locator(".viewer");
      const footer = host.locator(".story-shell__footer");
      const firstChapter = footer.locator(".story-shell__chapter").first();
      const firstImage = firstChapter.locator("img");
      const firstNumber = firstChapter.locator(".story-shell__chapter-number");

      await expect(footer).toBeVisible();
      await expect(firstChapter).toBeVisible();
      await expect(firstImage).toBeVisible();
      await expect(firstNumber).toBeVisible();
      await expect
        .poll(() =>
          firstImage.evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      const thumbnailImages = footer.locator(".story-shell__chapter img");
      expect(await thumbnailImages.count()).toBeGreaterThan(1);
      await expect
        .poll(() =>
          thumbnailImages.evaluateAll((images: HTMLImageElement[]) =>
            images.every((image) => image.complete && image.naturalWidth > 0),
          ),
        )
        .toBe(true);

      const [footerBox, thumbBox] = await Promise.all([
        box(footer),
        box(firstChapter.locator(".story-shell__chapter-thumb")),
      ]);
      expect(footerBox.height).toBeGreaterThanOrEqual(100);
      expect(thumbBox.height).toBeGreaterThanOrEqual(64);
      await expectContained(footer, viewer);
      await expectContained(firstNumber, footer);
    });
  }
});

test.describe("priority mobile interactions", () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true });

  test("keeps every IIIF drawer usable and dismissible", async ({ page }) => {
    await page.goto("/viewer.html");
    const host = page.locator("mango-viewer");
    const viewer = host.locator(".viewer");

    for (const label of [
      "Metadata",
      "Search",
      "Annotations",
      "Tools",
      "View settings",
    ]) {
      const trigger = host.getByRole("button", { name: label });
      await expect(trigger).toBeVisible();
      await trigger.click();
      const panel = host.locator(".panel-stack--left");
      await expect(panel).toBeVisible();
      // Measure the settled drawer, not an intermediate frame of its 300ms
      // slide-in animation.
      await page.waitForTimeout(350);
      await expectContained(panel, viewer);
      await host.locator(".panel-stack--left .panel__close:visible").click();
      await expect(panel).toBeHidden();
    }
  });

  test("keeps all story-builder work areas reachable inside its own scroller", async ({
    page,
  }) => {
    await page.goto("/story-builder.html");
    const host = page.locator("mango-viewer");
    const grid = host.locator(".viewer__grid");
    const viewer = host.locator(".viewer");

    await expectContained(
      host.getByRole("button", { name: "Undo" }),
      viewer,
      2,
    );
    await expectContained(
      host.getByRole("button", { name: "Enter fullscreen" }),
      viewer,
      2,
    );
    for (const name of [
      "Undo",
      "Redo",
      "Preview story",
      "Export",
      "Story settings",
    ]) {
      const controlBox = await box(host.getByRole("button", { name }));
      expect(controlBox.width).toBeGreaterThanOrEqual(40);
      expect(controlBox.height).toBeGreaterThanOrEqual(40);
    }

    for (const selector of [
      ".stage",
      ".panel-stack--left",
      ".panel-stack--right",
    ]) {
      const region = host.locator(selector);
      await expect(region).toBeAttached();
      await region.scrollIntoViewIfNeeded();
      await expect(region).toBeVisible();
      await expectContained(region, grid, 2);
    }
    const sizes = await grid.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(sizes.scrollHeight).toBeGreaterThan(sizes.clientHeight);
  });

  test("keeps annotation tools, canvas, table, and inspector reachable", async ({
    page,
  }) => {
    await page.goto("/annotation-editor.html");
    const host = page.locator("mango-viewer");
    const workspace = host.locator(".annotation-workspace");

    for (const selector of [
      ".annotation-workspace__left",
      ".annotation-workspace__stage",
      ".annotation-workspace__bottom",
      ".annotation-workspace__right",
    ]) {
      const region = host.locator(selector);
      await region.scrollIntoViewIfNeeded();
      await expect(region).toBeVisible();
      await expectContained(region, workspace, 2);
    }
    const sizes = await workspace.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(sizes.scrollHeight).toBeGreaterThan(sizes.clientHeight);
  });
});
