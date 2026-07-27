import { describe, expect, it } from 'vitest';
import {
  fitRectangleLabelFontSize,
  fitRectangleLabelLayout,
  rectangleLabelOutlineWidth,
} from '../rectangleLabelLayout';

describe('rectangle annotation label layout', () => {
  it('scales the label down with a smaller rectangle', () => {
    const large = fitRectangleLabelFontSize(280, 240, 'Rectangle label');
    const small = fitRectangleLabelFontSize(135, 126, 'Rectangle label');

    expect(large).toBeGreaterThan(small);
    expect(rectangleLabelOutlineWidth(large)).toBeGreaterThan(
      rectangleLabelOutlineWidth(small),
    );
  });

  it('wraps long labels and remains proportional when the rectangle is zoomed', () => {
    const label =
      'Annotations appear in context, helping explain objects, people, and moments without interrupting the story.';
    const normal = fitRectangleLabelLayout(400, 150, label);
    const zoomed = fitRectangleLabelLayout(800, 300, label);

    expect(normal.lines.length).toBeGreaterThan(1);
    expect(normal.lines.every((line) => line.length > 0)).toBe(true);
    expect(zoomed.fontSize / normal.fontSize).toBeCloseTo(2, 2);
    expect(zoomed.lines).toEqual(normal.lines);
  });
});
