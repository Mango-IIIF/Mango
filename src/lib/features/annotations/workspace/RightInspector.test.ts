import { describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import RightInspector from './RightInspector.svelte';
import { createMangoAnnotation, projectToResolved } from '../canonical';

const annotation = () =>
  projectToResolved(
    createMangoAnnotation({
      id: 'https://example.org/annotation/1',
      canvasId: 'https://example.org/canvas/1',
      shape: { type: 'rect', geometry: { x: 1, y: 2, w: 30, h: 40 } },
      text: 'A comment',
      motivation: 'commenting',
      bodyPurpose: 'commenting',
      language: 'en',
    }),
    { provenance: 'local' },
  )!;

describe('RightInspector semantic edits', () => {
  it('patches motivation and body purpose atomically when a preset changes', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onupdate = vi.fn();
    const instance = mount(RightInspector, {
      target,
      props: {
        annotation: annotation(),
        layers: [{ id: 'mine', name: 'My Annotations', color: '#a78bfa', visible: true }],
        total: 1,
        index: 0,
        onupdate,
      },
    });
    await tick();

    const preset = target.querySelector('#anno-preset') as HTMLSelectElement;
    preset.value = 'transcribe';
    preset.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(onupdate).toHaveBeenLastCalledWith({
      id: 'https://example.org/annotation/1',
      patch: { motivation: ['supplementing'] },
      options: {
        bodyPurpose: 'transcribing',
        bodyPath: annotation().bodies?.[0]?.path,
      },
    });

    unmount(instance);
    target.remove();
  });

  /*
   * The expert purpose control is only reachable in expert mode and is easy to
   * leave inert: it once wrote a local variable and never patched, so a
   * selection looked accepted, was reverted by the next projection, and never
   * reached the export.
   */
  it('patches body purpose when the expert control is changed directly', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onupdate = vi.fn();
    const instance = mount(RightInspector, {
      target,
      props: {
        annotation: annotation(),
        expertMode: true,
        layers: [{ id: 'mine', name: 'My Annotations', color: '#a78bfa', visible: true }],
        total: 1,
        index: 0,
        onupdate,
      },
    });
    await tick();

    const purpose = target.querySelector('#anno-purpose') as HTMLSelectElement;
    expect(purpose).not.toBeNull();
    purpose.value = 'describing';
    purpose.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(onupdate).toHaveBeenLastCalledWith({
      id: 'https://example.org/annotation/1',
      patch: {},
      options: {
        bodyPurpose: 'describing',
        bodyPath: annotation().bodies?.[0]?.path,
      },
    });

    unmount(instance);
    target.remove();
  });

  it('creates a parallel body by switching to a configured language', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onupdate = vi.fn();
    const instance = mount(RightInspector, {
      target,
      props: {
        annotation: annotation(),
        languages: ['en', 'cy'],
        layers: [{ id: 'mine', name: 'My Annotations', color: '#a78bfa', visible: true }],
        total: 1,
        index: 0,
        onupdate,
      },
    });
    await tick();

    const language = target.querySelector(
      '[data-testid="annotation-language-cy"]',
    ) as HTMLButtonElement;
    language.click();
    await tick();
    const text = target.querySelector('#anno-text') as HTMLTextAreaElement;
    expect(text.disabled).toBe(false);
    text.value = 'Testun Cymraeg';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    expect(onupdate).toHaveBeenLastCalledWith({
      id: 'https://example.org/annotation/1',
      patch: { text: 'Testun Cymraeg' },
      options: {
        createBody: true,
        language: 'cy',
        bodyPurpose: 'commenting',
        textDirection: undefined,
      },
    });

    unmount(instance);
    target.remove();
  });

  it('keeps an imported language visible even when it is not in authoring setup', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const imported = projectToResolved(
      createMangoAnnotation({
        id: 'https://example.org/annotation/fr',
        canvasId: 'https://example.org/canvas/1',
        shape: { type: 'rect', geometry: { x: 1, y: 2, w: 30, h: 40 } },
        text: 'Un commentaire',
        language: 'fr',
      }),
      { provenance: 'local' },
    )!;
    const instance = mount(RightInspector, {
      target,
      props: { annotation: imported, languages: ['en', 'cy'] },
    });
    await tick();

    expect(target.querySelector('[data-testid="annotation-language-fr"]')).not.toBeNull();
    expect(
      target.querySelector('[data-testid="annotation-language-fr"]')?.getAttribute('aria-selected'),
    ).toBe('true');
    expect((target.querySelector('#anno-text') as HTMLTextAreaElement).value).toBe(
      'Un commentaire',
    );

    unmount(instance);
    target.remove();
  });

  it('offers keyboard-editable bounds for polygon geometry', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onupdate = vi.fn();
    const polygon = projectToResolved(
      createMangoAnnotation({
        id: 'https://example.org/annotation/polygon',
        canvasId: 'https://example.org/canvas/1',
        shape: {
          type: 'polygon',
          geometry: { points: [{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 20, y: 40 }] },
        },
      }),
      { provenance: 'local' },
    )!;
    const instance = mount(RightInspector, {
      target,
      props: { annotation: polygon, total: 1, index: 0, onupdate },
    });
    await tick();

    const position = target.querySelector('[data-testid="annotation-geometry"]') as HTMLDetailsElement;
    position.open = true;
    await tick();
    const width = target.querySelector('#anno-geom-w') as HTMLInputElement;
    expect(width.value).toBe('20');
    width.value = '40';
    width.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(onupdate).toHaveBeenLastCalledWith({
      id: 'https://example.org/annotation/polygon',
      patch: {
        shapeType: 'polygon',
        polygon: {
          points: [{ x: 10, y: 20 }, { x: 50, y: 20 }, { x: 30, y: 40 }],
        },
      },
      options: {},
    });

    unmount(instance);
    target.remove();
  });
});
