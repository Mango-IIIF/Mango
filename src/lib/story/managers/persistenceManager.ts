/**
 * Persistence Manager
 *
 * Manages save, load, and export operations for stories.
 * Extracted from storyBuilderController.ts to improve maintainability.
 * Part of CODE_REVIEW.md Priority 2.2: Decompose storyBuilderController.ts
 */

import type { Writable } from "svelte/store";
import type { Story } from "../../core/types/story";
import { buildExportEnvelope as buildStoryExportEnvelope } from "../helpers/exportHelpers";
import { performFetchWithTimeout as saveEnvelope } from "../helpers/saveHelpers";

export type SaveConfig = {
  endpoint?: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  enabled?: boolean;
};

export type ExportEnvelope = {
  version: 1;
  exportedAt: string;
  meta: {
    source: "storybuilder";
    appVersion?: string;
  };
  data: Story;
};

export type SaveResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; code?: string };

export type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; message?: string }
  | { status: "error"; message: string; code?: string };

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
export const createPersistenceManager = (
  deps: PersistenceManagerDeps,
): PersistenceManager => {
  const {
    storyStoreWrapper,
    saveState,
    saveModalOpen,
    saveModalPayload,
    appVersion,
  } = deps;

  let saveConfig: SaveConfig | null = null;

  const buildExportEnvelope = (): ExportEnvelope =>
    buildStoryExportEnvelope(storyStoreWrapper.exportStory(), appVersion);

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
        saveState.set({ status: "idle" });
        return { ok: true };
      }

      saveState.set({ status: "saving" });
      const result = await saveEnvelope(saveConfig as SaveConfig, payload);

      if (result.ok) {
        saveState.set({ status: "success", message: result.message });
      } else {
        saveState.set({
          status: "error",
          message: result.message,
          code: result.code,
        });
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
