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

        if (mode.name === "story viewer") {
          const play = host.getByTestId("story-controls-play");
          await expect(play).toBeVisible();
          await expectContained(play, viewer);
        }
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

  test("keeps story playback visible at default and site-overridden heights", async ({
    page,
  }) => {
    await page.goto("/index.html");
    const host = page.locator("mango-viewer");
    const viewer = host.locator(".viewer");
    const stage = host.locator(".story-shell__stage-wrap");
    const playback = host.locator(".story-shell__playback");
    const metadata = host.locator(".story-shell__metadata");
    const play = host.getByTestId("story-controls-play");
    const footer = host.locator(".story-shell__footer");

    for (const height of [720, 900]) {
      await host.evaluate((element, value) => {
        (element as HTMLElement).style.height = `${value}px`;
      }, height);
      await expect(play).toBeVisible();
      await expectContained(play, viewer);
      const [stageBox, playbackBox, metadataBox, playBox, footerBox] =
        await Promise.all([
          box(stage),
          box(playback),
          box(metadata),
          box(play),
          box(footer),
        ]);
      expect(stageBox.y + stageBox.height).toBeLessThanOrEqual(playbackBox.y);
      expect(playbackBox.y + playbackBox.height).toBeLessThanOrEqual(metadataBox.y);
      expect(metadataBox.y + metadataBox.height).toBeLessThanOrEqual(footerBox.y);
      expect(playBox.y + playBox.height).toBeLessThanOrEqual(footerBox.y);
    }
  });

  test("expands long chapter metadata and pushes chapters down", async ({ page }) => {
    await page.route("**/test-story/demo.json", async (route) => {
      const response = await route.fetch();
      const story = await response.json();
      story.items[0].summary.en = [
        "This is a deliberately long chapter description used to verify the portrait story layout. " +
          "It contains enough narrative text to exceed the initial metadata summary and exercise the explicit expansion control. ".repeat(
            6,
          ),
      ];
      await route.fulfill({ response, json: story });
    });
    await page.goto("/index.html");

    const host = page.locator("mango-viewer");
    const shell = host.locator(".story-shell");
    const footer = host.locator(".story-shell__footer");
    const toggle = host.locator(".story-shell__metadata-toggle");
    const collapsedFooterY = (await box(footer)).y;

    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveText("Show less");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect((await box(footer)).y).toBeGreaterThan(collapsedFooterY);
    const scrollSize = await shell.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(scrollSize.scrollHeight).toBeGreaterThan(scrollSize.clientHeight);
  });

  test("shrink-wraps the IIIF footer navigation on iPad", async ({ page }) => {
    await page.goto("/viewer.html");
    const host = page.locator("mango-viewer");
    const grid = host.locator(".viewer__grid");
    const rail = host.locator(".viewer__control-rail");
    const [gridBox, railBox] = await Promise.all([box(grid), box(rail)]);

    expect(railBox.width).toBeLessThan(gridBox.width * 0.75);
    expect(
      Math.abs(
        railBox.x + railBox.width / 2 - (gridBox.x + gridBox.width / 2),
      ),
    ).toBeLessThan(2);
    expect(railBox.height).toBe(44);
  });

  test("keeps the cookbook viewer at a useful definite height on iPad", async ({
    page,
  }) => {
    await page.goto("/cookbook.html");
    const frame = page.locator(".cookbook-viewer__frame");
    const host = frame.locator("mango-viewer");
    const viewer = host.locator(".viewer");
    const stage = host.locator(".stage");
    await expect(host).toBeVisible();
    await expect(stage).toBeVisible();

    const [frameBox, hostBox, viewerBox, stageBox] = await Promise.all([
      box(frame),
      box(host),
      box(viewer),
      box(stage),
    ]);
    expect(frameBox.height).toBeGreaterThanOrEqual(650);
    expect(hostBox.height).toBeGreaterThanOrEqual(648);
    expect(viewerBox.height).toBe(hostBox.height);
    expect(stageBox.height).toBeGreaterThan(300);
    await expectContained(stage, viewer);
  });

  for (const viewport of [
    { name: "iPad", width: 1024, height: 1366 },
    { name: "phone", width: 390, height: 664 },
  ]) {
    test(`shows loaded story thumbnails on ${viewport.name}`, async ({
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
          thumbnailImages.evaluateAll(
            (images: HTMLImageElement[]) =>
              images.filter((image) => image.complete && image.naturalWidth > 0)
                .length,
          ),
        )
        .toBeGreaterThan(1);

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

test.describe("embedded height and hostile host CSS", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("keeps the IIIF canvas and both control rows usable at 320px", async ({
    page,
  }) => {
    await page.goto("/viewer.html");
    const host = page.locator("mango-viewer");
    await host.evaluate((element) => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.width = "360px";
      htmlElement.style.height = "320px";
    });
    const thumbnails = host.getByRole("button", { name: "Gallery" });
    if ((await thumbnails.getAttribute("aria-pressed")) === "true") {
      await thumbnails.click();
    }

    const viewer = host.locator(".viewer");
    const media = host.locator(".stage__media");
    const toolbar = host.locator(".stage__toolbar--below");
    const rail = host.locator(".viewer__control-rail");
    await expect.poll(async () => (await box(rail)).height).toBe(44);
    await expectContained(media, viewer);
    await expectContained(toolbar, viewer);
    await expectContained(rail, viewer);

    const [mediaBox, toolbarBox, railBox] = await Promise.all([
      box(media),
      box(toolbar),
      box(rail),
    ]);
    expect(mediaBox.height).toBeGreaterThan(60);
    expect(mediaBox.y + mediaBox.height).toBeLessThanOrEqual(toolbarBox.y + 1);
    expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(railBox.y + 1);
  });

  test("keeps story transport and timeline reachable at a 400px embed height", async ({
    page,
  }) => {
    await page.goto("/index.html");
    const host = page.locator("mango-viewer");
    await host.evaluate((element) => {
      (element as HTMLElement).style.height = "400px";
    });

    const viewer = host.locator(".viewer");
    const play = host.getByTestId("story-controls-play");
    const timeline = host.locator(".story-shell__timeline");
    const footer = host.locator(".story-shell__footer");
    await expect(play).toBeVisible();
    await expect(timeline).toBeVisible();
    await expectContained(play, viewer);
    await expectContained(timeline, viewer);
    await expectContained(footer, viewer);

    const [timelineBox, footerBox] = await Promise.all([
      box(timeline),
      box(footer),
    ]);
    expect(timelineBox.y + timelineBox.height).toBeLessThanOrEqual(
      footerBox.y + 1,
    );
  });

  test("clamps a long landscape chapter title without losing playback", async ({
    page,
  }) => {
    await page.route("**/test-story/demo.json", async (route) => {
      const response = await route.fetch();
      const story = await response.json();
      story.items[0].label.en = [
        "A deliberately long chapter title that must never push the primary playback control outside its embed",
      ];
      await route.fulfill({ response, json: story });
    });
    await page.goto("/index.html");
    const host = page.locator("mango-viewer");
    await host.evaluate((element) => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.width = "844px";
      htmlElement.style.height = "390px";
    });

    const viewer = host.locator(".viewer");
    const title = host.locator(".story-shell__title");
    const play = host.getByTestId("story-controls-play");
    const timeline = host.locator(".story-shell__timeline");
    await expect(title).toContainText("deliberately long");
    await expectContained(play, viewer);
    await expectContained(timeline, viewer);
    const titleStyle = await title.evaluate((element) => ({
      lineClamp: getComputedStyle(element).webkitLineClamp,
      overflow: getComputedStyle(element).overflow,
    }));
    expect(titleStyle).toEqual({ lineClamp: "2", overflow: "hidden" });
  });

  test("resets inherited casing and keeps time readouts LTR", async ({ page }) => {
    await page.goto("/index.html");
    const host = page.locator("mango-viewer");
    await host.evaluate((element) => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.width = "360px";
      htmlElement.style.textTransform = "uppercase";
      htmlElement.style.lineHeight = "3";
      htmlElement.style.direction = "rtl";
    });

    const viewer = host.locator(".viewer");
    const title = host.locator(".story-shell__title");
    const timelineText = host.locator(".story-shell__timeline-text");
    expect(
      await viewer.evaluate((element) => getComputedStyle(element).textTransform),
    ).toBe("none");
    expect(
      await viewer.evaluate((element) => getComputedStyle(element).lineHeight),
    ).toBe("normal");
    expect(
      await timelineText.evaluate((element) => getComputedStyle(element).direction),
    ).toBe("ltr");
    expect(
      await title.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    ).toBeLessThan(30);
    await expect(timelineText).toContainText("00:00 / 00:");
  });
});

