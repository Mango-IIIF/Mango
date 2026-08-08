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

export const createExternalAnnotationEffects = ({
  state,
  derived: derivedStores,
}: {
  state: ViewerStateStores;
  derived: ViewerDerivedStores;
}) => {
  const loader = createExternalAnnotationLoader();
  const unsubscribers: Array<() => void> = [];

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
