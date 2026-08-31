import type { Chapter, StoryState } from '../core/types/story';
import { isAnnotationPlacement } from './annotationPlacement';
import { validatePublicationIdentifiers } from './publicIdentifiers';
import { translate } from '../core/i18n';
import { animatableCameraDurationMs } from './cameraTrack';

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
  const prefix = translate('validation.chapter', { number: index + 1 });
  const error = (key: string, params?: Record<string, string | number>) =>
    translate(`validation.${key}`, { prefix, ...params });

  if (!chapter.manifest) {
    errors.push(error('missingManifest'));
  }
  if (chapter.canvasIndex == null || chapter.canvasIndex < 0) {
    errors.push(error('invalidCanvas'));
  }
  if (!hasSingleCapture(chapter)) {
    errors.push(error('singleCapture'));
  }
  if (chapter.viewBox && !isValidViewBox(chapter)) {
    errors.push(error('invalidViewBox'));
  }
  if (chapter.media && !isValidMedia(chapter)) {
    errors.push(error('invalidMedia'));
  }
  if (chapter.model && !isValidModel(chapter)) {
    errors.push(error('missingModelPose'));
  }
  if (chapter.entryTransition && chapter.entryTransition.durationMs < 0) {
    errors.push(error('entryTransition'));
  }
  if (chapter.presentationDurationMs !== undefined && chapter.presentationDurationMs < 0) {
    errors.push(error('presentationDuration'));
  }
  if (chapter.cameraTrack) {
    if (!(chapter.cameraTrack.durationMs > 0)) {
      errors.push(error('cameraDuration'));
    }
    const pointIds = new Set<string>();
    for (const point of chapter.cameraTrack.keyframes) {
      if (!point.id || pointIds.has(point.id)) {
        errors.push(error('cameraPointIds'));
      }
      pointIds.add(point.id);
      if (
        point.timeMs < 0 ||
        point.timeMs > animatableCameraDurationMs(chapter.cameraTrack)
      ) {
        errors.push(error('cameraPointOutside'));
      }
      if (!point.focus && !point.viewBox && !point.model && !point.layerOpacities) {
        errors.push(error('cameraPointState'));
      }
    }
  }

  if (
    chapter.annotationPlacement !== undefined &&
    !isAnnotationPlacement(chapter.annotationPlacement)
  ) {
    errors.push(error('invalidAnnotationPlacement'));
  }

  const segments = chapter.narrationSegment ?? {};
  for (const [lang, segment] of Object.entries(segments)) {
    if (segment.end <= segment.start) {
      errors.push(error('invalidNarration', { language: lang }));
    }
  }

  const annotations = chapter.annotations ?? {};
  for (const [lang, annotation] of Object.entries(annotations)) {
    if (annotation.placement && !isAnnotationPlacement(annotation.placement)) {
      errors.push(error('invalidPlacement', { language: lang }));
    }
  }

  return errors;
};

export const validateStory = (story: StoryState): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!Array.isArray(story.chapters) || story.chapters.length === 0) {
    errors.push(translate('validation.storyEmpty'));
  }

  if (Array.isArray(story.chapters)) {
    story.chapters.forEach((chapter, index) => {
      errors.push(...validateChapter(chapter, index));
    });
  }

  if (story.publication?.status === 'published' || story.id || story.publication?.annotationBase) {
    errors.push(...validatePublicationIdentifiers(story).errors);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
};
