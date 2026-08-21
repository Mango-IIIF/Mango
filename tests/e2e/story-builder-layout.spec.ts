import { expect, test, type Page } from "@playwright/test";

/*
 * The story builder's stage is the author's reference frame, so two things
 * have to hold whatever the chrome around it does: the viewer's idea of "the
 * current view" must describe the stage as it is now, and opening or closing
 * an authoring panel must not change the stage at all.
 */

const STORY_URL = "/story-builder.html?iiif-content=test-story/demo.json";

type StageMeasure = {
  width: number;
  height: number;
  aspect: number;
  viewAspect: number | null;
};

const measureStage = (page: Page): Promise<StageMeasure> =>
  page.locator("mango-viewer").evaluate((element: any) => {
    const container = element.shadowRoot?.querySelector(
      ".openseadragon-container",
    ) as HTMLElement | null;
    const rect = container?.getBoundingClientRect();
    const view = element.getViewBox?.() ?? null;
    return {
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
      aspect: rect && rect.height > 0 ? rect.width / rect.height : 0,
      viewAspect: view && view.h > 0 ? view.w / view.h : null,
    };
  });

const waitForStage = async (page: Page) => {
  await page.goto(STORY_URL);
  await expect
    .poll(async () => (await measureStage(page)).viewAspect, {
      timeout: 30_000,
    })
    .not.toBeNull();
  await expect
    .poll(async () => (await measureStage(page)).width)
    .toBeGreaterThan(0);
};

const selectChapterSix = async (page: Page) => {
  const viewer = page.locator('mango-viewer');
  const chaptersToggle = viewer.locator('[data-testid="builder-toggle-chapters"]');
  if ((await chaptersToggle.getAttribute('aria-expanded')) !== 'true') {
    await chaptersToggle.click();
  }
  await viewer
    .getByRole('button')
    .filter({ hasText: 'Chapter 6' })
    .first()
    .click();
  await expect
    .poll(() =>
      viewer.evaluate((element: any) => {
        const saved = element.getStory?.()?.chapters?.[5]?.viewBox;
        const current = element.getViewBox?.();
        if (!saved || !current) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(saved.x + saved.w / 2 - (current.x + current.w / 2)),
          Math.abs(saved.y + saved.h / 2 - (current.y + current.h / 2)),
        );
      }),
    )
    // A fluid authoring viewport may expose more picture on one axis than the
    // saved output frame, but it must stay centred on the authored region.
    .toBeLessThanOrEqual(2);
};

