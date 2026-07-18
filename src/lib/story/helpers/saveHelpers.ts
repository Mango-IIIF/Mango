import type { Story } from "../../core/types/story";

/**
 * Save Helpers - Functions for HTTP save operations
 */

export type SaveConfig = {
  endpoint?: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  enabled?: boolean;
};

export type SaveResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; code?: string };

export type ExportEnvelope = {
  version: number;
  exportedAt: string;
  meta: {
    source: string;
    appVersion?: string;
  };
  data: Story;
};

/**
 * Perform HTTP save with timeout handling
 */
export const performFetchWithTimeout = async (
  cfg: SaveConfig,
  payload: ExportEnvelope,
): Promise<SaveResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 10000);

  try {
    const res = await fetch(cfg.endpoint as string, {
      method: cfg.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
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
      return { ok: false, message: "Save failed (invalid JSON response)" };
    }

    const response =
      body && typeof body === "object"
        ? (body as {
            success?: unknown;
            message?: unknown;
            error?: { message?: unknown; code?: unknown };
          })
        : {};
    const success = response.success === true;
    if (success) {
      const msg =
        typeof response.message === "string"
          ? response.message
          : "Saved successfully";
      return { ok: true, message: msg };
    }

    const msg =
      (typeof response.error?.message === "string" && response.error.message) ||
      (typeof response.message === "string" && response.message) ||
      "Save failed";
    const code =
      typeof response.error?.code === "string"
        ? response.error.code
        : undefined;
    return { ok: false, message: msg, code };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, message: "Save timed out", code: "timeout" };
    }
    return { ok: false, message: "Could not reach server", code: "network" };
  }
};
