# Events and host integration

Events let a host website respond to navigation, playback, viewport changes,
annotations, panels, plugins, and errors without reading Mango's internal state.

## Class and Svelte subscriptions

```js
const unsubscribe = viewer.on("pageChange", ({ index, canvasId }) => {
  updateCollectionRecord(index, canvasId);
});

// Later:
unsubscribe();
```

`on` callbacks receive the payload directly.

## Custom-element events

Most viewer-controller events from `<mango-viewer>` are dispatched as composed,
bubbling `CustomEvent` objects. The payload is in `event.detail`:

```js
const element = document.querySelector("mango-viewer");

const handler = (event) => {
  console.log(event.detail.index, event.detail.canvasId);
};

element.addEventListener("pageChange", handler);

// Later:
element.removeEventListener("pageChange", handler);
```

Event names are case-sensitive.

`pluginError` is currently delivered through Mango's `on`/`off` event bus but
not bridged to a DOM `CustomEvent`. `storyViewerError` is present in the internal
event type but is not consistently forwarded by every public entry point. Do not
rely on a DOM listener for those two events until that routing is completed.

## Navigation and state events

| Event            | Payload                                               | When it fires                                       |
| ---------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `manifestChange` | `{ manifestId: string }`                              | The active Manifest changes.                        |
| `pageChange`     | `{ canvasId: string, index: number, label?: string }` | The selected Canvas changes. `index` is zero-based. |
| `mediaChange`    | `{ canvasId: string, mediaType: MediaType }`          | The primary renderer/media type changes.            |
| `stateChange`    | `{ snapshot: ViewerStateSnapshot }`                   | Public viewer state changes. This can be frequent.  |
| `panelToggle`    | `{ panel: string, open: boolean }`                    | A viewer panel opens or closes.                     |

Use specific events for analytics where possible. `stateChange` is useful for
synchronising a larger host application but can produce more traffic.

## Viewport events

| Event            | Payload                              | When it fires                                                   |
| ---------------- | ------------------------------------ | --------------------------------------------------------------- |
| `viewBoxChange`  | `{ viewBox: ViewBox }`               | The visible image region changes or is applied through the API. |
| `zoomChange`     | `{ zoom: number, viewBox: ViewBox }` | The image viewer zooms or pans.                                 |
| `rotationChange` | `{ rotation: number }`               | Image rotation changes.                                         |

`ViewBox` uses `{ x, y, w, h }` in image pixel coordinates.

Viewport events can fire repeatedly during interaction. Debounce network saves
or analytics rather than sending a request for every movement.

## Audio and video events

| Event             | Payload                                                 | When it fires                                          |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| `mediaPlay`       | `{ canvasId: string, time: number }`                    | Playback begins or resumes.                            |
| `mediaPause`      | `{ canvasId: string, time: number }`                    | Playback pauses.                                       |
| `mediaTimeUpdate` | `{ canvasId: string, time: number, duration?: number }` | The playhead advances. This is a high-frequency event. |
| `mediaSeek`       | `{ canvasId: string, from: number, to: number }`        | The playhead seeks.                                    |
| `mediaSegmentEnd` | `{ canvasId: string }`                                  | The active media/story segment finishes.               |

Example consent-aware progress analytics:

```js
let lastReportedSecond = -1;

viewer.addEventListener("mediaTimeUpdate", (event) => {
  if (!analyticsConsentGranted()) return;
  const second = Math.floor(event.detail.time);
  if (second === lastReportedSecond || second % 10 !== 0) return;
  lastReportedSecond = second;
  reportPlaybackProgress(second);
});
```

## 3D model event

| Event         | Payload                                             | When it fires                                                |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| `modelChange` | `{ canvasId: string, source?: string } & ModelPose` | Camera orbit, target, field of view, or orientation changes. |

`ModelPose` can include `cameraOrbit`, `cameraTarget`, `fieldOfView`, and
`orientation`.

## Annotation events

| Event               | Payload                                                        | Purpose                                              |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| `addAnnotation`     | `{ annotation: unknown }`                                      | Low-level API annotation add.                        |
| `removeAnnotation`  | `{ annotationId: string }`                                     | Low-level API annotation removal.                    |
| `annotationCreate`  | `{ annotation: unknown }`                                      | A local annotation is created.                       |
| `annotationUpdate`  | `{ annotationId: string, patch: Partial<ResolvedAnnotation> }` | A local annotation is edited.                        |
| `annotationDelete`  | `{ annotationId: string }`                                     | A local annotation is deleted.                       |
| `annotationHover`   | Nullable `id` and optional nullable `annotation`               | Hover changes.                                       |
| `annotationSelect`  | `id`, optional `annotation`, optional `preventZoom`            | An annotation is selected.                           |
| `annotationClear`   | `void`                                                         | Annotation selection is cleared.                     |
| `exportAnnotations` | `{ annotations: ResolvedAnnotation[] }`                        | The editor asks the host to save/export annotations. |

`addAnnotation`/`removeAnnotation` and `annotationCreate`/`annotationDelete` are
paired compatibility events for the same API operations. Prefer the
`annotationCreate`, `annotationUpdate`, and `annotationDelete` family for new
integrations.

Persist exported annotations in the host application:

```js
viewer.addEventListener("exportAnnotations", async (event) => {
  const response = await fetch("/api/annotations", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event.detail.annotations),
  });

  if (!response.ok) {
    showMessage("Annotations could not be saved.");
  }
});
```

Mango does not choose an annotation storage or authentication service for you.

## Error events

| Event         | Payload                                                                                                   | Purpose                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `error`       | `{ scope: 'manifest' \| 'media' \| 'search' \| 'annotations', message: string, cause?: unknown }`         | Manifest loading uses this route; other scopes are not emitted consistently yet. |
| `pluginError` | `{ pluginId: string, pluginLabel: string, phase: 'init' \| 'destroy', message: string, cause?: unknown }` | Plugin lifecycle failure delivered through `viewer.on`.                          |

Do not display `cause` directly to visitors; it may be a technical object or
contain details suitable only for logs.

## React and Vue

See [application integrations](Integrations) for complete examples. In
summary:

- React 18 should attach `addEventListener` through a ref.
- React 19 supports custom-element event props such as `onpageChange`.
- Vue can use `@pageChange="handler"` after configuring `mango-` tags as custom
  elements.

## TypeScript

`ViewerEventMap` and `ViewerEventBus` are exported from the package root. The map
also includes `storyViewerError` and a legacy `updateAnnotation` entry; their
presence in the type should not be treated as proof that every entry point emits
them today.

```ts
import type { ViewerEventMap } from "@mango-iiif/iiif-viewer";

const handlePageChange = (detail: ViewerEventMap["pageChange"]) => {
  console.log(detail.index);
};
```
