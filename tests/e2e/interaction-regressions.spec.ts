import { expect, test, type Page } from "@playwright/test";

/*
 * Regression cover for three interaction bugs that every static layout check
 * passed straight through. Each one asserts observable behaviour under a real
 * gesture rather than a CSS property, because in all three cases the CSS looked
 * correct while the viewer was unusable.
 */

const settle = async (page: Page, selector: string) => {
  await page.locator(`mango-viewer ${selector}`).first().waitFor();
  await page.waitForTimeout(3500);
};

/** Drives a genuine touch scroll; dispatching `touchmove` alone does not scroll. */
const fingerSwipe = async (
  page: Page,
  x: number,
  y: number,
  dx: number,
  dy: number,
) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 12; i += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + (dx * i) / 12, y: y + (dy * i) / 12 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(400);
  await cdp.detach();
};

test.describe("viewer interaction regressions", () => {
  test.use({ hasTouch: true });

  test("revealing the controls never slides the mobile toolbar sideways", async ({
    page,
  }) => {
    // The floating desktop toolbar centres itself with translateX(-50%). The
    // mobile bar is static and full width, so inheriting that translate moved it
    // half its own width left on the first tap that revealed the controls.
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto("/viewer.html");
    await settle(page, ".stage__media");

    const offsetFromFrame = () =>
      page.evaluate(() => {
        const root = document.querySelector("mango-viewer")!.shadowRoot!;
        const toolbar = root.querySelector(".stage__toolbar")!;
        const frame = root.querySelector(".stage__viewer-frame")!;
        return Math.round(
          toolbar.getBoundingClientRect().x - frame.getBoundingClientRect().x,
        );
      });

    const before = await offsetFromFrame();
    await page
      .locator("mango-viewer")
      .getByRole("button", { name: /^home$|reset/i })
      .first()
      .click({ force: true });
    await page.waitForTimeout(700);
    expect(await offsetFromFrame()).toBe(before);

    const canvas = await page.locator("mango-viewer .stage__media").boundingBox();
    await page.mouse.click(
      canvas!.x + canvas!.width / 2,
      canvas!.y + canvas!.height / 2,
    );
    await page.waitForTimeout(700);
    expect(await offsetFromFrame()).toBe(before);
  });

  test("a finger can scroll the mobile dock rail to its hidden icons", async ({
    page,
  }) => {
    // The rail owns the scrolling while the nav inside it must not be a scroll
    // container: as one with zero scrollable extent plus
    // `overscroll-behavior-x: contain`, it swallowed the gesture and left the
    // trailing icons unreachable by touch.
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto("/viewer.html");
    await settle(page, ".stage__media");

    await page
      .locator("mango-viewer")
      .evaluate((element) => element.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(400);

    const rail = await page.evaluate(() => {
      const root = document.querySelector("mango-viewer")!.shadowRoot!;
      const element = root.querySelector(".viewer__control-rail") as HTMLElement;
      element.scrollLeft = 0;
      const box = element.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        extent: element.scrollWidth - element.clientWidth,
        inWindow: box.y >= 0 && box.y + box.height <= window.innerHeight,
      };
    });
    expect(rail.extent).toBeGreaterThan(40);
    expect(rail.inWindow).toBe(true);

    await fingerSwipe(
      page,
      rail.x + rail.width / 2,
      rail.y + rail.height / 2,
      -140,
      0,
    );

    const scrolled = await page.evaluate(() =>
      Math.round(
        document
          .querySelector("mango-viewer")!
          .shadowRoot!.querySelector(".viewer__control-rail")!.scrollLeft,
      ),
    );
    expect(scrolled).toBeGreaterThan(40);
  });

  test("can keep annotation overlays visible after closing the mobile panel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto("/viewer.html");
    await settle(page, ".stage__media");

    await page.locator("mango-viewer").evaluate(async (element: any) => {
      await element.addAnnotation({
        id: "persistent-mobile-annotation",
        text: "Persistent mobile annotation",
        rect: { x: 300, y: 300, w: 600, h: 600 },
      });
    });

    const viewer = page.locator("mango-viewer");
    await viewer.getByRole("button", { name: "Annotations", exact: true }).click({ force: true });
    const shape = viewer.locator('[data-annotation-id="persistent-mobile-annotation"]');
    await expect(shape).toHaveCount(1);

    const keepVisible = viewer.getByRole("switch", { name: /Keep annotations visible/ });
    await keepVisible.click();
    await expect(keepVisible).toHaveAttribute("aria-checked", "true");
    await viewer.getByRole("button", { name: "Close annotation editor" }).click();

    await expect(viewer.locator(".panel--editor")).toBeHidden();
    await expect(shape).toHaveCount(1);
  });

  test("dragging the image pans it instead of fighting the pointer", async ({
    page,
  }) => {
    // Re-centring from inside OSD's `pan`/`zoom` handlers moved the viewport back
    // on every frame of a drag: the image stuttered and, whenever it was narrower
    // than the surface, horizontal panning was frozen outright.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/viewer.html");
    await settle(page, ".stage__media");

    const viewBox = () =>
      page.evaluate(() => {
        const element = document.querySelector("mango-viewer") as HTMLElement & {
          getViewBox: () => { x: number; y: number; w: number; h: number };
        };
        const box = element.getViewBox();
        return { x: Math.round(box.x), y: Math.round(box.y) };
      });

    // Deliberately a modest zoom, where this portrait image is still narrower
    // than the stage. That is the case the old code froze: it forced the centre
    // back to home on the horizontal axis on every single pan event.
    await page.evaluate(() => {
      const element = document.querySelector("mango-viewer") as HTMLElement & {
        getViewBox: () => { x: number; y: number; w: number; h: number };
        setViewBox: (box: {
          x: number;
          y: number;
          w: number;
          h: number;
        }) => void;
      };
      const box = element.getViewBox();
      element.setViewBox({
        x: box.x + box.w * 0.25,
        y: box.y + box.h * 0.25,
        w: box.w / 1.5,
        h: box.h / 1.5,
      });
    });
    await page.waitForTimeout(900);

    const canvas = await page
      .locator("mango-viewer .openseadragon-canvas")
      .boundingBox();
    const cx = canvas!.x + canvas!.width / 2;
    const cy = canvas!.y + canvas!.height / 2;

    const start = await viewBox();
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    const horizontal: number[] = [];
    const vertical: number[] = [];
    for (let i = 1; i <= 5; i += 1) {
      await page.mouse.move(cx - i * 26, cy - i * 24, { steps: 2 });
      await page.waitForTimeout(100);
      const box = await viewBox();
      horizontal.push(box.x);
      vertical.push(box.y);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Both axes must track the pointer for the whole gesture, never reversing.
    // Anything that re-centres mid-drag shows up as a frozen or bouncing series.
    // (The horizontal axis may settle back after release once the gesture ends —
    // that is the constraint doing its job, so only the drag itself is asserted.)
    expect(horizontal[horizontal.length - 1]).toBeGreaterThan(start.x + 5);
    expect(vertical[vertical.length - 1]).toBeGreaterThan(start.y + 5);
    for (let i = 1; i < horizontal.length; i += 1) {
      expect(horizontal[i]).toBeGreaterThanOrEqual(horizontal[i - 1] - 1);
      expect(vertical[i]).toBeGreaterThanOrEqual(vertical[i - 1] - 1);
    }
  });

  test("keeps the annotation editor multi-column on an ordinary laptop", async ({
    page,
  }) => {
    // The editor collapsed to a single stacked column below 1200px, so a 1280px
    // laptop lost the list/canvas/inspector layout entirely. Three columns need
    // roughly 1000px, so the collapse belongs at the 1024px breakpoint the rest
    // of the viewer uses.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/annotation-editor.html");
    await settle(page, ".annotation-workspace");

    const layout = await page.evaluate(() => {
      const workspace = document
        .querySelector("mango-viewer")!
        .shadowRoot!.querySelector(".annotation-workspace")!;
      const columns = getComputedStyle(workspace).gridTemplateColumns.split(" ");
      const centre = workspace.querySelector(".annotation-workspace__center");
      return {
        columnCount: columns.length,
        canvasWidth: centre
          ? Math.round(centre.getBoundingClientRect().width)
          : 0,
      };
    });
    expect(layout.columnCount).toBe(3);
    expect(layout.canvasWidth).toBeGreaterThan(400);
  });

  test("lets the wheel reach the bottom of the story builder authoring panel", async ({
    page,
  }) => {
    // The panel had `overscroll-behavior-y: contain` with only ~20px of its own
    // scroll, so the wheel stopped dead there and never handed the remaining
    // scroll to the stage — the Apply control stayed out of reach.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/story-builder.html?iiif-content=test-story/demo.json");
    await page.waitForTimeout(4000);
    await page
      .locator('[data-task-id="audio-timing"] button')
      .first()
      .click({ timeout: 10000 });
    await page.waitForTimeout(2500);

    const panel = await page.evaluate(() => {
      const element = document
        .querySelector("mango-viewer")!
        .shadowRoot!.querySelector(".story-wide-narration")!;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });

    await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2);
    for (let i = 0; i < 14; i += 1) {
      await page.mouse.wheel(0, 220);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => {
      const root = document.querySelector("mango-viewer")!.shadowRoot!;
      const narration = root.querySelector(".story-wide-narration")!;
      const stage = root.querySelector(".stage--story-builder")!;
      const trapsGesture =
        getComputedStyle(narration).overscrollBehaviorY === "contain";
      const controls = [...narration.querySelectorAll("button, input")];
      const last = controls[controls.length - 1];
      const viewer = root.querySelector(".viewer")!.getBoundingClientRect();
      const rect = last.getBoundingClientRect();
      return {
        trapsGesture,
        panelAtEnd:
          narration.scrollTop >=
          narration.scrollHeight - narration.clientHeight - 1,
        stageScrolled: Math.round(stage.scrollTop),
        stageExtent: stage.scrollHeight - stage.clientHeight,
        lastControlVisible:
          rect.height > 0 &&
          rect.y >= viewer.y - 1 &&
          rect.y + rect.height <= viewer.y + viewer.height + 1,
      };
    });

    // This panel holds only a few dozen pixels of scroll while the stage holds
    // the rest, so it must not contain the gesture: whether or not a given
    // window size happens to expose the symptom, containing it here is what
    // stops the wheel partway down the editor.
    expect(state.trapsGesture).toBe(false);
    expect(state.panelAtEnd).toBe(true);
    if (state.stageExtent > 5) {
      expect(state.stageScrolled).toBeGreaterThan(5);
    }
    expect(state.lastControlVisible).toBe(true);
  });
});

