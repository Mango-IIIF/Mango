import { describe, expect, it } from 'vitest';
import { normaliseStoryInput, validateStoryViewer } from '../storyLoader';

const baseChapter = {
  id: 'chapter-1',
  manifest: 'https://example.org/manifest.json',
  canvasIndex: 0,
  viewBox: { x: 0, y: 0, w: 100, h: 80 },
};

const directStory = {
  version: '1.0',
  type: 'story',
  chapters: [baseChapter],
};

const wrappedStory = {
  data: directStory,
};

describe('storyLoader.normaliseStoryInput', () => {
  it('accepts direct story object', () => {
    const result = normaliseStoryInput(directStory);
    expect(result.ok).toBe(true);
    expect(result.story?.chapters[0].transitionTimeMs).toBe(2000);
  });

  it('unwraps story from data wrapper', () => {
    const result = normaliseStoryInput(wrappedStory);
    expect(result.ok).toBe(true);
    expect(result.story?.chapters[0].manifest).toBe(baseChapter.manifest);
  });
});

describe('storyLoader.validateStoryViewer', () => {
  it('accepts valid story', () => {
    const normalised = normaliseStoryInput(directStory);
    expect(normalised.ok).toBe(true);
    const validation = validateStoryViewer(normalised.story!);
    expect(validation.ok).toBe(true);
  });

  it('rejects missing chapters', () => {
    const normalised = normaliseStoryInput({ type: 'story', version: '1.0', chapters: [] });
    const validation = normalised.story
      ? validateStoryViewer(normalised.story)
      : { ok: false, errors: [] };
    expect(validation.ok).toBe(false);
  });

  it('validates the actual demo.json', () => {
    const fs = require('fs');
    const path = require('path');
    const raw = fs.readFileSync(path.resolve(__dirname, '../../../../../apps/demo/test-story/demo.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const normalised = normaliseStoryInput(parsed);
    expect(normalised.ok).toBe(true);
    const validation = validateStoryViewer(normalised.story!);
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
  });
});