test("loads a new story source without a canvas-selection step", async ({
  page,
}) => {
  await page.goto("/story-edit.html");
  const viewer = page.locator("mango-viewer");
  await expect(viewer.getByTestId("story-source-setup")).toBeVisible();
  await expect(viewer.getByTestId("chapter-canvas-select")).toHaveCount(0);

  await viewer
    .getByTestId("chapter-manifest")
    .fill("/test-story/local-iiif/manifest.json");
  await viewer.getByTestId("chapter-manifest-reload").click();

  await expect(viewer.getByTestId("narration-overlay")).toBeHidden({
    timeout: 15_000,
  });
  await expect(
    viewer.locator('[data-testid^="chapter-row-"]').first(),
  ).toBeVisible();
  await expect(viewer.getByTestId("story-stage-label")).toHaveCount(0);
  const storyStage = await viewer.getByTestId("story-stage").boundingBox();
  const surface = await viewer.getByTestId("story-stage-surface").boundingBox();
  expect(storyStage && surface).toBeTruthy();
  if (!storyStage || !surface) return;
  expect(Math.abs(surface.x - storyStage.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(surface.y - storyStage.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(surface.width - storyStage.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(surface.height - storyStage.height)).toBeLessThanOrEqual(1);
});

test("fills desktop, tablet, and phone workspaces while keeping the authored region centred", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1600, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await waitForStage(page);
    await selectChapterSix(page);
    const viewer = page.locator("mango-viewer");

    const storyStage = viewer.locator('[data-testid="story-stage"]');
    const surface = viewer.locator('[data-testid="story-stage-surface"]');
    const storyStageBox = await storyStage.boundingBox();
    const surfaceBox = await surface.boundingBox();
    expect(storyStageBox).not.toBeNull();
    expect(surfaceBox).not.toBeNull();
    expect(Math.abs(surfaceBox!.width - storyStageBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(surfaceBox!.height - storyStageBox!.height)).toBeLessThanOrEqual(1);
  }
});

test("keeps the current view in step with the stage after a window resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await waitForStage(page);
  await selectChapterSix(page);
  const viewer = page.locator("mango-viewer");
  await viewer.evaluate((element: any) => {
    (window as any).__viewBoxEvents = [];
    element.addEventListener("viewBoxChange", (event: CustomEvent) => {
      const box = event.detail?.viewBox;
      if (box && box.h > 0) {
        (window as any).__viewBoxEvents.push(box.w / box.h);
      }
    });
  });

  // The full-workspace stage follows the window, and OSD reports that new
  // viewport shape rather than retaining a hidden fixed-ratio surface.
  await page.setViewportSize({ width: 1100, height: 900 });

  await expect
    .poll(async () => {
      const stage = await measureStage(page);
      return stage.viewAspect === null
        ? Number.POSITIVE_INFINITY
        : Math.abs(stage.viewAspect - stage.aspect) / stage.aspect;
    })
    .toBeLessThan(0.01);

  const stage = await measureStage(page);
  const emitted: number[] = await viewer.evaluate(
    () => (window as any).__viewBoxEvents,
  );
  expect(emitted.length).toBeGreaterThan(0);
  expect(Math.abs(emitted[emitted.length - 1] - stage.aspect) / stage.aspect).toBeLessThan(
    0.01,
  );
});

test("leaves the stage the same size whatever chrome the author opens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await waitForStage(page);
  const viewer = page.locator("mango-viewer");
  const chapterRows = viewer.locator('[data-testid^="chapter-row-"]');
  await expect(chapterRows.first()).toBeVisible();

  const baseline = await measureStage(page);
  expect(baseline.width).toBeGreaterThan(0);

  const expectUnchanged = async (label: string) => {
    // Measured, not eyeballed: the container must not move by a pixel.
    await expect
      .poll(async () => {
        const stage = await measureStage(page);
        return [Math.round(stage.width), Math.round(stage.height)];
      }, { message: `stage size after ${label}` })
      .toEqual([Math.round(baseline.width), Math.round(baseline.height)]);
  };

  const groupFor: Record<string, string> = {
    position: "about",
    focus: "about",
    motion: "timing",
    "audio-timing": "timing",
  };
  const openTool = async (task: string) => {
    await viewer.locator(`[data-testid="inspector-group-${groupFor[task]}"]`).click();
    await viewer.locator(`[data-testid="inspector-activate-${task}"]`).click();
  };
  const closeTool = async (task: string) => {
    // Every open tool has Done on the stage; the frame tool also sends the
    // panels aside, so that is the one to use there.
    if (task === "position" || task === "focus" || task === "motion") {
      await viewer.locator('[data-testid="story-wide-done"]').click();
      return;
    }
    if (task === 'audio-timing' || task === 'media-timing') {
      await viewer.locator('.story-wide-modal__done').click();
      return;
    }
    await viewer.locator(`[data-testid="inspector-done-${task}"]`).click();
  };

  for (const task of ["position", "focus", "motion", "audio-timing"]) {
    await openTool(task);
    if (task === "position") {
      // The stage boundary is the output frame; there is no second draggable
      // chapter rectangle competing with it.
      await expect(viewer.locator(".story-frame--chapter")).toHaveCount(0);
      await expect(viewer.locator(".viewer__grid--builder-left-collapsed")).toHaveCount(1);
    } else {
      // The tool's own panel has appeared...
      await expect(viewer.locator(".stage__bottom")).toBeVisible();
    }
    // ...and the picture has not flinched.
    await expectUnchanged(`opening ${task}`);
    await closeTool(task);
    await expectUnchanged(`closing ${task}`);
    if (task === "position") {
      await expect(
        viewer.locator('[data-testid="inspector-toggle-position"]'),
      ).toHaveAttribute("aria-expanded", "false");
    }
  }

  // Switching inspector groups is chrome too.
  for (const group of ["timing", "source", "about"]) {
    await viewer.locator(`[data-testid="inspector-group-${group}"]`).click();
    await expectUnchanged(`showing ${group}`);
  }

  // Collapsing and restoring each column.
  for (const toggle of ["builder-toggle-chapters", "builder-toggle-tools"]) {
    await viewer.locator(`[data-testid="${toggle}"]`).click();
    await expectUnchanged(`collapsing ${toggle}`);
    await viewer.locator(`[data-testid="${toggle}"]`).click();
    await expectUnchanged(`restoring ${toggle}`);
  }
});

