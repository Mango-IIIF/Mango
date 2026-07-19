# JavaScript API reference

Use the API to coordinate Mango with catalogue navigation, analytics, exhibit
controls, annotation storage, or other parts of a host application.

## Create a class instance

```ts
import { Mango, type ViewerConfig } from "@mango-iiif/iiif-viewer";
import "@mango-iiif/iiif-viewer/style.css";

const config: ViewerConfig = {
  theme: "light",
  language: "en",
};

const viewer = new Mango({
  target: document.querySelector("#viewer-host") as HTMLElement,
  manifestId: "https://example.org/iiif/manifest.json",
  config,
});
```

`MangoOptions` accepts `target`, optional `manifestId`, optional `config`, and an
optional array of [plugins](Plugin-System).

## Use the custom-element API

Methods are also available on `<mango-viewer>` after the element is registered:

```js
await customElements.whenDefined("mango-viewer");
const viewer = document.querySelector("mango-viewer");
viewer.setCanvasByIndex(1);
```

The native Svelte component exposes the same adapter methods. Two adapter-only
methods, `getCanvasCount()` and `setMediaSegment()`, are noted below; they are not
currently methods on the `Mango` class.

## Manifest and canvas navigation

### `getManifestId(): string | null`

Returns the current Manifest URL.

### `setManifest(manifestId: string): void`

Loads a new Manifest. The viewer resets canvas and related state for the new
resource.

### `getCanvasIndex(): number`

Returns the zero-based current Canvas index. Before the viewer is ready, the
class/adapter fallback is `-1`.

### `getCanvasId(): string | null`

Returns the current Canvas ID.

### `getCanvasCount(): number`

Returns the number of canvases. Available on the custom element and Svelte
component adapter, but not currently on the `Mango` class.

### `setCanvasByIndex(index: number): void`

Moves to a zero-based Canvas index. Mango clamps navigation to the available
Canvas range.

### `setCanvasById(canvasId: string): void`

Moves to the Canvas with the matching ID when present.

## Viewport and state

### `getViewBox(): ViewBox | null`

Returns the visible image region in image pixel coordinates:

```ts
type ViewBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};
```

It returns `null` when the active renderer does not provide an image-style view
box or has not opened yet.

### `setViewBox(box: ViewBox): void`

Moves and zooms the active renderer to an image region.

```js
viewer.setViewBox({ x: 1200, y: 800, w: 1600, h: 1200 });
```

### `getMediaType(): MediaType | null`

Returns `image`, `audio`, `video`, `pdf`, `model`, or `null`.

### `getMediaSources(): MediaSource[]`

Returns resolved sources for the current Canvas. Each source includes `type`,
`id`, and `src`, and may include format, dimensions, duration, poster, or label.

### `getState(): ViewerStateSnapshot | null`

Returns a read-only snapshot suitable for host UI and diagnostics:

```ts
type ViewerStateSnapshot = {
  manifestId: string;
  canvasId: string | null;
  canvasIndex: number;
  canvasLabel?: string;
  canvases: Array<{ id: string; label?: string; index: number }>;
  mediaType: "image" | "video" | "audio" | "pdf" | "model" | null;
  viewBox: ViewBox | null;
  zoom: number;
  searchQuery: string;
  annotationCount: number;
  layerOpacities?: Record<string, number>;
};
```

Do not mutate the returned object expecting to update Mango. Use API methods.

## Audio and video

### `start(): void`

Initialises playback and starts from the active segment or timeline start.

### `play(): void`

Resumes playback.

### `pause(): void`

Pauses playback.

### `stop(): void`

Stops playback and returns to the start of the active segment.

### `seekBy(delta: number): void`

Moves by a number of seconds. Negative values seek backwards.

### `seekTo(time: number): void`

Moves to an absolute time in seconds.

### `setMediaSegment(start: number, end: number): void`

Sets the active playback segment. Available on the custom element and Svelte
component adapter, but not currently on the `Mango` class.

## 3D model controls

### `setModelOrbit(orbit: string): void`

Sets the `@google/model-viewer` camera orbit, for example
`"45deg 55deg 2.5m"`.

### `getModelOrbit(): string | null`

Returns the current camera orbit.

### `setModelTarget(target: string): void`

Sets the camera target, for example `"0m 1m 0m"`.

### `getModelTarget(): string | null`

Returns the current camera target.

### `setModelOrientation(orientation: string): void`

Sets model orientation.

### `getModelOrientation(): string | null`

Returns model orientation.

### `setModelPose(pose: ModelPose, options?: ModelPoseOptions): void`

Applies several camera values together:

```ts
viewer.setModelPose(
  {
    cameraOrbit: "45deg 55deg 2.5m",
    cameraTarget: "0m 1m 0m",
    fieldOfView: "30deg",
    orientation: "0deg 90deg 0deg",
  },
  { transition: "interpolate", interpolationDecay: 80 },
);
```

`transition` is `interpolate` or `jump`.

### `getModelPose(): ModelPose | null`

Returns all available camera pose values.

## Layers

### `updateLayerOpacity(id: string, opacity: number): void`

Sets an identified media layer's opacity. Use a value between `0` and `1`.

### `getLayerOpacities(): Record<string, number>`

Returns current opacity values keyed by layer/source ID.

## Annotations

### `addAnnotation(annotation: unknown): Promise<void>`

Adds an annotation to the current Canvas. Mango accepts its resolved shape
format, simple rectangle coordinates, or a supported W3C Annotation.

```js
await viewer.addAnnotation({
  id: "visitor-note-1",
  rect: { x: 100, y: 150, w: 500, h: 300 },
  text: "Detail discussed in the catalogue",
});
```

The API updates local viewer state; it does not persist to an annotation server.
Listen for annotation events and save through the host application.

### `removeAnnotation(annotationId: string): Promise<void>`

Removes a matching local annotation from viewer state.

## Events

### `on(event, handler): () => void`

Subscribes through the typed class/component event bus and returns an unsubscribe
function:

```js
const unsubscribe = viewer.on("pageChange", ({ index }) => {
  console.log(`Canvas ${index + 1}`);
});

unsubscribe();
```

### `off(event, handler): void`

Removes a handler previously passed to `on`:

```js
const handler = ({ index }) => console.log(index);
viewer.on("pageChange", handler);
viewer.off("pageChange", handler);
```

Custom-element integrations may instead use `addEventListener` and
`removeEventListener`. See the complete [event reference](Event-Handling).

## Cleanup

### `destroy(): void`

Unmounts a `Mango` class instance. Call it when the host application permanently
removes the viewer. Removing a custom element invokes its component teardown
through the custom-element lifecycle.

## TypeScript exports

The package root exports `ViewerApi`, `ViewerConfig`, `ViewerEventMap`,
`ViewerStateSnapshot`, `ViewBox`, `MediaType`, `MediaSource`, model types, plugin
types, and story types. Prefer these exports over copying the abbreviated types
from this guide.
