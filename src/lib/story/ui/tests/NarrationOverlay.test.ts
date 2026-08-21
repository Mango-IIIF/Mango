import { describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { createStoryStoreForTest } from './testHelpers';
import NarrationOverlay from '../NarrationOverlay.svelte';

const createTarget = (): HTMLDivElement => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return target;
};

describe('NarrationOverlay', () => {
  it('combines first-source setup with story settings', async () => {
    const target = createTarget();
    const onLoadSource = vi.fn();
    const instance = mount(NarrationOverlay, {
      target,
      props: {
        story: createStoryStoreForTest({ chapters: [] }).story,
        open: true,
        showSourceSetup: true,
        currentManifest: 'https://example.org/manifest.json',
        onLoadSource,
      },
    });
    await tick();

    expect(target.querySelector('.story-settings-modal')).toBeTruthy();
    expect(target.textContent).toContain('New story');
    expect(target.textContent).toContain('Load a source');
    expect(target.querySelector('[data-testid="story-title"]')).toBeTruthy();

    const sourceSection = target.querySelector('[data-testid="story-source-setup"]')!;
    const identifierSection = target.querySelector('[data-testid="story-publishing-identifiers"]')!;
    const languageAudioSection = target.querySelector('[data-testid="story-language-audio"]')!;
    expect(sourceSection.compareDocumentPosition(identifierSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(identifierSection.compareDocumentPosition(languageAudioSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(target.querySelectorAll('.narration-overlay__divider')).toHaveLength(2);

    const manifest = target.querySelector('[data-testid="chapter-manifest"]') as HTMLInputElement;
    expect(manifest.value).toBe('https://example.org/manifest.json');
    expect(target.querySelector('[data-testid="chapter-canvas-select"]')).toBeNull();

    manifest.value = 'https://example.org/next.json';
    manifest.dispatchEvent(new Event('input'));
    target.querySelector<HTMLButtonElement>('[data-testid="chapter-manifest-reload"]')?.click();
    expect(onLoadSource).toHaveBeenCalledWith('https://example.org/next.json');

    unmount(instance);
    target.remove();
  });

  it('updates the whole-story title for the active language', async () => {
    const store = createStoryStoreForTest({
      title: { en: 'Old title' },
      chapters: [],
    });
    const target = createTarget();

    const instance = mount(NarrationOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        language: 'en',
        languages: ['en'],
        onUpdateStoryTitle: (lang: string, value: string) => store.setStoryTitle({ language: lang, value }),
      },
    });

    const input = target.querySelector('[data-testid="story-title"]') as HTMLInputElement;
    expect(input.value).toBe('Old title');
    input.value = 'The whole story';
    input.dispatchEvent(new Event('input'));
    await tick();

    let storyValue: any;
    store.story.subscribe((value) => (storyValue = value))();
    expect(storyValue.title.en).toBe('The whole story');

    unmount(instance);
    target.remove();
  });

  /*
   * The AnnotationPage ID is empty by default and nothing said what that costs.
   * The export is valid IIIF either way now, but its identifiers sit under
   * mangoviewer.dev rather than the publisher's own domain — easy to ship
   * without noticing precisely because it looks legitimate.
   */
  it('says what an empty AnnotationPage ID costs, and stops once one is set', async () => {
    const store = createStoryStoreForTest({ chapters: [] });
    const target = createTarget();

    const instance = mount(NarrationOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        language: 'en',
        languages: ['en'],
      },
    });

    const notice = () => target.querySelector('[data-testid="story-draft-identifiers"]');
    expect(notice()?.textContent).toContain('mangoviewer.dev');

    const idInput = target.querySelector('[data-testid="story-public-id"]') as HTMLInputElement;
    idInput.value = 'https://museum.example/stories/42/chapters';
    idInput.dispatchEvent(new Event('input'));
    await tick();

    expect(notice()).toBeNull();

    unmount(instance);
    target.remove();
  });

  it('updates narration track at story level', async () => {
    const store = createStoryStoreForTest({
      narration: {
        tracks: {
          en: { src: 'https://example.org/old.mp3' },
        },
      },
      chapters: [],
    });
    const target = createTarget();

    const instance = mount(NarrationOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        language: 'en',
        languages: ['en'],
        onSetNarrationTrack: (lang: string, src: string) => store.setNarrationTrack({ language: lang, src }),
      },
    });

    const input = target.querySelector('[data-testid="narration-url"]') as HTMLInputElement;
    input.value = 'https://example.org/audio.mp3';
    input.dispatchEvent(new Event('input'));
    const save = target.querySelector('[data-testid="narration-assign"]') as HTMLButtonElement;
    save.click();

    await tick();
    const storyValue = await new Promise((resolve) => {
      store.story.subscribe((value) => resolve(value))();
    });

    expect((storyValue as any).narration.tracks.en.src).toBe('https://example.org/audio.mp3');

    unmount(instance);
    target.remove();
  });

  it('preserves URLs per language when switching', async () => {
    const store = createStoryStoreForTest({
      narration: {
        tracks: {
          en: { src: 'https://example.org/en.mp3' },
          cy: { src: 'https://example.org/cy.mp3' },
        },
      },
      chapters: [],
    });
    const target = createTarget();

    const instance = mount(NarrationOverlay, {
      target,
      props: {
        story: store.story,
        open: true,
        language: 'en',
        languages: ['en', 'cy'],
        onSetNarrationTrack: (lang: string, src: string) => store.setNarrationTrack({ language: lang, src }),
      },
    });

    const languageButtons = Array.from(target.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const english = languageButtons.find((button) => button.textContent?.trim() === 'EN');
    const welsh = languageButtons.find((button) => button.textContent?.trim() === 'CY');
    const input = target.querySelector('[data-testid="narration-url"]') as HTMLInputElement;

    expect(input.value).toBe('https://example.org/en.mp3');

    welsh?.click();
    await tick();
    expect(input.value).toBe('https://example.org/cy.mp3');

    input.value = 'https://example.org/cy-new.mp3';
    input.dispatchEvent(new Event('input'));
    await tick();

    english?.click();
    await tick();
    expect(input.value).toBe('https://example.org/en.mp3');

    unmount(instance);
    target.remove();
  });
});
