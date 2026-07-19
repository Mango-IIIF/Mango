# Mango IIIF documentation

Mango is a flexible IIIF viewer and storytelling toolkit for museums, libraries,
archives, galleries, and digital scholarship projects. It displays IIIF
Presentation manifests containing high-resolution images, audio, video, PDFs,
3D models, annotations, and search services.

Use Mango as:

- a standalone `<mango-viewer>` on an existing website;
- an npm dependency in a JavaScript, React, Vue, or Svelte application;
- an annotation workspace;
- a story viewer or story-authoring interface; or
- an extensible viewer with institution-specific plugins and styling.

## Start here

- **[Getting started](Getting-Started)** — add a working viewer to a web page
  or install Mango from npm.
- **[Configuration](Configuration)** — choose panels, language, theme,
  initial canvas and layout, OpenSeadragon options, and authoring behaviour.
- **[Application integrations](Integrations)** — use the custom element with
  plain HTML, JavaScript, React, Vue, or Svelte.
- **[Theming and languages](Theming-and-Languages)** — match institutional
  branding and localise the interface.

## Use and extend Mango

- **[JavaScript API](API-Reference)** — navigate, control media, change the
  viewport, manage annotations, and inspect viewer state.
- **[Events](Event-Handling)** — respond to navigation, playback, viewport,
  annotation, plugin, and error events.
- **[Plugins](Plugin-System)** — add institution-specific controls or UI to
  the viewer without changing Mango itself.
- **[Story format](Storytelling-Format)** — display, build, import, export,
  and save guided narratives.
- **[IIIF support](IIIF-Conformance)** — understand supported standards and
  current limitations.
- **[Deployment and accessibility](Deployment-and-Accessibility)** — prepare
  a viewer for a public collections website.

## Contribute

- **[Developer and architecture guide](Developer-Guide)** — set up a local
  checkout, understand the codebase, run checks, and contribute changes.
- **[Project status](Codebase-Audit-and-Failures)** — current known
  limitations and where to report problems.

## What a host website must provide

Mango is a client-side viewer. Your institution remains responsible for:

- publishing IIIF resources at stable HTTPS URLs;
- allowing the viewer's origin through CORS on manifests, images, annotations,
  search responses, media, captions, and other linked resources;
- deciding how authored annotations and stories are authenticated and stored;
- supplying accessible page structure around the viewer; and
- pinning and testing the Mango version used in production.
