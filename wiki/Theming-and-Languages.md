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
- `sepia` — warm reading-oriented palette; and
- `midnight` — deeper dark palette.

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
