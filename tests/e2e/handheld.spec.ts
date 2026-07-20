import { expect, test } from '@playwright/test';

test.describe('handheld viewer layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps navigation and media controls visible without forcing viewport height', async ({
    page,
  }) => {
    await page.goto('/viewer.html');

    const viewer = page.locator('mango-viewer');
    const navigation = viewer.locator('.viewer__control-rail');
    const toolbar = viewer.locator('.stage__toolbar');

    await expect(navigation).toBeVisible();
    await expect(toolbar).toBeVisible();
    await expect(viewer.locator('.gallery')).toHaveCount(0);

    const [viewerBox, navigationBox, toolbarBox] = await Promise.all([
      viewer.boundingBox(),
      navigation.boundingBox(),
      toolbar.boundingBox(),
    ]);

    expect(viewerBox).not.toBeNull();
    expect(navigationBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(viewerBox!.height).toBeLessThan(700);
    expect(navigationBox!.y).toBeLessThan(toolbarBox!.y);
    expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(844);
  });

  test('makes workspace mode fill the dynamic viewport with a bottom tool rail', async ({ page }) => {
    await page.goto('/viewer.html');
    await page.evaluate(() => {
      document.body.style.margin = '0';
      document.body.innerHTML = '<mango-viewer mode="workspace"></mango-viewer>';
    });

    const workspaceViewer = page.locator('mango-viewer[mode="workspace"]');
    const workspace = workspaceViewer.locator('.workspace');
    const rail = workspaceViewer.locator('.workspace-rail');

    await expect(workspace).toBeVisible();
    await expect(workspaceViewer.locator('.workspace-drawer')).toBeHidden();

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

  test('keeps audio controls inside the phone stage', async ({ page }) => {
    const manifest = 'https://404mike.github.io/Mango-Narration/manifest.json';
    await page.goto(`/viewer.html?iiif-content=${encodeURIComponent(manifest)}`);

    const viewer = page.locator('mango-viewer');
    const media = viewer.locator('.stage__media--audio');
    const controller = viewer.locator('mango-av-player media-controller');
    const controls = viewer.locator('mango-av-player media-control-bar');

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
    expect(controllerBox!.width).toBeLessThanOrEqual(mediaBox!.width - 20);
    expect(controlsBox!.x + controlsBox!.width).toBeLessThanOrEqual(
      mediaBox!.x + mediaBox!.width,
    );
    expect(controlsBox!.y + controlsBox!.height).toBeLessThanOrEqual(
      mediaBox!.y + mediaBox!.height,
    );
  });

  test('gives video an intrinsic handheld stage height', async ({ page }) => {
    const manifest =
      'https://iiif.io/api/cookbook/recipe/0003-mvm-video/manifest.json';
    await page.goto(`/viewer.html?iiif-content=${encodeURIComponent(manifest)}`);

    const viewer = page.locator('mango-viewer');
    const media = viewer.locator('.stage__media--video');
    const controls = viewer.locator('mango-av-player media-control-bar');

    await expect(controls).toBeVisible();
    const mediaBox = await media.boundingBox();
    expect(mediaBox).not.toBeNull();
    expect(mediaBox!.height).toBeGreaterThanOrEqual(210);
  });
});
