# Story viewer, builder, and format

Mango stories create guided journeys through one or more IIIF Manifests. A
chapter can select a canvas, capture an image viewport or media segment, preserve
a 3D camera pose, show multilingual text, play narration, adjust layers, and
control how the next chapter begins.

Use `story-viewer` to publish a story and `story-builder` to author or edit one.

## Display a story

Load a story from a URL:

```html
<mango-viewer
  mode="story-viewer"
  story-url="/stories/gallery-tour.json"
  config='{"language":"en"}'
></mango-viewer>
```

Or assign a parsed object:

```js
const viewer = document.querySelector("mango-viewer");
viewer.mode = "story-viewer";
viewer.story = storyObject;
```

Mango accepts its native story object, the versioned envelope produced by the
builder, and a supported IIIF Presentation 3 `AnnotationPage` representation.

## Author or edit a story

```html
<mango-viewer
  mode="story-builder"
  story-url="/stories/gallery-tour.json"
  config='{
    "language":"en",
    "story":{"languages":["en","cy"]}
  }'
></mango-viewer>
```

Omit `story-url` to begin a new story. Authors can load manifests, capture
chapters, add translated titles and descriptions, place text, assign narration,
preview transitions, reorder chapters, and export the result.

By default, export opens a JSON dialog for copying. Configure a save endpoint to
persist directly; see [configuration](Configuration#story-builder-options).

## Native story model

The TypeScript types are exported from the main package, `/story-viewer`, and
`/story-builder` entry points.

```ts
type Story = {
  version: "1.0";
  type: "story";
  title?: Record<string, string>;
  narration?: {
    tracks: Record<string, { src: string }>;
  };
  chapters: Chapter[];
};

type Chapter = {
  id: string;
  title?: Record<string, string>;
  description?: Record<string, string>;
  manifest: string;
  canvasIndex: number;
  canvasId?: string;
  transitionTimeMs?: number;
  viewBox?: { x: number; y: number; w: number; h: number };
  media?: { start: number; end: number };
  model?: ModelPose;
  narrationSegment?: Record<string, { start: number; end: number }>;
  annotations?: Record<
    string,
    {
      text?: string;
      placement?: { x: number; y: number; w: number; h: number };
    }
  >;
  advance?: {
    mode: "manual" | "auto" | "both";
    delayMs?: number;
  };
  layerOpacities?: Record<string, number>;
};
```

Language maps use language codes as keys, for example:

```json
{
  "title": {
    "en": "Highlights tour",
    "cy": "Taith uchafbwyntiau"
  }
}
```

## Minimal native story

```json
{
  "version": "1.0",
  "type": "story",
  "title": { "en": "Highlights tour" },
  "chapters": [
    {
      "id": "introduction",
      "title": { "en": "Welcome" },
      "description": { "en": "Begin with the complete object." },
      "manifest": "https://example.org/iiif/manifest.json",
      "canvasIndex": 0,
      "canvasId": "https://example.org/iiif/canvas/1",
      "transitionTimeMs": 1500,
      "viewBox": { "x": 0, "y": 0, "w": 4000, "h": 3000 },
      "advance": { "mode": "manual" }
    }
  ]
}
```

Use stable chapter IDs, real Canvas IDs, and stable Manifest URLs. Mango can
derive a fallback Canvas URL when `canvasId` is omitted, but explicit source IDs
are more portable.

## Builder export envelope

The current builder exports and saves a versioned Mango envelope around the
native story:

```json
{
  "version": 1,
  "exportedAt": "2026-07-19T12:00:00.000Z",
  "meta": {
    "source": "storybuilder"
  },
  "data": {
    "version": "1.0",
    "type": "story",
    "chapters": []
  }
}
```

The envelope gives storage systems a format version, export timestamp, and
source while retaining the native `Story` object in `data`.

## IIIF AnnotationPage import

The story viewer also recognises a Presentation 3 `AnnotationPage` profile in
which chapter annotations target canvases and media fragments. It maps labels,
summaries, viewport and temporal selectors, narration `Sound` bodies, and
`TextualBody` overlays into the native story model.

This import is a Mango interpretation of an AnnotationPage, not a claim that
generic IIIF clients understand Mango's sequencing, camera transitions, layer
opacity, or chapter-advance behaviour. Test round trips before adopting an
AnnotationPage as the editable source of record.

## Save endpoint contract

When `config.story.save.endpoint` is enabled, Mango sends the versioned builder
envelope as JSON using the configured `POST` or `PUT` method.

A successful endpoint should return JSON such as:

```json
{
  "success": true,
  "message": "Story saved"
}
```

For failures, return an appropriate HTTP status and optionally:

```json
{
  "success": false,
  "error": {
    "code": "validation_failed",
    "message": "A chapter references an unknown Manifest"
  }
}
```

The host service is responsible for authentication, authorisation, versioning,
stable identifiers, validation, and storage.

## Publishing guidance

- Keep all referenced manifests, canvases, narration, and linked media available
  over HTTPS with suitable CORS headers.
- Provide translated story text and accessible narration alternatives where
  applicable.
- Validate a saved story in `story-viewer`, not only in the builder.
- Keep a revision history when curatorial staff edit public stories.
- Treat imported story text and URLs as untrusted content at the storage
  boundary.
