export type ManifestResolution =
  | { ok: true; manifest: string }
  | { ok: false; reason: 'missing-manifest' };

export const resolveManifestForNewChapter = (
  viewerManifest: string | null,
  previousManifest?: string | null,
): ManifestResolution => {
  if (viewerManifest) {
    return { ok: true, manifest: viewerManifest };
  }
  if (previousManifest) {
    return { ok: true, manifest: previousManifest };
  }
  return { ok: false, reason: 'missing-manifest' };
};
