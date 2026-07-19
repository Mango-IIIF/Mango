# Application integrations

The framework-neutral `<mango-viewer>` custom element is the recommended
integration for most applications. Mango also exports a JavaScript class and a
native Svelte component.

## Custom-element contract

Register the element once:

```js
import "@mango-iiif/iiif-viewer/element";
```

Supported HTML attributes are:

| Attribute     | Purpose                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| `manifest-id` | IIIF Manifest URL                                                              |
| `mode`        | `viewer`, `workspace`, `annotation-editor`, `story-viewer`, or `story-builder` |
| `config`      | JSON-encoded viewer configuration                                              |
| `story-url`   | URL of a Mango story or supported IIIF AnnotationPage                          |
| `story`       | JSON-encoded story input                                                       |

Complex values can also be assigned as JavaScript properties: `config`,
`plugins`, and `story`. Property names use camelCase, such as `manifestId` and
`storyUrl`.

Wait for registration before calling methods on an element created at runtime:

```js
await customElements.whenDefined("mango-viewer");
const viewer = document.querySelector("mango-viewer");
viewer.setCanvasByIndex(2);
```

## Plain JavaScript class

The `Mango` class mounts the viewer into a target element:

```js
import { Mango } from "@mango-iiif/iiif-viewer";
import "@mango-iiif/iiif-viewer/style.css";

const viewer = new Mango({
  target: document.querySelector("#viewer-host"),
  manifestId: "https://example.org/iiif/manifest.json",
  config: { theme: "light", language: "en" },
});

const unsubscribe = viewer.on("pageChange", ({ index, canvasId }) => {
  console.log(index, canvasId);
});

// Later:
unsubscribe();
viewer.destroy();
```

Use [the JavaScript API](API-Reference) for the full class contract.

## React 19

Import the element registration in the application entry point:

```js
import "@mango-iiif/iiif-viewer/element";
```

React 19 can pass object properties to custom elements:

```jsx
export function CollectionViewer({ manifestId }) {
  return (
    <mango-viewer
      mode="viewer"
      manifest-id={manifestId}
      config={{ theme: "light", showMetadata: true }}
      onpageChange={(event) => console.log(event.detail)}
      style={{ display: "block", width: "100%", height: "70vh" }}
    />
  );
}
```

Custom event names are case-sensitive. The handler for `pageChange` is
`onpageChange`.

## React 18

React 18 applications should use a ref for object properties, methods, and
custom events:

```jsx
import { useEffect, useRef } from "react";

export function CollectionViewer({ manifestId, config, onPageChange }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.config = config;
    const handler = (event) => onPageChange?.(event.detail);
    element.addEventListener("pageChange", handler);
    return () => element.removeEventListener("pageChange", handler);
  }, [config, onPageChange]);

  return (
    <mango-viewer
      ref={ref}
      mode="viewer"
      manifest-id={manifestId}
      style={{ display: "block", width: "100%", height: "70vh" }}
    />
  );
}
```

## Vue 3

Tell the Vue compiler that Mango tags are custom elements:

```js
// vite.config.js
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith("mango-"),
        },
      },
    }),
  ],
});
```

Then bind properties and events in the template:

```vue
<script setup>
import "@mango-iiif/iiif-viewer/element";

defineProps({ manifestId: String });
const config = { theme: "light", showMetadata: true };
</script>

<template>
  <mango-viewer
    mode="viewer"
    :manifest-id="manifestId"
    :config="config"
    @pageChange="(event) => console.log(event.detail)"
  />
</template>

<style scoped>
mango-viewer {
  display: block;
  width: 100%;
  height: 70vh;
}
</style>
```

## Svelte 5

Use the native component when you want Svelte component binding:

```svelte
<script lang="ts">
  import { ViewerComponent } from '@mango-iiif/iiif-viewer';
  import '@mango-iiif/iiif-viewer/style.css';

  const config = { theme: 'light', showMetadata: true };
</script>

<div class="viewer-shell">
  <ViewerComponent
    manifestId="https://example.org/iiif/manifest.json"
    {config}
  />
</div>

<style>
  .viewer-shell {
    height: 70vh;
  }
</style>
```

The custom element remains useful in Svelte when you want the same boundary and
integration contract across several host frameworks.

## Package entry points

| Import                                      | Contents                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `@mango-iiif/iiif-viewer`                   | `Mango`, `ViewerComponent`, shared types, API, events, and plugin helpers    |
| `@mango-iiif/iiif-viewer/all`               | Main exports plus story viewer, story builder, and annotation editor exports |
| `@mango-iiif/iiif-viewer/element`           | Registers `<mango-viewer>`                                                   |
| `@mango-iiif/iiif-viewer/story-viewer`      | Story playback components and runtime helpers                                |
| `@mango-iiif/iiif-viewer/story-builder`     | Story authoring components, state, validation, and helpers                   |
| `@mango-iiif/iiif-viewer/annotation-editor` | Annotation workspace, editor layer, and conversion helpers                   |
| `@mango-iiif/iiif-viewer/style.css`         | Styles for the class/native Svelte library build                             |

Element-specific subpaths are also available for viewer, story viewer, story
builder, and annotation editor registration. For most sites, importing
`/element` once is simpler.
