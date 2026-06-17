/**
 * Persistence Manager
 * 
 * Manages save, load, and export operations for stories.
 * Extracted from storyBuilderController.ts to improve maintainability.
 * Part of CODE_REVIEW.md Priority 2.2: Decompose storyBuilderController.ts
 */

import type { Writable } from 'svelte/store';
import type { Story } from '../../core/types/story';

export type SaveConfig = {
  endpoint?: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  enabled?: boolean;
};

export type ExportEnvelope = {
  version: 1;
  exportedAt: string;
  meta: {
    source: 'storybuilder';
    appVersion?: string;
  };
  data: Story;
};

export type SaveResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; code?: string };

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'success'; message?: string }
  | { status: 'error'; message: string; code?: string };

export type PersistenceManagerDeps = {
  storyStoreWrapper: {
    exportStory: () => Story;
    loadStory: (story: Story) => void;
  };
  saveState: Writable<SaveState>;
  saveModalOpen: Writable<boolean>;
  saveModalPayload: Writable<ExportEnvelope | null>;
  appVersion?: string;
};

export type PersistenceManager = {
  setSaveConfig: (config: SaveConfig) => void;
  saveStory: () => Promise<SaveResult>;
  loadStory: (story: Story) => void;
  buildExportEnvelope: () => ExportEnvelope;
  closeSaveModal: () => void;
  validateStoryExport: () => { ok: boolean; errors: string[] };
};

/**
 * Create a persistence manager
 * 
 * @param deps - Dependencies (story store wrapper, save state stores, app version)
 * @returns Persistence manager with save/load/export operations
 */
export const createPersistenceManager = (deps: PersistenceManagerDeps): PersistenceManager => {
  const { storyStoreWrapper, saveState, saveModalOpen, saveModalPayload, appVersion } = deps;
  
  let saveConfig: SaveConfig | null = null;

  /**
   * Build an export envelope with the current story data
   * Transforms the story format for export (renumbers chapter IDs, flattens annotations)
   * 
   * @returns Export envelope ready for serialization
   */
  const buildExportEnvelope = (): ExportEnvelope => {
    const raw = storyStoreWrapper.exportStory();
    const mapped = {
      ...raw,
      chapters: raw.chapters.map((chapter, index) => {
        const { advance, annotationPlacement, annotations, ...rest } = chapter as any;
        const transitionTimeMs = advance?.delayMs;
        const next: any = { ...rest, id: `chapter_${index + 1}` };
        const mergedAnnotations = { ...(annotations ?? {}) };
        
        // Push placement into each annotation entry if missing, or as a special key
        if (annotationPlacement) {
          for (const lang of Object.keys(mergedAnnotations)) {
            mergedAnnotations[lang] = {
              ...(mergedAnnotations[lang] ?? {}),
              placement: mergedAnnotations[lang]?.placement ?? annotationPlacement,
            };
          }
          // If no annotations exist, keep placement as fallback
          if (Object.keys(mergedAnnotations).length === 0) {
            mergedAnnotations._default = { placement: annotationPlacement };
          }
        }
        
        if (Object.keys(mergedAnnotations).length > 0) {
          next.annotations = mergedAnnotations;
        }
        if (transitionTimeMs !== undefined) {
          next.transitionTimeMs = transitionTimeMs;
        }
        return next;
      }),
    };
    
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      meta: {
        source: 'storybuilder',
        ...(appVersion ? { appVersion } : {}),
      },
      data: mapped as Story,
    };
  };

  /**
   * Perform a fetch request with timeout
   */
  const performFetchWithTimeout = async (
    cfg: SaveConfig,
    payload: ExportEnvelope,
  ): Promise<SaveResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      cfg.timeoutMs ?? 10000,
    );
    
    try {
      const res = await fetch(cfg.endpoint as string, {
        method: cfg.method ?? 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.headers ?? {}),
        },
        credentials: cfg.credentials,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (!res.ok) {
        return { ok: false, message: `Save failed (${res.status})` };
      }
      
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        return { ok: false, message: 'Save failed (invalid JSON response)' };
      }
      
      const success = (body as any)?.success === true;
      if (success) {
        const msg = (body as any)?.message ?? 'Saved successfully';
        return { ok: true, message: msg };
      }
      
      const msg =
        (body as any)?.error?.message ||
        (body as any)?.message ||
        'Save failed';
      const code = (body as any)?.error?.code;
      return { ok: false, message: msg, code };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, message: 'Save timed out', code: 'timeout' };
      }
      return { ok: false, message: 'Could not reach server', code: 'network' };
    }
  };

  return {
    /**
     * Set the save configuration
     * 
     * @param config - Save configuration (endpoint, method, headers, etc.)
     */
    setSaveConfig: (config: SaveConfig) => {
      saveConfig = config;
    },

    /**
     * Save the story to the configured endpoint or open export modal
     * 
     * @returns Save result with success/failure status
     */
    saveStory: async (): Promise<SaveResult> => {
      const payload = buildExportEnvelope();
      const hasEndpoint =
        saveConfig?.endpoint && (saveConfig.enabled ?? true) ? true : false;
      
      if (!hasEndpoint) {
        // No endpoint configured - open modal for manual export
        saveModalPayload.set(payload);
        saveModalOpen.set(true);
        saveState.set({ status: 'idle' });
        return { ok: true };
      }
      
      saveState.set({ status: 'saving' });
      const result = await performFetchWithTimeout(saveConfig as SaveConfig, payload);
      
      if (result.ok) {
        saveState.set({ status: 'success', message: result.message });
      } else {
        saveState.set({ status: 'error', message: result.message, code: result.code });
      }
      
      return result;
    },

    /**
     * Load a story from external data
     * 
     * @param story - Story data to load
     */
    loadStory: (story: Story) => {
      storyStoreWrapper.loadStory(story);
    },

    /**
     * Build export envelope
     * 
     * @returns Export envelope
     */
    buildExportEnvelope,

    /**
     * Close the save modal
     */
    closeSaveModal: () => {
      saveModalOpen.set(false);
    },

    /**
     * Validate the story for export
     * Placeholder for validation logic
     * 
     * @returns Validation result
     */
    validateStoryExport: () => {
      // This would need access to validateStory function
      // For now, just return success
      return { ok: true, errors: [] };
    },
  };
};
