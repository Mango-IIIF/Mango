import { describe, expect, it, vi } from 'vitest';
import { createCommandStack, labelForPatch, type GeometryHistory } from '../commands';
import type { ResolvedAnnotation } from '../../../iiif/annotationResolver';

const annotation = (text: string): ResolvedAnnotation => ({ id: 'anno-1', text });

const fakeGeometry = () => {
  const calls: string[] = [];
  let depth = 0;
  const history: GeometryHistory = {
    get canUndo() {
      return depth > 0;
    },
    get canRedo() {
      return depth < 1;
    },
    undo() {
      if (depth === 0) return false;
      depth -= 1;
      calls.push('undo');
      return true;
    },
    redo() {
      depth += 1;
      calls.push('redo');
      return true;
    },
  };
  return { history, calls, commit: () => (depth += 1) };
};

describe('command stack', () => {
  it('reverses a metadata edit', () => {
    const apply = vi.fn();
    const stack = createCommandStack({ apply });

    stack.record({
      annotationId: 'anno-1',
      before: annotation('Before'),
      after: annotation('After'),
      label: 'text',
    });

    expect(stack.state().canUndo).toBe(true);
    expect(stack.undo()).toBe(true);
    expect(apply).toHaveBeenCalledWith('anno-1', annotation('Before'));

    expect(stack.redo()).toBe(true);
    expect(apply).toHaveBeenLastCalledWith('anno-1', annotation('After'));
  });

  it('does not record the changes an undo itself causes', () => {
    // Applying an undo re-enters the same handlers that record edits. Without
    // the guard the stack refills as fast as it drains and undo never finishes.
    const stack = createCommandStack({
      apply: () => {
        stack.record({
          annotationId: 'anno-1',
          before: annotation('Echo'),
          after: annotation('Echo'),
          label: 'text',
        });
      },
    });

    stack.record({
      annotationId: 'anno-1',
      before: annotation('Before'),
      after: annotation('After'),
      label: 'text',
    });
    stack.undo();

    expect(stack.state().canUndo).toBe(false);
  });

  it('interleaves geometry and metadata in the order they happened', () => {
    const applied: Array<string | null> = [];
    const geometry = fakeGeometry();
    const stack = createCommandStack({
      apply: (_id, value) => applied.push(value?.text ?? null),
      geometry: () => geometry.history,
    });

    stack.record({
      annotationId: 'anno-1',
      before: annotation('First'),
      after: annotation('Second'),
      label: 'text',
    });
    geometry.commit();
    stack.recordGeometry('anno-1', 'geometry');

    // The drag happened last, so it is undone first.
    stack.undo();
    expect(geometry.calls).toEqual(['undo']);
    expect(applied).toEqual([]);

    stack.undo();
    expect(applied).toEqual(['First']);
  });

  it('drops a geometry step whose editor has gone', () => {
    const stack = createCommandStack({ apply: vi.fn(), geometry: () => null });

    stack.recordGeometry('anno-1', 'geometry');
    expect(stack.undo()).toBe(false);
    // Dropped rather than left on the stack: there is nothing left to reverse,
    // and keeping it would make undo look broken on the next press.
    expect(stack.state().canUndo).toBe(false);
  });

  it('discards the redo branch once a new edit lands', () => {
    const stack = createCommandStack({ apply: vi.fn() });

    stack.record({
      annotationId: 'anno-1',
      before: annotation('A'),
      after: annotation('B'),
      label: 'text',
    });
    stack.undo();
    expect(stack.state().canRedo).toBe(true);

    stack.record({
      annotationId: 'anno-1',
      before: annotation('A'),
      after: annotation('C'),
      label: 'text',
    });
    expect(stack.state().canRedo).toBe(false);
  });

  it('keeps the stack bounded', () => {
    const stack = createCommandStack({ apply: vi.fn(), limit: 2 });

    for (const value of ['A', 'B', 'C']) {
      stack.record({
        annotationId: 'anno-1',
        before: annotation(value),
        after: annotation(value),
        label: 'text',
      });
    }

    expect(stack.undo()).toBe(true);
    expect(stack.undo()).toBe(true);
    expect(stack.undo()).toBe(false);
  });

  it('names the change so it can be announced', () => {
    expect(labelForPatch({ tags: ['a'] })).toBe('tags');
    expect(labelForPatch({ text: 'x' })).toBe('text');
    expect(labelForPatch({ targetStyleClass: 'mine' })).toBe('layer');
  });
});
