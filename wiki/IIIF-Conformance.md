# IIIF and W3C support

Mango is a client for IIIF resources. This page describes viewer compatibility,
not server conformance. Support can differ between reading, rendering,
authoring, and lossless round-tripping.

The assessment below reflects the current repository as of 19 July 2026. Test
your institution's representative resources before production deployment.

## Summary

| Specification                         | Current support                             | Important limits                                                                                                                         |
| ------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| IIIF Presentation API 2 and 3         | Partial, broad viewer support               | Collections, image Range navigation, `viewingDirection`, some behaviours, Choice semantics, and linked-resource handling are incomplete. |
| IIIF Image API 2 and 3 services       | Consumed through OpenSeadragon              | Mango is not an Image API server and does not claim Image API server conformance.                                                        |
| W3C Web Annotation / IIIF annotations | Partial, strong spatial and temporal subset | Complex bodies, styling, Choice/multiple-body semantics, and lossless round trips are limited.                                           |
| IIIF Content Search 1 and 2           | Partial                                     | Search discovery and `q` requests work; result paging and autocomplete are not exposed as complete viewer workflows.                     |
| IIIF Content State 1                  | Not conformant                              | `iiif-content` values are not yet processed through the available content-state parser at the main entry points.                         |
| IIIF Authentication 1 and 2           | Unsupported                                 | No built-in interaction or token flow for gated resources.                                                                               |

## Presentation API 2 and 3

Mango uses `manifesto.js` plus local adapters and resolvers to read both common
Presentation 2 and Presentation 3 structures.

Currently supported viewer features include:

- Manifest loading and multi-Canvas navigation;
- image painting annotations and Image API services;
- audio and video canvases;
- PDF and 3D resources resolved from compatible bodies or renderings;
- multilingual labels, summaries, and metadata;
- rights/attribution and `requiredStatement` display;
- Presentation 3 providers, including common logo, homepage, and `seeAlso`
  details;
- thumbnails and multi-image gallery/layout modes;
- external AnnotationPages; and
- discovery of compatible Content Search services.

Important limitations include:

- no end-user Collection hierarchy browser;
- no general image Range/table-of-contents UI;
- no right-to-left page ordering from `viewingDirection`;
- only selected `behavior`/Presentation 2 `viewingHint` values influence layout;
- no complete UI for `Choice` bodies or all multi-body alternatives; and
- linked resources such as `rendering`, `homepage`, `seeAlso`, and thumbnails are
  handled in particular contexts rather than through one exhaustive resource
  browser.

Mango's A/V contents panel can display chapters and transcripts supplied through
`@mango-iiif/av`; that should not be read as general Range support for every
image-based object.

## Image API compatibility

For image canvases, Mango maps Image API service information into OpenSeadragon
tile sources and provides zoom, pan, rotation, navigator, filters, and viewport
capture. Direct image bodies are also supported where appropriate.

Actual available sizes, formats, qualities, regions, and rotations are governed
by the remote Image API service. Test level 0/static services as well as tiled
level 1/2 services used by your collections.

## W3C Web Annotation

Mango resolves common IIIF/W3C annotations targeting canvases, including:

- Canvas targets and `SpecificResource` targets;
- spatial `xywh` fragments;
- temporal `t` fragments;
- points and SVG polygons used by the annotation tools;
- text and image bodies used by display/search workflows; and
- external AnnotationPages referenced from a Canvas.

The annotation editor can create local shapes and export resolved annotations,
but Mango does not provide an annotation server. The host application must
authenticate, authorise, convert where necessary, and persist authoring output.

Do not assume arbitrary Web Annotation graphs round-trip without loss. Test
multiple bodies, custom motivations/purposes, selectors, stylesheets, and
extension properties before using Mango as an editor for them.

## Content Search API 1 and 2

Mango uses `@mango-iiif/iiif-search-client` to discover a compatible search
service from the Manifest, submit a `q` query, normalise results, display result
counts, and focus spatial hits.

Current viewer limitations:

- only the main query workflow is exposed;
- result pagination is not presented as a complete navigation workflow;
- autocomplete is not currently exposed in the viewer UI; and
- a browser CORS failure from the search endpoint prevents client-side search.

## Content State API 1

Mango recognises the `iiif-content` query parameter, and the codebase contains a
content-state parser. The main component and custom-element entry points
currently assign the parameter directly as a Manifest or story URL rather than
fully resolving the Content State forms, targets, and selectors required by the
specification.

Until this is implemented, treat simple Manifest URLs as the supported sharing
path and do not advertise general Content State interoperability.

## Authentication

Mango does not currently implement the IIIF Authentication API 1 or 2 flows.
Resources that depend on interaction patterns, access cookies, token services,
or probe services may fail as ordinary browser requests. See
[deployment and accessibility](Deployment-and-Accessibility#authentication-and-private-material).

## Story interoperability

The story viewer can interpret a defined IIIF AnnotationPage profile, but the
current story builder saves a versioned Mango envelope around the native story
model. Camera transitions, chapter sequencing, layer opacities, and automatic
advance are Mango behaviours rather than generally portable Presentation API
semantics. See [story format](Storytelling-Format).

## How to assess or improve support

Use the official specifications and IIIF Cookbook as test sources:

- [IIIF Presentation API 3](https://iiif.io/api/presentation/3.0/)
- [IIIF Presentation API 2](https://iiif.io/api/presentation/2.1/)
- [IIIF Image API 3](https://iiif.io/api/image/3.0/)
- [IIIF Content Search API 2](https://iiif.io/api/search/2.0/)
- [IIIF Content State API 1](https://iiif.io/api/content-state/1.0/)
- [IIIF Cookbook](https://iiif.io/api/cookbook/)
- [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/)

For a conformance change, add a stable local fixture and automated expectation,
then verify the real built viewer against the relevant recipe. Record whether
the test covers parsing, visible rendering, interaction, authoring, or
round-tripping.