test("opens narration in a full-stage modal and keeps its controls in reach", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await waitForStage(page);
  const viewer = page.locator("mango-viewer");
  const stageBefore = await measureStage(page);

  await viewer.locator('[data-testid="inspector-group-timing"]').click();
  await viewer.locator('[data-testid="inspector-activate-audio-timing"]').click();
  const footer = viewer.locator(".stage__bottom");
  const narration = footer.locator(".story-wide-narration");
  const dialog = footer.locator('.story-wide-modal__panel');
  const sidebars = viewer.locator('.panel-stack--left, .panel-stack--right');
  const sidebarToggles = viewer.locator('.builder-panel-toggle');
  await expect(narration).toBeVisible();
  await expect(dialog).toHaveAttribute('role', 'dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(sidebars.first()).toHaveCSS('visibility', 'hidden');
  await expect(sidebars.last()).toHaveCSS('visibility', 'hidden');
  await expect(sidebarToggles.first()).toHaveCSS('visibility', 'hidden');
  await expect(sidebarToggles.last()).toHaveCSS('visibility', 'hidden');

  // Modal: the footer fills the stage as an overlay, not a row of it.
  const position = await footer.evaluate((element) => getComputedStyle(element).position);
  expect(position).toBe("absolute");
  const stageAfter = await measureStage(page);
  expect(Math.round(stageAfter.height)).toBe(Math.round(stageBefore.height));

  const footerBox = await footer.boundingBox();
  const stageBox = await viewer.locator(".stage--story-builder").boundingBox();
  const dialogBox = await dialog.boundingBox();
  expect(footerBox && stageBox && dialogBox).toBeTruthy();
  if (!footerBox || !stageBox || !dialogBox) return;
  expect(Math.round(footerBox.x)).toBe(Math.round(stageBox.x));
  expect(Math.round(footerBox.y)).toBe(Math.round(stageBox.y));
  expect(Math.round(footerBox.width)).toBe(Math.round(stageBox.width));
  expect(Math.round(footerBox.height)).toBe(Math.round(stageBox.height));
  expect(dialogBox.width).toBeGreaterThan(stageBox.width * 0.6);
  expect(dialogBox.y).toBeGreaterThanOrEqual(stageBox.y);
  expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(
    stageBox.y + stageBox.height + 1,
  );
  await expect(
    narration.getByRole("button", { name: "Apply to chapter" }),
  ).toBeVisible();
  await footer.locator('.story-wide-modal__done').click();
  await expect(sidebars.first()).toHaveCSS('visibility', 'visible');
  await expect(sidebars.last()).toHaveCSS('visibility', 'visible');
  await expect(sidebarToggles.first()).toHaveCSS('visibility', 'visible');
  await expect(sidebarToggles.last()).toHaveCSS('visibility', 'visible');
});

