# Deployment and accessibility

Use this checklist when moving Mango from a demo into a public museum, library,
archive, gallery, or research website.

## Pin and test the package version

Use an exact npm or CDN version in production. Test upgrades against the
manifests and services your institution publishes, including older Presentation
2 resources and restricted or unusually large objects.

## Give the viewer a useful size

The custom element fills its host, so the page must provide a height:

```css
.collection-viewer {
  width: 100%;
  height: min(75vh, 900px);
  min-height: 420px;
}

.collection-viewer mango-viewer {
  display: block;
  width: 100%;
  height: 100%;
}
```

Avoid forcing a full viewport height when the viewer sits within a longer item
record; visitors should still be able to reach the title, description, rights,
downloads, and related content.

## CORS and remote resources

The browser fetches the Manifest and its linked resources. Each relevant server
must allow the origin that hosts Mango. Check:

- Presentation manifests and collections;
- Image API `info.json` and image tiles;
- audio, video, PDF, and 3D files;
- annotation pages and annotation stylesheets;
- Content Search responses;
- captions, transcripts, thumbnails, and downloads; and
- story JSON and narration audio.

A manifest can load successfully while a linked resource still fails CORS.
Inspect the browser network panel when only one feature is missing.

## Content Security Policy

Your policy may need to allow remote IIIF origins in `connect-src`, images and
tiles in `img-src`, media in `media-src`, and 3D/PDF worker requirements used by
the deployed build. Start from your institution's restrictive policy and add
only the hosts required by the resources you display.

Remote annotation stylesheets are fetched and inserted into the viewer's style
host. Only enable or publish annotation stylesheet links from sources you trust.

## Authentication and private material

Mango does not currently implement the IIIF Authentication API. Do not assume a
normal application login makes cross-origin gated IIIF services available.
Confirm the complete browser request flow before using Mango for restricted
material.

Do not put permanent API tokens in `config`, story JSON, HTML attributes, or
client-side JavaScript. Use server-side sessions, same-origin proxying where
appropriate, or short-lived credentials.

## Accessibility checklist

Mango supplies labels and keyboard-operable controls across its viewer UI, but
the host page still determines the complete experience. Before launch:

1. Give the viewer a descriptive heading and surrounding context.
2. Preserve a logical heading order and visible keyboard focus.
3. Test all required tasks using only a keyboard.
4. Test at 200% zoom and at narrow mobile widths.
5. Check contrast after applying institutional CSS variables.
6. Provide captions, transcripts, audio description, and meaningful IIIF labels
   in the source resource where applicable.
7. Ensure rights and required statements remain available outside any
   interaction that is difficult to access.
8. Test with the screen readers and browsers required by your organisation.

Treat accessibility testing as part of release acceptance. The presence of
ARIA attributes does not by itself establish conformance with WCAG.

## Privacy and analytics

Mango does not need analytics to display a public manifest. If the host page
records viewer events, document that collection in your privacy notice and avoid
sending annotation text, search queries, or collection identifiers unless they
are genuinely required.

Use [viewer events](Event-Handling) to integrate consent-aware analytics in
the host application.

## Failure handling

Listen for the public `error` event and provide a useful message outside the
viewer. Class/component integrations can also subscribe to `pluginError` through
`viewer.on`. A public page should still expose item metadata and alternative
links when rich media cannot load.

```js
const viewer = document.querySelector("mango-viewer");

viewer.addEventListener("error", (event) => {
  document.querySelector("#viewer-status").textContent =
    `The viewer could not load this item: ${event.detail.message}`;
});
```

## Production checks

- Test representative image, A/V, PDF, 3D, search, annotation, and multilingual
  resources.
- Test more than one Mango instance on the same page if your design permits it.
- Verify mobile layouts and low-bandwidth loading.
- Confirm CORS, CSP, caching, and HTTPS behaviour on the production origin.
- Keep a non-JavaScript link to the source Manifest or collection record where
  that is useful to researchers and support staff.
