# Theming and languages

Mango can follow institutional branding while keeping its UI encapsulated in a
custom element. It also includes English, Welsh, French, and Spanish interface
translations.

## Built-in themes

Set the theme in viewer configuration:

```html
<mango-viewer
  manifest-id="https://example.org/iiif/manifest.json"
  config='{"theme":"light"}'
></mango-viewer>
```

```js
viewer.config = { theme: "sepia" };
```

Built-in themes are:

- `dark` — default dark viewer;
- `light` — light panels and stage;
- `sepia` — warm reading-oriented palette;
- `midnight` — deeper dark palette; and
- `ringo` — a yellow submarine, for when the occasion calls for one.

Every theme covers the story viewer as well as the standard viewer chrome.

The `theme` value belongs inside `config`; `<mango-viewer theme="light">` is not
a supported element attribute.

## Institutional colours with CSS variables

CSS custom properties inherit through the custom element's Shadow DOM. Put a
class on the `<mango-viewer>` host and define variables on that class:

```html
<mango-viewer
  class="museum-viewer"
  manifest-id="https://example.org/iiif/manifest.json"
></mango-viewer>
```

```css
.museum-viewer {
  --viewer-bg: #f5f1e8;
  --viewer-surface: #fffdf8;
  --viewer-stage: #262626;
  --viewer-panel: #ffffff;
  --viewer-panel-strong: #eee8dc;
  --viewer-panel-border: #c9c0b2;
  --viewer-text: #24211d;
  --viewer-muted: #6d655c;
  --viewer-accent: #8d2f2f;
  --viewer-accent-2: #b24b43;
}
```

### Core variables

| Variable                | Controls                             |
| ----------------------- | ------------------------------------ |
| `--viewer-bg`           | Main viewer background               |
| `--viewer-surface`      | Primary UI surface                   |
| `--viewer-stage`        | Media stage background               |
| `--viewer-panel`        | Sidebar and plugin panels            |
| `--viewer-panel-strong` | Emphasised panel surfaces            |
| `--viewer-panel-border` | Panel and control borders            |
| `--viewer-text`         | Primary text                         |
| `--viewer-muted`        | Secondary text                       |
| `--viewer-accent`       | Primary controls and highlights      |
| `--viewer-accent-2`     | Secondary accent and focus treatment |

Mango exposes additional fine-grained variables for its dock, toolbar, gallery,
search, stage, and close buttons. Inspect the relevant component styles before
depending on a fine-grained variable, because the core palette above is the most
stable theme surface.

### Story variables

The story viewer runs a palette of its own rather than reusing `--viewer-accent`,
so that a story can carry a different accent from the chrome around it. Override
these to restyle the story viewer without touching the rest of the viewer:

| Variable                     | Controls                                  |
| ---------------------------- | ----------------------------------------- |
| `--story-shell-bg`           | Story shell background (accepts gradients) |
| `--story-text`               | Chapter title and primary story text       |
| `--story-muted`              | Description, timecode, chapter numbers     |
| `--story-accent`             | Play button, scrubber, active chapter dot  |
| `--story-accent-text`        | Chapter label and "Show more" control      |
| `--story-accent-text-hover`  | Hover state for the above                  |
| `--story-line`               | Sidebar and section dividers               |
| `--story-control-bg`         | Transport button surfaces                  |
| `--story-control-border`     | Transport button and thumbnail borders     |
| `--story-control-hover-bg`   | Transport and chapter hover state          |
| `--story-track-bg`           | Scrubber track                             |
| `--story-track-border`       | Scrubber track border                      |
| `--story-active-ring`        | Active chapter thumbnail ring              |
| `--story-active-halo`        | Active chapter thumbnail outer edge        |
| `--story-error`              | Story loading errors                       |
| `--story-note-bg`            | Annotation note card background            |
| `--story-note-text`          | Annotation note card text                  |
| `--story-label-bg`           | Annotation label background                |
| `--story-label-text`         | Annotation label text                      |

Shades derived from `--story-accent` — the play button glow, the scrubber fill
and thumb, the active chapter border — are mixed from it at render time, so
setting `--story-accent` alone re-tints the whole transport.

Per-annotation `--accent` and `--ink` values carried in the story document still
win over `--story-note-*`, so author-chosen annotation colours survive a theme
change.

### Audio visualizer variables

