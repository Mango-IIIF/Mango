import { describe, it, expect } from 'vitest';
import { buildExportEnvelope } from '../exportHelpers';
import type { Story } from '../../../core/types/story';

describe('exportHelpers', () => {
  describe('buildExportEnvelope', () => {
    it('should build basic export envelope', () => {
      const story: Story = {
        title: { en: 'Test Story' },
        chapters: [],
      };

      const envelope = buildExportEnvelope(story);

      expect(envelope.version).toBe(1);
      expect(envelope.meta.source).toBe('storybuilder');
      expect(envelope.data).toBeDefined();
      expect(envelope.exportedAt).toBeDefined();
    });

    it('should include app version when provided', () => {
      const story: Story = {
        title: { en: 'Test' },
        chapters: [],
      };

      const envelope = buildExportEnvelope(story, '1.0.0');

      expect(envelope.meta.appVersion).toBe('1.0.0');
    });

    it('should map chapter IDs', () => {
      const story: Story = {
        title: { en: 'Test' },
        chapters: [
          { manifest: 'test1', canvasIndex: 0 } as any,
          { manifest: 'test2', canvasIndex: 1 } as any,
        ],
      };

      const envelope = buildExportEnvelope(story);

      expect(envelope.data.chapters[0].id).toBe('chapter_1');
      expect(envelope.data.chapters[1].id).toBe('chapter_2');
    });

    it('should merge annotation placement', () => {
      const story: Story = {
        title: { en: 'Test' },
        chapters: [
          {
            manifest: 'test',
            canvasIndex: 0,
            annotations: { en: { text: 'Hello' } },
            annotationPlacement: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
          } as any,
        ],
      };

      const envelope = buildExportEnvelope(story);

      expect(envelope.data.chapters[0].annotations.en.placement).toEqual({
        x: 0.1,
        y: 0.2,
        w: 0.3,
        h: 0.4,
      });
    });
  });
});
