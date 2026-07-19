# Viewer configuration

Configuration controls which tools are offered, the initial view, language,
theme, rendering libraries, and story-authoring behaviour.

## Supply configuration

In static HTML, `config` is a JSON string. Use single quotes around the attribute
so the JSON can use double quotes:

```html
<mango-viewer
  manifest-id="https://example.org/iiif/manifest.json"
  config='{"theme":"light","language":"cy","showSearch":false}'
></mango-viewer>
```

In JavaScript and frameworks that support custom-element properties, pass an
object:

```js
viewer.config = {
  theme: "light",
  language: "cy",
  showSearch: false,
};
```

The `theme` and `language` settings are part of `config`; they are not separate
custom-element attributes.

## Common institutional configuration

This example opens metadata by default, allows search when the manifest exposes
a search service, and hides annotation authoring and specialist image tools:

```js
const config = {
  language: "en",
  theme: "light",
  showThumbnails: true,
  showMetadata: true,
  showSearch: true,
  showAnnotations: false,
  showTools: false,
  showLayers: false,
  showSettings: true,
  sidebar: {
    enabled: true,
    open: true,
    activePanel: "metadata",
    position: "left",
  },
  osd: {
    showNavigator: false,
    showRotationControl: true,
    clickToZoomEnabled: true,
  },
};
```

Some controls only appear when the current resource supports them. For example,
the search panel requires a discoverable IIIF Content Search service, and the
layers panel requires multiple renderable media sources.

## General options

| Option            | Type      | Effect                                                                                   |
| ----------------- | --------- | ---------------------------------------------------------------------------------------- |
| `language`        | `string`  | Preferred UI and metadata language. Falls back to the browser language and then English. |
| `theme`           | `string`  | Built-in themes include `dark`, `light`, `sepia`, and `midnight`.                        |
| `allowCreateMode` | `boolean` | Enables annotation creation tools in the normal viewer.                                  |
| `showThumbnails`  | `boolean` | Allows the gallery/thumbnail navigation when multiple image canvases exist.              |
| `showMetadata`    | `boolean` | Allows the metadata panel.                                                               |
| `showSearch`      | `boolean` | Allows search when a compatible service is available.                                    |
| `showAnnotations` | `boolean` | Allows the annotations panel when annotations exist or creation is enabled.              |
| `showTools`       | `boolean` | Allows image adjustment and rotation tools.                                              |
| `showLayers`      | `boolean` | Allows media/layer opacity controls when layers are available.                           |
| `showSettings`    | `boolean` | Allows viewer settings and layout controls.                                              |

An option set to `false` removes access to that feature; it does not change the
source IIIF resource.

## Sidebar

```js
sidebar: {
  enabled: true,
  open: true,
  activePanel: 'metadata',
  position: 'left',
}
```

| Option        | Values                                                                         | Effect                                                                                   |
| ------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `enabled`     | `boolean`                                                                      | Enables the sidebar and its controls.                                                    |
| `open`        | `boolean`                                                                      | Opens the selected panel initially.                                                      |
| `activePanel` | `metadata`, `search`, `annotations`, `tools`, `contents`, `settings`, `layers` | Selects the initial panel. Availability still depends on the resource and other options. |
| `position`    | `left`, `right`                                                                | Places the sidebar on the selected side.                                                 |

## Initial canvas and view

```js
{
  initialCanvasIndex: 0,
  initialLayoutMode: 'single',
  initialRotation: 0,
  initialViewBox: { x: 100, y: 200, w: 1200, h: 900 },
}
```

- `initialCanvasIndex` is zero-based.
- `initialLayoutMode` accepts `single`, `two-page`, `continuous`, or `gallery`.
- `initialRotation` is expressed in degrees.
- `initialViewBox` uses image pixel coordinates.

If no layout is configured, Mango can derive an initial layout from IIIF
`viewingHint` or `behavior` values such as `paged` and `continuous`.

