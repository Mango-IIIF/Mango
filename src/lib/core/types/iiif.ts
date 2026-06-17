/**
 * IIIF Type Definitions
 * 
 * Type-safe definitions for IIIF Presentation API v2 and v3 structures.
 * These types reduce reliance on `any` and improve IDE support.
 */

/**
 * Common IIIF identifiable types - used across v2 and v3
 */
export type IIIFIdentifiable = 
  | string 
  | { id: string } 
  | { '@id': string };

/**
 * Type guard to check if value has an id//@id property
 */
export function isIdentifiable(value: unknown): value is IIIFIdentifiable {
  if (!value) return false;
  if (typeof value === 'string') return true;
  if (typeof value === 'object') {
    return 'id' in value || '@id' in value;
  }
  return false;
}

/**
 * IIIF v2 and v3 language map structures
 */
export type LanguageMap = Record<string, string[]>;

/**
 * IIIF Selector types
 */
export type IIIFSelector = 
  | string
  | { 
      type?: string;
      value?: string; 
      fragment?: string;
    };

/**
 * IIIF Target structures (both v2 and v3)
 */
export type IIIFTarget = 
  | string
  | {
      id?: string;
      '@id'?: string;
      source?: IIIFIdentifiable;
      selector?: IIIFSelector | IIIFSelector[];
    }
  | IIIFTarget[];

/**
 * IIIF Annotation Body
 */
export type IIIFAnnotationBody = {
  id?: string;
  '@id'?: string;
  type?: string;
  '@type'?: string;
  value?: string;
  format?: string;
  language?: string;
  label?: string | LanguageMap;
};

/**
 * IIIF Annotation structure
 */
export interface IIIFAnnotation {
  id?: string;
  '@id'?: string;
  type?: string;
  '@type'?: string;
  motivation?: string | string[];
  body?: IIIFAnnotationBody | IIIFAnnotationBody[];
  target?: IIIFTarget;
  stylesheet?: string | Array<string | { '@id': string }>;
}

/**
 * Utility type for optional property lookup
 */
export type MaybeWithProperty<T extends string> = {
  [K in T]?: unknown;
};

/**
 * Runtime type guard for IIIF annotation
 */
export function isAnnotation(value: unknown): value is IIIFAnnotation {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return ('id' in obj || '@id' in obj) && ('target' in obj || 'on' in obj);
}
