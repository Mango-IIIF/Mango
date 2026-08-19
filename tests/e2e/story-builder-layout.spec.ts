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

test("keeps the current view in step with the stage after a window resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await waitForStage(page);
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

  // A different window is the one layout change no floating chrome can
  // absorb: the stage itself has to take the new shape.
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
  // The change was announced, and what was announced last is the stage as
  // it is now — not the shape it had before the resize.
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

  const openTask = async (task: string) => {
    await viewer.locator(`[data-task-id="${task}"] button`).click();
  };
  const closeTask = async () => {
    // Every open task has the same way back to the chapter tools.
    await viewer
      .locator(".chapter-overlay__task:not([hidden]) .chapter-overlay__task-back")
      .click();
  };

  for (const task of ["focus", "motion", "audio-timing", "position"]) {
    await openTask(task);
    // The tool's own panel has appeared...
    if (task !== "position") {
      await expect(viewer.locator(".stage__bottom")).toBeVisible();
    }
    // ...and the picture has not flinched.
    await expectUnchanged(`opening ${task}`);
    await closeTask();
    await expectUnchanged(`closing ${task}`);
  }

  // Collapsing and restoring each column.
  for (const toggle of ["builder-toggle-chapters", "builder-toggle-tools"]) {
    await viewer.locator(`[data-testid="${toggle}"]`).click();
    await expectUnchanged(`collapsing ${toggle}`);
    await viewer.locator(`[data-testid="${toggle}"]`).click();
    await expectUnchanged(`restoring ${toggle}`);
  }
});

test("floats the narration editor over the stage and keeps its controls in reach", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await waitForStage(page);
  const viewer = page.locator("mango-viewer");
  const stageBefore = await measureStage(page);

  await viewer.locator('[data-task-id="audio-timing"] button').click();
  const footer = viewer.locator(".stage__bottom");
  const narration = footer.locator(".story-wide-narration");
  await expect(narration).toBeVisible();

  // Floating: positioned over the stage, not a row of it.
  const position = await footer.evaluate((element) => getComputedStyle(element).position);
  expect(position).toBe("absolute");
  const stageAfter = await measureStage(page);
  expect(Math.round(stageAfter.height)).toBe(Math.round(stageBefore.height));

  // The author can still make it taller, and it never buries the toolbar or
  // runs past the stage.
  await narration.evaluate((element: HTMLElement) => {
    element.style.height = "380px";
  });
  const footerBox = await footer.boundingBox();
  const toolbar = viewer.locator(".stage__toolbar--below");
  const toolbarBox = await toolbar.boundingBox();
  const stageBox = await viewer.locator(".stage--story-builder").boundingBox();
  expect(footerBox && toolbarBox && stageBox).toBeTruthy();
  if (!footerBox || !toolbarBox || !stageBox) return;
  expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(toolbarBox.y + 1);
  expect(footerBox.y).toBeGreaterThanOrEqual(stageBox.y);
  await expect(
    narration.getByRole("button", { name: "Apply to chapter" }),
  ).toBeVisible();
});

test("leaves an audio chapter's stage the same size when media timing opens", async ({
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

  const mediaTiming = viewer.locator('[data-task-id="media-timing"] button');
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
  await expect.poll(measure, { message: "media area after opening media timing" }).toEqual(before);

  await viewer
    .locator(".chapter-overlay__task:not([hidden]) .chapter-overlay__task-back")
    .click();
  await expect.poll(measure, { message: "media area after closing media timing" }).toEqual(before);
});
