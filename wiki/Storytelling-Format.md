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
annotations retain their order in `items`; captions and drawings are companion
annotations alongside them.

**The IIIF representation is the authoritative one.** IIIF Presentation 3
annotations *are* W3C Web Annotations — one data model, not two — so the
companion annotations in `items` are not extras sitting beside the IIIF, they
are the IIIF, and they are the only part of the document another client can
read. Anything IIIF can express is expressed in IIIF and read back from there:

| Story feature                 | Annotation representation                                          |
| ----------------------------- | ------------------------------------------------------------------ |
| Story title                   | AnnotationPage `label`, absent when the story is untitled           |
| Chapter order                 | Order of chapter annotations in `items`                            |
| Chapter title and description | Annotation `label` and `summary`                                   |
| Canvas                        | `target.source`                                                    |
| Chapter framing               | `FragmentSelector` with `xywh`, in whole pixels                    |
| Media segment                 | Media Fragment `t=start,end`                                       |
| Narration                     | `Sound` body with a temporal fragment                              |
| Text overlay                  | Describing Annotation with a `TextualBody` and spatial target      |
| Drawing geometry              | Companion Annotation with an `xywh`, `PointSelector` or `SvgSelector` target |
| Drawing caption               | `TextualBody` on that Annotation, one per language                 |
| Drawing appearance            | Annotation `stylesheet` plus a target `styleClass`                 |

Camera tracks, playback behaviour, model poses, layer opacities and the story's
presentation aspect have no IIIF vocabulary. Mango stores those — and only
those — in a namespaced `mango:ViewerState` body, which is the correct,
spec-sanctioned use of a JSON-LD context. Other IIIF clients use the standard
targets and bodies and ignore the extension. The body carries a single `type`
string and an `id` derived from its annotation (`…/annotation/detail/state`),
because IIIF allows one type per resource and requires an id on any body that
is not a `TextualBody`.

Nothing is written twice. The extension body used to restate the chapter
framing and every drawing, and those private copies were the ones Mango read —
which left the published geometry unexercised and free to drift, and left the
same drawing arriving from two places to be reconciled. Framings are therefore
quantised to the whole pixels `xywh` is defined over; normalisation preserves
centre and area, so a rounded framing lands on the same integers next time
rather than creeping.

The profile version is declared once, by the Mango context URL in `@context`.
It is not restated as a `mango:storyVersion` property on the page or in any
chapter body.

The machine-readable profile is in
[`schemas/story-annotation-page.schema.json`](https://github.com/Mango-IIIF/Mango/blob/main/schemas/story-annotation-page.schema.json),
and every serialized story is validated against it in the test suite.

```json
{
  "@context": [
    "http://www.w3.org/ns/anno.jsonld",
    "https://mangoviewer.dev/schema/story/1/context.json",
    "http://iiif.io/api/presentation/3/context.json"
  ],
  "id": "https://museum.example/stories/object-42/chapters",
  "type": "AnnotationPage",
  "label": { "en": ["Object 42 highlights"] },
  "items": [
    {
      "id": "https://museum.example/stories/object-42/chapters/annotation/detail",
      "type": "Annotation",
      "motivation": "supplementing",
      "label": { "en": ["Examine the inscription"] },
      "target": {
        "source": "https://museum.example/iiif/object-42/canvas/1",
        "type": "SpecificResource",
        "partOf": {
          "id": "https://museum.example/iiif/object-42/manifest",
          "type": "Manifest"
        },
        "selector": {
          "type": "FragmentSelector",
          "conformsTo": "http://www.w3.org/TR/media-frags/",
          "value": "xywh=1280,640,1600,1200"
        }
      },
      "body": {
        "id": "https://museum.example/stories/object-42/chapters/annotation/detail/state",
        "type": "mango:ViewerState",
        "format": "application/vnd.mango.story-state+json",
        "mangoState": {
          "canvasIndex": 0,
          "presentationAspect": 1.3333333333333333,
          "layerOpacities": {
            "https://museum.example/iiif/object-42/annotation/infrared": 0.65
          },
          "playback": { "advance": "auto", "delayMs": 5000 }
        }
      }
    },
    {
      "id": "https://museum.example/stories/object-42/chapters/annotation/detail/overlay/drawing/mark",
      "type": "Annotation",
      "motivation": "commenting",
      "body": {
        "type": "TextualBody",
        "value": "The maker\u2019s mark",
        "format": "text/plain",
        "language": "en",
        "purpose": "commenting"
      },
      "stylesheet": {
        "type": "CssStylesheet",
        "value": ".story-mark { stroke: #e07a3f; fill: rgba(224, 122, 63, 0.16); stroke-width: 4px; }"
      },
      "target": {
        "type": "SpecificResource",
        "source": "https://museum.example/iiif/object-42/canvas/1",
        "selector": {
          "type": "FragmentSelector",
          "conformsTo": "http://www.w3.org/TR/media-frags/",
          "value": "xywh=1500,900,420,260"
        },
        "styleClass": "story-mark"
      }
    }
  ]
}
```

Use stable HTTP(S) identifiers for the AnnotationPage, chapters, Manifests,
Canvases, and layers. Layer opacity values must be between `0` and `1`. Mango
leaves unlisted layers unchanged and ignores stored layer IDs that are not
available in the active Canvas.

Set the AnnotationPage ID before publishing. Until it is set, Mango generates
one under `https://mangoviewer.dev/stories/draft/`, so every export is valid
IIIF — it satisfies the HTTP(S) `id` that Presentation 3 requires on an
AnnotationPage and on an Annotation. It is still not a publishable identifier:
it names a domain you do not control, so it cannot be stable or dereferenceable
for your collection. Schema validity and publication readiness are separate
checks — the schema accepts a generated draft id, and
`validatePublicationIdentifiers` refuses it. The story settings panel and the
export dialog both say so.

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
