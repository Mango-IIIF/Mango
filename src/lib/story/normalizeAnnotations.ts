import type {
  AnnotationPlacement,
  Chapter,
  StoryState,
} from "../core/types/story";

const isAbsolutePlacement = (placement: AnnotationPlacement): boolean =>
  placement.x > 1 || placement.y > 1 || placement.w > 1 || placement.h > 1;

const absolutePlacement = (
  placement: AnnotationPlacement,
  chapter: Chapter,
): AnnotationPlacement => {
  if (isAbsolutePlacement(placement) || !chapter.viewBox) return placement;
  return {
    x: chapter.viewBox.x + placement.x * chapter.viewBox.w,
    y: chapter.viewBox.y + placement.y * chapter.viewBox.h,
    w: placement.w * chapter.viewBox.w,
    h: placement.h * chapter.viewBox.h,
  };
};

/**
 * Fold the retired story text-box model into a single Mango rectangle.
 * The old fields are deliberately omitted from the returned chapter so all
 * authoring and playback after loading uses one annotation model.
 */
export const normalizeChapterAnnotations = (chapter: Chapter): Chapter => {
  const drawingAnnotations = (chapter.drawingAnnotations ?? []).map(
    (drawing) => {
      if (!drawing.text?.trim() || drawing.label) return drawing;
      const { text, ...rest } = drawing;
      return { ...rest, label: { en: text.trim() } };
    },
  );
  const legacy = Object.entries(chapter.annotations ?? {}).filter(([, item]) =>
    item.text?.trim(),
  );

  if (legacy.length > 0) {
    const label = Object.fromEntries(
      legacy.map(([lang, item]) => [lang, item.text!.trim()]),
    );
    const placement =
      legacy.map(([, item]) => item.placement).find(Boolean) ??
      chapter.annotationPlacement;
    if (placement) {
      const baseId = `${chapter.id}-annotation`;
      let id = baseId;
      let suffix = 2;
      while (drawingAnnotations.some((drawing) => drawing.id === id))
        id = `${baseId}-${suffix++}`;
      drawingAnnotations.push({
        id,
        type: "rectangle",
        rect: absolutePlacement(placement, chapter),
        label,
        color: "#e07a3f",
        strokeWidth: "medium",
        fillMode: "solid",
      });
    }
  }

  const {
    annotations: _annotations,
    annotationPlacement: _placement,
    ...rest
  } = chapter;
  return {
    ...rest,
    ...(drawingAnnotations.length > 0 ? { drawingAnnotations } : {}),
  };
};

export const normalizeStoryAnnotations = (story: StoryState): StoryState => ({
  ...story,
  chapters: story.chapters.map(normalizeChapterAnnotations),
});
