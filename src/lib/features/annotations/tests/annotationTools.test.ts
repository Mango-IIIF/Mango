import { describe, expect, it } from 'vitest';
import type { ChapterAnnotationTool } from '../../../core/types/story';
import {
  ANNOTATION_TOOLS,
  DRAWING_ANNOTATION_TOOLS,
  annotationToolLabelKey,
} from '../annotationTools';

/**
 * Compile-time half of the exhaustiveness guard. A tool added to
 * `ChapterAnnotationTool` stops this object satisfying the Record, so tsc fails
 * here first; updating it then fails the assertion below until the shared list
 * gains the tool too. Between them, a new tool cannot reach one palette and
 * miss the other.
 */
const EVERY_TOOL: Record<ChapterAnnotationTool, true> = {
  select: true,
  rectangle: true,
  polygon: true,
  point: true,
  freehand: true,
  line: true,
};

describe('shared annotation tools', () => {
  it('offers every tool the type defines', () => {
    const listed = ANNOTATION_TOOLS.map((tool) => tool.id).sort();
    expect(listed).toEqual(Object.keys(EVERY_TOOL).sort());
  });

  it('gives each tool an icon and lists it once', () => {
    const ids = ANNOTATION_TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tool of ANNOTATION_TOOLS) {
      expect(tool.icon, `${tool.id} has no icon`).toBeTruthy();
    }
  });

  it('drops only select from the drawing subset, keeping order', () => {
    expect(DRAWING_ANNOTATION_TOOLS.map((tool) => tool.id)).toEqual(
      ANNOTATION_TOOLS.filter((tool) => tool.id !== 'select').map((tool) => tool.id),
    );
    expect(DRAWING_ANNOTATION_TOOLS.some((tool) => tool.id === 'select')).toBe(false);
  });

  it('builds the label key both surfaces already translate against', () => {
    expect(annotationToolLabelKey('rectangle')).toBe(
      'viewer.panels.annotations.editor.tools.rectangle',
    );
  });
});
