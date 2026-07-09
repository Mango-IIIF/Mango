import type { ModelPose } from './model';
import type { ViewBox } from './viewer';

export type LanguageMap = Record<string, string>;

export type AnnotationPlacement = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type NarrationTrack = {
  src: string;
};

export type NarrationSegment = {
  start: number;
  end: number;
};

export type ChapterAnnotation = {
  text?: string;
  placement?: AnnotationPlacement;
};

export type ChapterAdvance = {
  mode: 'manual' | 'auto' | 'both';
  delayMs?: number;
};

export type ChapterModel = ModelPose;

export type ChapterMedia = {
  start: number;
  end: number;
};

export type Chapter = {
  id: string;
  title?: LanguageMap;
  description?: LanguageMap;
  manifest: string;
  canvasIndex: number;
  canvasId?: string;
  transitionTimeMs?: number;
  viewBox?: ViewBox;
  media?: ChapterMedia;
  model?: ChapterModel;
  narrationSegment?: Record<string, NarrationSegment>;
  annotations?: Record<string, ChapterAnnotation>;
  annotationPlacement?: AnnotationPlacement;
  advance?: ChapterAdvance;
  layerOpacities?: Record<string, number>;
};

export type Story = {
  version: '1.0';
  type: 'story';
  title?: LanguageMap;
  narration?: {
    tracks: Record<string, NarrationTrack>;
  };
  chapters: Chapter[];
};
