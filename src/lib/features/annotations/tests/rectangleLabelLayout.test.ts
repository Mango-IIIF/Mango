import { describe, expect, it } from 'vitest';
import {
  BASE_ROOT_FONT_SIZE,
  EDITOR_LABEL_SIZING,
  LABEL_CEILING,
  STORY_LABEL_SIZING,
  fitRectangleLabelFontSize,
  fitRectangleLabelLayout,
  rectangleLabelOutlineWidth,
  scaleSizing,
} from '../rectangleLabelLayout';

const LABEL = 'Rectangle label';
const at = (root: number) => ({ root });

describe('rectangle annotation label layout', () => {
  it('never produces headline text for a large region', () => {
    // The defect this replaced: the search ran to 42% of the rectangle's height
    // with no ceiling, so a region covering a whole page rendered at ~500px.
    const huge = fitRectangleLabelFontSize(4000, 3000, LABEL, at(BASE_ROOT_FONT_SIZE));

    expect(huge).toBeLessThanOrEqual(EDITOR_LABEL_SIZING.max);
    expect(huge).toBeLessThanOrEqual(LABEL_CEILING);
  });

  it('stops growing once the band is reached, however far the region is zoomed', () => {
    const normal = fitRectangleLabelLayout(400, 150, LABEL, at(BASE_ROOT_FONT_SIZE));
    const zoomed = fitRectangleLabelLayout(800, 300, LABEL, at(BASE_ROOT_FONT_SIZE));

    expect(zoomed.fontSize).toBe(normal.fontSize);
    expect(zoomed.overflow).toBe(false);
  });

  it('reports overflow rather than shrinking a label to nothing', () => {
    const tiny = fitRectangleLabelLayout(
      18,
      10,
      'Annotations appear in context, helping explain objects and moments.',
      at(BASE_ROOT_FONT_SIZE),
    );

    expect(tiny.overflow).toBe(true);
    // The caller shows a badge instead; the size stays legible either way.
    expect(tiny.fontSize).toBeGreaterThanOrEqual(EDITOR_LABEL_SIZING.min);
  });

  it('follows the reader’s text size', () => {
    const normal = fitRectangleLabelFontSize(4000, 3000, LABEL, at(BASE_ROOT_FONT_SIZE));
    const enlarged = fitRectangleLabelFontSize(4000, 3000, LABEL, at(BASE_ROOT_FONT_SIZE * 1.5));

    expect(enlarged).toBeGreaterThan(normal);
    expect(enlarged / normal).toBeCloseTo(1.5, 1);
  });

  it('keeps the absolute ceiling when text is enlarged past it', () => {
    const band = scaleSizing({ min: 20, max: 40 }, BASE_ROOT_FONT_SIZE);

    // The band asks for 40; the ceiling is 24 and wins.
    expect(band.max).toBe(LABEL_CEILING);
  });

  it('wraps long labels onto several lines', () => {
    const label =
      'Annotations appear in context, helping explain objects, people, and moments without interrupting the story.';
    const layout = fitRectangleLabelLayout(400, 150, label, at(BASE_ROOT_FONT_SIZE));

    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.every((line) => line.length > 0)).toBe(true);
  });

  it('sizes story labels above editor labels', () => {
    const editor = fitRectangleLabelFontSize(4000, 3000, LABEL, {
      sizing: EDITOR_LABEL_SIZING,
      root: BASE_ROOT_FONT_SIZE,
    });
    const story = fitRectangleLabelFontSize(4000, 3000, LABEL, {
      sizing: STORY_LABEL_SIZING,
      root: BASE_ROOT_FONT_SIZE,
    });

    expect(story).toBeGreaterThan(editor);
  });

  it('thickens the outline with the text', () => {
    expect(rectangleLabelOutlineWidth(20)).toBeGreaterThan(rectangleLabelOutlineWidth(11));
  });
});
