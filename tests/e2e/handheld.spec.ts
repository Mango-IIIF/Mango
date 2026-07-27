import { expect, test } from "@playwright/test";

test.describe("desktop viewer layout", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("gives multi-page manifests enough vertical media space", async ({
    page,
  }) => {
    await page.goto("/viewer.html");

    const viewer = page.locator("mango-viewer");
    const media = viewer.locator(".stage__media");
    const toolbar = viewer.locator(".stage__toolbar");
    const thumbnail = viewer.locator(".gallery__thumb").first();
    const thumbnailTitle = viewer.locator(".gallery__label").first();

    await expect(media).toBeVisible();
    await expect(thumbnailTitle).toBeVisible();

    const [viewerBox, mediaBox, toolbarBox] = await Promise.all([
      viewer.boundingBox(),
      media.boundingBox(),
      toolbar.boundingBox(),
    ]);

    expect(viewerBox).not.toBeNull();
    expect(mediaBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(viewerBox!.height).toBeGreaterThanOrEqual(900);
    expect(mediaBox!.height).toBeGreaterThanOrEqual(400);
    expect(toolbarBox!.y).toBeGreaterThanOrEqual(mediaBox!.y);
    expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(
      mediaBox!.y + mediaBox!.height,
    );
    await expect(thumbnail).toHaveCSS("aspect-ratio", "1 / 1");
    await expect(thumbnailTitle).toHaveCSS("white-space", "nowrap");
    await expect(thumbnailTitle).toHaveCSS("text-overflow", "ellipsis");

    await expect(toolbar).toHaveCSS("opacity", "0", { timeout: 4_000 });
    await media.hover({ position: { x: 20, y: 20 } });
    await expect(toolbar).toHaveCSS("opacity", "1");
  });
});

test.describe("handheld viewer layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps navigation and media controls visible without forcing viewport height", async ({
    page,
  }) => {
    await page.goto("/viewer.html");

    const viewer = page.locator("mango-viewer");
    const navigation = viewer.locator(".viewer__control-rail");
    const media = viewer.locator(".stage__media");
    const toolbar = viewer.locator(".stage__toolbar");

    await expect(navigation).toBeVisible();
    await expect(toolbar).toBeVisible();
    await expect(viewer.locator(".gallery")).toHaveCount(0);

    const [viewerBox, navigationBox, mediaBox, toolbarBox] = await Promise.all([
      viewer.boundingBox(),
      navigation.boundingBox(),
      media.boundingBox(),
      toolbar.boundingBox(),
    ]);

    expect(viewerBox).not.toBeNull();
    expect(navigationBox).not.toBeNull();
    expect(mediaBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(viewerBox!.height).toBeLessThan(700);
    expect(toolbarBox!.y).toBeGreaterThanOrEqual(
      mediaBox!.y + mediaBox!.height,
    );
    expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(
      navigationBox!.y,
    );
    expect(navigationBox!.y + navigationBox!.height).toBeLessThanOrEqual(844);
    expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(844);

    await page.waitForTimeout(3_000);
    await expect(toolbar).toHaveCSS("opacity", "1");
  });

  test("makes workspace mode fill the dynamic viewport with a bottom tool rail", async ({
    page,
  }) => {
    await page.goto("/viewer.html");
    await page.evaluate(() => {
      document.body.style.margin = "0";
      document.body.innerHTML =
        '<mango-viewer mode="workspace"></mango-viewer>';
    });

    const workspaceViewer = page.locator('mango-viewer[mode="workspace"]');
    const workspace = workspaceViewer.locator(".workspace");
    const rail = workspaceViewer.locator(".workspace-rail");

    await expect(workspace).toBeVisible();
    await expect(workspaceViewer.locator(".workspace-drawer")).toBeHidden();

    const [hostBox, workspaceBox, railBox] = await Promise.all([
      workspaceViewer.boundingBox(),
      workspace.boundingBox(),
      rail.boundingBox(),
    ]);

    expect(hostBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    expect(railBox).not.toBeNull();
    expect(hostBox!.height).toBe(844);
    expect(workspaceBox!.height).toBe(844);
    expect(railBox!.width).toBe(390);
    expect(railBox!.y + railBox!.height).toBe(844);
  });

  test("keeps audio controls inside the phone stage", async ({ page }) => {
    const manifest = "https://404mike.github.io/Mango-Narration/manifest.json";
    await page.goto(
      `/viewer.html?iiif-content=${encodeURIComponent(manifest)}`,
    );

    const viewer = page.locator("mango-viewer");
    const media = viewer.locator(".stage__media--audio");
    const controller = viewer.locator("mango-av-player media-controller");
    const controls = viewer.locator("mango-av-player media-control-bar");

    await expect(controller).toBeVisible();
    await expect(controls).toBeVisible();

    const [mediaBox, controllerBox, controlsBox] = await Promise.all([
      media.boundingBox(),
      controller.boundingBox(),
      controls.boundingBox(),
    ]);

    expect(mediaBox).not.toBeNull();
    expect(controllerBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(controllerBox!.width).toBeLessThanOrEqual(mediaBox!.width);
    expect(controllerBox!.x).toBeGreaterThanOrEqual(mediaBox!.x);
    expect(controlsBox!.x + controlsBox!.width).toBeLessThanOrEqual(
      mediaBox!.x + mediaBox!.width,
    );
    expect(controlsBox!.y + controlsBox!.height).toBeLessThanOrEqual(
      mediaBox!.y + mediaBox!.height,
    );
  });

  test("gives video an intrinsic handheld stage height", async ({ page }) => {
    const manifest =
      "https://iiif.io/api/cookbook/recipe/0003-mvm-video/manifest.json";
    await page.goto(
      `/viewer.html?iiif-content=${encodeURIComponent(manifest)}`,
    );

    const viewer = page.locator("mango-viewer");
    const media = viewer.locator(".stage__media--video");
    const controls = viewer.locator("mango-av-player media-control-bar");

    await expect(controls).toBeVisible();
    const mediaBox = await media.boundingBox();
    expect(mediaBox).not.toBeNull();
    expect(mediaBox!.height).toBeGreaterThanOrEqual(210);
  });
});
