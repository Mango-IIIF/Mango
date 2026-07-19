# Mango IIIF Viewer

[![npm](https://img.shields.io/npm/v/@mango-iiif/iiif-viewer)](https://www.npmjs.com/package/@mango-iiif/iiif-viewer)
[![CI](https://github.com/Mango-IIIF/Mango/actions/workflows/ci.yml/badge.svg)](https://github.com/Mango-IIIF/Mango/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Mango is a flexible IIIF viewer and storytelling toolkit for museums, libraries,
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
- **Built for interpretation** — publish guided stories or use the story builder
  to capture canvases, viewports, media segments, narration, text, model poses,
  and layer settings.
- **Annotation workflows** — display W3C/IIIF annotations, draw local shapes,
  and connect export events to an institution's storage service.
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
        height: min(75vh, 800px);
        min-height: 420px;
      }

      mango-viewer {
        display: block;
        width: 100%;
        height: 100%;
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

The viewer and its parent need an explicit height. Replace the example Manifest
URL with a resource that permits cross-origin browser requests. Pin an exact
package version before deploying to production.

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

The package also exports a native Svelte 5 component. See
[application integrations](https://github.com/Mango-IIIF/Mango/wiki/Integrations)
for React 18/19, Vue 3, Svelte, custom-element properties, and package entry
points.

## Viewer modes

The same custom element supports several collection and authoring experiences:

| Mode                | Purpose                         | Primary input                   |
| ------------------- | ------------------------------- | ------------------------------- |
| `viewer`            | Browse a single IIIF Manifest   | `manifest-id`                   |
| `workspace`         | Arrange multiple viewer windows | viewer UI                       |
| `annotation-editor` | Draw and export annotations     | `manifest-id`                   |
| `story-viewer`      | Play a guided narrative         | `story-url` or `story`          |
| `story-builder`     | Author and export a narrative   | optional `story-url` or `story` |

```html
<mango-viewer
  mode="annotation-editor"
  manifest-id="https://example.org/iiif/manifest.json"
></mango-viewer>
```

```html
<mango-viewer
  mode="story-viewer"
  story-url="/stories/exhibition-tour.json"
></mango-viewer>
```

## Documentation

The [Mango GitHub Wiki](https://github.com/Mango-IIIF/Mango/wiki) contains the
complete user and contributor documentation:

| Guide                                                                                                 | What it covers                                                                    |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Getting started](https://github.com/Mango-IIIF/Mango/wiki/Getting-Started)                           | Standalone websites, npm installation, modes, and blank-viewer troubleshooting    |
| [Configuration](https://github.com/Mango-IIIF/Mango/wiki/Configuration)                               | Panels, layouts, OSD, PDF, 3D, A/V, stories, and all first-party options          |
| [Application integrations](https://github.com/Mango-IIIF/Mango/wiki/Integrations)                     | JavaScript, React, Vue, Svelte, and package entry points                          |
| [JavaScript API](https://github.com/Mango-IIIF/Mango/wiki/API-Reference)                              | Navigation, viewports, media, models, layers, annotations, and state              |
| [Events](https://github.com/Mango-IIIF/Mango/wiki/Event-Handling)                                     | DOM and class events, payloads, persistence, and analytics examples               |
| [Theming and languages](https://github.com/Mango-IIIF/Mango/wiki/Theming-and-Languages)               | Built-in themes, CSS variables, language selection, and translation contributions |
| [Plugins](https://github.com/Mango-IIIF/Mango/wiki/Plugin-System)                                     | Plugin contract, slots, lifecycle, registration, and a complete example           |
| [Story viewer and builder](https://github.com/Mango-IIIF/Mango/wiki/Storytelling-Format)              | Native story model, builder envelope, IIIF import, and save endpoints             |
| [IIIF and W3C support](https://github.com/Mango-IIIF/Mango/wiki/IIIF-Conformance)                     | Supported standards, evidence boundaries, and current limitations                 |
| [Deployment and accessibility](https://github.com/Mango-IIIF/Mango/wiki/Deployment-and-Accessibility) | CORS, CSP, accessibility, privacy, authentication, and production checks          |
| [Developer guide](https://github.com/Mango-IIIF/Mango/wiki/Developer-Guide)                           | Architecture, local development, testing, builds, and contribution workflow       |

## IIIF support

Mango provides broad but intentionally documented partial support for IIIF
Presentation 2 and 3, Image API services, W3C Web Annotation, and Content Search
1 and 2. Important current limitations include:

- no general Collection hierarchy browser;
- incomplete `viewingDirection`, Range, Choice, and multi-body workflows;
- incomplete IIIF Content State handling; and
- no built-in IIIF Authentication interaction/token flow.

Mango's audio/video request hooks can participate in an access strategy owned by
the host application, but they do not make the viewer a complete Authentication
API client. Read the
[support matrix](https://github.com/Mango-IIIF/Mango/wiki/IIIF-Conformance)
before adopting Mango for restricted or unusually complex resources.

## Supporting packages

Mango delegates focused responsibilities to other `@mango-iiif` packages:

- [`@mango-iiif/w3c-parser`](https://www.npmjs.com/package/@mango-iiif/w3c-parser)
  parses W3C annotations and spatial/temporal selectors.
- [`@mango-iiif/annotation`](https://www.npmjs.com/package/@mango-iiif/annotation)
  provides OpenSeadragon annotation interaction and drawing.
- [`@mango-iiif/iiif-search-client`](https://www.npmjs.com/package/@mango-iiif/iiif-search-client)
  discovers and queries IIIF Content Search services.
- [`@mango-iiif/av`](https://www.npmjs.com/package/@mango-iiif/av) provides
  audio/video playback, chapters, captions, transcripts, and related UI.

## Development

```bash
npm ci
npm run dev
```

Useful verification commands:

```bash
npm test
npm run test:e2e
npm run build:types
npm run lint
npm run build:demo
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
