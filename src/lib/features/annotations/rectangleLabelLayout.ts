/**
 * Label sizing for shapes Mango draws itself.
 *
 * Shared deliberately by the story overlay and the annotation editor. The
 * canvas package clamps a label's size but cannot wrap it, and a sentence on a
 * region has to wrap somewhere — so both surfaces fit their labels here, which
 * is what stops the same annotation being laid out one way while playing and
 * another way while being edited.
 *
 * Two rules, and both exist because the previous version had neither. Sizes are
 * bounded: the search used to run up to 42% of the rectangle's height with no
 * ceiling, so a region covering a manuscript page produced a headline. And
 * sizes respond to the reader's text settings: an absolute pixel size in a
 * transformed SVG ignores browser text zoom entirely, which for anyone relying
 * on larger text means the one piece of text they cannot enlarge is the label.
 */

export type RectangleLabelLayout = {
  /** Screen pixels, clamped into the band. */
  fontSize: number;
  lineHeight: number;
  lines: string[];
  /** True when the label does not fit even at the smallest permitted size. */
  overflow: boolean;
  /**
   * How many lines actually fit the region at this size.
   *
   * Equal to `lines.length` unless the label overflows, where it is what the
   * caller may show before clipping. A caller that clamps to a fixed number
   * either wastes room in a tall region or cuts a short label that would have
   * fitted.
   */
  visibleLines: number;
};

/** Lower and upper bound for a label, in screen pixels at default text size. */
export type LabelSizing = {
  min: number;
  max: number;
};

/**
 * The story band is slightly larger than the editor band because story labels
 * are read from further back, in a presentation rather than an editing context.
 */
export const EDITOR_LABEL_SIZING: LabelSizing = { min: 11, max: 18 };
export const STORY_LABEL_SIZING: LabelSizing = { min: 12, max: 20 };

/** No label exceeds this, whatever the band asks for. */
export const LABEL_CEILING = 24;

/** The root font size the bands above are expressed against. */
export const BASE_ROOT_FONT_SIZE = 16;

/**
 * The document's root font size.
 *
 * Browser text-only zoom and a user's default-font-size preference both change
 * this, and reading it is what lets an SVG label in user units respond to them.
 * A CSS unit would be the obvious answer, but the label is drawn inside a
 * transformed overlay where a `rem` is scaled by the viewer's zoom like any
 * other length, which reintroduces exactly the unbounded growth being fixed.
 */
const rootFontSize = (): number => {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return BASE_ROOT_FONT_SIZE;
  }
  const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : BASE_ROOT_FONT_SIZE;
};

/** Scales a band by the reader's text size, keeping the absolute ceiling. */
export const scaleSizing = (sizing: LabelSizing, root = rootFontSize()): LabelSizing => {
  const factor = root / BASE_ROOT_FONT_SIZE;
  return {
    min: sizing.min * factor,
    max: Math.min(sizing.max, LABEL_CEILING) * factor,
  };
};

const wrapLabel = (label: string, charactersPerLine: number): string[] => {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (word.length > charactersPerLine) {
      if (line) lines.push(line);
      line = '';
      for (let offset = 0; offset < word.length; offset += charactersPerLine) {
        lines.push(word.slice(offset, offset + charactersPerLine));
      }
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= charactersPerLine) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const layoutAt = (
  fontSize: number,
  availableWidth: number,
  label: string,
): { lineHeight: number; lines: string[] } => {
  const lineHeight = fontSize * 1.18;
  const charactersPerLine = Math.max(1, Math.floor(availableWidth / (fontSize * 0.56)));
  return { lineHeight, lines: wrapLabel(label, charactersPerLine) };
};

export type FitOptions = {
  sizing?: LabelSizing;
  /** Root font size to size against. Read from the document when omitted. */
  root?: number;
};

/**
 * Largest banded size at which the label fits the rectangle.
 *
 * `width` and `height` are screen pixels. Passing image coordinates would size
 * the label against the region rather than against the reader's screen, which
 * is the mistake this replaced.
 */
export const fitRectangleLabelLayout = (
  width: number,
  height: number,
  label: string,
  options: FitOptions = {},
): RectangleLabelLayout => {
  const band = scaleSizing(options.sizing ?? EDITOR_LABEL_SIZING, options.root ?? rootFontSize());
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const availableWidth = safeWidth * 0.88;
  const availableHeight = safeHeight * 0.8;

  const fits = (fontSize: number, lineHeight: number, lines: string[]): boolean =>
    lines.length * lineHeight <= availableHeight && fontSize * 0.56 <= availableWidth;

  const smallest = layoutAt(band.min, availableWidth, label);
  if (!fits(band.min, smallest.lineHeight, smallest.lines)) {
    // Report rather than shrink. A label rendered at four pixels is not a label
    // anyone reads; the caller clamps it and defers the rest to the inspector.
    return {
      fontSize: band.min,
      ...smallest,
      overflow: true,
      visibleLines: Math.max(1, Math.floor(availableHeight / smallest.lineHeight)),
    };
  }

  let low = band.min;
  let high = Math.max(band.min, band.max);
  let best: RectangleLabelLayout = {
    fontSize: band.min,
    ...smallest,
    overflow: false,
    visibleLines: smallest.lines.length,
  };

  for (let iteration = 0; iteration < 20; iteration += 1) {
    const fontSize = (low + high) / 2;
    const { lineHeight, lines } = layoutAt(fontSize, availableWidth, label);
    if (fits(fontSize, lineHeight, lines)) {
      best = { fontSize, lineHeight, lines, overflow: false, visibleLines: lines.length };
      low = fontSize;
    } else high = fontSize;
  }

  return best;
};

export const fitRectangleLabelFontSize = (
  width: number,
  height: number,
  label: string,
  options: FitOptions = {},
): number => fitRectangleLabelLayout(width, height, label, options).fontSize;

export const rectangleLabelOutlineWidth = (fontSize: number): number =>
  Math.max(1, fontSize * 0.1);
