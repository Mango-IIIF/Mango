import type { Chapter, Story } from '../core/types/story';
import { isAnnotationPlacement } from './annotationPlacement';

const hasSingleCapture = (chapter: Chapter): boolean => {
  const captureCount = [chapter.viewBox, chapter.media, chapter.model].filter(Boolean)
    .length;
  return captureCount === 1;
};

const isValidViewBox = (chapter: Chapter): boolean => {
  if (!chapter.viewBox) return false;
  return chapter.viewBox.w > 0 && chapter.viewBox.h > 0;
};

const isValidMedia = (chapter: Chapter): boolean => {
  if (!chapter.media) return false;
  return chapter.media.end > chapter.media.start;
};

const isValidModel = (chapter: Chapter): boolean => {
  if (!chapter.model) return false;
  return Boolean(
    chapter.model.cameraOrbit ||
      chapter.model.cameraTarget ||
      chapter.model.orientation ||
      chapter.model.fieldOfView,
  );
};

const validateChapter = (chapter: Chapter, index: number): string[] => {
  const errors: string[] = [];
  const prefix = `Chapter ${index + 1}`;

  if (!chapter.manifest) {
    errors.push(`${prefix}: missing manifest`);
  }
  if (chapter.canvasIndex == null || chapter.canvasIndex < 0) {
    errors.push(`${prefix}: invalid canvas index`);
  }
  if (!hasSingleCapture(chapter)) {
    errors.push(`${prefix}: must have exactly one of viewBox, media, or model`);
  }
  if (chapter.viewBox && !isValidViewBox(chapter)) {
    errors.push(`${prefix}: viewBox width/height must be > 0`);
  }
  if (chapter.media && !isValidMedia(chapter)) {
    errors.push(`${prefix}: media end must be greater than start`);
  }
  if (chapter.model && !isValidModel(chapter)) {
    errors.push(`${prefix}: model pose is missing`);
  }

  if (
    chapter.annotationPlacement !== undefined &&
    !isAnnotationPlacement(chapter.annotationPlacement)
  ) {
    errors.push(`${prefix}: invalid chapter annotation placement`);
  }

  const segments = chapter.narrationSegment ?? {};
  for (const [lang, segment] of Object.entries(segments)) {
    if (segment.end <= segment.start) {
      errors.push(`${prefix}: narration segment invalid for ${lang}`);
    }
  }

  const annotations = chapter.annotations ?? {};
  for (const [lang, annotation] of Object.entries(annotations)) {
    if (annotation.placement && !isAnnotationPlacement(annotation.placement)) {
      errors.push(`${prefix}: invalid placement for ${lang}`);
    }
  }

  return errors;
};

export const validateStory = (story: Story): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!story || story.type !== 'story') {
    errors.push('Story: invalid type');
  }
  if (story.version !== '1.0') {
    errors.push('Story: invalid version');
  }
  if (!Array.isArray(story.chapters) || story.chapters.length === 0) {
    errors.push('Story: must have at least one chapter');
  }

  if (Array.isArray(story.chapters)) {
    story.chapters.forEach((chapter, index) => {
      errors.push(...validateChapter(chapter, index));
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
};
