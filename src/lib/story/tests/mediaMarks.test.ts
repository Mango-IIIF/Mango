import { describe, expect, it } from 'vitest';
import { createMediaMarks } from '../mediaMarks';

describe('media marks', () => {
  it('records mark in/out from latest time', () => {
    const marks = createMediaMarks();
    marks.updateTime(3.2);
    marks.markIn();
    marks.updateTime(8.4);
    marks.markOut();

    expect(marks.getSegment()).toEqual({ start: 3.2, end: 8.4 });
  });

  it('rejects invalid segments', () => {
    const marks = createMediaMarks();
    marks.updateTime(5);
    marks.markIn();
    marks.updateTime(4);
    marks.markOut();

    expect(marks.hasValidMarks()).toBe(false);
    expect(marks.getSegment()).toBeNull();
  });

  it('clears marks', () => {
    const marks = createMediaMarks();
    marks.updateTime(1);
    marks.markIn();
    marks.updateTime(2);
    marks.markOut();
    marks.clear();

    expect(marks.getSegment()).toBeNull();
  });
});
