import { derived } from 'svelte/store';
import { pickCanvasFromManifest } from '../iiif/thumbnails';
import { createExternalAnnotationLoader } from '../iiif/externalAnnotations';
import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
import type { ViewerStateStores } from '../state/viewerState';
import type { ViewerDerivedStores } from '../state/viewerDerived';

const resolveCanvasKey = (canvasId: string | null, index: number): string =>
  canvasId || `index-${index}`;

const updateRecord = (
  current: Record<string, ResolvedAnnotation[]>,
  key: string,
  value: ResolvedAnnotation[],
) => ({ ...current, [key]: value });

const resolveStyleHost = (target: EventTarget | null): ShadowRoot | HTMLHeadElement | null => {
  if (typeof document === 'undefined') return null;
  if (target && 'getRootNode' in target) {
    const root = (target as HTMLElement).getRootNode();
    if (root instanceof ShadowRoot) return root;
  }
  return document.head;
};

export const createExternalAnnotationEffects = ({
  state,
  derived: derivedStores,
  getEventTarget,
}: {
  state: ViewerStateStores;
  derived: ViewerDerivedStores;
  getEventTarget: () => EventTarget | null;
}) => {
  const loader = createExternalAnnotationLoader();
  const loadedAnnotationStylesheets = new Set<string>();
  const unsubscribers: Array<() => void> = [];

  const loadAnnotationStylesheet = async (url: string) => {
    if (loadedAnnotationStylesheets.has(url)) return;
    const host = resolveStyleHost(getEventTarget());
    if (!host) return;
    loadedAnnotationStylesheets.add(url);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const css = await response.text();
      const style = document.createElement('style');
      style.setAttribute('data-annotation-stylesheet', url);
      style.textContent = css;
      host.appendChild(style);
    } catch (error) {
      loadedAnnotationStylesheets.delete(url);
      console.warn('Failed to load annotation stylesheet', url, error);
    }
  };

  const ensureAnnotationStylesheets = async (urls: string[]) => {
    await Promise.all(urls.map((url) => loadAnnotationStylesheet(url)));
  };

  const externalLoad = derived(
    [derivedStores.manifestEntry, derivedStores.canvases, state.selectedCanvasIndex],
    ([entry, canvases, index]) => {
      if (!entry?.manifesto || canvases.length === 0) {
        return;
      }
      const canvas = canvases[index];
      const canvasJson = pickCanvasFromManifest(entry.manifesto, canvas?.id, index);
      const canvasKey = resolveCanvasKey(canvas?.id ?? null, index);
      void loader
        .load(canvasJson, canvasKey, canvas?.id)
        .then((items) => {
          state.externalAnnotations.update((current) => {
            const updated = updateRecord(current, canvasKey, items);
            return updated;
          });
        })
        .catch((error) => {
          console.error('[Mango ExternalAnnotationEffects] Error loading external annotations:', error);
        });
    },
  );
  unsubscribers.push(externalLoad.subscribe(() => undefined));

  unsubscribers.push(
    derivedStores.annotations.subscribe((items) => {
      const stylesheets = new Set<string>();
      for (const annotation of items) {
        for (const sheet of annotation.stylesheets ?? []) {
          stylesheets.add(sheet);
        }
      }
      if (stylesheets.size > 0) {
        void ensureAnnotationStylesheets(Array.from(stylesheets));
      }
    }),
  );

  const destroy = () => {
    loader.clear();
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };

  const reset = () => {
    loader.clear();
  };

  return { destroy, reset };
};
