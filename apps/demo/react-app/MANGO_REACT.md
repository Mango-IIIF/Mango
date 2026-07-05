# Using Mango IIIF Viewer with React

This guide outlines how to install, configure, and use Mango IIIF Viewer within a React application.

---

## Installation

Install Mango from the npm registry:
```bash
npm install @mango-iiif/iiif-viewer
```

---

## Registration & CSS Injection

Mango is built as a Svelte 5 Custom Element. To use it in React, you must import the element registry wrapper once at the top of your application entry point (e.g., `main.jsx` or `index.jsx`). 

Importing this wrapper registers `<mango-viewer>` in the browser's custom element registry and handles style injection inside the Shadow DOM:

```javascript
import '@mango-iiif/iiif-viewer/element';
```

---

## Component Usage

Here is a complete example showing how to wrap the custom element in a React component supporting React 18 or React 19.

### React 19 (Native Custom Element Support)
In React 19, custom elements support properties and custom event binding out of the box using standard JSX:

```jsx
import React from 'react';

export default function MyViewer() {
  return (
    <mango-viewer
      manifest-id="https://iiif.wellcomecollection.org/presentation/v2/b18035723"
      mode="viewer"
      config={{ showThumbnails: true }}
      onexportAnnotations={(e) => console.log('Export:', e.detail)}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    />
  );
}
```

### React 18 (Using Refs)
React 18 does not bind object properties or custom events natively to custom elements. You must assign properties using a `ref` and attach listeners using `addEventListener`:

```jsx
import React, { useEffect, useRef } from 'react';

export function MangoViewer({ manifestId, mode, config, storyUrl, onExportAnnotations, onStoryError }) {
  const viewerRef = useRef(null);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;

    // Direct property assignment for complex objects/arrays
    if (config !== undefined) el.config = config;
    if (storyUrl !== undefined) el.storyUrl = storyUrl;

    // React 18 Custom Event Listeners
    const handleExport = (e) => onExportAnnotations?.(e.detail);
    const handleError = (e) => onStoryError?.(e.detail);

    el.addEventListener('exportAnnotations', handleExport);
    el.addEventListener('storyViewerError', handleError);

    return () => {
      el.removeEventListener('exportAnnotations', handleExport);
      el.removeEventListener('storyViewerError', handleError);
    };
  }, [config, storyUrl, onExportAnnotations, onStoryError]);

  return (
    <mango-viewer
      ref={viewerRef}
      manifest-id={manifestId}
      mode={mode}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
```

---

## Viewer Mode Configurations

Use these configurations for the four primary modes of Mango:

### 1. IIIF Viewer
Displays standard IIIF manifests.
```jsx
<MangoViewer
  mode="viewer"
  manifestId="https://iiif.wellcomecollection.org/presentation/v2/b18035723"
/>
```

### 2. Story Viewer
Renders a guided narrative presentation from a JSON story schema.
```jsx
<MangoViewer
  mode="story-viewer"
  storyUrl="/path-to/story.json"
  config={{
    showMetadata: false,
    showSearch: false,
    showThumbnails: false
  }}
/>
```

### 3. Story Builder
An interactive drag-and-drop story authoring workspace.
```jsx
<MangoViewer
  mode="story-builder"
  storyUrl="/path-to/story.json"
  config={{
    showMetadata: false,
    showSearch: false,
    showThumbnails: false
  }}
/>
```

### 4. Annotation Editor
A workspace designed for drawing vector annotations on the IIIF canvas.
```jsx
<MangoViewer
  mode="annotation-editor"
  manifestId="https://iiif.wellcomecollection.org/presentation/v2/b18035723"
  onExportAnnotations={(annos) => console.log('Saved Annotations:', annos)}
/>
```
