# Using Mango IIIF Viewer with Vue 3

This guide outlines how to install, configure, and use Mango IIIF Viewer within a Vue 3 application.

---

## Installation

Install Mango from the npm registry:
```bash
npm install @mango-iiif/iiif-viewer
```

---

## Configuration (Vite + Vue 3)

Because `<mango-viewer>` is a Custom Element, Vue needs to be informed to ignore it during template compilation (so it does not attempt to resolve it as a Vue component).

Update your `vite.config.js` or `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/vue';

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Treat any tag starting with mango- as a custom element
          isCustomElement: (tag) => tag.startsWith('mango-')
        }
      }
    })
  ]
});
```

---

## Component Usage

Import the element registry wrapper once at the top of your application entry point (e.g. `main.js` or `App.vue`). This registers `<mango-viewer>` globally in the browser's custom element registry and handles styling inside the Shadow DOM:

```javascript
import '@mango-iiif/iiif-viewer/element';
```

Vue 3 supports custom elements natively. Properties, attributes, and custom events can be bound directly in the template:

```vue
<script setup>
import { ref } from 'vue';

const manifestId = ref('https://iiif.wellcomecollection.org/presentation/v2/b18035723');
const config = ref({ showThumbnails: true });

function handleExport(event) {
  // Access data emitted from custom element
  console.log('Saved annotations:', event.detail);
}
</script>

<template>
  <div class="viewer-container">
    <mango-viewer
      :manifest-id="manifestId"
      mode="viewer"
      :config="config"
      @exportAnnotations="handleExport"
    />
  </div>
</template>

<style scoped>
.viewer-container {
  width: 100vw;
  height: 100vh;
}

mango-viewer {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
```

---

## Viewer Mode Configurations

Use these configurations for the four primary modes of Mango:

### 1. IIIF Viewer
Displays standard IIIF manifests.
```vue
<mango-viewer
  mode="viewer"
  :manifest-id="manifestId"
/>
```

### 2. Story Viewer
Renders a guided narrative presentation from a JSON story schema.
```vue
<mango-viewer
  mode="story-viewer"
  story-url="/path-to/story.json"
  :config="{
    showMetadata: false,
    showSearch: false,
    showThumbnails: false
  }"
/>
```

### 3. Story Builder
An interactive drag-and-drop story authoring workspace.
```vue
<mango-viewer
  mode="story-builder"
  story-url="/path-to/story.json"
  :config="{
    showMetadata: false,
    showSearch: false,
    showThumbnails: false
  }"
/>
```

### 4. Annotation Editor
A workspace designed for drawing vector annotations on the IIIF canvas.
```vue
<mango-viewer
  mode="annotation-editor"
  :manifest-id="manifestId"
  @exportAnnotations="handleExport"
/>
```
