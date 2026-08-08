/**
 * A story drawing must keep its own appearance while it is being edited.
 *
 * It did not: it turned from its own colour to the layer palette the moment it
 * was opened for editing, its label ran off across the image, and a label too
 * long for its region swapped to a differently coloured box. Three renderers,
 * three answers for one annotation. These are the seams between them.
 */

import { describe, expect, it } from 'vitest';
import {
  BASE_ROOT_FONT_SIZE,
  STORY_LABEL_SIZING,
  fitRectangleLabelLayout,
} from '../rectangleLabelLayout';
import { hintsFromInlineStyle } from '../style';

/** Exactly what the story builder writes for a drawing annotation. */
const storyTargetStyle = (color: string, fill: string) =>
  `stroke: ${color}; stroke-width: 3; fill: ${fill};`;

const LABEL =
  'Annotations appear in context, helping explain objects, people, and moments without interrupting the story.';

describe('a story drawing keeps its own colour when edited', () => {
  it('recovers stroke, fill and width from the legacy inline style', () => {
    // Story drawings are built as projections directly, so they never acquire
    // resolved style hints. Reading only those hints dropped them onto the
    // layer palette and turned an orange annotation purple.
    const hints = hintsFromInlineStyle(storyTargetStyle('#e07a3f', '#e07a3f'));

    expect(hints).toEqual({
      strokeColor: '#e07a3f',
      fillColor: '#e07a3f',
      strokeWidth: 3,
    });
  });

  it('recovers a translucent fill as written', () => {
    const hints = hintsFromInlineStyle(
      storyTargetStyle('#e07a3f', 'rgba(224, 122, 63, 0.18)'),
    );

    expect(hints?.fillColor).toBe('rgba(224, 122, 63, 0.18)');
  });

  it('still refuses anything that could fetch or execute', () => {
    const hints = hintsFromInlineStyle(
      'stroke: #e07a3f; background-image: url(https://tracker.example/p.gif);',
    );

    expect(hints).toEqual({ strokeColor: '#e07a3f' });
  });
});

describe('story label fitting', () => {
  const at = (root: number) => ({ root });

  it('wraps a sentence rather than running it onto one line', () => {
    // The story overlay draws its labels as HTML and refits them whenever the
    // view changes, so it can wrap. The editor cannot: the canvas package owns
    // that label, clamps it in screen pixels, and does not wrap.
    const layout = fitRectangleLabelLayout(320, 180, LABEL, {
      ...at(BASE_ROOT_FONT_SIZE),
      sizing: STORY_LABEL_SIZING,
    });

    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.join(' ').length).toBeLessThanOrEqual(LABEL.length);
  });

  it('is deterministic for a given region and band', () => {
    // Two calls with the same inputs must agree, or a label would reflow for no
    // reason as the overlay re-renders.
    const first = fitRectangleLabelLayout(320, 180, LABEL, {
      ...at(BASE_ROOT_FONT_SIZE),
      sizing: STORY_LABEL_SIZING,
    });
    const second = fitRectangleLabelLayout(320, 180, LABEL, {
      ...at(BASE_ROOT_FONT_SIZE),
      sizing: STORY_LABEL_SIZING,
    });

    expect(second.lines).toEqual(first.lines);
    expect(second.fontSize).toBe(first.fontSize);
    expect(second.visibleLines).toBe(first.visibleLines);
  });

  it('reports how many lines fit rather than assuming a fixed number', () => {
    const shallow = fitRectangleLabelLayout(200, 40, LABEL, {
      ...at(BASE_ROOT_FONT_SIZE),
      sizing: STORY_LABEL_SIZING,
    });
    const tall = fitRectangleLabelLayout(200, 200, LABEL, {
      ...at(BASE_ROOT_FONT_SIZE),
      sizing: STORY_LABEL_SIZING,
    });

    // A fixed clamp wastes a tall region and cuts a short label unnecessarily.
    expect(shallow.visibleLines).toBeLessThan(tall.visibleLines);
    expect(shallow.visibleLines).toBeGreaterThanOrEqual(1);
  });

  it('never reports more visible lines than it produced', () => {
    const layout = fitRectangleLabelLayout(600, 400, 'Short label', {
      ...at(BASE_ROOT_FONT_SIZE),
      sizing: STORY_LABEL_SIZING,
    });

    expect(layout.overflow).toBe(false);
    expect(layout.visibleLines).toBe(layout.lines.length);
  });
});
