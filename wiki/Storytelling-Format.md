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

The builder's source-of-record and export format is a IIIF Presentation 3
`AnnotationPage`. The viewer and builder accept the Mango story AnnotationPage
profile directly; native story objects and versioned wrappers are not supported.

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

## AnnotationPage story format

The builder exports and saves a IIIF Presentation 3 `AnnotationPage`. Chapter
annotations retain their order in `items`; text overlays are linked companion
annotations. Standard IIIF and Web Annotation fields carry the portable parts
of a story:

| Story feature                 | Annotation representation                                     |
| ----------------------------- | ------------------------------------------------------------- |
| Story title                   | AnnotationPage `label`                                        |
| Chapter order                 | Order of chapter annotations in `items`                       |
| Chapter title and description | Annotation `label` and `summary`                              |
| Canvas                        | `target.source`                                               |
| Image viewport                | `FragmentSelector` with `xywh`                                |
| Media segment                 | Media Fragment `t=start,end`                                  |
| Narration                     | `Sound` body with a temporal fragment                         |
| Text overlay                  | Describing Annotation with a `TextualBody` and spatial target |

Model poses, layer opacity, exact viewport values, and playback behaviour are
viewer state rather than standard IIIF semantics. Mango stores them in a
versioned, namespaced `mango:ViewerState` body. Other IIIF clients can still use
the standard chapter target and bodies while ignoring the Mango extension.
The machine-readable profile is in
[`schemas/story-annotation-page.schema.json`](https://github.com/Mango-IIIF/Mango/blob/main/schemas/story-annotation-page.schema.json).
Overlay annotations carry `mango:role: "overlay"` and a `mango:chapterId`
link. Mango excludes them from sequencing while annotation clients can process
their standard body and target.

```json
{
  "@context": [
    "http://iiif.io/api/presentation/3/context.json",
    {
      "mango": "https://mango-iiif.github.io/ns/story#",
      "mangoState": {
        "@id": "mango:state",
        "@type": "@json"
      }
    }
  ],
  "id": "https://museum.example/stories/object-42/chapters",
  "type": "AnnotationPage",
  "mango:storyVersion": "1.0",
  "label": { "en": ["Object 42 highlights"] },
  "items": [
    {
      "id": "https://museum.example/stories/object-42/chapters/annotation/detail",
      "type": "Annotation",
      "motivation": "supplementing",
      "label": { "en": ["Examine the inscription"] },
      "target": {
        "type": "SpecificResource",
        "source": "https://museum.example/iiif/object-42/canvas/1",
        "partOf": {
          "id": "https://museum.example/iiif/object-42/manifest",
          "type": "Manifest"
        }
      },
      "body": {
        "type": "mango:ViewerState",
        "format": "application/vnd.mango.story-state+json",
        "mango:storyVersion": "1.0",
        "mangoState": {
          "chapterId": "detail",
          "canvasIndex": 0,
          "canvasId": "https://museum.example/iiif/object-42/canvas/1",
          "modelPose": {
            "cameraOrbit": "45deg 30deg 2m",
            "cameraTarget": "0m 1m 0m",
            "fieldOfView": "45deg",
            "orientation": "0deg 0deg 0deg"
          },
          "modelOptions": {
            "transition": "interpolate",
            "interpolationDecay": 180
          },
          "layerOpacities": {
            "https://museum.example/iiif/object-42/annotation/infrared": 0.65
          },
          "playback": {
            "advance": "auto",
            "delayMs": 5000,
            "transitionMs": 2000
          }
        }
      }
    }
  ]
}
```

Use stable HTTP(S) identifiers for the AnnotationPage, chapters, Manifests,
Canvases, and layers. Layer opacity values must be between `0` and `1`. Mango
leaves unlisted layers unchanged and ignores stored layer IDs that are not
available in the active Canvas.

When calling the low-level authoring serializer directly, provide the public
AnnotationPage ID:

```ts
import { serializeStoryToIiif } from "@mango-iiif/iiif-viewer/story-builder";

const page = serializeStoryToIiif(story, {
  id: "https://museum.example/stories/object-42/chapters",
});
```

For the web component story builder, set the same value through configuration:

```html
<mango-viewer
  mode="story-builder"
  config='{"story":{"annotationPageId":"https://museum.example/stories/object-42/chapters"}}'
></mango-viewer>
```

## Save endpoint contract

When `config.story.save.endpoint` is enabled, Mango sends the AnnotationPage as
JSON using the configured `POST` or `PUT` method.

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
