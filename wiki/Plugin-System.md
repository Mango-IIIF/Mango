# Plugin system

Plugins add institution-specific controls, integrations, or overlays without
forking Mango. A plugin receives a DOM mount point, the typed viewer API, the
event bus, and the active configuration.

Plugins are appropriate for features such as:

- a catalogue or collections-management link;
- an institutional download or citation panel;
- analytics that respond to viewer events;
- an annotation workflow connected to a local service; or
- an interpretive overlay used by a particular exhibition.

## Plugin contract

```ts
import type { ViewerPlugin } from "@mango-iiif/iiif-viewer";

const plugin: ViewerPlugin = {
  id: "catalogue-link",
  label: "Catalogue record",
  slot: "right",
  init(context) {
    // Add UI and listeners.
  },
  destroy() {
    // Remove UI, listeners, timers, and other resources.
  },
};
```

Every plugin requires:

| Field           | Description                                       |
| --------------- | ------------------------------------------------- |
| `id`            | Stable unique identifier used for deduplication   |
| `label`         | Human-readable title shown for non-overlay panels |
| `slot`          | One of `left`, `right`, `bottom`, or `overlay`    |
| `init(context)` | Mounts the plugin; may return a promise           |
| `destroy()`     | Releases all resources created by the plugin      |

Optional `capabilities` can describe whether a plugin requires a Manifest or
media and whether it supports overlay use. These flags describe the plugin; the
plugin should still handle unavailable state safely.

## Plugin context

`init` receives:

| Property | Purpose                                                        |
| -------- | -------------------------------------------------------------- |
| `mount`  | HTMLElement owned by this plugin; append plugin UI here        |
| `events` | Typed event bus with `on`, `off`, and `emit`                   |
| `viewer` | Viewer API for navigation, state, media, view, and annotations |
| `config` | The viewer's current `ViewerConfig`                            |

The plugin API is DOM-first and framework-neutral. You can append normal DOM
nodes or mount your own framework component into `context.mount`. If you mount a
React, Vue, or Svelte component, unmount it in `destroy`.

## Complete example

This plugin adds a link from the current Manifest to an institutional catalogue:

```ts
import type { ViewerPlugin } from "@mango-iiif/iiif-viewer";

export function createCataloguePlugin(): ViewerPlugin {
  let cleanup: (() => void) | undefined;

  return {
    id: "institution-catalogue",
    label: "Catalogue record",
    slot: "right",
    capabilities: { requiresManifest: true },

    init({ mount, viewer, events }) {
      const wrapper = document.createElement("div");
      const link = document.createElement("a");
      link.textContent = "Open this item in the catalogue";
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const updateLink = () => {
        const manifestId = viewer.getManifestId();
        link.hidden = !manifestId;
        if (manifestId) {
          link.href = `/catalogue?iiif=${encodeURIComponent(manifestId)}`;
        }
      };

      wrapper.append(link);
      mount.append(wrapper);
      updateLink();

      const unsubscribe = events.on("manifestChange", updateLink);
      cleanup = () => {
        unsubscribe();
        wrapper.remove();
      };
    },

    destroy() {
      cleanup?.();
      cleanup = undefined;
    },
  };
}
```

## Register a plugin with npm or Svelte integrations

Register globally before creating viewers:

```ts
import { registerPlugin, type ViewerPlugin } from "@mango-iiif/iiif-viewer";

registerPlugin(createCataloguePlugin());
```

Or pass plugins to an individual viewer:

```ts
const viewer = new Mango({
  target,
  manifestId,
  plugins: [createCataloguePlugin()],
});
```

Local plugins with the same `id` replace globally registered plugins for that
viewer.

## Register a plugin with the standalone element

The element build exposes a small registration API on `window`:

```html
<script type="module" src="/assets/mango-viewer-element.js"></script>
<script type="module">
  window.MangoViewer.registerPlugin(createCataloguePlugin());
</script>
```

Alternatively, populate `window.MangoViewerPlugins` before the element module is
evaluated. Passing a `plugins` array directly as a JavaScript property is better
when only one viewer needs the plugin:

```js
await customElements.whenDefined("mango-viewer");
document.querySelector("mango-viewer").plugins = [createCataloguePlugin()];
```

An array cannot be represented reliably in an HTML attribute; assign it as a
property.

## Lifecycle and failures

Mango catches synchronous and asynchronous failures from `init` and failures
from `destroy`. It emits `pluginError` through the viewer event bus and shows a
small failure message in the plugin slot. Subscribe with `viewer.on`; the event
is not currently bridged to a DOM `CustomEvent`. This lifecycle handling does
not isolate arbitrary code executed later by a plugin.

Plugin authors should:

- catch errors from their own event handlers and network requests;
- unsubscribe from every event in `destroy`;
- remove DOM nodes, observers, timers, and framework mounts;
- avoid modifying DOM outside `context.mount` unless essential; and
- namespace CSS classes and server-side data.

See [events](Event-Handling) and the [JavaScript API](API-Reference) for the
contracts available through the plugin context.
