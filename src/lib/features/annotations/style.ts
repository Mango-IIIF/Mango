/**
 * Presentation styling for annotations.
 *
 * Two jobs that have to stay separate. Reading: an imported annotation may
 * carry an Annotation-level stylesheet, which is CSS a stranger wrote, and
 * nothing here may hand it to the browser — it is parsed into a small set of
 * presentation hints and everything outside an allowlist is discarded. Writing:
 * Mango's layer colours become a `CssStylesheet` plus a target `styleClass`,
 * the one representation of colour that survives a round trip through a
 * conformant consumer.
 *
 * The line this file exists to hold: colour is a hint. It never carries
 * motivation, purpose, ownership, visibility, or layer membership. A consumer
 * that loses the stylesheet loses the colour and nothing else.
 */

import {
  createStylesheet,
  type CanonicalAnnotation,
  type CanonicalStylesheet,
} from '@mango-iiif/w3c-parser';

/** Presentation hints, in the form the canvas package's theme expects. */
export type PresentationHints = {
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
};

/**
 * CSS properties Mango will act on.
 *
 * Everything else is dropped rather than passed through, including anything
 * that can fetch (`background-image`), position (`top`), or execute
 * (`behavior`, `-moz-binding`). The list is short because the rendering surface
 * is an SVG shape, and a property that cannot change a shape's outline or fill
 * has no business arriving with an annotation.
 */
const ALLOWED_PROPERTIES = new Set([
  'stroke',
  'fill',
  'stroke-width',
  'stroke-opacity',
  'fill-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
]);

/** Bounds on stylesheet parsing. A stylesheet is third-party input. */
const MAX_STYLESHEET_LENGTH = 20_000;
const MAX_RULES = 200;
const MAX_DECLARATIONS_PER_RULE = 32;

/**
 * Declarations that can reach the network, execute, or escape the shape.
 *
 * Checked on the value rather than the property because the dangerous forms are
 * values: `url(...)` fetches, `expression(...)` executed in old engines, and a
 * `javascript:` scheme is a script wherever it is accepted.
 */
