import type { Component } from 'svelte';
import { MapPin, Minus, MousePointer2, Pencil, Pentagon, Square } from '@lucide/svelte';
import type { ChapterAnnotationTool } from '../../core/types/story';

export type AnnotationToolDefinition = {
  id: ChapterAnnotationTool;
  icon: Component;
};

/**
 * The annotation tools, defined once for every surface that offers them.
 *
 * The story builder and the annotation editor put their palettes in different
 * places — a chapter panel in one, a sidebar in the other — but they are the
 * same tools. Each surface previously carried its own copy of this list, so
 * adding a tool meant editing both and the two drifted apart in ordering.
 * Order here is the order a reader sees, wherever the palette is rendered.
 */
export const ANNOTATION_TOOLS: readonly AnnotationToolDefinition[] = [
  { id: 'select', icon: MousePointer2 },
  { id: 'rectangle', icon: Square },
  { id: 'polygon', icon: Pentagon },
  { id: 'point', icon: MapPin },
  { id: 'freehand', icon: Pencil },
  { id: 'line', icon: Minus },
];

/** The tools that create a shape, for surfaces that drive selection elsewhere. */
export const DRAWING_ANNOTATION_TOOLS: readonly AnnotationToolDefinition[] =
  ANNOTATION_TOOLS.filter((tool) => tool.id !== 'select');

/** Translation key for a tool's label. Shared so the wording cannot diverge. */
export const annotationToolLabelKey = (tool: ChapterAnnotationTool): string =>
  `viewer.panels.annotations.editor.tools.${tool}`;
