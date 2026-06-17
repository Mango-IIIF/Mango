import { describe, it, expect } from 'vitest';
import { XYWHFragment } from '../XYWHFragment';

describe('XYWHFragment', () => {
  it('should create a fragment with coordinates', () => {
    const fragment = new XYWHFragment(10, 20, 100, 200);
    expect(fragment.x).toBe(10);
    expect(fragment.y).toBe(20);
    expect(fragment.w).toBe(100);
    expect(fragment.h).toBe(200);
  });

  it('should serialize to string with floor rounding', () => {
    const fragment = new XYWHFragment(10.7, 20.3, 100.9, 200.1);
    expect(fragment.toString()).toBe('10,20,100,200');
  });

  it('should parse from string with xywh= prefix', () => {
    const fragment = XYWHFragment.fromString('xywh=10,20,100,200');
    expect(fragment.x).toBe(10);
    expect(fragment.y).toBe(20);
    expect(fragment.w).toBe(100);
    expect(fragment.h).toBe(200);
  });

  it('should parse from string without prefix', () => {
    const fragment = XYWHFragment.fromString('10,20,100,200');
    expect(fragment.x).toBe(10);
    expect(fragment.y).toBe(20);
    expect(fragment.w).toBe(100);
    expect(fragment.h).toBe(200);
  });

  it('should round-trip correctly', () => {
    const original = new XYWHFragment(100, 200, 300, 400);
    const serialized = original.toString();
    const parsed = XYWHFragment.fromString(serialized);
    expect(parsed.x).toBe(original.x);
    expect(parsed.y).toBe(original.y);
    expect(parsed.w).toBe(original.w);
    expect(parsed.h).toBe(original.h);
  });
});
