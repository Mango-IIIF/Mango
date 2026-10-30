# Mango IIIF Viewer

[![npm](https://img.shields.io/npm/v/@mango-iiif/iiif-viewer)](https://www.npmjs.com/package/@mango-iiif/iiif-viewer)
[![CI](https://github.com/Mango-IIIF/Mango/actions/workflows/ci.yml/badge.svg)](https://github.com/Mango-IIIF/Mango/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Mango is a flexible IIIF viewer for museums, libraries,
archives, galleries, and digital scholarship projects. It can be added directly
to an existing website as `<mango-viewer>` or installed as an npm dependency in
a JavaScript, React, Vue, or Svelte application.

Mango brings images, audio, video, PDFs, 3D models, annotations, metadata, and
search into one responsive interface.

## Why Mango?

- **One viewer for varied collections** — deep-zoom images, audio/video, PDF,
  and GLB/GLTF models use a shared navigation and metadata experience.
- **IIIF-aware** — reads common Presentation 2 and 3 resources, Image API
  services, external annotations, language maps, and Content Search services.
- **Easy to embed** — use a standalone module on a normal HTML page or install
  the framework-neutral custom element from npm.
- **Annotation-aware** — display W3C/IIIF annotations and expose APIs that host
  applications can use to add or remove annotations.
- **Institution-ready presentation** — configure panels, layouts, themes,
  languages, OpenSeadragon, A/V behaviour, and responsive sizing.
- **Extensible** — plugins receive a DOM mount point, typed viewer API, event
  bus, and configuration without requiring a Mango fork.

## Fastest start: standalone website

No application framework or build step is required:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Collection item</title>
    <style>
      .viewer-shell {
        width: 100%;
      }

      mango-viewer {
        display: block;
        width: 100%;
        /* Optional: Mango defaults to 720px, capped by the small viewport. */
        height: min(75vh, 800px);
      }
    </style>
  </head>
  <body>
    <div class="viewer-shell">
      <mango-viewer
        mode="viewer"
        manifest-id="https://example.org/iiif/manifest.json"
        config='{"theme":"light","language":"en"}'
      ></mango-viewer>
    </div>

    <script
      type="module"
      src="https://cdn.jsdelivr.net/npm/@mango-iiif/iiif-viewer@latest"
    ></script>
  </body>
</html>
```

The viewer has a default height of 720px, capped by the small viewport so it
fits on phones. Override it with ordinary site CSS as above, or set
`--mango-viewer-height`; its parent does not need an explicit height. Replace
the example Manifest URL with a resource that permits cross-origin browser
requests. Pin an exact package version before deploying to production.

See the [standalone and npm getting-started guide](https://github.com/Mango-IIIF/Mango/wiki/Getting-Started)
for troubleshooting and production guidance.

## Install from npm

```bash
npm install @mango-iiif/iiif-viewer svelte
```

Register the custom element once in the application entry point:

```js
import "@mango-iiif/iiif-viewer/element";
```

Then use it in HTML or a framework template:

```html
<mango-viewer
  mode="viewer"
  manifest-id="https://example.org/iiif/manifest.json"
></mango-viewer>
```

Complex configuration is best assigned as a JavaScript property:

```js
await customElements.whenDefined("mango-viewer");

const viewer = document.querySelector("mango-viewer");
viewer.config = {
  theme: "light",
  language: "en",
  showMetadata: true,
  showSearch: true,
  sidebar: {
    enabled: true,
    open: true,
    activePanel: "metadata",
  },
};
```

`theme` and `language` belong inside `config`; they are not separate custom
element attributes.

## JavaScript class API

Applications that want an explicitly mounted class can use `Mango`:

```js
import { Mango } from "@mango-iiif/iiif-viewer";
import "@mango-iiif/iiif-viewer/style.css";

const target = document.querySelector("#viewer-host");
if (!target) throw new Error("Missing #viewer-host");

const viewer = new Mango({
  target,
  manifestId: "https://example.org/iiif/manifest.json",
  config: { theme: "light", language: "en" },
});

const unsubscribe = viewer.on("pageChange", ({ index, canvasId }) => {
  console.log(`Canvas ${index + 1}: ${canvasId}`);
});

viewer.setCanvasByIndex(2);

// When the host permanently removes the viewer:
unsubscribe();
viewer.destroy();
```

The package also exports a native Svelte 5 component.

### Package entry points

| Import                                      | Contents                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `@mango-iiif/iiif-viewer`                   | `Mango`, `ViewerComponent`, shared types, API, events, and plugin helpers    |
| `@mango-iiif/iiif-viewer/core`              | Headless `ViewerCore` component for hosts that provide their own chrome      |
| `@mango-iiif/iiif-viewer/element`           | Registers `<mango-viewer>`                                                   |
| `@mango-iiif/iiif-viewer/style.css`         | Styles for the class and native Svelte builds (the element bundles its own)  |
| `@mango-iiif/iiif-viewer/all`               | Alias for the main viewer exports                                             |

`/element/viewer` is also exported and registers the same element as `/element`.

### Building on the viewer

Annotation and storytelling applications can use `ViewerCore` as their stage
without inheriting Mango's header, sidebars, or toolbars:

```svelte
<script lang="ts">
  import { ViewerCore, type ViewerApi } from '@mango-iiif/iiif-viewer/core';
  import '@mango-iiif/iiif-viewer/style.css';

  let viewer: ViewerApi;
</script>

<ViewerCore bind:this={viewer} manifestId={manifestId} plugins={plugins} />
```

The full viewer and headless core expose the same host API. Hosts can load and
mutate annotations, control annotation selection, inspect the active renderer,
convert image coordinates to and from screen coordinates, and subscribe to
`rendererReady` and `stageResize`. Plugins can mount UI in viewer slots; use
their `order` field for deterministic stacking and `pointerEvents` for
interactive overlays. The image renderer extension exposes its typed
OpenSeadragon instance, while other renderer kinds remain renderer-neutral.

`ViewerCore` is headless by default and fills its host. Pass `toolbar` to keep
the stage toolbar without the rest of the chrome. The `/core` entry also
exports what such hosts share with the viewer rather than copy: the i18n
locale store and `translate`, `createEventBus`, the manifest cache, canvas
thumbnails, the fullscreen controller, and the annotation model helpers
(`createMangoAnnotation`, `resolveAnnotationJson`, layer styles).

## Viewer modes

The custom element supports the viewer and multi-view workspace:

| Mode                | Purpose                         | Primary input                   |
| ------------------- | ------------------------------- | ------------------------------- |
| `viewer`            | Browse a Manifest or Collection | `manifest-id`                   |
| `workspace`         | Arrange multiple viewer windows | viewer UI                       |

## Documentation

The [Mango GitHub Wiki](https://github.com/Mango-IIIF/Mango/wiki) contains
additional viewer documentation:

| Guide                                                                   | What it covers                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| [Configuration](https://github.com/Mango-IIIF/Mango/wiki/Configuration) | Panels, layouts, OSD, PDF, 3D, A/V, and first-party options     |
| [Plugins](https://github.com/Mango-IIIF/Mango/wiki/Plugin-System)       | Plugin contract, slots, lifecycle, registration, and an example |

## IIIF support

Mango provides broad but intentionally documented partial support for IIIF
Presentation 2 and 3, Image API services, W3C Web Annotation, and Content Search
1 and 2. A Collection URL can be passed as `manifest-id`: in `viewer` mode Mango
opens the first Manifest and offers a Collection panel for browsing the
hierarchy (disable it with `showCollection: false`). Important current
limitations include:

- Collection browsing is available in `viewer` mode only;
- incomplete `viewingDirection`, Range, Choice, and multi-body workflows;
- incomplete IIIF Content State handling; and
- no built-in IIIF Authentication interaction/token flow.

Mango's audio/video request hooks can participate in an access strategy owned by
the host application, but they do not make the viewer a complete Authentication
API client.

## Supporting packages

Mango delegates focused responsibilities to other `@mango-iiif` packages:

- [`@mango-iiif/w3c-parser`](https://www.npmjs.com/package/@mango-iiif/w3c-parser)
  parses W3C annotations and spatial/temporal selectors.
- [`@mango-iiif/iiif-search-client`](https://www.npmjs.com/package/@mango-iiif/iiif-search-client)
  discovers and queries IIIF Content Search services.
- [`@mango-iiif/av`](https://www.npmjs.com/package/@mango-iiif/av) provides
  audio/video playback, chapters, captions, transcripts, and related UI.
- [`@mango-iiif/collection-navigator`](https://www.npmjs.com/package/@mango-iiif/collection-navigator)
  parses IIIF Collections and provides the Collection browsing panel.

## Development

```bash
npm ci
npm run dev
```

`npm run dev` serves the demo pages in `apps/demo` at http://localhost:5173.

### Building

```bash
npm run build:dist   # library, custom element, and type declarations in src/dist
npm run build:demo   # build:dist, then copy src/dist into apps/demo/dist
npm pack             # build:dist runs automatically, then writes the .tgz
```

`npm run build` is an alias for `npm run build:demo`. Only `src/dist` is
published, so `npm pack` produces the same archive npm users install. To try a
local build in another project, install the archive directly:

```bash
npm install /path/to/mango-iiif-iiif-viewer-<version>.tgz svelte
```

Useful verification commands:

```bash
npm test
npm run test:e2e
npm run build:types
npm run lint
npm run i18n:check
npm pack --dry-run
```

Browser-facing changes should be verified against the real built demo entry
point. Public API changes should update exported types, tests, examples, and the
wiki together.

Read the [developer and architecture guide](https://github.com/Mango-IIIF/Mango/wiki/Developer-Guide)
before contributing.

## Project status and feedback

Mango is actively developed. Please review the
[known limitations](https://github.com/Mango-IIIF/Mango/wiki/Codebase-Audit-and-Failures)
and test representative institutional resources before production adoption.

Report bugs and request features through
[GitHub Issues](https://github.com/Mango-IIIF/Mango/issues). A useful report
includes the Mango version, browser, viewer mode/configuration, a reduced public
IIIF fixture, and relevant console or network errors.

## License

Mango is available under the [MIT License](LICENSE).