const UNSAFE_VALUE = /url\s*\(|expression\s*\(|javascript\s*:|@import|<\/?script/i;

export type StyleRule = {
  /** Bare class name, without the leading dot. */
  className: string;
  declarations: Record<string, string>;
};

export type StylesheetParseResult = {
  rules: StyleRule[];
  /** Declarations and selectors refused, for the advanced/diagnostic panel. */
  rejected: string[];
};

const isSafeClassName = (value: string): boolean => /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(value);

/**
 * Parses CSS into class rules.
 *
 * Deliberately not a general CSS parser and deliberately not the browser's:
 * handing this text to a stylesheet object — even a constructed one — is what
 * the sanitizing exists to avoid, and the accepted grammar here is one flat
 * class selector with simple declarations. Anything more expressive is refused
 * rather than approximated, because an approximation is how a selector escapes
 * the annotation root.
 */
export const parseAnnotationCss = (css: string): StylesheetParseResult => {
  const rules: StyleRule[] = [];
  const rejected: string[] = [];
  if (!css || css.length > MAX_STYLESHEET_LENGTH) {
    if (css) rejected.push('stylesheet-too-long');
    return { rules, rejected };
  }

  // Comments first: a declaration commented out must not be read, and a
  // comment is also the cheapest place to hide an unbalanced brace.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = rulePattern.exec(source)) && rules.length < MAX_RULES) {
    const selector = match[1].trim();
    const block = match[2];

    if (selector.startsWith('@')) {
      rejected.push(`at-rule:${selector.split(/\s+/)[0]}`);
      continue;
    }
    // One class selector, nothing else. A descendant or element selector could
    // match Mango's own UI once the stylesheet is applied to a live tree.
    const className = selector.startsWith('.') ? selector.slice(1) : '';
    if (!className || !isSafeClassName(className)) {
      rejected.push(`selector:${selector.slice(0, 64)}`);
      continue;
    }

    const declarations: Record<string, string> = {};
    let count = 0;
    for (const entry of block.split(';')) {
      if (count >= MAX_DECLARATIONS_PER_RULE) break;
      const separator = entry.indexOf(':');
      if (separator < 0) continue;
      const property = entry.slice(0, separator).trim().toLowerCase();
      const value = entry.slice(separator + 1).trim();
      if (!property || !value) continue;
      if (!ALLOWED_PROPERTIES.has(property)) {
        rejected.push(`property:${property}`);
        continue;
      }
      if (UNSAFE_VALUE.test(value) || value.includes('!important')) {
        rejected.push(`value:${property}`);
        continue;
      }
      declarations[property] = value;
      count += 1;
    }

    if (Object.keys(declarations).length > 0) {
      rules.push({ className, declarations });
    }
  }

  return { rules, rejected };
};

/** Turns allowlisted declarations into the hints the renderer understands. */
export const hintsFromDeclarations = (
  declarations: Record<string, string>,
): PresentationHints => {
  const strokeWidth = Number.parseFloat(declarations['stroke-width'] ?? '');
  const opacity = Number.parseFloat(declarations.opacity ?? '');
  return {
    ...(declarations.stroke ? { strokeColor: declarations.stroke } : {}),
    ...(declarations.fill ? { fillColor: declarations.fill } : {}),
    ...(Number.isFinite(strokeWidth) ? { strokeWidth } : {}),
    ...(Number.isFinite(opacity) ? { opacity } : {}),
  };
};

/**
 * Reads the presentation hints an annotation's own stylesheet defines for a
 * class.
 *
 * External stylesheet references are recognised and ignored: resolving one
 * means fetching a URL a stranger supplied, and that decision belongs to the
 * host, not to a render pass. The class then has no applicable stylesheet, the
 * shape renders in the normal theme, and the caller reports the diagnostic.
 */
export const hintsForStyleClass = (
  annotation: CanonicalAnnotation,
  styleClass: string | undefined,
): { hints?: PresentationHints; rejected: string[]; unresolved: boolean } => {
  if (!styleClass) return { rejected: [], unresolved: false };
  const rejected: string[] = [];
  for (const stylesheet of annotation.stylesheets) {
    if (stylesheet.isReference || !stylesheet.value) continue;
    const parsed = parseAnnotationCss(stylesheet.value);
    rejected.push(...parsed.rejected);
    const rule = parsed.rules.find((entry) => entry.className === styleClass);
    if (rule) return { hints: hintsFromDeclarations(rule.declarations), rejected, unresolved: false };
  }
  return { rejected, unresolved: true };
};

/* ------------------------------------------------------------------------- */
/* Writing                                                                    */
/* ------------------------------------------------------------------------- */

/** Layer colour, and nothing about what the layer means. */
export type LayerAppearance = {
  id: string;
  color: string;
};

export const LAYER_FILL_OPACITY = 0.18;

/**
 * CSS class name for a layer.
 *
 * The layer's own id when it is a usable CSS identifier, which keeps Mango's
 * output identical to what the parser's migration helper produces for legacy
 * documents — two paths to the same class name rather than two class names for
 * the same layer. Ids that are not valid identifiers get a stable escaped form.
 */
export const styleClassForLayer = (layerId: string): string => {
  const trimmed = layerId.trim();
  if (isSafeClassName(trimmed)) return trimmed;
  const escaped = trimmed.replace(/[^A-Za-z0-9_-]/g, '-').replace(/^[^A-Za-z_-]+/, '');
  return escaped ? `mango-${escaped}` : 'mango-layer';
};

export const rgbaFromHex = (color: string, alpha: number): string => {
  const value = color.trim();
  const short = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  const long = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  const channels = short
    ? short.slice(1).map((channel) => parseInt(`${channel}${channel}`, 16))
    : long
      ? long.slice(1).map((channel) => parseInt(channel, 16))
      : null;
  return channels ? `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})` : value;
};

export const cssForLayer = (layer: LayerAppearance): string =>
  `.${styleClassForLayer(layer.id)} { stroke: ${layer.color}; fill: ${rgbaFromHex(
    layer.color,
    LAYER_FILL_OPACITY,
  )}; }`;

/**
 * Builds the Annotation-level stylesheet for the layers an annotation uses.
 *
 * Only the layers actually referenced: a stylesheet listing every layer in the
 * application would leak the full layer set into every exported annotation,
 * which is organisation metadata rather than presentation.
 */
export const buildLayerStylesheet = (
  layers: readonly LayerAppearance[],
): CanonicalStylesheet | null => {
  const rules = layers.filter((layer) => layer.color).map((layer) => cssForLayer(layer));
  if (!rules.length) return null;
  return createStylesheet(rules.join('\n'));
};

/**
 * Reads a colour back out of a legacy inline `target.style` value.
 *
 * Retained only for migration: Mango wrote this convention, so documents in
 * user stores carry it, and the colour is recoverable even though the property
 * itself is not portable.
 */
export const colorFromInlineStyle = (style: string | undefined): string | null => {
  if (!style) return null;
  const match = style.match(/stroke:\s*(#[0-9a-f]{3,8})/i);
  return match ? match[1].toLowerCase() : null;
};

/** Parses a legacy inline `target.style` value into presentation hints. */
export const hintsFromInlineStyle = (style: string | undefined): PresentationHints | undefined => {
  if (!style) return undefined;
  const declarations: Record<string, string> = {};
  for (const entry of style.split(';')) {
    const separator = entry.indexOf(':');
    if (separator < 0) continue;
    const property = entry.slice(0, separator).trim().toLowerCase();
    const value = entry.slice(separator + 1).trim();
    if (!ALLOWED_PROPERTIES.has(property) || UNSAFE_VALUE.test(value)) continue;
    declarations[property] = value;
  }
  const hints = hintsFromDeclarations(declarations);
  return Object.keys(hints).length > 0 ? hints : undefined;
};