Audio Canvases render artwork behind the transport, and by default a pulse that
swells with the audio. It follows `--viewer-accent` unless given a colour of its
own, and Mango damps it to suit the viewer stage. Two variables retune it:

| Variable                              | Controls                                  |
| ------------------------------------- | ----------------------------------------- |
| `--mango-viewer-av-visualizer-color`  | Visualizer colour, defaulting to `--viewer-accent` |
| `--mango-viewer-av-visualizer-intensity` | How strongly it renders, `0.4` by default |

Intensity is a unitless multiplier. `0` hides the visualizer without affecting
playback, `1` is the AV package's own strength, and values above `1` push it
towards saturation. Both variables apply to the `waveform` and `spectrum`
visualizer modes as well as the default pulse — for those two, intensity scales
the height of the trace and of the bars, not only their opacity.

```css
.museum-viewer {
  --mango-viewer-av-visualizer-color: #2ac7ff;
  --mango-viewer-av-visualizer-intensity: 0.7;
}
```

Unlike `--viewer-accent`, these are read where they are used and are never
reassigned inside the viewer, so a value set on the `<mango-viewer>` host — or
any ancestor of it — reaches the visualizer in every theme.

### Story builder variables

The story builder follows the same palette, plus:

| Variable                       | Controls                                |
| ------------------------------ | --------------------------------------- |
| `--story-builder-accent`       | Primary buttons, active tools and tabs   |
| `--story-builder-accent-hover` | Hover state for the above                |
| `--viewer-well-bg`             | Sunken surfaces — inputs, scrub tracks   |
| `--viewer-danger`              | Destructive actions and error text       |
| `--viewer-success`             | "Configured" and confirmation states     |
| `--viewer-warning`             | Warnings and unsaved-state indicators    |

Builder chrome resolves its accent as `var(--accent, var(--story-builder-accent))`.
Custom properties inherit through the Shadow DOM, so a host page that declares
`--accent` brands the builder and overrides the theme's own accent — in every
theme at once. Leave `--accent` unset unless you want that, which is why the
bundled demos brand themselves with `--demo-accent` instead.

All five themes meet WCAG AA for body and muted text, status colours, and the
keyboard focus indicator. Accent tokens are used as button fills carrying white
labels, so if you override one, keep it dark enough to clear 4.5:1 against
white — a host that overrides `--accent` owns that contrast.

`--viewer-well-bg` is stated per theme rather than mixed from `--viewer-text`,
because a sunken surface has to go *darker* than its panel; mixing from the text
colour would lighten it on the dark themes.

Always test contrast, focus visibility, selected states, annotation overlays,
and disabled controls after applying a custom palette.

## Choose the interface language

Set the preferred language with `config.language`:

```html
<mango-viewer
  manifest-id="https://example.org/iiif/manifest.json"
  config='{"language":"cy"}'
></mango-viewer>
```

```js
viewer.config = { language: "fr" };
```

Mango resolves the interface language in this order:

1. `config.language`;
2. the browser language; and
3. English.

Region variants such as `en-GB` fall back to their base language. Unsupported
languages fall back to English.

Supported UI catalogues are:

| Code | Language          |
| ---- | ----------------- |
| `en` | English           |
| `cy` | Welsh / Cymraeg   |
| `fr` | French / Français |
| `es` | Spanish / Español |

This setting also influences which value Mango selects from IIIF language maps.
It does not translate descriptive metadata supplied by an institution.

## Multilingual IIIF resources

For the best result, publishers should provide Presentation 3 language maps for
labels, summaries, metadata, required statements, and provider information.
Mango prefers the configured language, then English, then a value without a
language, and finally the first available value where necessary.

Captions, transcripts, story text, and narration tracks can carry their own
language information. Their available languages depend on the source IIIF or
story resource, not only on the Mango UI catalogue.

## Add or improve a translation

Translation catalogues live in `src/locales`:

1. Copy `src/locales/en.json` to a file named for the new language.
2. Translate every value without changing message keys or placeholders.
3. Import the catalogue and add it to `catalogue` in `src/lib/core/i18n.ts`.
4. Run the unit tests and manually exercise viewer, workspace, annotation, and
   story interfaces at narrow and wide sizes.
5. Submit the catalogue and registration change together.

`setLocale` is an internal module helper and is not part of the package-root
public API. Integrators should use `config.language`.