test.describe("layout containment", () => {
  /*
   * The stage must never be wider than the element that contains it. It was:
   * the mobile dock rail is `width: max-content` (~541px), and the single grid
   * column was a bare `1fr` — which floors at the content's min-content width —
   * so on iOS a 361px-wide element resolved a 541px column. The image was then
   * laid out in a box wider than the viewer and appeared shoved right and
   * cropped. Every track that holds the stage must be zero-floored.
   */
  for (const viewport of [
    { name: "phone", width: 390, height: 664 },
    { name: "small phone", width: 320, height: 568 },
    { name: "tablet", width: 820, height: 1180 },
  ]) {
    test(`stage never outgrows the viewer on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/viewer.html");
      await page.locator("mango-viewer .stage__media").first().waitFor();
      await page.waitForTimeout(3500);

      const boxes = await page.evaluate(() => {
        const root = document.querySelector("mango-viewer")!.shadowRoot!;
        const width = (selector: string) => {
          const element = root.querySelector(selector);
          return element
            ? Math.round(element.getBoundingClientRect().width)
            : null;
        };
        const grid = root.querySelector(".viewer__grid")!;
        return {
          viewer: width(".viewer"),
          grid: width(".viewer__grid"),
          gridScrollWidth: grid.scrollWidth,
          gridClientWidth: grid.clientWidth,
          stage: width(".stage"),
          media: width(".stage__media"),
        };
      });

      expect(boxes.stage!).toBeLessThanOrEqual(boxes.viewer!);
      expect(boxes.media!).toBeLessThanOrEqual(boxes.viewer!);
      expect(boxes.gridScrollWidth).toBeLessThanOrEqual(
        boxes.gridClientWidth + 1,
      );
    });
  }
});
