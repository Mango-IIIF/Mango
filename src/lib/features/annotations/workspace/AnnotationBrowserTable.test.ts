import { describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import AnnotationBrowserTable from './AnnotationBrowserTable.svelte';

describe('AnnotationBrowserTable', () => {
  it('uses layer names and meaningful selection names instead of internal ids', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onselect = vi.fn();
    const instance = mount(AnnotationBrowserTable, {
      target,
      props: {
        annotations: [
          {
            id: 'urn:uuid:technical-value',
            shapeType: 'rect',
            rect: { x: 1, y: 2, w: 3, h: 4 },
            text: 'A marginal note',
            targetStyleClass: 'mine',
          },
        ],
        layers: [
          {
            id: 'mine',
            name: 'My Annotations',
            color: '#a78bfa',
            visible: true,
          },
        ],
        onselect,
      },
    });

    expect(target.textContent).toContain('My Annotations');
    expect(
      [...target.querySelectorAll('option')].map((option) => option.textContent),
    ).toContain('My Annotations');
    const select = target.querySelector('.annotation-table__select') as HTMLButtonElement;
    expect(select.getAttribute('aria-label')).toContain('Rectangle: A marginal note');
    select.click();
    expect(onselect).toHaveBeenCalledWith({ id: 'urn:uuid:technical-value' });

    unmount(instance);
    target.remove();
  });
});
