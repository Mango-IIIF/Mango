import type { Chapter, Story } from '../../core/types/story';

export type StoryWithDefaults = Story & {
  chapters: Array<Chapter & { transitionTimeMs: number }>;
};

const extractStoryObject = (input: unknown): Story | null => {
  if (!input || typeof input !== 'object') return null;
  const maybeWrapped = (input as any).data;
  if (maybeWrapped && typeof maybeWrapped === 'object' && maybeWrapped.type === 'story') {
    return maybeWrapped as Story;
  }
  if ((input as any).type === 'story') {
    return input as Story;
  }
  return null;
};

const withChapterDefaults = (story: Story): StoryWithDefaults => ({
  ...story,
  chapters: (story.chapters ?? []).map((chapter) => ({
    ...chapter,
    transitionTimeMs: chapter.transitionTimeMs ?? 2000,
  })),
});

export const normaliseStoryInput = (
  input: unknown,
): { ok: boolean; story?: StoryWithDefaults; error?: string } => {
  const story = extractStoryObject(input);
  if (!story) {
    return { ok: false, error: 'Invalid story shape' };
  }
  return { ok: true, story: withChapterDefaults(story) };
};

export const validateStoryViewer = (
  story: StoryWithDefaults,
): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!story || story.type !== 'story') {
    errors.push('Story: invalid type');
  }
  if (!Array.isArray(story.chapters) || story.chapters.length === 0) {
    errors.push('Story: must have at least one chapter');
  }

  const chapters = story.chapters ?? [];
  chapters.forEach((chapter, index) => {
    const prefix = `Chapter ${index + 1}`;
    if (!chapter.id) errors.push(`${prefix}: missing id`);
    if (!chapter.manifest) errors.push(`${prefix}: missing manifest`);
    if (chapter.canvasIndex == null || Number.isNaN(chapter.canvasIndex)) {
      errors.push(`${prefix}: invalid canvas index`);
    }
    const hasCapture = Boolean(
      chapter.viewBox || chapter.media || chapter.model || chapter.narrationSegment,
    );
    if (!hasCapture) {
      errors.push(`${prefix}: must have viewBox, media, model, or narration segment`);
    }
    if (chapter.media) {
      const { start, end } = chapter.media;
      if (!(typeof start === 'number' && typeof end === 'number') || end <= start) {
        errors.push(`${prefix}: media end must be greater than start`);
      }
    }
    if (chapter.transitionTimeMs != null && chapter.transitionTimeMs <= 0) {
      errors.push(`${prefix}: transitionTimeMs must be positive`);
    }
    if (chapter.narrationSegment) {
      for (const [lang, segment] of Object.entries(chapter.narrationSegment)) {
        if (segment.end <= segment.start) {
          errors.push(`${prefix}: narration segment invalid for ${lang}`);
        }
      }
    }
  });

  return {
    ok: errors.length === 0,
    errors,
  };
};
