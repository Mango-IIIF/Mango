# Fix IIIF Cookbook media classification and cross-origin playback failures

## Proposed issue title

Fix false AV detection and CORS-related playback failures in IIIF Cookbook recipes 0004, 0013, 0017, and 0026

## Summary

Mango currently fails to display four IIIF Cookbook recipes correctly:

- [0004 — Image and Canvas with Differing Dimensions](https://iiif.io/api/cookbook/recipe/0004-canvas-size/manifest.json)
- [0013 — Load a Preview Image Before the Main Content](https://iiif.io/api/cookbook/recipe/0013-placeholderCanvas/manifest.json)
- [0017 — Providing Access to Transcript Files of A/V Content](https://iiif.io/api/cookbook/recipe/0017-transcription-av/manifest.json)
- [0026 — Table of Contents for A/V Content](https://iiif.io/api/cookbook/recipe/0026-toc-opera/manifest.json)

Depending on the browser, the viewer reports one of the following native media errors:

```text
PipelineStatus::DEMUXER_ERROR_COULD_NOT_OPEN:
FFmpegDemuxer: open context failed
```

```text
MEDIA_ELEMENT_ERROR: Player load failure: error creating media player
```

There are two independent causes:

1. `@mango-iiif/av` 0.1.0 incorrectly identifies the PNG in recipe 0004 as video because the image URL contains a `/video/` path segment.
2. The AV player adds `crossorigin="anonymous"` by default. The MP4 URLs in recipes 0013, 0017, and 0026 redirect to S3 responses that do not include `Access-Control-Allow-Origin`, so browsers reject the media when it is requested in CORS mode.

The MP4 files are valid H.264/AAC media. This is not a codec or corrupt-file problem.

## Affected versions

- `@mango-iiif/iiif-viewer`: 0.0.4
- `@mango-iiif/av`: 0.1.0
- Confirmed in Chromium; the precise error text varies by browser/media backend.

## Reproduction

Load each manifest in Mango:

| Recipe | Manifest | Current result | Expected result |
| --- | --- | --- | --- |
| 0004 | [manifest.json](https://iiif.io/api/cookbook/recipe/0004-canvas-size/manifest.json) | The PNG can be passed to a `<video>` player and produces a demuxer/media error. | Render the PNG through the image renderer. No AV player should be created. |
| 0013 | [manifest.json](https://iiif.io/api/cookbook/recipe/0013-placeholderCanvas/manifest.json) | The poster appears, but the MP4 fails to load. | Show the placeholder canvas and then load/play the MP4. |
| 0017 | [manifest.json](https://iiif.io/api/cookbook/recipe/0017-transcription-av/manifest.json) | The MP4 fails to load. | Load/play the MP4 and expose the text transcript. |
| 0026 | [manifest.json](https://iiif.io/api/cookbook/recipe/0026-toc-opera/manifest.json) | The MP4 fails to load. | Load/play the MP4 and expose its range-based table of contents. |

## Root cause 1: image URL incorrectly classified as video

Mango currently calls `av.load()` for every loaded resource that is not a Collection. This happens in `src/lib/viewer/state/viewerController.ts` even when the manifest is image-only.

The AV package's `mediaKind()` implementation builds a single searchable string from the IIIF type, MIME type, and full source URL:

```ts
const haystack = `${type ?? ""} ${format ?? ""} ${src}`.toLowerCase();

if (/\baudio\b|\.mp3.../.test(haystack)) return "audio";
if (/\bvideo\b|\.mp4.../.test(haystack)) return "video";
```

Recipe 0004 declares its body correctly:

```json
{
  "id": "https://fixtures.iiif.io/video/indiana/donizetti-elixir/act1-thumbnail.png",
  "type": "Image",
  "format": "image/png"
}
```

Because the URL contains `/video/`, `mediaKind()` returns `video` despite the authoritative `Image` type and `image/png` format. The normalized result is consequently invalid:

```json
{
  "kind": "video",
  "format": "image/png"
}
```

### Required classifier fix

IIIF type and MIME type must take precedence over URL inference:

```ts
const mediaKind = (
  type?: string,
  format?: string,
  src = "",
): "audio" | "video" | undefined => {
  const normalizedType = type?.toLowerCase();
  const normalizedFormat = format?.toLowerCase().split(";", 1)[0]?.trim();

  if (normalizedType === "audio" || normalizedFormat?.startsWith("audio/")) {
    return "audio";
  }
  if (normalizedType === "video" || normalizedFormat?.startsWith("video/")) {
    return "video";
  }

  // An explicit non-AV type or MIME type is authoritative.
  if (normalizedType || normalizedFormat) return undefined;

  // Infer from the URL only when metadata is absent. Inspect the pathname or
  // filename extension, not arbitrary directory names.
  const pathname = src.toLowerCase().split(/[?#]/, 1)[0] ?? "";
  if (/\.(?:mp3|m4a|wav|aac)$/.test(pathname)) return "audio";
  if (/\.(?:mp4|webm|m3u8)$/.test(pathname)) return "video";
  return undefined;
};
```

The production implementation should continue to recognize the IIIF type aliases already supported by the package, but it must retain this precedence rule.

### Mango-side defence

Mango should additionally avoid passing clearly image-only manifests to `av.load()`. This prevents an AV-normalizer defect from overriding the media type already resolved by Mango.

The guard must inspect painting annotation bodies, including `Choice` bodies, rather than searching arbitrary JSON strings for `audio` or `video`.

## Root cause 2: default anonymous-CORS mode rejects redirected MP4s

The player configuration currently defaults to:

```ts
crossorigin: "anonymous"
```

The custom player therefore emits:

```html
<video crossorigin="anonymous" ...></video>
```

The affected sources are:

- Recipes 0013 and 0026: [vae0637_accessH264_low.mp4](https://fixtures.iiif.io/video/indiana/donizetti-elixir/vae0637_accessH264_low.mp4)
- Recipe 0017: [volleyball-for-boys.mp4](https://fixtures.iiif.io/video/indiana/volleyball/high/volleyball-for-boys.mp4)

Both fixture URLs redirect to `iiif-fixtures.s3.amazonaws.com`. Byte-range requests work and return `206 Partial Content`, but the final S3 MP4 response does not currently include `Access-Control-Allow-Origin`.

Browser verification produced the following results for both MP4s:

| Media element configuration | Result |
| --- | --- |
| No `crossorigin` attribute | `loadedmetadata` succeeds and the media is playable. |
| `crossorigin="anonymous"` | Media error code 4; Chromium reports `MEDIA_ELEMENT_ERROR`. |

### Required player fix

Mango should use ordinary no-CORS media loading unless the application explicitly requests CORS-enabled media:

```ts
const avConfig = (config?: ViewerConfig): AVPlayerConfig => ({
  crossorigin: "",
  ...config?.av,
  // Existing controls, audioArt, and language configuration...
});
```

The empty value must result in no `crossorigin` attribute being emitted. An explicit consumer setting of `anonymous` or `use-credentials` must continue to override the default.

The same default should be considered for `@mango-iiif/av` itself. If the package retains `anonymous` as its default, Mango must override it in its integration layer.

No-CORS loading has a trade-off: cross-origin text tracks and reading video frames into a canvas may require anonymous CORS plus appropriate response headers. This should be documented. Deployments needing those features can explicitly set:

```ts
{
  av: {
    crossorigin: "anonymous"
  }
}
```

The fixture infrastructure should also be updated to add `Access-Control-Allow-Origin: *` to the final S3 responses. That is desirable but should not be required for ordinary MP4 playback in Mango.

## Regression-test specification

Tests must not depend exclusively on the live Cookbook service. Commit snapshots of the four manifests as test fixtures, record each source URL in a comment or fixture metadata field, and periodically refresh them from the canonical links above. A separate optional live smoke test may use the remote manifests.

### 1. AV classifier unit tests

Add table-driven tests covering explicit metadata precedence and URL fallback:

```ts
it.each([
  {
    type: "Image",
    format: "image/png",
    src: "https://example.org/video/poster.png",
    expected: undefined,
  },
  {
    type: "Video",
    format: "video/mp4",
    src: "https://example.org/resource-without-extension",
    expected: "video",
  },
  {
    type: "Audio",
    format: "audio/mpeg",
    src: "https://example.org/resource-without-extension",
    expected: "audio",
  },
  {
    type: undefined,
    format: undefined,
    src: "https://example.org/media/movie.mp4?download=1",
    expected: "video",
  },
  {
    type: undefined,
    format: undefined,
    src: "https://example.org/video/poster.png",
    expected: undefined,
  },
])("classifies $src as $expected", ({ type, format, src, expected }) => {
  expect(mediaKind(type, format, src)).toBe(expected);
});
```

### 2. Manifest normalization regression tests

Use locally stored snapshots of the canonical manifests:

#### Recipe 0004

Source: [canonical manifest](https://iiif.io/api/cookbook/recipe/0004-canvas-size/manifest.json)

- `normalizeManifest()` must not return an audio or video source for the PNG painting body.
- The source must remain available to Mango's image resolver.
- Creating the viewer must not create a `<video>`, `<audio>`, or `<mango-av-player>` element for this canvas.

#### Recipe 0013

Source: [canonical manifest](https://iiif.io/api/cookbook/recipe/0013-placeholderCanvas/manifest.json)

- The normalized source kind must be `video`.
- The source format must be `video/mp4`.
- The placeholder canvas image must be exposed as the poster.
- Loading the manifest must render the AV player and the expected poster.

#### Recipe 0017

Source: [canonical manifest](https://iiif.io/api/cookbook/recipe/0017-transcription-av/manifest.json)

- The normalized source kind must be `video`.
- The Canvas `rendering` entry with `text/plain` must remain available.
- Mango's transcript integration must expose the rendering as a transcript.

#### Recipe 0026

Source: [canonical manifest](https://iiif.io/api/cookbook/recipe/0026-toc-opera/manifest.json)

- The normalized source kind must be `video`.
- The manifest's Range hierarchy must remain available as chapters.
- Selecting a temporal chapter must seek the video to the Range's start time.

### 3. Mango integration tests

Add an integration test that spies on the AV integration:

- Loading recipe 0004 must not select `AVRenderer` and must not expose an AV media source.
- Loading recipes 0013, 0017, and 0026 must select `AVRenderer`.
- The default Mango AV configuration must resolve `crossorigin` to the empty string.
- Setting `config.av.crossorigin` explicitly must be preserved.

### 4. Browser playback regression tests

Add Playwright coverage using a small checked-in MP4 or a deterministic test server:

1. Serve a same-origin URL that redirects to a second origin.
2. Have the final response support byte ranges but omit CORS headers.
3. Load it with Mango's default configuration.
4. Assert that the video fires `loadedmetadata`, has no `crossorigin` attribute, and has `media.error === null`.
5. Add a configuration test showing that `crossorigin: "anonymous"` emits the attribute. The test server should add `Access-Control-Allow-Origin: *` for this case.

The live Cookbook MP4s may be covered by a non-blocking smoke-test job, but they should not be the sole CI tests because their redirects and headers are externally controlled.

## Acceptance criteria

- Recipe 0004 renders as an image and never instantiates the AV player.
- Recipes 0013, 0017, and 0026 reach `loadedmetadata` and can begin playback with Mango's default configuration.
- Recipe 0013 displays its placeholder/poster image.
- Recipe 0017 exposes its transcript rendering.
- Recipe 0026 exposes its Range hierarchy and temporal navigation.
- No affected recipe produces `DEMUXER_ERROR_COULD_NOT_OPEN`, `MEDIA_ELEMENT_ERROR`, or media error code 4 under the tested default configuration.
- Explicit `anonymous` and `use-credentials` AV configuration remains supported.
- Tests cover MIME/type precedence, misleading directory names, URL-extension fallback, redirected range requests, and all four canonical Cookbook manifests.
- Mango is updated to consume the patched `@mango-iiif/av` release and its lockfile records that version.

## Proposed delivery

1. Fix and test `mediaKind()` in [`Mango-IIIF/av`](https://github.com/Mango-IIIF/av).
2. Review the AV package's default `crossorigin` behavior and publish a patch release.
3. Add the image-only AV-load guard and Mango-level `crossorigin: ""` default.
4. Upgrade Mango to the patched AV package.
5. Add the four manifest snapshots, normalization tests, Mango integration tests, and deterministic browser playback test.
6. Update the Cookbook support matrix after the regression suite passes.