test.describe("phone metadata expansion", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("reveals the full long description after Show more", async ({ page }) => {
    await page.route("**/test-story/demo.json", async (route) => {
      const response = await route.fetch();
      const story = await response.json();
      story.items[0].summary.en = [
        "This long phone description verifies that expanding metadata removes the two-line clamp. ".repeat(
          8,
        ),
      ];
      await route.fulfill({ response, json: story });
    });
    await page.goto("/index.html");

    const host = page.locator("mango-viewer");
    const description = host.locator(".story-shell__description");
    const toggle = host.locator(".story-shell__metadata-toggle");
    await toggle.click();
    await expect(toggle).toHaveText("Show less");
    const expanded = await description.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      lineClamp: getComputedStyle(element).webkitLineClamp,
      overflow: getComputedStyle(element).overflow,
    }));
    expect(expanded.scrollHeight - expanded.clientHeight).toBeLessThanOrEqual(1);
    expect(expanded.lineClamp).not.toBe("2");
    expect(expanded.overflow).toBe("visible");
  });
});

test.describe("iPhone SE touch rails", () => {
  test("keeps every IIIF control reachable and the home image centred", async ({
    page,
  }) => {
    await openAt(page, "/viewer.html", { width: 375, height: 553 });
    const host = page.locator("mango-viewer");
    const toolbar = host.locator(".stage__toolbar--below");
    const rail = host.locator(".viewer__control-rail");
    const lastDockButton = host.locator(".viewer-mobile-nav__button").last();

    const toolbarSize = await toolbar.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(toolbarSize.scrollWidth).toBeLessThanOrEqual(toolbarSize.clientWidth);

    const railStyle = await rail.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX,
      touchAction: getComputedStyle(element).touchAction,
    }));
    expect(railStyle.scrollWidth).toBeGreaterThan(railStyle.clientWidth);
    expect(railStyle.overflowX).toBe("auto");
    expect(railStyle.touchAction).toBe("pan-x");
    await host.getByRole("button", { name: "Enter fullscreen" }).click();
    const railTouchAllowed = await rail.evaluate((element) =>
      element.dispatchEvent(
        new Event("touchmove", { bubbles: true, cancelable: true, composed: true }),
      ),
    );
    expect(railTouchAllowed).toBe(true);
    await rail.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expectContained(lastDockButton, rail);

    const canvas = host.locator(".openseadragon-canvas");
    await expect(canvas).toBeVisible();
    const before = await host.evaluate((element: any) => element.getViewBox());
    const canvasBox = await box(canvas);
    await page.mouse.move(
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      canvasBox.x + canvasBox.width / 2 + 100,
      canvasBox.y + canvasBox.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
    const after = await host.evaluate((element: any) => element.getViewBox());
    // The responsive frame may finish resizing while fullscreen controls
    // settle, so compare centres rather than view-box extents. This manifest's
    // 2569 × 3543 canvas must remain centred at home before and after a drag.
    expect(before.x + before.w / 2).toBeCloseTo(2569 / 2, 3);
    expect(before.y + before.h / 2).toBeCloseTo(3543 / 2, 3);
    expect(after.x + after.w / 2).toBeCloseTo(2569 / 2, 3);
    expect(after.y + after.h / 2).toBeCloseTo(3543 / 2, 3);
  });

  test("keeps the complete primary toolbar reachable at 320px", async ({ page }) => {
    await openAt(page, "/viewer.html", { width: 320, height: 568 });
    const host = page.locator("mango-viewer");
    const toolbar = host.locator(".stage__toolbar--below");
    const home = host.getByRole("button", { name: "Home" });

    /*
     * The layout here has been round-tripped. It scrolled, then wrapped —
     * scrolling put trailing controls behind a scroll port, and tapping a
     * partly visible one made the browser scroll it into view, sliding the bar
     * under the finger. Wrapping fixed that but stacked the controls into rows
     * that read poorly, so it is back to a single scrolling row, centred on
     * load.
     *
     * That trade is deliberate: at 320px the row is ~53px wider than the
     * element, so a control at each end sits partly out of view until scrolled.
     * What must stay true is that the row is one line, that every control can
     * be reached, and that none of them is clipped away with no way to get to
     * it — so assert reachability through the scroll port rather than demanding
     * everything be on screen at once.
     */
    const state = await toolbar.evaluate((element) => {
      const buttons = [...element.querySelectorAll("button")];
      const rows = new Set(
        buttons
          .filter((button) => button.getBoundingClientRect().width > 0)
          .map((button) => Math.round(button.getBoundingClientRect().y)),
      );
      const overflow = element.scrollWidth - element.clientWidth;
      return {
        buttonCount: buttons.length,
        rowCount: rows.size,
        overflow,
        // Centred on load, so the hidden part is shared between both ends.
        centred: overflow <= 0 || Math.abs(element.scrollLeft - overflow / 2) <= 2,
        // Every control lies inside the scrollable extent, i.e. reachable.
        reachable: buttons.every((button) => {
          const rect = button.getBoundingClientRect();
          if (rect.width === 0) return true;
          const box = element.getBoundingClientRect();
          const left = rect.x - box.x + element.scrollLeft;
          return left >= -1 && left + rect.width <= element.scrollWidth + 1;
        }),
      };
    });
    expect(state.buttonCount).toBeGreaterThan(4);
    expect(state.rowCount).toBe(1);
    expect(state.centred).toBe(true);
    expect(state.reachable).toBe(true);

    // Home is the last control, so it proves the far end of the row is usable.
    await home.scrollIntoViewIfNeeded();
    await expect(home).toBeVisible();
    await expectContained(home, toolbar);
  });

  test("keeps story chapters swipeable in fullscreen", async ({ page }) => {
    await openAt(page, "/index.html", { width: 320, height: 568 });
    const host = page.locator("mango-viewer");
    const viewer = host.locator(".viewer");
    const footer = host.locator(".story-shell__footer");
    await host.getByRole("button", { name: "Enter fullscreen" }).click();
    await expect(
      host.getByRole("button", { name: "Close fullscreen" }),
    ).toBeVisible();

    const styles = await footer.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX,
      touchAction: getComputedStyle(element).touchAction,
      viewerTouchAction: getComputedStyle(element.closest(".viewer")!).touchAction,
    }));
    expect(styles.scrollWidth).toBeGreaterThan(styles.clientWidth);
    expect(styles.overflowX).toBe("auto");
    expect(styles.touchAction).toBe("pan-x");
    expect(styles.viewerTouchAction).toBe("auto");

    const touchAllowed = await footer.evaluate((element) =>
      element.dispatchEvent(
        new Event("touchmove", { bubbles: true, cancelable: true, composed: true }),
      ),
    );
    expect(touchAllowed).toBe(true);

    await footer.evaluate((element) => {
      element.scrollLeft = 240;
    });
    expect(await footer.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expectContained(footer, viewer);
  });
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