test("keeps audio and video timing inside the modal without resizing the stage", async ({
  page,
}) => {
  /*
   * Media timing is the one bottom-slot panel an image chapter never shows,
   * so it is measured on an audio chapter of the showcase story. The stage
   * there is the AV player rather than OpenSeadragon, and the box that must
   * not move is the media area.
   */
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/story-builder.html?iiif-content=test-story/feature-showcase.json");
  const viewer = page.locator("mango-viewer");
  const audioRow = viewer.locator('[data-testid="chapter-row-chapter_11"]');
  await expect(audioRow).toBeVisible({ timeout: 30_000 });
  await audioRow.locator("button").first().click();

  await viewer.locator('[data-testid="inspector-group-timing"]').click();
  const mediaTiming = viewer.locator('[data-testid="inspector-activate-media-timing"]');
  await expect(mediaTiming).toBeVisible({ timeout: 30_000 });
  const media = viewer.locator(".stage__media");
  const measure = () =>
    media.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return [Math.round(rect.width), Math.round(rect.height)];
    });
  await expect.poll(() => measure().then(([, h]) => h)).toBeGreaterThan(0);
  const before = await measure();

  await mediaTiming.click();
  await expect(viewer.locator(".stage__bottom")).toBeVisible();
  await expect(viewer.locator('.story-wide-modal__panel')).toHaveAttribute(
    'role',
    'dialog',
  );
  await expect(viewer.locator('.panel-stack--left')).toHaveCSS(
    'visibility',
    'hidden',
  );
  await expect(viewer.locator('.panel-stack--right')).toHaveCSS(
    'visibility',
    'hidden',
  );
  await expect(viewer.locator('.builder-panel-toggle').first()).toHaveCSS(
    'visibility',
    'hidden',
  );
  await expect(viewer.locator('.builder-panel-toggle').last()).toHaveCSS(
    'visibility',
    'hidden',
  );
  await expect.poll(measure, { message: "media area after opening media timing" }).toEqual(before);

  await viewer.locator('.story-wide-modal__done').click();
  await expect(viewer.locator('.panel-stack--left')).toHaveCSS(
    'visibility',
    'visible',
  );
  await expect(viewer.locator('.panel-stack--right')).toHaveCSS(
    'visibility',
    'visible',
  );
  await expect(viewer.locator('.builder-panel-toggle').first()).toHaveCSS(
    'visibility',
    'visible',
  );
  await expect(viewer.locator('.builder-panel-toggle').last()).toHaveCSS(
    'visibility',
    'visible',
  );
  await expect.poll(measure, { message: "media area after closing media timing" }).toEqual(before);

  // Video chapters move the player into the timing modal instead of leaving a
  // second, blurred player in the normal canvas workspace.
  const videoRow = viewer.locator('[data-testid="chapter-row-chapter_13"]');
  await expect(videoRow).toBeVisible({ timeout: 30_000 });
  await videoRow.locator('button').first().click();
  await viewer.locator('[data-testid="inspector-group-timing"]').click();
  const videoTiming = viewer.locator(
    '[data-testid="inspector-activate-media-timing"]',
  );
  await expect(videoTiming).toBeVisible({ timeout: 30_000 });
  await videoTiming.click();

  const videoPreview = viewer.locator(
    '[data-testid="chapter-media-video-preview"]',
  );
  await expect(videoPreview).toBeVisible();
  await expect(videoPreview).toHaveAttribute('src', /\S+/);
  await expect(viewer.locator('.panel-stack--left')).toHaveCSS(
    'visibility',
    'hidden',
  );
  await expect(viewer.locator('.panel-stack--right')).toHaveCSS(
    'visibility',
    'hidden',
  );
  await expect(viewer.locator('.builder-panel-toggle').first()).toHaveCSS(
    'visibility',
    'hidden',
  );
  await expect(viewer.locator('.builder-panel-toggle').last()).toHaveCSS(
    'visibility',
    'hidden',
  );
  await expect(viewer.locator('.stage__primary')).toHaveCSS(
    'visibility',
    'hidden',
  );
});

test("hides both sidebars while annotations are being created", async ({
  page,
}) => {
  await page.setViewportSize({ width: 543, height: 591 });
  await waitForStage(page);
  const viewer = page.locator('mango-viewer');
  const chaptersToggle = viewer.locator('[data-testid="builder-toggle-chapters"]');
  if ((await chaptersToggle.getAttribute('aria-expanded')) !== 'true') {
    await chaptersToggle.click();
  }
  await viewer.getByRole('button').filter({ hasText: 'Chapter 6' }).first().click();
  const toolsToggle = viewer.locator('[data-testid="builder-toggle-tools"]');
  if ((await toolsToggle.getAttribute('aria-expanded')) !== 'true') {
    await toolsToggle.click();
  }
  await viewer.locator('[data-testid="inspector-activate-focus"]').click();

  const chapters = viewer.locator('.panel-stack--left');
  const inspector = viewer.locator('.panel-stack--right');
  const stage = viewer.locator('.stage--story-builder');
  await expect(chapters).toHaveCSS('visibility', 'hidden');
  await expect(inspector).toHaveCSS('visibility', 'hidden');
  await expect(chaptersToggle).toHaveCSS('visibility', 'hidden');
  await expect(toolsToggle).toHaveCSS('visibility', 'hidden');
  await expect(
    viewer.locator('.story-wide-authoring--annotations'),
  ).toBeVisible();

  const done = viewer.locator('[data-testid="story-wide-done"]');
  const doneBox = await done.boundingBox();
  const stageBox = await stage.boundingBox();
  expect(doneBox && stageBox).toBeTruthy();
  if (!doneBox || !stageBox) return;
  expect(doneBox.x + doneBox.width).toBeLessThanOrEqual(
    stageBox.x + stageBox.width,
  );

  await done.click();
  await expect(inspector).toHaveCSS('visibility', 'visible');
  await expect(toolsToggle).toHaveCSS('visibility', 'visible');
  await expect(stage).toHaveCSS('z-index', '0');
  await expect(viewer.locator('.story-builder-overlay-root')).toHaveCSS(
    'z-index',
    '3',
  );
  await expect(chapters).toHaveCSS('z-index', '6');
  await expect(inspector).toHaveCSS('z-index', '6');
});