## OpenSeadragon image options

```js
{
  osd: {
    preserveViewport: false,
    showNavigator: true,
    showRotationControl: true,
    clickToZoomEnabled: true,
  },
  osdConfig: {
    animationTime: 0.8,
    gestureSettingsMouse: { scrollToZoom: true },
  },
}
```

`osd` contains Mango's supported convenience settings. `osdConfig` passes
additional options to OpenSeadragon. Mango manages the target element and tile
sources, so host-supplied values for those fields are ignored.

## PDF, 3D, and audio/video options

```js
{
  pdf: { page: 1 },
  modelConfig: {
    'interaction-prompt': 'none',
    'shadow-intensity': '1',
  },
  av: {
    controls: {
      captions: true,
      playbackRate: true,
      fullscreen: true,
    },
  },
}
```

- `pdf.page` is one-based.
- `modelConfig` is passed as properties/attributes to the underlying
  `@google/model-viewer` element.
- `av` is passed to `@mango-iiif/av` and can configure its player, controls,
  transcript, request, and playback behaviour.

Test raw `osdConfig`, `modelConfig`, and `av` values against the versions bundled
with the Mango release you deploy.

### Audio/video configuration

Common `av` options include:

| Group        | Options                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `controls`   | `navigation`, `autoAdvance`, `seek`, `volume`, `captions`, `playbackRate`, `pictureInPicture`, `fullscreen`, `sourceSelector`, `download`, `skipSeconds` |
| `panels`     | `chapters`, `transcript`, `annotations`, `metadata`, `supplementalFiles`                                                                                 |
| `transcript` | `autoScroll`, `search`, `download`, `showNotes`, `showMetadata`, `showSearchMarkers`                                                                     |
| `audioArt`   | Timed `transcript` display and `visualizer` (`pulse`, `waveform`, or `spectrum`)                                                                         |
| `resume`     | `enabled`, `maxItems`, `ttlDays`, and `prompt`                                                                                                           |

Top-level options include `preferredLanguages`, `autoAdvance`, `repeat`,
`startCanvasId`, `startTime`, `activePanel`, `crossorigin`, `preload`,
`playbackRates`, and translated `strings`.

Advanced integrations can provide `fetch`, `requestInit`, `resolveRequest`, and
`annotationAdapter`. Because these contain functions or browser objects, assign
the configuration through the JavaScript `config` property rather than an HTML
JSON attribute:

```js
viewer.config = {
  av: {
    preferredLanguages: ["cy", "en"],
    transcript: { autoScroll: true, search: true },
    resolveRequest: async (url, context) => {
      return authorizeMediaUrl(url, context.canvas.authServices);
    },
  },
};
```

These hooks let the host application apply its own access policy; they do not
make Mango a complete IIIF Authentication client.

## Story builder options

```js
{
  story: {
    annotationPageId: 'https://museum.example/stories/object-42/chapters',
    languages: ['en', 'cy'],
    showDebug: false,
    save: {
      enabled: true,
      endpoint: '/api/stories/exhibition-tour',
      method: 'PUT',
      headers: { Authorization: 'Bearer …' },
      credentials: 'same-origin',
      timeoutMs: 10000,
    },
  },
}
```

`annotationPageId` supplies the stable public HTTP(S) identifier used when a new
story is exported. An ID already present in a loaded story is retained unless
this setting overrides it. `languages` controls the languages offered by the
story builder. `save` enables server persistence; without a usable endpoint,
Mango presents the exported JSON for the author to copy. The save endpoint must
accept Mango's IIIF AnnotationPage story and return JSON containing
`{ "success": true }` for a successful save.

Do not put long-lived secrets into browser configuration. Use same-origin
sessions or short-lived credentials provided by your application.

## TypeScript source of truth

The complete public type is `ViewerConfig`, exported from
`@mango-iiif/iiif-viewer`. TypeScript consumers should use that type so new
options and validation errors are visible during upgrades.
