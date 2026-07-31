# Viewer issues — 30 Jul 2026

Written at the end of a session that added the embed placement API and demo. Item 1
is the one that needs a decision before anything else; the rest are loose ends
recorded so they are not lost.

---

## 1. `main` has a Gallery-button change that can strand the viewer — REVERT IS UNCOMMITTED

**Priority: high.** This is a live regression on the default branch.

### State

- `67cbb42` (on `main`) contains the broken attempt: `THUMBNAIL_STRIP_MIN_HEIGHT`,
  `thumbnailStripHidden()` and a `setLayoutMode('gallery')` branch in
  `handleGalleryOpen`, plus `galleryActive={showThumbnailsEffectiveStory || $layoutMode === 'gallery'}`.
- The revert is **uncommitted** in the working tree (`src/lib/features/viewer/ViewerLayout.svelte`).
  Committing it restores the original behaviour exactly.

### What goes wrong

Below 560px element height the thumbnail strip is hidden by container query
(`ViewerLayout.svelte:3612`). The attempted fix routed the Gallery button to the full
gallery layout at those heights instead of toggling the hidden strip.

`showThumbnails` is flipped asynchronously by the short-layout pass, so a press meant
as "close" can land *after* the close has already happened, be read as "open", and
switch the stage to gallery view — where `.stage__media` does not exist. Nothing
switches it back, so the viewer is left with no image and no route out.

Passing the button's rendered state through the event does **not** fix it: the click
handler still reads the live reactive value, so the race just moves.

### Evidence

`tests/e2e/responsive-matrix.spec.ts:321` hangs waiting for `.stage__media`. The
Playwright failure snapshot shows the stage holding a numbered thumbnail grid and the
Gallery button still `[pressed]`.

Measured failure rate of that test, 320px layout, mobile-webkit:

| Tree | Failures |
| --- | --- |
| Clean (no session changes) | 1 / 10 |
| With the Gallery change | ~2 / 6 |
| With the revert applied | 0 / 16 |

So a pre-existing race does exist at roughly 10%, but the change was responsible for
most failures and converted a transient race into a terminal stuck state.

### Action

1. Commit the revert. It is a strict improvement on what is on `main`.
2. Treat the underlying bug (item 2) as separate work.

---

## 2. Gallery button does nothing in short embeds (pre-existing)

**Priority: medium.** Predates this session; the revert above restores it, it does not
cause it.

Below 560px element height the strip is hidden, but the dock button still toggles
`showThumbnails` — so it flips state nothing can render and appears dead. The comment
above the CSS rung already claims the intended behaviour it does not deliver:

> the dock's Gallery button still opens the full gallery view, so nothing becomes unreachable

### Why the obvious fix is unsafe as things stand

The button's *displayed state* and its *action* are derived from different sources, and
those sources settle at different times. Any fix that keeps consulting `showThumbnails`
at short heights inherits the race in item 1.

### Suggested approach

- Add a reactive "thumbnail strip is hidden" flag keyed to the **same 560px threshold
  the stylesheet uses**.
- Derive both `galleryActive` and the click handler from that one flag, so state and
  action cannot disagree.
- Reconcile `SHORT_LAYOUT_HEIGHT` (`ViewerLayout.svelte:85`, currently **500**) with the
  CSS rung (`ViewerLayout.svelte:3612`, currently **560**). They express the same idea
  with different numbers, which is part of why this is fragile.

At short heights the button should then reflect and toggle gallery layout **only**,
never `showThumbnails`. `responsive-matrix.spec.ts:321` would read `aria-pressed=false`,
never click, and the stuck state becomes unreachable rather than merely unlikely.

### Verification

Re-run the 320px test in isolation ~16 times and compare against the table in item 1.
A single green full-suite run proves nothing here — the rate is too low.

---

## 3. Pre-existing e2e flakiness

**Priority: low**, currently masked by `retries: 2` on CI (`playwright.config.ts`).

- `tests/e2e/handheld.spec.ts:217` — "contains /index.html within the custom-element
  height". Fails roughly 1 in 3 full runs. **Confirmed on an unmodified checkout.**
- `tests/e2e/responsive-matrix.spec.ts:321` — ~1 / 10 on a clean tree even after item 1
  is reverted.

Both are timing races, not assertion failures: they burn the whole per-test budget
waiting on an element. Retries make CI green but do not fix them, and they will keep
absorbing real regressions if left alone — item 1 hid inside this noise for several
rounds and I twice called it pre-existing on samples that were too small.

---

## 4. Smaller loose ends

- **`backdrop-filter` dropped in the build.** The floating toolbar declares
  `backdrop-filter: blur(12px)`, but the built bundle computes it to `none`. Cosmetic
  only — the panel is 78% opaque — but if the frosted effect is wanted, something in the
  CSS pipeline is dropping it.
- **`annotation-editor.html:23` points at a dead image service.** The manifest
  (`api.artic.edu/.../80607`) parses, but its image service returns **403**, so tiles
  never load. Worth swapping for a reachable manifest.
- **Harvard and Yale image services are unreachable from CI.** The embeds on
  `embed-third-party.html` render locally but their tiles do not load on GitHub runners,
  so the e2e placement guard deliberately targets the Wellcome embed instead. Noted in a
  comment on the demo page.
- **`npm run lint` crashes.** `TypeError: Cannot read properties of undefined (reading
  'type')` in `@typescript-eslint/no-unused-vars` on
  `src/lib/story/ui/StoryBuilderWideAuthoring.svelte`. Reproduced on a clean checkout —
  an eslint 10 / typescript-eslint incompatibility, not a code problem. CI does not run
  lint, so nothing is blocked, but lint currently covers nothing.
- **Metadata panel behind the toolbar — fixed, but note the approach.** Solved by
  raising the drawer and backdrop above the toolbar in the stacking order (z-index
  14/13/12). The earlier attempt reserved space with `padding-bottom` instead and broke
  two pinned handheld containment tests; that drawer rule is load-bearing for the 320px
  layouts, so prefer paint-order changes to geometry there.
