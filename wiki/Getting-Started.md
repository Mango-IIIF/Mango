# Getting started

This guide covers the two most common ways to use Mango: as a standalone viewer
on an existing website and as an npm dependency in an application.

## Before you begin

You need a publicly reachable IIIF Presentation 2 or 3 Manifest URL. The
manifest and everything it references must allow browser requests from the site
where Mango is hosted. See [deployment and accessibility](Deployment-and-Accessibility)
for CORS and production guidance.

The viewer must also have an explicit height. Without one, the custom element is
present but has no visible area.

## Option 1: add Mango to an existing website

This route is suitable for a CMS template, static website, exhibition microsite,
or a page that does not use a JavaScript build system.

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
    <main>
      <h1>Collection item</h1>
      <div class="viewer-shell">
        <mango-viewer
          mode="viewer"
          manifest-id="https://example.org/iiif/manifest.json"
          config='{"theme":"light","language":"en"}'
        ></mango-viewer>
      </div>
    </main>

    <script
      type="module"
      src="https://cdn.jsdelivr.net/npm/@mango-iiif/iiif-viewer@latest"
    ></script>
  </body>
</html>
```

`@latest` is convenient while evaluating Mango. Pin an exact package version
before deploying to production.

### Change the displayed item

The Manifest URL is reactive:

```js
const viewer = document.querySelector("mango-viewer");
viewer.setAttribute("manifest-id", nextManifestUrl);
```

For a site with a manifest search or item picker, update the same viewer rather
than inserting a new script for every item.

## Option 2: install Mango with npm

Install Mango and its Svelte peer dependency:

```bash
npm install @mango-iiif/iiif-viewer svelte
```

Register the custom element once in your application entry point:

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

When creating the element from JavaScript, object configuration can be assigned
as a property:

```js
await customElements.whenDefined("mango-viewer");

const viewer = document.createElement("mango-viewer");
viewer.mode = "viewer";
viewer.manifestId = "https://example.org/iiif/manifest.json";
viewer.config = {
  theme: "light",
  language: "en",
  showMetadata: true,
  showSearch: true,
};
document.querySelector("#viewer-host").append(viewer);
```

See [application integrations](Integrations) for React, Vue, Svelte, and the
`Mango` class API.

## Choose a mode

The same custom element supports several experiences:

| Mode                | Purpose                         | Primary input                   |
| ------------------- | ------------------------------- | ------------------------------- |
| `viewer`            | Browse a single IIIF Manifest   | `manifest-id`                   |
| `workspace`         | Arrange multiple viewer windows | viewer UI                       |
| `annotation-editor` | Draw and export annotations     | `manifest-id`                   |
| `story-viewer`      | Play a guided narrative         | `story-url` or `story`          |
| `story-builder`     | Author and export a narrative   | optional `story-url` or `story` |

Example annotation editor:

```html
<mango-viewer
  mode="annotation-editor"
  manifest-id="https://example.org/iiif/manifest.json"
></mango-viewer>
```

Example story viewer:

```html
<mango-viewer
  mode="story-viewer"
  story-url="/stories/exhibition-tour.json"
></mango-viewer>
```

## Next steps

1. Review all [configuration options](Configuration).
2. Match the viewer to your [theme and languages](Theming-and-Languages).
3. Add [event listeners](Event-Handling) for analytics or surrounding UI.
4. Read the [deployment checklist](Deployment-and-Accessibility) before
   publishing.

## Troubleshooting a blank viewer

Check these in order:

1. The viewer and its parent have a non-zero height.
2. The browser console does not show a CORS or Content Security Policy error.
3. The Manifest URL returns JSON over HTTPS without requiring an interactive
   login.
4. Image, media, annotation, search, and caption URLs referenced by the manifest
   are also reachable from the browser.
5. If using npm, the element registration import runs before the element is
   created.
