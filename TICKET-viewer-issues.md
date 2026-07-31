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

### Approach that was tried and rejected — do not repeat it

The suggestion originally recorded here was: add a reactive "strip is hidden" flag keyed
to the 560px rung, and derive both `galleryActive` and the click handler from it, so the
button's state and its action share one source.

**That was implemented and measured. It does not work: 3 / 16 failures**, against 0 / 16
for simply reverting. The failure artifact again showed the gallery grid rendered and
the button `[pressed]`.

The reason is worth recording. The flag is updated by a `ResizeObserver`, so it is
*asynchronous too*. Between the host being resized and the observer firing, the flag is
stale: the button renders with "strip" semantics while a click landing in that window is
handled with "gallery" semantics. Sharing one source removes the disagreement between
`showThumbnails` and the button, but introduces the same disagreement one level down.

Generalising is the useful lesson: **any fix that changes what the button *means* based
on an asynchronously-updated size flag will race.** The window shrinks, it does not
close.

### Approach worth trying instead

Keep the button's meaning constant — it always toggles `showThumbnails` — and change
what that *renders* at short heights. Below the rung, have "thumbnails open" draw the
gallery view in place of the strip, rather than switching `layoutMode`.

The button then has one meaning at every size, there is no size-dependent branch in the
handler, and nothing to race. It is a rendering change rather than a behavioural one,
which is also why it should not disturb the pinned layout tests.

Note on the two constants: `SHORT_LAYOUT_HEIGHT` (`ViewerLayout.svelte:85`, **500**) and
the CSS rung (**560**) look like the same idea but are not — the first decides when the
dock goes compact, the second whether the strip can render at all. Leave them distinct.

### Verification

Re-run the 320px test in isolation **~16 times** and compare against the table in item 1.
A single green full-suite run proves nothing — the rate is too low. Beware of measuring
while anything else touches port 4173 or rebuilds `apps/demo/dist`: a contended run
produced a false 3/16 that took a second, clean measurement to disprove.

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
- **~~`annotation-editor.html:23` points at a dead image service.~~ FIXED.** Swapped to
  the IIIF Cookbook `0005-image-service` manifest, which renders with no console errors.
  **But the dead `api.artic.edu` service is referenced far more widely** — including
  `apps/demo/test-story/demo.json` and `feature-showcase.json`, which the story e2e specs
  load, plus the react-app and vue-app copies. Those chapters target a canvas whose tiles
  return 403, so any story test touching them is working with an image that never loads.
  That is a plausible contributor to the story-related flakiness and is worth its own
  pass; it was left alone here because rewriting story fixtures means keeping canvas ids
  consistent across four files.
- **Harvard and Yale image services are unreachable from CI.** The embeds on
  `embed-third-party.html` render locally but their tiles do not load on GitHub runners,
  so the e2e placement guard deliberately targets the Wellcome embed instead. Noted in a
  comment on the demo page.
- **~~`npm run lint` crashes.~~ FIXED — and it was a code problem after all.** The crash
  is upstream (`@typescript-eslint/no-unused-vars` has no `default` in its
  `defToVariableType` switch, so an unrecognised definition type returns `undefined` and
  it dereferences `.type`), but it only fires when the rule tries to *report* something.
  `svelte-eslint-parser` labels Svelte 5 runes `ComputedVariable`, which the rule does not
  know — so an **unused `$derived` crashes the linter**. The trigger was a genuinely dead
  `$: durationSeconds` in `StoryBuilderWideAuthoring.svelte`. Removing it, plus the real
  errors that then surfaced, gets `npm run lint` to exit 0:
  - dead type import in `story/normalizeAnnotations.ts`
  - `ViewBox` used but never imported in `story/ui/ChapterOverlay.svelte` — a real bug
    `no-undef` caught, hidden because `tsconfig.build.json` does not type-check `.svelte`
  - dead component import in `viewer/ui/LeftPanelStack.svelte`

  Still fragile: the next unused rune will crash it again until upstream adds a default.

- **The Svelte lint rules have never actually run.** `eslint.config.mjs` does
  `...sveltePlugin.configs.recommended.rules`, but in eslint-plugin-svelte v3 that config
  is a flat-config **array**, so `.rules` is `undefined` and the spread contributes
  nothing. Enabling it properly (`...sveltePlugin.configs.recommended` in the top-level
  array) surfaces **56 errors**. Left off deliberately — that backlog is its own piece of
  work. It is also why the two remaining "unused eslint-disable directive" warnings
  appear: those `svelte/no-at-html-tags` disables are inert only because the rule is off,
  so they should be kept, not deleted.
- **Metadata panel behind the toolbar — fixed, but note the approach.** Solved by
  raising the drawer and backdrop above the toolbar in the stacking order (z-index
  14/13/12). The earlier attempt reserved space with `padding-bottom` instead and broke
  two pinned handheld containment tests; that drawer rule is load-bearing for the 320px
  layouts, so prefer paint-order changes to geometry there.
