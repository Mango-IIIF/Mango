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
    expect(viewerBox!.height).toBe(720);
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

  test("keeps navigation and media controls contained by the default viewer height", async ({
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
    expect(viewerBox!.height).toBe(720);
    expect(toolbarBox!.y).toBeGreaterThanOrEqual(
      mediaBox!.y + mediaBox!.height,
    );
    expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(
      navigationBox!.y,
    );
    expect(navigationBox!.y + navigationBox!.height).toBeLessThanOrEqual(
      viewerBox!.y + viewerBox!.height,
    );
    expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(
      viewerBox!.y + viewerBox!.height,
    );

    await page.waitForTimeout(3_000);
    await expect(toolbar).toHaveCSS("opacity", "1");
  });

  test("allows the embedding site to override the default height", async ({
    page,
  }) => {
    await page.goto("/viewer.html");

    const viewer = page.locator("mango-viewer");
    await expect(viewer).toHaveCSS("height", "720px");

    await page.addStyleTag({ content: "mango-viewer { height: 512px; }" });

    await expect(viewer).toHaveCSS("height", "512px");
    const innerViewer = viewer.locator(".viewer");
    await expect(innerViewer).toHaveCSS("height", "512px");
  });

  test("contains the plain viewer across short portrait and landscape viewports", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 664 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/viewer.html");

      const host = page.locator("mango-viewer");
      const media = host.locator(".stage__media");
      const toolbar = host.locator(".stage__toolbar");
      const navigation = host.locator(".viewer__control-rail");
      const [hostBox, mediaBox, toolbarBox, navigationBox] = await Promise.all([
        host.boundingBox(),
        media.boundingBox(),
        toolbar.boundingBox(),
        navigation.boundingBox(),
      ]);

      expect(hostBox?.height).toBe(Math.min(720, viewport.height));
      expect(
        toolbarBox!.y - (mediaBox!.y + mediaBox!.height),
      ).toBeLessThanOrEqual(1);
      expect(navigationBox!.y + navigationBox!.height).toBeLessThanOrEqual(
        hostBox!.y + hostBox!.height,
      );
      expect(
        await page.evaluate(() => document.body.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
    }
  });

  test("uses the whole flexible stage without leaving a fullscreen gap", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, "fullscreenEnabled", {
        configurable: true,
        get: () => false,
      });
      Object.defineProperty(Element.prototype, "requestFullscreen", {
        configurable: true,
        value: undefined,
      });
    });
    await page.goto("/viewer.html");

    const viewer = page.locator("mango-viewer");
    await viewer.getByRole("button", { name: "Enter fullscreen" }).click();

    const innerViewer = viewer.locator(".viewer");
    const media = viewer.locator(".stage__media");
    const toolbar = viewer.locator(".stage__toolbar");
    const navigation = viewer.locator(".viewer__control-rail");
    const [viewerBox, mediaBox, toolbarBox, navigationBox] = await Promise.all([
      innerViewer.boundingBox(),
      media.boundingBox(),
      toolbar.boundingBox(),
      navigation.boundingBox(),
    ]);

    expect(viewerBox?.height).toBe(664);
    expect(
      toolbarBox!.y - (mediaBox!.y + mediaBox!.height),
    ).toBeLessThanOrEqual(1);
    expect(navigationBox!.y + navigationBox!.height).toBeLessThanOrEqual(
      viewerBox!.y + viewerBox!.height,
    );

    await viewer.getByRole("button", { name: "Metadata" }).click();
    const panelBox = await viewer.locator(".panel-stack--left").boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.y).toBeGreaterThanOrEqual(viewerBox!.y);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(
      viewerBox!.y + viewerBox!.height,
    );
  });

  test("keeps fixed-height config embeds and their internal viewer in sync", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto("/config.html");

    const shell = page.locator(".config-viewer-shell");
    const host = shell.locator("mango-viewer").first();
    const innerViewer = host.locator(".viewer");
    const [shellBox, hostBox, innerBox] = await Promise.all([
      shell.boundingBox(),
      host.boundingBox(),
      innerViewer.boundingBox(),
    ]);

    expect(shellBox?.height).toBe(820);
    expect(hostBox?.height).toBe(shellBox?.height);
    expect(innerBox?.height).toBe(shellBox?.height);
    expect(innerBox!.y + innerBox!.height).toBe(shellBox!.y + shellBox!.height);
  });

  for (const fixture of [
    { path: "/story-builder.html", scrollContainer: ".viewer__grid" },
    {
      path: "/annotation-editor.html",
      scrollContainer: ".annotation-workspace",
    },
    { path: "/index.html", scrollContainer: ".story-shell" },
  ]) {
    test(`contains ${fixture.path} within the custom-element height`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 664 });
      await page.goto(fixture.path);

      const host = page.locator("mango-viewer");
      const innerViewer = host.locator(".viewer");
      const [hostBox, innerBox] = await Promise.all([
        host.boundingBox(),
        innerViewer.boundingBox(),
      ]);

      expect(hostBox?.height).toBe(664);
      expect(innerBox?.height).toBe(hostBox?.height);
      expect(innerBox!.y + innerBox!.height).toBe(hostBox!.y + hostBox!.height);

      const sizing = await host
        .locator(fixture.scrollContainer)
        .evaluate((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        }));
      expect(sizing.scrollHeight).toBeGreaterThanOrEqual(sizing.clientHeight);
    });
  }

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
    // WebKit resolves 100dvh against a device-pixel-snapped viewport, so these
    // land a fraction under the 844pt viewport height. Compare to subpixel
    // precision rather than exact equality.
    expect(hostBox!.height).toBeCloseTo(844, 1);
    expect(workspaceBox!.height).toBeCloseTo(844, 1);
    expect(railBox!.width).toBeCloseTo(390, 1);
    expect(railBox!.y + railBox!.height).toBeCloseTo(844, 1);
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
