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
