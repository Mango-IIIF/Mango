# Developer and architecture guide

This guide is for contributors working on Mango itself. Integrators embedding
the package should begin with [getting started](Getting-Started) and
[configuration](Configuration).

## Set up a checkout

Requirements:

- a current Node.js release supported by the project;
- npm 10 or a compatible npm release; and
- a Chromium-compatible browser for the Playwright checks.

Install exactly from the lockfile:

```bash
npm ci
```

Start the demo development server:

```bash
npm run dev
```

The pages in `apps/demo` exercise the built custom element, viewer modes,
framework integrations, configuration, annotations, stories, and IIIF Cookbook
fixtures. When changing browser-facing behaviour, verify the exact demo entry
point that uses it.

## Architecture at a glance

```text
Manifest URL
    |
    v
Manifest cache and manifesto.js adapter
    |
    +--> writable viewer state
    +--> derived selectors and media/annotation resolvers
    +--> controllers and event bus
             |
             v
       renderer selection
       image | audio/video | PDF | 3D
             |
             v
       Svelte viewer UI / custom element / plugins
```

The main viewer uses Svelte `writable` and `derived` stores. Story and workspace
areas also use Svelte 5 rune-based state. Do not assume every `.svelte.ts` module
and every viewer store use the same reactivity model.

## Source map

| Path                                      | Responsibility                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `src/lib/index.ts`                        | `Mango` class and package-root exports                                  |
| `src/lib/components/Viewer.svelte`        | Shared viewer component and public adapter methods                      |
| `src/lib/components/ViewerElement.svelte` | `<mango-viewer>` properties and custom-element boundary                 |
| `src/lib/core/types`                      | Public and shared TypeScript contracts                                  |
| `src/lib/viewer/state`                    | Viewer stores, selectors, controller, and feature controllers           |
| `src/lib/viewer/iiif`                     | Manifest metadata, thumbnails, and manifesto adapters                   |
| `src/lib/iiif`                            | Media and annotation resolution                                         |
| `src/lib/renderers`                       | Image, A/V, PDF, and 3D renderer components                             |
| `src/lib/viewer/ui`                       | Panels, dock, stage, gallery, and viewer controls                       |
| `src/lib/story`                           | Story model operations, builder, viewer, import/export, and persistence |
| `src/lib/plugins`                         | Plugin registry, slots, lifecycle host, and built-in examples           |
| `src/lib/features/workspace`              | Multi-window workspace                                                  |
| `src/lib/features/annotations`            | Annotation editor and workspace UI                                      |
| `src/locales`                             | Translation catalogues                                                  |
| `apps/demo`                               | Real browser demos and framework examples                               |

## State and controller boundaries

`createViewerState` creates instance state such as the Manifest ID, selected
Canvas, panels, search query, viewport, media time, annotations, filters, and
layer opacity.

`createViewerDerivedStores` resolves canvases, media, metadata, annotations,
search availability, renderer modules, thumbnails, plugins, and visible UI.
Some derived modules currently initiate effects such as search and resource
loading; inspect teardown behaviour before adding another subscription.

`createViewerController` owns public mutations, event dispatch, state snapshots,
and cleanup. Smaller controllers handle canvases, media, panels, annotations,
and view state. UI components should call controllers rather than mutating stores
when a controller operation exists.

The assembled viewer context provides `state`, `derived`, and `controller` to
descendant Svelte components.

## Renderers

Mango resolves the current Canvas into a `MediaType`:

| Type             | Renderer                                   |
| ---------------- | ------------------------------------------ |
| `image`          | `ImageRenderer` and OpenSeadragon          |
| `audio`, `video` | `AVRenderer` and `@mango-iiif/av`          |
| `pdf`            | `PdfRenderer` and `pdfjs-dist`             |
| `model`          | `ModelRenderer` and `@google/model-viewer` |

Renderer components are loaded dynamically by viewer selectors so heavy PDF and
3D dependencies do not need to block every initial view. Keep renderer-specific
behaviour behind the renderer capability and API boundaries.

## Supporting packages

Mango consumes focused packages from the `@mango-iiif` namespace:

- `@mango-iiif/w3c-parser` — W3C annotation parsing and selectors;
- `@mango-iiif/annotation` — OpenSeadragon annotation interaction and drawing;
- `@mango-iiif/iiif-search-client` — Content Search discovery and parsing; and
- `@mango-iiif/av` — audio/video playback, chapters, transcripts, and tracks.

Treat these as public dependencies with their own versioned contracts. Avoid
copying their implementation back into Mango.

## Build outputs and package entry points

```bash
npm run build:lib
npm run build:element
npm run build:types
npm run build:dist
npm run build:demo
```

- `vite.config.lib.ts` builds the library and subpath entry points.
- `vite.config.element.ts` builds the standalone custom-element module.
- `tsconfig.build.json` emits public declarations.
- `scripts/sync-demo.mjs` copies built assets used by the demo.

The custom element uses an open Shadow Root. Its build captures the viewer CSS
and installs it into registered Shadow Roots. The native Svelte/class build uses
the exported `style.css`.

## Verification

Run checks appropriate to the change:

```bash
npm test
npm run test:e2e
npm run build:types
npm run lint
npm run build:demo
```

For package changes, also inspect the publishable archive:

```bash
npm pack --dry-run
```

Useful expectations:

- add focused Vitest coverage beside the changed feature;
- rebuild the demo before trusting browser results;
- use Playwright for public workflows that need real layout or browser APIs;
- verify custom-element and class/Svelte API parity when changing public methods;
- update the wiki, demos, and exported types with any public contract change; and
- do not treat a passing type build as proof that a copied documentation example
  works in a browser.

## Adding a public option, method, or event

When adding a public contract:

1. Define or update its type in `src/lib/core/types`.
2. Implement it at the controller or feature boundary.
3. Forward methods through `ViewerApiAdapter`, `Viewer.svelte`, the custom
   element, and `Mango` where that surface should support it.
4. Dispatch events through the central viewer event path so both the event bus
   and DOM custom events receive them.
5. Add API parity and behaviour tests.
6. Update [configuration](Configuration), the [API](API-Reference), or
   [events](Event-Handling), plus a real demo where useful.

## Contributions

Keep pull requests focused and explain the user-visible outcome. Include:

- the IIIF resources or fixtures used to verify the change;
- tests for new behaviour and regressions;
- screenshots or recordings for substantial UI changes;
- documentation for new public behaviour; and
- any compatibility or migration implications.

For standards-related changes, link the relevant IIIF specification and add a
small fixture or Cookbook-based test rather than relying on one remote service.
